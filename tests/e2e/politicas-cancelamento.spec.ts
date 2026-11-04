// Scaffold Playwright — treinapp (Portal do Personal).
// NÃO EXECUTÁVEL ainda: @playwright/test não instalado e a UI não existe.
// Todos os testes estão em .skip de propósito. Preencher nas ETAPAS 3–7.
//
// @ts-nocheck
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

test.describe('Política de cancelamento (personal)', () => {
  test.skip('configura faixas e vê validação de continuidade', async ({ page }) => {
    // TODO ETAPA 3: Configurações -> Política de cancelamento.
    // Faixas 24h->0%, [12,24)->50%, <12->100%; tentar faixa com lacuna/sobreposição
    // deve ser bloqueada; pré-visualização de exemplos de cobrança.
    await page.goto(BASE);
    expect(true).toBe(true);
  });

  test.skip('registra cancelamento direto com percentual', async () => {
    // TODO ETAPA 4: detalhe da aula -> Registrar cancelamento (origem, aviso, %).
  });

  test.skip('aprova/recusa solicitação do aluno com decisão financeira', async () => {
    // TODO ETAPA 5: Central de solicitações.
  });

  test.skip('aula já paga: mostra diferença e registra resolução', async () => {
    // TODO ETAPA 4/6: valor pago x devido; registrar reembolso/crédito/outro (só registro).
  });

  test.skip('responde contestação sem alterar valor nem reativar aula', async () => {
    // TODO ETAPA 7.
  });
});
