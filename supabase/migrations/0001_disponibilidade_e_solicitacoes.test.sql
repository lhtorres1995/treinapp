-- ============================================================================
-- Testes de isolamento e integridade — Etapa 1 (disponibilidade/solicitações)
-- Versão corrigida após a revisão de segurança (ver aba "Etapa 1" do doc).
-- ============================================================================
-- ESTES TESTES NÃO DEVEM SER EXECUTADOS NO BANCO DE PRODUÇÃO DO LT360.
-- Use-os em um projeto Supabase local (supabase start) ou em um Postgres de
-- staging isolado, DEPOIS de aplicar, NESTA ORDEM:
--   1) supabase/migrations/0001_disponibilidade_e_solicitacoes.sql
--   2) supabase/migrations/0002_correcoes_seguranca_etapa1.sql
-- (os testes 2, 6, 7 e 8 abaixo dependem dos errcodes LT001/LT002/LT003 e
-- das triggers de coerência de reposição que só existem a partir da 0002).
--
-- O que mudou em relação à primeira versão:
--   - Os usuários de teste agora são criados em auth.users (respeitando a
--     FK profiles_id_fkey e deixando o trigger handle_new_user() criar o
--     profiles correspondente, exatamente como no fluxo real de cadastro)
--   - Nenhum `WHEN OTHERS` sobrou: cada bloco captura o SQLSTATE específico
--     esperado para aquele cenário e RE-LANÇA (`raise;`) qualquer outro erro,
--     para que uma falha real nunca seja mascarada como "OK"
--   - O teste de auditoria passou a checar ROW_COUNT e o estado real do
--     registro após UPDATE/DELETE, em vez de depender de uma exceção que,
--     com RLS sem policy de update/delete, nunca é lançada (o comando só
--     afeta 0 linhas silenciosamente)
--   - Teste 6 cobre o trigger de coerência aula de reposição → aula de
--     origem; teste 7 cobre o cenário INVERSO (origem → reposições já
--     vinculadas) e confirma que remarcação não foi afetada; teste 8
--     prova separadamente que o GRANT de INSERT em auditoria continua
--     presente (padrão Supabase) e que é o RLS — não o grant — quem
--     bloqueia o insert
--
-- Convenção para simular RLS por usuário autenticado (padrão Supabase):
--   set local role authenticated;
--   select set_config('request.jwt.claims', json_build_object('sub', '<uuid>')::text, true);
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Preparação: dois usuários reais em auth.users (Personal A e B), deixando
-- o trigger on_auth_user_created/handle_new_user() criar os profiles — é
-- exatamente o que acontece num cadastro real pelo app, então o teste
-- valida o cenário real, não um atalho que pula a FK.
-- ----------------------------------------------------------------------------
set local role postgres;

