-- ============================================================================
-- LT360 — REVERSÃO da migração 0009 (políticas de cancelamento)
--
-- ⚠️ NÃO APLICAR sem autorização. Reverter NÃO é "só dar DROP": uma vez que
--    existam cancelamentos/contestações reais, apagá-los destrói histórico
--    financeiro e de auditoria. Por isso este script distingue 3 cenários:
--
--   (A) Migração ainda NÃO aplicada  -> nada a fazer.
--   (B) Aplicada, SEM dados          -> DROP seguro (este script executa).
--   (C) Aplicada, COM dados reais     -> este script ABORTA de propósito.
--       Nesse caso NÃO se reverte estrutura; "desliga-se" a funcionalidade
--       sem perder dados (ver seção DESATIVAR SEM PERDER DADOS abaixo).
--
-- As colunas novas em `solicitacoes` (aviso_externo/aviso_canal/aviso_em) e o
-- índice de unicidade são seguros de remover (não guardam histórico de
-- decisão), então saem no cenário (B). No cenário (C) ficam como estão.
-- ============================================================================

begin;

do $$
declare
  v_tem_cancel boolean := false;
  v_tem_contest boolean := false;
  v_tem_politica boolean := false;
begin
  -- Se as tabelas nem existem (cenário A), to_regclass volta null -> sai limpo.
  if to_regclass('public.cancelamentos') is not null then
    execute 'select exists (select 1 from public.cancelamentos)' into v_tem_cancel;
  end if;
  if to_regclass('public.contestacoes') is not null then
    execute 'select exists (select 1 from public.contestacoes)' into v_tem_contest;
  end if;
  if to_regclass('public.politicas_cancelamento') is not null then
    execute 'select exists (select 1 from public.politicas_cancelamento)' into v_tem_politica;
  end if;

  if v_tem_cancel or v_tem_contest then
    raise exception using
      errcode = 'LT900',
      message = 'Reversão abortada: existem cancelamentos/contestações gravados. Não se faz DROP de histórico financeiro/auditoria. Use a seção DESATIVAR SEM PERDER DADOS do cabeçalho.';
  end if;

  if v_tem_politica then
    raise warning 'Há políticas configuradas (sem cancelamentos). Elas serão apagadas pelo DROP abaixo — confirme que isso é desejado.';
  end if;
end $$;

-- Cenário (B): sem dados sensíveis -> remover estruturas.
drop table if exists public.contestacoes;
drop table if exists public.cancelamentos;
drop table if exists public.politicas_cancelamento;

drop index if exists public.idx_solic_aberta_unica_por_aula;
alter table public.solicitacoes
  drop column if exists aviso_em,
  drop column if exists aviso_canal,
  drop column if exists aviso_externo;

commit;

-- ============================================================================
-- DESATIVAR SEM PERDER DADOS (cenário C — recomendado em produção)
-- ----------------------------------------------------------------------------
-- Se a feature já tem dados e você quer "desligá-la" sem destruir histórico:
--
--   1) Desativar a política de todos os personais (para de sugerir %):
--        update public.politicas_cancelamento set ativo = false;
--      (ou, por personal: ... where professor_id = '<uid>';)
--
--   2) Não expor a UI nos portais (feature flag no front / não publicar as
--      telas da ETAPA 3+). As tabelas e o histórico permanecem intactos e
--      legíveis (RLS de leitura continua valendo).
--
--   3) Opcional: revogar EXECUTE das RPCs da ETAPA 2 de `authenticated`
--      (quando existirem) para impedir novas gravações, mantendo os registros:
--        revoke execute on function public.registrar_cancelamento_personal from authenticated;
--        -- (repetir para as demais RPCs da feature)
--
-- Assim o cancelamento para de ser oferecido, mas nenhum cancelamento,
-- contestação, cobrança ou linha de auditoria já existente é perdido.
-- ============================================================================
