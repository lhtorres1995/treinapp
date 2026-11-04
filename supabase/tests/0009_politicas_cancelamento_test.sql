-- ============================================================================
-- LT360 — Testes pgTAP para a migração 0009 (políticas de cancelamento)
--
-- ⚠️ NÃO EXECUTADO nesta etapa: não há ambiente de testes isolado disponível
--    aqui, e é proibido escrever no banco de produção. Este arquivo é
--    preparado para rodar quando houver stack local / branch Supabase.
--
-- COMO RODAR (ambiente isolado, nunca produção):
--   1) Subir Postgres de teste com a extensão pgTAP e o schema aplicado:
--        supabase start                       # stack local (Postgres + pgTAP)
--        psql "$LOCAL_DB_URL" -c 'create extension if not exists pgtap;'
--        psql "$LOCAL_DB_URL" -f supabase/baseline/schema_snapshot_2026-11-03.sql
--        psql "$LOCAL_DB_URL" -f supabase/migrations/0009_politicas_cancelamento.sql
--   2) Rodar os testes:
--        psql "$LOCAL_DB_URL" -f supabase/tests/0009_politicas_cancelamento_test.sql
--      (ou via `supabase test db` se os testes estiverem no diretório padrão.)
--
-- Tudo roda dentro de BEGIN/ROLLBACK: NENHUM dado é persistido.
--
-- NOTA sobre fixtures: inserimos linhas mínimas em auth.users para satisfazer a
-- FK de profiles. As colunas NOT NULL de auth.users variam por versão do
-- Supabase local; se o insert falhar, ajuste as colunas do helper _mk_user()
-- para a sua versão (id/email costumam bastar em stacks recentes).
-- ============================================================================

begin;
select plan(40);

-- Extensão de testes (idempotente)
create extension if not exists pgtap;

-- ---------------------------------------------------------------------------
-- Helpers de fixture / contexto de autenticação
-- ---------------------------------------------------------------------------
create or replace function _mk_user(p_id uuid, p_email text) returns void
language plpgsql as $$
begin
  insert into auth.users (id, email) values (p_id, p_email)
  on conflict (id) do nothing;
end $$;

-- Simula um usuário autenticado (define role + claim sub lido por auth.uid()).
create or replace function _as_user(p_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_id::text, 'role','authenticated')::text, true);
end $$;

create or replace function _as_owner() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end $$;

-- IDs fixos dos atores de teste
-- personal A / aluno A  e  personal B / aluno B
\set pa  '11111111-1111-1111-1111-111111111111'
\set pb  '22222222-2222-2222-2222-222222222222'
\set aa  '33333333-3333-3333-3333-333333333333'
\set ab  '44444444-4444-4444-4444-444444444444'
\set aau '55555555-5555-5555-5555-555555555555'
\set abu '66666666-6666-6666-6666-666666666666'
\set cla '77777777-7777-7777-7777-777777777777'

-- Cria usuários de auth e perfis (como owner, RLS bypass)
select _mk_user(:'pa','pa@test.local');
select _mk_user(:'pb','pb@test.local');
select _mk_user(:'aau','aa@test.local');
select _mk_user(:'abu','ab@test.local');

insert into public.profiles (id, nome) values (:'pa','Personal A'), (:'pb','Personal B');

insert into public.alunos (id, professor_id, nome, telefone, plano_tipo, plano_cobranca, auth_user_id, valor_aula)
values (:'aa', :'pa', 'Aluno A', '1', 'avulsa', 'por_aula', :'aau', 100),
       (:'ab', :'pb', 'Aluno B', '2', 'avulsa', 'por_aula', :'abu', 100);

insert into public.aulas (id, professor_id, aluno_id, data, hora, status)
values (:'cla', :'pa', :'aa', current_date + 1, '08:00', 'agendada');

-- ===========================================================================
-- A) ESTRUTURA
-- ===========================================================================
select has_table('public','politicas_cancelamento','tabela politicas_cancelamento existe');
select has_table('public','cancelamentos','tabela cancelamentos existe');
select has_table('public','contestacoes','tabela contestacoes existe');

select col_is_pk('public','politicas_cancelamento','professor_id','PK = professor_id');
select has_column('public','cancelamentos','politica_snapshot','cancelamentos tem politica_snapshot');
select has_column('public','cancelamentos','percentual_aplicado','cancelamentos tem percentual_aplicado');
select has_column('public','cancelamentos','valor_pago_original','cancelamentos tem valor_pago_original');
select has_column('public','cancelamentos','diferenca','cancelamentos tem diferenca');
select has_column('public','cancelamentos','resolucao_tipo','cancelamentos tem resolucao_tipo');
select col_not_null('public','cancelamentos','percentual_aplicado','percentual_aplicado é NOT NULL');

select has_column('public','solicitacoes','aviso_externo','solicitacoes ganhou aviso_externo');
select has_column('public','solicitacoes','aviso_canal','solicitacoes ganhou aviso_canal');
select has_column('public','solicitacoes','aviso_em','solicitacoes ganhou aviso_em');