do $$
declare
  v_personal_a uuid := '00000000-0000-0000-0000-00000000000a';
  v_personal_b uuid := '00000000-0000-0000-0000-00000000000b';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_personal_a, 'authenticated', 'authenticated',
    'personal-a@teste.local', crypt('senha-teste-a', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_personal_b, 'authenticated', 'authenticated',
    'personal-b@teste.local', crypt('senha-teste-b', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
  on conflict (id) do nothing;

  -- profiles já foi criado pelo trigger handle_new_user(); só ajustamos o
  -- nome para deixar os testes mais legíveis.
  update public.profiles set nome = 'Personal A' where id = v_personal_a;
  update public.profiles set nome = 'Personal B' where id = v_personal_b;

  if not exists (select 1 from public.profiles where id = v_personal_a)
     or not exists (select 1 from public.profiles where id = v_personal_b) then
    raise exception 'FALHA NO SETUP: handle_new_user() não criou o profile esperado — verifique o trigger antes de continuar';
  end if;
end $$;

insert into public.alunos (id, professor_id, nome, telefone, plano_tipo, plano_cobranca)
values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000000a', 'Aluno da A', '1111', 'mensal', 'fixa'),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-00000000000a', 'Segundo aluno da A', '3333', 'mensal', 'fixa'),
  ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-00000000000b', 'Aluno da B', '2222', 'mensal', 'fixa')
on conflict (id) do nothing;

insert into public.aulas (id, professor_id, aluno_id, data, hora, status)
values
  ('00000000-0000-0000-0000-0000000a0101', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0001', current_date + 3, '08:00', 'agendada'),
  ('00000000-0000-0000-0000-0000000a0102', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0001', current_date + 4, '08:00', 'agendada'),
  ('00000000-0000-0000-0000-0000000b0101', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000b0001', current_date + 3, '09:00', 'agendada')
on conflict (id) do nothing;

-- Disponibilidade REAL do Personal A, semeada como owner — é o dado que o
-- teste 1a usa para provar isolamento (existe para A, invisível para B).
insert into public.disponibilidade_personal (id, professor_id, dia_semana, hora_inicio, hora_fim)
values ('00000000-0000-0000-0000-00000000da01', '00000000-0000-0000-0000-00000000000a', 3, '07:00', '11:00')
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- Teste 1 — Isolamento: Personal B não vê nem escreve dados do Personal A
-- ----------------------------------------------------------------------------

-- Pré-condição (como owner): a disponibilidade de A realmente EXISTE no banco.
-- Sem isto, "B não vê nada" seria trivialmente verdadeiro mesmo sem RLS —
-- consultar uma tabela vazia não prova isolamento algum.
set local role postgres;
do $$
declare
  v_qtd_a int;
begin
  select count(*) into v_qtd_a
  from public.disponibilidade_personal
  where professor_id = '00000000-0000-0000-0000-00000000000a';
  if v_qtd_a < 1 then
    raise exception 'FALHA NA PRÉ-CONDIÇÃO: disponibilidade do Personal A não existe — o teste de isolamento não teria valor';
  end if;
  raise notice 'PRÉ (1a): confirmado como owner que o Personal A possui % registro(s) de disponibilidade', v_qtd_a;
end $$;

-- Agora, autenticado como Personal B: o registro de A existe no banco, mas
-- precisa ser INVISÍVEL para B. Provamos as duas coisas na mesma sessão.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b')::text, true);

insert into public.disponibilidade_personal (professor_id, dia_semana, hora_inicio, hora_fim)
values ('00000000-0000-0000-0000-00000000000b', 1, '06:00', '12:00');

do $$
declare
  v_vistos_de_a int;
  v_vistos_de_b int;
begin
  select count(*) into v_vistos_de_a
  from public.disponibilidade_personal
  where professor_id = '00000000-0000-0000-0000-00000000000a';

  select count(*) into v_vistos_de_b
  from public.disponibilidade_personal
  where professor_id = '00000000-0000-0000-0000-00000000000b';

  if v_vistos_de_a <> 0 then
    raise exception 'FALHA: Personal B conseguiu ENXERGAR % registro(s) de disponibilidade do Personal A (RLS não isolou)', v_vistos_de_a;
  end if;
  if v_vistos_de_b < 1 then
    raise exception 'FALHA: Personal B não enxerga a própria disponibilidade — o teste estaria medindo tabela vazia, não isolamento';
  end if;
  raise notice 'OK (1a): a disponibilidade de A existe (confirmada como owner) porém é invisível para B (B vê 0 de A e % própria(s))', v_vistos_de_b;
end $$;

-- Tentativa de inserir em nome do Personal A enquanto autenticado como B:
-- deve ser bloqueada pela policy WITH CHECK (RLS), SQLSTATE 42501.
-- Usamos disponibilidade_personal (sem trigger de integridade própria) para
-- isolar o comportamento puro do RLS — em solicitacoes_aluno, o trigger de
-- integridade (BEFORE INSERT) roda antes da checagem de RLS e normalmente
-- intercepta primeiro (ver nota no teste 2 e no relatório de segurança).
-- Qualquer outro erro aqui é um problema real e deve interromper o script.
do $$
begin
  begin
    insert into public.disponibilidade_personal (professor_id, dia_semana, hora_inicio, hora_fim)
    values ('00000000-0000-0000-0000-00000000000a', 2, '06:00', '12:00');
    raise exception 'FALHA: Personal B conseguiu inserir disponibilidade em nome do Personal A (RLS não bloqueou)';
  exception
    when insufficient_privilege then
      raise notice 'OK (1b): RLS (42501) bloqueou insert cross-personal em disponibilidade_personal';
  end;
end $$;


-- ----------------------------------------------------------------------------
-- Teste 2 — Integridade: aula, aluno e professor precisam ser coerentes
-- (errcode LT001, trigger validar_integridade_solicitacao — ver 0002)
--
-- NOTA: triggers BEFORE ROW rodam antes da checagem WITH CHECK do RLS no
-- INSERT. Isso significa que, em solicitacoes_aluno, uma tentativa de
-- cross-tenant costuma ser interceptada primeiro pelo trigger de
-- integridade (LT001, "aula/aluno não encontrado" — porque o próprio SELECT
-- dentro do trigger já é filtrado por RLS) e só cairia em 42501 se a aula e
-- o aluno referenciados fossem ambos visíveis para o autor mas o
-- professor_id do payload não correspondesse a nenhum dos dois. Na prática
-- a escrita é bloqueada nos dois casos; a diferença é só qual SQLSTATE/
-- mensagem aparece primeiro. Isso é documentado como nota de segurança
-- (ordem de validação), não como falha.
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a')::text, true);

do $$
begin
  begin
    -- aula_original_id pertence ao Personal A, mas aluno_id é do Personal B
    insert into public.solicitacoes_aluno (professor_id, aluno_id, aula_original_id, tipo)
    values (
      '00000000-0000-0000-0000-00000000000a',
      '00000000-0000-0000-0000-0000000b0001',
      '00000000-0000-0000-0000-0000000a0101',
      'remarcacao'
    );
    raise exception 'FALHA: trigger de integridade não bloqueou aluno de outro personal';
  exception
    when sqlstate 'LT001' then
      raise notice 'OK (2): trigger de integridade (LT001) bloqueou aluno/aula/professor incoerentes — %', sqlerrm;
  end;
end $$;


-- ----------------------------------------------------------------------------
-- Teste 3 — Uma solicitação ativa por aula (índice único parcial, 23505)
-- ----------------------------------------------------------------------------
insert into public.solicitacoes_aluno (professor_id, aluno_id, aula_original_id, tipo, status)
values (
  '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-0000000a0001',
  '00000000-0000-0000-0000-0000000a0101',
  'remarcacao',
  'pendente'
);

do $$
begin
  begin
    insert into public.solicitacoes_aluno (professor_id, aluno_id, aula_original_id, tipo, status)
    values (
      '00000000-0000-0000-0000-00000000000a',
      '00000000-0000-0000-0000-0000000a0001',
      '00000000-0000-0000-0000-0000000a0101',
      'cancelamento',
      'proposta_alternativa'
    );
    raise exception 'FALHA: duas solicitações ativas coexistiram para a mesma aula';
  exception
    when unique_violation then
      raise notice 'OK (3a): índice único parcial (23505) impediu segunda solicitação ativa na mesma aula';
  end;
end $$;

-- Uma solicitação em status final (ex. rejeitada) NÃO deve bloquear uma nova
update public.solicitacoes_aluno set status = 'rejeitada', resolved_at = now()
where aula_original_id = '00000000-0000-0000-0000-0000000a0101' and status = 'pendente';

insert into public.solicitacoes_aluno (professor_id, aluno_id, aula_original_id, tipo, status)
values (
  '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-0000000a0001',
  '00000000-0000-0000-0000-0000000a0101',
  'cancelamento',
  'pendente'
);

do $$
begin
  if not exists (
    select 1 from public.solicitacoes_aluno
    where aula_original_id = '00000000-0000-0000-0000-0000000a0101' and status = 'pendente'
  ) then
    raise exception 'FALHA: nova solicitação ativa não foi criada após a anterior ser finalizada';
  end if;
  raise notice 'OK (3b): nova solicitação ativa permitida após a anterior ser finalizada (status final não bloqueia)';
end $$;


-- ----------------------------------------------------------------------------
-- Teste 4 — Auditoria é append-only. Sem policy de update/delete, o Postgres
-- NÃO lança erro: o comando simplesmente afeta 0 linhas. O teste precisa
-- checar ROW_COUNT e reconferir o estado real do registro, não esperar uma
-- exceção que nunca ocorre.
--
-- Após a 0002, nem o INSERT legítimo é mais permitido para "authenticated"
-- (ver teste 4c) — então o registro inicial é semeado como postgres
-- (equivalente a um futuro processo de backend/service_role confiável),
-- e só então alternamos para "authenticated" como o Personal A para as
-- tentativas que devem ser bloqueadas.
-- ----------------------------------------------------------------------------
set local role postgres;

insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_novo)
values (
  '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000a',
  'personal',
  'criar',
  'solicitacao',
  '00000000-0000-0000-0000-0000000a0101',
  '{"status":"pendente"}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a')::text, true);

do $$
declare
  v_rows int;
  v_operacao_depois text;
begin
  update public.auditoria set operacao = 'alterado_indevidamente'
  where professor_id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics v_rows = row_count;

  select operacao into v_operacao_depois
  from public.auditoria
  where professor_id = '00000000-0000-0000-0000-00000000000a' and entidade_id = '00000000-0000-0000-0000-0000000a0101';

  if v_rows <> 0 or v_operacao_depois <> 'criar' then
    raise exception 'FALHA: UPDATE em auditoria afetou % linha(s) e operacao ficou "%" (esperado: 0 linhas, "criar" inalterado)', v_rows, v_operacao_depois;
  end if;
  raise notice 'OK (4a): UPDATE em auditoria afetou 0 linhas (sem policy de update) e o registro permanece inalterado';
end $$;

do $$
declare
  v_rows int;
  v_existe boolean;
begin
  delete from public.auditoria
  where professor_id = '00000000-0000-0000-0000-00000000000a' and entidade_id = '00000000-0000-0000-0000-0000000a0101';
  get diagnostics v_rows = row_count;

  select exists(
    select 1 from public.auditoria
    where professor_id = '00000000-0000-0000-0000-00000000000a' and entidade_id = '00000000-0000-0000-0000-0000000a0101'
  ) into v_existe;

  if v_rows <> 0 or not v_existe then
    raise exception 'FALHA: DELETE em auditoria afetou % linha(s) e o registro deixou de existir (esperado: 0 linhas, registro presente)', v_rows;
  end if;
  raise notice 'OK (4b): DELETE em auditoria afetou 0 linhas (sem policy de delete) e o registro continua presente';
end $$;

-- Confirma também que o INSERT de auditoria pelo personal está bloqueado
-- após a correção da política (0002). Antes da 0002 este bloco falha com
-- "FALHA" (comportamento antigo, intencionalmente permissivo).
do $$
begin
  begin
    insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id, estado_novo)
    values (
      '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'personal',
      'forjado', 'solicitacao', '00000000-0000-0000-0000-0000000a0101', '{}'::jsonb
    );
    raise exception 'FALHA: personal conseguiu inserir em auditoria diretamente (política ainda permissiva — aplique 0002)';
  exception
    when insufficient_privilege then
      raise notice 'OK (4c): INSERT direto em auditoria pelo personal está bloqueado (42501) após 0002';
  end;
end $$;


-- ----------------------------------------------------------------------------
-- Teste 5 — Compatibilidade: tabelas e colunas existentes continuam intactas
-- ----------------------------------------------------------------------------
set local role postgres;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aulas' and column_name = 'remarcada_para_id'
  ) then
    raise exception 'FALHA: coluna remarcada_para_id de aulas desapareceu';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aulas' and column_name = 'duracao_min'
  ) then
    raise exception 'FALHA: coluna nova duracao_min não foi criada';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aulas'
      and column_name = 'duracao_min' and is_nullable = 'NO'
  ) then
    raise exception 'FALHA: duracao_min não deveria ser NOT NULL';
  end if;

  raise notice 'OK (5): schema existente preservado e novas colunas são opcionais';
