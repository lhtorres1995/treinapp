-- ============================================================================
-- LT360 — Verificação SOMENTE LEITURA, pré-aplicação de 0004/0005
-- ============================================================================
-- Rode isto no SQL Editor do projeto Supabase (o de desenvolvimento, conforme
-- indicado). NÃO cria, altera ou apaga nada — apenas SELECTs informativos.
-- Objetivo: confirmar que 0001 e 0002 estão de fato aplicadas, antes de
-- aplicar 0004/0005 em cima delas. NÃO reaplica nada.
-- ============================================================================

-- 1) Colunas que 0001 adiciona em profiles e aulas (0004/0005 dependem delas)
select
  table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'profiles' and column_name in ('capacidade_simultanea','antecedencia_minima_horas','duracao_habitual_min'))
    or (table_name = 'aulas' and column_name in ('duracao_min','aula_origem_reposicao_id','remarcada_para_id'))
  )
order by table_name, column_name;
-- Esperado: 6 linhas (3 de profiles + 3 de aulas). Qualquer ausência aqui
-- significa que 0001 não está (ou não está totalmente) aplicada — 0004/0005
-- NÃO devem ser aplicadas até isso ser corrigido.

-- 2) Tabelas que 0001 cria
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('disponibilidade_personal','bloqueios_agenda','solicitacoes_aluno','auditoria')
order by table_name;
-- Esperado: 4 linhas.

-- 3) As 3 funções de integridade de 0002, e se estão SECURITY DEFINER com
--    search_path fixo (como a correção de segurança da Etapa 1 exige)
select
  p.proname as funcao,
  case when p.prosecdef then 'DEFINER' else 'INVOKER' end as modo_seguranca,
  p.proconfig as configuracoes -- deve conter algo como {search_path=}
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('validar_integridade_solicitacao','validar_integridade_reposicao','validar_integridade_reposicao_origem')
order by p.proname;
-- Esperado: 3 linhas, todas com modo_seguranca = 'DEFINER' e search_path=''
-- em configuracoes. Se alguma vier 'INVOKER' ou sem search_path fixo, a
-- correção de segurança de 0002 não foi aplicada (ou foi revertida) — reporte
-- antes de seguir.

-- 4) Os triggers correspondentes, e se estão habilitados
select
  c.relname as tabela, t.tgname as trigger, t.tgenabled as habilitado
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal
  and t.tgname in (
    'trg_validar_integridade_solicitacao',
    'trg_validar_integridade_reposicao',
    'trg_validar_integridade_reposicao_origem'
  )
order by t.tgname;
-- Esperado: 3 linhas, tgenabled = 'O' (origin/enabled) em todas.

-- 5) Verifica se já existe qualquer objeto de 0004/0005 (para confirmar que
--    ainda NÃO foram aplicadas — se já existirem, não reaplique, investigue).
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('validar_capacidade_aula','remarcar_aula');
select t.tgname
from pg_trigger t
where not t.tgisinternal and t.tgname = 'trg_validar_capacidade_aula';
-- Esperado: ambas as consultas SEM NENHUMA LINHA (0004/0005 ainda não
-- aplicadas). Se vier alguma linha, pare e avise antes de continuar —
-- reaplicar create or replace function é seguro, mas recriar a trigger com
-- "drop trigger if exists" + "create trigger" merece confirmação primeiro.

-- 6) Contagem geral de dados (confirma que é mesmo um projeto de teste, com
--    volume baixo, e dá uma ideia do tamanho do que o diagnóstico 0003 vai
--    examinar)
select
  (select count(*) from public.profiles) as personais,
  (select count(*) from public.alunos) as alunos,
  (select count(*) from public.aulas) as aulas,
  (select count(*) from public.pagamentos) as pagamentos;
