-- ============================================================================
-- LT360 — Avaliação física (acompanhamento de evolução do aluno)
-- APLICADA ao banco remoto trainer-flow em 2026-11-01, com autorização
-- explícita do usuário nesta sessão, via Supabase MCP (apply_migration,
-- version 20261101175702, name "avaliacoes_fisicas"). Mantida versionada como
-- fonte e referência de revisão. Não reaplicar.
-- ============================================================================
--
-- O que esta migração cria:
--   1) public.metricas_catalogo      — catálogo de métricas (padrão + custom
--                                       por professor), com unidade e faixa
--                                       plausível fixas por métrica.
--   2) public.avaliacoes_fisicas     — cabeçalho de uma avaliação (aluno,
--                                       data, aula opcional, observações).
--   3) public.avaliacoes_fisicas_itens — valores lançados nessa avaliação,
--                                       um por métrica do catálogo.
--   4) public.avaliacoes_fisicas_historico — snapshot de toda alteração
--                                       relevante no cabeçalho e nos itens.
--   5) Triggers de validação e de histórico; políticas RLS.
--
-- Decisões de arquitetura (consistentes com as migrações 0004/0005 já
-- aplicadas neste projeto):
--
--   * SECURITY INVOKER nas triggers de VALIDAÇÃO (mesmo padrão de
--     validar_capacidade_aula): elas só precisam ver dados que a própria
--     RLS do professor que está escrevendo já deixaria visíveis, então não
--     há razão para elevar privilégio.
--
--   * SECURITY DEFINER só nas triggers de HISTÓRICO, com search_path fixo
--     (set search_path = '' e tudo qualificado com public.) — aprendendo com
--     o risco já documentado para handle_new_user. A elevação aqui é
--     deliberada e mínima: o objetivo é justamente que quem está escrevendo
--     NÃO consiga evitar o registro do histórico (nenhuma policy de
--     INSERT/UPDATE/DELETE é concedida a `authenticated` em
--     avaliacoes_fisicas_historico — só o SELECT das próprias, para o
--     professor). Mesmo espírito já usado em `auditoria`, mas numa tabela
--     dedicada a esta feature (decisão explícita: não reaproveitar
--     `auditoria`, cujo mecanismo de escrita ainda é uma decisão
--     arquitetural maior e pendente, documentada em ARQUITETURA-BANCO.md).
--
--   * Identificador real de métrica = metrica_id (uuid, FK), não o texto
--     livre. O código textual (`metrica_codigo`) existe só para exibição/
--     normalização e tem índice único (por professor, ou globalmente para as
--     métricas padrão) — isso é a "restrição adequada de unicidade" pedida:
--     não é possível criar duas métricas com o mesmo código no mesmo escopo.
--
--   * Métrica já criada é imutável em código/dono/unidade (trigger
--     proteger_metrica_catalogo) — corrigir de verdade significa criar uma
--     nova métrica, nunca reescrever o significado de uma existente que já
--     pode estar referenciada por avaliações antigas.
--
--   * Duplicidade de métrica DENTRO da mesma avaliação é bloqueada por
--     constraint única de banco (unique (avaliacao_id, metrica_id)), não por
--     lógica de trigger — mais simples e não há como contornar.
--
--   * Unidade e faixa plausível são validadas por trigger BEFORE INSERT/
--     UPDATE em avaliacoes_fisicas_itens, contra o catálogo.
--
--   * Integridade cruzada aula↔aluno↔professor: trigger BEFORE INSERT/UPDATE
--     em avaliacoes_fisicas garante que, se aula_id for informado, a aula é
--     do mesmo professor E do mesmo aluno da avaliação; e que o aluno
--     pertence mesmo a este professor. aula_id continua OPCIONAL — uma
--     avaliação pode ser lançada fora de qualquer aula.
--
--   * Exclusão SEMPRE soft-delete no cabeçalho (coluna excluida_em). Não há
--     policy de DELETE para avaliacoes_fisicas — sem policy, o RLS nega o
--     comando por padrão, então não existe caminho de exclusão física pela
--     aplicação. Um item isolado (avaliacoes_fisicas_itens) pode ser
--     corrigido/removido individualmente (ex.: medida lançada por engano),
--     o que fica registrado no histórico (operação delete_item) — isso não é
--     "exclusão definitiva de dados pessoais", é correção operacional de um
--     valor dentro de uma avaliação que continua existindo.
--
--   * Exclusão DEFINITIVA de dados pessoais (ex.: pedido de um aluno/ex-aluno
--     para apagar todo o histórico de avaliações) NÃO é implementada nesta
--     migração e não deve ser contornada via acesso direto ao banco sem
--     revisão própria. Ficaria como uma operação separada, deliberada, fora
--     do RLS de `authenticated` (ex.: função `service_role` ou processo
--     administrativo dedicado), que precisaria decidir explicitamente:
--     (a) se apaga em cascata o histórico também, ou mantém um registro
--     minimamente identificável para fins de auditoria/legal por um tempo
--     determinado; (b) como tratar aula_id/observações que podem conter
--     texto livre; (c) quem pode acionar essa exclusão e com qual aprovação.
--     Esta migração deixa a FK de avaliacoes_fisicas_historico com
--     `on delete cascade` a partir de avaliacoes_fisicas só para não deixar
--     lixo órfão caso essa rotina futura de exclusão definitiva venha a
--     apagar a linha de cabeçalho — não é, por si só, a rotina de exclusão.
-- ============================================================================

