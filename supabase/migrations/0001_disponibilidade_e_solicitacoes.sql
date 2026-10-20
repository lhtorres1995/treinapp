-- ============================================================================
-- LT360 — Etapa 1: Preparação da infraestrutura de disponibilidade e
-- solicitações (APENAS SCHEMA — nenhum comportamento novo é ativado)
-- ============================================================================
-- Escopo desta migração:
--   1) Colunas novas em profiles, aulas e alunos (todas opcionais/retrocompatíveis)
--   2) Tabelas novas: disponibilidade_personal, bloqueios_agenda,
--      solicitacoes_aluno, auditoria
--   3) Índices e constraints de integridade
--   4) RLS isolando por personal (auth.uid() = professor_id) — SEM qualquer
--      política de acesso para aluno, porque a autenticação de aluno ainda
--      não existe
--
-- Fora do escopo (propositalmente):
--   - Nenhuma função SECURITY DEFINER de negócio (aprovação de solicitação,
--     geração de cobrança de reposição, etc.) — isso depende de uma revisão
--     dedicada de autenticação/privilégios/search_path/autorização por
--     entidade, ainda não feita.
--   - NÃO modifica a função/trigger public.handle_new_user() nem
--     on_auth_user_created.
--   - NÃO altera dados existentes, NÃO aplica valor padrão obrigatório de
--     duração de aula, NÃO recalcula nem reescreve o histórico.
--   - NÃO cria política de RLS permitindo acesso de aluno.
--
-- Esta migração é ADITIVA: toda alteração em tabela existente é "add column
-- if not exists" com coluna opcional (nullable ou com default inócuo) — o
-- app atual (main.js) continua funcionando sem nenhuma mudança de frontend,
-- porque nenhuma coluna aqui é lida ou escrita pelo app hoje.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) PROFILES — parâmetros de disponibilidade configuráveis por personal
-- ----------------------------------------------------------------------------

-- Quantas aulas o personal pode ter simultaneamente no mesmo horário.
-- Default 1 preserva o comportamento implícito atual (a UI já permite
-- sobreposição visual via lanes, mas não valida capacidade); o valor pode
-- ser aumentado pelo próprio personal quando a regra for ativada no app.
alter table public.profiles
  add column if not exists capacidade_simultanea integer not null default 1
    check (capacidade_simultanea > 0);

-- Antecedência mínima para novas solicitações/alterações, em horas.
-- Valor aprovado: 12h, configurável por personal.
alter table public.profiles
  add column if not exists antecedencia_minima_horas integer not null default 12
    check (antecedencia_minima_horas >= 0);

-- Duração habitual (em minutos) — OPCIONAL, SEM valor padrão obrigatório.
-- Mantida nullable de propósito: perfis existentes continuam válidos sem
-- preenchê-la. Serve apenas como sugestão inicial ao agendar; a duração
-- real de cada aula é definida e congelada em aulas.duracao_min (abaixo).
alter table public.profiles
  add column if not exists duracao_habitual_min integer
    check (duracao_habitual_min is null or duracao_habitual_min > 0);


-- ----------------------------------------------------------------------------
-- 2) AULAS — duração individual congelada + vínculo de reposição
-- ----------------------------------------------------------------------------

-- Duração real desta aula específica, em minutos, definida no momento do
-- agendamento e preservada historicamente (não é recalculada se o personal
-- alterar depois a duração habitual do perfil). NULLABLE: aulas existentes
-- ficam sem duração registrada — isso é esperado e não deve ser preenchido
-- retroativamente por esta migração.
alter table public.aulas
  add column if not exists duracao_min integer
    check (duracao_min is null or duracao_min > 0);

-- Vínculo com a aula ORIGINAL quando esta aula é uma REPOSIÇÃO (aula
-- compensatória) de outra. Deliberadamente um campo novo e distinto de
-- remarcada_para_id: remarcada_para_id aponta da aula antiga para a aula
-- nova quando há remarcação (e marca a antiga como status='remarcada');
-- aula_origem_reposicao_id aponta da aula nova (a reposição) para a aula
-- original que gerou o direito à reposição, sem alterar o status nem o
-- significado de nenhum dos dois campos existentes.
alter table public.aulas
  add column if not exists aula_origem_reposicao_id uuid
    references public.aulas(id);

alter table public.aulas
  drop constraint if exists aulas_reposicao_nao_autorreferente;
