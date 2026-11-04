-- ============================================================================
-- LT360 — REVERSÃO da migração 0010 (RPCs de cancelamento)
--
-- ⚠️ NÃO APLICAR sem autorização. Seguro em qualquer cenário: a 0010 só cria
--    FUNÇÕES, 1 TRIGGER (de validação) e 1 ÍNDICE — não guarda dados. Remover
--    estes objetos NÃO apaga nenhum cancelamento/contestação já gravado (esses
--    vivem nas tabelas da 0009). Reverter a 0010 apenas desliga as RPCs; para
--    reverter a estrutura, use a 0009_..._DOWN.sql (que é sensível a dados).
-- ============================================================================

begin;

drop function if exists public.responder_contestacao(uuid, text);
drop function if exists public.abrir_contestacao(uuid, text);
drop function if exists public.registrar_resolucao_diferenca(uuid, text, text);
drop function if exists public.registrar_cancelamento_personal(uuid, text, numeric, text, text, boolean, text, timestamptz, text);
drop function if exists public.decidir_solicitacao_cancelamento(uuid, boolean, numeric, text, text, timestamptz);
drop function if exists public.abrir_cancelamento(uuid, text, boolean, text, timestamptz);
drop function if exists public.configurar_politica(boolean, boolean, jsonb);

drop function if exists public._cancel_aplicar_financeiro(public.aulas, public.alunos, numeric);

drop trigger if exists trg_validar_integridade_solicitacao_ativa on public.solicitacoes;
drop function if exists public.validar_integridade_solicitacao_ativa();

drop trigger if exists trg_validar_politica_cancelamento on public.politicas_cancelamento;
drop function if exists public.trg_validar_politica_cancelamento();
drop function if exists public.percentual_sugerido_cancelamento(jsonb, numeric);
drop function if exists public.validar_faixas_cancelamento(jsonb);

drop index if exists public.idx_cancelamento_ativo_por_aula;

commit;
