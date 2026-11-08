-- ============================================================================
-- LT360 — Políticas de cancelamento (ETAPA 2 / RPCs transacionais)
--
-- ✅ STATUS: APLICADA em produção (projeto trainer-flow) em 2026-11-04, com
--    autorização explícita do usuário, via Supabase MCP apply_migration
--    (name "0010_rpcs_cancelamento"), após a 0009. Validada antes em Docker
--    (pgTAP 43/43). Mantida versionada como fonte/referência. Não reaplicar.
--    PENDENTE (bloqueado pelo gate de produção): revogar EXECUTE da função de
--    trigger validar_integridade_solicitacao_ativa() de anon/authenticated
--    (advisors 0028/0029) — ver 0011_revoke_trigger_fn_execute.sql.
--
-- O que esta migração cria (tudo ADITIVO — não altera tabelas/colunas/RPCs
-- existentes, não toca na agenda, no financeiro atual, nas remarcações/
-- solicitações nem no fluxo de exclusão de aluno):
--   * 1 índice de anti-duplicação em cancelamentos.
--   * Helpers internos de política (validação de faixas + percentual sugerido).
--   * RPCs SECURITY DEFINER (search_path=public, revalidando posse):
--       - configurar_politica
--       - abrir_cancelamento                (aluno pede)
--       - decidir_solicitacao_cancelamento  (personal aprova/recusa pedido)
--       - registrar_cancelamento_personal   (personal cancela direto)
--       - registrar_resolucao_diferenca     (aula já paga — §1.6)
--       - abrir_contestacao / responder_contestacao (§1.9)
--   * Gravação de auditoria (reutiliza public.auditoria) em toda decisão.
--
-- Princípios atendidos:
--   §1.5 mensalidade fixa: nenhuma alteração financeira automática (só registro).
--   §1.6 aula já paga: preserva o pago, calcula a diferença, resolução manual.
--   §1.7 pendente: % define o valor; estados pendente/pago; sem duplicar cobrança.
--   §1.10 auditoria + snapshot imutável da política na decisão.
--   §3 segurança: escrita só por RPC DEFINER; REVOKE de public/anon; GRANT
--       apenas a authenticated; cada RPC revalida auth.uid() contra posse.
--   Anti-duplicação: trava de linha (FOR UPDATE) na aula + índice único parcial
--       (1 cancelamento efetivo por aula) + chave idempotente da cobrança.
--
-- NÃO cria estratégia de exclusão definitiva (decisão de retenção pendente).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0) Anti-duplicação estrutural: no máximo 1 cancelamento efetivo por aula.
-- ----------------------------------------------------------------------------
create unique index if not exists idx_cancelamento_ativo_por_aula
  on public.cancelamentos (aula_id)
  where status in ('aprovado','efetivado') and aula_id is not null;

-- ----------------------------------------------------------------------------
-- 1) HELPERS DE POLÍTICA (internos; sem exposição a anon/authenticated)
-- ----------------------------------------------------------------------------

-- Valida que as faixas cobrem [0, ∞) sem lacuna nem sobreposição, limites
-- exatos no formato [de_horas, ate_horas) e percentuais em 0..100.
create or replace function public.validar_faixas_cancelamento(p_faixas jsonb)
returns void
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  r record;
  v_esperado numeric := 0;
  v_tem_aberta boolean := false;
