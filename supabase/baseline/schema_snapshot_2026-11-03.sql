-- ============================================================================
-- LT360 / trainer-flow — FOTOGRAFIA DO SCHEMA REAL (schema `public`)
-- Snapshot em 2026-11-03, reconstruído por INTROSPECÇÃO SOMENTE LEITURA do
-- catálogo (information_schema + pg_catalog) via Supabase MCP.
--
-- ⚠️ ESTE ARQUIVO NÃO É UMA MIGRAÇÃO E NÃO DEVE SER APLICADO.
--    É uma baseline de referência do estado atual, para o repositório voltar a
--    refletir o banco real (que foi construído em boa parte por SQL direto,
--    fora do tracking de migrações — ver ../../../docs/ARQUITETURA-BANCO.md).
--
-- MÉTODO E LIMITAÇÕES (honestidade sobre completude):
--   * Reconstrução a partir do catálogo, NÃO um `pg_dump --schema-only`
--     byte-a-byte. As definições de FUNÇÕES e TRIGGERS abaixo são as saídas
--     verbatim de pg_get_functiondef()/pg_get_triggerdef() (fiéis). Tabelas,
--     constraints, índices, RLS e policies foram reconstruídos dos catálogos.
--   * COBRE apenas o schema `public`. NÃO inclui: schemas `auth`, `storage`,
--     `realtime`, `extensions`, `vault`, etc. (gerenciados pelo Supabase);
--     extensões e suas versões; sequences (não há — todas as PKs são uuid);
--     ownership/roles; COMMENTs; default privileges exatos; edge functions
--     (vivem em Deno, fora do SQL — ver supabase/functions/ e docs).
--   * NÃO contém dados (nenhuma linha de alunos/pagamentos/etc.), segredos,
--     tokens ou credenciais.
--   * GRANTS: todas as tabelas `public` concedem ALL a anon, authenticated e
--     service_role (padrão Supabase). O isolamento real é feito por RLS +
--     auth.uid(), não pelos grants. Reproduzido como nota, não como DDL, para
--     não divergir do que o Supabase recria automaticamente.
--
-- Para gerar uma baseline byte-exata no futuro:
--   supabase db dump --schema public -f baseline_<data>.sql   (ou pg_dump
--   --schema-only --schema=public), rodado contra o projeto, com revisão.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABELAS
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid not null,
  nome text,
  telefone text,
  pix text,
  logo_url text,
  created_at timestamptz default now(),
  capacidade_simultanea integer not null default 1,
  antecedencia_minima_horas integer not null default 12,
  duracao_habitual_min integer,
  pix_tipo text,
  cidade text,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade,
  constraint profiles_antecedencia_minima_horas_check check (antecedencia_minima_horas >= 0),
  constraint profiles_capacidade_simultanea_check check (capacidade_simultanea > 0),
  constraint profiles_duracao_habitual_min_check check (duracao_habitual_min is null or duracao_habitual_min > 0)
);

create table public.alunos (
  id uuid not null default gen_random_uuid(),
  professor_id uuid not null,
  nome text not null,
  telefone text not null,
  sexo text,
  nascimento date,
  endereco text,
  plano_tipo text not null,
  plano_cobranca text not null,
  valor_fixo numeric default 0,
  valor_aula numeric default 0,
  recorrencia_horarios jsonb default '{}'::jsonb,
  ativo boolean default true,
  created_at timestamptz default now(),
  auth_user_id uuid,
  dias_vencimento integer,
  email text,
  treino_tipo text,
  treino_local text,
  checkin_token uuid not null default gen_random_uuid(),
  foto_url text,
  constraint alunos_pkey primary key (id),
  constraint alunos_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint alunos_auth_user_id_fkey foreign key (auth_user_id) references auth.users(id) on delete set null,
  constraint alunos_plano_tipo_check check (plano_tipo = any (array['mensal','semanal','avulsa'])),
  constraint alunos_plano_cobranca_check check (plano_cobranca = any (array['fixa','por_aula']))
);
create unique index idx_alunos_auth_user_unico on public.alunos (auth_user_id) where (auth_user_id is not null);
create unique index idx_alunos_checkin_token on public.alunos (checkin_token);
create index idx_alunos_professor on public.alunos (professor_id);

create table public.aulas (
  id uuid not null default gen_random_uuid(),
  professor_id uuid not null,
  aluno_id uuid not null,
  data date not null,
  hora time without time zone not null,
  status text not null default 'agendada'::text,
  remarcada_para_id uuid,
  faturada boolean default false,
  origem text default 'manual'::text,
  created_at timestamptz default now(),
  duracao_min integer,
  aula_origem_reposicao_id uuid,
  valor_faturado numeric,
  checkin_em timestamptz,
  checkin_origem text,
  constraint aulas_pkey primary key (id),
  constraint aulas_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint aulas_aluno_id_fkey foreign key (aluno_id) references public.alunos(id) on delete cascade,
  constraint aulas_remarcada_para_id_fkey foreign key (remarcada_para_id) references public.aulas(id),
  constraint aulas_aula_origem_reposicao_id_fkey foreign key (aula_origem_reposicao_id) references public.aulas(id),
  constraint aulas_status_check check (status = any (array['agendada','confirmada','concluida','cancelada','remarcada'])),
  constraint aulas_origem_check check (origem = any (array['manual','recorrencia'])),
  constraint aulas_duracao_min_check check (duracao_min is null or duracao_min > 0),
  constraint aulas_reposicao_nao_autorreferente check (aula_origem_reposicao_id is null or aula_origem_reposicao_id <> id)
);
create index idx_aulas_aluno_data on public.aulas (aluno_id, data);
create index idx_aulas_professor on public.aulas (professor_id);
create index idx_aulas_origem_reposicao on public.aulas (aula_origem_reposicao_id) where (aula_origem_reposicao_id is not null);

