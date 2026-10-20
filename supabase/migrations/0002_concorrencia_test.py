#!/usr/bin/env python3
# ============================================================================
# LT360 — Teste de concorrência da Etapa 1 (SOMENTE ambiente isolado)
# ============================================================================
# NÃO rodar contra o banco principal. Precisa de duas conexões simultâneas,
# o que não é possível em um único script .sql — por isso é um harness em
# Python (psycopg2) que abre duas transações e as interleava deliberadamente.
#
# Cenário central (write-skew):
#   Tx A: cria uma reposição Y vinculada à aula original X.
#   Tx B: altera aluno_id de X.
# Sem serialização, ambas passam nas suas checagens (nenhuma vê a linha
# não-commitada da outra) e o banco termina incoerente (Y aponta para X com
# aluno diferente). A 0002 serializa as duas na linha de X via
# FOR NO KEY UPDATE.
#
# O harness roda 3 cenários:
#   C1  — COM a 0002: a 2ª transação é BLOQUEADA pela trava da 1ª (prova via
#         lock_timeout => SQLSTATE 55P03).
#   C2  — COM a 0002: após a reposição commitada, alterar X é barrado por
#         LT003 (revalidação contra o estado commitado).
#   C3  — CONTROLE, sem a trava (variante sem FOR NO KEY UPDATE instalada só
#         neste banco de teste): a corrida acontece e o banco fica incoerente
#         — prova que a trava é NECESSÁRIA, não decorativa. Ao final, restaura
#         a função real e limpa.
#
# Limitações (ver também o relatório no documento):
#   - Roda como owner (postgres) do banco isolado: a semântica de travas de
#     linha independe de RLS/role, então isto é fiel ao que ocorreria com
#     "authenticated"; a correção de RLS é coberta pelos testes .sql.
#   - Reproduz o comportamento sob READ COMMITTED (padrão do Supabase). Sob
#     REPEATABLE READ/SERIALIZABLE o efeito seria erro de serialização
#     (40001) a ser retentado pelo cliente — não testado aqui.
#   - Usa um stub de auth.users; não é o GoTrue real.
# ============================================================================

import os
import sys
import threading
import time
import psycopg2
from psycopg2 import errorcodes

DSN = os.environ.get("LT360_DSN", "host=127.0.0.1 dbname=lt360_sandbox user=postgres password=postgres")

X   = "00000000-0000-0000-0000-00000000c001"  # aula original
Y   = "00000000-0000-0000-0000-00000000c0f1"  # reposição
PA  = "00000000-0000-0000-0000-0000000000ca"  # personal
AL1 = "00000000-0000-0000-0000-0000000000a1"  # aluno 1
AL2 = "00000000-0000-0000-0000-0000000000a2"  # aluno 2

falhas = []

def conn(autocommit=False):
    c = psycopg2.connect(DSN)
    c.autocommit = autocommit
    return c

def setup(adm):
    cur = adm.cursor()
    # fixtures idempotentes
    cur.execute("insert into auth.users(id) values (%s) on conflict (id) do nothing", (PA,))
    cur.execute("update public.profiles set nome='Personal Concorrência' where id=%s", (PA,))
    for al, nome, tel in ((AL1, "Aluno 1", "1"), (AL2, "Aluno 2", "2")):
        cur.execute(
            "insert into public.alunos(id,professor_id,nome,telefone,plano_tipo,plano_cobranca) "
            "values (%s,%s,%s,%s,'mensal','fixa') on conflict (id) do nothing",
            (al, PA, nome, tel))
    reset_x(adm)

def reset_x(adm):
    cur = adm.cursor()
    cur.execute("delete from public.aulas where id=%s", (Y,))
    cur.execute("delete from public.aulas where id=%s", (X,))
    cur.execute(
        "insert into public.aulas(id,professor_id,aluno_id,data,hora,status) "
        "values (%s,%s,%s,current_date+10,'08:00','agendada')",
        (X, PA, AL1))

def insert_Y(cur):
    cur.execute(
        "insert into public.aulas(id,professor_id,aluno_id,data,hora,status,aula_origem_reposicao_id) "
        "values (%s,%s,%s,current_date+11,'08:00','agendada',%s)",
        (Y, PA, AL1, X))

def ok(msg):   print("OK:", msg)
def bad(msg):  falhas.append(msg); print("FALHA:", msg)

# ---------------------------------------------------------------------------
# C1 — COM a 0002: a 2ª transação é bloqueada pela trava da 1ª
# ---------------------------------------------------------------------------
def cenario_c1(adm):
    reset_x(adm)
    a, b = conn(), conn()
    try:
        ca, cb = a.cursor(), b.cursor()
        insert_Y(ca)                       # A trava X (FOR NO KEY UPDATE), não commita
        cb.execute("set local lock_timeout='1500ms'")
        try:
            cb.execute("update public.aulas set aluno_id=%s where id=%s", (AL2, X))
            bad("C1: UPDATE de B NÃO foi bloqueado pela trava de A (write-skew possível)")
        except psycopg2.errors.LockNotAvailable:
            ok("C1: UPDATE de B foi bloqueado pela trava de A (55P03 lock_timeout) — serialização ativa")
        except Exception as e:
            bad(f"C1: erro inesperado em B: {errorcodes.lookup(getattr(e,'pgcode','') or '00000')} {e}")
    finally:
        a.rollback(); b.rollback(); a.close(); b.close()

