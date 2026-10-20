#!/usr/bin/env python3
# ============================================================================
# LT360 — Teste de concorrência da Entrega 2.1 (SOMENTE ambiente isolado)
# ============================================================================
# NÃO rodar contra o banco principal. Confirma que o advisory lock por
# professor_id (pg_advisory_xact_lock) realmente serializa duas transações
# concorrentes tentando ocupar a mesma capacidade — sem a trava, ambas
# poderiam ler "0 conflitos" antes de qualquer uma commitar, e as duas
# passariam, violando a capacidade (write-skew clássico).
#
# Cenários:
#   C1 — Duas transações tentam inserir no MESMO horário (capacidade=1).
#        Esperado: a 2ª só prossegue depois da 1ª commitar (prova que o lock
#        bloqueia), e então falha com LT004 (porque a 1ª já ocupou a vaga).
#   C2 — Duas transações inserem em horários DIFERENTES e sem conflito entre
#        si, mesmo professor. Esperado: o lock serializa a ORDEM, mas ambas
#        COMMITAM com sucesso (a trava nunca rejeita o que não conflita).
#   C3 — CONTROLE: mesma situação do C1, mas com uma variante da função SEM
#        o advisory lock instalada só neste banco de teste, para provar que,
#        sem a trava, a corrida realmente produz capacidade excedida.
# ============================================================================

import os
import sys
import threading
import time
import psycopg2
from psycopg2 import errorcodes

DSN = os.environ.get("LT360_DSN", "host=127.0.0.1 dbname=lt360_sandbox user=postgres password=postgres")

PA = "00000000-0000-0000-0000-0000000000a0"  # Personal A, capacidade=1
AL1 = "00000000-0000-0000-0000-0000000000a1"
AL2 = "00000000-0000-0000-0000-0000000000a2"

falhas = []


def conn(autocommit=False):
    c = psycopg2.connect(DSN)
    c.autocommit = autocommit
    return c


def as_authenticated(cur, professor_id):
    cur.execute("set local role authenticated")
    cur.execute(
        "select set_config('request.jwt.claims', %s, true)",
        (__import__("json").dumps({"sub": professor_id}),),
    )


def ok(msg):
    print("OK:", msg)


def bad(msg):
    falhas.append(msg)
    print("FALHA:", msg)


def limpar(adm):
    cur = adm.cursor()
    cur.execute("delete from public.aulas where professor_id=%s", (PA,))


# ---------------------------------------------------------------------------
# C1 — mesmo horário, capacidade=1: a 2ª transação espera e depois falha
# ---------------------------------------------------------------------------
def cenario_c1(adm):
    limpar(adm)
    resultados = {}
    barreira = threading.Barrier(2)

    def tx(nome, id_, aluno):
        c = conn()
        try:
            cur = c.cursor()
            as_authenticated(cur, PA)
            barreira.wait()
            t0 = time.monotonic()
            cur.execute(
                "insert into public.aulas(id,professor_id,aluno_id,data,hora,status,faturada,origem) "
                "values (%s,%s,%s,'2026-12-20','08:00','agendada',false,'manual')",
                (id_, PA, aluno),
            )
            time.sleep(0.8)  # mantém a transação aberta (e o lock) de propósito
            c.commit()
            resultados[nome] = ("commit", time.monotonic() - t0)
        except psycopg2.Error as e:
            resultados[nome] = (f"erro: {e.pgcode}", time.monotonic() - t0)
            c.rollback()
        finally:
            c.close()

    ta = threading.Thread(target=tx, args=("a", "00000000-0000-0000-0000-0000000000c1", AL1))
    tb = threading.Thread(target=tx, args=("b", "00000000-0000-0000-0000-0000000000c2", AL2))
    ta.start(); tb.start()
    ta.join(); tb.join()

    # Não assumimos qual das duas threads "ganha" a corrida (não é determinístico) —
    # a propriedade que importa é: exatamente uma commita, a outra espera o lock
    # ser liberado e então falha com LT004 porque a vaga já foi ocupada.
    status = {k: v[0] for k, v in resultados.items()}
    esperas = {k: v[1] for k, v in resultados.items()}
    commits = [k for k, s in status.items() if s == "commit"]
    falhas_lt004 = [k for k, s in status.items() if s == "erro: LT004"]

    if len(commits) != 1 or len(falhas_lt004) != 1:
        bad(f"C1: esperava exatamente 1 commit e 1 falha LT004, obtido: {status}")
        return
    perdedor = falhas_lt004[0]
    if esperas[perdedor] < 0.5:
        bad(f"C1: a transacao que falhou deveria ter esperado o lock (~0.8s), esperou so {esperas[perdedor]:.2f}s — lock pode nao estar serializando")
        return
    ok(f"C1: exatamente uma transacao commitou, a outra esperou {esperas[perdedor]:.2f}s pelo lock e so entao falhou com LT004 — serializacao real confirmada, sem write-skew")