create table public.pagamentos (
  id uuid not null default gen_random_uuid(),
  professor_id uuid not null,
  aluno_id uuid not null,
  valor numeric not null,
  referencia text,
  periodo_label text,
  status text not null default 'pendente'::text,
  chave_referencia text,
  mes_referencia text,
  data_vencimento date,
  data_pagamento date,
  aula_ids uuid[] default '{}'::uuid[],
  created_at timestamptz default now(),
  pago_informado_em timestamptz,
  constraint pagamentos_pkey primary key (id),
  constraint pagamentos_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint pagamentos_aluno_id_fkey foreign key (aluno_id) references public.alunos(id) on delete cascade,
  constraint pagamentos_status_check check (status = any (array['pendente','pago']))
);
create index idx_pagamentos_aluno on public.pagamentos (aluno_id);
create index idx_pagamentos_professor on public.pagamentos (professor_id);

create table public.solicitacoes (
  id uuid not null default gen_random_uuid(),
  aluno_id uuid not null,
  professor_id uuid not null,
  aula_id uuid,
  tipo text not null,
  data_sugerida date,
  hora_sugerida time without time zone,
  mensagem text,
  status text not null default 'em_analise'::text,
  resposta text,
  created_at timestamptz default now(),
  respondida_em timestamptz,
  contra_data date,
  contra_hora time without time zone,
  constraint solicitacoes_pkey primary key (id),
  constraint solicitacoes_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint solicitacoes_aluno_id_fkey foreign key (aluno_id) references public.alunos(id) on delete cascade,
  constraint solicitacoes_aula_id_fkey foreign key (aula_id) references public.aulas(id) on delete set null,
  constraint solicitacoes_tipo_check check (tipo = any (array['remarcar','cancelar'])),
  constraint solicitacoes_status_check check (status = any (array['em_analise','contraproposta','aprovada','negada']))
);
create index idx_solic_aluno on public.solicitacoes (aluno_id);
create index idx_solic_professor on public.solicitacoes (professor_id, status);

create table public.solicitacoes_aluno (
  id uuid not null default gen_random_uuid(),
  professor_id uuid not null,
  aluno_id uuid not null,
  aula_original_id uuid not null,
  tipo text not null,
  status text not null default 'pendente'::text,
  data_proposta date,
  hora_proposta time without time zone,
  mensagem_aluno text,
  data_contraproposta date,
  hora_contraproposta time without time zone,
  resposta_personal text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint solicitacoes_aluno_pkey primary key (id),
  constraint solicitacoes_aluno_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint solicitacoes_aluno_aluno_id_fkey foreign key (aluno_id) references public.alunos(id) on delete cascade,
  constraint solicitacoes_aluno_aula_original_id_fkey foreign key (aula_original_id) references public.aulas(id) on delete cascade,
  constraint solicitacoes_aluno_tipo_check check (tipo = any (array['remarcacao','cancelamento','reposicao'])),
  constraint solicitacoes_aluno_status_check check (status = any (array['pendente','proposta_alternativa','aprovada','rejeitada','cancelada_pelo_aluno']))
);
create unique index idx_solicitacao_ativa_unica on public.solicitacoes_aluno (aula_original_id) where (status = any (array['pendente','proposta_alternativa']));
create index idx_solicitacoes_aluno_id on public.solicitacoes_aluno (aluno_id);
create index idx_solicitacoes_aula on public.solicitacoes_aluno (aula_original_id);
create index idx_solicitacoes_professor on public.solicitacoes_aluno (professor_id, status);
-- NOTA: solicitacoes_aluno é ÓRFÃ (sem policy de aluno, 0 linhas, sem uso no código). Ver ARQUITETURA-BANCO.md.

create table public.disponibilidade_personal (
  id uuid not null default gen_random_uuid(),
  professor_id uuid not null,
  dia_semana smallint not null,
  hora_inicio time without time zone not null,
  hora_fim time without time zone not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint disponibilidade_personal_pkey primary key (id),
  constraint disponibilidade_personal_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint disponibilidade_personal_dia_semana_check check (dia_semana >= 0 and dia_semana <= 6),
  constraint disponibilidade_horario_valido check (hora_fim > hora_inicio)
);
create index idx_disponibilidade_professor on public.disponibilidade_personal (professor_id, dia_semana);

create table public.bloqueios_agenda (
  id uuid not null default gen_random_uuid(),
  professor_id uuid not null,
  data_inicio date not null,
  data_fim date not null,
  hora_inicio time without time zone,
  hora_fim time without time zone,
  motivo text,
  created_at timestamptz not null default now(),
  constraint bloqueios_agenda_pkey primary key (id),
  constraint bloqueios_agenda_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint bloqueio_periodo_valido check (data_fim >= data_inicio),
  constraint bloqueio_horario_valido check ((hora_inicio is null and hora_fim is null) or (hora_inicio is not null and hora_fim is not null and hora_fim > hora_inicio)),
  constraint bloqueio_parcial_mesmo_dia check ((hora_inicio is null and hora_fim is null) or (data_inicio = data_fim))
);
create index idx_bloqueios_professor_periodo on public.bloqueios_agenda (professor_id, data_inicio, data_fim);

