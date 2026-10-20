-- ============================================================================
-- LT360 — Etapa 2, Entrega 2.1: controle de capacidade simultânea
-- NÃO APLICADA ao banco principal. Testada apenas em sandbox isolado.
-- ============================================================================
--
-- O que esta migração faz:
--   1) Cria a função public.validar_capacidade_aula() e a trigger
--      trg_validar_capacidade_aula em public.aulas.
--
-- Decisões de arquitetura (consistentes com a Etapa 1 e com o plano da
-- Etapa 2 já registrado):
--
--   * TRIGGER, não RPC. Protege qualquer caminho de escrita (inclusive o
--     `upsert` direto que o main.js já usa hoje), sem depender de o
--     frontend ser reescrito primeiro.
--
--   * SECURITY INVOKER, não DEFINER. A checagem de capacidade só precisa
--     ver as aulas do PRÓPRIO professor que está escrevendo — exatamente o
--     mesmo escopo que a policy de SELECT de `aulas` já garante via RLS
--     (`professor_id = auth.uid()`). Como não há nenhuma necessidade de ver
--     dados de outro tenant, não há lacuna de visibilidade a contornar, e
--     portanto nenhuma razão para elevar privilégio. Isso evita usar
--     SECURITY DEFINER sem necessidade concreta, como já fixado nesta
--     revisão de segurança desde a Etapa 1.
--
--   * Pico real de concorrência, não contagem par a par. Mesma correção já
--     validada na Entrega 2.0: calcula a ocupação simultânea real nos
--     instantes relevantes dentro da janela da aula sendo validada, em vez
--     de contar quantas aulas se sobrepõem a ela individualmente (o que
--     geraria falso positivo em cadeias sequenciais A-B-C onde A e C nunca
--     coexistem).
--
--   * Duração: aulas legadas sem duracao_min usam 50 minutos SEMPRE, sem
--     jamais escrever nada nelas (requisito 3). Aulas NOVAS (somente no
--     INSERT) têm a duração congelada no momento da criação — se
--     duracao_min não foi informado, usa profiles.duracao_habitual_min
--     (ou 50, se o personal também não configurou isso), e grava esse
--     valor na própria linha para sempre (requisito 4). Uma alteração
--     futura em duracao_habitual_min nunca retroage sobre aulas já
--     congeladas ou sobre aulas legadas.
--
--   * Early exits explícitos (requisito 8): a trigger NUNCA valida nem
--     bloqueia uma alteração que não muda a ocupação real da agenda —
--     cancelamento, conclusão, confirmação, ajustes financeiros
--     (faturada, pagamentos) passam direto, sem lock e sem checagem.
--
--   * Concorrência real entre transações (requisito 6): antes de contar
--     ocupação, a trigger obtém um advisory lock por transação
--     (`pg_advisory_xact_lock`), hashado a partir do professor_id. Isso
--     serializa todas as escritas de agenda do MESMO professor — a mesma
--     técnica (mesmo princípio) já usada e testada na Etapa 1 para a trava
--     de reposição (lá via `FOR NO KEY UPDATE` de linha; aqui via advisory
--     lock, porque não há uma linha única para travar quando a aula ainda
--     não existe). O lock é liberado automaticamente no fim da transação.
--     Quando professor_id é alterado em um UPDATE, trava os dois
--     professores envolvidos, em ordem determinística (evita deadlock
--     entre duas trocas simultâneas).
--
-- Limitações conhecidas, assumidas conscientemente:
--   * O advisory lock serializa TODAS as escritas de agenda de um mesmo
--     professor, não só as que realmente conflitam entre si. Aceitável na
--     escala de um personal trainer individual.
--   * Esta migração não altera o main.js. Ver o relatório de riscos
--     residuais para o impacto real nos caminhos de escrita existentes
--     (em especial: upsert em lote de `sincronizarTabela`).
-- ============================================================================

create or replace function public.validar_capacidade_aula()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_habitual integer;
  v_duracao_efetiva integer;
  v_hora_fim time;
  v_capacidade integer;
  v_pico integer;
