-- ============================================================================
-- LT360 — Correções de segurança/financeiro no fluxo de cancelamento (0010)
--
-- ✅ STATUS: APLICADA em produção (trainer-flow) em 2026-11-08, com autorização
--    explícita do usuário, via Supabase MCP apply_migration. 0010 já estava
--    aplicada; esta corrige para frente. Não reaplicar.
--
-- Achados (revisão de segurança automática, MEDIUM):
--  (1) Fuso horário: `(aula.data + aula.hora)::timestamptz` interpretava o
--      horário LOCAL da aula como UTC, deslocando o instante em ~3h e podendo
--      jogar a antecedência (e o % sugerido) para a faixa errada. O resto do
--      app usa 'America/Sao_Paulo' (ex.: checkin_por_token). Corrigido nas duas
--      RPCs (decidir_solicitacao_cancelamento e registrar_cancelamento_personal).
--  (2) created_at manipulável: o aluno insere em `solicitacoes` por INSERT direto
--      (ainda usado pela remarcação) e podia definir `created_at`; decidir_...
--      usa esse valor como horario_considerado ('envio_portal') → back-dating
--      para forçar 0%. Correção: o trigger de integridade passa a FORÇAR, no
--      INSERT, created_at := now() e os campos de estado/decisão, neutralizando
--      qualquer valor vindo do cliente (sem quebrar remarcar/cancelar/RPC).
-- ============================================================================

-- (2) Endurecer o trigger de INSERT de solicitacoes: servidor controla
--     created_at/status/resposta/contra_* — cliente não injeta.
create or replace function public.validar_integridade_solicitacao_ativa()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare v_aula_prof uuid; v_aula_aluno uuid; v_aluno_prof uuid;
begin
  if TG_OP = 'UPDATE' then
    if (NEW.aula_id is not null and NEW.aula_id is distinct from OLD.aula_id)
       or NEW.aluno_id is distinct from OLD.aluno_id
       or NEW.professor_id is distinct from OLD.professor_id
       or NEW.tipo is distinct from OLD.tipo then
      raise exception 'solicitacoes: não é permitido repontar aula/aluno/professor nem trocar o tipo da solicitação' using errcode = 'LT207';
    end if;
    return NEW;
  end if;
  -- INSERT: o servidor define os campos sensíveis (impede back-dating de
  -- created_at e inserir já "decidido"/"contraproposto" para manipular o cálculo).
  NEW.created_at := now();
  NEW.status := 'em_analise';
  NEW.resposta := null;
  NEW.respondida_em := null;
  NEW.contra_data := null;
  NEW.contra_hora := null;
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
revoke all on function public.validar_integridade_solicitacao_ativa() from public, anon, authenticated;

-- (1) Fuso horário correto na decisão de pedido do aluno.
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
  if not coalesce(p_aprovar,false) then
    update public.solicitacoes set status='negada', resposta=p_justificativa, respondida_em=now()
      where id = v_solic.id;
    insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_anterior, estado_novo)
    values (auth.uid(), auth.uid(), 'personal', 'cancelamento_decidido', 'solicitacao', v_solic.id,
            to_jsonb(v_solic), jsonb_build_object('status','negada','resposta',p_justificativa));
    return null;
  end if;
  select * into v_aula from public.aulas where id = v_solic.aula_id for update;
  if not found then raise exception 'Aula não encontrada.' using errcode='LT224'; end if;
  if v_aula.professor_id <> auth.uid() or v_aula.aluno_id <> v_solic.aluno_id then
    raise exception 'Aula incompatível com a solicitação.' using errcode='LT227';
  end if;
  if v_aula.status not in ('agendada','confirmada','concluida') then
    raise exception 'A aula não pode mais ser cancelada.' using errcode='LT225';
  end if;
  select * into v_aluno from public.alunos where id = v_aula.aluno_id;
  v_aula_dt := ((v_aula.data + v_aula.hora) at time zone 'America/Sao_Paulo');
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

-- (1) Fuso horário correto no cancelamento direto do personal.
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
  v_aula_dt := ((v_aula.data + v_aula.hora) at time zone 'America/Sao_Paulo');
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
