-- ============================================================================
-- LT360 — Verificação SOMENTE LEITURA da Etapa 1 (compatível com o SQL
-- Editor do Supabase — nenhum metacomando de psql, só SQL puro)
-- ============================================================================
-- Seguro para colar e rodar DIRETAMENTE no SQL Editor do Supabase, inclusive
-- em produção: todas as instruções abaixo são SELECT (nenhum INSERT/UPDATE/
-- DELETE/DDL). Pode ser executado quantas vezes quiser, em qualquer estágio.
--
-- O script contém DUAS consultas independentes sobre a mesma lista de
-- verificações (mesma CTE "checks", repetida em cada uma para que cada
-- consulta funcione sozinha caso você cole só uma delas):
--
--   RESULTADO 1 — "A migração 0001 está aplicada e a 0002 ainda não?"
--     Compara o estado atual do banco com o que é esperado DEPOIS da 0001
--     e ANTES da 0002. Use isto para confirmar o estado de partida.
--
--   RESULTADO 2 — "A migração 0002 já foi aplicada com sucesso?"
--     Compara o estado atual com o que é esperado DEPOIS da 0001 E da 0002.
--     Rode isto de novo depois de aplicar a 0002 para confirmar o sucesso.
--
-- Ambas leem apenas os catálogos do Postgres (information_schema, pg_catalog)
-- — nada nas tabelas de negócio é tocado.
-- ============================================================================


-- ============================================================================
-- RESULTADO 1 — ESTADO ATUAL ESPERADO: 0001 aplicada, 0002 PENDENTE
-- ============================================================================
with checks as (

  -- 1) Tabelas novas (criadas na 0001, mantidas na 0002)
  select '1 - Tabelas' as secao, t as item, true as esperado_apos_0001, true as esperado_apos_0002,
         exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) as presente_agora
  from unnest(array['disponibilidade_personal','bloqueios_agenda','solicitacoes_aluno','auditoria']) as t

  union all
  -- 2) Colunas novas em tabelas existentes (criadas na 0001)
  select '2 - Colunas novas', tabela||'.'||coluna, true, true,
         exists (select 1 from information_schema.columns where table_schema='public' and table_name=tabela and column_name=coluna)
  from (values
    ('profiles','capacidade_simultanea'), ('profiles','antecedencia_minima_horas'), ('profiles','duracao_habitual_min'),
    ('aulas','duracao_min'), ('aulas','aula_origem_reposicao_id'), ('alunos','auth_user_id')
  ) as v(tabela, coluna)

  union all
  -- 3) Constraints de check criadas na 0001 (nomes auto-gerados pelo Postgres)
  select '3 - Constraints', c, true, true,
         exists (select 1 from pg_constraint where conname = c)
  from unnest(array[
    'aulas_reposicao_nao_autorreferente','disponibilidade_horario_valido',
    'bloqueio_horario_valido','bloqueio_parcial_mesmo_dia','bloqueio_periodo_valido',
    'profiles_capacidade_simultanea_check','profiles_antecedencia_minima_horas_check',
    'profiles_duracao_habitual_min_check','aulas_duracao_min_check'
  ]) as c

  union all
  -- 4) Índices novos (criados na 0001)
  select '4 - Índices', i, true, true,
         exists (select 1 from pg_indexes where schemaname='public' and indexname=i)
  from unnest(array[
    'idx_aulas_origem_reposicao','idx_alunos_auth_user_unico','idx_disponibilidade_professor',
    'idx_bloqueios_professor_periodo','idx_solicitacoes_professor','idx_solicitacoes_aula',
    'idx_solicitacoes_aluno_id','idx_solicitacao_ativa_unica','idx_auditoria_professor_data',
    'idx_auditoria_entidade'
  ]) as i

  union all
  -- 5) RLS habilitada (nas 4 tabelas novas e nas 4 já existentes).
  --    to_regclass('public.'||tb) — a mesma função que você já validou
  --    direto no banco — é usada em vez de um CAST ('...'::regnamespace ou
  --    '...'::regclass): to_regclass() retorna NULL quando a relação não
  --    existe, nunca lança erro; um CAST para regclass, ao contrário, lança
  --    "relation ... does not exist" (42P01) se a relação não existir —
  --    exatamente a mensagem reportada. Esta versão nunca pode produzir
  --    esse erro, qualquer que seja o estado real do banco.
  select '5 - RLS habilitado', tb, true, true,
         coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.'||tb)), false)
  from unnest(array['profiles','alunos','aulas','pagamentos','disponibilidade_personal','bloqueios_agenda','solicitacoes_aluno','auditoria']) as tb

  union all
  -- 6) Policies — o INSERT de auditoria é o único que MUDA entre as duas migrações
  select '6 - Policies', tabela||' / '||nome_policy||' ('||cmd||')', esperado_0001, esperado_0002,
         exists (select 1 from pg_policies where schemaname='public' and tablename=tabela and policyname=nome_policy)
  from (values
    ('disponibilidade_personal','disponibilidade: isolado por professor','ALL', true, true),
    ('bloqueios_agenda','bloqueios: isolado por professor','ALL', true, true),
    ('solicitacoes_aluno','solicitacoes: isolado por professor','ALL', true, true),
    ('auditoria','auditoria: leitura isolada por professor','SELECT', true, true),
    ('auditoria','auditoria: inserção isolada por professor','INSERT', true, false)
  ) as v(tabela, nome_policy, cmd, esperado_0001, esperado_0002)

  union all
  -- 7) Privilégios SQL (GRANT) do papel authenticated — NÃO mudam entre as
  --    duas migrações (RLS é quem bloqueia, não o grant — ver nota abaixo)
  select '7 - Grants (authenticated)', tb||' / '||priv, true, true,
         exists (select 1 from information_schema.role_table_grants
                  where table_schema='public' and table_name=tb and grantee='authenticated' and privilege_type=priv)
  from unnest(array['profiles','alunos','aulas','pagamentos','disponibilidade_personal','bloqueios_agenda','solicitacoes_aluno','auditoria']) as tb
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) as priv

  union all
  -- 8) Triggers — os 3 de reposição/origem só existem a partir da 0002
  select '8 - Triggers', tabela||' / '||trg, esperado_0001, esperado_0002,
         exists (select 1 from information_schema.triggers where trigger_schema='public' and event_object_table=tabela and trigger_name=trg)
  from (values
    ('solicitacoes_aluno','trg_validar_integridade_solicitacao', true, true),
    ('aulas','trg_validar_integridade_reposicao', false, true),
    ('aulas','trg_validar_integridade_reposicao_origem', false, true)
  ) as v(tabela, trg, esperado_0001, esperado_0002)

  union all
  -- 9) errcodes próprios nas funções de integridade (só existem a partir da
  --    0002). Filtra também pelo schema via to_regnamespace() (mesma lógica
  --    não-erradia do item acima) para não colidir com uma função de mesmo
  --    nome em outro schema.
  select '9 - Errcodes de integridade', fn||' usa '||code, false, true,
         exists (
           select 1 from pg_proc
           where proname = fn
             and pronamespace = to_regnamespace('public')
             and pg_get_functiondef(oid) like '%'||code||'%'
         )
  from (values
    ('validar_integridade_solicitacao','LT001'),
    ('validar_integridade_reposicao','LT002'),
    ('validar_integridade_reposicao_origem','LT003')
  ) as v(fn, code)

)
select secao, item,
       esperado_apos_0001 as esperado_agora,
       presente_agora,
       case when presente_agora = esperado_apos_0001 then 'OK'
            else 'DIVERGENTE — investigar (não corresponde ao estágio "0001 aplicada / 0002 pendente")'
       end as status
