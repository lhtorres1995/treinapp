# Testes E2E (Playwright) — treinapp (Portal do Personal)

> **Scaffold apenas.** Nenhuma interface foi modificada. As dependências do
> Playwright **não** estão instaladas e os specs estão em `.skip` — nada roda
> ainda. Os cenários reais serão escritos junto das ETAPAS 3–7 (UI), quando as
> telas existirem.

## Preparar (quando for implementar a UI)

```bash
cd treinapp
npm i -D @playwright/test
npx playwright install chromium
```

`playwright.config.ts` (nesta pasta, como exemplo) sobe o dev server do Vite
(`npm run dev`, porta 5173) antes dos testes.

## Regras

- **Nunca** rodar contra produção nem com dados reais de alunos. Usar um
  ambiente/projeto Supabase de teste e um personal de teste dedicado.
- Autenticação: criar um usuário de teste (personal) no projeto de teste e
  injetar a sessão, ou logar pela própria tela de login no `beforeAll`.
- Cada teste deve limpar o que criou (ou rodar em projeto descartável).

## Cenários planejados (ETAPA 3+)

- Configuração da política: criar/editar faixas; validação visual de
  continuidade (sem lacuna/sobreposição); pré-visualização de exemplos.
- Registrar cancelamento direto (origem, data/hora do aviso, %, confirmar).
- Central de solicitações: aprovar (com %), recusar (com justificativa),
  exceção com justificativa.
- Aula já paga: ver diferença e registrar resolução (reembolso/crédito/outro).
- Histórico e contestações (responder).
- Regressão: remarcação, conclusão/faturamento e capacidade continuam ok.
