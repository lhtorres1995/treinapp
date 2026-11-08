-- ============================================================================
-- LT360 — Testes pgTAP para a migração 0010 (RPCs de cancelamento)
--
-- ⚠️ NÃO EXECUTADO nesta etapa (sem ambiente isolado; proibido escrever em
--    produção). Preparado para rodar após aplicar, no ambiente de teste:
--    local_bootstrap.sql + schema_snapshot_2026-11-03.sql + 0009 + 0010.
--    Ver docs/BASELINE-RECONCILIACAO.md §4. Roda em BEGIN/ROLLBACK (não persiste).
--
-- Usa no_plan() porque o nº de asserts pode variar em ajustes; o finish()
-- reporta o total. NÃO afirmo que os testes passaram — não foram executados.
-- ============================================================================

begin;
select * from no_plan();
create extension if not exists pgtap;

-- Helpers de contexto (iguais aos do teste 0009)
create or replace function _mk_user(p_id uuid, p_email text) returns void
language plpgsql as $$ begin
  insert into auth.users (id, email) values (p_id, p_email) on conflict (id) do nothing;
end $$;
create or replace function _as_user(p_id uuid) returns void
language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',p_id::text,'role','authenticated')::text, true);
end $$;
create or replace function _as_owner() returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims','',true); reset role;
end $$;

\set pa  '11111111-1111-1111-1111-111111111111'
\set aau '55555555-5555-5555-5555-555555555555'
\set abu '66666666-6666-6666-6666-666666666666'
\set aa  '33333333-3333-3333-3333-333333333333'
\set af  '99999999-9999-9999-9999-999999999999'
\set afu 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\set c1  '77777777-7777-7777-7777-777777777777'
\set c2  '88888888-8888-8888-8888-888888888888'
\set c3  'cccccccc-cccc-cccc-cccc-cccccccccccc'

select _mk_user(:'pa','pa@test.local');
select _mk_user(:'aau','aa@test.local');
select _mk_user(:'afu','af@test.local');
insert into public.profiles (id, nome) values (:'pa','Personal A');
insert into public.alunos (id, professor_id, nome, telefone, plano_tipo, plano_cobranca, auth_user_id, valor_aula)
  values (:'aa', :'pa', 'Aluno PorAula', '1', 'avulsa', 'por_aula', :'aau', 100);
insert into public.alunos (id, professor_id, nome, telefone, plano_tipo, plano_cobranca, auth_user_id, valor_fixo)
  values (:'af', :'pa', 'Aluno Fixa', '2', 'mensal', 'fixa', :'afu', 800);
insert into public.aulas (id, professor_id, aluno_id, data, hora, status)
  values (:'c1', :'pa', :'aa', current_date + 2, '08:00', 'agendada'),
         (:'c2', :'pa', :'aa', current_date + 2, '09:00', 'agendada'),
         (:'c3', :'pa', :'af', current_date + 2, '10:00', 'agendada');

-- ===========================================================================
-- Validação de faixas + percentual sugerido
-- ===========================================================================
select lives_ok(
  $$ select public.validar_faixas_cancelamento('[{"de_horas":24,"ate_horas":null,"percentual":0},{"de_horas":12,"ate_horas":24,"percentual":50},{"de_horas":0,"ate_horas":12,"percentual":100}]'::jsonb) $$,
  'faixas contínuas válidas passam');
select throws_ok(
  $$ select public.validar_faixas_cancelamento('[{"de_horas":12,"ate_horas":24,"percentual":50},{"de_horas":0,"ate_horas":12,"percentual":100}]'::jsonb) $$,
  'LT206', NULL, 'faixas sem faixa aberta (∞) falham');
select throws_ok(
  $$ select public.validar_faixas_cancelamento('[{"de_horas":0,"ate_horas":10,"percentual":100},{"de_horas":12,"ate_horas":null,"percentual":0}]'::jsonb) $$,
  'LT203', NULL, 'faixas com lacuna (10->12) falham');
