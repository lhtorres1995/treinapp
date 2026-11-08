-- ============================================================================
-- LT360 — Políticas de cancelamento (ETAPA 1 / estruturas)
--
-- ✅ STATUS: APLICADA em produção (projeto trainer-flow) em 2026-11-04, com
--    autorização explícita do usuário, via Supabase MCP apply_migration
--    (name "0009_politicas_cancelamento"). Validada antes em Docker (pgTAP
--    40/40). Mantida versionada como fonte/referência. Não reaplicar.
--
-- Escopo desta migração (apenas ESTRUTURA — sem lógica/RPC/trigger):
--   * public.politicas_cancelamento   — política individual por personal.
--   * public.cancelamentos            — registro/decisão de cancelamento.
--   * public.contestacoes             — contestação do aluno sobre um cancel.
--   * public.solicitacoes (+colunas)  — aviso externo + índice de unicidade.
--   * RLS de todas as novas tabelas.
--
-- O que NÃO entra aqui (vai na ETAPA 2 — migração 0010):
--   * RPCs SECURITY DEFINER que gravam decisões (registrar_cancelamento_*,
--     decidir_solicitacao_cancelamento, registrar_resolucao_diferenca,
--     abrir_contestacao/responder_contestacao, configurar_politica).
--   * Trigger de validação de continuidade das faixas (sem lacuna/sobreposição).
--   * Gravação em public.auditoria (modelo documentado abaixo, implementado lá).
--
-- Base verificada no banco real em 2026-11-03 (ver baseline/schema_snapshot_
-- 2026-11-03.sql e ../../../docs/PLANO-POLITICAS-CANCELAMENTO-V2-CONSOLIDADO.md).
--
-- ----------------------------------------------------------------------------
-- DECISÃO DE ON DELETE (§2.4 do briefing) — EXPLÍCITA, NÃO SILENCIOSA:
--   As FKs abaixo ESPELHAM o padrão já vigente no banco, para NÃO quebrar o
--   fluxo atual de exclusão definitiva (edge function excluir-aluno) e NÃO
--   introduzir uma estratégia de retenção nova:
--     - para alunos(id)  -> ON DELETE CASCADE  (igual a aulas/pagamentos/etc.)
--     - para aulas(id)   -> ON DELETE SET NULL (igual a solicitacoes/avaliacoes)
--     - para profiles(id)-> ON DELETE CASCADE
--     - para pagamentos  -> ON DELETE SET NULL (preserva o registro do cancel.)
--     - contestacoes->cancelamentos -> ON DELETE CASCADE (interno)
--   CONSEQUÊNCIA: ao excluir definitivamente um aluno, os cancelamentos e
--   contestações dele são APAGADOS junto (comportamento atual = sem retenção).
--   ALTERNATIVA PENDENTE DE DECISÃO (retenção/privacidade — item 1.8/9 do V2):
--     reter registros anonimizados (trocar CASCADE por SET NULL + anonimizar
--     aluno_id/textos) para fins fiscais/auditoria. Isso é uma mudança maior,
--     exige decisão de negócio + jurídica e seria uma migração separada que
--     também reveria a excluir-aluno. NÃO escolhida aqui.
--   ⚠️ Nenhuma FK usa RESTRICT/NO ACTION contra alunos/aulas — isso QUEBRARIA a
--      exclusão atual. Nenhum trigger AFTER DELETE é criado aqui (lição da
--      0008: trigger que grava em tabela com FK para o pai apagado na cascata
--      aborta a exclusão). Triggers de auditoria da ETAPA 2 terão esse cuidado.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) POLÍTICA INDIVIDUAL POR PERSONAL
--    1 linha por personal. `faixas` = array jsonb de intervalos de antecedência
--    [de_horas, ate_horas) -> percentual. Ex. das decisões aprovadas (1.3):
--      [{"de_horas":24,"ate_horas":null,"percentual":0},
--       {"de_horas":12,"ate_horas":24,"percentual":50},
--       {"de_horas":0, "ate_horas":12,"percentual":100}]
--    Validação de continuidade (sem lacuna/sobreposição, limites exatos) será
--    um trigger na ETAPA 2; aqui só garantimos que é um array jsonb.
--    ESCRITA: sem policy de INSERT/UPDATE/DELETE -> só via RPC configurar_politica
--    (ETAPA 2), que valida e audita. Leitura: personal (dono) e aluno vinculado.
-- ----------------------------------------------------------------------------
create table public.politicas_cancelamento (
  professor_id uuid primary key references public.profiles(id) on delete cascade,
  ativo boolean not null default false,
  exige_aprovacao_aluno boolean not null default true,
  faixas jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now(),
  constraint politicas_cancelamento_faixas_array check (jsonb_typeof(faixas) = 'array')
);

alter table public.politicas_cancelamento enable row level security;

create policy "politica: personal lê a própria"
  on public.politicas_cancelamento for select
  using (auth.uid() = professor_id);

create policy "politica: aluno lê a do seu personal"
  on public.politicas_cancelamento for select
  using (exists (
    select 1 from public.alunos a
    where a.professor_id = politicas_cancelamento.professor_id
      and a.auth_user_id = auth.uid()
  ));