from checks
order by secao, item;


-- ============================================================================
-- RESULTADO 2 — ESTADO ESPERADO DEPOIS DE APLICAR A 0002 TAMBÉM
-- ============================================================================
-- (mesma CTE "checks", repetida para este bloco funcionar sozinho; só a
-- coluna comparada muda: esperado_apos_0002 em vez de esperado_apos_0001)
with checks as (

  select '1 - Tabelas' as secao, t as item, true as esperado_apos_0001, true as esperado_apos_0002,
         exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) as presente_agora
  from unnest(array['disponibilidade_personal','bloqueios_agenda','solicitacoes_aluno','auditoria']) as t

  union all
  select '2 - Colunas novas', tabela||'.'||coluna, true, true,
         exists (select 1 from information_schema.columns where table_schema='public' and table_name=tabela and column_name=coluna)
  from (values
    ('profiles','capacidade_simultanea'), ('profiles','antecedencia_minima_horas'), ('profiles','duracao_habitual_min'),
    ('aulas','duracao_min'), ('aulas','aula_origem_reposicao_id'), ('alunos','auth_user_id')
  ) as v(tabela, coluna)

  union all
  select '3 - Constraints', c, true, true,
         exists (select 1 from pg_constraint where conname = c)
  from unnest(array[
    'aulas_reposicao_nao_autorreferente','disponibilidade_horario_valido',
    'bloqueio_horario_valido','bloqueio_parcial_mesmo_dia','bloqueio_periodo_valido',
    'profiles_capacidade_simultanea_check','profiles_antecedencia_minima_horas_check',
    'profiles_duracao_habitual_min_check','aulas_duracao_min_check'
  ]) as c

  union all
  select '4 - Índices', i, true, true,
         exists (select 1 from pg_indexes where schemaname='public' and indexname=i)
  from unnest(array[
    'idx_aulas_origem_reposicao','idx_alunos_auth_user_unico','idx_disponibilidade_professor',
    'idx_bloqueios_professor_periodo','idx_solicitacoes_professor','idx_solicitacoes_aula',
    'idx_solicitacoes_aluno_id','idx_solicitacao_ativa_unica','idx_auditoria_professor_data',
    'idx_auditoria_entidade'
  ]) as i

  union all
  select '5 - RLS habilitado', tb, true, true,
         coalesce((select relrowsecurity from pg_class where relname = tb and relnamespace = 'public'::regnamespace), false)
  from unnest(array['profiles','alunos','aulas','pagamentos','disponibilidade_personal','bloqueios_agenda','solicitacoes_aluno','auditoria']) as tb

  union all
  select '6 - Policies', tabela||' / '||nome_policy||' ('||cmd||')', esperado_0001, esperado_0002,
         exists (select 1 from pg_policies where schemaname='public' and tablename=tabela and policyname=nome_policy)
  from (values
    ('disponibilidade_personal','disponibilidade: isolado por professor','ALL', true, true),
    ('bloqueios_agenda','bloqueios: isolado por professor','ALL', true, true),
    ('solicitacoes_aluno','solicitacoes: isolado por professor','ALL', true, true),
    ('auditoria','auditoria: leitura isolada por professor','SELECT', true, true),
    ('auditoria','auditoria: inserção isolada por professor','INSERT', true, false)
  ) as v(tabela, nome_policy, cmd, esperado_0001, esperado_0002)

  union all
  select '7 - Grants (authenticated)', tb||' / '||priv, true, true,
         exists (select 1 from information_schema.role_table_grants
                  where table_schema='public' and table_name=tb and grantee='authenticated' and privilege_type=priv)
  from unnest(array['profiles','alunos','aulas','pagamentos','disponibilidade_personal','bloqueios_agenda','solicitacoes_aluno','auditoria']) as tb
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) as priv

  union all
  select '8 - Triggers', tabela||' / '||trg, esperado_0001, esperado_0002,
         exists (select 1 from information_schema.triggers where trigger_schema='public' and event_object_table=tabela and trigger_name=trg)
  from (values
    ('solicitacoes_aluno','trg_validar_integridade_solicitacao', true, true),
    ('aulas','trg_validar_integridade_reposicao', false, true),
    ('aulas','trg_validar_integridade_reposicao_origem', false, true)
  ) as v(tabela, trg, esperado_0001, esperado_0002)

  union all
  select '9 - Errcodes de integridade', fn||' usa '||code, false, true,
         exists (select 1 from pg_proc where proname = fn and pg_get_functiondef(oid) like '%'||code||'%')
  from (values
    ('validar_integridade_solicitacao','LT001'),
    ('validar_integridade_reposicao','LT002'),
    ('validar_integridade_reposicao_origem','LT003')
  ) as v(fn, code)

)
select secao, item,
       esperado_apos_0002 as esperado_apos_aplicar_0002,
       presente_agora,
       case when presente_agora = esperado_apos_0002 then 'OK — já está no estado final'
            when esperado_apos_0001 = esperado_apos_0002 then 'OK — este item não muda com a 0002'
            else 'PENDENTE — só ficará OK depois de aplicar a 0002'
       end as status