select throws_ok(
  $$ select public.validar_faixas_cancelamento('[{"de_horas":0,"ate_horas":15,"percentual":100},{"de_horas":12,"ate_horas":null,"percentual":0}]'::jsonb) $$,
  'LT203', NULL, 'faixas com sobreposição falham');

-- percentual sugerido com o exemplo aprovado (limites exatos [de,ate))
\set FX '[{"de_horas":24,"ate_horas":null,"percentual":0},{"de_horas":12,"ate_horas":24,"percentual":50},{"de_horas":0,"ate_horas":12,"percentual":100}]'
select is( public.percentual_sugerido_cancelamento(:'FX'::jsonb, 30), 0::numeric,  '30h -> 0%');
select is( public.percentual_sugerido_cancelamento(:'FX'::jsonb, 24), 0::numeric,  '24h exato -> 0%');
select is( public.percentual_sugerido_cancelamento(:'FX'::jsonb, 18), 50::numeric, '18h -> 50%');
select is( public.percentual_sugerido_cancelamento(:'FX'::jsonb, 12), 50::numeric, '12h exato -> 50%');
select is( public.percentual_sugerido_cancelamento(:'FX'::jsonb, 2),  100::numeric,'2h -> 100%');

-- ===========================================================================
-- configurar_politica (como personal)
-- ===========================================================================
select _as_user(:'pa');
select lives_ok(
  format($$ select public.configurar_politica(true, true, %L::jsonb) $$, :'FX'),
  'personal configura a política');
select _as_owner();
select is( (select ativo from public.politicas_cancelamento where professor_id = :'pa'), true, 'política ativa gravada');
select is( (select count(*)::int from public.auditoria where operacao='politica_alterada'), 1, 'auditoria registrou alteração de política');

-- ===========================================================================
-- Fluxo aluno: abrir pedido + anti-duplicação
-- ===========================================================================
select _as_user(:'aau');
select lives_ok( format($$ select public.abrir_cancelamento(%L,'Imprevisto', false, null, null) $$, :'c2'),
  'aluno abre pedido de cancelamento');
select throws_ok( format($$ select public.abrir_cancelamento(%L,'de novo', false, null, null) $$, :'c2'),
  'LT214', NULL, '2º pedido aberto para a mesma aula é bloqueado');
select _as_owner();
select is( (select status from public.solicitacoes where aula_id = :'c2'), 'em_analise', 'pedido fica em análise');
select is( (select status from public.aulas where id = :'c2'), 'agendada', 'aula do pedido continua agendada');

-- Personal RECUSA o pedido: aula permanece, sem cancelamento
select _as_user(:'pa');
select lives_ok( format($$ select public.decidir_solicitacao_cancelamento(
   (select id from public.solicitacoes where aula_id=%L), false, null, 'Vamos manter', 'envio_portal', null) $$, :'c2'),
  'personal recusa o pedido');
select _as_owner();
select is( (select status from public.aulas where id = :'c2'), 'agendada', 'recusa mantém a aula agendada');
select is( (select status from public.solicitacoes where aula_id = :'c2'), 'negada', 'pedido fica negado');
select is( (select count(*)::int from public.cancelamentos where aula_id = :'c2'), 0, 'recusa não cria cancelamento');

-- ===========================================================================
-- Cancelamento direto pelo personal (por_aula) com política sugerindo 100%
-- (aula em +2 dias = ~48h -> 0% pela política; forçamos exceção 100% c/ justif.)
-- ===========================================================================
select _as_user(:'pa');
select lives_ok( format($$ select public.registrar_cancelamento_personal(
   %L, 'whatsapp', 100, 'Avisou em cima da hora', 'Não vem', true, 'whatsapp', now(), 'registro_personal') $$, :'c1'),
  'personal cancela direto com exceção 100% + justificativa');