end $$;


-- ----------------------------------------------------------------------------
-- Teste 6 — Coerência aula de reposição ↔ aula de origem (errcode LT002,
-- trigger validar_integridade_reposicao — ver 0002)
-- ----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a')::text, true);

do $$
begin
  begin
    -- aula_origem_reposicao_id apontando para uma aula do Personal B,
    -- enquanto a linha sendo gravada é do Personal A.
    update public.aulas
      set aula_origem_reposicao_id = '00000000-0000-0000-0000-0000000b0101'
    where id = '00000000-0000-0000-0000-0000000a0102';
    raise exception 'FALHA: foi possível vincular reposição a uma aula de outro personal';
  exception
    when sqlstate 'LT002' then
      raise notice 'OK (6a): trigger de coerência (LT002) bloqueou reposição cross-personal — %', sqlerrm;
  end;
end $$;

-- Caminho válido: mesma aluna, mesmo personal — deve funcionar normalmente.
update public.aulas
  set aula_origem_reposicao_id = '00000000-0000-0000-0000-0000000a0101'
where id = '00000000-0000-0000-0000-0000000a0102';

do $$
begin
  if not exists (
    select 1 from public.aulas
    where id = '00000000-0000-0000-0000-0000000a0102'
      and aula_origem_reposicao_id = '00000000-0000-0000-0000-0000000a0101'
  ) then
    raise exception 'FALHA: vínculo de reposição válido (mesmo personal/aluno) foi bloqueado indevidamente';
  end if;
  raise notice 'OK (6b): vínculo de reposição válido (mesmo personal e aluno) foi aceito normalmente';