alter table public.aulas
  add constraint aulas_reposicao_nao_autorreferente
    check (aula_origem_reposicao_id is null or aula_origem_reposicao_id <> id);

create index if not exists idx_aulas_origem_reposicao
  on public.aulas(aula_origem_reposicao_id)
  where aula_origem_reposicao_id is not null;


-- ----------------------------------------------------------------------------
-- 3) ALUNOS — vínculo futuro, opcional, com usuário autenticado
-- ----------------------------------------------------------------------------

-- Link opcional para um futuro auth.users quando o aluno tiver login próprio
-- (portal do aluno). NULLABLE e sem nenhum trigger associado: o cadastro de
-- aluno continua sendo feito manualmente pelo personal como hoje.
-- Importante: NÃO modificamos public.handle_new_user() nesta etapa — este
-- link não é populado automaticamente por nenhum gatilho.
alter table public.alunos
  add column if not exists auth_user_id uuid
    references auth.users(id) on delete set null;

-- Um mesmo usuário autenticado não deve corresponder a mais de um aluno
-- (quando o link existir). Índice parcial: não afeta linhas com valor nulo.
create unique index if not exists idx_alunos_auth_user_unico
  on public.alunos(auth_user_id)
  where auth_user_id is not null;


-- ----------------------------------------------------------------------------
-- 4) DISPONIBILIDADE_PERSONAL — regras recorrentes de horário disponível
-- ----------------------------------------------------------------------------
-- Múltiplos períodos por dia são suportados por múltiplas linhas (ex.:
-- manhã 06:00–09:00 e noite 18:00–21:00 na mesma segunda-feira = 2 linhas).

create table if not exists public.disponibilidade_personal (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6), -- 0=domingo … 6=sábado
  hora_inicio time not null,
  hora_fim time not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint disponibilidade_horario_valido check (hora_fim > hora_inicio)
);

create index if not exists idx_disponibilidade_professor
  on public.disponibilidade_personal(professor_id, dia_semana);

alter table public.disponibilidade_personal enable row level security;

create policy "disponibilidade: isolado por professor" on public.disponibilidade_personal
  for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);


-- ----------------------------------------------------------------------------
-- 5) BLOQUEIOS_AGENDA — bloqueios pontuais, parciais ou de dia inteiro
-- ----------------------------------------------------------------------------
-- Bloqueio de dia inteiro: hora_inicio e hora_fim nulos, data_fim pode ser
-- igual ou posterior a data_inicio (período de vários dias inteiros).
-- Bloqueio pontual/parcial: hora_inicio e hora_fim preenchidos, restrito a
-- um único dia (data_inicio = data_fim).

create table if not exists public.bloqueios_agenda (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  data_inicio date not null,
  data_fim date not null,
  hora_inicio time,
  hora_fim time,
  motivo text,
  created_at timestamptz not null default now(),
  constraint bloqueio_periodo_valido check (data_fim >= data_inicio),
  constraint bloqueio_horario_valido check (
    (hora_inicio is null and hora_fim is null)
    or (hora_inicio is not null and hora_fim is not null and hora_fim > hora_inicio)
  ),
  constraint bloqueio_parcial_mesmo_dia check (
    (hora_inicio is null and hora_fim is null) or (data_inicio = data_fim)
  )
);

create index if not exists idx_bloqueios_professor_periodo
  on public.bloqueios_agenda(professor_id, data_inicio, data_fim);

alter table public.bloqueios_agenda enable row level security;

create policy "bloqueios: isolado por professor" on public.bloqueios_agenda
  for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);


-- ----------------------------------------------------------------------------
-- 6) SOLICITACOES_ALUNO — central de solicitações (remarcação/cancelamento/
--    reposição), com status independente do status da aula
-- ----------------------------------------------------------------------------

