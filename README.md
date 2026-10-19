# Trainer Flow

Sistema de gestão para personal trainer. Multi-usuário (cada professor vê só os próprios dados, isolados por RLS). Front-end em Vite + JavaScript puro, back-end em Supabase (Postgres + Auth + Storage).

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. As credenciais do Supabase já vêm no `.env`.

## Variáveis de ambiente

Definidas em `.env` (local) e no painel da Vercel (produção):

- `VITE_SUPABASE_URL` — URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` — chave publicável (segura para o front; o RLS protege os dados)

## Banco de dados

O schema completo (tabelas, RLS multi-tenant, bucket de logo) está em `supabase/schema.sql`. Rode o conteúdo inteiro no SQL Editor do Supabase na primeira vez.

Para testar sem confirmação de e-mail: Authentication → Email → desligar "Confirm email".
Em produção: Authentication → URL Configuration → Site URL = URL do deploy.

## Deploy na Vercel

1. Suba o projeto no GitHub.
2. Na Vercel, importe o repositório (framework Vite é detectado automaticamente).
3. Em Settings → Environment Variables, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Deploy.

Build command: `npm run build` · Output: `dist`

## Estrutura

```
index.html            marcação da aplicação
src/main.js           toda a lógica (auth, estado, sincronização com Supabase, render)
src/styles.css        estilos
supabase/schema.sql   schema do banco
```