from checks
order by secao, item;


-- ============================================================================
-- VERIFICAÇÕES COMPLEMENTARES (não dependem do estágio 0001/0002 — conteúdo,
-- não apenas existência)
-- ============================================================================

-- a) handle_new_user() precisa continuar exatamente como no schema.sql
--    original: SECURITY DEFINER e só criando o profile vazio (nenhuma
--    coluna nova sendo preenchida automaticamente).
select
  proname,
  prosecdef as security_definer,
  (pg_get_functiondef(oid) ~ 'insert into public\.profiles \(id, nome\) values \(new\.id, ''''\)') as corpo_inalterado,
  pg_get_functiondef(oid) as definicao_completa
from pg_proc
where proname = 'handle_new_user';

-- b) Nota de leitura para a seção "7 - Grants" acima: RLS filtra LINHAS;
--    quem concede o privilégio de executar o comando na tabela é o GRANT
--    (no Supabase, configurado via ALTER DEFAULT PRIVILEGES no projeto).
--    Por padrão o Supabase concede os 4 privilégios a authenticated/anon em
--    toda tabela nova e usa a RLS como único portão real — por isso
--    "esperado" é TRUE para os grants de auditoria mesmo depois da 0002:
--    o bloqueio de INSERT/UPDATE/DELETE em auditoria vem da AUSÊNCIA de
--    policy (seção 6), não da ausência de grant (seção 7). Se a seção 7
--    mostrar FALSE para alguma combinação tabela/privilégio, isso indica
--    que o projeto real tem uma configuração de privilégios diferente do
--    padrão do Supabase (ex.: um hardening anterior) — vale investigar
--    antes de presumir que "sem grant = mais seguro": pode, em vez disso,
--    quebrar uma operação legítima que a RLS deveria ter permitido.
select 'ver comentário acima — seção 7 de cada RESULTADO' as nota_grants_vs_rls;

-- c) Atributos de segurança completos das 3 funções de validação (estado
--    esperado APÓS a 0002: dono real, SECURITY DEFINER, search_path fixo
--    vazio, e EXECUTE efetivamente bloqueado para PUBLIC/anon/authenticated).
--
--    Por que não usar information_schema.role_routine_grants (como a
--    versão anterior deste script fazia): essa view (1) é filtrada por
--    visibilidade — só mostra linhas em que o papel atual é concedente,
--    concedido, ou membro do papel concedido, então pode simplesmente OMITIR
--    a linha do PUBLIC dependendo de quem roda a consulta — e (2) o valor do
--    grantee para o pseudo-papel é a string 'PUBLIC' (maiúsculas); comparar
--    com 'public' (minúsculas) nunca bate, o que faria a checagem reportar
--    "revogado" mesmo com o grant de PUBLIC ainda presente. Os dois seriam
--    exatamente o falso positivo que este script existe para evitar.
--
--    Em vez disso: has_function_privilege(role, função, 'EXECUTE') é a forma
--    correta e sem essas armadilhas — devolve o privilégio EFETIVO do papel,
--    já contabilizando o que ele herda de PUBLIC e de outras roles das quais
--    é membro, sem qualquer filtro de visibilidade. E para o grant direto ao
--    PUBLIC em si (que não é um papel que se possa passar a
--    has_function_privilege), lemos pg_proc.proacl diretamente via
--    aclexplode — catálogo sem restrição de visibilidade — tratando grantee
--    = 0 como PUBLIC, com coalesce para acldefault('f', dono) cobrindo o
--    caso proacl is null (função nunca teve grant/revoke explícito: nesse
--    caso o padrão do Postgres para funções é EXECUTE concedido a PUBLIC).
with funcs as (
  select
    p.oid,
    p.proname,
    p.proowner                                     as owner_oid,
    p.proowner::regrole::text                      as owner_atual,
    p.prosecdef                                     as security_definer,
    p.proacl,
    (p.proconfig is not null and exists (
       select 1 from unnest(p.proconfig) e
       where e in ('search_path=', 'search_path=""')
     ))                                              as search_path_fixo_vazio
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.proname in (
    'validar_integridade_solicitacao',
    'validar_integridade_reposicao',
    'validar_integridade_reposicao_origem'
  )
),
public_acl as (
  select f.oid,
         coalesce(bool_or(a.grantee = 0 and a.privilege_type = 'EXECUTE'), false) as public_tem_grant_direto
  from funcs f
  left join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.owner_oid))) a on true
  group by f.oid
)
select
  f.proname,
  f.owner_atual                                                as dono_da_funcao,
  f.security_definer                                           as security_definer_esperado_true,
  f.search_path_fixo_vazio                                     as search_path_fixo_vazio_esperado_true,
  coalesce(pa.public_tem_grant_direto, false)                  as public_tem_grant_direto_esperado_false,
  has_function_privilege('anon', f.oid, 'EXECUTE')              as anon_execute_efetivo_esperado_false,
  has_function_privilege('authenticated', f.oid, 'EXECUTE')     as authenticated_execute_efetivo_esperado_false,
  has_function_privilege(f.owner_atual, f.oid, 'EXECUTE')        as dono_execute_efetivo_esperado_true
from funcs f
left join public_acl pa on pa.oid = f.oid
order by f.proname;

-- ANTES da 0002: só validar_integridade_solicitacao existe (1 linha), com
-- security_definer=false, search_path_fixo_vazio=false,
-- public_tem_grant_direto=true e anon/authenticated_execute_efetivo=true
-- (comportamento padrão do Postgres: toda função nova concede EXECUTE a
-- PUBLIC até alguém revogar). As outras duas funções simplesmente não
-- aparecem (0 linhas), porque só são criadas pela 0002.
--
-- DEPOIS da 0002: as 3 linhas aparecem, todas com security_definer=true,
-- search_path_fixo_vazio=true, public_tem_grant_direto=false e
-- anon/authenticated_execute_efetivo=false. dono_execute_efetivo deve ser
-- SEMPRE true nos dois estágios (o dono de uma função sempre pode executá-la,
-- revogar de PUBLIC/anon/authenticated nunca afeta o próprio dono) — se
-- aparecer false aqui, é sinal de um problema de ownership a investigar,
-- não um resultado esperado da 0002.
