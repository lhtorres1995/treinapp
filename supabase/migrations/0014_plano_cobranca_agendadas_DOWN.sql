-- ============================================================================
-- LT360 — REVERSÃO da migração 0014 (modo de cobrança "agendadas")
--
-- ⚠️ NÃO APLICAR sem autorização. Só é seguro reverter se NENHUM aluno estiver
--    usando o modo 'agendadas' — caso contrário a re-adição da CHECK antiga
--    falha (de propósito), para não deixar o banco inconsistente com os dados.
-- ============================================================================

do $$
begin
  if exists (select 1 from public.alunos where plano_cobranca = 'agendadas') then
    raise exception 'Existem alunos com plano_cobranca = ''agendadas''. Migre-os antes de reverter a 0014.';
  end if;

  alter table public.alunos
    drop constraint if exists alunos_plano_cobranca_check;

  alter table public.alunos
    add constraint alunos_plano_cobranca_check
    check (plano_cobranca = any (array['fixa'::text, 'por_aula'::text]));
end $$;