-- Índice de unicidade parcial
select has_index('public','solicitacoes','idx_solic_aberta_unica_por_aula','índice de unicidade de solicitação aberta existe');

-- ===========================================================================
-- B) FOREIGN KEYS (on delete esperado)
-- ===========================================================================
select is(
  (select confdeltype from pg_constraint
   where conrelid='public.cancelamentos'::regclass and conname='cancelamentos_aluno_id_fkey'),
  'c', 'cancelamentos.aluno_id ON DELETE CASCADE (espelha padrão do banco)');
select is(
  (select confdeltype from pg_constraint
   where conrelid='public.cancelamentos'::regclass and conname='cancelamentos_aula_id_fkey'),
  'n', 'cancelamentos.aula_id ON DELETE SET NULL');
select is(
  (select confdeltype from pg_constraint
   where conrelid='public.contestacoes'::regclass and conname='contestacoes_cancelamento_id_fkey'),
  'c', 'contestacoes.cancelamento_id ON DELETE CASCADE');

-- ===========================================================================
-- C) CHECK / valores permitidos
-- ===========================================================================
-- percentual fora de faixa deve falhar
select throws_ok(
  format($$insert into public.cancelamentos
    (professor_id,aluno_id,aula_id,iniciado_por,origem_comunicacao,aula_data_hora_original,
     horario_considerado,horario_considerado_origem,antecedencia_horas,politica_snapshot,
     percentual_aplicado,status,decidido_por)
    values (%L,%L,%L,'personal','personal',now(),now(),'envio_portal',10,'[]'::jsonb,150,'efetivado',%L)$$,
    :'pa',:'aa',:'cla',:'pa'),
  '23514', NULL, 'percentual_aplicado > 100 viola CHECK');

-- status inválido deve falhar
select throws_ok(
  format($$insert into public.cancelamentos
    (professor_id,aluno_id,aula_id,iniciado_por,origem_comunicacao,aula_data_hora_original,
     horario_considerado,horario_considerado_origem,antecedencia_horas,politica_snapshot,
     percentual_aplicado,status,decidido_por)
    values (%L,%L,%L,'personal','personal',now(),now(),'envio_portal',10,'[]'::jsonb,50,'xxx',%L)$$,
    :'pa',:'aa',:'cla',:'pa'),
  '23514', NULL, 'status inválido viola CHECK');

-- aviso_externo=true sem canal/momento deve falhar (coerência)
select throws_ok(
  format($$insert into public.cancelamentos
    (professor_id,aluno_id,aula_id,iniciado_por,origem_comunicacao,aviso_externo,aula_data_hora_original,
     horario_considerado,horario_considerado_origem,antecedencia_horas,politica_snapshot,
     percentual_aplicado,status,decidido_por)
    values (%L,%L,%L,'personal','whatsapp',true,now(),now(),'aviso_externo',10,'[]'::jsonb,50,'efetivado',%L)$$,
    :'pa',:'aa',:'cla',:'pa'),
  '23514', NULL, 'aviso_externo sem canal/momento viola CHECK de coerência');

-- resolucao_tipo inválido deve falhar
select throws_ok(
  format($$insert into public.cancelamentos
    (professor_id,aluno_id,aula_id,iniciado_por,origem_comunicacao,aula_data_hora_original,
     horario_considerado,horario_considerado_origem,antecedencia_horas,politica_snapshot,
     percentual_aplicado,status,decidido_por,resolucao_tipo)
    values (%L,%L,%L,'personal','personal',now(),now(),'envio_portal',10,'[]'::jsonb,50,'efetivado',%L,'pix')$$,
    :'pa',:'aa',:'cla',:'pa'),
  '23514', NULL, 'resolucao_tipo inválido viola CHECK');

-- faixas não-array em politicas_cancelamento deve falhar
select throws_ok(
  format($$insert into public.politicas_cancelamento (professor_id,faixas) values (%L,'{}'::jsonb)$$, :'pb'),
  'LT200', NULL, 'faixas que não é array jsonb viola CHECK');

-- caso VÁLIDO deve inserir (como owner) — e serve de fixture p/ testes de leitura
insert into public.cancelamentos
  (professor_id,aluno_id,aula_id,iniciado_por,origem_comunicacao,aula_data_hora_original,
   horario_considerado,horario_considerado_origem,antecedencia_horas,politica_snapshot,
   percentual_sugerido,percentual_aplicado,status,decidido_por)
values (:'pa',:'aa',:'cla','personal','personal', (current_date+1)::timestamptz + time '08:00',
        now(), 'envio_portal', 30, '[{"de_horas":24,"ate_horas":null,"percentual":0}]'::jsonb,
        0, 0, 'efetivado', :'pa');
select pass('cancelamento válido inserido (fixture)');

insert into public.politicas_cancelamento (professor_id, ativo, faixas)
values (:'pa', true, '[{"de_horas":24,"ate_horas":null,"percentual":0},{"de_horas":12,"ate_horas":24,"percentual":50},{"de_horas":0,"ate_horas":12,"percentual":100}]'::jsonb);
select pass('política válida inserida (fixture)');