end $$;


-- ----------------------------------------------------------------------------
-- Teste 7 — Cenário inverso: a aula ORIGINAL (00..0101) agora tem uma
-- reposição vinculada (00..0102, ajustada no teste 6b). Alterar
-- professor_id/aluno_id de 00..0101 precisa ser bloqueado enquanto esse
-- vínculo existir (errcode LT003, trigger
-- validar_integridade_reposicao_origem — ver 0002).
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    update public.aulas
      set aluno_id = '00000000-0000-0000-0000-0000000a0002'
    where id = '00000000-0000-0000-0000-0000000a0101';
    raise exception 'FALHA: foi possível trocar o aluno da aula original mesmo com reposição vinculada';
  exception
    when sqlstate 'LT003' then
      raise notice 'OK (7a): trigger de coerência (LT003) bloqueou troca de aluno na aula de origem com reposição vinculada — %', sqlerrm;
  end;
end $$;

-- Desvinculando a reposição, a mesma alteração deve passar a ser permitida.
update public.aulas set aula_origem_reposicao_id = null
where id = '00000000-0000-0000-0000-0000000a0102';

update public.aulas
  set aluno_id = '00000000-0000-0000-0000-0000000a0002'
where id = '00000000-0000-0000-0000-0000000a0101';

do $$
begin
  if not exists (
    select 1 from public.aulas
    where id = '00000000-0000-0000-0000-0000000a0101'
      and aluno_id = '00000000-0000-0000-0000-0000000a0002'
  ) then
    raise exception 'FALHA: troca de aluno sem reposição vinculada foi bloqueada indevidamente';
  end if;
  raise notice 'OK (7b): após desvincular a reposição, a troca de aluno na aula de origem foi aceita normalmente';
