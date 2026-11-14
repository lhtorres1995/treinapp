-- ============================================================================
-- LT360 — Migração 0014: novo modo de cobrança "agendadas"
--
-- ⚠️ NÃO APLICAR sem autorização explícita do usuário nesta sessão. Esta
--    migração altera uma constraint de PRODUÇÃO na tabela `alunos`.
--
-- Contexto: o módulo financeiro passou a oferecer um terceiro modo de cobrança
-- além de 'fixa' e 'por_aula': 'agendadas' (antecipado — o aluno paga no início
-- do mês pelo nº de aulas AGENDADAS no período). O front-end (treinapp) grava
-- esse valor em `alunos.plano_cobranca`, mas a CHECK atual só aceita
-- 'fixa'/'por_aula', então qualquer aluno salvo nesse modo é rejeitado pelo
-- banco até esta migração ser aplicada.
--
-- Efeito: amplia a CHECK `alunos_plano_cobranca_check` para incluir 'agendadas'.
-- Não altera dados existentes. É aditiva e não quebra os modos atuais.
-- ============================================================================

ALTER TABLE public.alunos
  DROP CONSTRAINT IF EXISTS alunos_plano_cobranca_check;

ALTER TABLE public.alunos
  ADD CONSTRAINT alunos_plano_cobranca_check
  CHECK (plano_cobranca = ANY (ARRAY['fixa'::text, 'por_aula'::text, 'agendadas'::text]));