begin
  -- -------------------------------------------------------------------
  -- Early exits (requisito 8): nunca bloquear o que não afeta ocupação
  -- -------------------------------------------------------------------

  -- Liberando o horário (cancelamento, remarcação da aula original) —
  -- nunca precisa validar: reduzir ocupação nunca pode estourar capacidade.
  if TG_OP = 'UPDATE' and NEW.status not in ('agendada', 'confirmada', 'concluida') then
    return NEW;
  end if;

  -- INSERT direto já com status não-ocupante (caso de borda) — nada a validar.
  if NEW.status not in ('agendada', 'confirmada', 'concluida') then
    return NEW;
  end if;

  -- UPDATE que não muda nada relevante para ocupação (ex.: concluir aula,
  -- confirmar aula, qualquer ajuste que preserve data/hora/duração/professor)
  if TG_OP = 'UPDATE'
     and OLD.status in ('agendada', 'confirmada', 'concluida')
     and NEW.data = OLD.data
     and NEW.hora = OLD.hora
     and NEW.duracao_min is not distinct from OLD.duracao_min
     and NEW.professor_id = OLD.professor_id
  then
    return NEW;
  end if;

  -- -------------------------------------------------------------------
  -- Congela a duração no momento da criação (requisitos 3 e 4)
  -- -------------------------------------------------------------------
  if TG_OP = 'INSERT' and NEW.duracao_min is null then
    select duracao_habitual_min into v_habitual
    from public.profiles where id = NEW.professor_id;
    NEW.duracao_min := coalesce(v_habitual, 50);
  end if;

  -- Para UPDATE de linha legada (duracao_min ainda null porque não foi
  -- tocado nesta alteração): usa 50 só no cálculo, nunca escreve na linha.
  v_duracao_efetiva := coalesce(NEW.duracao_min, 50);
  v_hora_fim := (NEW.hora + (v_duracao_efetiva || ' minutes')::interval)::time;

  -- -------------------------------------------------------------------
  -- Guarda de isolamento (defesa em profundidade — ver Revisão 2.1, C3)
  -- -------------------------------------------------------------------
  -- A estratégia de advisory lock + recontagem só garante a capacidade sob
  -- READ COMMITTED, onde cada statement re-snapshota e enxerga a linha já
  -- commitada pela transação que detinha o lock antes. Sob REPEATABLE READ /
  -- SERIALIZABLE o snapshot da transação é congelado e a recontagem "não vê"
  -- a linha concorrente — o lock serializa a ordem mas NÃO impede o
  -- write-skew (demonstrado em sandbox). O Supabase usa READ COMMITTED por
  -- padrão; esta guarda apenas recusa, de forma explícita e barulhenta,
  -- qualquer escrita de capacidade feita sob um nível incompatível, em vez de
  -- deixar a proteção falhar silenciosamente. Só roda para operações que de
  -- fato dependem da contagem (as de liberação de horário já saíram nos
  -- early-exits acima).
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Agendamento exige READ COMMITTED; isolamento atual = %. A proteção de capacidade não é segura neste nível.',
      current_setting('transaction_isolation')
      using errcode = 'LT009';
  end if;

  -- -------------------------------------------------------------------
  -- Trava(s) de concorrência (requisito 6)
  -- -------------------------------------------------------------------
  if TG_OP = 'UPDATE' and OLD.professor_id is distinct from NEW.professor_id then
    if OLD.professor_id::text < NEW.professor_id::text then
      perform pg_advisory_xact_lock(hashtext(OLD.professor_id::text));
      perform pg_advisory_xact_lock(hashtext(NEW.professor_id::text));
    else
      perform pg_advisory_xact_lock(hashtext(NEW.professor_id::text));
      perform pg_advisory_xact_lock(hashtext(OLD.professor_id::text));
    end if;
  else
    perform pg_advisory_xact_lock(hashtext(NEW.professor_id::text));
  end if;

  select coalesce(capacidade_simultanea, 1) into v_capacidade
  from public.profiles where id = NEW.professor_id;
  v_capacidade := coalesce(v_capacidade, 1);

  -- -------------------------------------------------------------------
  -- Pico real de concorrência (requisitos 1, 5): varre os instantes de
  -- início de NEW e de qualquer outra aula do professor, na mesma data,
  -- que comece dentro da janela de NEW. NEW ainda não está persistida
  -- (trigger BEFORE), por isso soma-se +1 em cada instante considerado —
  -- válido porque, por construção, todos esses instantes caem dentro da
  -- própria janela de NEW.
  -- -------------------------------------------------------------------
  select max(pico) into v_pico
  from (
    select (
      select count(*)
      from public.aulas a2
      where a2.professor_id = NEW.professor_id
        and a2.data = NEW.data
        and a2.id <> NEW.id
        and a2.status in ('agendada', 'confirmada', 'concluida')
        and a2.hora <= evento.instante
        and evento.instante < (a2.hora + (coalesce(a2.duracao_min, 50) || ' minutes')::interval)::time
    ) + 1 as pico
    from (
      select NEW.hora as instante
      union
      select a3.hora
      from public.aulas a3
      where a3.professor_id = NEW.professor_id
        and a3.data = NEW.data
        and a3.id <> NEW.id
        and a3.status in ('agendada', 'confirmada', 'concluida')
        and a3.hora >= NEW.hora
        and a3.hora < v_hora_fim
    ) as evento
  ) as picos;

  if v_pico > v_capacidade then
    raise exception 'Capacidade simultânea excedida: % aula(s) ao mesmo tempo, capacidade configurada % (horário % às %)',
      v_pico, v_capacidade, NEW.data, NEW.hora
      using errcode = 'LT004';
  end if;

  return NEW;
end;
$$;

-- Defesa em profundidade: impede chamada direta da função fora do contexto
-- de trigger. Não é necessário para o funcionamento da trigger em si — a
-- invocação por trigger não passa pela checagem de EXECUTE (mesmo princípio
-- já confirmado e testado na Etapa 1 para as funções SECURITY DEFINER lá).
revoke execute on function public.validar_capacidade_aula() from public, anon, authenticated;

drop trigger if exists trg_validar_capacidade_aula on public.aulas;
create trigger trg_validar_capacidade_aula
  before insert or update of data, hora, duracao_min, professor_id, status
  on public.aulas
  for each row
  execute function public.validar_capacidade_aula();
