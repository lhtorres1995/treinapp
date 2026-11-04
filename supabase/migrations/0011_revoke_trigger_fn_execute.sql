-- ============================================================================
-- LT360 — Hardening: revogar EXECUTE das funções de trigger (0028/0029)
--
-- ✅ STATUS: APLICADA em produção (trainer-flow) em 2026-11-04, com autorização
--    explícita do usuário, via Supabase MCP apply_migration. Não reaplicar.
--
-- Motivo: a função de trigger `validar_integridade_solicitacao_ativa()` é
-- SECURITY DEFINER e, por padrão, ficou com EXECUTE para anon/authenticated,
-- aparecendo nos advisors 0028/0029. Funções de trigger NÃO devem ser
-- chamáveis via API — chamá-las diretamente por /rest/v1/rpc nem funciona
-- (Postgres recusa "trigger functions can only be called as triggers"), mas é
-- superfície desnecessária. Revogar o EXECUTE resolve o advisor e segue o
-- mesmo padrão já usado nas funções de histórico da migração 0007. O disparo
-- normal pelos triggers continua funcionando (independe do grant).
-- Não altera dados, schema de tabelas, RLS nem comportamento.
-- ============================================================================
revoke all on function public.validar_integridade_solicitacao_ativa() from public, anon, authenticated;
revoke all on function public.trg_validar_politica_cancelamento() from public, anon, authenticated;