-- (sem policy de escrita: INSERT/UPDATE/DELETE negados a authenticated/anon;
--  gravação só pela RPC SECURITY DEFINER configurar_politica — ETAPA 2.)

-- ----------------------------------------------------------------------------
-- 2) CANCELAMENTOS — o registro/decisão (uma linha por cancelamento efetivado
--    ou decidido). Criado SEMPRE por RPC (ETAPA 2); sem policy de escrita aqui
--    => "nenhum usuário altera diretamente decisões financeiras" (§3).
--    Leitura: personal (dono) e o próprio aluno (requisitos 1.1/1.2/1.7).
-- ----------------------------------------------------------------------------
create table public.cancelamentos (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  aula_id uuid references public.aulas(id) on delete set null,       -- nullable p/ SET NULL; RPC sempre preenche
  solicitacao_id uuid references public.solicitacoes(id) on delete set null,

  iniciado_por text not null,              -- 'aluno' | 'personal'
  origem_comunicacao text not null,        -- 'portal'|'whatsapp'|'telefone'|'presencial'|'personal'
  motivo text,

  -- Horários (§1.4 do plano original): distingue declarado x servidor x considerado
  aviso_externo boolean not null default false,
  aviso_canal text,
  aviso_em timestamptz,                     -- DECLARADO (não verificado)
  aula_data_hora_original timestamptz not null,
  enviado_em timestamptz,                   -- servidor (quando originado no portal)
  decidido_em timestamptz,
  efetivado_em timestamptz,
  horario_considerado timestamptz not null,
  horario_considerado_origem text not null, -- 'envio_portal' | 'aviso_externo' | 'registro_personal'
  antecedencia_horas numeric not null,

  -- Política e percentuais (§1.10: snapshot imutável da política aplicada)
  politica_snapshot jsonb not null,
  percentual_sugerido numeric,
  percentual_aplicado numeric not null,
  justificativa_excecao text,

  -- Financeiro por aula (§1.7). Em mensalidade fixa (§1.5) fica só registro:
  -- valor_devido pode ser preenchido como histórico e pagamento_id fica null.
  valor_referencia numeric,
  valor_devido numeric,

  -- Aula já paga (§1.6): diferença e resolução MANUAL (puro registro, sem
  -- automação financeira — "reembolso"/"crédito" aqui são rótulos, não ações).
  valor_pago_original numeric,
  diferenca numeric,
  resolucao_tipo text,                      -- 'reembolso'|'credito_futuro'|'outro'|'nenhuma'
  resolucao_obs text,
  resolvido_em timestamptz,
  resolvido_por uuid references public.profiles(id) on delete set null,

  pagamento_id uuid references public.pagamentos(id) on delete set null,
  status text not null default 'efetivado', -- 'aprovado'|'recusado'|'efetivado'
  decidido_por uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint cancelamentos_iniciado_por_check check (iniciado_por = any (array['aluno','personal'])),
  constraint cancelamentos_origem_check check (origem_comunicacao = any (array['portal','whatsapp','telefone','presencial','personal'])),
  constraint cancelamentos_hc_origem_check check (horario_considerado_origem = any (array['envio_portal','aviso_externo','registro_personal'])),
  constraint cancelamentos_status_check check (status = any (array['aprovado','recusado','efetivado'])),
  constraint cancelamentos_resolucao_check check (resolucao_tipo is null or resolucao_tipo = any (array['reembolso','credito_futuro','outro','nenhuma'])),
  constraint cancelamentos_pct_sugerido_check check (percentual_sugerido is null or (percentual_sugerido >= 0 and percentual_sugerido <= 100)),
  constraint cancelamentos_pct_aplicado_check check (percentual_aplicado >= 0 and percentual_aplicado <= 100),
  constraint cancelamentos_antecedencia_check check (antecedencia_horas >= 0),
  -- coerência aviso externo: se declarou aviso externo, exige canal e momento
  constraint cancelamentos_aviso_externo_coerente check (aviso_externo = false or (aviso_canal is not null and aviso_em is not null))
);

create index idx_cancelamentos_professor on public.cancelamentos (professor_id, created_at desc);
create index idx_cancelamentos_aluno on public.cancelamentos (aluno_id);
create index idx_cancelamentos_aula on public.cancelamentos (aula_id);
create index idx_cancelamentos_solicitacao on public.cancelamentos (solicitacao_id) where (solicitacao_id is not null);

alter table public.cancelamentos enable row level security;

create policy "cancelamentos: personal lê os próprios"
  on public.cancelamentos for select
  using (auth.uid() = professor_id);

create policy "cancelamentos: aluno lê os próprios"
  on public.cancelamentos for select
  using (exists (
    select 1 from public.alunos a
    where a.id = cancelamentos.aluno_id and a.auth_user_id = auth.uid()
  ));
-- (sem policy de INSERT/UPDATE/DELETE: toda escrita vem das RPCs da ETAPA 2.)

