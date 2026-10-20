-- ============================================================================
-- LT360 — Migração corretiva da Etapa 1 (NÃO EXECUTAR SEM APROVAÇÃO)
-- ============================================================================
-- Esta migração corrige 4 problemas encontrados na revisão de segurança feita
-- APÓS a aplicação de 0001_disponibilidade_e_solicitacoes.sql em produção:
--
--   1) A política de INSERT em auditoria permitia que o próprio personal
--      fabricasse registros de auditoria arbitrários (operacao, ator_papel,
--      estado_anterior/novo livres, só restritos por professor_id).
--   2) O trigger de integridade de solicitacoes_aluno usava RAISE EXCEPTION
--      sem errcode próprio (cai no genérico P0001), dificultando distinguir
--      programaticamente "violação de integridade esperada" de qualquer
--      outro erro inesperado — tanto em testes quanto no futuro frontend.
--   3) aulas.aula_origem_reposicao_id (adicionado em 0001) não tinha nenhuma
--      validação de coerência entre a aula de reposição e a aula original:
--      como FKs são verificadas independentemente de RLS, um registro
--      poderia (em tese) referenciar a aula de OUTRO personal.
--   4) Cenário inverso do item 3: o trigger acima só valida no momento em
--      que a aula DE REPOSIÇÃO é gravada. Se depois alguém alterar
--      professor_id ou aluno_id da AULA ORIGINAL (a que já tem reposições
--      vinculadas), os vínculos existentes ficam incoerentes sem que nada
--      impeça isso. Esta migração adiciona a proteção simétrica: bloquear
--      (não reescrever) qualquer alteração de professor_id/aluno_id numa
--      aula que já é referenciada como origem por outra(s) aula(s) de
--      reposição. Remarcação (remarcada_para_id/status) não é afetada —
--      a nova trigger só olha para professor_id e aluno_id.
--
-- Endurecimento adicional desta revisão (pontos 1 e 2 do pedido):
--
--   5) RLS não pode ocultar linhas das checagens de integridade. As três
--      funções de validação fazem SELECTs internos para decidir se bloqueiam
--      a escrita. Sob SECURITY INVOKER (padrão), esses SELECTs rodam no
--      contexto RLS do chamador e enxergam apenas as linhas dele. Hoje, com
--      isolamento só por professor_id, isso "falha fechado" (uma linha
--      invisível vira "não encontrado" e também bloqueia), mas é frágil: a
--      correção passa a depender da coincidência da política atual. As três
--      funções passam a SECURITY DEFINER para enxergar o estado real
--      completo — correto por construção. Mitigações obrigatórias aplicadas:
--        - set search_path = '' e todos os identificadores qualificados por
--          schema (sem sequestro de search_path);
--        - revoke execute ... from public, anon, authenticated (triggers não
--          exigem EXECUTE do chamador, então o gatilho continua funcionando;
--          só se remove a chamada direta);
--        - as funções apenas LEEM e dão RAISE com mensagens estáticas (sem
--          SQL dinâmico, sem escrita, sem vazamento de dados de outro tenant);
--        - DEFINER aqui NÃO burla a RLS da escrita em si: o INSERT/UPDATE
--          continua sendo verificado pelas policies da tabela, fora destas
--          funções. DEFINER só amplia o que a *checagem de integridade*
--          enxerga; nunca permite uma escrita que a RLS proibiria.
--
--   6) Concorrência (write-skew). Duas transações simultâneas — uma criando
--      uma reposição vinculada à aula X, outra alterando professor_id/aluno_id
--      de X — poderiam, sob MVCC, passar cada uma na sua checagem (nenhuma vê
--      a linha não-commitada da outra) e terminar com vínculo incoerente. A
--      função validar_integridade_reposicao passa a travar a linha de origem
--      com SELECT ... FOR NO KEY UPDATE; o UPDATE de X pelo outro lado já
--      toma a trava natural da própria linha. Como ambos os lados disputam a
--      MESMA linha de origem, um espera o outro e revalida contra o estado
--      commitado — nenhuma ordem de execução deixa vínculo incoerente.
--
-- Esta migração é aditiva/substitutiva sem perda de dados: troca a função
-- do trigger existente (mesmo comportamento + errcode + endurecimento),
-- remove uma política permissiva que nada no app usa hoje, e adiciona duas
-- novas triggers de validação. Nenhuma tabela é recriada, nenhuma linha é
-- alterada ou apagada, nenhum trigger de autenticação é tocado, remarcação
-- continua funcionando exatamente como hoje.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) auditoria: remover a política de INSERT acessível ao personal
-- ----------------------------------------------------------------------------
-- Nada no app hoje escreve em auditoria (frontend não foi alterado). Em vez
-- de permitir que o cliente insira livremente qualquer conteúdo "de
-- auditoria" sob seu próprio professor_id — o que tornaria a trilha não
-- confiável, já que o próprio ator poderia escrever sua própria versão dos
-- fatos — a escrita fica bloqueada para o papel "authenticated" até que
-- exista um mecanismo confiável e revisado (ver nota abaixo).
--
-- Mantém-se apenas a leitura (select) isolada por professor, já criada em
-- 0001 e não afetada por esta migração.
drop policy if exists "auditoria: inserção isolada por professor" on public.auditoria;