-- 1) CATÁLOGO DE MÉTRICAS ----------------------------------------------------
create table public.metricas_catalogo (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references public.profiles(id) on delete cascade, -- null = métrica padrão do sistema
  metrica_codigo text not null check (metrica_codigo ~ '^[a-z0-9_]+$'),
  nome_exibicao text not null,
  categoria text not null check (categoria in ('peso_altura','perimetro','bioimpedancia','custom')),
  unidade_padrao text not null,
  valor_min numeric,
  valor_max numeric,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint metricas_catalogo_faixa_valida check (valor_min is null or valor_max is null or valor_min < valor_max)
);

-- Unicidade real do identificador: mesmo código não pode existir duas vezes
-- no mesmo escopo (globalmente entre as métricas padrão, ou dentro do
-- catálogo custom de um mesmo professor).
create unique index metricas_catalogo_codigo_unq on public.metricas_catalogo (
  coalesce(professor_id, '00000000-0000-0000-0000-000000000000'::uuid),
  metrica_codigo
);

create index idx_metricas_catalogo_professor on public.metricas_catalogo(professor_id);

create or replace function public.proteger_metrica_catalogo()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if NEW.metrica_codigo is distinct from OLD.metrica_codigo
     or NEW.professor_id is distinct from OLD.professor_id
     or NEW.unidade_padrao is distinct from OLD.unidade_padrao then
    raise exception 'Código, dono e unidade de uma métrica já criada são imutáveis — crie uma nova métrica em vez de alterar estes campos'
      using errcode = 'LT120';
  end if;
  return NEW;
end;
$$;

create trigger trg_proteger_metrica_catalogo
  before update on public.metricas_catalogo
  for each row execute function public.proteger_metrica_catalogo();

-- Seed das métricas padrão do sistema (professor_id null = visível a todos).
insert into public.metricas_catalogo (metrica_codigo, nome_exibicao, categoria, unidade_padrao, valor_min, valor_max) values
  ('peso', 'Peso', 'peso_altura', 'kg', 20, 400),
  ('altura', 'Altura', 'peso_altura', 'cm', 50, 250),
  ('peitoral', 'Peitoral', 'perimetro', 'cm', 40, 200),
  ('cintura_escapular', 'Cintura escapular', 'perimetro', 'cm', 40, 200),
  ('abdomen', 'Abdômen', 'perimetro', 'cm', 40, 200),
  ('quadril', 'Quadril', 'perimetro', 'cm', 40, 200),
  ('coxa_direita', 'Coxa direita', 'perimetro', 'cm', 20, 120),
  ('coxa_esquerda', 'Coxa esquerda', 'perimetro', 'cm', 20, 120),
  ('panturrilha_direita', 'Panturrilha direita', 'perimetro', 'cm', 15, 80),
  ('panturrilha_esquerda', 'Panturrilha esquerda', 'perimetro', 'cm', 15, 80),
  ('braco_direito', 'Braço direito', 'perimetro', 'cm', 10, 80),
  ('braco_esquerdo', 'Braço esquerdo', 'perimetro', 'cm', 10, 80),
  ('percentual_gordura_corporal', 'Percentual de gordura corporal', 'bioimpedancia', '%', 2, 70);