create table public.auditoria (
  id uuid not null default gen_random_uuid(),
  professor_id uuid not null,
  ator_id uuid,
  ator_papel text not null,
  operacao text not null,
  entidade text not null,
  entidade_id uuid not null,
  estado_anterior jsonb,
  estado_novo jsonb,
  created_at timestamptz not null default now(),
  constraint auditoria_pkey primary key (id),
  constraint auditoria_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint auditoria_ator_papel_check check (ator_papel = any (array['personal','aluno','sistema']))
);
create index idx_auditoria_entidade on public.auditoria (entidade, entidade_id);
create index idx_auditoria_professor_data on public.auditoria (professor_id, created_at desc);
-- NOTA: nenhuma função grava em `auditoria` hoje; tabela genérica dormente,
-- só com policy de SELECT para o professor. Alvo de reúso na feature de
-- cancelamento (escrita via RPC SECURITY DEFINER na etapa 2).

create table public.push_subscriptions (
  id uuid not null default gen_random_uuid(),
  aluno_id uuid,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  professor_id uuid,
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_aluno_id_fkey foreign key (aluno_id) references public.alunos(id) on delete cascade,
  constraint push_subscriptions_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint push_subscriptions_endpoint_key unique (endpoint),
  constraint push_owner_chk check (((aluno_id is not null)::integer + (professor_id is not null)::integer) = 1)
);

create table public.notificacoes_enviadas (
  chave text not null,
  enviado_em timestamptz default now(),
  constraint notificacoes_enviadas_pkey primary key (chave)
);

create table public.metricas_catalogo (
  id uuid not null default gen_random_uuid(),
  professor_id uuid,
  metrica_codigo text not null,
  nome_exibicao text not null,
  categoria text not null,
  unidade_padrao text not null,
  valor_min numeric,
  valor_max numeric,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint metricas_catalogo_pkey primary key (id),
  constraint metricas_catalogo_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint metricas_catalogo_categoria_check check (categoria = any (array['peso_altura','perimetro','bioimpedancia','custom'])),
  constraint metricas_catalogo_metrica_codigo_check check (metrica_codigo ~ '^[a-z0-9_]+$'),
  constraint metricas_catalogo_faixa_valida check (valor_min is null or valor_max is null or valor_min < valor_max)
);
create unique index metricas_catalogo_codigo_unq on public.metricas_catalogo (coalesce(professor_id, '00000000-0000-0000-0000-000000000000'::uuid), metrica_codigo);
create index idx_metricas_catalogo_professor on public.metricas_catalogo (professor_id);

create table public.avaliacoes_fisicas (
  id uuid not null default gen_random_uuid(),
  professor_id uuid not null,
  aluno_id uuid not null,
  aula_id uuid,
  data_avaliacao date not null,
  observacoes text,
  excluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint avaliacoes_fisicas_pkey primary key (id),
  constraint avaliacoes_fisicas_professor_id_fkey foreign key (professor_id) references public.profiles(id) on delete cascade,
  constraint avaliacoes_fisicas_aluno_id_fkey foreign key (aluno_id) references public.alunos(id) on delete cascade,
  constraint avaliacoes_fisicas_aula_id_fkey foreign key (aula_id) references public.aulas(id) on delete set null
);
create index idx_avaliacoes_fisicas_aluno_data on public.avaliacoes_fisicas (aluno_id, data_avaliacao);
create index idx_avaliacoes_fisicas_professor on public.avaliacoes_fisicas (professor_id);

create table public.avaliacoes_fisicas_itens (
  id uuid not null default gen_random_uuid(),
  avaliacao_id uuid not null,
  metrica_id uuid not null,
  valor numeric not null,
  unidade text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint avaliacoes_fisicas_itens_pkey primary key (id),
  constraint avaliacoes_fisicas_itens_avaliacao_id_fkey foreign key (avaliacao_id) references public.avaliacoes_fisicas(id) on delete cascade,
  constraint avaliacoes_fisicas_itens_metrica_id_fkey foreign key (metrica_id) references public.metricas_catalogo(id),
  constraint avaliacoes_fisicas_itens_avaliacao_id_metrica_id_key unique (avaliacao_id, metrica_id)
);
create index idx_avaliacoes_fisicas_itens_avaliacao on public.avaliacoes_fisicas_itens (avaliacao_id);

create table public.avaliacoes_fisicas_historico (
  id uuid not null default gen_random_uuid(),
  avaliacao_id uuid not null,
  alterado_por uuid not null,
  alterado_em timestamptz not null default now(),
  operacao text not null,
  dados_anteriores jsonb,
  dados_novos jsonb,
  constraint avaliacoes_fisicas_historico_pkey primary key (id),
  constraint avaliacoes_fisicas_historico_avaliacao_id_fkey foreign key (avaliacao_id) references public.avaliacoes_fisicas(id) on delete cascade,
  constraint avaliacoes_fisicas_historico_alterado_por_fkey foreign key (alterado_por) references public.profiles(id),
  constraint avaliacoes_fisicas_historico_operacao_check check (operacao = any (array['update_cabecalho','soft_delete','restore','insert_item','update_item','delete_item']))
);
create index idx_avaliacoes_fisicas_historico_avaliacao on public.avaliacoes_fisicas_historico (avaliacao_id);