begin
  if p_faixas is null or jsonb_typeof(p_faixas) <> 'array' then
    raise exception 'faixas deve ser um array jsonb' using errcode = 'LT200';
  end if;
  if jsonb_array_length(p_faixas) = 0 then
    return; -- política sem faixas (ex.: ativo=false) é permitida
  end if;

  -- Ordem-independente: normaliza e ordena por de_horas ASC, depois confere a
  -- cobertura contígua de [0, ∞) sem lacuna/sobreposição. O editor exibe as
  -- faixas em ordem decrescente (24h→0% primeiro), então NÃO se pode exigir uma
  -- ordem específica no array de entrada.
  for r in
    select (e ->> 'de_horas')          as de_raw,
           (e ->> 'percentual')        as pct_raw,
           (e ->> 'de_horas')::numeric as de,
           nullif(e ->> 'ate_horas','')::numeric as ate,
           (e ->> 'percentual')::numeric as pct
    from jsonb_array_elements(p_faixas) e
    order by (e ->> 'de_horas')::numeric
  loop
    if r.de_raw is null or r.pct_raw is null then
      raise exception 'cada faixa precisa de de_horas e percentual' using errcode = 'LT201';
    end if;
    if r.pct < 0 or r.pct > 100 then
      raise exception 'percentual fora de 0..100 (faixa de_horas=%)', r.de using errcode = 'LT202';
    end if;
    if v_tem_aberta then
      raise exception 'há faixa após a faixa aberta (ate_horas null)' using errcode = 'LT205';
    end if;
    if r.de <> v_esperado then
      raise exception 'faixa de_horas=% quebra a continuidade (esperado %)', r.de, v_esperado using errcode = 'LT203';
    end if;
    if r.ate is not null then
      if r.ate <= r.de then
        raise exception 'ate_horas deve ser > de_horas (faixa de_horas=%)', r.de using errcode = 'LT204';
      end if;
      v_esperado := r.ate;
    else
      v_tem_aberta := true;
    end if;
  end loop;

  if not v_tem_aberta then
    raise exception 'as faixas precisam cobrir até o infinito (última com ate_horas null)' using errcode = 'LT206';
  end if;
end;
$$;
-- Helpers internos: não precisam ser expostos como RPC a ninguém (o dono os
-- executa internamente via SECURITY DEFINER; o front faz a própria validação-espelho).
revoke all on function public.validar_faixas_cancelamento(jsonb) from public, anon, authenticated;

-- Dado o conjunto de faixas e a antecedência (horas), devolve o percentual
-- sugerido (ou null se não houver política/faixa aplicável).
create or replace function public.percentual_sugerido_cancelamento(p_faixas jsonb, p_horas numeric)
returns numeric
language plpgsql
immutable
set search_path to 'public'
as $$
declare v_elem jsonb; v_de numeric; v_ate numeric;
begin
  if p_faixas is null or jsonb_typeof(p_faixas) <> 'array' then return null; end if;
  for v_elem in select jsonb_array_elements(p_faixas) loop
    v_de  := (v_elem ->> 'de_horas')::numeric;
    v_ate := nullif(v_elem ->> 'ate_horas','')::numeric;
    if p_horas >= v_de and (v_ate is null or p_horas < v_ate) then
      return (v_elem ->> 'percentual')::numeric;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.percentual_sugerido_cancelamento(jsonb, numeric) from public, anon, authenticated;

-- Trigger de defesa em profundidade: valida as faixas também em escrita direta
-- (a gravação oficial é via configurar_politica, mas isto impede estado inválido).
create or replace function public.trg_validar_politica_cancelamento()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  perform public.validar_faixas_cancelamento(NEW.faixas);
  NEW.atualizado_em := now();
  return NEW;
end;
$$;

drop trigger if exists trg_validar_politica_cancelamento on public.politicas_cancelamento;
create trigger trg_validar_politica_cancelamento
  before insert or update on public.politicas_cancelamento
  for each row execute function public.trg_validar_politica_cancelamento();