select _as_owner();
select is( (select status from public.aulas where id = :'c1'), 'cancelada', 'aula foi cancelada');
select is( (select percentual_aplicado from public.cancelamentos where aula_id = :'c1'), 100::numeric, 'percentual aplicado = 100');
select is( (select valor_devido from public.cancelamentos where aula_id = :'c1'), 100::numeric, 'valor devido = 100% de 100');
select is( (select count(*)::int from public.pagamentos where chave_referencia = 'cancel:'||:'c1'), 1, 'cobrança de cancelamento criada');
select is( (select count(*)::int from public.auditoria where operacao='cancelamento_efetivado'), 1, 'auditoria do cancelamento gravada');

-- Anti-duplicação: repetir a operação na mesma aula falha (já cancelada)
select _as_user(:'pa');
select throws_ok( format($$ select public.registrar_cancelamento_personal(%L,'personal',100,'x',null,false,null,null,'registro_personal') $$, :'c1'),
  'LT232', NULL, 'repetir cancelamento na mesma aula é bloqueado (sem cobrança dupla)');
select _as_owner();
select is( (select count(*)::int from public.pagamentos where chave_referencia = 'cancel:'||:'c1'), 1, 'continua 1 cobrança (não duplicou)');

-- ===========================================================================
-- Mensalidade fixa (§1.5): cancelar NÃO cria/altera cobrança
-- ===========================================================================
select _as_user(:'pa');
select lives_ok( format($$ select public.registrar_cancelamento_personal(%L,'personal',100,'teste fixa',null,false,null,null,'registro_personal') $$, :'c3'),
  'cancelamento de aula de aluno fixo é registrado');
select _as_owner();
select is( (select status from public.aulas where id = :'c3'), 'cancelada', 'aula fixa cancelada');
select is( (select valor_referencia from public.cancelamentos where aula_id = :'c3'), null, 'fixa: valor_referencia nulo (sem efeito financeiro)');
select is( (select count(*)::int from public.pagamentos where aluno_id = :'af'), 0, 'fixa: nenhuma cobrança criada');

-- ===========================================================================
-- Resolução de diferença (§1.6) e contestação (§1.9)
-- ===========================================================================
select _as_user(:'pa');
select lives_ok( format($$ select public.registrar_resolucao_diferenca(
   (select id from public.cancelamentos where aula_id=%L), 'credito_futuro', 'Crédito p/ próxima') $$, :'c1'),
  'personal registra resolução de diferença');
select _as_owner();
select is( (select resolucao_tipo from public.cancelamentos where aula_id = :'c1'), 'credito_futuro', 'resolução gravada');

-- Aluno contesta o próprio cancelamento; outro aluno não pode
select _as_user(:'aau');
select lives_ok( format($$ select public.abrir_contestacao((select id from public.cancelamentos where aula_id=%L), 'Discordo') $$, :'c1'),
  'aluno dono contesta o cancelamento');
select _as_owner();
select _mk_user(:'abu','outro@test.local');
insert into public.alunos (id, professor_id, nome, telefone, plano_tipo, plano_cobranca, auth_user_id, valor_aula)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd', :'pa', 'Outro', '3', 'avulsa', 'por_aula', :'abu', 100);
-- Captura o id COMO OWNER: a RLS do aluno B esconderia o cancelamento, levando a
-- abrir_contestacao(NULL) -> LT251; queremos exercitar a checagem de posse (LT252).
select id as cid_c1 from public.cancelamentos where aula_id = :'c1' limit 1 \gset
select _as_user(:'abu');
select throws_ok( format($$ select public.abrir_contestacao(%L, 'indevida') $$, :'cid_c1'),
  'LT252', NULL, 'aluno de outro cadastro não contesta cancelamento alheio');
select _as_owner();

select is( (select count(*)::int from public.auditoria where operacao in ('contestacao_aberta','diferenca_resolvida')), 2, 'auditoria de resolução e contestação gravada');

