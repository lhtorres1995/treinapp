-- ============================================================================
-- LT360 — Correção do trigger de histórico de item de avaliação física
-- APLICADA ao banco remoto trainer-flow em 2026-11-02, com autorização
-- explícita do usuário nesta sessão, via Supabase MCP (apply_migration,
-- name "fix_historico_item_delete_sem_avaliacao"). Mantida versionada como
-- fonte e referência de revisão. Não reaplicar.
-- ============================================================================
--
-- Problema:
--   Ao excluir uma avaliação física (ou um aluno, por cascata), o trigger
--   trg_historico_item_avaliacao_fisica (AFTER DELETE em
--   avaliacoes_fisicas_itens) tentava INSERIR uma linha em
--   avaliacoes_fisicas_historico referenciando a avaliação-pai. Como essa
--   avaliação está sendo apagada na mesma operação, o INSERT falhava:
--     - com a service role: alterado_por = auth.uid() era null (NOT NULL);
--     - em qualquer caso: violava a FK
--       avaliacoes_fisicas_historico_avaliacao_id_fkey, pois a avaliação-pai
--       já não existia no momento do INSERT.
--   Isso abortava a exclusão do aluno quando havia avaliação física lançada.
--
-- Correção:
--   No ramo DELETE, só registra o histórico se a avaliação-pai ainda existir.
--   Quando o item some junto com a avaliação (exclusão da avaliação/aluno), o
--   log seria apagado pela cascata de qualquer forma, então é pulado. Os ramos
--   INSERT e UPDATE permanecem idênticos ao original (migração 0007): a
--   remoção de uma métrica de uma avaliação que continua existindo segue sendo
--   registrada normalmente.

CREATE OR REPLACE FUNCTION public.registrar_historico_item_avaliacao_fisica()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if TG_OP = 'INSERT' then
    insert into public.avaliacoes_fisicas_historico (avaliacao_id, alterado_por, operacao, dados_novos)
    values (NEW.avaliacao_id, auth.uid(), 'insert_item', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.avaliacoes_fisicas_historico (avaliacao_id, alterado_por, operacao, dados_anteriores, dados_novos)
    values (NEW.avaliacao_id, auth.uid(), 'update_item', to_jsonb(OLD), to_jsonb(NEW));
    return NEW;
  else -- DELETE
    if exists (select 1 from public.avaliacoes_fisicas a where a.id = OLD.avaliacao_id) then
      insert into public.avaliacoes_fisicas_historico (avaliacao_id, alterado_por, operacao, dados_anteriores)
      values (OLD.avaliacao_id, auth.uid(), 'delete_item', to_jsonb(OLD));
    end if;
    return OLD;
  end if;
end;
$function$;
