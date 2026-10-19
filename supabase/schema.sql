-- Trainer Flow — schema inicial (multi-tenant: 1 personal trainer = 1 usuário autenticado)
-- Rode isso inteiro no SQL Editor do Supabase, de uma vez, logo após criar o projeto.

-- 1) PERFIL DO PROFESSOR (um registro por usuário autenticado)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  telefone text,
  pix text,
  logo_url text,
  created_at timestamptz default now()
);

-- Cria o perfil automaticamente quando alguém se cadastra
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome) values (new.id, '');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) ALUNOS
create table public.alunos (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  telefone text not null,
  sexo text,
  nascimento date,
  endereco text,
  plano_tipo text not null check (plano_tipo in ('mensal','semanal','avulsa')),
  plano_cobranca text not null check (plano_cobranca in ('fixa','por_aula')),
  valor_fixo numeric(10,2) default 0,
  valor_aula numeric(10,2) default 0,
  recorrencia_horarios jsonb default '{}'::jsonb, -- ex: {"1": "07:00", "3": "07:00", "5": "08:00"}
  ativo boolean default true,
  created_at timestamptz default now()
);

-- 3) AULAS
create table public.aulas (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  data date not null,
  hora time not null,
  status text not null default 'agendada' check (status in ('agendada','confirmada','concluida','cancelada','remarcada')),
  remarcada_para_id uuid references public.aulas(id),
  faturada boolean default false,
  origem text default 'manual' check (origem in ('manual','recorrencia')),
  created_at timestamptz default now()
);

-- 4) PAGAMENTOS
create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  valor numeric(10,2) not null,
  referencia text,
  periodo_label text,
  status text not null default 'pendente' check (status in ('pendente','pago')),
  chave_referencia text,
  mes_referencia text,
  data_vencimento date,
  data_pagamento date,
  aula_ids uuid[] default '{}',
  created_at timestamptz default now()
);

-- 5) ÍNDICES úteis
create index idx_alunos_professor on public.alunos(professor_id);
create index idx_aulas_professor on public.aulas(professor_id);
create index idx_aulas_aluno_data on public.aulas(aluno_id, data);
create index idx_pagamentos_professor on public.pagamentos(professor_id);
create index idx_pagamentos_aluno on public.pagamentos(aluno_id);

-- 6) ROW LEVEL SECURITY — cada professor só enxerga e mexe nos próprios dados
alter table public.profiles enable row level security;
alter table public.alunos enable row level security;
alter table public.aulas enable row level security;
alter table public.pagamentos enable row level security;

create policy "profiles: cada um vê e edita o próprio" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "alunos: isolado por professor" on public.alunos
  for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);

create policy "aulas: isolado por professor" on public.aulas
  for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);

create policy "pagamentos: isolado por professor" on public.pagamentos
  for all using (auth.uid() = professor_id) with check (auth.uid() = professor_id);

-- 7) STORAGE do logo do professor (bucket público para exibir no recibo/portal)
insert into storage.buckets (id, name, public) values ('logos', 'logos', true);

create policy "logos: leitura pública" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos: cada professor sobe só o próprio arquivo" on storage.objects
  for insert with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "logos: cada professor atualiza só o próprio arquivo" on storage.objects
  for update using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
