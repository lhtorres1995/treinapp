-- ============================================================================
-- LT360 — Etapa 2, Entrega 2.0: Diagnóstico de conflitos existentes
-- SOMENTE LEITURA. Não cria, não atualiza, não apaga nada.
-- Seguro para ser executado diretamente no SQL Editor do Supabase principal.
-- ============================================================================
--
-- Objetivo: antes de ativar as futuras triggers de capacidade/disponibilidade/
-- bloqueio (Entregas 2.1 e 2.2, AINDA NÃO implementadas), identificar nos
-- dados JÁ EXISTENTES qualquer situação que essas triggers passariam a
-- bloquear hoje — para que nenhuma trava futura surpreenda o personal.
--
-- Duração de aulas legadas (sem duracao_min registrado): SEMPRE 50 minutos,
-- fixo. Esta versão do script NÃO usa profiles.duracao_habitual_min para
-- preencher a lacuna de aulas antigas — propositalmente. duracao_habitual_min
-- é uma configuração que o personal pode alterar a qualquer momento; se o
-- diagnóstico dependesse dela, o mesmo dado histórico mudaria de
-- classificação sozinho sempre que o personal ajustasse essa preferência,
-- sem nenhuma aula ter sido criada, editada ou movida. Fixar 50 minutos
-- para o histórico (o mesmo valor visual já usado hoje em ASSUMED_SLOT_MIN)
-- torna o diagnóstico estável e reproduzível. duracao_habitual_min só volta
-- a ser relevante como default para aulas CRIADAS a partir da Entrega 2.1 em
-- diante — isso é regra de escrita futura, fora do escopo deste diagnóstico
-- de leitura.
--
-- Pico de concorrência (correção desta revisão): a classificação de excesso
-- de capacidade usa o número MÁXIMO de aulas simultaneamente ativas em
-- qualquer instante do dia, não apenas a contagem de aulas que se sobrepõem
-- a cada aula individualmente. A diferença importa em cadeias como
-- A(10:00-11:00), B(10:30-11:30), C(11:00-12:00): A e B se sobrepõem, B e C
-- se sobrepõem, mas A e C NÃO — nunca há 3 aulas simultâneas, o pico real é
-- 2. Contar "quantas aulas se sobrepõem a mim" para a aula B chegaria a 3
-- (A e C), um falso excesso de capacidade. Este script calcula, em vez
-- disso, o pico de ocupação em cada instante relevante (os horários de
-- início de cada aula do dia) e verifica, para cada aula, qual foi o pico
-- observado enquanto ela estava ativa.
--
-- Fronteira back-to-back (uma aula termina exatamente quando outra começa):
-- os intervalos são tratados como semiabertos [início, fim) — testado
-- explicitamente no sandbox; aulas encostadas no tempo NÃO contam como
-- concorrentes entre si.
--
-- Status de aula considerados como "ocupando um horário real":
--   'agendada', 'confirmada', 'concluida'
-- Excluídos propositalmente:
--   'cancelada'  — nunca ocupou de fato o horário.
--   'remarcada'  — o horário real passou a ser o da aula apontada por
--                  remarcada_para_id; a aula remarcada em si é só histórico.
--
-- Seções:
--   1) Sobreposições de horário por personal, classificadas por pico real de
--      concorrência vs capacidade_simultanea.
--   2) Resumo numérico da seção 1.
--   3) Aulas que colidiriam com bloqueios_agenda já cadastrados.
--   4) Aulas fora de disponibilidade_personal já cadastrada (só avalia
--      personais que já têm ao menos uma linha configurada).
--   5) Impacto em cadeias de remarcação, usando o mesmo pico de concorrência.
--   6) Impacto em reposições, usando o mesmo pico de concorrência.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Sobreposições por personal, com classificação por pico real de concorrência
-- ----------------------------------------------------------------------------
with duracao_efetiva as (
  select
    a.id, a.professor_id, a.aluno_id, a.data, a.hora, a.status,
    coalesce(a.duracao_min, 50) as duracao_min_efetiva,
    (a.hora + (coalesce(a.duracao_min, 50) || ' minutes')::interval)::time as hora_fim_efetiva,
    p.capacidade_simultanea
  from public.aulas a
  join public.profiles p on p.id = a.professor_id
  where a.status in ('agendada', 'confirmada', 'concluida')
),
eventos as (
  select distinct professor_id, data, hora as instante from duracao_efetiva
),
concorrencia_no_instante as (
  select
    e.professor_id, e.data, e.instante,
    (
      select count(*) from duracao_efetiva d
      where d.professor_id = e.professor_id and d.data = e.data
        and d.hora <= e.instante and e.instante < d.hora_fim_efetiva
    ) as concorrentes
  from eventos e
),
pico_por_aula as (
  select
    d.id, d.professor_id, d.data, d.hora, d.hora_fim_efetiva,
    d.duracao_min_efetiva, d.capacidade_simultanea,
    (
      select max(c.concorrentes) from concorrencia_no_instante c
      where c.professor_id = d.professor_id and c.data = d.data
        and c.instante >= d.hora and c.instante < d.hora_fim_efetiva
    ) as pico_concorrencia
  from duracao_efetiva d
)
select
  '1 - Sobreposicoes' as secao,
  professor_id, data, hora, hora_fim_efetiva, duracao_min_efetiva,
  capacidade_simultanea, pico_concorrencia,
  case
    when pico_concorrencia <= capacidade_simultanea
      then 'OK — dentro da capacidade configurada'
    else 'CONFLITO — excederia capacidade_simultanea (bloquearia na Entrega 2.1)'
  end as classificacao