-- 2) CABEÇALHO DA AVALIAÇÃO ---------------------------------------------------
create table public.avaliacoes_fisicas (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  aula_id uuid references public.aulas(id) on delete set null, -- opcional: avaliação pode ser fora de aula
  data_avaliacao date not null,
  observacoes text,
  excluida_em timestamptz, -- soft delete; null = ativa
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_avaliacoes_fisicas_professor on public.avaliacoes_fisicas(professor_id);
create index idx_avaliacoes_fisicas_aluno_data on public.avaliacoes_fisicas(aluno_id, data_avaliacao);

create or replace function public.validar_avaliacao_fisica()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aula record;
begin
  -- Integridade: o aluno referenciado precisa mesmo pertencer a este professor.
  if not exists (
    select 1 from public.alunos a
    where a.id = NEW.aluno_id and a.professor_id = NEW.professor_id
  ) then
    raise exception 'Aluno não pertence a este professor' using errcode = 'LT113';
  end if;

  -- Integridade cruzada com a aula, quando informada (aula_id é opcional).
  if NEW.aula_id is not null then
    select * into v_aula from public.aulas where id = NEW.aula_id;
    if not found then
      raise exception 'Aula não encontrada ou sem permissão' using errcode = 'LT110';
    end if;
    if v_aula.professor_id <> NEW.professor_id then
      raise exception 'Aula pertence a outro professor' using errcode = 'LT111';
    end if;
    if v_aula.aluno_id <> NEW.aluno_id then
      raise exception 'Aula não pertence a este aluno' using errcode = 'LT112';
    end if;
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

create trigger trg_validar_avaliacao_fisica
  before insert or update on public.avaliacoes_fisicas
  for each row execute function public.validar_avaliacao_fisica();

-- 3) ITENS DA AVALIAÇÃO -------------------------------------------------------
create table public.avaliacoes_fisicas_itens (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes_fisicas(id) on delete cascade,
  metrica_id uuid not null references public.metricas_catalogo(id),
  valor numeric not null,
  unidade text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (avaliacao_id, metrica_id) -- impede duplicidade da mesma métrica na mesma avaliação
);

create index idx_avaliacoes_fisicas_itens_avaliacao on public.avaliacoes_fisicas_itens(avaliacao_id);

create or replace function public.validar_item_avaliacao_fisica()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cat public.metricas_catalogo;
  v_aval public.avaliacoes_fisicas;
begin
  select * into v_cat from public.metricas_catalogo where id = NEW.metrica_id;
  if not found then
    raise exception 'Métrica não encontrada ou sem permissão' using errcode = 'LT101';
  end if;
  if not v_cat.ativo then
    raise exception 'Métrica "%" está inativa e não pode ser usada', v_cat.nome_exibicao using errcode = 'LT102';
  end if;

  select * into v_aval from public.avaliacoes_fisicas where id = NEW.avaliacao_id;
  if not found then
    raise exception 'Avaliação não encontrada ou sem permissão' using errcode = 'LT103';
  end if;

  -- Métrica custom só pode ser usada pelo professor que a criou.
  if v_cat.professor_id is not null and v_cat.professor_id <> v_aval.professor_id then
    raise exception 'Métrica "%" não pertence a este professor' , v_cat.nome_exibicao using errcode = 'LT104';
  end if;

  if NEW.unidade is distinct from v_cat.unidade_padrao then
    raise exception 'Unidade "%" incompatível com a métrica "%" (esperado "%")', NEW.unidade, v_cat.nome_exibicao, v_cat.unidade_padrao
      using errcode = 'LT105';
  end if;

  if v_cat.valor_min is not null and NEW.valor < v_cat.valor_min then
    raise exception 'Valor % está abaixo do mínimo plausível (%) para "%"', NEW.valor, v_cat.valor_min, v_cat.nome_exibicao
      using errcode = 'LT106';
  end if;
  if v_cat.valor_max is not null and NEW.valor > v_cat.valor_max then
    raise exception 'Valor % está acima do máximo plausível (%) para "%"', NEW.valor, v_cat.valor_max, v_cat.nome_exibicao
      using errcode = 'LT107';
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