-- ----------------------------------------------------------------------------
-- RLS: habilitada em TODAS as tabelas public (nenhuma com FORCE).
-- ----------------------------------------------------------------------------
alter table public.profiles                     enable row level security;
alter table public.alunos                       enable row level security;
alter table public.aulas                        enable row level security;
alter table public.pagamentos                   enable row level security;
alter table public.solicitacoes                 enable row level security;
alter table public.solicitacoes_aluno           enable row level security;
alter table public.disponibilidade_personal     enable row level security;
alter table public.bloqueios_agenda             enable row level security;
alter table public.auditoria                    enable row level security;
alter table public.push_subscriptions           enable row level security;
alter table public.notificacoes_enviadas        enable row level security;
alter table public.metricas_catalogo            enable row level security;
alter table public.avaliacoes_fisicas           enable row level security;
alter table public.avaliacoes_fisicas_itens     enable row level security;
alter table public.avaliacoes_fisicas_historico enable row level security;

-- ----------------------------------------------------------------------------
-- POLICIES (todas no role `public`; o isolamento vem de auth.uid()).
-- Reconstruídas de pg_policies. `notificacoes_enviadas` está com RLS ligada
-- porém SEM policies (acesso só via service_role/edge function).
-- ----------------------------------------------------------------------------
create policy "profiles: cada um vê e edita o próprio" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles: aluno vê o perfil do próprio personal" on public.profiles for select using (exists (select 1 from alunos a where a.professor_id = profiles.id and a.auth_user_id = auth.uid()));

create policy "alunos: isolado por professor" on public.alunos for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);
create policy "alunos: aluno vê o próprio cadastro" on public.alunos for select using (auth.uid() = auth_user_id);

create policy "aulas: isolado por professor" on public.aulas for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);
create policy "aulas: aluno vê as próprias aulas" on public.aulas for select using (exists (select 1 from alunos a where a.id = aulas.aluno_id and a.auth_user_id = auth.uid()));

create policy "pagamentos: isolado por professor" on public.pagamentos for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);
create policy "pagamentos: aluno vê os próprios" on public.pagamentos for select using (exists (select 1 from alunos a where a.id = pagamentos.aluno_id and a.auth_user_id = auth.uid()));

create policy "solic: aluno cria as próprias" on public.solicitacoes for insert with check (exists (select 1 from alunos a where a.id = solicitacoes.aluno_id and a.auth_user_id = auth.uid() and a.professor_id = solicitacoes.professor_id));
create policy "solic: aluno vê as próprias" on public.solicitacoes for select using (exists (select 1 from alunos a where a.id = solicitacoes.aluno_id and a.auth_user_id = auth.uid()));
create policy "solic: personal vê as suas" on public.solicitacoes for select using (professor_id = auth.uid());
create policy "solic: personal responde as suas" on public.solicitacoes for update using (professor_id = auth.uid()) with check (professor_id = auth.uid());

create policy "solicitacoes: isolado por professor" on public.solicitacoes_aluno for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);

create policy "disponibilidade: isolado por professor" on public.disponibilidade_personal for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);
create policy "disp: aluno vê a do seu personal" on public.disponibilidade_personal for select using (exists (select 1 from alunos a where a.professor_id = disponibilidade_personal.professor_id and a.auth_user_id = auth.uid()));

create policy "bloqueios: isolado por professor" on public.bloqueios_agenda for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);

create policy "auditoria: leitura isolada por professor" on public.auditoria for select using (auth.uid() = professor_id);

create policy "push: aluno vê as próprias" on public.push_subscriptions for select using (exists (select 1 from alunos a where a.id = push_subscriptions.aluno_id and a.auth_user_id = auth.uid()));
create policy "push: personal vê as próprias" on public.push_subscriptions for select using (professor_id = auth.uid());

create policy "metricas_catalogo: leitura padrão + próprias + do seu professor" on public.metricas_catalogo for select using (professor_id is null or professor_id = auth.uid() or exists (select 1 from alunos a where a.professor_id = metricas_catalogo.professor_id and a.auth_user_id = auth.uid()));
create policy "metricas_catalogo: professor cria métricas custom próprias" on public.metricas_catalogo for insert with check (professor_id = auth.uid());
create policy "metricas_catalogo: professor atualiza métricas custom próprias" on public.metricas_catalogo for update using (professor_id = auth.uid()) with check (professor_id = auth.uid());

create policy "avaliacoes_fisicas: professor lê as próprias" on public.avaliacoes_fisicas for select using (auth.uid() = professor_id);
create policy "avaliacoes_fisicas: aluno vê as próprias avaliações ativas" on public.avaliacoes_fisicas for select using (excluida_em is null and exists (select 1 from alunos a where a.id = avaliacoes_fisicas.aluno_id and a.auth_user_id = auth.uid()));
create policy "avaliacoes_fisicas: professor insere as próprias" on public.avaliacoes_fisicas for insert with check (auth.uid() = professor_id);
create policy "avaliacoes_fisicas: professor corrige/exclui(soft) as próprias" on public.avaliacoes_fisicas for update using (auth.uid() = professor_id) with check (auth.uid() = professor_id);