-- Defesa em profundidade na tabela `solicitacoes` (fecha IDOR na origem — vale
-- também para o fluxo PRÉ-EXISTENTE responder_contraproposta): no INSERT a
-- aula/aluno/professor precisam ser consistentes; no UPDATE bloqueia REPONTAR a
-- solicitação para OUTRA aula/aluno/professor ou trocar o tipo. Preserva os
-- fluxos atuais (remarcar/cancelar/contraproposta só mudam status/contra_*/
-- resposta) E permite o `SET NULL` do FK quando a aula é apagada (inativação/
-- exclusão de aluno) — por isso o null de aula_id é explicitamente permitido,
-- senão a cascata de exclusão/inativação abortaria. Espelha o trigger já
-- existente da tabela órfã `solicitacoes_aluno`. SECURITY DEFINER + search_path=''
-- para validar contra o estado real (não o recorte da RLS).
create or replace function public.validar_integridade_solicitacao_ativa()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare v_aula_prof uuid; v_aula_aluno uuid; v_aluno_prof uuid;
begin
  if TG_OP = 'UPDATE' then
    -- Permite: SET NULL do FK (aula apagada) e no-ops. Bloqueia: repontar para
    -- OUTRA aula (vetor de IDOR) e trocar aluno/professor/tipo.
    if (NEW.aula_id is not null and NEW.aula_id is distinct from OLD.aula_id)
       or NEW.aluno_id is distinct from OLD.aluno_id
       or NEW.professor_id is distinct from OLD.professor_id
       or NEW.tipo is distinct from OLD.tipo then
      raise exception 'solicitacoes: não é permitido repontar aula/aluno/professor nem trocar o tipo da solicitação' using errcode = 'LT207';
    end if;
    return NEW;
  end if;
  -- INSERT
  if NEW.aula_id is not null then
    select professor_id, aluno_id into v_aula_prof, v_aula_aluno from public.aulas where id = NEW.aula_id;
    if v_aula_prof is null then
      raise exception 'solicitacoes: aula inexistente' using errcode = 'LT208';
    end if;
    if v_aula_prof <> NEW.professor_id or v_aula_aluno <> NEW.aluno_id then
      raise exception 'solicitacoes: aula não pertence a este aluno/professor' using errcode = 'LT208';
    end if;
  end if;
  select professor_id into v_aluno_prof from public.alunos where id = NEW.aluno_id;
  if v_aluno_prof is null or v_aluno_prof <> NEW.professor_id then
    raise exception 'solicitacoes: aluno não pertence a este professor' using errcode = 'LT208';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_validar_integridade_solicitacao_ativa on public.solicitacoes;
create trigger trg_validar_integridade_solicitacao_ativa
  before insert or update on public.solicitacoes
  for each row execute function public.validar_integridade_solicitacao_ativa();

-- ----------------------------------------------------------------------------
-- 2) Helper financeiro interno (reutilizado por aprovar e por cancelar direto).
--    Regras: §1.5 (fixa = sem efeito), §1.6 (pago = preserva + diferença),
--    §1.7 (pendente = ajusta, nunca duplica). NÃO é RPC público.
-- ----------------------------------------------------------------------------
create or replace function public._cancel_aplicar_financeiro(
  p_aula public.aulas,
  p_aluno public.alunos,
  p_percentual numeric,
  out valor_referencia numeric,
  out valor_devido numeric,
  out valor_pago_original numeric,
  out diferenca numeric,
  out pagamento_id uuid
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pg public.pagamentos;
  v_chave text;
  v_contrib numeric;
begin
  valor_referencia := null; valor_devido := null;
  valor_pago_original := null; diferenca := null; pagamento_id := null;

  -- §1.5: mensalidade fixa não sofre alteração automática. Só registro.
  if p_aluno.plano_cobranca = 'fixa' then
    return;
  end if;

  -- por_aula: valor de referência = preço travado (se já faturada) ou o do plano.
  v_contrib := coalesce(p_aula.valor_faturado, p_aluno.valor_aula, 0);
  valor_referencia := v_contrib;
  valor_devido := round(v_contrib * coalesce(p_percentual,0) / 100.0, 2);

  -- Já existe cobrança vinculada a esta aula?
  select * into v_pg
  from public.pagamentos
  where aluno_id = p_aula.aluno_id and p_aula.id = any(aula_ids)
  order by created_at
  limit 1;

  if found then
    if v_pg.status = 'pago' then
      -- §1.6: preserva o pagamento; apenas registra a diferença p/ resolução manual.
      valor_pago_original := v_contrib;
      diferenca := v_contrib - valor_devido;
      pagamento_id := v_pg.id;
      return;
    else
      -- §1.7: ajusta a contribuição desta aula no lançamento pendente (não duplica).
      update public.pagamentos
        set valor = greatest(0, valor - v_contrib + valor_devido)
        where id = v_pg.id;
      pagamento_id := v_pg.id;
      return;
    end if;
  else
    -- Sem cobrança prévia (caso normal de aula agendada/confirmada):
    -- cria UMA cobrança de cancelamento, idempotente por chave 'cancel:<aula>'.
    if coalesce(valor_devido,0) > 0 then
      v_chave := 'cancel:' || p_aula.id::text;
      select * into v_pg from public.pagamentos
        where aluno_id = p_aula.aluno_id and chave_referencia = v_chave
        limit 1;
      if found then
        update public.pagamentos set valor = valor_devido where id = v_pg.id;
        pagamento_id := v_pg.id;
      else
        insert into public.pagamentos
          (professor_id, aluno_id, valor, referencia, status, chave_referencia, mes_referencia, data_vencimento, aula_ids)
        values
          (p_aula.professor_id, p_aula.aluno_id, valor_devido,
           'Cobrança de cancelamento — aula de ' || to_char(p_aula.data,'DD/MM/YYYY'),
           'pendente', v_chave, to_char(p_aula.data,'YYYY-MM'), p_aula.data, array[p_aula.id])
        returning id into pagamento_id;
      end if;
    end if;
    return;
  end if;
end;
$$;
revoke all on function public._cancel_aplicar_financeiro(public.aulas, public.alunos, numeric) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) RPCs PÚBLICAS
-- ----------------------------------------------------------------------------

