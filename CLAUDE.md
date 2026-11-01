# treinapp — Portal do Personal Trainer

Parte do ecossistema LT360. Ver [`../CLAUDE.md`](../CLAUDE.md) para arquitetura compartilhada com `portal-aluno-personal` e o banco Supabase `trainer-flow`.

## Arquitetura e arquivos principais

- SPA em **JavaScript puro + Vite 5.4** (sem framework, sem TypeScript). `package.json` ainda com o nome antigo `trainer-flow`.
- `index.html` — todas as telas (auth, alunos, agenda, financeiro) em um único arquivo.
- `src/main.js` (~3781 linhas) — toda a lógica: init do Supabase, auth, sync, regras de negócio, render. Não há separação em módulos/componentes.
- `src/styles.css` — estilos.
- `public/` — PWA: `manifest.webmanifest`, `sw.js` (service worker network-first, não cacheia respostas do Supabase).
- `supabase/schema.sql` + `supabase/migrations/` — schema **versionado**, mas **incompleto frente ao banco real** (ver `../docs/ARQUITETURA-BANCO.md`): várias tabelas/RPCs em produção não têm `.sql` correspondente aqui.
- `supabase/functions/enviar-push/` — edge function (Deno), deploy manual, não automatizado.
- `.github/workflows/backup-supabase.yml` — backup diário (`pg_dump`) via GitHub Actions.

## Funcionalidades implementadas

- Auth: login, cadastro, recuperação de senha.
- Alunos: CRUD, planos (mensal/semanal/avulsa), cobrança (fixa/por aula), recorrência de horários, foto.
- Agenda: criação/edição de aulas, detecção de conflito, disponibilidade e bloqueios do personal, remarcação (RPC `remarcar_aula`), check-in por QR (RPC `checkin_por_token`).
- Financeiro: cobrança por período, controle de status de pagamento, recibo em PDF (`html2pdf.js`).
- Avaliação física: catálogo de métricas (peso/altura, perímetros padrão + personalizados, bioimpedância/outras personalizadas), lançamento por aluno (dentro ou fora de aula), histórico com cards expansíveis, gráfico de evolução com seletor de métrica, edição/exclusão (soft delete) e relatório em PDF (mesmo mecanismo `html2pdf.js` do recibo, sem dado financeiro). Detalhe do aluno organizado em abas (Visão geral/Avaliações físicas/Aulas/Financeiro).
- Push notification: envio via edge function `enviar-push` (requer secrets VAPID não presentes no repo).

## Comandos de desenvolvimento

- `npm run dev` — Vite dev server (porta padrão 5173).
- `npm run build` — build de produção.
- `npm run preview` — preview do build.
- **Não há script de teste ou lint configurado.**

## Dependências principais

`@supabase/supabase-js`, `html2pdf.js`, `html5-qrcode`, `vite` (dev).

## Cuidados específicos

- **Agenda/remarcação**: `remarcar_aula` é `SECURITY INVOKER` — depende inteiramente da RLS de `aulas` (`professor_id = auth.uid()`) para isolamento entre personais. Qualquer mudança nessa policy exige revisar essa função.
- **Financeiro/recibos**: lógica de cobrança e geração de PDF está em `main.js`; não há testes automatizados — validar manualmente qualquer alteração em cálculo de valores/períodos.
- **Remarcação via solicitação do aluno**: quando o aluno pede remarcação, o fluxo passa pela tabela `solicitacoes` (não `solicitacoes_aluno` — essa está órfã, ver `../CLAUDE.md`) e termina sendo aplicado aqui via RPC `responder_contraproposta` (chamada pelo aluno, mas que cria a nova `aula` deste lado).
- Migrações `0004`/`0005` no repo têm comentários dizendo "não aplicadas em produção" — **isso está desatualizado**: as tabelas/colunas dessas migrações já existem e estão ativas no banco real (confirmado via inspeção direta, 2026-11).
- **Avaliação física**: migração `0007_avaliacoes_fisicas.sql` aplicada em produção em 2026-11-01 (ver `../docs/ARQUITETURA-BANCO.md`). Métrica de catálogo é imutável após criada (nome/unidade/dono) — corrigir de verdade significa criar uma métrica nova. Métrica de perímetro personalizada entra automaticamente no grupo fixo "Perímetros" do formulário (mesmo tratamento das métricas padrão).
- Não alterar `supabase/schema.sql`/migrações sem antes confirmar o estado real do banco — o repositório não é a fonte de verdade do schema.