comment on table public.auditoria is
  'Trilha de auditoria append-only. Nenhum papel de cliente (authenticated) '
  'tem INSERT/UPDATE/DELETE: grants e policies foram deliberadamente '
  'deixados sem cobertura para esses comandos. Escrita futura prevista via '
  '(a) triggers AFTER em aulas/solicitacoes_aluno/pagamentos, que derivam '
  'estado_anterior/novo de OLD/NEW sem aceitar conteúdo arbitrário do '
  'cliente, ou (b) processo de backend usando o service_role (que já '
  'ignora RLS por padrão no Supabase). Qualquer uma dessas duas opções '
  'exige revisão dedicada de autenticação/privilégios antes de ativar.';


-- ----------------------------------------------------------------------------
-- 2) solicitacoes_aluno: errcode próprio no trigger de integridade
-- ----------------------------------------------------------------------------
create or replace function public.validar_integridade_solicitacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aula_professor uuid;
  v_aula_aluno uuid;
  v_aluno_professor uuid;
begin
  -- SECURITY DEFINER + search_path fixo: ver nota de projeto no topo do item 2.
  -- Os SELECTs abaixo PRECISAM enxergar o estado real completo (todas as
  -- linhas), não um recorte filtrado por RLS, para que a validação de
  -- integridade seja correta por construção e não por coincidência da
  -- política RLS atual. Esta função apenas LÊ para validar e dá RAISE com
  -- mensagens estáticas; nunca escreve e nunca afrouxa a autorização por
  -- tenant (o INSERT/UPDATE em si continua governado pelas policies RLS da
  -- tabela, avaliadas fora daqui).
  select professor_id, aluno_id into v_aula_professor, v_aula_aluno
    from public.aulas where id = new.aula_original_id;

  if v_aula_professor is null then
    raise exception 'aula_original_id inválido: aula não encontrada'
      using errcode = 'LT001';
  end if;

  select professor_id into v_aluno_professor
    from public.alunos where id = new.aluno_id;

  if v_aluno_professor is null then
    raise exception 'aluno_id inválido: aluno não encontrado'
      using errcode = 'LT001';
  end if;

  if v_aula_professor <> new.professor_id or v_aluno_professor <> new.professor_id then
    raise exception 'solicitacoes_aluno: aula, aluno e professor precisam pertencer ao mesmo personal'
      using errcode = 'LT001';
  end if;

  if v_aula_aluno <> new.aluno_id then
    raise exception 'solicitacoes_aluno: a aula informada não pertence ao aluno informado'
      using errcode = 'LT001';
  end if;

  return new;
end;
$$;

-- Impede chamada direta da função (triggers NÃO exigem EXECUTE do papel que
-- dispara o comando, então isto não afeta o trigger; só remove uma
-- superfície de chamada direta por usuários comuns).
revoke execute on function public.validar_integridade_solicitacao() from public, anon, authenticated;
-- (trigger trg_validar_integridade_solicitacao já existe e passa a usar
-- esta versão automaticamente — CREATE OR REPLACE não precisa recriar o
-- trigger em si.)


-- ----------------------------------------------------------------------------
-- 3) aulas: coerência entre aula de reposição e aula original
-- ----------------------------------------------------------------------------
-- Garante que, quando aula_origem_reposicao_id é preenchido, a aula
-- referenciada pertence ao MESMO personal (e, por consequência de regra de
-- negócio, deveria ser do mesmo aluno — validado aqui também, já que uma
-- reposição é sempre do mesmo aluno da aula original).
create or replace function public.validar_integridade_reposicao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origem_professor uuid;
  v_origem_aluno uuid;