create policy "avaliacoes_fisicas_itens: professor lê itens das próprias avaliações" on public.avaliacoes_fisicas_itens for select using (exists (select 1 from avaliacoes_fisicas af where af.id = avaliacoes_fisicas_itens.avaliacao_id and af.professor_id = auth.uid()));
create policy "avaliacoes_fisicas_itens: aluno vê itens das próprias avaliações" on public.avaliacoes_fisicas_itens for select using (exists (select 1 from avaliacoes_fisicas af join alunos a on a.id = af.aluno_id where af.id = avaliacoes_fisicas_itens.avaliacao_id and a.auth_user_id = auth.uid() and af.excluida_em is null));
create policy "avaliacoes_fisicas_itens: professor insere itens nas próprias" on public.avaliacoes_fisicas_itens for insert with check (exists (select 1 from avaliacoes_fisicas af where af.id = avaliacoes_fisicas_itens.avaliacao_id and af.professor_id = auth.uid()));
create policy "avaliacoes_fisicas_itens: professor corrige itens das próprias" on public.avaliacoes_fisicas_itens for update using (exists (select 1 from avaliacoes_fisicas af where af.id = avaliacoes_fisicas_itens.avaliacao_id and af.professor_id = auth.uid())) with check (exists (select 1 from avaliacoes_fisicas af where af.id = avaliacoes_fisicas_itens.avaliacao_id and af.professor_id = auth.uid()));
create policy "avaliacoes_fisicas_itens: professor remove itens das próprias" on public.avaliacoes_fisicas_itens for delete using (exists (select 1 from avaliacoes_fisicas af where af.id = avaliacoes_fisicas_itens.avaliacao_id and af.professor_id = auth.uid()));