create table if not exists public.solicitacoes_aluno (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  aula_original_id uuid not null references public.aulas(id) on delete cascade,

  tipo text not null check (tipo in ('remarcacao', 'cancelamento', 'reposicao')),
  status text not null default 'pendente'
    check (status in ('pendente', 'proposta_alternativa', 'aprovada', 'rejeitada', 'cancelada_pelo_aluno')),

  -- Proposta original do aluno (quando aplicável ao tipo, ex. remarcação)
  data_proposta date,
  hora_proposta time,
  mensagem_aluno text,

  -- Contraproposta do personal (fluxo "propõe alternativa" do diagnóstico v1/v2)
  data_contraproposta date,
  hora_contraproposta time,
  resposta_personal text,

  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_solicitacoes_professor
  on public.solicitacoes_aluno(professor_id, status);
create index if not exists idx_solicitacoes_aula
  on public.solicitacoes_aluno(aula_original_id);
create index if not exists idx_solicitacoes_aluno_id
  on public.solicitacoes_aluno(aluno_id);

-- Regra aprovada: "uma solicitação ativa por aula" — considerando ativa
-- qualquer status ainda em aberto (pendente ou com contraproposta aguardando
-- decisão do aluno). Status finais (aprovada/rejeitada/cancelada_pelo_aluno)
-- não contam e permitem nova solicitação futura sobre a mesma aula.
create unique index if not exists idx_solicitacao_ativa_unica
  on public.solicitacoes_aluno(aula_original_id)
  where status in ('pendente', 'proposta_alternativa');

-- Integridade: a aula, o aluno e o professor da solicitação precisam
-- pertencer ao mesmo personal, e a aula precisa realmente ser do aluno
-- informado. Trigger simples de validação (SEM security definer, SEM
-- lógica de negócio/aprovação — apenas integridade referencial dentro do
-- próprio contexto de RLS do personal autenticado).
create or replace function public.validar_integridade_solicitacao()
returns trigger as $$
declare
  v_aula_professor uuid;
  v_aula_aluno uuid;
  v_aluno_professor uuid;
begin
  select professor_id, aluno_id into v_aula_professor, v_aula_aluno
    from public.aulas where id = new.aula_original_id;

  if v_aula_professor is null then
    raise exception 'aula_original_id inválido: aula não encontrada';
  end if;

  select professor_id into v_aluno_professor
    from public.alunos where id = new.aluno_id;

  if v_aluno_professor is null then
    raise exception 'aluno_id inválido: aluno não encontrado';
  end if;

  if v_aula_professor <> new.professor_id or v_aluno_professor <> new.professor_id then
    raise exception 'solicitacoes_aluno: aula, aluno e professor precisam pertencer ao mesmo personal';
  end if;

  if v_aula_aluno <> new.aluno_id then
    raise exception 'solicitacoes_aluno: a aula informada não pertence ao aluno informado';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validar_integridade_solicitacao on public.solicitacoes_aluno;
create trigger trg_validar_integridade_solicitacao
  before insert or update on public.solicitacoes_aluno
  for each row execute function public.validar_integridade_solicitacao();

alter table public.solicitacoes_aluno enable row level security;

-- Isolamento por personal apenas. NENHUMA política de aluno é criada nesta
-- etapa — isso depende da revisão de autenticação de aluno, ainda pendente.
create policy "solicitacoes: isolado por professor" on public.solicitacoes_aluno
  for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);


-- ----------------------------------------------------------------------------
-- 7) AUDITORIA — trilha append-only para aulas, solicitações e eventos
--    financeiros relevantes
-- ----------------------------------------------------------------------------

create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  ator_id uuid,
  ator_papel text not null check (ator_papel in ('personal', 'aluno', 'sistema')),
  operacao text not null,
  entidade text not null,
  entidade_id uuid not null,
  estado_anterior jsonb,
  estado_novo jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_auditoria_professor_data
  on public.auditoria(professor_id, created_at desc);
create index if not exists idx_auditoria_entidade
  on public.auditoria(entidade, entidade_id);

alter table public.auditoria enable row level security;

-- Leitura e inserção isoladas por personal. Propositalmente SEM política de
-- update/delete: com RLS habilitado e nenhuma política para esses comandos,
-- nenhum usuário comum (apenas o personal autenticado, não há papel de
-- aluno ainda) consegue alterar ou apagar um registro de auditoria já
-- gravado — a trilha é append-only por construção.
create policy "auditoria: leitura isolada por professor" on public.auditoria
  for select using (auth.uid() = professor_id);

create policy "auditoria: inserção isolada por professor" on public.auditoria
  for insert with check (auth.uid() = professor_id);


-- ============================================================================
-- FIM — nenhuma linha de dados existente é lida, alterada ou apagada por
-- esta migração. Nenhuma política de RLS pré-existente é removida ou
-- substituída. O trigger public.handle_new_user() não é tocado.
-- ============================================================================