-- 3.1) Personal configura a própria política (único caminho de escrita).
create or replace function public.configurar_politica(
  p_ativo boolean,
  p_exige_aprovacao_aluno boolean,
  p_faixas jsonb
)
returns public.politicas_cancelamento
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_old public.politicas_cancelamento; v_new public.politicas_cancelamento;
begin
  if auth.uid() is null then raise exception 'Sem sessão.' using errcode='LT210'; end if;
  perform public.validar_faixas_cancelamento(p_faixas);

  select * into v_old from public.politicas_cancelamento where professor_id = auth.uid();

  insert into public.politicas_cancelamento (professor_id, ativo, exige_aprovacao_aluno, faixas, atualizado_em)
  values (auth.uid(), coalesce(p_ativo,false), coalesce(p_exige_aprovacao_aluno,true), coalesce(p_faixas,'[]'::jsonb), now())
  on conflict (professor_id) do update
    set ativo = excluded.ativo,
        exige_aprovacao_aluno = excluded.exige_aprovacao_aluno,
        faixas = excluded.faixas,
        atualizado_em = now()
  returning * into v_new;

  insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_anterior, estado_novo)
  values (auth.uid(), auth.uid(), 'personal', 'politica_alterada', 'politica', auth.uid(),
          case when v_old.professor_id is null then null else to_jsonb(v_old) end, to_jsonb(v_new));

  return v_new;
end;
$$;

-- 3.2) Aluno abre pedido de cancelamento (vai para análise do personal).
create or replace function public.abrir_cancelamento(
  p_aula_id uuid,
  p_motivo text default null,
  p_aviso_externo boolean default false,
  p_aviso_canal text default null,
  p_aviso_em timestamptz default null
)
returns public.solicitacoes
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_aula public.aulas; v_aluno public.alunos; v_solic public.solicitacoes;
begin
  select * into v_aula from public.aulas where id = p_aula_id for update;
  if not found then raise exception 'Aula não encontrada.' using errcode='LT211'; end if;

  -- Posse: a aula é de um aluno cujo login é o chamador.
  select * into v_aluno from public.alunos
    where id = v_aula.aluno_id and auth_user_id = auth.uid();
  if not found then raise exception 'Sem permissão para esta aula.' using errcode='LT212'; end if;

  if v_aula.status not in ('agendada','confirmada') then
    raise exception 'Esta aula não pode mais ser cancelada.' using errcode='LT213';
  end if;

  -- Anti-duplicação: o índice único parcial já barra, mas damos erro amigável.
  if exists (select 1 from public.solicitacoes
             where aula_id = p_aula_id and status in ('em_analise','contraproposta')) then
    raise exception 'Já existe uma solicitação em aberto para esta aula.' using errcode='LT214';
  end if;

  insert into public.solicitacoes
    (aluno_id, professor_id, aula_id, tipo, status, mensagem, aviso_externo, aviso_canal, aviso_em)
  values
    (v_aluno.id, v_aula.professor_id, p_aula_id, 'cancelar', 'em_analise', p_motivo,
     coalesce(p_aviso_externo,false), p_aviso_canal, p_aviso_em)
  returning * into v_solic;

  insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_novo)
  values (v_aula.professor_id, auth.uid(), 'aluno', 'cancelamento_solicitado', 'solicitacao', v_solic.id, to_jsonb(v_solic));

  return v_solic;