create trigger trg_validar_item_avaliacao_fisica
  before insert or update on public.avaliacoes_fisicas_itens
  for each row execute function public.validar_item_avaliacao_fisica();

-- 4) HISTÓRICO DE ALTERAÇÕES --------------------------------------------------
create table public.avaliacoes_fisicas_historico (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes_fisicas(id) on delete cascade,
  alterado_por uuid not null references public.profiles(id),
  alterado_em timestamptz not null default now(),
  operacao text not null check (operacao in ('update_cabecalho','soft_delete','restore','insert_item','update_item','delete_item')),
  dados_anteriores jsonb,
  dados_novos jsonb
);

create index idx_avaliacoes_fisicas_historico_avaliacao on public.avaliacoes_fisicas_historico(avaliacao_id);

create or replace function public.registrar_historico_avaliacao_fisica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operacao text;
begin
  if OLD.excluida_em is null and NEW.excluida_em is not null then
    v_operacao := 'soft_delete';
  elsif OLD.excluida_em is not null and NEW.excluida_em is null then
    v_operacao := 'restore';
  else
    v_operacao := 'update_cabecalho';
  end if;

  insert into public.avaliacoes_fisicas_historico (avaliacao_id, alterado_por, operacao, dados_anteriores, dados_novos)
  values (NEW.id, auth.uid(), v_operacao, to_jsonb(OLD), to_jsonb(NEW));

  return NEW;
end;
$$;

create trigger trg_historico_avaliacao_fisica
  after update on public.avaliacoes_fisicas
  for each row execute function public.registrar_historico_avaliacao_fisica();

create or replace function public.registrar_historico_item_avaliacao_fisica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
    insert into public.avaliacoes_fisicas_historico (avaliacao_id, alterado_por, operacao, dados_anteriores)
    values (OLD.avaliacao_id, auth.uid(), 'delete_item', to_jsonb(OLD));
    return OLD;
  end if;
end;
$$;

create trigger trg_historico_item_avaliacao_fisica
  after insert or update or delete on public.avaliacoes_fisicas_itens
  for each row execute function public.registrar_historico_item_avaliacao_fisica();

-- Nenhuma função de histórico aceita chamada direta fora do contexto de
-- trigger — mesma defesa em profundidade já usada nas migrações 0004/0005.
revoke execute on function public.registrar_historico_avaliacao_fisica() from public, anon, authenticated;
revoke execute on function public.registrar_historico_item_avaliacao_fisica() from public, anon, authenticated;

-- 5) ROW LEVEL SECURITY --------------------------------------------------------
alter table public.metricas_catalogo enable row level security;
alter table public.avaliacoes_fisicas enable row level security;
alter table public.avaliacoes_fisicas_itens enable row level security;
alter table public.avaliacoes_fisicas_historico enable row level security;

-- metricas_catalogo: todos autenticados leem as padrão (professor_id null);
-- professor lê/cria/atualiza só as próprias custom; aluno lê as custom do seu
-- próprio professor (para poder exibir nome/unidade dos itens que vê).
create policy "metricas_catalogo: leitura padrão + próprias + do seu professor"
  on public.metricas_catalogo for select
  using (
    professor_id is null
    or professor_id = auth.uid()
    or exists (
      select 1 from public.alunos a
      where a.professor_id = metricas_catalogo.professor_id and a.auth_user_id = auth.uid()
    )
  );

create policy "metricas_catalogo: professor cria métricas custom próprias"
  on public.metricas_catalogo for insert
  with check (professor_id = auth.uid());

