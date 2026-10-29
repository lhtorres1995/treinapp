import { createClient } from '@supabase/supabase-js';
import html2pdf from 'html2pdf.js';
import { Html5Qrcode } from 'html5-qrcode';
import './styles.css';

(function(){
  "use strict";

  var ICONS = {
    route: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 20l-5-2V6l5 2m0 12l6-2m-6 2V8m6 10l5 2V8l-5-2m0 14V6m0 0L9 8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    whats: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3a9 9 0 00-7.8 13.5L3 21l4.7-1.2A9 9 0 1012 3z" stroke="currentColor" stroke-width="2"/></svg>',
    chevL: '<svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 6.5c0-1.93-2.24-3.5-5-3.5s-5 1.57-5 3.5S9.24 10 12 10s5 1.57 5 3.5S14.76 17 12 17s-5-1.57-5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevD: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2"/><path d="M19.4 13a1.7 1.7 0 00.34 1.87l.06.06a2.06 2.06 0 11-2.91 2.91l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V19a2.06 2.06 0 01-4.12 0v-.09a1.7 1.7 0 00-1.11-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2.06 2.06 0 11-2.91-2.91l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2.06 2.06 0 010-4.12h.09A1.7 1.7 0 004.6 6.9a1.7 1.7 0 00-.34-1.87l-.06-.06a2.06 2.06 0 112.91-2.91l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001-1.55V3a2.06 2.06 0 014.12 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2.06 2.06 0 112.91 2.91l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.55 1H21a2.06 2.06 0 010 4.12h-.09a1.7 1.7 0 00-1.51 1z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    recibo: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 7h6M9 11h6M9 15h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 9V2h12v7M6 18H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-2M6 14h12v8H6v-8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3L2 20h20L12 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="2"/><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" stroke-width="2"/><path d="M8 3v4M16 3v4M3.5 10h17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  var MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  var MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  var DIAS = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
  var DIAS_ABREV = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  var ASSUMED_SLOT_MIN = 50; // apenas para espaçamento visual na grade; nunca exibido como duração real

  var hoje = new Date();
  var agendaData = new Date(hoje); // cursor para dia ou semana, conforme agendaModo
  var agendaModo = "dia";
  var editingAlunoId = null;
  var remarcandoId = null;
  var agendaBusca = "";
  var alunoBuscaTermo = "";
  var alunoFiltroStatus = "todos";
  var alunoFiltroCiclo = "todos";
  var alunoOrdenacao = "nome-asc";
  var agendaDiasExpandido = {};
  var resumoGraficoDados = []; // dados já calculados do gráfico "Resumo financeiro" (reutilizados pelo popover, sem recálculo)
  var resumoGraficoPopoverIdx = null;

  function uid(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
      var r = Math.random()*16|0, v = c==='x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  }
  function fmtData(d){ return d.toISOString().slice(0,10); }
  function fmtDataBR(iso){
    var p = iso.split("-");
    return p[2]+"/"+p[1]+"/"+p[0];
  }
  function fmtMoeda(v){
    return "R$ " + Number(v||0).toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
  }
  // Usa a mesma referência de "agora" (hoje) que o resto do app usa para
  // tudo relacionado a data corrente — consistente com fmtData(hoje) usado
  // em renderAgenda, renderResumo etc.
  function aulaEhFutura(c){
    var dataHora = new Date(c.data + "T" + (c.hora || "00:00") + ":00");
    return dataHora.getTime() > hoje.getTime();
  }
  function addDias(dataStr, n){
    var d = new Date(dataStr+"T00:00:00");
    d.setDate(d.getDate()+n);
    return fmtData(d);
  }
  function calcIdade(iso){
    if (!iso) return null; // nascimento agora é opcional no cadastro
    var nasc = new Date(iso+"T00:00:00");
    var hoje2 = new Date();
    var idade = hoje2.getFullYear() - nasc.getFullYear();
    var m = hoje2.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje2.getDate() < nasc.getDate())) idade--;
    return idade;
  }
  // Formata "NN anos" só quando há data de nascimento; caso contrário
  // devolve string vazia, para os pontos da UI que mostram idade como um
  // detalhe opcional (ex.: "32 anos · masculino" vira só "masculino").
  function idadeLabel(iso){
    var idade = calcIdade(iso);
    return idade===null ? "" : (idade + " anos");
  }
  function diaSemanaLabel(iso){
    var d = new Date(iso+"T00:00:00");
    return DIAS[d.getDay()];
  }
  function capitalizar(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
  function normalizar(s){ return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); }
  function iniciais(nome){
    var partes = nome.trim().split(/\s+/);
    return (partes[0][0] + (partes[1] ? partes[1][0] : "")).toUpperCase();
  }
  // Escapa dados de usuário antes de inserir no HTML (proteção contra XSS).
  var ESC_MAP={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return ESC_MAP[c];}); }
  // Avatar do aluno: foto (se houver) ou iniciais. style é opcional (inline).
  function avatarAluno(al, style){
    var st = style ? ' style="'+style+'"' : '';
    if (al && al.fotoUrl) return '<div class="avatar"'+st+'><img class="avatar-img" src="'+esc(al.fotoUrl)+'" alt=""></div>';
    return '<div class="avatar"'+st+'>'+iniciais(al ? al.nome : "")+'</div>';
  }
  function mapsLink(end){ return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(end); }
  function wazeLink(end){ return "https://waze.com/ul?q=" + encodeURIComponent(end) + "&navigate=yes"; }

  function rotaDoDiaLink(dataStr){
    var aulasDoDia = state.aulas.filter(function(c){
      return c.data===dataStr && c.status!=="cancelada" && c.status!=="remarcada";
    }).sort(function(a,b){ return a.hora<b.hora?-1:1; });
    if (aulasDoDia.length===0) return null;
    var enderecos = aulasDoDia.map(function(c){ return getAluno(c.alunoId).endereco; });
    var destino = enderecos[enderecos.length-1];
    var waypoints = enderecos.slice(0,-1);
    var url = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(destino) + "&travelmode=driving";
    if (waypoints.length) url += "&waypoints=" + waypoints.map(encodeURIComponent).join("%7C");
    return url;
  }
  function whatsLink(tel, msg){
    var digits = (tel||"").replace(/\D/g,"");
    if (digits.length <= 11) digits = "55" + digits;
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(msg);
  }

  function mostrarToast(msg){
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t.__timer);
    t.__timer = setTimeout(function(){ t.classList.remove("show"); }, 2800);
  }

  // ---------- Supabase ----------
  var SB_URL = import.meta.env.VITE_SUPABASE_URL;
  var SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  var sb = createClient(SB_URL, SB_KEY);
  var usuarioId = null;
  var authModo = "login";
  // Setado pelo evento PASSWORD_RECOVERY do Supabase, disparado quando a
  // página é aberta a partir do link de redefinição enviado por e-mail. O
  // Supabase cria uma sessão válida nesse momento, mas ela existe só para
  // permitir updateUser({password}) — nunca deve ser tratada como um login
  // normal, senão o usuário entraria no app sem nunca definir a nova senha.
  // Detectado de forma SÍNCRONA, direto na URL, antes de qualquer evento
  // assíncrono do Supabase. Motivo: em alguns casos o SDK dispara
  // INITIAL_SESSION (já com a sessão de recuperação presente) ANTES de
  // PASSWORD_RECOVERY — se a decisão dependesse apenas do evento
  // PASSWORD_RECOVERY, o INITIAL_SESSION chegaria primeiro, seria tratado
  // como login normal, entraria no app e escondido o #gate inteiro; quando
  // PASSWORD_RECOVERY chegasse depois, a tela de redefinir tentaria
  // aparecer dentro de um contêiner pai já escondido — e o usuário nunca
  // via nada, só o app logado direto (bug real já reproduzido). Checar a
  // URL diretamente elimina a dependência da ordem dos eventos.
  var emFluxoRecuperacaoSenha = /type=recovery/.test(window.location.href);
  var authEventJaProcessado = false;

  if (emFluxoRecuperacaoSenha){
    document.getElementById("gate-loading").hidden = true;
    document.getElementById("gate-auth").hidden = false;
    mostrarAuthView("redefinir");
  }

  sb.auth.onAuthStateChange(function(event, session){
    if (event === "PASSWORD_RECOVERY"){
      emFluxoRecuperacaoSenha = true;
      authEventJaProcessado = true;
      document.getElementById("gate-loading").hidden = true;
      document.getElementById("gate-auth").hidden = false;
      mostrarAuthView("redefinir");
      return;
    }
    if (event === "INITIAL_SESSION"){
      authEventJaProcessado = true;
      if (emFluxoRecuperacaoSenha) return; // nunca pisa na tela de redefinir
      if (session){ aposLogin(session); }
      else { mostrarGateAuth(); }
    }
  });

  var state = { alunos: [], aulas: [], pagamentos: [], disponibilidade: [], bloqueios: [], solicitacoes: [], professor: {nome:"", telefone:"", pix:"", logo:null} };

  // ---------- mapeamento front <-> banco ----------
  function alunoToRow(a){
    return {
      id: a.id, professor_id: usuarioId,
      nome: a.nome, telefone: a.telefone, sexo: a.sexo || null,
      nascimento: a.nascimento || null, endereco: a.endereco || null,
      email: a.email || null,
      treino_tipo: a.treinoTipo || null, treino_local: a.treinoLocal || null,
      plano_tipo: a.plano.tipo, plano_cobranca: a.plano.cobranca,
      valor_fixo: a.plano.valorFixo || 0, valor_aula: a.plano.valorAula || 0,
      dias_vencimento: (a.plano.diasVencimento===0 || a.plano.diasVencimento) ? a.plano.diasVencimento : null,
      recorrencia_horarios: (a.recorrencia && a.recorrencia.horarios) || {},
      ativo: a.ativo !== false
    };
  }
  function rowToAluno(r){
    return {
      id: r.id, nome: r.nome, telefone: r.telefone, sexo: r.sexo,
      nascimento: r.nascimento, endereco: r.endereco, email: r.email || "",
      treinoTipo: r.treino_tipo || "", treinoLocal: r.treino_local || "",
      authUserId: r.auth_user_id || null,
      plano: {
        tipo: r.plano_tipo, cobranca: r.plano_cobranca,
        valorFixo: Number(r.valor_fixo)||0, valorAula: Number(r.valor_aula)||0,
        diasVencimento: (r.dias_vencimento===0 || r.dias_vencimento) ? Number(r.dias_vencimento) : (r.plano_tipo==="mensal" ? 5 : r.plano_tipo==="semanal" ? 2 : null)
      },
      recorrencia: { horarios: r.recorrencia_horarios || {} },
      ativo: r.ativo !== false,
      dataCadastro: r.created_at || null,
      checkinToken: r.checkin_token || null,
      fotoUrl: r.foto_url || null
    };
  }
  function aulaToRow(c){
    return {
      id: c.id, professor_id: usuarioId, aluno_id: c.alunoId,
      data: c.data, hora: c.hora, status: c.status,
      remarcada_para_id: c.remarcadaParaId || null,
      faturada: !!c.faturada, valor_faturado: (c.valorFaturado===0 || c.valorFaturado) ? c.valorFaturado : null,
      origem: c.origem || "manual",
      checkin_em: c.checkinEm || null, checkin_origem: c.checkinOrigem || null
    };
  }
  function rowToAula(r){
    return {
      id: r.id, alunoId: r.aluno_id, data: r.data, hora: (r.hora||"").slice(0,5),
      status: r.status, remarcadaParaId: r.remarcada_para_id,
      faturada: !!r.faturada, valorFaturado: (r.valor_faturado===0 || r.valor_faturado) ? Number(r.valor_faturado) : null,
      origem: r.origem || "manual", checkinEm: r.checkin_em || null,
      checkinOrigem: r.checkin_origem || null
    };
  }
  function disponibilidadeToRow(d){
    return {
      id: d.id, professor_id: usuarioId, dia_semana: d.diaSemana,
      hora_inicio: d.horaInicio, hora_fim: d.horaFim, ativo: d.ativo !== false
    };
  }
  function rowToDisponibilidade(r){
    return {
      id: r.id, diaSemana: r.dia_semana,
      horaInicio: (r.hora_inicio||"").slice(0,5), horaFim: (r.hora_fim||"").slice(0,5),
      ativo: r.ativo !== false
    };
  }
  function bloqueioToRow(b){
    return {
      id: b.id, professor_id: usuarioId,
      data_inicio: b.dataInicio, data_fim: b.dataFim,
      hora_inicio: b.horaInicio || null, hora_fim: b.horaFim || null,
      motivo: b.motivo || null
    };
  }
  function rowToBloqueio(r){
    return {
      id: r.id, dataInicio: r.data_inicio, dataFim: r.data_fim,
      horaInicio: r.hora_inicio ? r.hora_inicio.slice(0,5) : null,
      horaFim: r.hora_fim ? r.hora_fim.slice(0,5) : null,
      motivo: r.motivo || null
    };
  }
  function pagamentoToRow(p){
    return {
      id: p.id, professor_id: usuarioId, aluno_id: p.alunoId,
      valor: p.valor, referencia: p.referencia || null, periodo_label: p.periodoLabel || null,
      status: p.status, chave_referencia: p.chaveReferencia || null,
      mes_referencia: p.mesReferencia || null, data_vencimento: p.dataVencimento || null,
      data_pagamento: p.dataPagamento || null, aula_ids: p.aulaIds || [],
      pago_informado_em: p.pagoInformadoEm || null
    };
  }
  function rowToPagamento(r){
    return {
      id: r.id, alunoId: r.aluno_id, valor: Number(r.valor)||0,
      referencia: r.referencia, periodoLabel: r.periodo_label,
      status: r.status, chaveReferencia: r.chave_referencia,
      mesReferencia: r.mes_referencia, dataVencimento: r.data_vencimento,
      dataPagamento: r.data_pagamento, aulaIds: r.aula_ids || [],
      pagoInformadoEm: r.pago_informado_em || null
    };
  }

  // ---------- persistência incremental (diff local -> banco) ----------
  var ultimoSnapshot = { alunos:{}, aulas:{}, pagamentos:{} };
  function snapshotDe(tabela, lista){
    var m = {};
    lista.forEach(function(item){ m[item.id] = JSON.stringify(item); });
    ultimoSnapshot[tabela] = m;
  }
  async function sincronizarTabela(tabela, lista, mapFn){
    var snap = ultimoSnapshot[tabela];
    var idsAtuais = {}, paraUpsert = [];
    lista.forEach(function(item){
      idsAtuais[item.id] = true;
      var serial = JSON.stringify(item);
      if (snap[item.id] !== serial) paraUpsert.push(mapFn(item));
    });
    var paraDeletar = [];
    Object.keys(snap).forEach(function(id){ if (!idsAtuais[id]) paraDeletar.push(id); });
    if (paraUpsert.length){
      var r = await sb.from(tabela).upsert(paraUpsert);
      if (r.error) throw r.error;
    }
    if (paraDeletar.length){
      var r2 = await sb.from(tabela).delete().in("id", paraDeletar);
      if (r2.error) throw r2.error;
    }
    snapshotDe(tabela, lista);
  }

  // Sincronização específica de AULAS (C1): como a trigger de capacidade pode
  // rejeitar uma linha individual, NÃO se pode mandar tudo num upsert em lote
  // (uma ocorrência conflitante abortaria o lote inteiro). Aqui cada inserção
  // e cada atualização vai isolada: as válidas persistem, as rejeitadas são
  // coletadas e o estado local é reconciliado com o servidor. Inserções e
  // atualizações são separadas de propósito para que a trigger BEFORE INSERT
  // só dispare em linhas realmente novas.
  async function sincronizarAulas(){
    var snap = ultimoSnapshot.aulas;
    var idsAtuais = {}, novas = [], alteradas = [];
    state.aulas.forEach(function(item){
      idsAtuais[item.id] = true;
      var serial = JSON.stringify(item);
      if (!(item.id in snap)) novas.push(item);
      else if (snap[item.id] !== serial) alteradas.push(item);
    });
    var paraDeletar = [];
    Object.keys(snap).forEach(function(id){ if (!idsAtuais[id]) paraDeletar.push(id); });

    var falhas = [];
    for (var i=0;i<novas.length;i++){
      var ri = await sb.from("aulas").insert(aulaToRow(novas[i]));
      if (ri.error) falhas.push({ item: novas[i], error: ri.error, op: "insert" });
    }
    for (var j=0;j<alteradas.length;j++){
      var ru = await sb.from("aulas").update(aulaToRow(alteradas[j])).eq("id", alteradas[j].id);
      if (ru.error) falhas.push({ item: alteradas[j], error: ru.error, op: "update" });
    }
    if (paraDeletar.length){
      // Exclusões não disparam a trigger. Um erro de banco aqui é coletado
      // como falha (não lançado), para seguir o MESMO caminho de
      // reconciliação dos inserts/updates: as linhas não excluídas voltam a
      // aparecer no reload (verdade do servidor), sem perder as operações
      // já confirmadas nem as alterações pendentes de outras tabelas.
      var rd = await sb.from("aulas").delete().in("id", paraDeletar);
      if (rd.error) falhas.push({ item: null, error: rd.error, op: "delete", ids: paraDeletar });
    }

    if (!falhas.length){
      snapshotDe("aulas", state.aulas);
      return { msg: null, falhas: [] };
    }

    // Reconciliação: recarrega aulas do servidor (fonte da verdade). Inserts
    // rejeitados somem; updates rejeitados voltam ao valor do servidor. As
    // operações bem-sucedidas já estão no servidor e retornam normalmente.
    // Se ESTE select falhar, a exceção sobe para persistir()/salvarEstado():
    // não há como dar o retorno { falhas } por certo sem a reconciliação.
    var au = await sb.from("aulas").select("*");
    if (au.error) throw au.error;
    state.aulas = (au.data || []).map(rowToAula);
    snapshotDe("aulas", state.aulas);
    return { msg: montarMensagemFalhasAulas(falhas), falhas: falhas };
  }

  function montarMensagemFalhasAulas(falhas){
    var conflitos = [], exclusoes = 0, outros = 0;
    falhas.forEach(function(f){
      var code = (f.error && f.error.code) || "";
      var msg = (f.error && f.error.message) || "";
      if (f.op === "delete"){
        exclusoes += (f.ids ? f.ids.length : 1);
      } else if (code === "LT004" || /LT004/.test(msg)){
        conflitos.push((f.item && f.item.data ? fmtDataBR(f.item.data) : "?") + " às " + ((f.item && f.item.hora) || "?"));
      } else { outros++; }
    });
    var partes = [];
    if (conflitos.length){
      partes.push(conflitos.length === 1
        ? "1 horário em conflito de capacidade não foi agendado: " + conflitos[0] + "."
        : conflitos.length + " horários em conflito de capacidade não foram agendados: " + conflitos.join(", ") + ".");
    }
    if (exclusoes) partes.push(exclusoes + " exclusão(ões) não foram concluídas; os registros foram mantidos.");
    if (outros) partes.push(outros + " operação(ões) não foram salvas por outro motivo.");
    return partes.join(" ");
  }

  async function persistir(){
    if (!usuarioId) return { msg: null, falhas: [] };
    await sincronizarTabela("alunos", state.alunos, alunoToRow);
    var resAulas = await sincronizarAulas();
    await sincronizarTabela("pagamentos", state.pagamentos, pagamentoToRow);
    return resAulas;
  }
  // Fila serial única para TODAS as escritas: persistências de estado e a RPC
  // de remarcação passam pela mesma fila, de modo que a remarcação nunca
  // dispute estado/snapshot com uma sincronização pendente (risco 1). A fila
  // é mantida viva mesmo quando uma tarefa rejeita.
  var filaPersist = Promise.resolve();
  function enfileirar(tarefa){
    var p = filaPersist.then(tarefa);
    filaPersist = p.catch(function(){});
    return p;
  }
  // salvarEstado() devolve SEMPRE um resultado estruturado, nunca mistura
  // "sucesso" com "não sei o que aconteceu". Os chamadores que precisam saber
  // exatamente o que foi gravado (recorrência) usam `ok`, `falhasAulas` e
  // `origem`:
  //
  //   ok === true, origem === "gravacao" → a persistência rodou e CONCLUIU
  //                  (sem exceção não tratada): `falhasAulas` tem o detalhe
  //                  completo de cada item rejeitado. Esta é a única situação
  //                  em que se pode falar de "operação concluída" no sentido
  //                  pleno — o servidor processou exatamente o que foi pedido,
  //                  linha por linha, e sabemos o resultado de cada uma.
  //   ok === true, origem === "recarga" → a persistência EXPLODIU no meio
  //                  (ex.: erro de rede, falha em outra tabela) e a RECARGA de
  //                  recuperação (carregarDadosDoServidor) teve sucesso.
  //                  state.aulas passa a refletir com confiança o servidor,
  //                  mas isso é apenas uma FOTO do estado atual — não uma
  //                  confirmação de que a operação solicitada como um todo
  //                  foi concluída (pode ter parado no meio: algumas linhas
  //                  daquela chamada específica podem nunca ter chegado a ser
  //                  tentadas). `falhasAulas` vem vazio de propósito — não há
  //                  causa detalhada conhecida para inventar. Os chamadores
  //                  que precisam de uma mensagem de sucesso "pleno" (ex.:
  //                  "aluno salvo", "recorrência atualizada") devem tratar
  //                  este caso como incerto, não como sucesso equivalente ao
  //                  de `origem === "gravacao"`.
  //   ok === false → NEM a gravação NEM a recarga de verificação funcionaram
  //                  (`origem` ainda vem "recarga", já que foi essa tentativa
  //                  que falhou). Não há base nenhuma para afirmar o que foi
  //                  ou não salvo no servidor — os chamadores NUNCA devem
  //                  apresentar uma mensagem de sucesso ou de contagem neste
  //                  caso (requisito 4), só avisar que a confirmação não foi
  //                  possível.
  function salvarEstado(){
    return enfileirar(persistir).then(function(res){
      if (res && res.msg){ mostrarToast(res.msg); renderAll(); }
      return { ok: true, falhasAulas: (res && res.falhas) || [], origem: "gravacao" };
    }).catch(function(e){
      console.error("Erro ao salvar:", e);
      return carregarDadosDoServidor().then(function(){
        renderAll();
        mostrarToast("Falha ao salvar. Seus dados foram recarregados do servidor para refletir o estado atual, mas a operação pedida pode não ter sido concluída por completo.");
        // A recarga teve sucesso: state.aulas agora É a verdade do servidor
        // NESTE INSTANTE, mas isso não equivale a dizer que a operação
        // solicitada terminou como pedido — só que sabemos onde as coisas
        // estão agora. Perdemos também o motivo específico de cada item
        // ausente (a falha pode ter sido em outra tabela, antes da
        // sincronização de aulas rodar). falhasAulas vem vazio de propósito —
        // os chamadores não devem inventar uma causa que não foi observada.
        return { ok: true, falhasAulas: [], origem: "recarga" };
      }).catch(function(e2){
        console.error("Erro ao salvar E ao recarregar:", e2);
        mostrarToast("Erro ao salvar e também ao recarregar seus dados do servidor. Não é possível confirmar o que foi gravado.");
        return { ok: false, falhasAulas: [], origem: "recarga" };
      });
    });
  }

  // ---------- carregamento ----------
  async function carregarDadosDoServidor(){
    var res = await Promise.all([
      sb.from("profiles").select("*").eq("id", usuarioId).maybeSingle(),
      sb.from("alunos").select("*").order("nome"),
      sb.from("aulas").select("*"),
      sb.from("pagamentos").select("*"),
      sb.from("disponibilidade_personal").select("*").order("dia_semana"),
      sb.from("bloqueios_agenda").select("*").order("data_inicio")
    ]);
    var prof = res[0], al = res[1], au = res[2], pg = res[3], disp = res[4], blq = res[5];
    [al, au, pg, disp, blq].forEach(function(r){ if (r.error) throw r.error; });
    if (prof.error) throw prof.error;
    state.alunos = (al.data || []).map(rowToAluno);
    state.aulas = (au.data || []).map(rowToAula);
    state.pagamentos = (pg.data || []).map(rowToPagamento);
    state.disponibilidade = (disp.data || []).map(rowToDisponibilidade);
    state.bloqueios = (blq.data || []).map(rowToBloqueio);
    var p = prof.data || {};
    state.professor = { nome: p.nome || "", telefone: p.telefone || "", pix: p.pix || "", logo: p.logo_url || null, capacidadeSimultanea: p.capacidade_simultanea || 1, pixTipo: p.pix_tipo || "", cidade: p.cidade || "" };
    snapshotDe("alunos", state.alunos);
    snapshotDe("aulas", state.aulas);
    snapshotDe("pagamentos", state.pagamentos);

    // Solicitações (Fase 3): carga tolerante e fora do Promise.all principal —
    // se a tabela ainda não existir, o app continua funcionando normalmente.
    try {
      var sol = await sb.from("solicitacoes").select("*").eq("professor_id", usuarioId).order("created_at", { ascending: false });
      state.solicitacoes = sol.error ? [] : (sol.data || []).map(rowToSolicitacao);
    } catch(e){ state.solicitacoes = []; }
  }
  function rowToSolicitacao(r){
    return {
      id: r.id, alunoId: r.aluno_id, aulaId: r.aula_id, tipo: r.tipo,
      dataSugerida: r.data_sugerida, horaSugerida: (r.hora_sugerida||"").slice(0,5),
      contraData: r.contra_data, contraHora: (r.contra_hora||"").slice(0,5),
      mensagem: r.mensagem || "", status: r.status, resposta: r.resposta || "",
      createdAt: r.created_at, respondidaEm: r.respondida_em
    };
  }

  // ---------- autenticação ----------
  function mostrarGateAuth(){
    document.getElementById("gate-loading").hidden = true;
    document.getElementById("gate-auth").hidden = false;
  }
  function setErroAuth(msg){ var e=document.getElementById("auth-erro"); e.textContent=msg||""; e.hidden=!msg; }
  function setMsgAuth(msg){ var e=document.getElementById("auth-msg"); e.textContent=msg||""; e.hidden=!msg; }
  function setErroRecuperar(msg){ var e=document.getElementById("recuperar-erro"); e.textContent=msg||""; e.hidden=!msg; }
  function setMsgRecuperar(msg){ var e=document.getElementById("recuperar-msg"); e.textContent=msg||""; e.hidden=!msg; }
  function setErroRedefinir(msg){ var e=document.getElementById("redefinir-erro"); e.textContent=msg||""; e.hidden=!msg; }

  // Alterna entre as três sub-telas do gate (login/signup, recuperar senha,
  // redefinir senha). "redefinir" só é alcançada via link de recuperação por
  // e-mail (evento PASSWORD_RECOVERY do Supabase), nunca por navegação manual.
  function mostrarAuthView(nome){
    document.getElementById("authview-principal").hidden = nome !== "principal";
    document.getElementById("authview-recuperar").hidden = nome !== "recuperar";
    document.getElementById("authview-redefinir").hidden = nome !== "redefinir";
  }

  window.irParaRecuperarSenha = function(){
    setErroRecuperar(""); setMsgRecuperar("");
    var emailAtual = document.getElementById("auth-email").value.trim();
    if (emailAtual) document.getElementById("recuperar-email").value = emailAtual;
    mostrarAuthView("recuperar");
  };
  window.voltarParaLogin = function(){
    setErroAuth(""); setMsgAuth("");
    authModo = "login";
    aplicarModoAuth();
    mostrarAuthView("principal");
  };

  window.pedirRecuperacaoSenha = async function(ev){
    ev.preventDefault();
    var email = document.getElementById("recuperar-email").value.trim();
    var btn = document.getElementById("recuperar-submit");
    setErroRecuperar(""); setMsgRecuperar("");
    if (!email){ setErroRecuperar("Informe seu e-mail."); return; }
    btn.disabled = true; btn.textContent = "Enviando...";
    try {
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
      if (r.error) throw r.error;
      // Mensagem deliberadamente igual para e-mail cadastrado ou não: não
      // confirmar a um visitante quais e-mails têm conta no sistema.
      setMsgRecuperar("Se esse e-mail tiver uma conta, enviamos um link de redefinição. Confira também a caixa de spam.");
      btn.textContent = "Enviar link de recuperação";
      btn.disabled = false;
    } catch(err){
      console.error("Erro ao solicitar recuperação de senha:", err);
      var m = (err && err.message) || "";
      var msgAmigavel = /security purposes|rate limit/i.test(m)
        ? "Você já pediu um link recentemente. Aguarde um pouco antes de tentar de novo."
        : "Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.";
      setErroRecuperar(msgAmigavel);
      btn.disabled = false;
      btn.textContent = "Enviar link de recuperação";
    }
  };

  window.redefinirSenha = async function(ev){
    ev.preventDefault();
    var novaSenha = document.getElementById("redefinir-senha").value;
    var confirma = document.getElementById("redefinir-senha-confirma").value;
    var btn = document.getElementById("redefinir-submit");
    setErroRedefinir("");
    if (novaSenha.length < 6){ setErroRedefinir("A nova senha precisa ter pelo menos 6 caracteres."); return; }
    if (novaSenha !== confirma){ setErroRedefinir("As senhas não coincidem."); return; }
    btn.disabled = true; btn.textContent = "Salvando...";
    try {
      var r = await sb.auth.updateUser({ password: novaSenha });
      if (r.error) throw r.error;
      // updateUser() NÃO retorna sessão em data (só { user }) — buscar a
      // sessão atual explicitamente. A sessão de recuperação continua
      // válida depois do updateUser (ele só troca a senha, não invalida a
      // sessão corrente), então isso não dispara um novo round-trip de
      // login, só lê o que já está ativo.
      var sessaoAtual = await sb.auth.getSession();
      if (!sessaoAtual.data.session) throw new Error("Sessão expirou. Peça um novo link de recuperação.");
      // Este é o ÚNICO caminho autorizado a entrar no app a partir de uma
      // sessão de recuperação — por isso o segundo argumento (ver guarda
      // em aposLogin).
      await aposLogin(sessaoAtual.data.session, true);
    } catch(err){
      console.error("Erro ao redefinir senha:", err);
      setErroRedefinir((err && err.message) || "Não foi possível salvar a nova senha. Peça um novo link de recuperação.");
      btn.disabled = false;
      btn.textContent = "Salvar nova senha";
    }
  };

  function aplicarModoAuth(){
    var login = authModo === "login";
    document.getElementById("auth-titulo").textContent = login ? "Bem-vindo de volta!" : "Crie sua conta";
    var sub = document.getElementById("auth-subtitle");
    if (sub) sub.textContent = login ? "Entre na sua conta para continuar" : "Comece a gerenciar seus alunos";
    document.getElementById("auth-submit").textContent = login ? "Entrar" : "Criar conta";
    document.getElementById("auth-toggle").textContent = login ? "Não tem conta? Criar agora" : "Já tem conta? Entrar";
    document.getElementById("auth-esqueci").hidden = !login;
  }
  window.alternarModoAuth = function(){
    authModo = authModo === "login" ? "signup" : "login";
    aplicarModoAuth();
    setErroAuth(""); setMsgAuth("");
  };
  window.toggleSenha = function(){
    var inp = document.getElementById("auth-senha");
    if (inp) inp.type = inp.type === "password" ? "text" : "password";
  };

  window.autenticar = async function(ev){
    ev.preventDefault();
    var email = document.getElementById("auth-email").value.trim();
    var senha = document.getElementById("auth-senha").value;
    var btn = document.getElementById("auth-submit");
    setErroAuth(""); setMsgAuth("");
    if (!email || senha.length < 6){ setErroAuth("Informe e-mail e senha de pelo menos 6 caracteres."); return; }
    btn.disabled = true; btn.textContent = "Aguarde...";
    try {
      if (authModo === "login"){
        var r = await sb.auth.signInWithPassword({ email: email, password: senha });
        if (r.error) throw r.error;
        await aposLogin(r.data.session);
      } else {
        var r2 = await sb.auth.signUp({ email: email, password: senha });
        if (r2.error) throw r2.error;
        if (r2.data.session){ await aposLogin(r2.data.session); }
        else {
          setMsgAuth("Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.");
          authModo = "login";
          aplicarModoAuth();
          btn.disabled = false;
        }
      }
    } catch(err){
      setErroAuth(traduzErroAuth(err));
      btn.disabled = false;
      btn.textContent = authModo==="login" ? "Entrar" : "Criar conta";
    }
  };

  function traduzErroAuth(err){
    var m = (err && err.message) || "Erro ao autenticar.";
    if (/Invalid login/i.test(m)) return "E-mail ou senha incorretos.";
    if (/already registered/i.test(m)) return "Esse e-mail já tem conta. Tente entrar.";
    if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar.";
    return m;
  }

  async function aposLogin(session, viaRedefinicaoSenha){
    // Guarda extra (defesa em profundidade, além do "return" no listener de
    // INITIAL_SESSION acima): nunca entra no app a partir de uma sessão de
    // recuperação, exceto pelo próprio fluxo de redefinir senha.
    if (emFluxoRecuperacaoSenha && !viaRedefinicaoSenha) return;
    usuarioId = session.user.id;
    try {
      await carregarDadosDoServidor();
    } catch(err){
      console.error(err);
      usuarioId = null;
      setErroAuth("Não consegui carregar seus dados. Confira se o schema SQL foi aplicado no Supabase. (" + ((err&&err.message)||"") + ")");
      mostrarGateAuth();
      var b = document.getElementById("auth-submit"); b.disabled = false; b.textContent = "Entrar";
      return;
    }
    document.getElementById("gate").hidden = true;
    document.getElementById("header-date").textContent = capitalizar(diaSemanaLabel(fmtData(hoje))) + ", " + fmtDataBR(fmtData(hoje));
    sincronizarCobrancasAutomaticas();
    renderAll();
  }

  window.sairDaConta = function(){
    pedirConfirmacao("Sair da conta", "Você vai precisar entrar de novo para acessar seus dados.", "Sair", function(){
      sb.auth.signOut().then(function(){ location.reload(); });
    });
  };

  // Rede de segurança: dá uma janela curta para o próprio onAuthStateChange
  // (INITIAL_SESSION ou PASSWORD_RECOVERY, registrado acima) ser a fonte
  // única de verdade sobre o que mostrar. Só chama getSession() por conta
  // própria se, depois desse tempo, nenhum dos dois eventos tiver chegado
  // (ex.: diferença de comportamento entre versões do supabase-js) — e
  // mesmo assim, nunca pisa numa tela de redefinir senha já decidida.
  function iniciar(){
    setTimeout(function(){
      if (authEventJaProcessado) return;
      sb.auth.getSession().then(function(s){
        if (authEventJaProcessado || emFluxoRecuperacaoSenha) return;
        if (s.data.session){ aposLogin(s.data.session); }
        else { mostrarGateAuth(); }
      }).catch(function(err){
        console.error(err);
        if (!authEventJaProcessado && !emFluxoRecuperacaoSenha){
          mostrarGateAuth();
          setErroAuth("Falha ao conectar no servidor. Tente recarregar a página.");
        }
      });
    }, 1200);
  }

  function getAluno(id){
    for (var i=0;i<state.alunos.length;i++) if (state.alunos[i].id===id) return state.alunos[i];
    return null;
  }

  // ---------- navegação de abas ----------
  window.irParaTab = function(nome){
    document.querySelectorAll(".screen").forEach(function(s){ s.classList.remove("active"); });
    document.getElementById("screen-"+nome).classList.add("active");
    document.querySelectorAll(".tab-btn").forEach(function(b){ b.classList.toggle("active", b.dataset.tab===nome); });
    document.getElementById("alunos-lista-view").hidden = false;
    document.getElementById("alunos-detalhe-view").hidden = true;
    renderAll();
  };

  window.fecharModal = function(id){ document.getElementById(id).classList.remove("open"); };
  function abrirModal(id){ document.getElementById(id).classList.add("open"); }

  // ---------- modal aluno (criar / editar) ----------
  window.atualizarCamposPlano = function(){
    var tipo = document.getElementById("f-plano-tipo").value;
    var campoCobranca = document.getElementById("campo-cobranca");
    var campoFixo = document.getElementById("campo-valor-fixo");
    var campoAula = document.getElementById("campo-valor-aula");
    var campoVencimento = document.getElementById("campo-dias-vencimento");
    var inputVencimento = document.getElementById("f-plano-dias-vencimento");

    if (tipo === "avulsa"){
      campoCobranca.hidden = true;
      campoFixo.hidden = true;
      campoAula.hidden = false;
      // avulsa não tem período/vencimento próprio: cada aula concluída já
      // gera sua própria cobrança, vencendo na data da aula.
      campoVencimento.hidden = true;
      return;
    }
    campoCobranca.hidden = false;
    var cobranca = document.getElementById("f-plano-cobranca").value;
    campoFixo.hidden = cobranca !== "fixa";
    campoAula.hidden = cobranca !== "por_aula";
    campoVencimento.hidden = false;
    if (!inputVencimento.value){
      inputVencimento.value = tipo === "semanal" ? 2 : 5;
    }
  };

  window.toggleRecDia = function(cb){
    var linha = cb.closest(".rec-dia-linha");
    var horarioInput = linha.querySelector(".rec-dia-horario");
    var chip = cb.closest(".dia-chip-toggle");
    chip.classList.toggle("selected", cb.checked);
    horarioInput.disabled = !cb.checked;
    if (cb.checked && !horarioInput.value) horarioInput.value = "07:00";
  };

  window.abrirModalAluno = function(id){
    editingAlunoId = id || null;
    var form = document.getElementById("form-aluno");
    form.reset();
    document.querySelectorAll(".rec-dia-linha").forEach(function(linha){
      var cb = linha.querySelector(".rec-dia-check");
      var horarioInput = linha.querySelector(".rec-dia-horario");
      cb.checked = false;
      cb.closest(".dia-chip-toggle").classList.remove("selected");
      horarioInput.disabled = true;
      horarioInput.value = "";
    });
    document.getElementById("modal-aluno-titulo").textContent = id ? "Editar aluno" : "Novo aluno";
    document.getElementById("modal-aluno-subtitulo").textContent = id ? "Atualize as informações e configurações do aluno." : "Preencha os dados para cadastrar o aluno.";
    document.getElementById("modal-aluno-submit").textContent = id ? "Salvar alterações" : "Salvar aluno";

    if (id){
      var a = getAluno(id);
      document.getElementById("f-nome").value = a.nome;
      document.getElementById("f-telefone").value = a.telefone;
      document.getElementById("f-email").value = a.email || "";
      document.getElementById("f-sexo").value = a.sexo;
      document.getElementById("f-nascimento").value = a.nascimento;
      document.getElementById("f-endereco").value = a.endereco;
      if (a.treinoTipo) document.getElementById("f-treino-tipo").value = a.treinoTipo;
      document.getElementById("f-treino-local").value = a.treinoLocal || "";
      document.getElementById("f-plano-tipo").value = a.plano.tipo;
      document.getElementById("f-plano-cobranca").value = a.plano.cobranca;
      document.getElementById("f-plano-valor-fixo").value = a.plano.valorFixo || "";
      document.getElementById("f-plano-valor-aula").value = a.plano.valorAula || "";
      document.getElementById("f-plano-dias-vencimento").value = (a.plano.diasVencimento===0 || a.plano.diasVencimento) ? a.plano.diasVencimento : "";
      if (a.recorrencia && a.recorrencia.horarios){
        Object.keys(a.recorrencia.horarios).forEach(function(dia){
          var linha = document.querySelector(".rec-dia-linha[data-dia='"+dia+"']");
          if (linha){
            var cb = linha.querySelector(".rec-dia-check");
            var horarioInput = linha.querySelector(".rec-dia-horario");
            cb.checked = true;
            cb.closest(".dia-chip-toggle").classList.add("selected");
            horarioInput.disabled = false;
            horarioInput.value = a.recorrencia.horarios[dia];
          }
        });
      }
    } else {
      document.getElementById("f-plano-cobranca").value = "fixa";
    }
    atualizarIdadePreview();
    atualizarCamposPlano();
    abrirModal("modal-aluno");
  };

  window.atualizarIdadePreview = function(){
    var v = document.getElementById("f-nascimento").value;
    document.getElementById("idade-preview").textContent = v ? (calcIdade(v) + " anos") : "";
  };

  window.salvarAluno = async function(ev){
    ev.preventDefault();
    var tipo = document.getElementById("f-plano-tipo").value;
    var cobranca = tipo === "avulsa" ? "por_aula" : document.getElementById("f-plano-cobranca").value;
    var horariosRecorrencia = {};
    document.querySelectorAll(".rec-dia-linha").forEach(function(linha){
      var cb = linha.querySelector(".rec-dia-check");
      var horarioInput = linha.querySelector(".rec-dia-horario");
      if (cb.checked && horarioInput.value){
        horariosRecorrencia[linha.dataset.dia] = horarioInput.value;
      }
    });
    var dados = {
      nome: document.getElementById("f-nome").value.trim(),
      telefone: document.getElementById("f-telefone").value.trim(),
      email: document.getElementById("f-email").value.trim(),
      sexo: document.getElementById("f-sexo").value,
      nascimento: document.getElementById("f-nascimento").value,
      endereco: document.getElementById("f-endereco").value.trim(),
      treinoTipo: document.getElementById("f-treino-tipo").value,
      treinoLocal: document.getElementById("f-treino-local").value.trim(),
      plano: {
        tipo: tipo,
        cobranca: cobranca,
        valorFixo: Number(document.getElementById("f-plano-valor-fixo").value || 0),
        valorAula: Number(document.getElementById("f-plano-valor-aula").value || 0),
        diasVencimento: tipo === "avulsa" ? null : Number(document.getElementById("f-plano-dias-vencimento").value || (tipo==="semanal"?2:5))
      },
      recorrencia: {
        horarios: horariosRecorrencia
      }
    };

    var editando = !!editingAlunoId;

    // Requisito do usuário: avisar (sem bloquear) quando os novos horários de
    // recorrência colidirem com os de outro aluno ATIVO, acima da capacidade
    // simultânea configurada no perfil — mesma lógica usada em salvarAula.
    var conflitos = detectarConflitosRecorrencia(horariosRecorrencia, editando ? editingAlunoId : null);
    // Também avisa (sem bloquear) quando um dia+horário fixo cai fora da
    // disponibilidade semanal configurada. Bloqueios manuais (datas pontuais)
    // NÃO entram aqui de propósito: um bloqueio vale para datas específicas,
    // não para um padrão semanal recorrente — ele é checado por ocorrência
    // quando a aula concreta é gerada/agendada (salvarAula / geração de
    // recorrência), não no momento de definir o padrão.
    var foraDaDisponibilidade = detectarForaDaDisponibilidade(horariosRecorrencia);

    if (conflitos.length > 0 || foraDaDisponibilidade.length > 0){
      var partes = [];
      if (conflitos.length > 0) partes.push(montarMensagemConflitoRecorrencia(conflitos));
      if (foraDaDisponibilidade.length > 0) partes.push(montarMensagemForaDisponibilidade(foraDaDisponibilidade));
      pedirConfirmacao(
        "Atenção aos horários",
        partes.join(" "),
        "Salvar mesmo assim",
        function(){ concluirSalvarAluno(dados, horariosRecorrencia, editando); }
      );
      return;
    }
    concluirSalvarAluno(dados, horariosRecorrencia, editando);
  };

  // Para cada dia+hora da recorrência que está sendo salva, conta quantos
  // OUTROS alunos ativos (excluindo o próprio aluno em edição) já ocupam o
  // mesmo dia+hora na recorrência deles, e reporta os que, somando este
  // aluno, estourariam a capacidade simultânea configurada no perfil.
  function detectarConflitosRecorrencia(horariosRecorrencia, alunoIdExcluir){
    var capacidade = (state.professor && state.professor.capacidadeSimultanea) || 1;
    var conflitos = [];
    Object.keys(horariosRecorrencia).forEach(function(dia){
      var hora = horariosRecorrencia[dia];
      // Todos os OUTROS alunos ativos com algum horário fixo nesse MESMO dia
      // da semana — não só no mesmo horário exato: a trigger do banco
      // considera conflito qualquer sobreposição das janelas de ~50min.
      var outrosNoDia = state.alunos.filter(function(a){
        if (a.id === alunoIdExcluir) return false;
        if (a.ativo === false) return false;
        return a.recorrencia && a.recorrencia.horarios && a.recorrencia.horarios[dia];
      }).map(function(a){
        return { aluno: a, hora: a.recorrencia.horarios[dia] };
      });
      var pico = calcularPicoComCandidato(hora, outrosNoDia);
      if (pico > capacidade){
        var sobrepostos = ocupantesQueSeSobrepoem(hora, outrosNoDia).map(function(o){ return o.aluno; });
        conflitos.push({ dia: dia, hora: hora, ocupantes: sobrepostos, capacidade: capacidade, pico: pico });
      }
    });
    return conflitos;
  }

  function montarMensagemConflitoRecorrencia(conflitos){
    var nomesDiasSemana = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
    var linhas = conflitos.map(function(c){
      var nomes = c.ocupantes.map(function(a){ return a.nome + " (" + a.recorrencia.horarios[c.dia] + ")"; }).join(", ");
      return nomesDiasSemana[c.dia] + " às " + c.hora + " (sobrepõe " + nomes + "; capacidade: " + c.capacidade + ")";
    });
    return "Este horário se sobrepõe a outro já cadastrado (considerando aulas de ~50min): " + linhas.join("; ") + ". Confirma que quer salvar mesmo assim?";
  }

  // Dos dia+hora da recorrência que está sendo salva, retorna os que caem
  // fora da disponibilidade semanal configurada (quando ela estiver em uso —
  // ver disponibilidadeEstaConfigurada).
  function detectarForaDaDisponibilidade(horariosRecorrencia){
    var fora = [];
    Object.keys(horariosRecorrencia).forEach(function(dia){
      var hora = horariosRecorrencia[dia];
      if (estaForaDaDisponibilidade(Number(dia), hora)){
        fora.push({ dia: Number(dia), hora: hora });
      }
    });
    return fora;
  }

  function montarMensagemForaDisponibilidade(itens){
    var nomesDiasSemana = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
    var linhas = itens.map(function(i){ return nomesDiasSemana[i.dia] + " às " + i.hora; });
    return "Está(ão) fora da sua disponibilidade configurada: " + linhas.join(", ") + ".";
  }

  function concluirSalvarAluno(dados, horariosRecorrencia, editando){
    var alunoId;
    if (editando){
      var alunoExistente = getAluno(editingAlunoId);
      Object.assign(alunoExistente, dados);
      alunoId = editingAlunoId;
    } else {
      dados.id = uid();
      dados.ativo = true;
      state.alunos.push(dados);
      alunoId = dados.id;
    }

    salvarAlunoContinuacao(alunoId, horariosRecorrencia, editando);
  }

  async function salvarAlunoContinuacao(alunoId, horariosRecorrencia, editando){
    var idsParaRemover = editando ? limparAulasRecorrenciaFutura(alunoId) : [];
    var geradas = Object.keys(horariosRecorrencia).length > 0 ? gerarAulasAPartirDaRecorrencia(alunoId) : [];

    var resultado = await salvarEstado();   // aguarda para relatar a contagem real
    fecharModal("modal-aluno");
    editingAlunoId = null;
    renderAll();
    abrirDetalheAluno(alunoId);

    if (!resultado.ok){
      // Requisito 4: não afirmar que o aluno ou as aulas foram salvos quando
      // nem a gravação nem a recarga de verificação deram certo.
      mostrarToast("Não foi possível confirmar no servidor o que foi salvo. Verifique sua conexão e revise os dados do aluno.");
      return;
    }
    if (resultado.origem === "recarga"){
      // A persistência direta falhou no meio do caminho; a recarga só
      // confirma uma FOTO do estado atual, não que esta operação específica
      // (trocar a recorrência, gerar as novas aulas) tenha sido concluída
      // por completo. Nada de "recorrência atualizada" aqui — só o fato
      // objetivo e um convite a verificar.
      mostrarToast("Seus dados foram recarregados após uma falha ao salvar. Verifique a agenda do aluno: a atualização da recorrência pode não ter sido concluída por completo.");
      return;
    }
    var removidas = contarRemocoesConfirmadas(idsParaRemover);
    var r = contarRecorrentesSalvas(geradas, resultado.falhasAulas);
    var naoAgendadas = r.rejeitadas + r.naoConfirmadas;
    if (removidas > 0 && r.salvas > 0){
      var extra = naoAgendadas > 0 ? " ("+naoAgendadas+" não agendada(s))" : "";
      mostrarToast("Recorrência atualizada: "+removidas+" aula(s) futura(s) do padrão antigo substituída(s) por "+r.salvas+" no novo padrão"+extra+".");
    } else if (removidas > 0 && r.salvas === 0 && geradas.length === 0){
      mostrarToast(removidas+" aula(s) futura(s) do padrão antigo foram removidas da agenda.");
    } else if (geradas.length > 0){
      mostrarToast(mensagemRecorrencia(r.salvas, r.rejeitadas, r.naoConfirmadas));
    }
  };

  // ---------- aulas ----------
  window.abrirModalAula = function(){
    remarcandoId = null;
    document.getElementById("modal-aula-titulo").textContent = "Nova aula";
    var sel = document.getElementById("fa-aluno");
    sel.innerHTML = state.alunos.filter(function(a){return a.ativo;}).map(function(a){
      return '<option value="'+a.id+'">'+esc(a.nome)+'</option>';
    }).join("");
    document.getElementById("fa-data").value = fmtData(agendaData);
    document.getElementById("fa-hora").value = "07:00";
    atualizarResumoAula();
    abrirModal("modal-aula");
  };

  // resumo visual do modal "Nova aula": apenas reflete os campos já preenchidos
  // (aluno, data, horário), sem introduzir duração ou qualquer dado novo.
  window.atualizarResumoAula = function(){
    var elResumo = document.getElementById("aula-resumo-conteudo");
    if (!elResumo) return;
    var selEl = document.getElementById("fa-aluno");
    var dataVal = document.getElementById("fa-data").value;
    var horaVal = document.getElementById("fa-hora").value;
    var alunoNome = (selEl && selEl.selectedOptions && selEl.selectedOptions[0]) ? selEl.selectedOptions[0].textContent : "—";
    var dataLabel = "—";
    if (dataVal){
      var d = new Date(dataVal+"T00:00:00");
      dataLabel = fmtDataBR(dataVal) + " (" + DIAS[d.getDay()] + ")";
    }
    elResumo.innerHTML =
      '<div class="aula-resumo-linha"><span>Aluno</span><span>'+alunoNome+'</span></div>'+
      '<div class="aula-resumo-linha"><span>Data</span><span>'+dataLabel+'</span></div>'+
      '<div class="aula-resumo-linha"><span>Horário</span><span>'+(horaVal||"—")+'</span></div>';
  };

  window.abrirModalRemarcar = function(aulaId){
    var aulaOriginal = null;
    state.aulas.forEach(function(c){ if (c.id===aulaId) aulaOriginal = c; });
    if (!aulaOriginal) return;
    remarcandoId = aulaId;
    document.getElementById("modal-aula-titulo").textContent = "Remarcar aula";
    var sel = document.getElementById("fa-aluno");
    sel.innerHTML = state.alunos.filter(function(a){return a.ativo;}).map(function(a){
      return '<option value="'+a.id+'">'+esc(a.nome)+'</option>';
    }).join("");
    sel.value = aulaOriginal.alunoId;
    var novaData = new Date(aulaOriginal.data+"T00:00:00");
    novaData.setDate(novaData.getDate()+1);
    document.getElementById("fa-data").value = fmtData(novaData);
    document.getElementById("fa-hora").value = aulaOriginal.hora;
    atualizarResumoAula();
    abrirModal("modal-aula");
  };

  // Reverte o faturamento de uma aula já faturada (usado tanto ao cancelar
  // quanto ao estornar uma conclusão): subtrai o valor travado da cobrança
  // pendente associada, tira a aula de dentro dela, e remove a cobrança se
  // ela ficou órfã (só no caso avulsa, sem chaveReferencia — um container
  // de período mensal/semanal fica em zero mas continua existindo). Nunca
  // mexe numa cobrança que já foi marcada como paga.
  function reverterFaturamentoDaAula(aula){
    var pagamentoAssociado = null;
    state.pagamentos.forEach(function(p){
      if ((p.aulaIds||[]).indexOf(aula.id) !== -1) pagamentoAssociado = p;
    });
    if (pagamentoAssociado && pagamentoAssociado.status === "pendente"){
      pagamentoAssociado.valor = Math.max(0, pagamentoAssociado.valor - aula.valorFaturado);
      pagamentoAssociado.aulaIds = (pagamentoAssociado.aulaIds||[]).filter(function(aid){ return aid !== aula.id; });
      aula.faturada = false;
      aula.valorFaturado = null;
      if (!pagamentoAssociado.chaveReferencia && pagamentoAssociado.aulaIds.length === 0){
        // cobrança avulsa (uma aula = uma cobrança própria): sem nenhuma
        // aula vinculada, o lançamento não representa mais nada.
        state.pagamentos = state.pagamentos.filter(function(p){ return p.id !== pagamentoAssociado.id; });
      }
    }
    // Se a cobrança associada já estava paga, não mexe nela (mesma regra de
    // nunca alterar o que já foi recebido) — fica como ajuste manual a
    // cargo do personal perceber.
  }

  window.cancelarAula = function(id){
    var aula = null;
    state.aulas.forEach(function(c){ if (c.id===id) aula = c; });
    if (!aula) return;
    var estavaFaturada = !!aula.faturada && (aula.valorFaturado===0 || !!aula.valorFaturado);
    aula.status = "cancelada";

    if (estavaFaturada){
      reverterFaturamentoDaAula(aula);
    }

    salvarEstado(); renderAll();
    mostrarToast("Aula cancelada.");
  };

  // Desfaz a conclusão de uma aula (ex.: marcada como concluída por engano):
  // volta o status para "agendada" e reverte o faturamento gerado, com a
  // MESMA lógica de reversão usada no cancelamento. Nunca mexe em cobrança
  // já paga (ver reverterFaturamentoDaAula).
  window.estornarConclusao = function(id){
    var aula = null;
    state.aulas.forEach(function(c){ if (c.id===id) aula = c; });
    if (!aula || aula.status !== "concluida") return;
    var estavaFaturada = !!aula.faturada && (aula.valorFaturado===0 || !!aula.valorFaturado);
    aula.status = "agendada";

    if (estavaFaturada){
      reverterFaturamentoDaAula(aula);
    }

    salvarEstado(); renderAll();
    mostrarToast("Conclusão estornada. A aula voltou para agendada.");
  };

  var confirmacaoPendente = null;
  function pedirConfirmacao(titulo, mensagem, labelBotao, callback){
    document.getElementById("confirmar-titulo").textContent = titulo;
    document.getElementById("confirmar-mensagem").textContent = mensagem;
    document.getElementById("confirmar-botao").textContent = labelBotao;
    confirmacaoPendente = callback;
    abrirModal("modal-confirmar");
  }
  window.executarConfirmacao = function(){
    var cb = confirmacaoPendente;
    confirmacaoPendente = null;
    fecharModal("modal-confirmar");
    if (cb) cb();
  };

  window.confirmarConcluir = function(id){
    var aula = null;
    state.aulas.forEach(function(c){ if (c.id===id) aula = c; });
    if (aula && aulaEhFutura(aula)){
      mostrarToast("Essa aula ainda não aconteceu — não dá para concluir uma aula futura.");
      return;
    }
    pedirConfirmacao("Concluir aula", "Confirma que essa aula foi dada? Se o aluno pagar por aula, isso já gera a cobrança.", "Concluir", function(){ concluirAula(id); });
  };
  window.confirmarCancelar = function(id){
    pedirConfirmacao("Cancelar aula", "Tem certeza que quer cancelar essa aula? Essa ação pode ser desfeita remarcando depois.", "Cancelar aula", function(){ cancelarAula(id); invocarPush({ tipo:"aula_cancelada", aula_id:id }); });
  };
  window.confirmarEstornarConclusao = function(id){
    pedirConfirmacao("Estornar conclusão", "Isso volta a aula para agendada e desfaz a cobrança gerada por ela (se a cobrança já tiver sido paga, ela não é alterada). Tem certeza?", "Estornar", function(){ estornarConclusao(id); });
  };

  window.salvarAula = async function(ev){
    ev.preventDefault();
    var data = document.getElementById("fa-data").value;
    var hora = document.getElementById("fa-hora").value;

    if (remarcandoId){
      // C2 — Remarcação atômica: a RPC cria a nova aula e marca a original na
      // mesma transação no banco. Se a nova colidir por capacidade (LT004) ou
      // qualquer outra validação, a função aborta e a original fica intacta.
      // O aluno/professor/duração são preservados da original pela própria RPC
      // (o seletor de aluno do modal é ignorado na remarcação, por desenho).
      var idOriginal = remarcandoId;
      var btn = document.getElementById("modal-aula-submit");
      var novaRemarcadaId = null;
      if (btn) btn.disabled = true;
      try {
        // A RPC + o alinhamento de estado/snapshot rodam DENTRO da fila, após
        // qualquer sincronização pendente, para não disputar estado nem ser
        // reenviada como atualização local (risco 1). O estado só é mutado em
        // caso de sucesso, então uma falha nunca deixa alteração local parcial.
        await enfileirar(function(){
          return sb.rpc("remarcar_aula", {
            p_aula_original_id: idOriginal,
            p_nova_data: data,
            p_nova_hora: hora
          }).then(function(r){
            if (r.error) throw r.error;
            var nova = rowToAula(r.data);
            novaRemarcadaId = nova.id;
            if (!state.aulas.some(function(c){ return c.id===nova.id; })) state.aulas.push(nova);
            var origObj = null;
            state.aulas.forEach(function(c){
              if (c.id===idOriginal){ c.status = "remarcada"; c.remarcadaParaId = nova.id; origObj = c; }
            });
            ultimoSnapshot.aulas[nova.id] = JSON.stringify(nova);
            if (origObj) ultimoSnapshot.aulas[idOriginal] = JSON.stringify(origObj);
          });
        });
        remarcandoId = null;
        if (btn) btn.disabled = false;
        if (novaRemarcadaId) invocarPush({ tipo:"aula_remarcada", aula_id:novaRemarcadaId });
        fecharModal("modal-aula");
        renderAll();
        mostrarToast("Aula remarcada.");
      } catch(err){
        if (btn) btn.disabled = false;
        mostrarToast(mensagemErroRemarcacao(err));
      }
      return;
    }

    // Nova aula (fluxo otimista): entra no estado e a sincronização valida a
    // capacidade; se houver conflito real de capacidade, a reconciliação
    // remove e avisa (ver mensagemErroRemarcacao/sincronizarAulas).
    function criarNovaAulaEFechar(){
      var novaAula = {
        id: uid(), alunoId: document.getElementById("fa-aluno").value,
        data: data, hora: hora, status: "agendada", faturada: false, origem: "manual"
      };
      state.aulas.push(novaAula);
      salvarEstado();
      fecharModal("modal-aula");
      renderAll();
    }

    // Antes de lançar direto, avisa (não bloqueia) se já existe outro aluno
    // no mesmo horário — pode ser engano de digitação, ou pode ser
    // intencional (personal que dá aula em grupo, com capacidade simultânea
    // configurada > 1 no perfil). A capacidade de verdade continua sendo
    // garantida pela trigger do banco (LT004); isso aqui é só para o
    // personal não lançar sem perceber que já tem alguém nesse horário.
    // Mesma data, qualquer aula ocupante — a sobreposição é de JANELA
    // (~50min cada, igual ao fallback da trigger do banco), não de horário
    // exato: duas aulas 45min "distantes" ainda podem se cruzar.
    var ocupantesDoDia = state.aulas.filter(function(c){
      return c.data === data &&
        (c.status==="agendada" || c.status==="confirmada" || c.status==="concluida");
    }).map(function(c){ return { hora: c.hora }; });
    var capacidade = (state.professor && state.professor.capacidadeSimultanea) || 1;
    var pico = calcularPicoComCandidato(hora, ocupantesDoDia);

    var avisos = [];
    if (pico > capacidade){
      var qtdSobrepondo = ocupantesQueSeSobrepoem(hora, ocupantesDoDia).length;
      avisos.push("Já tem "+qtdSobrepondo+" aula(s) que se sobrepõe(m) às "+hora+" em "+fmtDataBR(data)+" (considerando aulas de ~50min; capacidade configurada: "+capacidade+").");
    }
    if (estaForaDaDisponibilidade(diaSemanaDeData(data), hora)){
      avisos.push("Esse horário está fora da sua disponibilidade configurada para esse dia da semana.");
    }
    var bloqueio = bloqueioQueCobre(data, hora);
    if (bloqueio){
      avisos.push("Esse horário está dentro de um bloqueio que você cadastrou: " + descricaoBloqueio(bloqueio) + ".");
    }

    if (avisos.length > 0){
      pedirConfirmacao(
        "Atenção ao agendar",
        avisos.join(" ") + " Confirma que quer agendar mesmo assim?",
        "Agendar mesmo assim",
        criarNovaAulaEFechar
      );
      return;
    }
    criarNovaAulaEFechar();
  };

  function mensagemErroRemarcacao(err){
    var code = (err && err.code) || "";
    var msg = (err && err.message) || "";
    if (code === "LT004" || /LT004/.test(msg))
      return "Não foi possível remarcar: o novo horário excede a capacidade simultânea. A aula original foi mantida.";
    if (code === "LT011" || /LT011/.test(msg))
      return "Essa aula não pode ser remarcada (o status atual não permite).";
    if (code === "LT010" || /LT010/.test(msg))
      return "Aula original não encontrada.";
    if (code === "LT009" || /LT009/.test(msg))
      return "Configuração de isolamento incompatível no servidor. Nenhuma alteração foi feita.";
    return "Não foi possível remarcar agora. A aula original foi mantida.";
  }

  window.filtrarAlunos = function(valor){
    alunoBuscaTermo = valor;
    renderAlunos();
  };
  window.filtrarStatusAlunos = function(valor){
    alunoFiltroStatus = valor;
    renderAlunos();
  };
  window.filtrarCicloAlunos = function(valor){
    alunoFiltroCiclo = valor;
    renderAlunos();
  };
  window.ordenarAlunos = function(valor){
    alunoOrdenacao = valor;
    renderAlunos();
  };
  window.filtrarAgenda = function(valor){
    agendaBusca = valor;
    renderAgenda();
  };
  window.irParaDataEspecifica = function(valor){
    if (!valor) return;
    agendaData = new Date(valor+"T00:00:00");
    renderAgenda();
  };

  window.mudarModoAgenda = function(modo){
    agendaModo = modo;
    renderAgenda();
  };
  window.mudarCursorAgenda = function(delta){
    agendaData.setDate(agendaData.getDate() + delta * (agendaModo==="semana" ? 7 : 1));
    renderAgenda();
  };
  window.irParaHoje = function(){
    agendaData = new Date(hoje);
    renderAgenda();
  };
  window.irParaDiaPill = function(dStr){
    agendaData = new Date(dStr+"T00:00:00");
    renderAgenda();
  };
  window.abrirAulaDaGrade = function(aulaId){
    var aula = null;
    state.aulas.forEach(function(c){ if (c.id===aulaId) aula = c; });
    if (!aula) return;
    agendaData = new Date(aula.data+"T00:00:00");
    agendaModo = "dia";
    renderAgenda();
  };

  window.confirmarAula = function(id){
    state.aulas.forEach(function(c){ if (c.id===id) c.status="confirmada"; });
    salvarEstado(); renderAll();
  };

  // ---------- cobrança automática por período ----------
  // Dado um tipo de ciclo (mensal/semanal) e uma data qualquer, devolve o
  // período a que essa data pertence (início, fim, chave de referência e
  // rótulo). Usado tanto para "hoje" quanto para a data de uma aula
  // concluída com atraso — é isso que garante que uma aula atrasada caia no
  // período CORRETO dela, não no período corrente (requisito F acordado).
  function periodoDoCiclo(tipo, dataStr){
    var d = new Date(dataStr+"T00:00:00");
    if (tipo === "semanal"){
      var ini = new Date(d); ini.setDate(d.getDate()-d.getDay());
      var fim = new Date(ini); fim.setDate(ini.getDate()+6);
      var iniStr = fmtData(ini), fimStr = fmtData(fim);
      return {
        inicio: iniStr, fim: fimStr,
        chaveReferencia: "semana-"+iniStr,
        mesReferencia: iniStr.slice(0,7),
        labelPeriodo: "Semana de "+fmtDataBR(iniStr)+" a "+fmtDataBR(fimStr)
      };
    }
    var ano = d.getFullYear(), mes = d.getMonth();
    var iniStr = ano+"-"+String(mes+1).padStart(2,"0")+"-01";
    var fimStr = fmtData(new Date(ano, mes+1, 0));
    return {
      inicio: iniStr, fim: fimStr,
      chaveReferencia: "mes-"+iniStr.slice(0,7),
      mesReferencia: iniStr.slice(0,7),
      labelPeriodo: "Mensalidade de "+MESES[mes]+" de "+ano
    };
  }
  function calcularVencimentoPeriodo(fimPeriodo, diasVencimento){
    return addDias(fimPeriodo, (diasVencimento===0||diasVencimento) ? diasVencimento : 5);
  }
  function buscarPagamentoPorChave(alunoId, chaveReferencia){
    var achado = null;
    state.pagamentos.forEach(function(p){ if (p.alunoId===alunoId && p.chaveReferencia===chaveReferencia) achado = p; });
    return achado;
  }

  window.concluirAula = function(id){
    var aula = null;
    state.aulas.forEach(function(c){ if (c.id===id) aula = c; });
    if (!aula) return;
    // Trava de negócio (não só de UI — ver confirmarConcluir): nunca marcar
    // como concluída uma aula que ainda não aconteceu, mesmo que o botão
    // tenha sido acionado por algum caminho que não passe pela checagem da
    // tela (ex.: duplo clique antes do re-render esconder o botão).
    if (aulaEhFutura(aula)){
      mostrarToast("Essa aula ainda não aconteceu — não dá para concluir uma aula futura.");
      return;
    }
    aula.status = "concluida";
    var aluno = getAluno(aula.alunoId);
    var gerouOuAtualizouCobranca = false;

    if (aluno && aluno.plano.cobranca === "por_aula" && !aula.faturada){
      aula.faturada = true;
      aula.valorFaturado = aluno.plano.valorAula;
      gerouOuAtualizouCobranca = true;

      if (aluno.plano.tipo === "avulsa"){
        // avulsa: cada aula é sua própria cobrança, vencendo na própria data
        // (comportamento original, preservado).
        state.pagamentos.push({
          id: uid(), alunoId: aluno.id, valor: aluno.plano.valorAula,
          referencia: "Aula de "+fmtDataBR(aula.data), status: "pendente",
          mesReferencia: aula.data.slice(0,7), dataVencimento: aula.data, aulaIds: [aula.id]
        });
      } else {
        // mensal/semanal por_aula: agrupa no lançamento do período da DATA
        // DA AULA (não de hoje) — requisito F.
        var periodo = periodoDoCiclo(aluno.plano.tipo, aula.data);
        var existente = buscarPagamentoPorChave(aluno.id, periodo.chaveReferencia);
        if (existente && existente.status === "pendente"){
          existente.valor += aluno.plano.valorAula;
          existente.aulaIds = (existente.aulaIds||[]).concat([aula.id]);
          existente.referencia = periodo.labelPeriodo;
          // Recalcula o vencimento sempre que o lançamento (ainda pendente)
          // é tocado: cobre tanto um lançamento legado criado pelo mecanismo
          // manual antigo (vencimento "dia 10 do mesmo mês") quanto uma
          // mudança nos dias de vencimento do aluno no meio do período —
          // nos dois casos, o vencimento correto é o calculado agora, nunca
          // o que ficou gravado antes.
          existente.dataVencimento = calcularVencimentoPeriodo(periodo.fim, aluno.plano.diasVencimento);
        } else if (existente && existente.status === "pago"){
          // período já fechado e pago: nunca reabre um lançamento quitado —
          // lança um ajuste à parte (requisito G, caso de borda).
          state.pagamentos.push({
            id: uid(), alunoId: aluno.id, valor: aluno.plano.valorAula,
            referencia: "Ajuste — aula de "+fmtDataBR(aula.data)+" ("+periodo.labelPeriodo+", período já cobrado)",
            status: "pendente", chaveReferencia: periodo.chaveReferencia+"-ajuste-"+aula.id,
            mesReferencia: periodo.mesReferencia, dataVencimento: fmtData(hoje), aulaIds: [aula.id]
          });
        } else {
          state.pagamentos.push({
            id: uid(), alunoId: aluno.id, valor: aluno.plano.valorAula,
            referencia: periodo.labelPeriodo, status: "pendente",
            chaveReferencia: periodo.chaveReferencia, mesReferencia: periodo.mesReferencia,
            dataVencimento: calcularVencimentoPeriodo(periodo.fim, aluno.plano.diasVencimento),
            aulaIds: [aula.id]
          });
        }
      }
    }
    salvarEstado(); renderAll();
    mostrarToast(gerouOuAtualizouCobranca ? "Aula concluída e cobrança atualizada." : "Aula marcada como concluída.");
  };

  // Cria (se ainda não existir) o lançamento "container" de um período para
  // um aluno mensal/semanal. Plano fixo: valor cheio direto. Plano por
  // aula: soma o que já estiver concluído e ainda não faturado nesse
  // período (cobre tanto backfill de período fechado quanto o período
  // corrente ainda em andamento) — nunca conta de novo uma aula que
  // concluirAula() já tenha faturado.
  function criarContainerDoPeriodo(aluno, periodo){
    var valor = 0, aulaIds = [];
    if (aluno.plano.cobranca === "fixa"){
      valor = aluno.plano.valorFixo;
    } else {
      state.aulas.forEach(function(c){
        if (c.alunoId===aluno.id && c.status==="concluida" && !c.faturada &&
            c.data>=periodo.inicio && c.data<=periodo.fim){
          c.faturada = true;
          c.valorFaturado = aluno.plano.valorAula;
          valor += aluno.plano.valorAula;
          aulaIds.push(c.id);
        }
      });
    }
    state.pagamentos.push({
      id: uid(), alunoId: aluno.id, valor: valor, referencia: periodo.labelPeriodo,
      status: "pendente", chaveReferencia: periodo.chaveReferencia, mesReferencia: periodo.mesReferencia,
      dataVencimento: calcularVencimentoPeriodo(periodo.fim, aluno.plano.diasVencimento),
      aulaIds: aulaIds
    });
  }

  // Roda uma vez a cada carregamento de dados: garante que todo aluno ativo
  // mensal/semanal tenha o lançamento do período corrente (mesmo vazio, para
  // já aparecer desde o início — requisito A) e preenche retroativamente
  // qualquer período que tenha ficado sem lançamento (requisito C — cobre o
  // caso de o personal passar dias sem abrir o sistema).
  function sincronizarCobrancasAutomaticas(){
    var hojeStr = fmtData(hoje);
    var criouAlgo = false;

    state.alunos.filter(function(a){
      return a.ativo && (a.plano.tipo==="mensal" || a.plano.tipo==="semanal");
    }).forEach(function(aluno){
      var tipo = aluno.plano.tipo;
      var pagamentosPorChave = {};
      state.pagamentos.forEach(function(p){
        if (p.alunoId===aluno.id && p.chaveReferencia) pagamentosPorChave[p.chaveReferencia] = p;
      });

      var periodoAtual = periodoDoCiclo(tipo, hojeStr);
      var cursor = (aluno.dataCadastro ? String(aluno.dataCadastro).slice(0,10) : hojeStr);
      var guard = 0;
      while (guard < 130){ // trava de segurança (~10 anos de histórico mensal)
        guard++;
        var periodo = periodoDoCiclo(tipo, cursor);
        var existente = pagamentosPorChave[periodo.chaveReferencia];
        if (!existente){
          criarContainerDoPeriodo(aluno, periodo);
          pagamentosPorChave[periodo.chaveReferencia] = true;
          criouAlgo = true;
        } else if (existente.status === "pendente"){
          // Reconcilia um lançamento pendente já existente (inclusive
          // lançamentos legados, de antes dessa automação, que podem ter o
          // vencimento calculado do jeito antigo) com o vencimento e rótulo
          // corretos de hoje. Nunca mexe em valor aqui — só data/rótulo — e
          // nunca toca em lançamento já pago.
          var vencCorreto = calcularVencimentoPeriodo(periodo.fim, aluno.plano.diasVencimento);
          if (existente.dataVencimento !== vencCorreto || existente.referencia !== periodo.labelPeriodo){
            existente.dataVencimento = vencCorreto;
            existente.referencia = periodo.labelPeriodo;
            criouAlgo = true;
          }
        }
        if (periodo.chaveReferencia === periodoAtual.chaveReferencia) break;
        cursor = addDias(periodo.fim, 1);
      }
    });

    if (criouAlgo){ salvarEstado(); }
  }

  // Duração padrão de uma aula quando nada foi configurado, EXATAMENTE igual
  // ao fallback usado pela trigger de capacidade no banco (migração 0004:
  // coalesce(profiles.duracao_habitual_min, 50)). O front-end ainda não tem
  // um campo de duração habitual por aula/professor, então toda aula hoje
  // efetivamente dura 50min aos olhos do servidor — por isso os avisos de
  // conflito aqui precisam considerar a JANELA de 50min, não só o horário
  // exato, senão o personal só descobre o conflito quando o banco rejeita.
  var DURACAO_PADRAO_MIN = 50;

  function paraMinutos(hhmm){
    var p = (hhmm || "00:00").split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  // Replica a lógica de "pico real de concorrência" da trigger do banco
  // (validar_capacidade_aula): considera o candidato + qualquer ocupante
  // existente cujo início caia dentro da janela do candidato, e para cada um
  // desses instantes conta quantos estão ativos ao mesmo tempo. Retorna o
  // maior valor encontrado (o pico).
  function calcularPicoComCandidato(horaCandidato, ocupantes){
    var inicioCand = paraMinutos(horaCandidato), fimCand = inicioCand + DURACAO_PADRAO_MIN;
    var instantes = [inicioCand];
    ocupantes.forEach(function(o){
      var ini = paraMinutos(o.hora);
      if (ini >= inicioCand && ini < fimCand) instantes.push(ini);
    });
    var pico = 0;
    instantes.forEach(function(inst){
      var count = 1; // o próprio candidato está presente em qualquer instante dentro da sua janela
      ocupantes.forEach(function(o){
        var ini = paraMinutos(o.hora), fim = ini + DURACAO_PADRAO_MIN;
        if (ini <= inst && inst < fim) count++;
      });
      if (count > pico) pico = count;
    });
    return pico;
  }

  // Dos ocupantes informados, retorna só os que realmente se sobrepõem à
  // janela do candidato (para montar a mensagem de aviso com nomes corretos).
  function ocupantesQueSeSobrepoem(horaCandidato, ocupantes){
    var inicioCand = paraMinutos(horaCandidato), fimCand = inicioCand + DURACAO_PADRAO_MIN;
    return ocupantes.filter(function(o){
      var ini = paraMinutos(o.hora), fim = ini + DURACAO_PADRAO_MIN;
      return ini < fimCand && fim > inicioCand;
    });
  }

  // ---------- disponibilidade e bloqueios ----------
  function diaSemanaDeData(dataStr){
    return new Date(dataStr + "T00:00:00").getDay();
  }

  // Sem NENHUMA linha configurada (em qualquer dia), a disponibilidade não
  // está em uso ainda — não restringe nada, para não quebrar quem nunca
  // configurou isso. A partir do momento em que existe ao menos 1 linha
  // ativa em QUALQUER dia, passa a valer a regra: um dia sem nenhuma janela
  // ativa é um dia sem disponibilidade (ex.: personal que só atende seg-sex
  // não precisa marcar sáb/dom como "bloqueado", só não os preenche).
  function disponibilidadeEstaConfigurada(){
    return state.disponibilidade.some(function(d){ return d.ativo; });
  }

  function estaForaDaDisponibilidade(diaSemana, hora){
    if (!disponibilidadeEstaConfigurada()) return false;
    var inicioCand = paraMinutos(hora), fimCand = inicioCand + DURACAO_PADRAO_MIN;
    var janelasDoDia = state.disponibilidade.filter(function(d){ return d.ativo && d.diaSemana === diaSemana; });
    var cabeInteira = janelasDoDia.some(function(j){
      return paraMinutos(j.horaInicio) <= inicioCand && fimCand <= paraMinutos(j.horaFim);
    });
    return !cabeInteira;
  }

  function bloqueioQueCobre(dataStr, hora){
    var inicioCand = paraMinutos(hora), fimCand = inicioCand + DURACAO_PADRAO_MIN;
    var encontrado = null;
    state.bloqueios.forEach(function(b){
      if (encontrado) return;
      if (dataStr < b.dataInicio || dataStr > b.dataFim) return;
      if (!b.horaInicio && !b.horaFim){ encontrado = b; return; } // dia inteiro
      var iniB = paraMinutos(b.horaInicio), fimB = paraMinutos(b.horaFim);
      if (iniB < fimCand && fimB > inicioCand) encontrado = b;
    });
    return encontrado;
  }

  function descricaoBloqueio(b){
    var periodo = b.dataInicio === b.dataFim ? fmtDataBR(b.dataInicio) : (fmtDataBR(b.dataInicio) + " a " + fmtDataBR(b.dataFim));
    var horaParte = (b.horaInicio && b.horaFim) ? (" " + b.horaInicio + "–" + b.horaFim) : " (dia inteiro)";
    return periodo + horaParte + (b.motivo ? " — " + b.motivo : "");
  }

  function recorrenciaLabel(rec){
    if (!rec || !rec.horarios) return null;
    var chaves = Object.keys(rec.horarios);
    if (chaves.length===0) return null;
    var nomes = ["dom","seg","ter","qua","qui","sex","sáb"];
    var partes = chaves.map(Number).sort(function(a,b){ return a-b; }).map(function(d){
      return capitalizar(nomes[d]) + " " + rec.horarios[d];
    });
    return partes.join(", ");
  }

  var HORIZONTE_RECORRENCIA_SEMANAS = 8;

  // Devolve os IDS removidos localmente (não uma contagem), para que o
  // chamador possa, DEPOIS da persistência/reconciliação, verificar quais
  // realmente desapareceram no servidor — uma exclusão otimista aqui não é
  // garantia de exclusão confirmada (ver sincronizarAulas: uma falha de
  // DELETE traz o registro de volta ao estado local).
  function limparAulasRecorrenciaFutura(alunoId){
    var hojeStr = fmtData(hoje);
    var idsRemovidos = [];
    state.aulas = state.aulas.filter(function(c){
      var remover = c.alunoId===alunoId && c.origem==="recorrencia" && c.status==="agendada" && c.data>=hojeStr;
      if (remover) idsRemovidos.push(c.id);
      return !remover;
    });
    return idsRemovidos;
  }

  // Dada a lista de ids removidos localmente, conta quantos estão
  // CONFIRMADAMENTE ausentes de state.aulas depois da persistência/recarga
  // (verdade do servidor) — nunca apenas a contagem otimista local.
  function contarRemocoesConfirmadas(idsRemovidos){
    return idsRemovidos.filter(function(id){
      return !state.aulas.some(function(c){ return c.id===id; });
    }).length;
  }

  // Retorna a lista de ocorrências CRIADAS (objetos), para que o chamador
  // possa, após a persistência, saber quantas realmente foram salvas e
  // quantas foram rejeitadas pela trigger de capacidade.
  function gerarAulasAPartirDaRecorrencia(alunoId){
    var aluno = getAluno(alunoId);
    var horarios = aluno.recorrencia && aluno.recorrencia.horarios;
    if (!horarios || Object.keys(horarios).length===0) return [];
    var criadas = [];
    var cursor = new Date(hoje);
    for (var i=0; i<HORIZONTE_RECORRENCIA_SEMANAS*7; i++){
      var dStr = fmtData(cursor);
      var horarioDoDia = horarios[cursor.getDay()];
      if (horarioDoDia){
        var existeNoDia = state.aulas.some(function(c){ return c.alunoId===alunoId && c.data===dStr; });
        if (!existeNoDia){
          var ocorrencia = { id: uid(), alunoId: alunoId, data: dStr, hora: horarioDoDia, status: "agendada", faturada: false, origem: "recorrencia" };
          state.aulas.push(ocorrencia);
          criadas.push(ocorrencia);
        }
      }
      cursor.setDate(cursor.getDate()+1);
    }
    return criadas;
  }

  // Dada a lista de ocorrências geradas e as falhas efetivas de aulas
  // devolvidas por salvarEstado(), classifica cada ocorrência em:
  //   salva        — presente em state.aulas após a reconciliação (verdade
  //                  do servidor, não mera presença otimista pré-gravação).
  //   rejeitada     — ausente E com uma falha LT004 registrada para o id.
  //   naoConfirmada — ausente, mas SEM falha LT004 conhecida (a causa real
  //                  pode ser outro erro de banco, ou a falha ocorreu em
  //                  outra tabela antes da sincronização de aulas rodar, ou
  //                  a recarga de verificação falhou). Nunca é rotulada como
  //                  "conflito de horário" sem evidência de LT004.
  function contarRecorrentesSalvas(geradas, falhasAulas){
    var porCapacidade = {};
    (falhasAulas || []).forEach(function(f){
      var code = (f.error && f.error.code) || "";
      var msg = (f.error && f.error.message) || "";
      if (f.item && (code === "LT004" || /LT004/.test(msg))) porCapacidade[f.item.id] = true;
    });
    var salvas = 0, rejeitadas = 0, naoConfirmadas = 0;
    geradas.forEach(function(o){
      if (state.aulas.some(function(c){ return c.id===o.id; })) salvas++;
      else if (porCapacidade[o.id]) rejeitadas++;
      else naoConfirmadas++;
    });
    return { salvas: salvas, rejeitadas: rejeitadas, naoConfirmadas: naoConfirmadas };
  }

  window.gerarAulasRecorrentes = async function(alunoId){
    var aluno = getAluno(alunoId);
    var horarios = aluno.recorrencia && aluno.recorrencia.horarios;
    if (!horarios || Object.keys(horarios).length===0){
      mostrarToast("Defina os dias e horários fixos desse aluno primeiro.");
      return;
    }
    var geradas = gerarAulasAPartirDaRecorrencia(alunoId);
    if (geradas.length===0){
      renderAll();
      abrirDetalheAluno(alunoId);
      mostrarToast("Nada novo: essas datas já estavam na agenda.");
      return;
    }
    var resultado = await salvarEstado();   // só conta depois de saber o que persistiu
    renderAll();
    abrirDetalheAluno(alunoId);
    if (!resultado.ok){
      // Requisito 4: nunca apresentar confirmação de sucesso quando a
      // gravação e a recarga de verificação falharem — nem "salvas", nem
      // "rejeitadas por conflito", porque não há como saber.
      mostrarToast("Não foi possível confirmar se as aulas recorrentes foram salvas no servidor. Verifique sua conexão e revise a agenda do aluno.");
      return;
    }
    if (resultado.origem === "recarga"){
      // A persistência direta falhou no meio do caminho; a recarga só
      // confirma a foto atual do servidor, não que esta geração específica
      // foi concluída por completo (pode ter parado antes de tentar algumas
      // das ocorrências desta chamada).
      mostrarToast("Seus dados foram recarregados após uma falha ao salvar. Verifique a agenda do aluno: a geração de aulas recorrentes pode não ter sido concluída por completo.");
      return;
    }
    var r = contarRecorrentesSalvas(geradas, resultado.falhasAulas);
    mostrarToast(mensagemRecorrencia(r.salvas, r.rejeitadas, r.naoConfirmadas));
  };

  function mensagemRecorrencia(salvas, rejeitadas, naoConfirmadas){
    var partes = [];
    if (salvas>0) partes.push(salvas+" aula(s) recorrente(s) entraram na agenda (próximas "+HORIZONTE_RECORRENCIA_SEMANAS+" semanas).");
    if (rejeitadas>0) partes.push(rejeitadas+" não foram agendadas por conflito de capacidade.");
    if (naoConfirmadas>0) partes.push(naoConfirmadas+" não foram confirmadas no servidor (erro ao salvar).");
    if (!partes.length) return "Nenhuma aula recorrente nova.";
    return partes.join(" ");
  }

  window.marcarPago = function(id){
    state.pagamentos.forEach(function(p){
      if (p.id===id){ p.status="pago"; p.dataPagamento = fmtData(hoje); }
    });
    invocarPush({ tipo:"pagamento_confirmado", pagamento_id:id });
    salvarEstado(); renderAll();
    if (!document.getElementById("alunos-detalhe-view").hidden){
      var alunoId = null;
      state.pagamentos.forEach(function(p){ if (p.id===id) alunoId = p.alunoId; });
      if (alunoId) abrirDetalheAluno(alunoId);
    }
  };

  window.abrirCobranca = function(id){
    var p = null;
    state.pagamentos.forEach(function(x){ if (x.id===id) p=x; });
    var aluno = getAluno(p.alunoId);
    var msg = "Oi "+aluno.nome.split(" ")[0]+"! Passando para lembrar do pagamento referente a: "+p.referencia+", no valor de "+fmtMoeda(p.valor)+". Qualquer dúvida me chama por aqui. Obrigado!";
    document.getElementById("cobranca-texto").value = msg;
    document.getElementById("cobranca-link").href = whatsLink(aluno.telefone, msg);
    abrirModal("modal-cobranca");
  };
  document.getElementById("cobranca-texto").addEventListener("input", function(){
    var atual = document.getElementById("cobranca-link").href;
    var base = atual.split("?text=")[0];
    document.getElementById("cobranca-link").href = base + "?text=" + encodeURIComponent(this.value);
  });

  // ---------- perfil do professor ----------
  function atualizarPreviewLogo(){
    var preview = document.getElementById("perfil-logo-preview");
    var btnRemover = document.getElementById("btn-remover-logo");
    if (state.professor.logo){
      preview.innerHTML = '<img src="'+esc(state.professor.logo)+'" alt="Logo">';
      btnRemover.hidden = false;
    } else {
      preview.textContent = "Sem logo";
      btnRemover.hidden = true;
    }
  }

  function renderPerfil(){
    var p = state.professor;
    document.getElementById("f-perfil-nome").value = p.nome || "";
    document.getElementById("f-perfil-telefone").value = p.telefone || "";
    document.getElementById("f-perfil-pix").value = p.pix || "";
    document.getElementById("f-perfil-pix-tipo").value = p.pixTipo || "";
    document.getElementById("f-perfil-cidade").value = p.cidade || "";
    document.getElementById("f-perfil-capacidade").value = p.capacidadeSimultanea || 1;
    atualizarPreviewLogo();
    if (window.renderNotifPersonal) renderNotifPersonal();
  }

  // ---------- disponibilidade e bloqueios (tela) ----------
  function renderDisponibilidade(){
    document.querySelectorAll(".disp-dia-linha").forEach(function(linha){
      var dia = Number(linha.dataset.dia);
      var cb = linha.querySelector(".disp-dia-check");
      var inicioInput = linha.querySelector(".disp-dia-inicio");
      var fimInput = linha.querySelector(".disp-dia-fim");
      var row = null;
      state.disponibilidade.forEach(function(d){ if (d.diaSemana===dia && d.ativo) row = d; });
      cb.checked = !!row;
      cb.closest(".dia-chip-toggle").classList.toggle("selected", !!row);
      inicioInput.disabled = !row;
      fimInput.disabled = !row;
      inicioInput.value = row ? row.horaInicio : "";
      fimInput.value = row ? row.horaFim : "";
    });
    renderListaBloqueios();
  }

  window.toggleDispDia = function(cb){
    var linha = cb.closest(".disp-dia-linha");
    var inicioInput = linha.querySelector(".disp-dia-inicio");
    var fimInput = linha.querySelector(".disp-dia-fim");
    var chip = cb.closest(".dia-chip-toggle");
    chip.classList.toggle("selected", cb.checked);
    inicioInput.disabled = !cb.checked;
    fimInput.disabled = !cb.checked;
    if (cb.checked){
      if (!inicioInput.value) inicioInput.value = "07:00";
      if (!fimInput.value) fimInput.value = "20:00";
    }
  };

  // Salva a semana inteira de uma vez: para cada dia marcado, faz upsert da
  // janela (criando se não existia); para cada dia que tinha linha salva e
  // foi desmarcado, exclui. Vai direto ao banco (como salvarPerfil) em vez de
  // passar pelo fluxo otimista de alunos/aulas — é uma tela de configuração,
  // não dado operacional de agenda.
  window.salvarDisponibilidade = function(ev){
    ev.preventDefault();
    var paraSalvar = [], idsParaExcluir = [], erroValidacao = null;
    document.querySelectorAll(".disp-dia-linha").forEach(function(linha){
      if (erroValidacao) return;
      var dia = Number(linha.dataset.dia);
      var cb = linha.querySelector(".disp-dia-check");
      var inicioInput = linha.querySelector(".disp-dia-inicio");
      var fimInput = linha.querySelector(".disp-dia-fim");
      var existente = null;
      state.disponibilidade.forEach(function(d){ if (d.diaSemana===dia) existente = d; });
      if (cb.checked && inicioInput.value && fimInput.value){
        if (fimInput.value <= inicioInput.value){
          erroValidacao = "O horário final precisa ser depois do inicial (dia " + linha.querySelector("span").textContent + ").";
          return;
        }
        paraSalvar.push({
          id: (existente && existente.id) || uid(),
          diaSemana: dia, horaInicio: inicioInput.value, horaFim: fimInput.value, ativo: true
        });
      } else if (existente){
        idsParaExcluir.push(existente.id);
      }
    });
    if (erroValidacao){ mostrarToast(erroValidacao); return; }
    (async function(){
      try {
        if (paraSalvar.length){
          var r = await sb.from("disponibilidade_personal").upsert(paraSalvar.map(disponibilidadeToRow));
          if (r.error) throw r.error;
        }
        if (idsParaExcluir.length){
          var rd = await sb.from("disponibilidade_personal").delete().in("id", idsParaExcluir);
          if (rd.error) throw rd.error;
        }
        state.disponibilidade = paraSalvar;
        renderDisponibilidade();
        mostrarToast("Disponibilidade salva.");
      } catch(err){
        console.error(err);
        mostrarToast("Erro ao salvar a disponibilidade. Tente de novo.");
      }
    })();
  };

  window.toggleBloqueioDiaInteiro = function(cb){
    document.getElementById("campo-bloqueio-hora-inicio").hidden = cb.checked;
    document.getElementById("campo-bloqueio-hora-fim").hidden = cb.checked;
  };

  function renderListaBloqueios(){
    var el = document.getElementById("lista-bloqueios");
    if (!el) return;
    if (state.bloqueios.length === 0){
      el.innerHTML = '<div class="empty-state"><div class="display">Nenhum bloqueio cadastrado</div></div>';
      return;
    }
    var ordenados = state.bloqueios.slice().sort(function(a,b){ return a.dataInicio < b.dataInicio ? -1 : 1; });
    el.innerHTML = ordenados.map(function(b){
      return '<div class="card"><div class="card-row"><div class="card-main"><div class="card-title">'+descricaoBloqueio(b)+'</div></div>'+
        '<button class="btn sm ghost" onclick="removerBloqueio(\''+b.id+'\')">Remover</button></div></div>';
    }).join("");
  }

  window.adicionarBloqueio = function(ev){
    ev.preventDefault();
    var dataInicio = document.getElementById("f-bloqueio-data-inicio").value;
    var dataFim = document.getElementById("f-bloqueio-data-fim").value;
    var diaInteiro = document.getElementById("f-bloqueio-dia-inteiro").checked;
    var horaInicio = diaInteiro ? null : document.getElementById("f-bloqueio-hora-inicio").value;
    var horaFim = diaInteiro ? null : document.getElementById("f-bloqueio-hora-fim").value;
    var motivo = document.getElementById("f-bloqueio-motivo").value.trim();

    if (!dataInicio || !dataFim){ mostrarToast("Preencha as datas do bloqueio."); return; }
    if (dataFim < dataInicio){ mostrarToast("A data final precisa ser igual ou depois da inicial."); return; }
    if (!diaInteiro){
      if (!horaInicio || !horaFim){ mostrarToast("Preencha hora início e fim, ou marque \"Dia inteiro\"."); return; }
      if (horaFim <= horaInicio){ mostrarToast("A hora final precisa ser depois da inicial."); return; }
      if (dataFim !== dataInicio){ mostrarToast("Bloqueio com hora específica só pode ser de um único dia. Para vários dias, marque \"Dia inteiro\"."); return; }
    }

    var bloqueio = { id: uid(), dataInicio: dataInicio, dataFim: dataFim, horaInicio: horaInicio, horaFim: horaFim, motivo: motivo || null };
    (async function(){
      try {
        var r = await sb.from("bloqueios_agenda").insert(bloqueioToRow(bloqueio));
        if (r.error) throw r.error;
        state.bloqueios.push(bloqueio);
        renderAll();
        document.getElementById("form-bloqueio").reset();
        document.getElementById("f-bloqueio-dia-inteiro").checked = true;
        window.toggleBloqueioDiaInteiro(document.getElementById("f-bloqueio-dia-inteiro"));
        mostrarToast("Bloqueio adicionado.");
      } catch(err){
        console.error(err);
        mostrarToast("Erro ao adicionar o bloqueio. Tente de novo.");
      }
    })();
  };

  window.confirmarRemoverBloqueioAgenda = function(id){
    var b = null;
    state.bloqueios.forEach(function(x){ if (x.id===id) b = x; });
    if (!b) return;
    pedirConfirmacao("Remover bloqueio", "Remover o bloqueio: " + descricaoBloqueio(b) + "?", "Remover", function(){ removerBloqueio(id); });
  };

  window.removerBloqueio = function(id){
    (async function(){
      var r = await sb.from("bloqueios_agenda").delete().eq("id", id);
      if (r.error){ mostrarToast("Erro ao remover o bloqueio."); return; }
      state.bloqueios = state.bloqueios.filter(function(b){ return b.id !== id; });
      renderAll();
      mostrarToast("Bloqueio removido.");
    })();
  };

  window.processarLogoPerfil = function(input){
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 1500000){
      mostrarToast("Imagem muito grande. Use um arquivo de até 1,5MB.");
      input.value = "";
      return;
    }
    mostrarToast("Enviando logo...");
    (async function(){
      try {
        var ext = (file.name.split(".").pop() || "png").toLowerCase();
        var caminho = usuarioId + "/logo-" + Date.now() + "." + ext;
        var up = await sb.storage.from("logos").upload(caminho, file, { upsert: true });
        if (up.error) throw up.error;
        var url = sb.storage.from("logos").getPublicUrl(caminho).data.publicUrl;
        var r = await sb.from("profiles").upsert({ id: usuarioId, logo_url: url });
        if (r.error) throw r.error;
        state.professor.logo = url;
        atualizarPreviewLogo();
        mostrarToast("Logo atualizado.");
      } catch(err){
        console.error(err);
        mostrarToast("Não consegui enviar o logo. Tente de novo.");
      }
      input.value = "";
    })();
  };

  window.removerLogoPerfil = function(){
    (async function(){
      var r = await sb.from("profiles").upsert({ id: usuarioId, logo_url: null });
      if (r.error){ mostrarToast("Erro ao remover o logo."); return; }
      state.professor.logo = null;
      atualizarPreviewLogo();
    })();
  };

  window.salvarPerfil = function(ev){
    ev.preventDefault();
    var capacidadeRaw = parseInt(document.getElementById("f-perfil-capacidade").value, 10);
    var capacidade = (isNaN(capacidadeRaw) || capacidadeRaw < 1) ? 1 : capacidadeRaw;
    var dados = {
      nome: document.getElementById("f-perfil-nome").value.trim(),
      telefone: document.getElementById("f-perfil-telefone").value.trim(),
      pix: document.getElementById("f-perfil-pix").value.trim(),
      pixTipo: document.getElementById("f-perfil-pix-tipo").value,
      cidade: document.getElementById("f-perfil-cidade").value.trim(),
      capacidadeSimultanea: capacidade
    };
    (async function(){
      var r = await sb.from("profiles").upsert({ id: usuarioId, nome: dados.nome, telefone: dados.telefone, pix: dados.pix, pix_tipo: dados.pixTipo || null, cidade: dados.cidade || null, capacidade_simultanea: dados.capacidadeSimultanea });
      if (r.error){ mostrarToast("Erro ao salvar os dados."); return; }
      state.professor.nome = dados.nome;
      state.professor.telefone = dados.telefone;
      state.professor.pix = dados.pix;
      state.professor.pixTipo = dados.pixTipo;
      state.professor.cidade = dados.cidade;
      state.professor.capacidadeSimultanea = dados.capacidadeSimultanea;
      mostrarToast("Dados salvos. Já valem para os próximos recibos e cobranças.");
    })();
  };

  // ---------- recibo ----------
  var reciboAtualId = null;

  function nomesDias(){ return ["dom","seg","ter","qua","qui","sex","sáb"]; }

  window.abrirRecibo = function(pagamentoId){
    var p = null;
    state.pagamentos.forEach(function(x){ if (x.id===pagamentoId) p = x; });
    if (!p) return;
    reciboAtualId = pagamentoId;

    var aluno = getAluno(p.alunoId);
    var prof = state.professor;
    var pago = p.status === "pago";

    var logoHtml = prof.logo
      ? '<img class="recibo-logo" src="'+esc(prof.logo)+'" alt="Logo">'
      : '<div class="recibo-logo-placeholder">'+iniciais(prof.nome||"PT")+'</div>';

    var aulasDoRecibo = (p.aulaIds && p.aulaIds.length)
      ? state.aulas.filter(function(c){ return p.aulaIds.indexOf(c.id)>-1; }).sort(function(a,b){ return a.data<b.data?-1:1; })
      : [];

    var itensHtml = "";
    if (aulasDoRecibo.length){
      var valorUnit = aluno.plano.cobranca === "por_aula" ? aluno.plano.valorAula : null;
      aulasDoRecibo.forEach(function(c){
        var d = new Date(c.data+"T00:00:00");
        var diaSemana = capitalizar(nomesDias()[d.getDay()]);
        itensHtml += '<div class="recibo-item"><span class="recibo-item-dia">'+diaSemana+' · '+fmtDataBR(c.data)+' · '+c.hora+'</span>'+(valorUnit!==null ? ('<span>'+fmtMoeda(valorUnit)+'</span>') : '')+'</div>';
      });
    } else {
      itensHtml += '<div class="recibo-item"><span class="recibo-item-dia">'+esc(p.referencia)+'</span><span>'+fmtMoeda(p.valor)+'</span></div>';
    }

    var dataLinha = pago
      ? '<div class="recibo-info-item"><span class="recibo-info-ic">'+ICONS.calendar+'</span><div><span class="recibo-info-label">Data do pagamento</span><span class="recibo-info-valor">'+fmtDataBR(p.dataPagamento)+'</span></div></div>'
      : (p.dataVencimento ? '<div class="recibo-info-item"><span class="recibo-info-ic">'+ICONS.calendar+'</span><div><span class="recibo-info-label">Vencimento</span><span class="recibo-info-valor">'+fmtDataBR(p.dataVencimento)+'</span></div></div>' : '');

    var html = '<div class="recibo-doc">';
    html += '<div class="recibo-brandbar"><div class="recibo-wordmark">LT<span class="accent">360</span></div>'+
      '<div class="recibo-status-pill '+(pago?'pago':'aberto')+'">'+(pago?ICONS.check:ICONS.clock)+(pago?'Pago':'Em aberto')+'</div></div>';
    html += '<div class="recibo-tagline">Gestão para Personal Trainers</div>';
    html += '<div class="recibo-titulo">'+(pago ? "Recibo de pagamento" : "Cobrança")+'</div>';
    html += '<div class="recibo-top-grid">';
    html += '<div class="recibo-prof-row">'+logoHtml+
      '<div class="recibo-prof-info"><div class="recibo-prof-label">Personal Trainer</div>'+
      '<div class="recibo-prof-nome">'+esc(prof.nome||"Personal Trainer")+'</div>'+
      '<div class="recibo-prof-meta">'+[prof.telefone ? ("Tel: "+esc(prof.telefone)) : "", prof.pix ? ("Pix: "+esc(prof.pix)) : ""].filter(Boolean).join(" · ")+'</div></div></div>';
    html += '<div class="recibo-info-grid">'+
      '<div class="recibo-info-item"><span class="recibo-info-ic">'+ICONS.user+'</span><div><span class="recibo-info-label">Aluno</span><span class="recibo-info-valor">'+esc(aluno.nome)+'</span></div></div>'+
      '<div class="recibo-info-item"><span class="recibo-info-ic">'+ICONS.recibo+'</span><div><span class="recibo-info-label">Referente a</span><span class="recibo-info-valor">'+esc(p.referencia)+'</span></div></div>'+
      dataLinha+
      '</div>';
    html += '</div>';
    html += '<div class="recibo-itens-titulo">Serviços prestados</div>';
    html += '<div class="recibo-itens-lista'+(aulasDoRecibo.length>=4 ? ' cols-2' : '')+'">'+itensHtml+'</div>';
    html += '<div class="recibo-total"><span>'+(pago?"Total pago":"Total a pagar")+'</span><span>'+fmtMoeda(p.valor)+'</span></div>';
    html += '<div class="recibo-footer">Recibo emitido em '+fmtDataBR(fmtData(hoje))+' pelo LT360.</div>';
    html += '</div>';

    document.getElementById("recibo-conteudo").innerHTML = html;
    abrirModal("modal-recibo");
  };

  window.baixarReciboPDF = function(){
    var original = document.querySelector("#recibo-conteudo .recibo-doc");
    if (!original || typeof html2pdf === "undefined"){
      mostrarToast("Não foi possível gerar o PDF agora. Tente novamente.");
      return;
    }
    var p = null;
    state.pagamentos.forEach(function(x){ if (x.id===reciboAtualId) p = x; });
    var aluno = p ? getAluno(p.alunoId) : null;
    var nomeArquivo = "recibo-"+(aluno ? aluno.nome.replace(/\s+/g,"-").toLowerCase() : "aluno")+(p && p.dataPagamento ? ("-"+p.dataPagamento) : "")+".pdf";

    // PDF compacto: largura fixa (igual ao recibo em tela no desktop, com as duas
    // colunas), independente do dispositivo em que o botão foi clicado, e altura
    // calculada a partir da imagem já renderizada do recibo — sem página A4 fixa e
    // sem espaço em branco sobrando. A altura da página é derivada do canvas
    // efetivamente gerado (não de uma medição prévia do DOM), para que não haja
    // nenhuma divergência de arredondamento capaz de criar uma 2ª página em branco.
    // Gerado num clone fora da tela para não alterar o modal em exibição.
    var PDF_WIDTH_PX = 640;
    var MARGIN_MM = 10;
    var SCALE = 2;
    var PX_TO_MM = 25.4 / 96;

    var clone = original.cloneNode(true);
    clone.classList.add("recibo-pdf-mode");
    var wrap = document.createElement("div");
    wrap.style.position = "fixed";
    wrap.style.left = "-10000px";
    wrap.style.top = "0";
    wrap.style.width = PDF_WIDTH_PX + "px";
    wrap.appendChild(clone);
    document.body.appendChild(wrap);

    function limpar(){ if (wrap.parentNode) document.body.removeChild(wrap); }

    var larguraInicialMM = PDF_WIDTH_PX * PX_TO_MM + MARGIN_MM * 2;
    var worker = html2pdf().set({
      filename: nomeArquivo,
      margin: MARGIN_MM,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: SCALE, backgroundColor: "#f4f4f6", windowWidth: PDF_WIDTH_PX },
      jsPDF: { unit: "mm", format: [larguraInicialMM, 1000], orientation: "portrait" },
      pagebreak: { mode: ["avoid-all"] }
    }).from(clone);

    worker.toCanvas().then(function(){
      var canvas = worker.prop.canvas;
      var widthPx = canvas.width / SCALE;
      // pequena folga (2px) só para blindar contra arredondamento de ponto flutuante
      // na conversão px→mm; não é perceptível e evita uma eventual página extra em branco.
      var heightPx = (canvas.height / SCALE) + 2;
      var pageWidthMM = widthPx * PX_TO_MM + MARGIN_MM * 2;
      var pageHeightMM = heightPx * PX_TO_MM + MARGIN_MM * 2;
      worker.prop.pageSize = null;
      return worker.set({
        jsPDF: { unit: "mm", format: [pageWidthMM, pageHeightMM], orientation: pageWidthMM >= pageHeightMM ? "landscape" : "portrait" }
      }).toPdf();
    }).then(function(){
      return worker.save();
    }).then(limpar).catch(function(){
      limpar();
      mostrarToast("Não foi possível gerar o PDF agora. Tente novamente.");
    });
  };

  window.enviarReciboWhats = function(){
    var p = null;
    state.pagamentos.forEach(function(x){ if (x.id===reciboAtualId) p = x; });
    if (!p) return;
    var aluno = getAluno(p.alunoId);
    var pago = p.status === "pago";
    var msg = pago
      ? ("Oi "+aluno.nome.split(" ")[0]+"! Segue o recibo referente a: "+p.referencia+", no valor de "+fmtMoeda(p.valor)+". Pagamento confirmado em "+fmtDataBR(p.dataPagamento)+". Obrigado!")
      : ("Oi "+aluno.nome.split(" ")[0]+"! Passando o valor referente a: "+p.referencia+", no total de "+fmtMoeda(p.valor)+(p.dataVencimento ? (", com vencimento em "+fmtDataBR(p.dataVencimento)) : "")+". Qualquer dúvida me chama por aqui. Obrigado!");
    window.open(whatsLink(aluno.telefone, msg), "_blank");
    mostrarToast("Baixe o PDF e anexe ele na conversa do WhatsApp que acabou de abrir.");
  };

  // ---------- detalhe do aluno ----------
  window.abrirDetalheAluno = function(id){
    var aluno = getAluno(id);
    if (!aluno){
      // Pode acontecer depois de uma recarga do servidor (ex.: após convidar
      // pro portal) se o aluno não estiver mais na lista local por qualquer
      // motivo — melhor voltar pra lista do que quebrar com erro na tela.
      voltarListaAlunos();
      return;
    }
    document.getElementById("alunos-lista-view").hidden = true;
    var el = document.getElementById("alunos-detalhe-view");
    el.hidden = false;

    var aulasDoAluno = state.aulas.filter(function(c){return c.alunoId===id;})
      .sort(function(a,b){ return (a.data+a.hora) < (b.data+b.hora) ? 1 : -1; });
    var pagamentosDoAluno = state.pagamentos.filter(function(p){return p.alunoId===id;})
      .sort(function(a,b){ return a.id < b.id ? 1 : -1; });

    var aulasConcluidas = aulasDoAluno.filter(function(c){return c.status==="concluida";}).length;
    var totalPago = pagamentosDoAluno.filter(function(p){return p.status==="pago";}).reduce(function(s,p){return s+p.valor;},0);
    var totalAberto = pagamentosDoAluno.filter(function(p){return p.status==="pendente";}).reduce(function(s,p){return s+p.valor;},0);

    var planoLabel = {mensal:"Mensal", semanal:"Semanal", avulsa:"Por aula"}[aluno.plano.tipo];
    var cobrancaLabel = aluno.plano.cobranca === "fixa" ? "valor fixo" : "por aula dada";
    var valorPlano = aluno.plano.cobranca === "fixa"
      ? fmtMoeda(aluno.plano.valorFixo) + (aluno.plano.tipo==="semanal" ? "/semana" : "/mês")
      : fmtMoeda(aluno.plano.valorAula) + "/aula";

    var html = '';
    html += '<button class="back-btn" onclick="voltarListaAlunos()">'+ICONS.chevL+' Alunos</button>';
    html += '<div class="student-detail-header">';
    html += '<div class="student-detail-id">';
    html += avatarAluno(aluno);
    html += '<div><div class="card-title" style="font-size:16px;">'+esc(aluno.nome)+' '+(aluno.ativo ? '<span class="badge ok">Ativo</span>' : '<span class="badge neutral">Inativo</span>')+'</div>';
    html += '<div class="card-sub">'+[idadeLabel(aluno.nascimento), aluno.sexo].filter(Boolean).join(" · ")+'</div></div>';
    html += '</div>';
    html += '<button class="btn sm" onclick="abrirModalAluno(\''+aluno.id+'\')">'+ICONS.edit+' Editar</button>';
    html += '</div>';
    html += '<div class="action-row" style="margin-top:6px;">';
    html += '<button class="btn sm ghost" onclick="confirmarAlternarAtivoAluno(\''+aluno.id+'\')">'+(aluno.ativo ? 'Inativar aluno' : 'Reativar aluno')+'</button>';
    html += '<button class="btn sm ghost" onclick="confirmarExcluirAluno(\''+aluno.id+'\')">Excluir aluno</button>';
    html += '</div>';

    html += '<div class="action-row" style="margin-top:6px;">';
    if (aluno.authUserId){
      html += '<span class="badge ok">'+ICONS.check+' Convidado para o portal</span>';
      html += '<button class="btn sm ghost" onclick="convidarAluno(\''+aluno.id+'\')" id="btn-convidar-'+aluno.id+'">Reenviar convite</button>';
    } else if (aluno.email){
      html += '<button class="btn sm ghost" onclick="convidarAluno(\''+aluno.id+'\')" id="btn-convidar-'+aluno.id+'">Convidar para o portal</button>';
    } else {
      html += '<span class="hint">Preencha o e-mail do aluno (em Editar) para poder convidá-lo ao portal.</span>';
    }
    html += '</div>';

    html += '<div class="stat-row">';
    html += '<div class="stat-card"><div class="stat-value sm">'+aulasConcluidas+'</div><div class="stat-label">Aulas concluídas</div></div>';
    html += '<div class="stat-card ok"><div class="stat-value sm">'+fmtMoeda(totalPago)+'</div><div class="stat-label">Total pago</div></div>';
    html += '<div class="stat-card warn"><div class="stat-value sm">'+fmtMoeda(totalAberto)+'</div><div class="stat-label">Em aberto</div></div>';
    html += '</div>';

    html += '<div class="card" style="margin-top:8px;">';
    html += '<div class="card-row"><span class="card-sub">Telefone</span><span>'+aluno.telefone+'</span></div>';
    html += '<div class="card-row" style="margin-top:6px;"><span class="card-sub">Endereço</span><span style="text-align:right;max-width:60%;">'+esc(aluno.endereco)+'</span></div>';
    var diasFixos = aluno.recorrencia && aluno.recorrencia.horarios ? Object.keys(aluno.recorrencia.horarios).length : 0;
    var freqTexto = diasFixos > 0 ? diasFixos+"x/semana" : "sem dia fixo";
    html += '<div class="card-row" style="margin-top:6px;"><span class="card-sub">Plano</span><span class="badge accent">'+planoLabel+' · '+freqTexto+'</span></div>';
    html += '<div class="card-row" style="margin-top:6px;"><span class="card-sub">Cobrança</span><span>'+valorPlano+' ('+cobrancaLabel+')</span></div>';
    var recLabel = recorrenciaLabel(aluno.recorrencia);
    if (recLabel){
      html += '<div class="card-row" style="margin-top:6px;"><span class="card-sub">Recorrência</span><span>'+recLabel+'</span></div>';
    }
    html += '<div class="action-row">';
    html += '<a class="btn sm" href="'+mapsLink(aluno.endereco)+'" target="_blank" rel="noopener">'+ICONS.route+' Maps</a>';
    html += '<a class="btn sm" href="'+wazeLink(aluno.endereco)+'" target="_blank" rel="noopener">'+ICONS.route+' Waze</a>';
    if (recLabel){
      html += '<button class="btn sm" onclick="gerarAulasRecorrentes(\''+aluno.id+'\')">Gerar aulas (8 semanas)</button>';
    }
    html += '</div></div>';

    html += '<div class="section-title">Histórico de aulas</div>';
    if (aulasDoAluno.length===0){
      html += '<div class="empty-state"><div class="display">Nenhuma aula ainda</div>Agende a primeira aula na aba Agenda.</div>';
    } else {
      aulasDoAluno.forEach(function(c){
        html += '<div class="card"><div class="card-row"><div class="card-main"><div class="card-title">'+fmtDataBR(c.data)+' · '+c.hora+'</div>'+
          (c.status==="concluida" ? '<div class="card-sub">'+(c.faturada ? "já cobrada" : "ainda não cobrada")+'</div>' : '')+
          '</div>'+statusBadge(c.status)+'</div></div>';
      });
    }

    html += '<div class="section-title">Histórico financeiro</div>';
    if (pagamentosDoAluno.length===0){
      html += '<div class="empty-state"><div class="display">Sem lançamentos</div></div>';
    } else {
      pagamentosDoAluno.forEach(function(p){
        html += '<div class="card"><div class="card-row"><div class="card-main"><div class="card-title">'+fmtMoeda(p.valor)+'</div><div class="card-sub">'+esc(p.referencia)+'</div></div>';
        html += p.status==="pago" ? '<span class="badge ok">'+ICONS.check+' pago</span>' : (ehVencido(p) ? '<span class="badge danger">vencido</span>' : '<span class="badge warn">pendente</span>');
        html += '</div>';
        html += '<div class="action-row"><button class="btn sm" onclick="abrirRecibo(\''+p.id+'\')">'+ICONS.recibo+' '+(p.status==="pago"?"Ver recibo":"Ver cobrança")+'</button></div>';
        html += '</div>';
      });
    }

    el.innerHTML = html;
  };
  window.voltarListaAlunos = function(){
    document.getElementById("alunos-lista-view").hidden = false;
    document.getElementById("alunos-detalhe-view").hidden = true;
  };

  window.confirmarAlternarAtivoAluno = function(id){
    var aluno = getAluno(id);
    if (!aluno) return;
    if (aluno.ativo){
      pedirConfirmacao(
        "Inativar aluno",
        "Isso remove "+aluno.nome+" das listas de alunos ativos e das próximas gerações de aula por recorrência. O histórico de aulas e pagamentos dele é mantido, e você pode reativar quando quiser. Tem certeza?",
        "Inativar",
        function(){ alternarAtivoAluno(id); }
      );
    } else {
      alternarAtivoAluno(id);
    }
  };

  window.alternarAtivoAluno = function(id){
    var aluno = getAluno(id);
    if (!aluno) return;
    var ativando = !aluno.ativo;
    aluno.ativo = ativando;
    if (!ativando){
      // Mesma limpeza usada ao editar a recorrência: tira da agenda as
      // aulas futuras que ainda não aconteceram, sem tocar no histórico.
      limparAulasRecorrenciaFutura(id);
    }
    salvarEstado();
    renderAll();
    abrirDetalheAluno(id);
    mostrarToast(ativando ? "Aluno reativado." : "Aluno inativado.");
  };

  window.confirmarExcluirAluno = function(id){
    var aluno = getAluno(id);
    if (!aluno) return;
    var temAulas = state.aulas.some(function(c){ return c.alunoId===id; });
    var temPagamentos = state.pagamentos.some(function(p){ return p.alunoId===id; });
    if (temAulas || temPagamentos){
      pedirConfirmacao(
        "Excluir aluno",
        "Não é possível excluir "+aluno.nome+": ele já tem aulas e/ou cobranças lançadas no histórico, e excluir apagaria esse histórico. Em vez disso, use \"Inativar aluno\" — o cadastro some das listas ativas, mas o histórico fica preservado. Deseja inativar agora?",
        "Inativar",
        function(){ if (aluno.ativo) alternarAtivoAluno(id); else mostrarToast("Esse aluno já está inativo."); }
      );
      return;
    }
    pedirConfirmacao(
      "Excluir aluno",
      "Isso apaga o cadastro de "+aluno.nome+" permanentemente. Ele não tem nenhuma aula ou cobrança lançada, então não há histórico a perder. Tem certeza?",
      "Excluir",
      function(){ excluirAluno(id); }
    );
  };

  window.excluirAluno = function(id){
    var antes = state.alunos.length;
    state.alunos = state.alunos.filter(function(a){ return a.id !== id; });
    if (state.alunos.length === antes) return;
    salvarEstado();
    voltarListaAlunos();
    renderAll();
    mostrarToast("Aluno excluído.");
  };

  // Chama a Edge Function convidar-aluno (ver supabase/functions/convidar-aluno).
  // A service role nunca passa pelo navegador: a function valida que este
  // personal é dono do aluno (via RLS, com o JWT da sessão atual) e só então
  // usa a service role, do lado do servidor, pra enviar o convite.
  window.convidarAluno = async function(id){
    var aluno = getAluno(id);
    if (!aluno) return;
    var reenvio = !!aluno.authUserId;
    var rotulo = reenvio ? "Reenviar convite" : "Convidar para o portal";
    var btn = document.getElementById("btn-convidar-"+id);
    if (btn){ btn.disabled = true; btn.textContent = "Enviando..."; }
    try {
      var sessao = await sb.auth.getSession();
      var token = sessao.data.session && sessao.data.session.access_token;
      if (!token) throw new Error("sem sessão");
      var r = await sb.functions.invoke("convidar-aluno", {
        body: { alunoId: id },
        headers: { Authorization: "Bearer " + token }
      });
      if (r.error) throw r.error;
      if (r.data && r.data.error) throw new Error(r.data.error);
      var foiReenvio = !!(r.data && r.data.reenviado);
      mostrarToast((foiReenvio ? "Convite reenviado para " : "Convite enviado para ") + aluno.email + ".");
      // O auth_user_id só é confirmado no próximo carregamento (a Edge
      // Function grava direto no banco, não no estado local otimista).
      await carregarDadosDoServidor();
      renderAll();
      abrirDetalheAluno(id);
    } catch(err){
      console.error(err);
      // Mensagens de negócio (ex.: "já criou a senha") vêm no corpo da resposta
      // da Edge Function, não no err.message genérico. Extrai quando possível.
      var msg = (err && err.message) || "Erro ao enviar o convite.";
      try {
        if (err && err.context && typeof err.context.json === "function") {
          var corpo = await err.context.json();
          if (corpo && corpo.error) msg = corpo.error;
        }
      } catch(e){}
      mostrarToast(msg);
      if (btn){ btn.disabled = false; btn.textContent = rotulo; }
    }
  };

  function statusBadge(status){
    var map = {
      agendada: '<span class="badge neutral">agendada</span>',
      confirmada: '<span class="badge accent">'+ICONS.check+' confirmada</span>',
      concluida: '<span class="badge ok">'+ICONS.check+' concluída</span>',
      cancelada: '<span class="badge danger">cancelada</span>',
      remarcada: '<span class="badge neutral">remarcada</span>'
    };
    return map[status] || map.agendada;
  }

  // ---------- render ----------
  // SVGs de apoio do dashboard
  var SVG_BAG = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 8h12l1.5 11a1 1 0 01-1 1.1H5.5a1 1 0 01-1-1.1L6 8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 016 0v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var SVG_WALLET = '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M16 14h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var SVG_CAL = '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var SVG_PEOPLE = '<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="2"/><path d="M3.5 19a5.5 5.5 0 0111 0M16 6a3 3 0 010 6M18.5 19a5 5 0 00-2.5-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var SVG_DUMBBELL = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var SVG_QR = '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/><path d="M14 14h3v3M21 14v7h-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var dashCalMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  function renderShell(){
    var nome = state.professor.nome || "Personal";
    var primeiro = nome.split(" ")[0] || "Personal";
    var ini = state.professor.nome ? iniciais(state.professor.nome) : "LT";
    var h = hoje.getHours();
    var saud = h < 12 ? "Bom dia" : (h < 18 ? "Boa tarde" : "Boa noite");
    var g = document.getElementById("header-greeting"); if (g) g.textContent = saud + ", " + primeiro + "!";
    ["side-name","head-name"].forEach(function(id){ var e=document.getElementById(id); if(e) e.textContent = nome; });
    ["side-avatar","head-avatar"].forEach(function(id){ var e=document.getElementById(id); if(e) e.textContent = ini; });
  }

  function heroStatusLabel(s){
    return {agendada:"Agendada", confirmada:"Confirmada", concluida:"Concluída"}[s] || "Agendada";
  }

  // Aulas que já aconteceram e continuam sem conclusão (nem canceladas/remarcadas).
  function aulasPendentesConclusao(){
    return state.aulas.filter(function(c){
      return (c.status==="agendada"||c.status==="confirmada") && !aulaEhFutura(c);
    }).sort(function(a,b){ return (a.data+a.hora) > (b.data+b.hora) ? -1 : 1; }); // mais recentes primeiro
  }
  function renderPendentesConclusao(){
    var box = document.getElementById("resumo-pendentes");
    if (!box) return;
    var pend = aulasPendentesConclusao();
    if (!pend.length){ box.innerHTML = ""; return; }
    var hojeStr = fmtData(hoje);
    var itens = pend.slice(0, 6).map(function(c){
      var al = getAluno(c.alunoId);
      var quando = (c.data===hojeStr ? "Hoje" : fmtDataBR(c.data).slice(0,5)) + " · " + c.hora;
      return '<div class="pend-row"><div class="pend-info"><div class="pend-nome">'+esc(al?al.nome:"Aluno")+'</div>'+
        '<div class="pend-quando">'+quando+'</div></div>'+
        '<button class="btn sm primary" onclick="confirmarConcluir(\''+c.id+'\')">'+ICONS.check+' Concluir</button></div>';
    }).join("");
    var extra = pend.length>6 ? '<div class="pend-mais">+ '+(pend.length-6)+' aula(s) na agenda</div>' : '';
    box.innerHTML = '<div class="pend-card"><div class="pend-head"><span class="pend-ic">'+ICONS.clock+'</span>'+
      '<div><div class="pend-t">'+pend.length+' aula'+(pend.length>1?'s':'')+' aguardando conclusão</div>'+
      '<div class="pend-s">Já aconteceram e ainda não foram concluídas. Finalize por aqui, pelo check-out (QR) ou na agenda.</div></div></div>'+
      itens+extra+'</div>';
  }
  // Cobranças que o aluno informou como pagas e aguardam confirmação.
  function pagamentosInformados(){
    return state.pagamentos.filter(function(p){ return p.pagoInformadoEm && p.status!=="pago"; })
      .sort(function(a,b){ return (a.pagoInformadoEm < b.pagoInformadoEm) ? 1 : -1; });
  }
  function renderPagamentosInformados(){
    var box = document.getElementById("resumo-pag-informados");
    if (!box) return;
    var infs = pagamentosInformados();
    if (!infs.length){ box.innerHTML = ""; return; }
    var itens = infs.slice(0,6).map(function(p){
      var al = getAluno(p.alunoId);
      var ref = p.periodoLabel || p.referencia || "Cobrança";
      return '<div class="pend-row"><div class="pend-info"><div class="pend-nome">'+esc(al?al.nome:"Aluno")+' · '+fmtMoeda(p.valor)+'</div>'+
        '<div class="pend-quando">'+esc(ref)+' · informado'+(p.pagoInformadoEm?" em "+fmtDataBR((""+p.pagoInformadoEm).slice(0,10)):"")+'</div></div>'+
        '<button class="btn sm primary" onclick="marcarPago(\''+p.id+'\')">'+ICONS.check+' Confirmar</button></div>';
    }).join("");
    box.innerHTML = '<div class="pend-card pag-inf-card"><div class="pend-head"><span class="pend-ic pag-inf-ic">'+ICONS.cash+'</span>'+
      '<div><div class="pend-t pag-inf-t">'+infs.length+' pagamento'+(infs.length>1?'s':'')+' aguardando confirmação</div>'+
      '<div class="pend-s">O aluno informou que pagou. Confira no seu banco e confirme a baixa.</div></div></div>'+itens+'</div>';
  }
  function renderResumo(){
    renderShell();
    renderPagamentosInformados();
    renderPendentesConclusao();
    var hojeStr = fmtData(hoje);
    var aulasHoje = state.aulas.filter(function(c){return c.data===hojeStr;})
      .sort(function(a,b){ return a.hora < b.hora ? -1 : 1; });

    // hero
    var heroBox = document.getElementById("resumo-hero");
    var ativasHoje = aulasHoje.filter(function(c){ return c.status!=="cancelada" && c.status!=="remarcada"; });
    if (ativasHoje.length===0){
      heroBox.innerHTML = '<div class="dash-hero vazio"><div class="dash-hero-label">Hoje</div>'
        + '<div class="dash-hero-aluno">Nenhuma aula hoje</div>'
        + '<div class="dash-hero-end">Aproveite para planejar a semana.</div></div>';
    } else {
      var alvo = ativasHoje.filter(function(c){return c.status!=="concluida";})[0] || ativasHoje[0];
      var al = getAluno(alvo.alunoId);
      heroBox.innerHTML = '<div class="dash-hero">'
        + '<div class="dash-hero-top"><div><div class="dash-hero-label">Seu próximo atendimento</div>'
        +   '<div class="dash-hero-time">'+alvo.hora+'</div></div>'
        +   '<span class="dash-hero-badge">'+heroStatusLabel(alvo.status)+'</span></div>'
        + '<div class="dash-hero-aluno">'+esc(al.nome)+'</div>'
        + '<div class="dash-hero-end">'+al.endereco+'</div>'
        + '<div class="dash-hero-actions">'
        +   '<a class="hero-btn" href="'+mapsLink(al.endereco)+'" target="_blank" rel="noopener">'+ICONS.route+' Maps</a>'
        +   '<a class="hero-btn" href="'+wazeLink(al.endereco)+'" target="_blank" rel="noopener">'+ICONS.route+' Waze</a>'
        +   (alvo.status!=="concluida" && !aulaEhFutura(alvo) ? '<button class="hero-btn primary" onclick="confirmarConcluir(\''+alvo.id+'\')">'+ICONS.check+' Concluir</button>' : '')
        + '</div></div>';
    }

    // stats
    var mesAtual = hojeStr.slice(0,7);
    var aReceber = state.pagamentos.filter(function(p){return p.status==="pendente";}).reduce(function(s,p){return s+p.valor;},0);
    var recebidoMes = state.pagamentos.filter(function(p){return p.status==="pago" && p.dataPagamento && p.dataPagamento.slice(0,7)===mesAtual;}).reduce(function(s,p){return s+p.valor;},0);
    var inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate()-hoje.getDay());
    var fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate()+6);
    var aulasSemana = state.aulas.filter(function(c){ var d=new Date(c.data+"T00:00:00"); return d>=inicioSemana && d<=fimSemana && c.status!=="cancelada" && c.status!=="remarcada"; }).length;
    var ativos = state.alunos.filter(function(a){return a.ativo;}).length;
    function statCard(ic, cor, val, lab){
      return '<div class="dash-stat"><div class="dash-stat-ic '+cor+'">'+ic+'</div><div><div class="dash-stat-val">'+val+'</div><div class="dash-stat-lab">'+lab+'</div></div></div>';
    }
    document.getElementById("resumo-stats").innerHTML =
      statCard(SVG_BAG,"amber",fmtMoeda(aReceber),"A receber") +
      statCard(SVG_WALLET,"green",fmtMoeda(recebidoMes),"Recebido no mês") +
      statCard(SVG_CAL,"violet",aulasSemana,"Aulas na semana") +
      statCard(SVG_PEOPLE,"teal",ativos,"Alunos ativos");

    // próximas aulas
    var proximas = state.aulas.filter(function(c){return c.data>hojeStr && c.status!=="concluida" && c.status!=="cancelada" && c.status!=="remarcada";})
      .sort(function(a,b){ return (a.data+a.hora) < (b.data+b.hora) ? -1 : 1; })
      .slice(0,5);
    document.getElementById("resumo-proximas").innerHTML = proximas.length ? proximas.map(function(c){
      var aluno = getAluno(c.alunoId);
      return '<div class="aula-row">'+avatarAluno(aluno)
        + '<div class="aula-row-main"><div class="aula-row-nome">'+esc(aluno.nome)+'</div>'
        + '<div class="aula-row-sub">'+fmtDataBR(c.data)+' · '+c.hora+'</div></div>'
        + statusBadge(c.status) + '</div>';
    }).join("") : '<div class="empty-state sm">Nenhuma aula futura agendada.</div>';

    renderGraficoFinanceiro();
    renderMiniCalendario();
    renderAcoes();
    renderAtividades();
  }

  function renderGraficoFinanceiro(){
    fecharResumoGraficoPopover();
    var meses = [];
    for (var i=-5; i<=0; i++){ meses.push(fmtData(new Date(hoje.getFullYear(), hoje.getMonth()+i, 1)).slice(0,7)); }
    var dados = meses.map(function(m){ return { m:m, prev:calcularPrevistoMes(m), receb:calcularRecebidoMes(m), aberto:calcularPendenteMes(m) }; });
    resumoGraficoDados = dados; // guarda os valores já calculados para o popover de detalhe reutilizar (sem recalcular)
    var max = 1;
    dados.forEach(function(d){ max = Math.max(max, d.prev, d.receb, d.aberto); });
    function barra(cls, val){ var hpx = Math.round(val/max*112); return '<div class="chart-bar '+cls+'" style="height:'+hpx+'px"></div>'; }
    var cols = dados.map(function(d, i){
      var rotulo = mesLabel(d.m);
      return '<div class="chart-col" tabindex="0" role="button" aria-haspopup="true" aria-expanded="false" aria-label="Ver detalhes de '+rotulo+'" '
        + 'onclick="toggleResumoGraficoDetalhe('+i+',this)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleResumoGraficoDetalhe('+i+',this);}">'
        + '<div class="chart-bars">'+barra("prev",d.prev)+barra("receb",d.receb)+barra("aberto",d.aberto)+'</div>'
        + '<div class="chart-xlab">'+rotulo.split("/")[0]+'</div></div>';
    }).join("");
    var legenda = '<div class="chart-legend">'
      + '<span><i class="chart-dot" style="background:#CBD1DA"></i>Previsto</span>'
      + '<span><i class="chart-dot" style="background:var(--accent)"></i>Recebido</span>'
      + '<span><i class="chart-dot" style="background:var(--warning)"></i>Em aberto</span></div>';
    document.getElementById("resumo-grafico").innerHTML = '<div class="chart-fin">'+cols+'</div>'+legenda;
  }

  // Popover de detalhe do "Resumo financeiro": reutiliza exatamente os valores já calculados
  // em resumoGraficoDados (prev/receb/aberto), sem nenhum cálculo paralelo.
  window.toggleResumoGraficoDetalhe = function(idx, el){
    if (resumoGraficoPopoverIdx === idx){
      fecharResumoGraficoPopover();
      return;
    }
    abrirResumoGraficoPopover(idx, el);
  };

  function abrirResumoGraficoPopover(idx, el){
    fecharResumoGraficoPopover();
    var d = resumoGraficoDados[idx];
    if (!d) return;
    resumoGraficoPopoverIdx = idx;
    el.classList.add("ativo");
    el.setAttribute("aria-expanded", "true");

    var pop = document.createElement("div");
    pop.className = "chart-popover";
    pop.id = "resumo-grafico-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Detalhes financeiros de " + mesLabel(d.m));
    pop.innerHTML = '<div class="chart-popover-titulo">'+mesLabel(d.m)+'</div>'
      + '<div class="chart-popover-linha"><i class="chart-dot" style="background:#CBD1DA"></i><span>Previsto</span><b>'+fmtMoeda(d.prev)+'</b></div>'
      + '<div class="chart-popover-linha"><i class="chart-dot" style="background:var(--accent)"></i><span>Recebido</span><b>'+fmtMoeda(d.receb)+'</b></div>'
      + '<div class="chart-popover-linha"><i class="chart-dot" style="background:var(--warning)"></i><span>Em aberto</span><b>'+fmtMoeda(d.aberto)+'</b></div>';
    pop.style.left = "-9999px";
    pop.style.top = "-9999px";
    document.body.appendChild(pop);
    posicionarResumoGraficoPopover(el, pop);

    document.addEventListener("click", onDocClickResumoGraficoPopover, true);
    document.addEventListener("keydown", onDocKeydownResumoGraficoPopover, true);
    window.addEventListener("resize", fecharResumoGraficoPopover);
  }

  function posicionarResumoGraficoPopover(el, pop){
    var r = el.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    if (vw < 480){
      pop.classList.add("mobile");
      pop.style.left = "16px";
      var topM = r.bottom + 10;
      if (topM + pop.offsetHeight > vh - 12) topM = Math.max(12, r.top - pop.offsetHeight - 10);
      pop.style.top = topM + "px";
      return;
    }
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = r.left + r.width/2 - pw/2;
    left = Math.max(12, Math.min(left, vw - pw - 12));
    var top = r.top - ph - 10;
    if (top < 12) top = Math.min(r.bottom + 10, vh - ph - 12);
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function fecharResumoGraficoPopover(){
    if (resumoGraficoPopoverIdx === null) return;
    resumoGraficoPopoverIdx = null;
    var pop = document.getElementById("resumo-grafico-popover");
    if (pop) pop.remove();
    document.querySelectorAll("#resumo-grafico .chart-col").forEach(function(c){ c.classList.remove("ativo"); c.setAttribute("aria-expanded", "false"); });
    document.removeEventListener("click", onDocClickResumoGraficoPopover, true);
    document.removeEventListener("keydown", onDocKeydownResumoGraficoPopover, true);
    window.removeEventListener("resize", fecharResumoGraficoPopover);
  }
  function onDocClickResumoGraficoPopover(e){
    var pop = document.getElementById("resumo-grafico-popover");
    if (!pop) return;
    if (pop.contains(e.target)) return;
    if (e.target.closest && e.target.closest(".chart-col")) return;
    fecharResumoGraficoPopover();
  }
  function onDocKeydownResumoGraficoPopover(e){
    if (e.key === "Escape") fecharResumoGraficoPopover();
  }

  window.mcalNav = function(delta){
    dashCalMes = new Date(dashCalMes.getFullYear(), dashCalMes.getMonth()+delta, 1);
    renderMiniCalendario();
  };
  window.mcalDia = function(iso){
    agendaData = new Date(iso+"T00:00:00");
    agendaModo = "dia";
    irParaTab("agenda");
  };
  function renderMiniCalendario(){
    var y = dashCalMes.getFullYear(), m = dashCalMes.getMonth();
    var primeiro = new Date(y, m, 1);
    var inicioDow = primeiro.getDay();
    var diasNoMes = new Date(y, m+1, 0).getDate();
    var mesStr = fmtData(primeiro).slice(0,7);
    var hojeStr = fmtData(hoje);
    var comAula = {};
    state.aulas.forEach(function(c){
      if (c.status!=="cancelada" && c.status!=="remarcada" && c.data.slice(0,7)===mesStr) comAula[c.data] = true;
    });
    var dows = ["D","S","T","Q","Q","S","S"];
    var html = '<div class="mcal-head"><span class="mcal-title">'+MESES_ABREV[m]+' '+y+'</span>'
      + '<span class="mcal-nav"><button onclick="mcalNav(-1)"><svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      + '<button onclick="mcalNav(1)"><svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></span></div>';
    html += '<div class="mcal-grid">';
    dows.forEach(function(d){ html += '<div class="mcal-dow">'+d+'</div>'; });
    for (var b=0; b<inicioDow; b++){ html += '<span class="mcal-day outro"></span>'; }
    for (var dia=1; dia<=diasNoMes; dia++){
      var iso = mesStr + "-" + (dia<10?"0"+dia:dia);
      var cls = "mcal-day" + (iso===hojeStr ? " hoje" : "");
      var pip = comAula[iso] ? '<span class="pip"></span>' : '';
      html += '<button class="'+cls+'" onclick="mcalDia(\''+iso+'\')">'+dia+pip+'</button>';
    }
    html += '</div>';
    document.getElementById("resumo-calendario").innerHTML = html;
  }

  function renderAcoes(containerId){
    var acoes = [
      { ic: SVG_QR, cor:"teal", lab:"Check-out", fn:"abrirCheckinQR()" },
      { ic: SVG_PEOPLE, cor:"violet", lab:"Novo aluno", fn:"abrirModalAluno()" },
      { ic: SVG_CAL, cor:"amber", lab:"Nova aula", fn:"abrirModalAula()" },
      { ic: SVG_DUMBBELL, cor:"green", lab:"Agenda", fn:"irParaTab('agenda')" }
    ];
    var box = document.getElementById(containerId || "resumo-acoes");
    if (!box) return;
    box.innerHTML = acoes.map(function(a){
      return '<button class="acao-btn" onclick="'+a.fn+'"><span class="acao-ic dash-stat-ic '+a.cor+'">'+a.ic+'</span>'+a.lab+'</button>';
    }).join("");
  }

  function renderAtividades(containerId){
    var items = [];
    state.aulas.filter(function(c){return c.status==="concluida";}).forEach(function(c){
      var al = getAluno(c.alunoId);
      items.push({ data:c.data, ordem:c.data+c.hora, cls:"ok", ic:ICONS.check, t:"Aula concluída", s:(al?esc(al.nome):"")+" · "+fmtDataBR(c.data) });
    });
    state.pagamentos.filter(function(p){return p.status==="pago" && p.dataPagamento;}).forEach(function(p){
      var al = getAluno(p.alunoId);
      items.push({ data:p.dataPagamento, ordem:p.dataPagamento+"z", cls:"teal", ic:ICONS.cash, t:"Pagamento recebido", s:(al?esc(al.nome):"")+" · "+fmtMoeda(p.valor) });
    });
    items.sort(function(a,b){ return a.ordem < b.ordem ? 1 : -1; });
    items = items.slice(0,6);
    var box = document.getElementById(containerId || "resumo-atividades");
    if (!box) return;
    box.innerHTML = items.length ? items.map(function(it){
      return '<div class="atv-row"><div class="atv-ic '+it.cls+'">'+it.ic+'</div>'
        + '<div class="atv-main"><div class="atv-t">'+it.t+'</div><div class="atv-s">'+it.s+'</div></div></div>';
    }).join("") : '<div class="empty-state sm">Sem atividades recentes.</div>';
  }

  window.buscaHeader = function(valor){
    if (!document.getElementById("screen-alunos").classList.contains("active")) irParaTab("alunos");
    var inp = document.getElementById("busca-alunos");
    if (inp) inp.value = valor;
    filtrarAlunos(valor);
  };

  function cardAula(c, aluno, mostrarData){
    var titulo = (mostrarData ? fmtDataBR(c.data)+' · ' : '') + c.hora + ' · ' + esc(aluno.nome);
    var html = '<div class="card">';
    html += '<div class="card-row"><div class="card-main"><div class="card-title">'+titulo+'</div><div class="card-sub">'+esc(aluno.endereco)+'</div></div>'+statusBadge(c.status)+'</div>';
    if (c.checkinOrigem==="checkout"){
      html += '<div class="checkin-chip">'+ICONS.check+' Concluída via check-out'+(c.checkinEm?' · '+horaCheckin(c.checkinEm):'')+'</div>';
    } else if (c.checkinEm){
      html += '<div class="checkin-chip">'+ICONS.check+' Check-in '+horaCheckin(c.checkinEm)+'</div>';
    }
    if (c.status==="remarcada" && c.remarcadaParaId){
      var nova = null;
      state.aulas.forEach(function(x){ if (x.id===c.remarcadaParaId) nova = x; });
      if (nova) html += '<div class="card-sub" style="margin-top:6px;">Remarcada para '+fmtDataBR(nova.data)+' · '+nova.hora+'</div>';
    }
    html += '<div class="action-row">';
    html += '<a class="btn sm" href="'+mapsLink(aluno.endereco)+'" target="_blank" rel="noopener">'+ICONS.route+' Maps</a>';
    html += '<a class="btn sm" href="'+wazeLink(aluno.endereco)+'" target="_blank" rel="noopener">'+ICONS.route+' Waze</a>';
    if (c.status==="agendada" || c.status==="confirmada"){
      if (c.status==="agendada") html += '<button class="btn sm" onclick="confirmarAula(\''+c.id+'\')">'+ICONS.check+' Confirmar</button>';
      if (!aulaEhFutura(c)) html += '<button class="btn sm primary" onclick="confirmarConcluir(\''+c.id+'\')">Concluir</button>';
      html += '<button class="btn sm" onclick="abrirModalRemarcar(\''+c.id+'\')">Remarcar</button>';
      html += '<button class="btn sm" onclick="confirmarCancelar(\''+c.id+'\')">Cancelar</button>';
    } else if (c.status==="cancelada"){
      html += '<button class="btn sm" onclick="abrirModalRemarcar(\''+c.id+'\')">Remarcar</button>';
    } else if (c.status==="concluida"){
      html += '<button class="btn sm" onclick="confirmarEstornarConclusao(\''+c.id+'\')">Estornar conclusão</button>';
    }
    html += '</div></div>';
    return html;
  }

  // ---- Check-in por QR (o personal escaneia o QR do aluno) -----------------
  function horaCheckin(iso){
    try{ return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"}); }
    catch(e){ return ""; }
  }
  var qrScanner = null, qrOcupado = false;
  function resetCheckinUI(){
    var res=document.getElementById("checkin-resultado");
    var reader=document.getElementById("checkin-reader");
    var btn=document.getElementById("checkin-reiniciar");
    if(res){ res.hidden=true; res.innerHTML=""; }
    if(reader) reader.hidden=false;
    if(btn) btn.hidden=true;
  }
  // Renderiza uma mensagem de resultado (ok | aviso | erro) no modal de check-out.
  function mostrarMsgCheckin(cls, titulo, sub){
    var res=document.getElementById("checkin-resultado");
    var reader=document.getElementById("checkin-reader");
    var btn=document.getElementById("checkin-reiniciar");
    if(reader) reader.hidden=true;
    if(btn) btn.hidden=false;
    var ic = cls==="erro" ? (ICONS.close||"!") : ICONS.check;
    if(res){
      res.hidden=false;
      res.innerHTML='<div class="checkin-res '+cls+'"><span class="checkin-res-ic">'+ic+'</span>'+
        '<div><div class="checkin-res-t">'+esc(titulo)+'</div><div class="checkin-res-s">'+esc(sub||"")+'</div></div></div>';
    }
  }
  async function iniciarScanner(){
    try{
      qrScanner = new Html5Qrcode("checkin-reader");
      await qrScanner.start({ facingMode:"environment" }, { fps:10, qrbox:{width:230,height:230} }, onQrScan, function(){});
    }catch(e){
      console.error(e);
      mostrarMsgCheckin("erro","Câmera indisponível","Permita o acesso à câmera no navegador e tente de novo.");
    }
  }
  async function pararScanner(){
    if(qrScanner){ try{ await qrScanner.stop(); await qrScanner.clear(); }catch(e){} qrScanner=null; }
  }
  async function onQrScan(texto){
    if(qrOcupado) return;
    if(!texto || texto.indexOf("LT360CHECKIN:")!==0) return; // ignora QR estranho, segue lendo
    qrOcupado = true;
    await pararScanner();
    var token = texto.slice("LT360CHECKIN:".length).trim();
    window.checkinProcessarToken(token);
  }
  // Resolve o token do aluno (local, sob RLS do personal), acha a(s) aula(s) de
  // HOJE que dá para concluir e pede confirmação. Exposto para desacoplar da
  // câmera e permitir testes. A conclusão em si reusa concluirAula (mesma regra
  // de faturamento do botão manual — fonte única da verdade).
  window.checkinProcessarToken = function(token){
    var aluno=null;
    state.alunos.forEach(function(a){ if(a.checkinToken && a.checkinToken===token) aluno=a; });
    if(!aluno){ mostrarMsgCheckin("erro","QR não reconhecido","Este QR não corresponde a nenhum aluno seu."); return; }
    var hojeStr = fmtData(hoje);
    var daAulaHoje = function(c){ return c.alunoId===aluno.id && c.data===hojeStr; };
    var candidatas = state.aulas.filter(function(c){
      return daAulaHoje(c) && (c.status==="agendada"||c.status==="confirmada") && !aulaEhFutura(c);
    }).sort(function(a,b){ return a.hora<b.hora?-1:1; });

    if(candidatas.length===0){
      var jaConcluida = state.aulas.some(function(c){ return daAulaHoje(c) && c.status==="concluida"; });
      var futuraHoje = state.aulas.some(function(c){ return daAulaHoje(c) && (c.status==="agendada"||c.status==="confirmada") && aulaEhFutura(c); });
      if(jaConcluida) mostrarMsgCheckin("aviso","Aula já finalizada", aluno.nome+" já teve o check-out da aula de hoje.");
      else if(futuraHoje) mostrarMsgCheckin("aviso","Ainda não é hora", "A aula de hoje de "+aluno.nome+" ainda não começou.");
      else mostrarMsgCheckin("erro","Sem aula hoje", aluno.nome+" não tem aula de hoje para finalizar.");
      return;
    }
    mostrarConfirmCheckout(aluno, candidatas);
  };
  // Tela de confirmação (1 aula) ou seleção (várias) dentro do modal.
  function mostrarConfirmCheckout(aluno, candidatas){
    var res=document.getElementById("checkin-resultado");
    var reader=document.getElementById("checkin-reader");
    var btn=document.getElementById("checkin-reiniciar");
    if(reader) reader.hidden=true;
    if(btn) btn.hidden=false;
    var html;
    if(candidatas.length===1){
      var c=candidatas[0];
      html='<div class="checkin-confirm"><div class="checkin-confirm-t">Finalizar a aula de '+esc(aluno.nome)+'?</div>'+
        '<div class="checkin-confirm-s">Aula das '+c.hora+' · '+fmtDataBR(c.data)+'. Se ele paga por aula, isso já gera a cobrança.</div>'+
        '<button class="btn primary block" onclick="checkinFinalizar(\''+c.id+'\')">'+ICONS.check+' Finalizar aula</button></div>';
    } else {
      html='<div class="checkin-confirm"><div class="checkin-confirm-t">'+esc(aluno.nome)+' tem mais de uma aula hoje</div>'+
        '<div class="checkin-confirm-s">Toque na sessão que você quer finalizar:</div>'+
        candidatas.map(function(c){
          return '<button class="btn block checkin-opt" onclick="checkinFinalizar(\''+c.id+'\')">'+ICONS.check+' Aula das '+c.hora+'</button>';
        }).join("")+'</div>';
    }
    if(res){ res.hidden=false; res.innerHTML=html; }
  }
  // Conclui via check-out: carimba checkin_em/origem e reusa concluirAula.
  window.checkinFinalizar = function(aulaId){
    var aula=null; state.aulas.forEach(function(c){ if(c.id===aulaId) aula=c; });
    if(!aula){ mostrarMsgCheckin("erro","Aula não encontrada","Tente escanear de novo."); return; }
    if(aulaEhFutura(aula)){ mostrarMsgCheckin("aviso","Ainda não é hora","Essa aula ainda não começou."); return; }
    if(aula.status==="concluida"){ var al0=getAluno(aula.alunoId); mostrarMsgCheckin("aviso","Aula já finalizada",(al0?al0.nome:"O aluno")+" já teve o check-out dessa aula."); return; }
    aula.checkinEm = new Date().toISOString();
    aula.checkinOrigem = "checkout";
    concluirAula(aulaId); // seta status, faturamento, salva e re-renderiza
    var al=getAluno(aula.alunoId);
    mostrarMsgCheckin("ok","Aula finalizada!",(al?al.nome:"Aluno")+" · aula das "+aula.hora+" concluída via check-out.");
  };
  window.abrirCheckinQR = async function(){
    abrirModal("modal-checkin");
    resetCheckinUI();
    qrOcupado=false;
    await iniciarScanner();
  };
  window.reiniciarCheckin = async function(){ qrOcupado=false; resetCheckinUI(); await iniciarScanner(); };
  window.fecharCheckin = async function(){ await pararScanner(); fecharModal("modal-checkin"); };

  function proximaAulaDoAluno(alunoId){
    var hojeStr = fmtData(hoje);
    var futuras = state.aulas.filter(function(c){
      return c.alunoId===alunoId && c.data>=hojeStr && c.status!=="cancelada" && c.status!=="remarcada" && c.status!=="concluida";
    }).sort(function(a,b){ return (a.data+a.hora) < (b.data+b.hora) ? -1 : 1; });
    return futuras[0] || null;
  }

  function renderAlunos(){
    var planoLabelMap = {mensal:"Mensal", semanal:"Semanal", avulsa:"Por aula"};
    var termo = normalizar(alunoBuscaTermo);
    var termoTelefone = (alunoBuscaTermo||"").replace(/\D/g,"");

    // ---- estatísticas (sobre a base completa, não filtrada) ----
    var total = state.alunos.length;
    var ativosCount = state.alunos.filter(function(a){return a.ativo;}).length;
    var inativosCount = total - ativosCount;
    var hojeStr = fmtData(hoje);
    var inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate()-hoje.getDay());
    var fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate()+6);
    var aulasSemana = state.aulas.filter(function(c){ var d=new Date(c.data+"T00:00:00"); return d>=inicioSemana && d<=fimSemana && c.status!=="cancelada" && c.status!=="remarcada"; }).length;
    var mediaPorAluno = ativosCount ? (aulasSemana/ativosCount) : 0;
    var mesAtualStr = hojeStr.slice(0,7);
    var novosEsteMes = state.alunos.filter(function(a){ return a.dataCadastro && String(a.dataCadastro).slice(0,7)===mesAtualStr; }).length;

    function statCard(ic, cor, val, lab, delta){
      return '<div class="dash-stat kpi"><div class="kpi-top"><div class="dash-stat-ic '+cor+'">'+ic+'</div>'
        + (delta ? '<span class="dash-stat-delta">'+delta+'</span>' : '') + '</div>'
        + '<div><div class="dash-stat-val">'+val+'</div><div class="dash-stat-lab">'+lab+'</div></div></div>';
    }
    var statsBox = document.getElementById("alunos-stats");
    if (statsBox){
      statsBox.innerHTML =
        statCard(SVG_PEOPLE,"teal",total,"Total de alunos", total ? (novosEsteMes>0 ? "+"+novosEsteMes+" este mês" : "sem novos no mês") : "") +
        statCard(SVG_CAL,"green",ativosCount,"Alunos ativos", total ? Math.round(ativosCount/total*100)+"% do total" : "") +
        statCard(SVG_BAG,"amber",inativosCount,"Inativos", total ? Math.round(inativosCount/total*100)+"% do total" : "") +
        statCard(SVG_DUMBBELL,"violet",aulasSemana,"Aulas na semana", ativosCount ? mediaPorAluno.toFixed(1)+" média/aluno" : "");
    }

    // ---- resumo lateral (donut ativos x inativos) ----
    var donutBox = document.getElementById("alunos-resumo-donut");
    if (donutBox){
      if (total===0){
        donutBox.innerHTML = '<div class="empty-state sm">Cadastre o primeiro aluno para ver o resumo.</div>';
      } else {
        var pctAtivos = ativosCount/total*100;
        donutBox.innerHTML =
          '<div class="donut-wrap">'
          + '<div class="donut-svg" style="background: conic-gradient(var(--accent) 0 '+pctAtivos+'%, var(--border) '+pctAtivos+'% 100%);"><div class="donut-center">'+total+'<span>'+(total===1?"aluno":"alunos")+'</span></div></div>'
          + '<div class="donut-legend">'
          +   '<div class="donut-legend-item"><span class="dot" style="background:var(--accent);"></span>Ativos<b>'+ativosCount+'</b><span class="pct">'+Math.round(pctAtivos)+'%</span></div>'
          +   '<div class="donut-legend-item"><span class="dot" style="background:var(--border);"></span>Inativos<b>'+inativosCount+'</b><span class="pct">'+Math.round(100-pctAtivos)+'%</span></div>'
          + '</div></div>';
      }
    }
    renderAtividades("alunos-atividades");
    renderAcoes("alunos-acoes");

    // ---- lista filtrada ----
    var lista = state.alunos.filter(function(a){
      if (alunoFiltroStatus==="ativo" && !a.ativo) return false;
      if (alunoFiltroStatus==="inativo" && a.ativo) return false;
      if (alunoFiltroCiclo!=="todos" && a.plano.tipo!==alunoFiltroCiclo) return false;
      if (termo){
        var bateNome = normalizar(a.nome).indexOf(termo)>=0;
        var bateTelefone = termoTelefone && (a.telefone||"").replace(/\D/g,"").indexOf(termoTelefone)>=0;
        if (!bateNome && !bateTelefone) return false;
      }
      return true;
    });
    lista.sort(function(a,b){
      var r = a.nome.localeCompare(b.nome, "pt-BR");
      return alunoOrdenacao==="nome-desc" ? -r : r;
    });

    var tbody = document.getElementById("alunos-tabela-body");
    var cardsBox = document.getElementById("alunos-cards");
    var contagemBox = document.getElementById("alunos-contagem");

    if (total===0){
      var vazioTotal = '<div class="empty-state"><div class="display">Nenhum aluno cadastrado</div>Clique em "Novo aluno" para começar.</div>';
      if (tbody) tbody.innerHTML = '';
      if (cardsBox) cardsBox.innerHTML = vazioTotal;
      if (contagemBox) contagemBox.textContent = "";
      return;
    }
    if (lista.length===0){
      var vazioFiltro = '<div class="empty-state"><div class="display">Nenhum aluno encontrado</div>Ajuste a busca ou os filtros.</div>';
      if (tbody) tbody.innerHTML = '<tr><td colspan="6">'+vazioFiltro+'</td></tr>';
      if (cardsBox) cardsBox.innerHTML = vazioFiltro;
      if (contagemBox) contagemBox.textContent = "";
      return;
    }

    if (tbody){
      tbody.innerHTML = lista.map(function(a){
        var prox = proximaAulaDoAluno(a.id);
        var proxLabel = prox ? fmtDataBR(prox.data)+' · '+prox.hora : '<span class="card-sub">Nenhuma agendada</span>';
        return '<tr onclick="abrirDetalheAluno(\''+a.id+'\')">'
          + '<td><div class="card-row" style="justify-content:flex-start;gap:10px;">'+avatarAluno(a,'width:34px;height:34px;font-size:12px;')
          +   '<div><div class="card-title">'+esc(a.nome)+'</div><div class="card-sub">'+(idadeLabel(a.nascimento)||"&mdash;")+'</div></div></div></td>'
          + '<td>'+(a.ativo ? '<span class="badge ok">Ativo</span>' : '<span class="badge neutral">Inativo</span>')+'</td>'
          + '<td><span class="badge accent">'+planoLabelMap[a.plano.tipo]+'</span></td>'
          + '<td>'+proxLabel+'</td>'
          + '<td>'+a.telefone+'</td>'
          + '<td class="alunos-acoes-col" onclick="event.stopPropagation();">'
          +   '<button class="icon-btn" title="Ver detalhes" onclick="abrirDetalheAluno(\''+a.id+'\')">'+ICONS.eye+'</button>'
          +   '<button class="icon-btn" title="Editar" onclick="abrirModalAluno(\''+a.id+'\')">'+ICONS.edit+'</button>'
          + '</td></tr>';
      }).join("");
    }
    if (cardsBox){
      cardsBox.innerHTML = lista.map(function(a){
        var prox = proximaAulaDoAluno(a.id);
        var proxLabel = prox ? fmtDataBR(prox.data)+' · '+prox.hora : 'Nenhuma aula agendada';
        return '<div class="card" onclick="abrirDetalheAluno(\''+a.id+'\')" style="cursor:pointer;">'
          + '<div class="card-row"><div class="card-main" style="display:flex;align-items:center;gap:10px;">'
          +   avatarAluno(a,'width:34px;height:34px;font-size:12.5px;')
          +   '<div><div class="card-title">'+esc(a.nome)+'</div><div class="card-sub">'+[idadeLabel(a.nascimento), esc(a.telefone)].filter(Boolean).join(" · ")+'</div></div></div>'
          + (a.ativo ? '<span class="badge ok">Ativo</span>' : '<span class="badge neutral">Inativo</span>')
          + '</div>'
          + '<div class="card-row" style="margin-top:8px;"><span class="badge accent">'+planoLabelMap[a.plano.tipo]+'</span><span class="card-sub">'+proxLabel+'</span></div>'
          + '</div>';
      }).join("");
    }
    if (contagemBox) contagemBox.textContent = lista.length + (lista.length===1 ? " aluno encontrado" : " alunos encontrados");
  }

  function inicioSemanaDe(d){
    var i = new Date(d); i.setDate(d.getDate()-d.getDay());
    return i;
  }
  function diasDaSemanaAtual(){
    var inicio = inicioSemanaDe(agendaData);
    var arr = [];
    for (var i=0;i<7;i++){ var d = new Date(inicio); d.setDate(inicio.getDate()+i); arr.push(fmtData(d)); }
    return arr;
  }

  function renderAgenda(){
    var temBusca = normalizar(agendaBusca).length > 0;
    var secao = document.getElementById("screen-agenda");
    secao.classList.toggle("modo-semana", agendaModo === "semana" && !temBusca);
    // sincroniza o toggle Dia/Semana com o modo atual sempre que a Agenda é renderizada,
    // mesmo quando o modo foi alterado por outra tela (ex.: mini-calendário do Dashboard)
    document.querySelectorAll("#agenda-seg-toggle .seg-btn").forEach(function(b){ b.classList.toggle("active", b.dataset.modo===agendaModo); });
    document.getElementById("agenda-toolbar").hidden = temBusca;
    document.getElementById("agenda-dias-mobile").hidden = temBusca || agendaModo !== "semana";
    var picker = document.getElementById("agenda-datepicker");
    if (picker) picker.value = fmtData(agendaData);

    if (temBusca){
      document.getElementById("agenda-semana-grid").hidden = true;
      renderAgendaBusca(agendaBusca);
    } else if (agendaModo === "semana"){
      renderAgendaSemanaGrid();
      renderDiasMobile();
      renderAgendaLista(fmtData(agendaData), true);
      document.getElementById("agenda-semana-grid").hidden = false;
    } else {
      document.getElementById("agenda-semana-grid").hidden = true;
      renderAgendaDia();
    }
    renderResumoSemanaAgenda();
    renderAulasDeHojeRail();
    renderAgendaAcoes();
    renderAgendaProximas();
  }

  function renderAgendaBusca(termo){
    var termoNorm = normalizar(termo);
    var resultados = state.aulas.filter(function(c){
      var aluno = getAluno(c.alunoId);
      return aluno && normalizar(aluno.nome).indexOf(termoNorm) >= 0;
    }).sort(function(a,b){ return (a.data+a.hora) < (b.data+b.hora) ? -1 : 1; });
    var box = document.getElementById("agenda-lista");
    box.innerHTML = resultados.length ? resultados.map(function(c){
      return cardAula(c, getAluno(c.alunoId), true);
    }).join("") : '<div class="empty-state"><div class="display">Nenhuma aula encontrada</div></div>';
  }

  function renderAgendaLista(dataStr, comCabecalho){
    var aulasDoDia = state.aulas.filter(function(c){return c.data===dataStr;})
      .sort(function(a,b){ return a.hora<b.hora?-1:1; });
    var box = document.getElementById("agenda-lista");
    var linkRota = rotaDoDiaLink(dataStr);
    var rotaHtml = linkRota ? '<a class="btn sm block" style="margin-bottom:10px;" href="'+linkRota+'" target="_blank" rel="noopener">'+ICONS.route+' Ver rota do dia</a>' : '';
    var cabecalho = "";
    if (comCabecalho){
      var ativas = aulasDoDia.filter(function(c){return c.status!=="cancelada" && c.status!=="remarcada";}).length;
      var rotulo = (dataStr===fmtData(hoje) ? "Hoje · " : "") + capitalizar(diaSemanaLabel(dataStr)) + ", " + fmtDataBR(dataStr).slice(0,5);
      cabecalho = '<div class="agenda-lista-cabecalho">'+rotulo+'<span>'+ativas+(ativas===1?" aula":" aulas")+'</span></div>';
    }
    box.innerHTML = cabecalho + rotaHtml + (aulasDoDia.length ? aulasDoDia.map(function(c){
      return cardAula(c, getAluno(c.alunoId));
    }).join("") : '<div class="empty-state"><div class="display">Sem aulas nesse dia</div></div>');
  }

  function renderAgendaDia(){
    document.getElementById("agenda-periodo-label").textContent = capitalizar(diaSemanaLabel(fmtData(agendaData))) + " · " + fmtDataBR(fmtData(agendaData));
    renderAgendaLista(fmtData(agendaData), false);
  }

  function renderDiasMobile(){
    var dias = diasDaSemanaAtual();
    var hojeStr = fmtData(hoje);
    var selStr = fmtData(agendaData);
    var box = document.getElementById("agenda-dias-mobile");
    box.innerHTML = dias.map(function(dStr){
      var d = new Date(dStr+"T00:00:00");
      var cls = "dia-pill" + (dStr===selStr?" ativo":"") + (dStr===hojeStr?" hoje":"");
      var n = state.aulas.filter(function(c){ return c.data===dStr && c.status!=="cancelada" && c.status!=="remarcada"; }).length;
      return '<button class="'+cls+'" onclick="irParaDiaPill(\''+dStr+'\')"><span class="dia-pill-dow">'+DIAS_ABREV[d.getDay()]+'</span><span class="dia-pill-num">'+d.getDate()+'</span>'+(n?'<span class="dia-pill-dot"></span>':'')+'</button>';
    }).join("");
  }

  function renderAgendaSemanaGrid(){
    var inicio = inicioSemanaDe(agendaData);
    var fim = new Date(inicio); fim.setDate(inicio.getDate()+6);
    document.getElementById("agenda-periodo-label").textContent = fmtDataBR(fmtData(inicio)) + " – " + fmtDataBR(fmtData(fim));

    var dias = diasDaSemanaAtual();
    var hojeStr = fmtData(hoje);
    var aulasSemana = state.aulas.filter(function(c){ return dias.indexOf(c.data) >= 0; });

    var horas = aulasSemana.map(function(c){ return parseInt(c.hora.slice(0,2),10); });
    var minHour = horas.length ? Math.min(7, Math.min.apply(null,horas)) : 7;
    var maxHour = horas.length ? Math.max(20, Math.max.apply(null,horas)+1) : 20;
    minHour = Math.max(0, minHour);
    maxHour = Math.min(23, maxHour);
    var HOUR_PX = 56;
    var totalPx = (maxHour-minHour+1)*HOUR_PX;

    var head = '<div class="asg-corner"></div>' + dias.map(function(dStr){
      var d = new Date(dStr+"T00:00:00");
      var cls = "asg-day-head" + (dStr===hojeStr?" hoje":"");
      return '<div class="'+cls+'"><span class="asg-dow">'+DIAS_ABREV[d.getDay()]+'</span><span class="asg-num">'+String(d.getDate()).padStart(2,"0")+'/'+String(d.getMonth()+1).padStart(2,"0")+'</span></div>';
    }).join("");

    var trilha = "";
    for (var h=minHour; h<=maxHour; h++){
      trilha += '<div class="asg-hour-label" style="height:'+HOUR_PX+'px;">'+String(h).padStart(2,"0")+':00</div>';
    }

    var colunas = dias.map(function(dStr){
      // Bloqueios manuais que cobrem esse dia, desenhados como faixa de fundo
      // ATRÁS das aulas (clicáveis só onde não há aula por cima, já que vêm
      // antes no DOM — mesma técnica usada pelos blocos de aula).
      var overlaysBloqueio = state.bloqueios.filter(function(b){
        return dStr >= b.dataInicio && dStr <= b.dataFim;
      }).map(function(b){
        var diaInteiro = !b.horaInicio && !b.horaFim;
        var topPx, heightPx;
        if (diaInteiro){
          topPx = 0; heightPx = totalPx;
        } else {
          var iniMin = Math.max(paraMinutos(b.horaInicio), minHour*60);
          var fimMin = Math.min(paraMinutos(b.horaFim), (maxHour+1)*60);
          if (fimMin <= iniMin) return "";
          topPx = (iniMin - minHour*60)/60*HOUR_PX;
          heightPx = (fimMin - iniMin)/60*HOUR_PX;
        }
        var rotulo = escapeAttr(b.motivo || "Bloqueado");
        var infoCompleta = escapeAttr(descricaoBloqueio(b));
        return '<button type="button" class="asg-bloqueio" style="top:'+topPx+'px;height:'+heightPx+'px;" onclick="confirmarRemoverBloqueioAgenda(\''+b.id+'\')" data-tip="'+infoCompleta+'" aria-label="'+infoCompleta+'" title="'+infoCompleta+'">'
          + '<span class="asg-bloqueio-label">'+rotulo+'</span></button>';
      }).join("");

      var doDia = aulasSemana.filter(function(c){return c.data===dStr;}).sort(function(a,b){ return a.hora<b.hora?-1:1; });
      var lanes = [];
      var atribuicoes = doDia.map(function(c){
        var hh = parseInt(c.hora.slice(0,2),10), mm = parseInt(c.hora.slice(3,5),10);
        var inicioMin = hh*60+mm;
        var fimMin = inicioMin + ASSUMED_SLOT_MIN;
        var lane = -1;
        for (var i=0;i<lanes.length;i++){ if (lanes[i] <= inicioMin){ lane = i; break; } }
        if (lane === -1){ lane = lanes.length; lanes.push(0); }
        lanes[lane] = fimMin;
        return { c:c, inicioMin:inicioMin, lane:lane };
      });
      var maxLanes = Math.max(1, lanes.length);
      var blocos = atribuicoes.map(function(a){
        var topPx = (a.inicioMin - minHour*60)/60*HOUR_PX;
        var heightPx = Math.max(38, ASSUMED_SLOT_MIN/60*HOUR_PX - 4);
        var widthPct = 100/maxLanes;
        var leftPct = a.lane*widthPct;
        var aluno = getAluno(a.c.alunoId);
        var statusCls = "asg-blk-"+a.c.status;
        var nomeAluno = aluno ? aluno.nome : "";
        // com várias aulas simultâneas a coluna fica estreita demais para o nome completo;
        // melhor legibilidade = mostrar o primeiro nome por inteiro em vez de truncar o nome completo no meio
        var nomeExibido = (maxLanes > 1 && nomeAluno.indexOf(" ") > -1) ? nomeAluno.split(" ")[0] : nomeAluno;
        var infoCompleta = escapeAttr(a.c.hora+' · '+nomeAluno+' · '+statusBadgeTexto(a.c.status));
        return '<button type="button" class="asg-bloco '+statusCls+'" style="top:'+topPx+'px;height:'+heightPx+'px;left:calc('+leftPct+'% + 2px);width:calc('+widthPct+'% - 4px);" onclick="abrirAulaDaGrade(\''+a.c.id+'\')" data-tip="'+infoCompleta+'" aria-label="'+infoCompleta+'" title="'+infoCompleta+'">'
          + '<span class="asg-blk-inner"><span class="asg-blk-hora">'+a.c.hora+'</span><span class="asg-blk-nome">'+nomeExibido+'</span></span></button>';
      }).join("");
      var colCls = "asg-col" + (dStr===hojeStr?" hoje":"");
      return '<div class="'+colCls+'" style="height:'+totalPx+'px;">'+overlaysBloqueio+blocos+'</div>';
    }).join("");

    var html = '<div class="asg-head">'+head+'</div>'
      + '<div class="asg-body">'
      + '<div class="asg-trilha">'+trilha+'</div>'
      + colunas
      + '</div>';
    document.getElementById("agenda-semana-grid").innerHTML = html;
  }

  function statusBadgeTexto(status){
    var map = { agendada:"agendada", confirmada:"confirmada", concluida:"concluída", cancelada:"cancelada", remarcada:"remarcada" };
    return map[status] || status;
  }

  function escapeAttr(s){
    return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
  }

  function renderResumoSemanaAgenda(){
    var dias = diasDaSemanaAtual();
    // "remarcada" marca um horário que deixou de valer (a aula já existe de novo, em outra data/hora,
    // como um registro próprio em state.aulas). Contá-la em "total" somaria a mesma aula duas vezes
    // e distorceria os percentuais, então o resumo considera apenas os status que representam
    // um compromisso ativo na semana.
    var aulas = state.aulas.filter(function(c){ return dias.indexOf(c.data) >= 0 && c.status !== "remarcada"; });
    var total = aulas.length;
    var concluidas = aulas.filter(function(c){return c.status==="concluida";}).length;
    var agendadas = aulas.filter(function(c){return c.status==="agendada" || c.status==="confirmada";}).length;
    var canceladas = aulas.filter(function(c){return c.status==="cancelada";}).length;
    function pct(n){ return total ? Math.round(n/total*100)+"% do total" : ""; }
    function miniStat(ic, cor, val, lab, delta){
      return '<div class="dash-stat kpi"><div class="kpi-top"><div class="dash-stat-ic '+cor+'">'+ic+'</div>'
        + (delta ? '<span class="dash-stat-delta">'+delta+'</span>' : '') + '</div>'
        + '<div><div class="dash-stat-val">'+val+'</div><div class="dash-stat-lab">'+lab+'</div></div></div>';
    }
    document.getElementById("agenda-resumo-semana").innerHTML =
      miniStat(SVG_CAL,"violet",total,"Aulas na semana","") +
      miniStat(ICONS.check,"green",concluidas,"Concluídas", pct(concluidas)) +
      miniStat(ICONS.clock,"amber",agendadas,"Agendadas", pct(agendadas)) +
      miniStat(ICONS.x,"danger",canceladas,"Canceladas", pct(canceladas));
  }

  function renderAulasDeHojeRail(){
    var hojeStr = fmtData(hoje);
    var aulas = state.aulas.filter(function(c){return c.data===hojeStr;}).sort(function(a,b){ return a.hora<b.hora?-1:1; });
    var box = document.getElementById("agenda-aulas-hoje");
    if (!box) return;
    if (!aulas.length){ box.innerHTML = '<div class="empty-state sm">Nenhuma aula hoje.</div>'; return; }
    box.innerHTML = aulas.map(function(c){
      var al = getAluno(c.alunoId);
      return '<div class="aula-row" style="cursor:pointer;" onclick="abrirAulaDaGrade(\''+c.id+'\')">'+avatarAluno(al)
        + '<div class="aula-row-main"><div class="aula-row-nome">'+esc(al.nome)+'</div><div class="aula-row-sub">'+c.hora+' · Aula de Personal</div></div>'
        + statusBadge(c.status) + '</div>';
    }).join("");
  }

  function renderAgendaAcoes(){
    var acoes = [
      { ic: SVG_CAL, cor:"violet", lab:"Nova aula", fn:"abrirModalAula()" },
      { ic: SVG_PEOPLE, cor:"teal", lab:"Novo aluno", fn:"abrirModalAluno()" },
      { ic: SVG_DUMBBELL, cor:"green", lab:"Ver alunos", fn:"irParaTab('alunos')" },
      { ic: SVG_BAG, cor:"amber", lab:"Ver financeiro", fn:"irParaTab('financeiro')" }
    ];
    var box = document.getElementById("agenda-acoes");
    if (!box) return;
    box.innerHTML = acoes.map(function(a){
      return '<button class="acao-btn" onclick="'+a.fn+'"><span class="acao-ic dash-stat-ic '+a.cor+'">'+a.ic+'</span>'+a.lab+'</button>';
    }).join("");
  }

  function renderAgendaProximas(){
    var hojeStr = fmtData(hoje);
    var proximas = state.aulas.filter(function(c){
      return c.data>=hojeStr && c.status!=="cancelada" && c.status!=="remarcada" && c.status!=="concluida";
    }).sort(function(a,b){ return (a.data+a.hora) < (b.data+b.hora) ? -1 : 1; }).slice(0,8);
    var tbody = document.getElementById("agenda-proximas-body");
    if (!tbody) return;
    if (!proximas.length){
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state sm">Nenhuma aula futura agendada.</div></td></tr>';
      return;
    }
    tbody.innerHTML = proximas.map(function(c){
      var al = getAluno(c.alunoId);
      return '<tr>'
        + '<td>'+fmtDataBR(c.data)+'</td>'
        + '<td>'+c.hora+'</td>'
        + '<td>'+esc(al.nome)+'</td>'
        + '<td class="card-sub">'+al.endereco+'</td>'
        + '<td>'+statusBadge(c.status)+'</td>'
        + '<td class="alunos-acoes-col"><a class="icon-btn" href="'+mapsLink(al.endereco)+'" target="_blank" rel="noopener" title="Maps">'+ICONS.route+'</a><button class="icon-btn" title="Ver aula" onclick="abrirAulaDaGrade(\''+c.id+'\')">'+ICONS.eye+'</button></td></tr>';
    }).join("");
  }

  function mesLabel(mesStr){
    var partes = mesStr.split("-");
    return MESES_ABREV[Number(partes[1])-1] + "/" + partes[0];
  }

  // alunoId é opcional em todas as três funções abaixo: quando omitido, mantém exatamente o
  // comportamento original (todos os alunos). Passá-lo apenas restringe a MESMA regra de cálculo
  // a um único aluno — nenhuma fórmula financeira foi alterada.
  function calcularPrevistoMes(mesStr, alunoId){
    var total = 0;
    state.alunos.filter(function(a){ return a.ativo && (!alunoId || alunoId==="todos" || a.id===alunoId); }).forEach(function(aluno){
      var aulasDoAlunoNoMes = state.aulas.filter(function(c){
        return c.alunoId===aluno.id && c.data.slice(0,7)===mesStr && c.status!=="cancelada" && c.status!=="remarcada";
      });
      if (aulasDoAlunoNoMes.length===0) return;
      if (aluno.plano.cobranca === "por_aula"){
        total += aulasDoAlunoNoMes.length * aluno.plano.valorAula;
      } else if (aluno.plano.tipo === "semanal"){
        var semanas = {};
        aulasDoAlunoNoMes.forEach(function(c){
          var d = new Date(c.data+"T00:00:00");
          var inicioSemana = new Date(d); inicioSemana.setDate(d.getDate()-d.getDay());
          semanas[fmtData(inicioSemana)] = true;
        });
        total += Object.keys(semanas).length * aluno.plano.valorFixo;
      } else {
        total += aluno.plano.valorFixo;
      }
    });
    return total;
  }

  function calcularRecebidoMes(mesStr, alunoId){
    return state.pagamentos.filter(function(p){
      return p.status==="pago" && p.dataPagamento && p.dataPagamento.slice(0,7)===mesStr && (!alunoId || alunoId==="todos" || p.alunoId===alunoId);
    }).reduce(function(s,p){ return s+p.valor; }, 0);
  }

  function calcularPendenteMes(mesStr, alunoId){
    return state.pagamentos.filter(function(p){
      return p.status==="pendente" && p.mesReferencia===mesStr && (!alunoId || alunoId==="todos" || p.alunoId===alunoId);
    }).reduce(function(s,p){ return s+p.valor; }, 0);
  }

  // mês "dono" de um pagamento, para agrupar pendentes e pagos sob o mesmo critério de período
  function financeiroMesDoPagamento(p){
    if (p.status==="pago") return (p.dataPagamento||"").slice(0,7);
    return p.mesReferencia || (p.dataVencimento||"").slice(0,7);
  }

  function renderVisaoMensal(){
    // acompanha a navegação do Financeiro: 2 meses antes e 2 depois do mês
    // selecionado (finMesCursor), destacando o mês selecionado e respeitando
    // o filtro de aluno (mesmas funções de cálculo já usadas no resto da tela).
    var mesesRef = [];
    for (var i=-2; i<=2; i++){ mesesRef.push(finSomarMes(finMesCursor, i)); }
    var alunoId = finAlunoFiltro;
    var linhas = [
      {label:"Previsto", calc:calcularPrevistoMes, cor:""},
      {label:"Recebido", calc:calcularRecebidoMes, cor:"ok"},
      {label:"A receber", calc:calcularPendenteMes, cor:"warn"}
    ];

    // ---- tabela (desktop/tablet) ----
    var html = '<div class="tabela-mensal-wrap"><table class="tabela-mensal"><thead><tr><th></th>';
    mesesRef.forEach(function(m){
      html += '<th class="'+(m===finMesCursor?'atual':'')+'">'+mesLabel(m)+'</th>';
    });
    html += '</tr></thead><tbody>';
    linhas.forEach(function(linha){
      html += '<tr><td class="tabela-mensal-label">'+linha.label+'</td>';
      mesesRef.forEach(function(m){
        html += '<td class="'+(m===finMesCursor?'atual ':'')+linha.cor+'">'+fmtMoeda(linha.calc(m, alunoId))+'</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // ---- carrossel com snap (mobile): um cartão por mês, com indicação visual
    // de que há mais meses para os lados (cartão ocupa ~78% da largura, deixando
    // o próximo/anterior visível na borda) ----
    var carrossel = '<div class="visao-mensal-carrossel" id="visao-mensal-carrossel">' + mesesRef.map(function(m){
      var selecionado = m===finMesCursor;
      var linhasHtml = linhas.map(function(linha){
        return '<div class="vmc-linha"><span class="vmc-linha-label">'+linha.label+'</span><span class="vmc-linha-valor '+linha.cor+'">'+fmtMoeda(linha.calc(m, alunoId))+'</span></div>';
      }).join("");
      return '<div class="vmc-card'+(selecionado?' sel':'')+'" data-mes="'+m+'"><div class="vmc-mes">'+mesLabel(m)+(selecionado?' <span class="vmc-tag">selecionado</span>':'')+'</div>'+linhasHtml+'</div>';
    }).join("") + '</div>';

    document.getElementById("fin-visao-mensal").innerHTML = html + carrossel;

    var cardSelecionado = document.querySelector("#visao-mensal-carrossel .vmc-card.sel");
    if (cardSelecionado) cardSelecionado.scrollIntoView({ inline:"center", block:"nearest" });
  }

  function ehVencido(p){
    return p.status==="pendente" && p.dataVencimento && p.dataVencimento < fmtData(hoje);
  }

  // mês "dono" de um pagamento, para agrupar pendentes e pagos sob o mesmo critério de período
  // (definida acima de calcularPendenteMes; mantida aqui também por clareza de uso no filtro da tabela)

  // ---------- estado de navegação/filtros do Financeiro ----------
  var finMesCursor = fmtData(hoje).slice(0,7); // "YYYY-MM"
  var finAlunoFiltro = "todos";
  var finAba = "todas"; // todas | abertas | vencidas | recebidas
  var finBusca = "";
  var finPagina = 1;
  var FIN_POR_PAGINA = 8;

  function finSomarMes(mesStr, delta){
    var d = new Date(mesStr+"-01T00:00:00");
    d = new Date(d.getFullYear(), d.getMonth()+delta, 1);
    return fmtData(d).slice(0,7);
  }

  function finDeltaPct(atual, anterior){
    if (!anterior) return null;
    return ((atual-anterior)/anterior)*100;
  }

  window.mudarMesFinanceiro = function(delta){
    finMesCursor = finSomarMes(finMesCursor, delta);
    finPagina = 1;
    renderFinanceiro();
  };

  window.mudarAlunoFinanceiro = function(valor){
    finAlunoFiltro = valor;
    finPagina = 1;
    renderFinanceiro();
  };

  window.mudarAbaFinanceiro = function(aba){
    finAba = aba;
    finPagina = 1;
    renderFinanceiro();
  };

  window.filtrarFinanceiro = function(valor){
    finBusca = (valor||"").toLowerCase();
    finPagina = 1;
    renderFinanceiro();
  };

  window.mudarPaginaFinanceiro = function(delta){
    finPagina += delta;
    renderFinanceiro();
  };

  window.abrirRegistrarRecebimento = function(){
    finAba = "abertas";
    finPagina = 1;
    renderFinanceiro();
    var wrap = document.getElementById("fin-tabela-wrap");
    if (wrap) wrap.scrollIntoView({ behavior:"smooth", block:"start" });
  };

  function finIndicadores(){
    var mesAnterior = finSomarMes(finMesCursor, -1);
    var recebidoMes = calcularRecebidoMes(finMesCursor, finAlunoFiltro);
    var recebidoAnt = calcularRecebidoMes(mesAnterior, finAlunoFiltro);
    var previstoMes = calcularPrevistoMes(finMesCursor, finAlunoFiltro);
    var previstoAnt = calcularPrevistoMes(mesAnterior, finAlunoFiltro);

    var pendentesTodos = state.pagamentos.filter(function(p){
      return p.status==="pendente" && (finAlunoFiltro==="todos" || p.alunoId===finAlunoFiltro);
    });
    var emAberto = pendentesTodos.reduce(function(s,p){ return s+p.valor; }, 0);
    var vencido = pendentesTodos.filter(ehVencido).reduce(function(s,p){ return s+p.valor; }, 0);

    function deltaTxt(atual, anterior){
      var d = finDeltaPct(atual, anterior);
      if (d===null) return null;
      var cls = d>=0 ? "" : " down";
      var sinal = d>=0 ? "+" : "";
      return '<span class="dash-stat-delta'+cls+'">'+sinal+d.toFixed(0)+'% vs. mês anterior</span>';
    }

    return [
      { ic: ICONS.cash, cor:"teal", label:"Recebido no mês", valor: recebidoMes, delta: deltaTxt(recebidoMes, recebidoAnt) },
      { ic: ICONS.clock, cor:"violet", label:"Previsto no mês", valor: previstoMes, delta: deltaTxt(previstoMes, previstoAnt) },
      { ic: ICONS.alert, cor:"amber", label:"Em aberto (acumulado)", valor: emAberto, delta: null },
      { ic: ICONS.alert, cor:"danger", label:"Vencido (acumulado)", valor: vencido, delta: null }
    ];
  }

  function renderFinanceiroIndicadores(){
    var itens = finIndicadores();
    document.getElementById("fin-indicadores").innerHTML = itens.map(function(it){
      return '<div class="dash-stat kpi"><div class="kpi-top"><div class="dash-stat-ic '+it.cor+'">'+it.ic+'</div>'
        + (it.delta||'') + '</div>'
        + '<div><div class="dash-stat-val">'+fmtMoeda(it.valor)+'</div><div class="dash-stat-lab">'+it.label+'</div></div></div>';
    }).join("");
  }

  function renderFinanceiroGrafico(){
    var meses = [];
    for (var i=-5; i<=0; i++){ meses.push(finSomarMes(finMesCursor, i)); }
    var dados = meses.map(function(m){
      return { m:m, prev:calcularPrevistoMes(m, finAlunoFiltro), receb:calcularRecebidoMes(m, finAlunoFiltro), aberto:calcularPendenteMes(m, finAlunoFiltro) };
    });
    var max = 1;
    dados.forEach(function(d){ max = Math.max(max, d.prev, d.receb, d.aberto); });
    function barra(cls, val){ var hpx = Math.round(val/max*112); return '<div class="chart-bar '+cls+'" style="height:'+hpx+'px"></div>'; }
    var cols = dados.map(function(d){
      return '<div class="chart-col"><div class="chart-bars">'+barra("prev",d.prev)+barra("receb",d.receb)+barra("aberto",d.aberto)+'</div>'
        + '<div class="chart-xlab">'+mesLabel(d.m).split("/")[0]+'</div></div>';
    }).join("");
    var legenda = '<div class="chart-legend">'
      + '<span><i class="chart-dot" style="background:#CBD1DA"></i>Previsto</span>'
      + '<span><i class="chart-dot" style="background:var(--accent)"></i>Recebido</span>'
      + '<span><i class="chart-dot" style="background:var(--warning)"></i>Em aberto</span></div>';
    document.getElementById("fin-grafico").innerHTML = '<div class="chart-fin">'+cols+'</div>'+legenda;
  }

  function finPagamentosFiltrados(){
    var busca = finBusca;
    return state.pagamentos.filter(function(p){
      if (finAlunoFiltro!=="todos" && p.alunoId!==finAlunoFiltro) return false;
      if (financeiroMesDoPagamento(p) !== finMesCursor) return false;
      if (finAba==="abertas" && !(p.status==="pendente" && !ehVencido(p))) return false;
      if (finAba==="vencidas" && !(p.status==="pendente" && ehVencido(p))) return false;
      if (finAba==="recebidas" && p.status!=="pago") return false;
      if (busca){
        var aluno = getAluno(p.alunoId);
        var alvo = ((aluno?aluno.nome:"") + " " + p.referencia + " " + fmtMoeda(p.valor)).toLowerCase();
        if (alvo.indexOf(busca)===-1) return false;
      }
      return true;
    }).sort(function(a,b){
      var da = a.dataVencimento || a.dataPagamento || "";
      var db = b.dataVencimento || b.dataPagamento || "";
      return da < db ? -1 : 1;
    });
  }

  function finStatusBadge(p){
    if (p.status==="pago") return '<span class="badge ok">recebido</span>';
    var extra = (p.pagoInformadoEm && p.status!=="pago") ? ' <span class="badge info">pagamento informado</span>' : '';
    if (ehVencido(p)) return '<span class="badge danger">vencido</span>'+extra;
    return '<span class="badge warn">em aberto</span>'+extra;
  }

  function finAcoesRow(p){
    var acoes = '<button class="btn sm" onclick="abrirRecibo(\''+p.id+'\')">'+ICONS.recibo+' Recibo</button>';
    if (p.status==="pendente"){
      acoes += '<button class="btn sm" onclick="abrirCobranca(\''+p.id+'\')">'+ICONS.whats+' Cobrar</button>'
        + '<button class="btn sm primary" onclick="marcarPago(\''+p.id+'\')">'+ICONS.check+' Marcar pago</button>';
    }
    return '<div class="action-row">'+acoes+'</div>';
  }

  function renderFinanceiroTabela(){
    var todos = finPagamentosFiltrados();
    var totalPaginas = Math.max(1, Math.ceil(todos.length / FIN_POR_PAGINA));
    if (finPagina > totalPaginas) finPagina = totalPaginas;
    if (finPagina < 1) finPagina = 1;
    var inicio = (finPagina-1) * FIN_POR_PAGINA;
    var pagina = todos.slice(inicio, inicio + FIN_POR_PAGINA);

    document.querySelectorAll("#fin-abas-toggle .seg-btn").forEach(function(b){ b.classList.toggle("active", b.dataset.aba===finAba); });

    if (pagina.length===0){
      var vazio = '<div class="empty-state"><div class="display">Nenhuma cobrança encontrada</div></div>';
      document.getElementById("fin-tabela-body").innerHTML = '<tr><td colspan="6">'+vazio+'</td></tr>';
      document.getElementById("fin-cards").innerHTML = vazio;
    } else {
      document.getElementById("fin-tabela-body").innerHTML = pagina.map(function(p){
        var aluno = getAluno(p.alunoId);
        var venc = p.dataVencimento ? fmtDataBR(p.dataVencimento) : "—";
        return '<tr><td>'+venc+'</td><td>'+(aluno?esc(aluno.nome):"—")+'</td><td>'+esc(p.referencia)+'</td><td>'+fmtMoeda(p.valor)+'</td><td>'+finStatusBadge(p)+'</td><td>'+finAcoesRow(p)+'</td></tr>';
      }).join("");

      document.getElementById("fin-cards").innerHTML = pagina.map(function(p){
        var aluno = getAluno(p.alunoId);
        // o valor fica em destaque à direita (não mais dentro do texto truncável do
        // subtítulo), para não ser cortado pelo "..." junto com a data de vencimento.
        var subLabel = p.referencia + (p.dataVencimento ? (' · vence ' + fmtDataBR(p.dataVencimento)) : '');
        return '<div class="card fin-card"><div class="card-row"><div class="card-main"><div class="card-title">'+(aluno?esc(aluno.nome):"—")+'</div><div class="card-sub">'+subLabel+'</div></div>'
          + '<div class="fin-card-right"><div class="fin-card-valor">'+fmtMoeda(p.valor)+'</div>'+finStatusBadge(p)+'</div></div>'+finAcoesRow(p)+'</div>';
      }).join("");
    }

    document.getElementById("fin-paginacao").innerHTML = totalPaginas<=1 ? '' :
      '<button class="btn sm" onclick="mudarPaginaFinanceiro(-1)" '+(finPagina<=1?'disabled':'')+'>'+ICONS.chevL+'</button>'
      + '<span class="fin-pagina-label">Página '+finPagina+' de '+totalPaginas+'</span>'
      + '<button class="btn sm" onclick="mudarPaginaFinanceiro(1)" '+(finPagina>=totalPaginas?'disabled':'')+'>'+ICONS.chevD+'</button>';
  }

  function renderFinanceiroRail(){
    var hojeStr = fmtData(hoje);
    var proximos = state.pagamentos.filter(function(p){
      return p.status==="pendente" && !ehVencido(p) && (finAlunoFiltro==="todos" || p.alunoId===finAlunoFiltro);
    }).sort(function(a,b){ return (a.dataVencimento||"") < (b.dataVencimento||"") ? -1 : 1; }).slice(0,5);

    var recentes = state.pagamentos.filter(function(p){
      return p.status==="pago" && (finAlunoFiltro==="todos" || p.alunoId===finAlunoFiltro);
    }).sort(function(a,b){ return a.dataPagamento < b.dataPagamento ? 1 : -1; }).slice(0,5);

    document.getElementById("fin-proximos").innerHTML = proximos.length ? proximos.map(function(p){
      var aluno = getAluno(p.alunoId);
      return '<div class="card"><div class="card-row"><div class="card-main"><div class="card-title">'+(aluno?esc(aluno.nome):"—")+'</div><div class="card-sub">vence '+fmtDataBR(p.dataVencimento)+'</div></div><span class="badge neutral">'+fmtMoeda(p.valor)+'</span></div></div>';
    }).join("") : '<div class="empty-state"><div class="display">Nada a vencer</div></div>';

    document.getElementById("fin-recentes").innerHTML = recentes.length ? recentes.map(function(p){
      var aluno = getAluno(p.alunoId);
      return '<div class="card"><div class="card-row"><div class="card-main"><div class="card-title">'+(aluno?esc(aluno.nome):"—")+'</div><div class="card-sub">'+fmtDataBR(p.dataPagamento)+'</div></div><span class="badge ok">'+fmtMoeda(p.valor)+'</span></div></div>';
    }).join("") : '<div class="empty-state"><div class="display">Sem recebimentos ainda</div></div>';

    document.getElementById("fin-acoes").innerHTML =
      '<button class="acao-btn" onclick="abrirRegistrarRecebimento()"><span class="acao-ic dash-stat-ic green">'+ICONS.check+'</span>Registrar recebimento</button>'
      + '<button class="acao-btn" onclick="irParaTab(\'alunos\')"><span class="acao-ic dash-stat-ic violet">'+ICONS.eye+'</span>Ver alunos</button>';
  }

  function renderFinanceiroSelects(){
    var selFiltro = document.getElementById("fin-aluno-select");
    if (selFiltro && selFiltro.options.length <= 1){
      selFiltro.innerHTML = '<option value="todos">Todos os alunos</option>' + state.alunos.map(function(a){
        return '<option value="'+a.id+'">'+esc(a.nome)+'</option>';
      }).join("");
      selFiltro.value = finAlunoFiltro;
    }
  }

  function renderFinanceiro(){
    document.getElementById("fin-mes-label").textContent = mesLabel(finMesCursor);
    renderFinanceiroSelects();
    renderFinanceiroIndicadores();
    renderFinanceiroGrafico();
    renderFinanceiroTabela();
    renderFinanceiroRail();
    renderVisaoMensal();
  }

  // ======================= Solicitações (Fase 3) =======================
  function findSolic(id){ for (var i=0;i<state.solicitacoes.length;i++) if (state.solicitacoes[i].id===id) return state.solicitacoes[i]; return null; }
  function findAula(id){ for (var i=0;i<state.aulas.length;i++) if (state.aulas[i].id===id) return state.aulas[i]; return null; }
  function aulaLabel(aula){
    if (!aula) return "(aula não encontrada)";
    var d = new Date(aula.data+"T00:00:00");
    return capitalizar(DIAS[d.getDay()]) + ", " + fmtDataBR(aula.data) + " · " + aula.hora;
  }
  function nomeAlunoSolic(id){ var a = getAluno(id); return esc(a ? a.nome : "(aluno)"); }

  function tagTipo(s){ return '<span class="solic-tag '+s.tipo+'">'+(s.tipo==="remarcar"?"Remarcação":"Cancelamento")+'</span>'; }
  function waAlunoBtn(s){
    var a = getAluno(s.alunoId);
    if (!a || !a.telefone) return "";
    var msg = "Olá "+((a.nome||"").split(" ")[0])+"! Sobre sua solicitação no portal LT360...";
    return '<a class="btn sm solic-wa" href="'+whatsLink(a.telefone, msg)+'" target="_blank" rel="noopener">'+ICONS.whats+' WhatsApp</a>';
  }
  function cardSolicPendente(s){
    var sugestao = (s.tipo==="remarcar" && s.dataSugerida)
      ? '<div class="solic-linha"><b>Horário pedido:</b> '+fmtDataBR(s.dataSugerida)+' · '+s.horaSugerida+'</div>' : '';
    var msg = s.mensagem ? '<div class="solic-linha solic-msg">"'+esc(s.mensagem)+'"</div>' : '';
    var sugerir = s.tipo==="remarcar"
      ? '<button class="btn sm" onclick="abrirSugerirHorario(\''+s.id+'\')">Sugerir horário</button>' : '';
    return '<div class="solic-card-pro">'+
      '<div class="solic-card-top">'+tagTipo(s)+'<span class="solic-aluno">'+nomeAlunoSolic(s.alunoId)+'</span></div>'+
      '<div class="solic-linha">Aula: '+aulaLabel(findAula(s.aulaId))+'</div>'+ sugestao + msg +
      '<div class="solic-botoes">'+ waAlunoBtn(s) +
        '<button class="btn sm" onclick="recusarSolicitacao(\''+s.id+'\')">Recusar</button>'+ sugerir +
        '<button class="btn primary sm" onclick="aceitarSolicitacao(\''+s.id+'\')">Aceitar</button>'+
      '</div></div>';
  }
  function cardSolicContraproposta(s){
    return '<div class="solic-card-pro">'+
      '<div class="solic-card-top">'+tagTipo(s)+'<span class="solic-aluno">'+nomeAlunoSolic(s.alunoId)+'</span><span class="solic-status aguardando">Aguardando o aluno</span></div>'+
      '<div class="solic-linha">Aula: '+aulaLabel(findAula(s.aulaId))+'</div>'+
      '<div class="solic-linha"><b>Você sugeriu:</b> '+fmtDataBR(s.contraData)+' · '+s.contraHora+'</div>'+
      '<div class="solic-botoes">'+ waAlunoBtn(s) +'</div></div>';
  }
  function cardSolicRespondida(s){
    var aplicado = s.status==="aprovada" && s.tipo==="remarcar" && s.contraData
      ? '<div class="solic-linha">Remarcada para '+fmtDataBR(s.contraData)+' · '+s.contraHora+'</div>' : '';
    var badge = s.status==="aprovada" ? '<span class="solic-status ok">Aprovada</span>' : '<span class="solic-status no">Negada</span>';
    return '<div class="solic-card-pro respondida">'+
      '<div class="solic-card-top">'+tagTipo(s)+'<span class="solic-aluno">'+nomeAlunoSolic(s.alunoId)+'</span>'+badge+'</div>'+
      '<div class="solic-linha">Aula: '+aulaLabel(findAula(s.aulaId))+'</div>'+ aplicado +'</div>';
  }
  function renderSolicitacoes(){
    var pend = state.solicitacoes.filter(function(s){ return s.status==="em_analise"; });
    var contra = state.solicitacoes.filter(function(s){ return s.status==="contraproposta"; });
    var resp = state.solicitacoes.filter(function(s){ return s.status==="aprovada" || s.status==="negada"; });
    var badge = document.getElementById("solic-badge");
    var nAgir = pend.length; // só as que pedem ação sua
    if (badge){ if (nAgir){ badge.textContent = nAgir; badge.hidden = false; } else { badge.hidden = true; } }
    var elP = document.getElementById("solic-pendentes");
    var elR = document.getElementById("solic-respondidas");
    if (!elP) return;
    var htmlP = pend.length ? pend.map(cardSolicPendente).join("")
      : '<div class="hint" style="padding:8px 0;">Nenhuma solicitação pendente.</div>';
    if (contra.length) htmlP += '<div class="section-title" style="margin-top:20px;">Aguardando o aluno</div>'+contra.map(cardSolicContraproposta).join("");
    elP.innerHTML = htmlP;
    elR.innerHTML = resp.length ? ('<div class="section-title" style="margin-top:20px;">Respondidas</div>'+resp.map(cardSolicRespondida).join("")) : "";
  }

  // Dispara push via Edge Function (não bloqueia a UI; falha é silenciosa).
  function invocarPush(body){ try{ sb.functions.invoke("enviar-push", { body: body }).catch(function(){}); }catch(e){} }
  function notificarAlunoSolic(id){ invocarPush({ tipo:"solicitacao", solicitacao_id:id }); }
  async function atualizarStatusSolic(id, status){
    var r = await sb.from("solicitacoes").update({ status: status, respondida_em: new Date().toISOString() }).eq("id", id).select().maybeSingle();
    if (r.error){ mostrarToast("Não consegui atualizar a solicitação."); throw r.error; }
    var s = findSolic(id); if (s){ s.status = status; }
    notificarAlunoSolic(id);
    renderSolicitacoes();
  }
  window.recusarSolicitacao = function(id){
    var s = findSolic(id); if (!s) return;
    pedirConfirmacao("Recusar solicitação", "Recusar este pedido? O aluno verá como \"Negada\".", "Recusar", function(){
      atualizarStatusSolic(id, "negada").then(function(){ mostrarToast("Solicitação recusada."); }).catch(function(){});
    });
  };
  window.aceitarSolicitacao = function(id){
    var s = findSolic(id); if (!s) return;
    if (s.tipo==="cancelar"){
      pedirConfirmacao("Aceitar cancelamento", "A aula será cancelada e o pedido marcado como aprovado. Continuar?", "Aceitar e cancelar", function(){
        if (findAula(s.aulaId)) cancelarAula(s.aulaId);   // aplica o cancelamento na agenda
        atualizarStatusSolic(id, "aprovada").then(function(){ mostrarToast("Cancelamento aplicado."); }).catch(function(){});
      });
    } else {
      if (!s.dataSugerida || !s.horaSugerida){ mostrarToast("Solicitação de remarcação sem horário sugerido."); return; }
      pedirConfirmacao("Aceitar remarcação", "A aula será remarcada para "+fmtDataBR(s.dataSugerida)+" às "+s.horaSugerida+". Continuar?", "Aceitar e remarcar", function(){
        aplicarRemarcacaoSolic(s, id);
      });
    }
  };
  // Reaproveita a RPC remarcar_aula (valida capacidade no banco, atômica),
  // igual ao fluxo de remarcação manual. Só marca a solicitação como aprovada
  // se a remarcação der certo; se colidir por capacidade, avisa e deixa pendente.
  function aplicarRemarcacaoSolic(s, id){
    enfileirar(function(){
      return sb.rpc("remarcar_aula", { p_aula_original_id: s.aulaId, p_nova_data: s.dataSugerida, p_nova_hora: s.horaSugerida }).then(function(r){
        if (r.error) throw r.error;
        var nova = rowToAula(r.data);
        if (!state.aulas.some(function(c){ return c.id===nova.id; })) state.aulas.push(nova);
        var origObj = null;
        state.aulas.forEach(function(c){ if (c.id===s.aulaId){ c.status="remarcada"; c.remarcadaParaId=nova.id; origObj=c; } });
        ultimoSnapshot.aulas[nova.id] = JSON.stringify(nova);
        if (origObj) ultimoSnapshot.aulas[s.aulaId] = JSON.stringify(origObj);
      });
    }).then(function(){
      return atualizarStatusSolic(id, "aprovada");
    }).then(function(){
      renderAll(); mostrarToast("Aula remarcada.");
    }).catch(function(err){
      mostrarToast(mensagemErroRemarcacao(err));
    });
  }

  // Contraproposta: personal sugere outro horário -> status 'contraproposta'.
  var sugerindoSolicId = null;
  window.abrirSugerirHorario = function(id){
    var s = findSolic(id); if (!s) return;
    sugerindoSolicId = id;
    var aula = findAula(s.aulaId);
    document.getElementById("sug-data").value = s.dataSugerida || (aula ? aula.data : fmtData(new Date()));
    document.getElementById("sug-hora").value = s.horaSugerida || (aula ? aula.hora : "07:00");
    document.getElementById("sug-aluno").textContent = nomeAlunoSolic(s.alunoId);
    abrirModal("modal-sugerir");
  };
  window.salvarSugestaoHorario = async function(ev){
    if (ev) ev.preventDefault();
    var id = sugerindoSolicId; if (!id) return;
    var d = document.getElementById("sug-data").value, h = document.getElementById("sug-hora").value;
    if (!d || !h){ mostrarToast("Informe a data e o horário."); return; }
    var btn = document.getElementById("sug-submit"); if (btn) btn.disabled = true;
    var r = await sb.from("solicitacoes").update({ status:"contraproposta", contra_data:d, contra_hora:h, respondida_em:new Date().toISOString() }).eq("id", id).select().maybeSingle();
    if (btn) btn.disabled = false;
    if (r.error){ console.error(r.error); mostrarToast("Não consegui enviar a sugestão."); return; }
    var s = findSolic(id); if (s){ s.status="contraproposta"; s.contraData=d; s.contraHora=(h||"").slice(0,5); }
    notificarAlunoSolic(id);
    fecharModal("modal-sugerir");
    renderSolicitacoes();
    mostrarToast("Sugestão enviada ao aluno.");
  };

  function renderAll(){
    renderResumo();
    renderAlunos();
    renderAgenda();
    renderFinanceiro();
    renderPerfil();
    renderDisponibilidade();
    renderSolicitacoes();
  }

  iniciar();

  // ---------- PWA: instalável, ícone e abertura em tela cheia ----------
  // Registro do service worker só cuida do "app shell" (html/js/css/ícones);
  // nunca intercepta chamadas ao Supabase (ver comentário em public/sw.js).
  if ("serviceWorker" in navigator){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("/sw.js").catch(function(err){
        console.error("Falha ao registrar service worker:", err);
      });
    });
  }

  /* ---------------- Push (notificações do personal) ---------------------- */
  var VAPID_PUBLIC = "BKE_rvm-bWgqtyXo060a1aJCWl5MP8tTieToNbcGKUJbBuyKOIsftrnF5biHRsd9haNdP3FtMPp6a-bl_pICWco";
  function pushSuportado(){ return ("serviceWorker" in navigator) && ("PushManager" in window) && ("Notification" in window); }
  function b64ToUint8(b64){
    var pad = "=".repeat((4 - (b64.length % 4)) % 4);
    var base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base64); var arr = new Uint8Array(raw.length);
    for (var i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i);
    return arr;
  }
  async function estadoNotif(){
    if(!pushSuportado()) return "indisponivel";
    if(Notification.permission === "denied") return "bloqueado";
    try{ var reg = await navigator.serviceWorker.ready; var sub = await reg.pushManager.getSubscription(); return sub ? "ativo" : "inativo"; }
    catch(e){ return "inativo"; }
  }
  window.renderNotifPersonal = async function(){
    var box = document.getElementById("perfil-notif");
    if(!box) return;
    var st = await estadoNotif();
    if(st === "indisponivel"){
      box.innerHTML = '<div class="hint">Este navegador não suporta notificações. No iPhone, instale o app na tela inicial.</div>';
    } else if(st === "bloqueado"){
      box.innerHTML = '<div class="hint">Notificações bloqueadas nas configurações do navegador para este site.</div>';
    } else if(st === "ativo"){
      box.innerHTML = '<div class="perfil-notif-row"><span class="perfil-notif-on">'+ICONS.check+' Ativadas neste aparelho</span>'+
        '<button type="button" class="btn sm" onclick="desativarNotifPersonal()">Desativar</button></div>';
    } else {
      box.innerHTML = '<button type="button" class="btn primary" onclick="ativarNotifPersonal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;vertical-align:-3px;"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg> Ativar notificações</button>';
    }
  };
  window.ativarNotifPersonal = async function(){
    if(!pushSuportado()){ mostrarToast("Seu navegador não suporta notificações."); return; }
    try{
      var perm = await Notification.requestPermission();
      if(perm !== "granted"){ mostrarToast("Permissão não concedida."); renderNotifPersonal(); return; }
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: b64ToUint8(VAPID_PUBLIC) });
      var j = sub.toJSON();
      var r = await sb.rpc("salvar_push_personal", { p_endpoint: sub.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent });
      if(r.error) throw r.error;
      mostrarToast("Notificações ativadas!");
      renderNotifPersonal();
    }catch(e){ console.error(e); mostrarToast("Não consegui ativar as notificações."); renderNotifPersonal(); }
  };
  window.desativarNotifPersonal = async function(){
    try{
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if(sub){ try{ await sb.rpc("remover_push_personal", { p_endpoint: sub.endpoint }); }catch(_){} await sub.unsubscribe(); }
      mostrarToast("Notificações desativadas.");
      renderNotifPersonal();
    }catch(e){ console.error(e); mostrarToast("Não consegui desativar."); renderNotifPersonal(); }
  };
})();