end;
$$;

-- 3.3) Personal aprova/recusa um pedido de cancelamento do aluno.
create or replace function public.decidir_solicitacao_cancelamento(
  p_solic_id uuid,
  p_aprovar boolean,
  p_percentual numeric default null,
  p_justificativa text default null,
  p_horario_considerado_origem text default 'envio_portal',
  p_aviso_em timestamptz default null
)
returns public.cancelamentos
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_solic public.solicitacoes;
  v_aula public.aulas;
  v_aluno public.alunos;
  v_pol public.politicas_cancelamento;
  v_hc timestamptz; v_ant numeric; v_sug numeric; v_apl numeric;
  v_fin record;
  v_cancel public.cancelamentos;
  v_aula_dt timestamptz;
begin
  select * into v_solic from public.solicitacoes where id = p_solic_id for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode='LT220'; end if;
  if v_solic.professor_id <> auth.uid() then raise exception 'Sem permissão.' using errcode='LT221'; end if;
  if v_solic.tipo <> 'cancelar' then raise exception 'Solicitação não é de cancelamento.' using errcode='LT222'; end if;
  if v_solic.status not in ('em_analise','contraproposta') then
    raise exception 'Solicitação já respondida.' using errcode='LT223';
  end if;

  -- RECUSA: aula permanece; registra justificativa e auditoria. Sem cancelamento.
  if not coalesce(p_aprovar,false) then
    update public.solicitacoes set status='negada', resposta=p_justificativa, respondida_em=now()
      where id = v_solic.id;
    insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_anterior, estado_novo)
    values (auth.uid(), auth.uid(), 'personal', 'cancelamento_decidido', 'solicitacao', v_solic.id,
            to_jsonb(v_solic), jsonb_build_object('status','negada','resposta',p_justificativa));
    return null;
  end if;

  -- APROVA: cancela a aula e aplica o financeiro.
  select * into v_aula from public.aulas where id = v_solic.aula_id for update;
  if not found then raise exception 'Aula não encontrada.' using errcode='LT224'; end if;
  -- Defesa contra IDOR/cross-tenant: a aula apontada pela solicitação PRECISA
  -- ser deste personal E do aluno da solicitação. Sem isto, um personal poderia
  -- ter trocado solicitacoes.aula_id (a policy de UPDATE só checa professor_id)
  -- para a aula de outro tenant e cancelá-la por aqui.
  if v_aula.professor_id <> auth.uid() or v_aula.aluno_id <> v_solic.aluno_id then
    raise exception 'Aula incompatível com a solicitação.' using errcode='LT227';
  end if;
  if v_aula.status not in ('agendada','confirmada','concluida') then
    raise exception 'A aula não pode mais ser cancelada.' using errcode='LT225';
  end if;
  select * into v_aluno from public.alunos where id = v_aula.aluno_id;

  v_aula_dt := (v_aula.data + v_aula.hora)::timestamptz;
  if p_horario_considerado_origem = 'aviso_externo' then
    v_hc := coalesce(p_aviso_em, v_solic.aviso_em, v_solic.created_at);
  else
    p_horario_considerado_origem := 'envio_portal';
    v_hc := v_solic.created_at;
  end if;
  v_ant := greatest(0, extract(epoch from (v_aula_dt - v_hc)) / 3600.0);

  select * into v_pol from public.politicas_cancelamento where professor_id = auth.uid();
  v_sug := case when v_pol.ativo then public.percentual_sugerido_cancelamento(v_pol.faixas, v_ant) else null end;
  v_apl := coalesce(p_percentual, v_sug, 0);

  -- Exceção exige justificativa (quando difere da sugestão da política).
  if v_sug is not null and v_apl <> v_sug and coalesce(btrim(p_justificativa),'') = '' then
    raise exception 'Percentual diferente da política exige justificativa.' using errcode='LT226';
  end if;

  select * into v_fin from public._cancel_aplicar_financeiro(v_aula, v_aluno, v_apl);

  update public.aulas
    set status='cancelada',
        faturada = case when v_aluno.plano_cobranca='por_aula' and coalesce(v_fin.valor_devido,0) > 0 then true else faturada end,
        valor_faturado = case when v_aluno.plano_cobranca='por_aula' then v_fin.valor_devido else valor_faturado end
    where id = v_aula.id;

  update public.solicitacoes set status='aprovada', resposta=p_justificativa, respondida_em=now()
    where id = v_solic.id;

  insert into public.cancelamentos
    (professor_id, aluno_id, aula_id, solicitacao_id, iniciado_por, origem_comunicacao, motivo,
     aviso_externo, aviso_canal, aviso_em, aula_data_hora_original, enviado_em, decidido_em, efetivado_em,
     horario_considerado, horario_considerado_origem, antecedencia_horas, politica_snapshot,
     percentual_sugerido, percentual_aplicado, justificativa_excecao,
     valor_referencia, valor_devido, valor_pago_original, diferenca, pagamento_id, status, decidido_por)
  values
    (v_aula.professor_id, v_aula.aluno_id, v_aula.id, v_solic.id, 'aluno',
     case when v_solic.aviso_externo then coalesce(v_solic.aviso_canal,'portal') else 'portal' end,
     v_solic.mensagem, v_solic.aviso_externo, v_solic.aviso_canal, v_solic.aviso_em,
     v_aula_dt, v_solic.created_at, now(), now(),
     v_hc, p_horario_considerado_origem, v_ant, coalesce(v_pol.faixas,'[]'::jsonb),
     v_sug, v_apl, nullif(btrim(coalesce(p_justificativa,'')),''),
     v_fin.valor_referencia, v_fin.valor_devido, v_fin.valor_pago_original, v_fin.diferenca,
     v_fin.pagamento_id, 'efetivado', auth.uid())
  returning * into v_cancel;

  insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_anterior, estado_novo)
  values (auth.uid(), auth.uid(), 'personal', 'cancelamento_efetivado', 'cancelamento', v_cancel.id,
          to_jsonb(v_solic), to_jsonb(v_cancel));

  return v_cancel;