begin
  if new.aula_origem_reposicao_id is null then
    return new;
  end if;

  -- FOR NO KEY UPDATE: trava a linha da aula de ORIGEM durante esta transação.
  -- Esse é o ponto de serialização que impede a janela de concorrência
  -- (ver item "Concorrência" no cabeçalho): se outra transação estiver
  -- alterando professor_id/aluno_id dessa mesma aula de origem, uma das
  -- duas espera a outra e revalida contra o estado já commitado. FOR NO KEY
  -- UPDATE conflita com o UPDATE de colunas não-chave feito pelo outro lado,
  -- mas não bloqueia FKs KEY SHARE de inserts que apenas referenciam a aula.
  select professor_id, aluno_id into v_origem_professor, v_origem_aluno
    from public.aulas where id = new.aula_origem_reposicao_id
    for no key update;

  if v_origem_professor is null then
    raise exception 'aula_origem_reposicao_id inválido: aula de origem não encontrada'
      using errcode = 'LT002';
  end if;

  if v_origem_professor <> new.professor_id then
    raise exception 'aulas: aula de reposição e aula de origem precisam pertencer ao mesmo personal'
      using errcode = 'LT002';
  end if;

  if v_origem_aluno <> new.aluno_id then
    raise exception 'aulas: aula de reposição e aula de origem precisam pertencer ao mesmo aluno'
      using errcode = 'LT002';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_integridade_reposicao() from public, anon, authenticated;

drop trigger if exists trg_validar_integridade_reposicao on public.aulas;
create trigger trg_validar_integridade_reposicao
  before insert or update on public.aulas
  for each row execute function public.validar_integridade_reposicao();


-- ----------------------------------------------------------------------------
-- 4) aulas: proteção simétrica — bloquear alteração de professor_id/aluno_id
--    numa aula ORIGINAL que já tem reposição(ões) vinculada(s)
-- ----------------------------------------------------------------------------
-- Cenário: aula X é original de uma reposição Y (Y.aula_origem_reposicao_id
-- = X.id). Se alguém depois mudar X.professor_id ou X.aluno_id, Y passa a
-- "pertencer", historicamente, a um personal/aluno diferente do que ela
-- apontava — inconsistência silenciosa. Em vez de propagar a mudança para
-- as reposições (reescrever histórico, o que a Etapa 1 proíbe) ou ignorar o
-- problema, a proteção mais simples e segura é BLOQUEAR a alteração
-- enquanto existir vínculo dependente. Isso não impede remarcação (que usa
-- remarcada_para_id e status, nunca professor_id/aluno_id) nem impede
-- excluir/cancelar a aula original — só impede trocar de quem ela é.
create or replace function public.validar_integridade_reposicao_origem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.professor_id is distinct from old.professor_id)
     or (new.aluno_id is distinct from old.aluno_id) then
    -- Precisa enxergar TODAS as reposições que referenciam esta aula,
    -- inclusive as que a RLS do chamador poderia ocultar hoje ou após a
    -- introdução de novas políticas (ex.: portal do aluno). Daí SECURITY
    -- DEFINER. O UPDATE desta própria linha (feito pelo chamador) já tomou
    -- a trava da linha; combinado com o FOR NO KEY UPDATE do outro trigger,
    -- os dois lados serializam sobre a mesma linha de origem.
    if exists (
      select 1 from public.aulas where aula_origem_reposicao_id = old.id
    ) then
      raise exception 'aulas: não é possível alterar professor/aluno de uma aula que já possui reposição(ões) vinculada(s) — desvincule as reposições primeiro'
        using errcode = 'LT003';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.validar_integridade_reposicao_origem() from public, anon, authenticated;

drop trigger if exists trg_validar_integridade_reposicao_origem on public.aulas;
create trigger trg_validar_integridade_reposicao_origem
  before update of professor_id, aluno_id on public.aulas
  for each row execute function public.validar_integridade_reposicao_origem();

-- ============================================================================
-- FIM — nenhuma tabela recriada, nenhum dado alterado, nenhum trigger de
-- autenticação tocado. Resumo:
--   - 1 política removida (insert em auditoria, nunca usada pelo app);
--   - 3 funções de validação agora SECURITY DEFINER + search_path fixo +
--     EXECUTE revogado (integridade independe da visibilidade RLS);
--   - 1 trava FOR NO KEY UPDATE na aula de origem (serializa a concorrência);
--   - 2 triggers novas em aulas (reposição→origem e origem→reposição);
--   - errcodes próprios LT001/LT002/LT003.
-- Remarcação (status + remarcada_para_id) permanece intacta.
-- ============================================================================