from pico_por_aula
where pico_concorrencia > 1
order by professor_id, data, hora;


-- ============================================================================
-- 2) Resumo numérico da seção 1 (mesma lógica, independente e autocontida)
-- ============================================================================
with duracao_efetiva as (
  select
    a.id, a.professor_id, a.data, a.hora,
    coalesce(a.duracao_min, 50) as duracao_min_efetiva,
    (a.hora + (coalesce(a.duracao_min, 50) || ' minutes')::interval)::time as hora_fim_efetiva,
    p.capacidade_simultanea
  from public.aulas a
  join public.profiles p on p.id = a.professor_id
  where a.status in ('agendada', 'confirmada', 'concluida')
),
eventos as (
  select distinct professor_id, data, hora as instante from duracao_efetiva
),
concorrencia_no_instante as (
  select
    e.professor_id, e.data, e.instante,
    (
      select count(*) from duracao_efetiva d
      where d.professor_id = e.professor_id and d.data = e.data
        and d.hora <= e.instante and e.instante < d.hora_fim_efetiva
    ) as concorrentes
  from eventos e
),
pico_por_aula as (
  select
    d.id, d.professor_id, d.capacidade_simultanea,
    (
      select max(c.concorrentes) from concorrencia_no_instante c
      where c.professor_id = d.professor_id and c.data = d.data
        and c.instante >= d.hora and c.instante < d.hora_fim_efetiva
    ) as pico_concorrencia
  from duracao_efetiva d
)
select
  '2 - Resumo' as secao,
  count(*) filter (where pico_concorrencia > 1) as aulas_em_sobreposicao,
  count(*) filter (where pico_concorrencia > 1 and pico_concorrencia <= capacidade_simultanea) as sobreposicoes_legitimas,
  count(*) filter (where pico_concorrencia > capacidade_simultanea) as conflitos_reais,
  count(distinct professor_id) filter (where pico_concorrencia > capacidade_simultanea) as personais_afetados
from pico_por_aula;


-- ============================================================================
-- 3) Aulas que colidiriam com bloqueios_agenda já cadastrados
-- ============================================================================
with duracao_efetiva as (
  select
    a.id, a.professor_id, a.aluno_id, a.data, a.hora, a.status,
    (a.hora + (coalesce(a.duracao_min, 50) || ' minutes')::interval)::time as hora_fim_efetiva
  from public.aulas a
  where a.status in ('agendada', 'confirmada', 'concluida')
)
select
  '3 - Colisao com bloqueio' as secao,
  a.professor_id, a.id as aula_id, a.data, a.hora, a.hora_fim_efetiva,
  b.id as bloqueio_id, b.data_inicio, b.data_fim, b.hora_inicio, b.hora_fim, b.motivo
from duracao_efetiva a
join public.bloqueios_agenda b on b.professor_id = a.professor_id
where
  (b.hora_inicio is null and a.data between b.data_inicio and b.data_fim)
  or
  (b.hora_inicio is not null and a.data = b.data_inicio
   and a.hora < b.hora_fim and b.hora_inicio < a.hora_fim_efetiva)
order by a.professor_id, a.data, a.hora;


-- ============================================================================
-- 4) Aulas fora da disponibilidade semanal já cadastrada
--    (só avalia personais com ao menos 1 linha ativa em disponibilidade_personal
--     — comportamento permissivo por padrão, igual ao da trigger futura)
-- ============================================================================
with duracao_efetiva as (
  select
    a.id, a.professor_id, a.aluno_id, a.data, a.hora, a.status,
    (a.hora + (coalesce(a.duracao_min, 50) || ' minutes')::interval)::time as hora_fim_efetiva
  from public.aulas a
  where a.status in ('agendada', 'confirmada', 'concluida')
)
select
  '4 - Fora da disponibilidade' as secao,
  a.professor_id, a.id as aula_id, a.data,
  extract(dow from a.data)::smallint as dia_semana,
  a.hora, a.hora_fim_efetiva