end;
$$;

-- 3.4) Personal cancela uma aula diretamente (sem pedido do aluno).
create or replace function public.registrar_cancelamento_personal(
  p_aula_id uuid,
  p_origem_comunicacao text,
  p_percentual numeric default null,
  p_justificativa text default null,
  p_motivo text default null,
  p_aviso_externo boolean default false,
  p_aviso_canal text default null,
  p_aviso_em timestamptz default null,
  p_horario_considerado_origem text default 'registro_personal'
)
returns public.cancelamentos
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_aula public.aulas; v_aluno public.alunos; v_pol public.politicas_cancelamento;
  v_hc timestamptz; v_ant numeric; v_sug numeric; v_apl numeric; v_fin record;
  v_cancel public.cancelamentos; v_aula_dt timestamptz; v_solic public.solicitacoes;
begin
  select * into v_aula from public.aulas where id = p_aula_id for update;
  if not found then raise exception 'Aula não encontrada.' using errcode='LT230'; end if;
  if v_aula.professor_id <> auth.uid() then raise exception 'Sem permissão para esta aula.' using errcode='LT231'; end if;
  if v_aula.status not in ('agendada','confirmada','concluida') then
    raise exception 'A aula não pode mais ser cancelada.' using errcode='LT232';
  end if;
  select * into v_aluno from public.alunos where id = v_aula.aluno_id;

  v_aula_dt := (v_aula.data + v_aula.hora)::timestamptz;
  if p_horario_considerado_origem = 'aviso_externo' and p_aviso_em is not null then
    v_hc := p_aviso_em;
  else
    p_horario_considerado_origem := 'registro_personal';
    v_hc := now();
  end if;
  v_ant := greatest(0, extract(epoch from (v_aula_dt - v_hc)) / 3600.0);

  select * into v_pol from public.politicas_cancelamento where professor_id = auth.uid();
  v_sug := case when v_pol.ativo then public.percentual_sugerido_cancelamento(v_pol.faixas, v_ant) else null end;
  v_apl := coalesce(p_percentual, v_sug, 0);
  if v_sug is not null and v_apl <> v_sug and coalesce(btrim(p_justificativa),'') = '' then
    raise exception 'Percentual diferente da política exige justificativa.' using errcode='LT233';
  end if;

  select * into v_fin from public._cancel_aplicar_financeiro(v_aula, v_aluno, v_apl);

  update public.aulas
    set status='cancelada',
        faturada = case when v_aluno.plano_cobranca='por_aula' and coalesce(v_fin.valor_devido,0) > 0 then true else faturada end,
        valor_faturado = case when v_aluno.plano_cobranca='por_aula' then v_fin.valor_devido else valor_faturado end
    where id = v_aula.id;

  -- §item 10: se havia pedido do aluno em aberto para esta aula, resolve junto.
  update public.solicitacoes
    set status='aprovada', respondida_em=now(),
        resposta=coalesce(resposta,'Resolvido via cancelamento registrado pelo personal.')
    where aula_id = p_aula_id and status in ('em_analise','contraproposta')
    returning * into v_solic;

  insert into public.cancelamentos
    (professor_id, aluno_id, aula_id, solicitacao_id, iniciado_por, origem_comunicacao, motivo,
     aviso_externo, aviso_canal, aviso_em, aula_data_hora_original, enviado_em, decidido_em, efetivado_em,
     horario_considerado, horario_considerado_origem, antecedencia_horas, politica_snapshot,
     percentual_sugerido, percentual_aplicado, justificativa_excecao,
     valor_referencia, valor_devido, valor_pago_original, diferenca, pagamento_id, status, decidido_por)
  values
    (v_aula.professor_id, v_aula.aluno_id, v_aula.id, v_solic.id, 'personal',
     coalesce(p_origem_comunicacao,'personal'), p_motivo,
     coalesce(p_aviso_externo,false), p_aviso_canal, p_aviso_em,
     v_aula_dt, null, now(), now(),
     v_hc, p_horario_considerado_origem, v_ant, coalesce(v_pol.faixas,'[]'::jsonb),
     v_sug, v_apl, nullif(btrim(coalesce(p_justificativa,'')),''),
     v_fin.valor_referencia, v_fin.valor_devido, v_fin.valor_pago_original, v_fin.diferenca,
     v_fin.pagamento_id, 'efetivado', auth.uid())
  returning * into v_cancel;

  insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_novo)
  values (auth.uid(), auth.uid(), 'personal', 'cancelamento_efetivado', 'cancelamento', v_cancel.id, to_jsonb(v_cancel));

  return v_cancel;