-- ===========================================================================
-- Segurança: IDOR / cross-tenant (correção pós-review de segurança)
-- ===========================================================================
\set pb  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
\set abv 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
\set cv  'ffffffff-ffff-ffff-ffff-ffffffffffff'
select _mk_user(:'pb','pb2@test.local');
insert into public.profiles (id, nome) values (:'pb','Personal B');
insert into public.alunos (id, professor_id, nome, telefone, plano_tipo, plano_cobranca, valor_aula)
  values (:'abv', :'pb', 'Aluno de B', '9', 'avulsa', 'por_aula', 100);
insert into public.aulas (id, professor_id, aluno_id, data, hora, status)
  values (:'cv', :'pb', :'abv', current_date + 2, '11:00', 'agendada');

-- INSERT de solicitação apontando aula de OUTRO tenant é barrado pelo trigger
select throws_ok(
  format($$ insert into public.solicitacoes (aluno_id, professor_id, aula_id, tipo, status)
            values (%L, %L, %L, 'cancelar', 'em_analise') $$, :'aa', :'pa', :'cv'),
  'LT208', NULL, 'INSERT de solicitação com aula de outro tenant é barrado');

-- Imutabilidade: repontar aula_id de uma solicitação existente é barrado
insert into public.aulas (id, professor_id, aluno_id, data, hora, status)
  values ('12121212-1212-1212-1212-121212121212', :'pa', :'aa', current_date+3, '08:00','agendada');
insert into public.solicitacoes (id, aluno_id, professor_id, aula_id, tipo, status)
  values ('34343434-3434-3434-3434-343434343434', :'aa', :'pa', '12121212-1212-1212-1212-121212121212', 'cancelar','em_analise');
select throws_ok(
  format($$ update public.solicitacoes set aula_id = %L where id = '34343434-3434-3434-3434-343434343434' $$, :'cv'),
  'LT207', NULL, 'UPDATE trocando aula_id é barrado (imutabilidade de vínculos)');

-- Defesa no servidor: mesmo com estado forjado (trigger desabilitado só p/
-- simular), o RPC recusa cancelar aula de outro tenant.
alter table public.solicitacoes disable trigger trg_validar_integridade_solicitacao_ativa;
update public.solicitacoes set aula_id = :'cv' where id = '34343434-3434-3434-3434-343434343434';
alter table public.solicitacoes enable trigger trg_validar_integridade_solicitacao_ativa;
select _as_user(:'pa');
select throws_ok(
  $$ select public.decidir_solicitacao_cancelamento('34343434-3434-3434-3434-343434343434', true, 0, null, 'envio_portal', null) $$,
  'LT227', NULL, 'RPC recusa cancelar aula de outro tenant (checagem de posse no servidor)');
select _as_owner();
select is( (select status from public.aulas where id = :'cv'), 'agendada', 'aula do outro tenant permanece agendada');

-- ===========================================================================
-- Regressão: apagar uma aula referenciada por solicitação NÃO pode quebrar
-- (FK solicitacoes.aula_id ON DELETE SET NULL + trigger permitindo o null).
-- Garante que inativação de aluno (limparAulasRecorrenciaFutura) e a exclusão
-- definitiva (cascata) seguem funcionando, sem o LT207.
-- ===========================================================================
insert into public.aulas (id, professor_id, aluno_id, data, hora, status)
  values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', :'pa', :'aa', current_date+5, '07:00','agendada');
insert into public.solicitacoes (id, aluno_id, professor_id, aula_id, tipo, status)
  values ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', :'aa', :'pa', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'cancelar','negada');
select lives_ok(
  $$ delete from public.aulas where id='a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1' $$,
  'apagar aula referenciada por solicitação funciona (SET NULL permitido pelo trigger)');
select is(
  (select aula_id from public.solicitacoes where id='b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2'),
  null, 'aula_id da solicitação virou null após apagar a aula (sem LT207)');

select * from finish();
rollback;