-- ===========================================================================
-- D) UNICIDADE: 2ª solicitação aberta para a mesma aula deve falhar
-- ===========================================================================
insert into public.solicitacoes (aluno_id,professor_id,aula_id,tipo,status)
values (:'aa',:'pa',:'cla','cancelar','em_analise');
select throws_ok(
  format($$insert into public.solicitacoes (aluno_id,professor_id,aula_id,tipo,status)
           values (%L,%L,%L,'remarcar','em_analise')$$, :'aa',:'pa',:'cla'),
  '23505', NULL, '2ª solicitação aberta na mesma aula viola o índice único parcial');

-- ===========================================================================
-- E) RLS habilitada
-- ===========================================================================
select is( (select relrowsecurity from pg_class where oid='public.politicas_cancelamento'::regclass), true, 'RLS on em politicas_cancelamento');
select is( (select relrowsecurity from pg_class where oid='public.cancelamentos'::regclass), true, 'RLS on em cancelamentos');
select is( (select relrowsecurity from pg_class where oid='public.contestacoes'::regclass), true, 'RLS on em contestacoes');

-- ===========================================================================
-- F) ISOLAMENTO E PERMISSÕES (como usuários autenticados)
-- ===========================================================================
-- Personal A enxerga o próprio cancelamento; Personal B não.
select _as_user(:'pa');
select is( (select count(*)::int from public.cancelamentos), 1, 'Personal A vê o próprio cancelamento');
select is( (select count(*)::int from public.politicas_cancelamento), 1, 'Personal A vê a própria política');
select _as_owner();

select _as_user(:'pb');
select is( (select count(*)::int from public.cancelamentos), 0, 'Personal B NÃO vê cancelamento de A');
select is( (select count(*)::int from public.politicas_cancelamento), 0, 'Personal B NÃO vê política de A');
select _as_owner();

-- Aluno A vê o próprio cancelamento e a política do seu personal; aluno B não.
select _as_user(:'aau');
select is( (select count(*)::int from public.cancelamentos), 1, 'Aluno A vê o próprio cancelamento');
select is( (select count(*)::int from public.politicas_cancelamento where professor_id = :'pa'), 1, 'Aluno A vê a política do seu personal');
select _as_owner();

select _as_user(:'abu');
select is( (select count(*)::int from public.cancelamentos), 0, 'Aluno B NÃO vê cancelamento do aluno A');
select is( (select count(*)::int from public.politicas_cancelamento), 0, 'Aluno B NÃO vê política de outro personal');
select _as_owner();

-- ===========================================================================
-- G) DECISÃO FINANCEIRA NÃO É EDITÁVEL DIRETAMENTE (só via RPC futura)
-- ===========================================================================
-- INSERT direto como aluno em cancelamentos deve ser negado pela RLS.
select _as_user(:'aau');
select throws_ok(
  format($$insert into public.cancelamentos
    (professor_id,aluno_id,aula_id,iniciado_por,origem_comunicacao,aula_data_hora_original,
     horario_considerado,horario_considerado_origem,antecedencia_horas,politica_snapshot,
     percentual_aplicado,status,decidido_por)
    values (%L,%L,%L,'aluno','portal',now(),now(),'envio_portal',5,'[]'::jsonb,0,'efetivado',%L)$$,
    :'pa',:'aa',:'cla',:'pa'),
  '42501', NULL, 'aluno não pode INSERIR cancelamento diretamente (RLS nega)');
select _as_owner();

-- UPDATE direto como personal não altera nenhuma linha (sem policy de UPDATE).
select _as_user(:'pa');
with upd as (
  update public.cancelamentos set percentual_aplicado = 100 returning 1
)
select is( (select count(*)::int from upd), 0, 'Personal NÃO consegue alterar % do cancelamento direto (0 linhas)');
select _as_owner();

-- Aluno cria contestação sobre o PRÓPRIO cancelamento: permitido.
select _as_user(:'aau');
with ins as (
  insert into public.contestacoes (cancelamento_id, aluno_id, professor_id, motivo)
  select c.id, :'aa', :'pa', 'Discordo do valor'
  from public.cancelamentos c where c.aluno_id = :'aa' limit 1
  returning 1
)
select is( (select count(*)::int from ins), 1, 'Aluno A cria contestação sobre o próprio cancelamento');
select _as_owner();

-- Aluno B tenta contestar cancelamento do aluno A: negado pela RLS (with check).
-- Captura o id do cancelamento do aluno A COMO OWNER — a RLS do aluno B esconde
-- esse cancelamento, então um INSERT...SELECT veria 0 linhas e não dispararia erro.
select id as cid_aa from public.cancelamentos where aluno_id = :'aa' limit 1 \gset
select _as_user(:'abu');
select throws_ok(
  format($$insert into public.contestacoes (cancelamento_id, aluno_id, professor_id, motivo)
           values (%L, %L, %L, 'indevida')$$, :'cid_aa', :'ab', :'pb'),
  '42501', NULL, 'Aluno B não pode contestar cancelamento que não é dele');
select _as_owner();

select * from finish();
rollback;