create policy "metricas_catalogo: professor atualiza métricas custom próprias"
  on public.metricas_catalogo for update
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

-- Sem policy de DELETE: métrica já usada não deve ser apagada (pode estar
-- referenciada por avaliações/histórico) — desativar via "ativo = false".

-- avaliacoes_fisicas: isolado por professor (sem DELETE — ver nota de
-- exclusão soft-delete no cabeçalho desta migração); aluno só lê as
-- próprias e só as que não estão soft-deleted.
create policy "avaliacoes_fisicas: professor lê as próprias"
  on public.avaliacoes_fisicas for select
  using (auth.uid() = professor_id);

create policy "avaliacoes_fisicas: professor insere as próprias"
  on public.avaliacoes_fisicas for insert
  with check (auth.uid() = professor_id);

create policy "avaliacoes_fisicas: professor corrige/exclui(soft) as próprias"
  on public.avaliacoes_fisicas for update
  using (auth.uid() = professor_id)
  with check (auth.uid() = professor_id);

create policy "avaliacoes_fisicas: aluno vê as próprias avaliações ativas"
  on public.avaliacoes_fisicas for select
  using (
    excluida_em is null
    and exists (
      select 1 from public.alunos a
      where a.id = avaliacoes_fisicas.aluno_id and a.auth_user_id = auth.uid()
    )
  );

-- avaliacoes_fisicas_itens: isolado por professor via avaliação dona (CRUD
-- completo, incluindo DELETE de um item individual — correção operacional,
-- preservada no histórico); aluno só lê itens de avaliações próprias ativas.
create policy "avaliacoes_fisicas_itens: professor lê itens das próprias avaliações"
  on public.avaliacoes_fisicas_itens for select
  using (exists (
    select 1 from public.avaliacoes_fisicas af
    where af.id = avaliacoes_fisicas_itens.avaliacao_id and af.professor_id = auth.uid()
  ));

create policy "avaliacoes_fisicas_itens: professor insere itens nas próprias avaliações"
  on public.avaliacoes_fisicas_itens for insert
  with check (exists (
    select 1 from public.avaliacoes_fisicas af
    where af.id = avaliacoes_fisicas_itens.avaliacao_id and af.professor_id = auth.uid()
  ));

create policy "avaliacoes_fisicas_itens: professor corrige itens das próprias avaliações"
  on public.avaliacoes_fisicas_itens for update
  using (exists (
    select 1 from public.avaliacoes_fisicas af
    where af.id = avaliacoes_fisicas_itens.avaliacao_id and af.professor_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.avaliacoes_fisicas af
    where af.id = avaliacoes_fisicas_itens.avaliacao_id and af.professor_id = auth.uid()
  ));

create policy "avaliacoes_fisicas_itens: professor remove itens das próprias avaliações"
  on public.avaliacoes_fisicas_itens for delete
  using (exists (
    select 1 from public.avaliacoes_fisicas af
    where af.id = avaliacoes_fisicas_itens.avaliacao_id and af.professor_id = auth.uid()
  ));

create policy "avaliacoes_fisicas_itens: aluno vê itens das próprias avaliações ativas"
  on public.avaliacoes_fisicas_itens for select
  using (exists (
    select 1 from public.avaliacoes_fisicas af
    join public.alunos a on a.id = af.aluno_id
    where af.id = avaliacoes_fisicas_itens.avaliacao_id
      and a.auth_user_id = auth.uid()
      and af.excluida_em is null
  ));

-- avaliacoes_fisicas_historico: só o professor dono lê o histórico das
-- próprias avaliações; nenhuma policy de INSERT/UPDATE/DELETE para
-- `authenticated` — só os triggers SECURITY DEFINER acima escrevem aqui,
-- então quem está corrigindo uma avaliação não pode editar ou apagar o
-- próprio rastro.
create policy "avaliacoes_fisicas_historico: professor lê o histórico das próprias avaliações"
  on public.avaliacoes_fisicas_historico for select
  using (exists (
    select 1 from public.avaliacoes_fisicas af
    where af.id = avaliacoes_fisicas_historico.avaliacao_id and af.professor_id = auth.uid()
  ));