create policy "avaliacoes_fisicas_historico: professor lê o histórico das próprias" on public.avaliacoes_fisicas_historico for select using (exists (select 1 from avaliacoes_fisicas af where af.id = avaliacoes_fisicas_historico.avaliacao_id and af.professor_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- FUNÇÕES (verbatim de pg_get_functiondef) e TRIGGERS
-- search_path: '' = tudo qualificado com public.; 'public' = fixo em public.
-- ⚠️ handle_new_user NÃO tem search_path fixo (risco pré-existente conhecido).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if (new.raw_user_meta_data->>'role') = 'aluno' then
    return new;
  end if;
  insert into public.profiles (id, nome) values (new.id, '');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_por_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_aluno   public.alunos%rowtype;
  v_aula    public.aulas%rowtype;
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_agora   time := (now() at time zone 'America/Sao_Paulo')::time;
begin
  select * into v_aluno
  from public.alunos
  where checkin_token = p_token
    and professor_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'QR não reconhecido ou aluno de outro personal.');
  end if;

  select * into v_aula
  from public.aulas
  where aluno_id = v_aluno.id
    and data = v_hoje
    and status not in ('cancelada','remarcada')
  order by (checkin_em is not null) asc,
           abs(extract(epoch from (hora - v_agora))) asc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'aluno', v_aluno.nome,
      'erro', 'Nenhuma aula agendada para hoje.');
  end if;

  if v_aula.checkin_em is not null then
    return jsonb_build_object('ok', true, 'jafeito', true,
      'aluno', v_aluno.nome, 'hora', to_char(v_aula.hora,'HH24:MI'),
      'checkin_em', v_aula.checkin_em);
  end if;

  update public.aulas
    set checkin_em = now(), checkin_origem = 'qr'
    where id = v_aula.id;

  return jsonb_build_object('ok', true,
    'aluno', v_aluno.nome, 'hora', to_char(v_aula.hora,'HH24:MI'),
    'aula_id', v_aula.id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.definir_foto_aluno(p_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if p_url is not null and p_url not like '%/storage/v1/object/public/fotos-alunos/%' then
    return jsonb_build_object('ok', false, 'erro', 'URL de foto inválida.');
  end if;

  update public.alunos
    set foto_url = p_url
    where auth_user_id = auth.uid()
    returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Cadastro de aluno não encontrado.');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.informar_pagamento(p_pagamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pg public.pagamentos%rowtype;
begin
  select * into v_pg
  from public.pagamentos
  where id = p_pagamento_id
    and exists (
      select 1 from public.alunos a
      where a.id = pagamentos.aluno_id and a.auth_user_id = auth.uid()
    );

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Cobrança não encontrada.');
  end if;

  if v_pg.status = 'pago' then
    return jsonb_build_object('ok', true, 'japago', true);
  end if;

  update public.pagamentos
    set pago_informado_em = now()
    where id = p_pagamento_id;

  return jsonb_build_object('ok', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.remarcar_aula(p_aula_original_id uuid, p_nova_data date, p_nova_hora time without time zone)
 RETURNS aulas
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_orig public.aulas;
  v_nova public.aulas;
  v_nova_id uuid := gen_random_uuid();
begin
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

  insert into public.aulas (id, professor_id, aluno_id, data, hora, duracao_min, status, faturada, origem)
  values (
    v_nova_id, v_orig.professor_id, v_orig.aluno_id, p_nova_data, p_nova_hora,
    coalesce(v_orig.duracao_min, 50), 'agendada', false, 'manual'
  )
  returning * into v_nova;

  update public.aulas
     set status = 'remarcada', remarcada_para_id = v_nova_id
   where id = p_aula_original_id;

  return v_nova;
end;
$function$;

CREATE OR REPLACE FUNCTION public.responder_contraproposta(p_solic_id uuid, p_aceitar boolean)
 RETURNS aulas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_solic public.solicitacoes;
  v_aula  public.aulas;
  v_nova  public.aulas;
begin
  select * into v_solic from public.solicitacoes where id = p_solic_id for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode = 'LT020'; end if;

  if not exists (select 1 from public.alunos a where a.id = v_solic.aluno_id and a.auth_user_id = auth.uid()) then
    raise exception 'Sem permissão para esta solicitação.' using errcode = 'LT021';
  end if;
  if v_solic.status <> 'contraproposta' then
    raise exception 'A solicitação não está aguardando seu aceite.' using errcode = 'LT022';
  end if;

  if not p_aceitar then
    update public.solicitacoes set status = 'negada', respondida_em = now() where id = v_solic.id;
    return null;
  end if;

  if v_solic.contra_data is null or v_solic.contra_hora is null then
    raise exception 'Sem horário sugerido para aplicar.' using errcode = 'LT024';
  end if;

  select * into v_aula from public.aulas where id = v_solic.aula_id for update;
  if not found then raise exception 'Aula não encontrada.' using errcode = 'LT025'; end if;
  if v_aula.status not in ('agendada','confirmada') then
    raise exception 'A aula não pode mais ser remarcada.' using errcode = 'LT026';
  end if;

  insert into public.aulas (aluno_id, professor_id, data, hora, status, origem, faturada)
  values (v_aula.aluno_id, v_aula.professor_id, v_solic.contra_data, v_solic.contra_hora, 'agendada', 'manual', false)
  returning * into v_nova;

  update public.aulas set status = 'remarcada', remarcada_para_id = v_nova.id where id = v_aula.id;
  update public.solicitacoes set status = 'aprovada', respondida_em = now() where id = v_solic.id;

  return v_nova;
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_aluno uuid;
begin
  select id into v_aluno from public.alunos where auth_user_id = auth.uid();
  if v_aluno is null then
    return jsonb_build_object('ok', false, 'erro', 'Cadastro de aluno não encontrado.');
  end if;
  insert into public.push_subscriptions (aluno_id, endpoint, p256dh, auth, user_agent)
    values (v_aluno, p_endpoint, p_p256dh, p_auth, p_ua)
    on conflict (endpoint) do update
      set aluno_id = excluded.aluno_id, p256dh = excluded.p256dh,
          auth = excluded.auth, user_agent = excluded.user_agent;
  return jsonb_build_object('ok', true);
end; $function$;

CREATE OR REPLACE FUNCTION public.remover_push_subscription(p_endpoint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.push_subscriptions ps
    using public.alunos a
    where ps.endpoint = p_endpoint and a.id = ps.aluno_id and a.auth_user_id = auth.uid();
  return jsonb_build_object('ok', true);
end; $function$;

CREATE OR REPLACE FUNCTION public.salvar_push_personal(p_endpoint text, p_p256dh text, p_auth text, p_ua text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'erro', 'Sem sessão.');
  end if;
  insert into public.push_subscriptions (professor_id, aluno_id, endpoint, p256dh, auth, user_agent)
    values (auth.uid(), null, p_endpoint, p_p256dh, p_auth, p_ua)
    on conflict (endpoint) do update
      set professor_id = excluded.professor_id, aluno_id = null,
          p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
  return jsonb_build_object('ok', true);
end; $function$;

CREATE OR REPLACE FUNCTION public.remover_push_personal(p_endpoint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.push_subscriptions
    where endpoint = p_endpoint and professor_id = auth.uid();
  return jsonb_build_object('ok', true);
end; $function$;

-- Triggers de validação/histórico (corpos verbatim). Ver 0004/0007/0008 para origem.
CREATE OR REPLACE FUNCTION public.validar_capacidade_aula()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare
  v_habitual integer; v_duracao_efetiva integer; v_hora_fim time;
  v_capacidade integer; v_pico integer;
begin
  if TG_OP = 'UPDATE' and NEW.status not in ('agendada', 'confirmada', 'concluida') then return NEW; end if;
  if NEW.status not in ('agendada', 'confirmada', 'concluida') then return NEW; end if;
  if TG_OP = 'UPDATE' and OLD.status in ('agendada', 'confirmada', 'concluida')
     and NEW.data = OLD.data and NEW.hora = OLD.hora
     and NEW.duracao_min is not distinct from OLD.duracao_min
     and NEW.professor_id = OLD.professor_id then return NEW; end if;
  if TG_OP = 'INSERT' and NEW.duracao_min is null then
    select duracao_habitual_min into v_habitual from public.profiles where id = NEW.professor_id;
    NEW.duracao_min := coalesce(v_habitual, 50);
  end if;
  v_duracao_efetiva := coalesce(NEW.duracao_min, 50);
  v_hora_fim := (NEW.hora + (v_duracao_efetiva || ' minutes')::interval)::time;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Agendamento exige READ COMMITTED; isolamento atual = %. A proteção de capacidade não é segura neste nível.',
      current_setting('transaction_isolation') using errcode = 'LT009';
  end if;
  if TG_OP = 'UPDATE' and OLD.professor_id is distinct from NEW.professor_id then
    if OLD.professor_id::text < NEW.professor_id::text then
      perform pg_advisory_xact_lock(hashtext(OLD.professor_id::text));
      perform pg_advisory_xact_lock(hashtext(NEW.professor_id::text));
    else
      perform pg_advisory_xact_lock(hashtext(NEW.professor_id::text));
      perform pg_advisory_xact_lock(hashtext(OLD.professor_id::text));
    end if;
  else
    perform pg_advisory_xact_lock(hashtext(NEW.professor_id::text));
  end if;
  select coalesce(capacidade_simultanea, 1) into v_capacidade from public.profiles where id = NEW.professor_id;
  v_capacidade := coalesce(v_capacidade, 1);
  select max(pico) into v_pico from (
    select (
      select count(*) from public.aulas a2
      where a2.professor_id = NEW.professor_id and a2.data = NEW.data and a2.id <> NEW.id
        and a2.status in ('agendada', 'confirmada', 'concluida')
        and a2.hora <= evento.instante
        and evento.instante < (a2.hora + (coalesce(a2.duracao_min, 50) || ' minutes')::interval)::time
    ) + 1 as pico
    from (
      select NEW.hora as instante
      union
      select a3.hora from public.aulas a3
      where a3.professor_id = NEW.professor_id and a3.data = NEW.data and a3.id <> NEW.id
        and a3.status in ('agendada', 'confirmada', 'concluida')
        and a3.hora >= NEW.hora and a3.hora < v_hora_fim
    ) as evento
  ) as picos;
  if v_pico > v_capacidade then
    raise exception 'Capacidade simultânea excedida: % aula(s) ao mesmo tempo, capacidade configurada % (horário % às %)',
      v_pico, v_capacidade, NEW.data, NEW.hora using errcode = 'LT004';
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validar_integridade_reposicao()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_origem_professor uuid; v_origem_aluno uuid;
begin
  if new.aula_origem_reposicao_id is null then return new; end if;
  select professor_id, aluno_id into v_origem_professor, v_origem_aluno
    from public.aulas where id = new.aula_origem_reposicao_id for no key update;
  if v_origem_professor is null then
    raise exception 'aula_origem_reposicao_id inválido: aula de origem não encontrada' using errcode = 'LT002';
  end if;
  if v_origem_professor <> new.professor_id then
    raise exception 'aulas: aula de reposição e aula de origem precisam pertencer ao mesmo personal' using errcode = 'LT002';
  end if;
  if v_origem_aluno <> new.aluno_id then
    raise exception 'aulas: aula de reposição e aula de origem precisam pertencer ao mesmo aluno' using errcode = 'LT002';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validar_integridade_reposicao_origem()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if (new.professor_id is distinct from old.professor_id) or (new.aluno_id is distinct from old.aluno_id) then
    if exists (select 1 from public.aulas where aula_origem_reposicao_id = old.id) then
      raise exception 'aulas: não é possível alterar professor/aluno de uma aula que já possui reposição(ões) vinculada(s) — desvincule as reposições primeiro' using errcode = 'LT003';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validar_integridade_solicitacao()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_aula_professor uuid; v_aula_aluno uuid; v_aluno_professor uuid;
begin
  select professor_id, aluno_id into v_aula_professor, v_aula_aluno
    from public.aulas where id = new.aula_original_id;
  if v_aula_professor is null then
    raise exception 'aula_original_id inválido: aula não encontrada' using errcode = 'LT001';
  end if;
  select professor_id into v_aluno_professor from public.alunos where id = new.aluno_id;
  if v_aluno_professor is null then
    raise exception 'aluno_id inválido: aluno não encontrado' using errcode = 'LT001';
  end if;
  if v_aula_professor <> new.professor_id or v_aluno_professor <> new.professor_id then
    raise exception 'solicitacoes_aluno: aula, aluno e professor precisam pertencer ao mesmo personal' using errcode = 'LT001';
  end if;
  if v_aula_aluno <> new.aluno_id then
    raise exception 'solicitacoes_aluno: a aula informada não pertence ao aluno informado' using errcode = 'LT001';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.proteger_metrica_catalogo()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
begin
  if NEW.metrica_codigo is distinct from OLD.metrica_codigo
     or NEW.professor_id is distinct from OLD.professor_id
     or NEW.unidade_padrao is distinct from OLD.unidade_padrao then
    raise exception 'Código, dono e unidade de uma métrica já criada são imutáveis — crie uma nova métrica em vez de alterar estes campos' using errcode = 'LT120';
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validar_avaliacao_fisica()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare v_aula record;
begin
  if not exists (select 1 from public.alunos a where a.id = NEW.aluno_id and a.professor_id = NEW.professor_id) then
    raise exception 'Aluno não pertence a este professor' using errcode = 'LT113';
  end if;
  if NEW.aula_id is not null then
    select * into v_aula from public.aulas where id = NEW.aula_id;
    if not found then raise exception 'Aula não encontrada ou sem permissão' using errcode = 'LT110'; end if;
    if v_aula.professor_id <> NEW.professor_id then raise exception 'Aula pertence a outro professor' using errcode = 'LT111'; end if;
    if v_aula.aluno_id <> NEW.aluno_id then raise exception 'Aula não pertence a este aluno' using errcode = 'LT112'; end if;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validar_item_avaliacao_fisica()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare v_cat public.metricas_catalogo; v_aval public.avaliacoes_fisicas;
begin
  select * into v_cat from public.metricas_catalogo where id = NEW.metrica_id;
  if not found then raise exception 'Métrica não encontrada ou sem permissão' using errcode = 'LT101'; end if;
  if not v_cat.ativo then raise exception 'Métrica "%" está inativa e não pode ser usada', v_cat.nome_exibicao using errcode = 'LT102'; end if;
  select * into v_aval from public.avaliacoes_fisicas where id = NEW.avaliacao_id;
  if not found then raise exception 'Avaliação não encontrada ou sem permissão' using errcode = 'LT103'; end if;
  if v_cat.professor_id is not null and v_cat.professor_id <> v_aval.professor_id then
    raise exception 'Métrica "%" não pertence a este professor' , v_cat.nome_exibicao using errcode = 'LT104';
  end if;
  if NEW.unidade is distinct from v_cat.unidade_padrao then
    raise exception 'Unidade "%" incompatível com a métrica "%" (esperado "%")', NEW.unidade, v_cat.nome_exibicao, v_cat.unidade_padrao using errcode = 'LT105';
  end if;
  if v_cat.valor_min is not null and NEW.valor < v_cat.valor_min then
    raise exception 'Valor % está abaixo do mínimo plausível (%) para "%"', NEW.valor, v_cat.valor_min, v_cat.nome_exibicao using errcode = 'LT106';
  end if;
  if v_cat.valor_max is not null and NEW.valor > v_cat.valor_max then
    raise exception 'Valor % está acima do máximo plausível (%) para "%"', NEW.valor, v_cat.valor_max, v_cat.nome_exibicao using errcode = 'LT107';
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_historico_avaliacao_fisica()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_operacao text;
begin
  if OLD.excluida_em is null and NEW.excluida_em is not null then v_operacao := 'soft_delete';
  elsif OLD.excluida_em is not null and NEW.excluida_em is null then v_operacao := 'restore';
  else v_operacao := 'update_cabecalho';
  end if;
  insert into public.avaliacoes_fisicas_historico (avaliacao_id, alterado_por, operacao, dados_anteriores, dados_novos)
  values (NEW.id, auth.uid(), v_operacao, to_jsonb(OLD), to_jsonb(NEW));
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_historico_item_avaliacao_fisica()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if TG_OP = 'INSERT' then
    insert into public.avaliacoes_fisicas_historico (avaliacao_id, alterado_por, operacao, dados_novos)
    values (NEW.avaliacao_id, auth.uid(), 'insert_item', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.avaliacoes_fisicas_historico (avaliacao_id, alterado_por, operacao, dados_anteriores, dados_novos)
    values (NEW.avaliacao_id, auth.uid(), 'update_item', to_jsonb(OLD), to_jsonb(NEW));
    return NEW;
  else -- DELETE
    if exists (select 1 from public.avaliacoes_fisicas a where a.id = OLD.avaliacao_id) then
      insert into public.avaliacoes_fisicas_historico (avaliacao_id, alterado_por, operacao, dados_anteriores)
      values (OLD.avaliacao_id, auth.uid(), 'delete_item', to_jsonb(OLD));
    end if;
    return OLD;
  end if;
end;
$function$;

-- TRIGGERS (verbatim de pg_get_triggerdef)
create trigger trg_validar_capacidade_aula before insert or update of data, hora, duracao_min, professor_id, status on public.aulas for each row execute function validar_capacidade_aula();
create trigger trg_validar_integridade_reposicao before insert or update on public.aulas for each row execute function validar_integridade_reposicao();
create trigger trg_validar_integridade_reposicao_origem before update of professor_id, aluno_id on public.aulas for each row execute function validar_integridade_reposicao_origem();
create trigger trg_validar_integridade_solicitacao before insert or update on public.solicitacoes_aluno for each row execute function validar_integridade_solicitacao();
create trigger trg_proteger_metrica_catalogo before update on public.metricas_catalogo for each row execute function proteger_metrica_catalogo();
create trigger trg_validar_avaliacao_fisica before insert or update on public.avaliacoes_fisicas for each row execute function validar_avaliacao_fisica();
create trigger trg_historico_avaliacao_fisica after update on public.avaliacoes_fisicas for each row execute function registrar_historico_avaliacao_fisica();
create trigger trg_validar_item_avaliacao_fisica before insert or update on public.avaliacoes_fisicas_itens for each row execute function validar_item_avaliacao_fisica();
create trigger trg_historico_item_avaliacao_fisica after insert or delete or update on public.avaliacoes_fisicas_itens for each row execute function registrar_historico_item_avaliacao_fisica();

-- handle_new_user está ligado em auth.users (schema auth, fora do escopo deste snapshot):
--   create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- NOTA SOBRE GRANTS (não emitidos aqui — recriados pelo Supabase):
--   anon, authenticated, service_role têm ALL em TODAS as tabelas public.
--   Isolamento efetivo = RLS + auth.uid(). service_role faz BYPASS de RLS.
--   EXECUTE das funções de histórico (registrar_historico_*) é REVOGADO de
--   public/anon/authenticated (só disparam via trigger) — ver migração 0007.
-- ============================================================================
-- FIM DO SNAPSHOT — NÃO APLICAR.
-- ============================================================================