end;
$$;

-- 3.5) Personal registra COMO resolveu a diferença de uma aula já paga (§1.6).
--      Puro registro: não movimenta dinheiro, não cria crédito disponível.
create or replace function public.registrar_resolucao_diferenca(
  p_cancelamento_id uuid,
  p_tipo text,
  p_obs text default null
)
returns public.cancelamentos
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_old public.cancelamentos; v_new public.cancelamentos;
begin
  if p_tipo not in ('reembolso','credito_futuro','outro','nenhuma') then
    raise exception 'Tipo de resolução inválido.' using errcode='LT240';
  end if;
  select * into v_old from public.cancelamentos where id = p_cancelamento_id for update;
  if not found then raise exception 'Cancelamento não encontrado.' using errcode='LT241'; end if;
  if v_old.professor_id <> auth.uid() then raise exception 'Sem permissão.' using errcode='LT242'; end if;

  update public.cancelamentos
    set resolucao_tipo = p_tipo, resolucao_obs = p_obs, resolvido_em = now(), resolvido_por = auth.uid()
    where id = p_cancelamento_id
    returning * into v_new;

  insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_anterior, estado_novo)
  values (auth.uid(), auth.uid(), 'personal', 'diferenca_resolvida', 'cancelamento', v_new.id, to_jsonb(v_old), to_jsonb(v_new));

  return v_new;