# ---------------------------------------------------------------------------
# C2 — COM a 0002: reposição commitada => alterar X é barrado por LT003
# ---------------------------------------------------------------------------
def cenario_c2(adm):
    reset_x(adm)
    a = conn()
    try:
        insert_Y(a.cursor()); a.commit()   # Y agora existe e está commitada
        b = conn()
        try:
            cb = b.cursor()
            try:
                cb.execute("update public.aulas set aluno_id=%s where id=%s", (AL2, X))
                bad("C2: alterar aluno de X foi permitido mesmo com reposição commitada")
            except psycopg2.Error as e:
                if getattr(e, "pgcode", None) == "LT003":
                    ok("C2: alterar aluno de X barrado por LT003 (revalidação contra estado commitado)")
                else:
                    bad(f"C2: erro inesperado (esperado LT003): {e.pgcode} {e}")
        finally:
            b.rollback(); b.close()
    finally:
        a.rollback(); a.close()
    adm.cursor().execute("delete from public.aulas where id=%s", (Y,))

# ---------------------------------------------------------------------------
# C3 — CONTROLE: sem a trava a corrida acontece (prova que a trava importa)
# ---------------------------------------------------------------------------
def instalar_variante_sem_trava(adm):
    cur = adm.cursor()
    cur.execute("""
      create or replace function public.validar_integridade_reposicao_SEMLOCK()
      returns trigger language plpgsql security definer set search_path='' as $$
      declare v_p uuid; v_al uuid;
      begin
        if new.aula_origem_reposicao_id is null then return new; end if;
        -- SEM 'for no key update' de propósito: reproduz a janela de corrida
        select professor_id, aluno_id into v_p, v_al
          from public.aulas where id = new.aula_origem_reposicao_id;
        if v_p is null then raise exception 'origem nao encontrada' using errcode='LT002'; end if;
        if v_p <> new.professor_id then raise exception 'professor' using errcode='LT002'; end if;
        if v_al <> new.aluno_id then raise exception 'aluno' using errcode='LT002'; end if;
        return new;
      end; $$;
    """)
    cur.execute("drop trigger if exists trg_validar_integridade_reposicao on public.aulas")
    cur.execute("""create trigger trg_validar_integridade_reposicao
                   before insert or update on public.aulas
                   for each row execute function public.validar_integridade_reposicao_SEMLOCK()""")

def restaurar_funcao_real(adm):
    cur = adm.cursor()
    cur.execute("drop trigger if exists trg_validar_integridade_reposicao on public.aulas")
    cur.execute("""create trigger trg_validar_integridade_reposicao
                   before insert or update on public.aulas
                   for each row execute function public.validar_integridade_reposicao()""")
    cur.execute("drop function if exists public.validar_integridade_reposicao_SEMLOCK()")

def cenario_c3(adm):
    instalar_variante_sem_trava(adm)
    try:
        reset_x(adm)
        a, b = conn(), conn()
        try:
            insert_Y(a.cursor())                               # A insere Y (sem travar X)
            b.cursor().execute("update public.aulas set aluno_id=%s where id=%s", (AL2, X))  # B não bloqueia
            b.commit(); a.commit()                             # ambos passam
        finally:
            try: a.close()
            except Exception: pass
            try: b.close()
            except Exception: pass
        cur = adm.cursor()
        cur.execute("""select count(*) from public.aulas y join public.aulas x
                       on y.aula_origem_reposicao_id = x.id
                       where y.id=%s and y.aluno_id <> x.aluno_id""", (Y,))
        incoerentes = cur.fetchone()[0]
        if incoerentes == 1:
            ok("C3 (controle): SEM a trava a corrida produziu vínculo incoerente — confirma que a trava da 0002 é necessária")
        else:
            bad(f"C3 (controle): esperava 1 vínculo incoerente, obtido {incoerentes} (o controle não reproduziu a corrida)")
    finally:
        restaurar_funcao_real(adm)
        reset_x(adm)

def main():
    adm = conn(autocommit=True)
    setup(adm)
    cenario_c1(adm)
    cenario_c2(adm)
    cenario_c3(adm)
    # limpeza final
    cur = adm.cursor()
    cur.execute("delete from public.aulas where id in (%s,%s)", (Y, X))
    adm.close()
    print("\nRESULTADO:", "TODOS OS CENÁRIOS OK" if not falhas else f"{len(falhas)} FALHA(S): {falhas}")
    sys.exit(1 if falhas else 0)

if __name__ == "__main__":
    main()