-- ----------------------------------------------------------------------------
-- 3) CONTESTAÇÕES (§1.9) — aluno abre; personal responde. Nunca reativa aula
--    nem altera valores automaticamente (garantido pela ausência de efeito
--    financeiro aqui + RPCs da ETAPA 2). `ajuste_financeiro_ref` só RASTREIA um
--    eventual ajuste manual, não o executa.
--    Segue o padrão já usado em `solicitacoes`: aluno INSERT/SELECT próprias;
--    personal SELECT/UPDATE próprias. (Abrir/responder também poderá migrar
--    para RPC na ETAPA 2 para padronizar auditoria.)
-- ----------------------------------------------------------------------------
create table public.contestacoes (
  id uuid primary key default gen_random_uuid(),
  cancelamento_id uuid not null references public.cancelamentos(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  motivo text not null,
  status text not null default 'aberta',    -- 'aberta' | 'respondida'
  resposta text,
  ajuste_financeiro_ref uuid references public.pagamentos(id) on delete set null,
  created_at timestamptz not null default now(),
  respondida_em timestamptz,
  constraint contestacoes_status_check check (status = any (array['aberta','respondida']))
);

create index idx_contestacoes_cancelamento on public.contestacoes (cancelamento_id);
create index idx_contestacoes_professor on public.contestacoes (professor_id, status);
create index idx_contestacoes_aluno on public.contestacoes (aluno_id);

alter table public.contestacoes enable row level security;

-- Aluno só cria contestação sobre cancelamento QUE LHE PERTENCE (§3):
create policy "contestacoes: aluno cria sobre o próprio cancelamento"
  on public.contestacoes for insert
  with check (
    exists (
      select 1 from public.alunos a
      where a.id = contestacoes.aluno_id and a.auth_user_id = auth.uid()
    )
    and exists (
      select 1 from public.cancelamentos c
      where c.id = contestacoes.cancelamento_id
        and c.aluno_id = contestacoes.aluno_id
        and c.professor_id = contestacoes.professor_id
    )
  );

create policy "contestacoes: aluno lê as próprias"
  on public.contestacoes for select
  using (exists (
    select 1 from public.alunos a
    where a.id = contestacoes.aluno_id and a.auth_user_id = auth.uid()
  ));

create policy "contestacoes: personal lê as suas"
  on public.contestacoes for select
  using (auth.uid() = professor_id);

create policy "contestacoes: personal responde as suas"
  on public.contestacoes for update
  using (auth.uid() = professor_id)
  with check (auth.uid() = professor_id);

-- ----------------------------------------------------------------------------
-- 4) SOLICITAÇÕES — campos de AVISO EXTERNO + UNICIDADE (§2.2 / §2.3)
--    Colunas nullable e com default => compatíveis com os INSERTs atuais do
--    portal do aluno (remarcar/cancelar) sem quebrar nada.
-- ----------------------------------------------------------------------------
alter table public.solicitacoes
  add column aviso_externo boolean not null default false,
  add column aviso_canal text,
  add column aviso_em timestamptz;

-- Unicidade: no máximo UMA solicitação "em aberto" por aula, impedindo pedidos
-- duplicados/incompatíveis (ex.: remarcar E cancelar a mesma aula ao mesmo
-- tempo). A contraproposta é UPDATE da MESMA linha (não cria 2ª), então não
-- conflita. Reposição usa aulas.aula_origem_reposicao_id (não solicitacoes).
-- Compatibilidade com dados atuais CONFERIDA em 2026-11-03: 0 aulas com >1
-- solicitação aberta. Precedente idêntico já existe em solicitacoes_aluno
-- (idx_solicitacao_ativa_unica).
create unique index idx_solic_aberta_unica_por_aula
  on public.solicitacoes (aula_id)
  where (status in ('em_analise','contraproposta'));

-- ----------------------------------------------------------------------------
-- 5) AUDITORIA (§2.6) — REUTILIZAR public.auditoria (NÃO criar 2ª tabela).
--    Nada é criado aqui. Modelo de registro planejado para a ETAPA 2 (gravação
--    via RPC SECURITY DEFINER, pois `auditoria` não tem policy de escrita):
--      professor_id, ator_id=auth.uid(), ator_papel ('personal'|'aluno'),
--      operacao ∈ { 'politica_alterada','cancelamento_efetivado',
--                   'cancelamento_decidido','diferenca_resolvida',
--                   'contestacao_aberta','contestacao_respondida' },
--      entidade ∈ { 'politica','cancelamento','contestacao' },
--      entidade_id, estado_anterior (jsonb), estado_novo (jsonb inclui % sugerido
--      vs aplicado, snapshot da política, autor). O snapshot da política também
--      fica em cancelamentos.politica_snapshot (imutável — §1.10).
-- ----------------------------------------------------------------------------

commit;

-- ============================================================================
-- FIM DA MIGRAÇÃO 0009 — NÃO APLICADA. Ver 0009_politicas_cancelamento_DOWN.sql
-- para a estratégia de reversão (sensível a dados — não é um simples DROP).
-- ============================================================================