end;
$$;

-- 3.6) Aluno abre contestação sobre o próprio cancelamento (§1.9).
create or replace function public.abrir_contestacao(
  p_cancelamento_id uuid,
  p_motivo text
)
returns public.contestacoes
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_cancel public.cancelamentos; v_aluno public.alunos; v_cont public.contestacoes;
begin
  if coalesce(btrim(p_motivo),'') = '' then raise exception 'Informe o motivo.' using errcode='LT250'; end if;
  select * into v_cancel from public.cancelamentos where id = p_cancelamento_id;
  if not found then raise exception 'Cancelamento não encontrado.' using errcode='LT251'; end if;
  select * into v_aluno from public.alunos where id = v_cancel.aluno_id and auth_user_id = auth.uid();
  if not found then raise exception 'Sem permissão para contestar este cancelamento.' using errcode='LT252'; end if;

  insert into public.contestacoes (cancelamento_id, aluno_id, professor_id, motivo, status)
  values (v_cancel.id, v_cancel.aluno_id, v_cancel.professor_id, p_motivo, 'aberta')
  returning * into v_cont;

  insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_novo)
  values (v_cancel.professor_id, auth.uid(), 'aluno', 'contestacao_aberta', 'contestacao', v_cont.id, to_jsonb(v_cont));

  return v_cont;
end;
$$;

-- 3.7) Personal responde a contestação (§1.9). Não reativa aula nem muda valores.
create or replace function public.responder_contestacao(
  p_contestacao_id uuid,
  p_resposta text
)
returns public.contestacoes
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_old public.contestacoes; v_new public.contestacoes;
begin
  select * into v_old from public.contestacoes where id = p_contestacao_id for update;
  if not found then raise exception 'Contestação não encontrada.' using errcode='LT260'; end if;
  if v_old.professor_id <> auth.uid() then raise exception 'Sem permissão.' using errcode='LT261'; end if;

  update public.contestacoes set resposta = p_resposta, status = 'respondida', respondida_em = now()
    where id = p_contestacao_id returning * into v_new;

  insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_anterior, estado_novo)
  values (auth.uid(), auth.uid(), 'personal', 'contestacao_respondida', 'contestacao', v_new.id, to_jsonb(v_old), to_jsonb(v_new));

  return v_new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) PRIVILÉGIOS MÍNIMOS: só usuários autenticados executam as RPCs públicas;
--    anon e public não. (Supabase expõe via PostgREST a quem tem EXECUTE.)
-- ----------------------------------------------------------------------------
revoke all on function
  public.configurar_politica(boolean, boolean, jsonb),
  public.abrir_cancelamento(uuid, text, boolean, text, timestamptz),
  public.decidir_solicitacao_cancelamento(uuid, boolean, numeric, text, text, timestamptz),
  public.registrar_cancelamento_personal(uuid, text, numeric, text, text, boolean, text, timestamptz, text),
  public.registrar_resolucao_diferenca(uuid, text, text),
  public.abrir_contestacao(uuid, text),
  public.responder_contestacao(uuid, text)
from public, anon;

grant execute on function
  public.configurar_politica(boolean, boolean, jsonb),
  public.abrir_cancelamento(uuid, text, boolean, text, timestamptz),
  public.decidir_solicitacao_cancelamento(uuid, boolean, numeric, text, text, timestamptz),
  public.registrar_cancelamento_personal(uuid, text, numeric, text, text, boolean, text, timestamptz, text),
  public.registrar_resolucao_diferenca(uuid, text, text),
  public.abrir_contestacao(uuid, text),
  public.responder_contestacao(uuid, text)
to authenticated;

commit;

-- ============================================================================
-- FIM DA 0010 — NÃO APLICADA. Ver 0010_rpcs_cancelamento_DOWN.sql para reversão.
-- ============================================================================