# ---------------------------------------------------------------------------
# C2 — horários diferentes, sem conflito: ambas commitam
# ---------------------------------------------------------------------------
def cenario_c2(adm):
    limpar(adm)
    resultados = {}
    barreira = threading.Barrier(2)

    def tx(id_, aluno, hora):
        c = conn()
        try:
            cur = c.cursor()
            as_authenticated(cur, PA)
            barreira.wait()
            cur.execute(
                "insert into public.aulas(id,professor_id,aluno_id,data,hora,status,faturada,origem) "
                "values (%s,%s,%s,'2026-12-21',%s,'agendada',false,'manual')",
                (id_, PA, aluno, hora),
            )
            time.sleep(0.3)
            c.commit()
            resultados[id_] = "commit"
        except Exception as e:
            c.rollback()
            resultados[id_] = f"erro: {getattr(e, 'pgcode', None)}"
        finally:
            c.close()

    t1 = threading.Thread(target=tx, args=("00000000-0000-0000-0000-0000000000c3", AL1, "09:00"))
    t2 = threading.Thread(target=tx, args=("00000000-0000-0000-0000-0000000000c4", AL2, "15:00"))
    t1.start(); t2.start()
    t1.join(); t2.join()

    if resultados.get("00000000-0000-0000-0000-0000000000c3") != "commit" or \
       resultados.get("00000000-0000-0000-0000-0000000000c4") != "commit":
        bad(f"C2: ambas deveriam commitar (sem conflito real), resultado: {resultados}")
        return
    ok("C2: duas transacoes concorrentes, horarios sem conflito, ambas commitaram (lock serializa ordem, nao rejeita o que nao conflita)")


# ---------------------------------------------------------------------------
# C3 — CONTROLE: variante sem advisory lock reproduz a corrida
# ---------------------------------------------------------------------------
def instalar_variante_sem_lock(adm):
    cur = adm.cursor()
    cur.execute("""
      create or replace function public.validar_capacidade_aula_SEMLOCK()
      returns trigger language plpgsql security invoker set search_path = '' as $$
      declare
        v_capacidade integer;
        v_pico integer;
        v_hora_fim time;
      begin
        if NEW.status not in ('agendada','confirmada','concluida') then return NEW; end if;
        v_hora_fim := (NEW.hora + (coalesce(NEW.duracao_min,50) || ' minutes')::interval)::time;
        -- SEM pg_advisory_xact_lock de proposito: reproduz a janela de corrida
        select coalesce(capacidade_simultanea,1) into v_capacidade from public.profiles where id = NEW.professor_id;
        select count(*)+1 into v_pico from public.aulas a2
          where a2.professor_id = NEW.professor_id and a2.data = NEW.data and a2.id <> NEW.id
            and a2.status in ('agendada','confirmada','concluida')
            and a2.hora <= NEW.hora and NEW.hora < (a2.hora + (coalesce(a2.duracao_min,50) || ' minutes')::interval)::time;
        if v_pico > v_capacidade then
          raise exception 'capacidade excedida' using errcode = 'LT004';
        end if;
        return NEW;
      end; $$;
    """)
    cur.execute("drop trigger if exists trg_validar_capacidade_aula on public.aulas")
    cur.execute("""create trigger trg_validar_capacidade_aula
                   before insert or update of data, hora, duracao_min, professor_id, status
                   on public.aulas for each row
                   execute function public.validar_capacidade_aula_SEMLOCK()""")


def restaurar_funcao_real(adm):
    cur = adm.cursor()
    cur.execute("drop trigger if exists trg_validar_capacidade_aula on public.aulas")
    cur.execute("""create trigger trg_validar_capacidade_aula
                   before insert or update of data, hora, duracao_min, professor_id, status
                   on public.aulas for each row
                   execute function public.validar_capacidade_aula()""")
    cur.execute("drop function if exists public.validar_capacidade_aula_SEMLOCK()")


def cenario_c3(adm):
    instalar_variante_sem_lock(adm)
    try:
        limpar(adm)
        resultados = {}
        barreira = threading.Barrier(2)

        def tx(id_, aluno):
            c = conn()
            try:
                cur = c.cursor()
                as_authenticated(cur, PA)
                barreira.wait()
                cur.execute(
                    "insert into public.aulas(id,professor_id,aluno_id,data,hora,status,faturada,origem) "
                    "values (%s,%s,%s,'2026-12-20','08:00','agendada',false,'manual')",
                    (id_, PA, aluno),
                )
                time.sleep(0.5)
                c.commit()
                resultados[id_] = "commit"
            except Exception as e:
                c.rollback()
                resultados[id_] = f"erro: {getattr(e, 'pgcode', None)}"
            finally:
                c.close()

        t1 = threading.Thread(target=tx, args=("00000000-0000-0000-0000-0000000000c5", AL1))
        t2 = threading.Thread(target=tx, args=("00000000-0000-0000-0000-0000000000c6", AL2))
        t1.start(); t2.start()
        t1.join(); t2.join()

        commits = sum(1 for v in resultados.values() if v == "commit")
        if commits == 2:
            ok("C3 (controle): SEM a trava, as duas transacoes concorrentes commitaram — capacidade=1 violada na pratica (confirma que o advisory lock da versao real e necessario, nao decorativo)")
        else:
            bad(f"C3 (controle): esperava as 2 transacoes commitando (reproduzindo a corrida), obtido: {resultados}")
    finally:
        restaurar_funcao_real(adm)
        limpar(adm)


def main():
    adm = conn(autocommit=True)
    cenario_c1(adm)
    cenario_c2(adm)
    cenario_c3(adm)
    limpar(adm)
    adm.close()
    print("\nRESULTADO:", "TODOS OS CENARIOS OK" if not falhas else f"{len(falhas)} FALHA(S): {falhas}")
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()