from duracao_efetiva a
where exists (
  select 1 from public.disponibilidade_personal dp
  where dp.professor_id = a.professor_id and dp.ativo
)
and not exists (
  select 1 from public.disponibilidade_personal dp
  where dp.professor_id = a.professor_id and dp.ativo
    and dp.dia_semana = extract(dow from a.data)::smallint
    and dp.hora_inicio <= a.hora and dp.hora_fim >= a.hora_fim_efetiva
)
order by a.professor_id, a.data, a.hora;


-- ============================================================================
-- 5) Impacto em cadeias de remarcação: o destino de uma remarcação está,
--    ele mesmo, em conflito de pico de concorrência?
-- ============================================================================
with duracao_efetiva as (
  select
    a.id, a.professor_id, a.data, a.hora,
    coalesce(a.duracao_min, 50) as duracao_min_efetiva,
    (a.hora + (coalesce(a.duracao_min, 50) || ' minutes')::interval)::time as hora_fim_efetiva,
    p.capacidade_simultanea
  from public.aulas a
  join public.profiles p on p.id = a.professor_id
  where a.status in ('agendada', 'confirmada', 'concluida')
),
eventos as (
  select distinct professor_id, data, hora as instante from duracao_efetiva
),
concorrencia_no_instante as (
  select
    e.professor_id, e.data, e.instante,
    (
      select count(*) from duracao_efetiva d
      where d.professor_id = e.professor_id and d.data = e.data
        and d.hora <= e.instante and e.instante < d.hora_fim_efetiva
    ) as concorrentes
  from eventos e
),
pico_por_aula as (
  select
    d.id, d.professor_id, d.capacidade_simultanea,
    (
      select max(c.concorrentes) from concorrencia_no_instante c
      where c.professor_id = d.professor_id and c.data = d.data
        and c.instante >= d.hora and c.instante < d.hora_fim_efetiva
    ) as pico_concorrencia
  from duracao_efetiva d
)
select
  '5 - Remarcacao em conflito' as secao,
  orig.id as aula_original_id, orig.data as data_original, orig.hora as hora_original,
  dest.id as aula_remarcada_id, dest.data as data_remarcada, dest.hora as hora_remarcada,
  c.pico_concorrencia, c.capacidade_simultanea,
  case when c.pico_concorrencia > c.capacidade_simultanea
       then 'CONFLITO — destino da remarcacao excederia capacidade'
       else 'OK'
  end as classificacao
from public.aulas orig
join public.aulas dest on dest.id = orig.remarcada_para_id
join pico_por_aula c on c.id = dest.id
where orig.status = 'remarcada'
order by orig.professor_id, dest.data, dest.hora;


-- ============================================================================
-- 6) Impacto em reposições: aulas com aula_origem_reposicao_id preenchido
--    estão em conflito de pico de concorrência? (0 linhas é o esperado hoje —
--    o front-end ainda não escreve esse campo)
-- ============================================================================
with duracao_efetiva as (
  select
    a.id, a.professor_id, a.data, a.hora,
    coalesce(a.duracao_min, 50) as duracao_min_efetiva,
    (a.hora + (coalesce(a.duracao_min, 50) || ' minutes')::interval)::time as hora_fim_efetiva,
    p.capacidade_simultanea
  from public.aulas a
  join public.profiles p on p.id = a.professor_id
  where a.status in ('agendada', 'confirmada', 'concluida')
),
eventos as (
  select distinct professor_id, data, hora as instante from duracao_efetiva
),
concorrencia_no_instante as (
  select
    e.professor_id, e.data, e.instante,
    (
      select count(*) from duracao_efetiva d
      where d.professor_id = e.professor_id and d.data = e.data
        and d.hora <= e.instante and e.instante < d.hora_fim_efetiva
    ) as concorrentes
  from eventos e
),
pico_por_aula as (
  select
    d.id, d.professor_id, d.capacidade_simultanea,
    (
      select max(c.concorrentes) from concorrencia_no_instante c
      where c.professor_id = d.professor_id and c.data = d.data
        and c.instante >= d.hora and c.instante < d.hora_fim_efetiva
    ) as pico_concorrencia
  from duracao_efetiva d
)
select
  '6 - Reposicao em conflito' as secao,
  rep.id as aula_reposicao_id, rep.data, rep.hora, rep.aula_origem_reposicao_id,
  c.pico_concorrencia, c.capacidade_simultanea,
  case when c.pico_concorrencia > c.capacidade_simultanea
       then 'CONFLITO — reposicao excederia capacidade'
       else 'OK'
  end as classificacao
from public.aulas rep
join pico_por_aula c on c.id = rep.id
where rep.aula_origem_reposicao_id is not null
order by rep.professor_id, rep.data, rep.hora;
