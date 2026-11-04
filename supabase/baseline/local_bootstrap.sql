-- ============================================================================
-- LT360 — BOOTSTRAP LOCAL (compat Supabase para Postgres puro em Docker)
--
-- ⚠️ EXCLUSIVO PARA AMBIENTE DE TESTE DESCARTÁVEL. NUNCA aplicar em produção
--    nem em qualquer banco Supabase real — ele FINGE o mínimo do ambiente
--    Supabase (schema auth, auth.uid(), roles) para que a baseline do schema
--    `public` + a 0009 + os testes pgTAP rodem num `docker run postgres:17`.
--
-- Rodar ANTES de schema_snapshot_2026-11-03.sql. Ver docs/BASELINE-RECONCILIACAO.md §4.
-- ============================================================================

-- 1) Roles do Supabase (nologin; o superusuário postgres faz SET ROLE nos testes)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- 2) Schema auth + tabela mínima auth.users (alvo das FKs de profiles/alunos)
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3) auth.uid() / auth.role() lendo o claim JWT simulado (request.jwt.claims)
--    Vazio/ausente => null (contexto "owner"/sem sessão).
create or replace function auth.uid() returns uuid
language sql stable as $$
  select case
    when coalesce(current_setting('request.jwt.claims', true), '') = '' then null
    else nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  end;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select case
    when coalesce(current_setting('request.jwt.claims', true), '') = '' then null
    else current_setting('request.jwt.claims', true)::jsonb ->> 'role'
  end;
$$;

-- 4) Permissões: mimetiza o padrão Supabase (roles enxergam o schema e, por
--    default privileges, ganham ALL nas tabelas criadas depois — baseline/0009).
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;
grant execute on function auth.uid()  to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

-- Tabelas já existentes no schema public (se houver) e as próximas:
grant all on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

-- 5) pgTAP (os testes também tentam criar; aqui garante disponibilidade)
create extension if not exists pgtap;

-- ============================================================================
-- Depois deste arquivo, rodar (ver docs/BASELINE-RECONCILIACAO.md §4):
--   baseline/schema_snapshot_2026-11-03.sql
--   migrations/0009_politicas_cancelamento.sql
--   tests/0009_politicas_cancelamento_test.sql
-- ============================================================================