end $$;

-- Confirma que remarcação (campo e fluxo existentes) não foi afetada pela
-- nova trigger: setar remarcada_para_id/status continua funcionando, pois a
-- trigger só reage a professor_id/aluno_id.
insert into public.aulas (id, professor_id, aluno_id, data, hora, status)
values ('00000000-0000-0000-0000-0000000a0103', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0002', current_date + 5, '08:00', 'agendada')
on conflict (id) do nothing;

update public.aulas
  set status = 'remarcada', remarcada_para_id = '00000000-0000-0000-0000-0000000a0103'
where id = '00000000-0000-0000-0000-0000000a0101';

do $$
begin
  if not exists (
    select 1 from public.aulas
    where id = '00000000-0000-0000-0000-0000000a0101'
      and status = 'remarcada' and remarcada_para_id = '00000000-0000-0000-0000-0000000a0103'
  ) then
    raise exception 'FALHA: remarcação deixou de funcionar após as novas triggers';
  end if;
  raise notice 'OK (7c): remarcação (status + remarcada_para_id) continua funcionando sem interferência das novas triggers';
end $$;


-- ----------------------------------------------------------------------------
-- Teste 8 — Privilégio SQL (GRANT) não é o mesmo que permissão real: o
-- papel authenticated deve CONTINUAR tendo o GRANT de INSERT em auditoria
-- (padrão do Supabase, igual às tabelas antigas) — quem bloqueia de fato é
-- a ausência de policy (RLS), não a ausência de grant. Este teste prova as
-- duas coisas separadamente, para não confundir uma com a outra.
-- ----------------------------------------------------------------------------
set local role postgres;

do $$
declare
  v_tem_grant boolean;
begin
  select exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'auditoria'
      and grantee = 'authenticated' and privilege_type = 'INSERT'
  ) into v_tem_grant;

  if not v_tem_grant then
    raise exception 'FALHA: authenticated perdeu o GRANT de INSERT em auditoria — isso é inesperado, o bloqueio deveria vir só do RLS (sem policy), não da revogação do privilégio';
  end if;
  raise notice 'OK (8a): authenticated ainda TEM o privilégio SQL de INSERT em auditoria (igual às tabelas antigas) — o grant por si só não concede acesso';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a')::text, true);

do $$
begin
  begin
    insert into public.auditoria (professor_id, ator_id, ator_papel, operacao, entidade, entidade_id)
    values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'personal', 'teste-grant-vs-rls', 'aula', '00000000-0000-0000-0000-0000000a0101');
    raise exception 'FALHA: mesmo com o grant presente, o RLS deveria ter bloqueado este insert (sem policy de insert)';
  exception
    when insufficient_privilege then
      raise notice 'OK (8b): apesar do GRANT de INSERT existir, o RLS (sem policy para o comando) bloqueou o insert — confirma que RLS, não o grant, é quem decide aqui';
  end;
end $$;

rollback;
