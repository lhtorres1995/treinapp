-- ============================================================================
-- LT360 — Etapa 2, Entrega 2.1 (C2): remarcação atômica via RPC
-- NÃO APLICADA ao banco principal. Testada apenas em sandbox isolado.
-- ============================================================================
--
-- Problema que resolve (ver Revisão 2.1, achados A1/A2): hoje a remarcação é
-- feita no frontend como DUAS escritas independentes no mesmo lote de upsert
-- (criar a nova aula + marcar a original como 'remarcada'). Com a trigger de
-- capacidade (0004), se a nova aula for rejeitada por conflito, o lote inteiro
-- é abortado e o resultado depende do comportamento de reload do cliente —
-- frágil e difícil de auditar.
--
-- Esta função centraliza a remarcação em UMA transação no banco:
--   1) tranca a aula original (FOR UPDATE) e valida que ela é remarcável;
--   2) cria a nova aula preservando aluno, professor e duração EFETIVA da
--      original (a trigger de capacidade dispara aqui);
--   3) marca a original como 'remarcada' apontando para a nova.
-- Se qualquer passo falhar (capacidade LT004, ou outra validação), a função
-- inteira aborta e a aula original permanece intacta — atomicidade garantida
-- pela transação implícita da chamada RPC.
--
-- Decisões:
--
--   * SECURITY INVOKER (não DEFINER), consistente com a 0004 e a Etapa 1.
--     Toda a proteção multi-tenant vem da RLS existente de `aulas`:
--       - o SELECT da original só enxerga aulas do próprio professor; passar
--         o id de outro tenant resulta em "não encontrada" (LT010);
--       - o INSERT da nova aula usa professor_id = o da original (= auth.uid()),
--         satisfazendo o WITH CHECK da RLS;
--       - o UPDATE da original recai sob o USING da RLS do próprio professor.
--     Não há nenhuma necessidade de ver ou escrever dados de outro tenant,
--     logo não há razão para elevar privilégio.
--
--   * FOR UPDATE na original serializa duas remarcações simultâneas da MESMA
--     aula: sob READ COMMITTED, a segunda transação espera o lock de linha,
--     re-lê a original já com status 'remarcada' e aborta com LT011 — nunca
--     cria uma segunda aula órfã.
--
--   * Duração preservada = COALESCE(original.duracao_min, 50). Para uma aula
--     legada (duracao_min nulo, 50 min efetivos pela regra da Etapa 2.0/2.1),
--     a nova aula recebe 50 explícito — preserva a duração EFETIVA da origem,
--     sem herdar a duração habitual do personal (que é regra de aula nova, não
--     de remarcação). Para uma aula com duração explícita, copia esse valor.
--
--   * origem = 'manual' (o mesmo que o fluxo atual grava), evitando qualquer
--     alteração no CHECK de `origem` (que só aceita 'manual'|'recorrencia').
--
--   * Nenhuma escrita em pagamentos/cobranças. A nova aula nasce faturada=false
--     e a original (que estava agendada/confirmada, nunca concluída) não tinha
--     cobrança — sem risco de cobrança duplicada.
-- ============================================================================

create or replace function public.remarcar_aula(
  p_aula_original_id uuid,
  p_nova_data date,
  p_nova_hora time
)
returns public.aulas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_orig public.aulas;
  v_nova public.aulas;
  v_nova_id uuid := gen_random_uuid();
begin
  -- 1) trancar e validar a original (SOB RLS: só a própria é visível)
  select * into v_orig
  from public.aulas
  where id = p_aula_original_id
  for update;

  if not found then
    raise exception 'Aula original não encontrada ou sem permissão para remarcar'
      using errcode = 'LT010';
  end if;

  if v_orig.status not in ('agendada', 'confirmada') then
    raise exception 'Só é possível remarcar uma aula agendada ou confirmada (status atual: %)', v_orig.status
      using errcode = 'LT011';
  end if;

  -- 2) criar a nova aula preservando aluno/professor/duração efetiva.
  --    A trigger validar_capacidade_aula dispara aqui; se LT004, a função
  --    inteira aborta e o UPDATE abaixo nunca ocorre.
  insert into public.aulas (id, professor_id, aluno_id, data, hora, duracao_min, status, faturada, origem)
  values (
    v_nova_id,
    v_orig.professor_id,
    v_orig.aluno_id,
    p_nova_data,
    p_nova_hora,
    coalesce(v_orig.duracao_min, 50),
    'agendada',
    false,
    'manual'
  )
  returning * into v_nova;

  -- 3) marcar a original como remarcada, apontando para a nova
  update public.aulas
     set status = 'remarcada',
         remarcada_para_id = v_nova_id
   where id = p_aula_original_id;

  return v_nova;
end;
$$;

-- Menor privilégio: só quem está autenticado chama; anon/public não.
-- (INVOKER + RLS já protegeriam os dados de qualquer forma.)
revoke execute on function public.remarcar_aula(uuid, date, time) from public, anon;
grant execute on function public.remarcar_aula(uuid, date, time) to authenticated;
