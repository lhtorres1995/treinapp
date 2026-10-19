import { createClient } from '@supabase/supabase-js';
import html2pdf from 'html2pdf.js';
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
    print: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 9V2h12v7M6 18H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-2M6 14h12v8H6v-8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
  };
  var MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  var MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  var DIAS = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];

  var hoje = new Date();
  var agendaData = new Date(hoje); // cursor para dia ou semana, conforme agendaModo
  var agendaModo = "dia";
  var editingAlunoId = null;
  var remarcandoId = null;
  var agendaBusca = "";
  var alunoBuscaTermo = "";
  var agendaDiasExpandido = {};

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
  function addDias(dataStr, n){
    var d = new Date(dataStr+"T00:00:00");
    d.setDate(d.getDate()+n);
    return fmtData(d);
  }
  function calcIdade(iso){
    var nasc = new Date(iso+"T00:00:00");
    var hoje2 = new Date();
    var idade = hoje2.getFullYear() - nasc.getFullYear();
    var m = hoje2.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje2.getDate() < nasc.getDate())) idade--;
    return idade;
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

  var state = { alunos: [], aulas: [], pagamentos: [], professor: {nome:"", telefone:"", pix:"", logo:null} };

  // ---------- mapeamento front <-> banco ----------
  function alunoToRow(a){
    return {
      id: a.id, professor_id: usuarioId,
      nome: a.nome, telefone: a.telefone, sexo: a.sexo || null,
      nascimento: a.nascimento || null, endereco: a.endereco || null,
      plano_tipo: a.plano.tipo, plano_cobranca: a.plano.cobranca,
      valor_fixo: a.plano.valorFixo || 0, valor_aula: a.plano.valorAula || 0,
      recorrencia_horarios: (a.recorrencia && a.recorrencia.horarios) || {},
      ativo: a.ativo !== false
    };
  }
  function rowToAluno(r){
    return {
      id: r.id, nome: r.nome, telefone: r.telefone, sexo: r.sexo,
      nascimento: r.nascimento, endereco: r.endereco,
      plano: { tipo: r.plano_tipo, cobranca: r.plano_cobranca, valorFixo: Number(r.valor_fixo)||0, valorAula: Number(r.valor_aula)||0 },
      recorrencia: { horarios: r.recorrencia_horarios || {} },
      ativo: r.ativo !== false
    };
  }
  function aulaToRow(c){
    return {
      id: c.id, professor_id: usuarioId, aluno_id: c.alunoId,
      data: c.data, hora: c.hora, status: c.status,
      remarcada_para_id: c.remarcadaParaId || null,
      faturada: !!c.faturada, origem: c.origem || "manual"
    };
  }
  function rowToAula(r){
    return {
      id: r.id, alunoId: r.aluno_id, data: r.data, hora: (r.hora||"").slice(0,5),
      status: r.status, remarcadaParaId: r.remarcada_para_id,
      faturada: !!r.faturada, origem: r.origem || "manual"
    };
  }
  function pagamentoToRow(p){
    return {
      id: p.id, professor_id: usuarioId, aluno_id: p.alunoId,
      valor: p.valor, referencia: p.referencia || null, periodo_label: p.periodoLabel || null,
      status: p.status, chave_referencia: p.chaveReferencia || null,
      mes_referencia: p.mesReferencia || null, data_vencimento: p.dataVencimento || null,
      data_pagamento: p.dataPagamento || null, aula_ids: p.aulaIds || []
    };
  }
  function rowToPagamento(r){
    return {
      id: r.id, alunoId: r.aluno_id, valor: Number(r.valor)||0,
      referencia: r.referencia, periodoLabel: r.periodo_label,
      status: r.status, chaveReferencia: r.chave_referencia,
      mesReferencia: r.mes_referencia, dataVencimento: r.data_vencimento,
      dataPagamento: r.data_pagamento, aulaIds: r.aula_ids || []
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
  async function persistir(){
    if (!usuarioId) return;
    await sincronizarTabela("alunos", state.alunos, alunoToRow);
    await sincronizarTabela("aulas", state.aulas, aulaToRow);
    await sincronizarTabela("pagamentos", state.pagamentos, pagamentoToRow);
  }
  var filaPersist = Promise.resolve();
  function salvarEstado(){
    filaPersist = filaPersist.then(persistir).catch(function(e){
      console.error("Erro ao salvar:", e);
      mostrarToast("Erro ao salvar no servidor. Recarregando seus dados...");
      carregarDadosDoServidor().then(renderAll).catch(function(){});
    });
  }

  // ---------- carregamento ----------
  async function carregarDadosDoServidor(){
    var res = await Promise.all([
      sb.from("profiles").select("*").eq("id", usuarioId).maybeSingle(),
      sb.from("alunos").select("*").order("nome"),
      sb.from("aulas").select("*"),
      sb.from("pagamentos").select("*")
    ]);
    var prof = res[0], al = res[1], au = res[2], pg = res[3];
    [al, au, pg].forEach(function(r){ if (r.error) throw r.error; });
    if (prof.error) throw prof.error;
    state.alunos = (al.data || []).map(rowToAluno);
    state.aulas = (au.data || []).map(rowToAula);
    state.pagamentos = (pg.data || []).map(rowToPagamento);
    var p = prof.data || {};
    state.professor = { nome: p.nome || "", telefone: p.telefone || "", pix: p.pix || "", logo: p.logo_url || null };
    snapshotDe("alunos", state.alunos);
    snapshotDe("aulas", state.aulas);
    snapshotDe("pagamentos", state.pagamentos);
  }

  // ---------- autenticação ----------
  function mostrarGateAuth(){
    document.getElementById("gate-loading").hidden = true;
    document.getElementById("gate-auth").hidden = false;
  }
  function setErroAuth(msg){ var e=document.getElementById("auth-erro"); e.textContent=msg||""; e.hidden=!msg; }
  function setMsgAuth(msg){ var e=document.getElementById("auth-msg"); e.textContent=msg||""; e.hidden=!msg; }

  window.alternarModoAuth = function(){
    authModo = authModo === "login" ? "signup" : "login";
    document.getElementById("auth-titulo").textContent = authModo==="login" ? "Entrar" : "Criar conta";
    document.getElementById("auth-submit").textContent = authModo==="login" ? "Entrar" : "Criar conta";
    document.getElementById("auth-toggle").textContent = authModo==="login" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar";
    setErroAuth(""); setMsgAuth("");
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
          document.getElementById("auth-titulo").textContent = "Entrar";
          document.getElementById("auth-submit").textContent = "Entrar";
          document.getElementById("auth-toggle").textContent = "Não tem conta? Criar agora";
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

  async function aposLogin(session){
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
    renderAll();
  }

  window.sairDaConta = function(){
    pedirConfirmacao("Sair da conta", "Você vai precisar entrar de novo para acessar seus dados.", "Sair", function(){
      sb.auth.signOut().then(function(){ location.reload(); });
    });
  };

  async function iniciar(){
    try {
      var s = await sb.auth.getSession();
      if (s.data.session){ await aposLogin(s.data.session); }
      else { mostrarGateAuth(); }
    } catch(err){
      console.error(err);
      mostrarGateAuth();
      setErroAuth("Falha ao conectar no servidor. Tente recarregar a página.");
    }
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

    if (tipo === "avulsa"){
      campoCobranca.hidden = true;
      campoFixo.hidden = true;
      campoAula.hidden = false;
      return;
    }
    campoCobranca.hidden = false;
    var cobranca = document.getElementById("f-plano-cobranca").value;
    campoFixo.hidden = cobranca !== "fixa";
    campoAula.hidden = cobranca !== "por_aula";
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

    if (id){
      var a = getAluno(id);
      document.getElementById("f-nome").value = a.nome;
      document.getElementById("f-telefone").value = a.telefone;
      document.getElementById("f-sexo").value = a.sexo;
      document.getElementById("f-nascimento").value = a.nascimento;
      document.getElementById("f-endereco").value = a.endereco;
      document.getElementById("f-plano-tipo").value = a.plano.tipo;
      document.getElementById("f-plano-cobranca").value = a.plano.cobranca;
      document.getElementById("f-plano-valor-fixo").value = a.plano.valorFixo || "";
      document.getElementById("f-plano-valor-aula").value = a.plano.valorAula || "";
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

  window.salvarAluno = function(ev){
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
      sexo: document.getElementById("f-sexo").value,
      nascimento: document.getElementById("f-nascimento").value,
      endereco: document.getElementById("f-endereco").value.trim(),
      plano: {
        tipo: tipo,
        cobranca: cobranca,
        valorFixo: Number(document.getElementById("f-plano-valor-fixo").value || 0),
        valorAula: Number(document.getElementById("f-plano-valor-aula").value || 0)
      },
      recorrencia: {
        horarios: horariosRecorrencia
      }
    };

    var alunoId;
    var editando = !!editingAlunoId;
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

    var removidas = editando ? limparAulasRecorrenciaFutura(alunoId) : 0;
    var criadas = Object.keys(horariosRecorrencia).length > 0 ? gerarAulasAPartirDaRecorrencia(alunoId) : 0;

    salvarEstado();
    fecharModal("modal-aluno");
    editingAlunoId = null;
    renderAll();
    abrirDetalheAluno(alunoId);
    if (removidas > 0 && criadas > 0){
      mostrarToast("Recorrência atualizada: "+removidas+" aula(s) futura(s) do padrão antigo foram substituídas por "+criadas+" no novo padrão.");
    } else if (removidas > 0){
      mostrarToast(removidas+" aula(s) futura(s) do padrão antigo foram removidas da agenda.");
    } else if (criadas > 0){
      mostrarToast(criadas+" aula(s) recorrente(s) já entraram na agenda (próximas 8 semanas).");
    }
  };

  // ---------- aulas ----------
  window.abrirModalAula = function(){
    remarcandoId = null;
    document.getElementById("modal-aula-titulo").textContent = "Nova aula";
    var sel = document.getElementById("fa-aluno");
    sel.innerHTML = state.alunos.filter(function(a){return a.ativo;}).map(function(a){
      return '<option value="'+a.id+'">'+a.nome+'</option>';
    }).join("");
    document.getElementById("fa-data").value = fmtData(agendaData);
    document.getElementById("fa-hora").value = "07:00";
    abrirModal("modal-aula");
  };

  window.abrirModalRemarcar = function(aulaId){
    var aulaOriginal = null;
    state.aulas.forEach(function(c){ if (c.id===aulaId) aulaOriginal = c; });
    if (!aulaOriginal) return;
    remarcandoId = aulaId;
    document.getElementById("modal-aula-titulo").textContent = "Remarcar aula";
    var sel = document.getElementById("fa-aluno");
    sel.innerHTML = state.alunos.filter(function(a){return a.ativo;}).map(function(a){
      return '<option value="'+a.id+'">'+a.nome+'</option>';
    }).join("");
    sel.value = aulaOriginal.alunoId;
    var novaData = new Date(aulaOriginal.data+"T00:00:00");
    novaData.setDate(novaData.getDate()+1);
    document.getElementById("fa-data").value = fmtData(novaData);
    document.getElementById("fa-hora").value = aulaOriginal.hora;
    abrirModal("modal-aula");
  };

  window.cancelarAula = function(id){
    state.aulas.forEach(function(c){ if (c.id===id) c.status="cancelada"; });
    salvarEstado(); renderAll();
    mostrarToast("Aula cancelada.");
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
    pedirConfirmacao("Concluir aula", "Confirma que essa aula foi dada? Se o aluno pagar por aula, isso já gera a cobrança.", "Concluir", function(){ concluirAula(id); });
  };
  window.confirmarCancelar = function(id){
    pedirConfirmacao("Cancelar aula", "Tem certeza que quer cancelar essa aula? Essa ação pode ser desfeita remarcando depois.", "Cancelar aula", function(){ cancelarAula(id); });
  };

  window.salvarAula = function(ev){
    ev.preventDefault();
    var novaAula = {
      id: uid(),
      alunoId: document.getElementById("fa-aluno").value,
      data: document.getElementById("fa-data").value,
      hora: document.getElementById("fa-hora").value,
      status: "agendada",
      faturada: false,
      origem: "manual"
    };
    state.aulas.push(novaAula);

    if (remarcandoId){
      state.aulas.forEach(function(c){
        if (c.id===remarcandoId){ c.status = "remarcada"; c.remarcadaParaId = novaAula.id; }
      });
      mostrarToast("Aula remarcada.");
      remarcandoId = null;
    }

    salvarEstado();
    fecharModal("modal-aula");
    renderAll();
  };

  window.filtrarAlunos = function(valor){
    alunoBuscaTermo = valor;
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
    document.querySelectorAll(".seg-btn").forEach(function(b){ b.classList.toggle("active", b.dataset.modo===modo); });
    renderAgenda();
  };
  window.mudarCursorAgenda = function(delta){
    agendaData.setDate(agendaData.getDate() + delta * (agendaModo==="semana" ? 7 : 1));
    renderAgenda();
  };

  window.confirmarAula = function(id){
    state.aulas.forEach(function(c){ if (c.id===id) c.status="confirmada"; });
    salvarEstado(); renderAll();
  };
  window.concluirAula = function(id){
    var aula = null;
    state.aulas.forEach(function(c){ if (c.id===id) aula = c; });
    if (!aula) return;
    aula.status = "concluida";
    var aluno = getAluno(aula.alunoId);
    if (aluno && aluno.plano.tipo === "avulsa" && !aula.faturada){
      aula.faturada = true;
      state.pagamentos.push({
        id: uid(), alunoId: aluno.id, valor: aluno.plano.valorAula,
        referencia: "Aula de "+fmtDataBR(aula.data), status: "pendente",
        mesReferencia: aula.data.slice(0,7), dataVencimento: aula.data, aulaIds: [aula.id]
      });
    }
    salvarEstado(); renderAll();
    mostrarToast(aluno && aluno.plano.tipo==="avulsa" ? "Aula concluída e cobrança gerada." : "Aula marcada como concluída.");
  };

  // ---------- cobrança ----------
  window.gerarCobranca = function(alunoId){
    var aluno = getAluno(alunoId);
    var hojeStr = fmtData(hoje);
    var inicio, labelPeriodo, chaveReferencia;

    var dataVencimento;
    if (aluno.plano.tipo === "semanal"){
      var d = new Date(hoje); d.setDate(hoje.getDate()-hoje.getDay());
      inicio = fmtData(d);
      labelPeriodo = "Semana de "+fmtDataBR(inicio)+" a "+fmtDataBR(hojeStr);
      chaveReferencia = "semana-"+inicio;
      dataVencimento = addDias(inicio, 5);
    } else {
      inicio = hojeStr.slice(0,7)+"-01";
      labelPeriodo = "Mensalidade de "+MESES[hoje.getMonth()]+" de "+hoje.getFullYear();
      chaveReferencia = "mes-"+hojeStr.slice(0,7);
      dataVencimento = inicio.slice(0,7)+"-10";
    }

    var jaGerado = state.pagamentos.some(function(p){
      return p.alunoId===alunoId && p.chaveReferencia===chaveReferencia;
    });
    if (jaGerado){ mostrarToast("Esse período já foi cobrado para esse aluno."); return; }

    var concluidasNoPeriodo = state.aulas.filter(function(c){
      return c.alunoId===alunoId && c.status==="concluida" && !c.faturada && c.data>=inicio && c.data<=hojeStr;
    });

    var valor, referencia, elegiveis;
    if (aluno.plano.cobranca === "por_aula"){
      elegiveis = concluidasNoPeriodo;
      if (elegiveis.length===0){ mostrarToast("Nenhuma aula concluída nesse período ainda."); return; }
      valor = elegiveis.length * aluno.plano.valorAula;
      referencia = labelPeriodo + " · " + elegiveis.length + (elegiveis.length===1 ? " aula dada" : " aulas dadas");
    } else {
      valor = aluno.plano.valorFixo;
      referencia = labelPeriodo;
      elegiveis = concluidasNoPeriodo;
    }

    state.pagamentos.push({
      id: uid(), alunoId: alunoId, valor: valor, referencia: referencia,
      status: "pendente", chaveReferencia: chaveReferencia, mesReferencia: inicio.slice(0,7),
      dataVencimento: dataVencimento, aulaIds: elegiveis.map(function(c){ return c.id; }),
      periodoLabel: labelPeriodo
    });
    elegiveis.forEach(function(c){ c.faturada = true; });

    salvarEstado();
    renderAll();
    abrirDetalheAluno(alunoId);
    mostrarToast("Cobrança gerada: "+fmtMoeda(valor));
  };

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

  function limparAulasRecorrenciaFutura(alunoId){
    var hojeStr = fmtData(hoje);
    var removidas = 0;
    state.aulas = state.aulas.filter(function(c){
      var remover = c.alunoId===alunoId && c.origem==="recorrencia" && c.status==="agendada" && c.data>=hojeStr;
      if (remover) removidas++;
      return !remover;
    });
    return removidas;
  }

  function gerarAulasAPartirDaRecorrencia(alunoId){
    var aluno = getAluno(alunoId);
    var horarios = aluno.recorrencia && aluno.recorrencia.horarios;
    if (!horarios || Object.keys(horarios).length===0) return 0;
    var criadas = 0;
    var cursor = new Date(hoje);
    for (var i=0; i<HORIZONTE_RECORRENCIA_SEMANAS*7; i++){
      var dStr = fmtData(cursor);
      var horarioDoDia = horarios[cursor.getDay()];
      if (horarioDoDia){
        var existeNoDia = state.aulas.some(function(c){ return c.alunoId===alunoId && c.data===dStr; });
        if (!existeNoDia){
          state.aulas.push({ id: uid(), alunoId: alunoId, data: dStr, hora: horarioDoDia, status: "agendada", faturada: false, origem: "recorrencia" });
          criadas++;
        }
      }
      cursor.setDate(cursor.getDate()+1);
    }
    return criadas;
  }

  window.gerarAulasRecorrentes = function(alunoId){
    var aluno = getAluno(alunoId);
    var horarios = aluno.recorrencia && aluno.recorrencia.horarios;
    if (!horarios || Object.keys(horarios).length===0){
      mostrarToast("Defina os dias e horários fixos desse aluno primeiro.");
      return;
    }
    var criadas = gerarAulasAPartirDaRecorrencia(alunoId);
    salvarEstado();
    renderAll();
    abrirDetalheAluno(alunoId);
    mostrarToast(criadas>0 ? criadas+" aula(s) geradas para as próximas "+HORIZONTE_RECORRENCIA_SEMANAS+" semanas." : "Nada novo: essas datas já estavam na agenda.");
  };

  window.marcarPago = function(id){
    state.pagamentos.forEach(function(p){
      if (p.id===id){ p.status="pago"; p.dataPagamento = fmtData(hoje); }
    });
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
      preview.innerHTML = '<img src="'+state.professor.logo+'" alt="Logo">';
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
    atualizarPreviewLogo();
  }

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
    var dados = {
      nome: document.getElementById("f-perfil-nome").value.trim(),
      telefone: document.getElementById("f-perfil-telefone").value.trim(),
      pix: document.getElementById("f-perfil-pix").value.trim()
    };
    (async function(){
      var r = await sb.from("profiles").upsert({ id: usuarioId, nome: dados.nome, telefone: dados.telefone, pix: dados.pix });
      if (r.error){ mostrarToast("Erro ao salvar os dados."); return; }
      state.professor.nome = dados.nome;
      state.professor.telefone = dados.telefone;
      state.professor.pix = dados.pix;
      mostrarToast("Dados salvos. Já valem para os próximos recibos.");
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
      ? '<img class="recibo-logo" src="'+prof.logo+'" alt="Logo">'
      : '<div class="recibo-logo-placeholder">'+iniciais(prof.nome||"PT")+'</div>';

    var aulasDoRecibo = (p.aulaIds && p.aulaIds.length)
      ? state.aulas.filter(function(c){ return p.aulaIds.indexOf(c.id)>-1; }).sort(function(a,b){ return a.data<b.data?-1:1; })
      : [];

    var itensHtml = "";
    if (aulasDoRecibo.length){
      var valorUnit = aluno.plano.cobranca === "por_aula" ? aluno.plano.valorAula : null;
      itensHtml += '<div class="recibo-itens-titulo">'+aulasDoRecibo.length+(aulasDoRecibo.length===1 ? ' aula dada no período' : ' aulas dadas no período')+'</div>';
      aulasDoRecibo.forEach(function(c){
        var d = new Date(c.data+"T00:00:00");
        var diaSemana = capitalizar(nomesDias()[d.getDay()]);
        itensHtml += '<div class="recibo-item"><span class="recibo-item-dia">'+diaSemana+' · '+fmtDataBR(c.data)+' · '+c.hora+'</span>'+(valorUnit!==null ? ('<span>'+fmtMoeda(valorUnit)+'</span>') : '')+'</div>';
      });
    } else if (p.periodoLabel){
      itensHtml += '<div class="recibo-itens-titulo">Referente a</div>';
      itensHtml += '<div class="recibo-item"><span>'+p.periodoLabel+'</span><span>'+fmtMoeda(p.valor)+'</span></div>';
    }

    var html = '<div class="recibo-doc">';
    html += '<div class="recibo-stamp '+(pago?'pago':'aberto')+'">'+(pago?'Pago':'Em aberto')+'</div>';
    html += '<div class="recibo-header">'+logoHtml+
      '<div><div class="recibo-prof-nome">'+(prof.nome||"Personal Trainer")+'</div>'+
      '<div class="recibo-prof-meta">'+[prof.telefone ? ("Tel: "+prof.telefone) : "", prof.pix ? ("Pix: "+prof.pix) : ""].filter(Boolean).join(" · ")+'</div></div></div>';
    html += '<div class="recibo-titulo">'+(pago ? "Recibo de pagamento" : "Cobrança")+'</div>';
    html += '<div class="recibo-linha"><span>Aluno</span><span>'+aluno.nome+'</span></div>';
    html += '<div class="recibo-linha"><span>Referente a</span><span>'+p.referencia+'</span></div>';
    html += pago
      ? '<div class="recibo-linha"><span>Data do pagamento</span><span>'+fmtDataBR(p.dataPagamento)+'</span></div>'
      : (p.dataVencimento ? '<div class="recibo-linha"><span>Vencimento</span><span>'+fmtDataBR(p.dataVencimento)+'</span></div>' : '');
    html += itensHtml;
    html += '<div class="recibo-total"><span>'+(pago?"Total pago":"Total a pagar")+'</span><span>'+fmtMoeda(p.valor)+'</span></div>';
    html += '<div class="recibo-footer">Documento gerado pelo Trainer Flow em '+fmtDataBR(fmtData(hoje))+'.</div>';
    html += '</div>';

    document.getElementById("recibo-conteudo").innerHTML = html;
    abrirModal("modal-recibo");
  };

  window.baixarReciboPDF = function(){
    var el = document.querySelector("#recibo-conteudo .recibo-doc");
    if (!el || typeof html2pdf === "undefined"){
      mostrarToast("Não foi possível gerar o PDF agora. Tente novamente.");
      return;
    }
    var p = null;
    state.pagamentos.forEach(function(x){ if (x.id===reciboAtualId) p = x; });
    var aluno = p ? getAluno(p.alunoId) : null;
    var nomeArquivo = "recibo-"+(aluno ? aluno.nome.replace(/\s+/g,"-").toLowerCase() : "aluno")+(p && p.dataPagamento ? ("-"+p.dataPagamento) : "")+".pdf";
    html2pdf().set({
      margin: 8,
      filename: nomeArquivo,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#f4f4f6" },
      jsPDF: { unit: "mm", format: "a5", orientation: "portrait" }
    }).from(el).save();
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
    html += '<div class="avatar">'+iniciais(aluno.nome)+'</div>';
    html += '<div><div class="card-title" style="font-size:16px;">'+aluno.nome+'</div>';
    html += '<div class="card-sub">'+calcIdade(aluno.nascimento)+' anos · '+aluno.sexo+'</div></div>';
    html += '</div>';
    html += '<button class="btn sm" onclick="abrirModalAluno(\''+aluno.id+'\')">'+ICONS.edit+' Editar</button>';
    html += '</div>';

    html += '<div class="stat-row">';
    html += '<div class="stat-card"><div class="stat-value sm">'+aulasConcluidas+'</div><div class="stat-label">Aulas concluídas</div></div>';
    html += '<div class="stat-card ok"><div class="stat-value sm">'+fmtMoeda(totalPago)+'</div><div class="stat-label">Total pago</div></div>';
    html += '<div class="stat-card warn"><div class="stat-value sm">'+fmtMoeda(totalAberto)+'</div><div class="stat-label">Em aberto</div></div>';
    html += '</div>';

    html += '<div class="card" style="margin-top:8px;">';
    html += '<div class="card-row"><span class="card-sub">Telefone</span><span>'+aluno.telefone+'</span></div>';
    html += '<div class="card-row" style="margin-top:6px;"><span class="card-sub">Endereço</span><span style="text-align:right;max-width:60%;">'+aluno.endereco+'</span></div>';
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
    if (aluno.plano.tipo !== "avulsa"){
      html += '<button class="btn sm primary" onclick="gerarCobranca(\''+aluno.id+'\')">'+ICONS.cash+' Gerar cobrança do período</button>';
    }
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
        html += '<div class="card"><div class="card-row"><div class="card-main"><div class="card-title">'+fmtMoeda(p.valor)+'</div><div class="card-sub">'+p.referencia+'</div></div>';
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
  function renderResumo(){
    var hojeStr = fmtData(hoje);
    var aulasHoje = state.aulas.filter(function(c){return c.data===hojeStr;})
      .sort(function(a,b){ return a.hora < b.hora ? -1 : 1; });

    var box = document.getElementById("resumo-hoje");
    var linkRotaHoje = rotaDoDiaLink(hojeStr);
    var rotaHtml = linkRotaHoje ? '<a class="btn sm block" style="margin-bottom:10px;" href="'+linkRotaHoje+'" target="_blank" rel="noopener">'+ICONS.route+' Ver rota do dia</a>' : '';
    if (aulasHoje.length===0){
      box.innerHTML = '<div class="empty-state"><div class="display">Nenhuma aula hoje</div>Aproveite para planejar a semana.</div>';
    } else {
      box.innerHTML = rotaHtml + aulasHoje.map(function(c){
        var aluno = getAluno(c.alunoId);
        return cardAula(c, aluno);
      }).join("");
    }

    var mesAtual = hojeStr.slice(0,7);
    var aReceber = state.pagamentos.filter(function(p){return p.status==="pendente";})
      .reduce(function(s,p){return s+p.valor;},0);
    var recebidoMes = state.pagamentos.filter(function(p){return p.status==="pago" && p.dataPagamento && p.dataPagamento.slice(0,7)===mesAtual;})
      .reduce(function(s,p){return s+p.valor;},0);

    var inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate()-hoje.getDay());
    var fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate()+6);
    var aulasSemana = state.aulas.filter(function(c){
      var d = new Date(c.data+"T00:00:00");
      return d>=inicioSemana && d<=fimSemana;
    }).length;

    document.getElementById("stat-a-receber").textContent = fmtMoeda(aReceber);
    document.getElementById("stat-recebido").textContent = fmtMoeda(recebidoMes);
    document.getElementById("stat-aulas-semana").textContent = aulasSemana;

    var proximas = state.aulas.filter(function(c){return c.data>hojeStr && c.status!=="concluida";})
      .sort(function(a,b){ return (a.data+a.hora) < (b.data+b.hora) ? -1 : 1; })
      .slice(0,4);
    var box2 = document.getElementById("resumo-proximas");
    box2.innerHTML = proximas.length ? proximas.map(function(c){
      var aluno = getAluno(c.alunoId);
      return '<div class="card"><div class="card-row"><div class="card-main"><div class="card-title">'+aluno.nome+'</div><div class="card-sub">'+fmtDataBR(c.data)+' · '+c.hora+'</div></div>'+statusBadge(c.status)+'</div></div>';
    }).join("") : '<div class="empty-state"><div class="display">Agenda livre</div></div>';
  }

  function cardAula(c, aluno, mostrarData){
    var titulo = (mostrarData ? fmtDataBR(c.data)+' · ' : '') + c.hora + ' · ' + aluno.nome;
    var html = '<div class="card">';
    html += '<div class="card-row"><div class="card-main"><div class="card-title">'+titulo+'</div><div class="card-sub">'+aluno.endereco+'</div></div>'+statusBadge(c.status)+'</div>';
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
      html += '<button class="btn sm primary" onclick="confirmarConcluir(\''+c.id+'\')">Concluir</button>';
      html += '<button class="btn sm" onclick="abrirModalRemarcar(\''+c.id+'\')">Remarcar</button>';
      html += '<button class="btn sm" onclick="confirmarCancelar(\''+c.id+'\')">Cancelar</button>';
    } else if (c.status==="cancelada"){
      html += '<button class="btn sm" onclick="abrirModalRemarcar(\''+c.id+'\')">Remarcar</button>';
    }
    html += '</div></div>';
    return html;
  }

  function renderAlunos(){
    var box = document.getElementById("alunos-lista");
    var termo = normalizar(alunoBuscaTermo);
    var ativos = state.alunos.filter(function(a){
      return a.ativo && (!termo || normalizar(a.nome).indexOf(termo)>=0);
    });
    box.innerHTML = ativos.length ? ativos.map(function(a){
      var planoLabel = {mensal:"Mensal", semanal:"Semanal", avulsa:"Por aula"}[a.plano.tipo];
      return '<div class="card" onclick="abrirDetalheAluno(\''+a.id+'\')" style="cursor:pointer;">'+
        '<div class="card-row"><div class="card-main" style="display:flex;align-items:center;gap:10px;">'+
        '<div class="avatar" style="width:34px;height:34px;font-size:12.5px;">'+iniciais(a.nome)+'</div>'+
        '<div><div class="card-title">'+a.nome+'</div><div class="card-sub">'+calcIdade(a.nascimento)+' anos · '+a.telefone+'</div></div>'+
        '</div><span class="badge accent">'+planoLabel+'</span></div></div>';
    }).join("") : '<div class="empty-state"><div class="display">Nenhum aluno encontrado</div></div>';
  }

  function renderAgenda(){
    var temBusca = normalizar(agendaBusca).length > 0;
    document.getElementById("agenda-seg-toggle").hidden = temBusca;
    document.getElementById("agenda-day-nav").hidden = temBusca;
    var picker = document.getElementById("agenda-datepicker");
    if (picker) picker.value = fmtData(agendaData);
    if (temBusca){ renderAgendaBusca(agendaBusca); return; }
    if (agendaModo === "semana") renderAgendaSemana(); else renderAgendaDia();
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

  function renderAgendaDia(){
    document.getElementById("agenda-periodo-label").textContent = capitalizar(diaSemanaLabel(fmtData(agendaData))) + " · " + fmtDataBR(fmtData(agendaData));
    var dataStr = fmtData(agendaData);
    var aulasDoDia = state.aulas.filter(function(c){return c.data===dataStr;})
      .sort(function(a,b){ return a.hora<b.hora?-1:1; });
    var box = document.getElementById("agenda-lista");
    var linkRota = rotaDoDiaLink(dataStr);
    var rotaHtml = linkRota ? '<a class="btn sm block" style="margin-bottom:10px;" href="'+linkRota+'" target="_blank" rel="noopener">'+ICONS.route+' Ver rota do dia</a>' : '';
    box.innerHTML = rotaHtml + (aulasDoDia.length ? aulasDoDia.map(function(c){
      return cardAula(c, getAluno(c.alunoId));
    }).join("") : '<div class="empty-state"><div class="display">Sem aulas nesse dia</div></div>');
  }

  function renderAgendaSemana(){
    var inicio = new Date(agendaData); inicio.setDate(agendaData.getDate()-agendaData.getDay());
    var fim = new Date(inicio); fim.setDate(inicio.getDate()+6);
    document.getElementById("agenda-periodo-label").textContent = fmtDataBR(fmtData(inicio)) + " – " + fmtDataBR(fmtData(fim));

    var hojeStr = fmtData(hoje);
    var html = "";
    for (var i=0;i<7;i++){
      var d = new Date(inicio); d.setDate(inicio.getDate()+i);
      var dStr = fmtData(d);
      var aulasDia = state.aulas.filter(function(c){return c.data===dStr;})
        .sort(function(a,b){ return a.hora<b.hora?-1:1; });
      var expandido = agendaDiasExpandido.hasOwnProperty(dStr) ? agendaDiasExpandido[dStr] : (dStr === hojeStr);
      var contagem = aulasDia.length ? (aulasDia.length + (aulasDia.length===1 ? " aula" : " aulas")) : "livre";
      html += '<div class="week-day-header" onclick="toggleDiaSemana(\''+dStr+'\')">'+
        '<span class="week-day-name">'+capitalizar(diaSemanaLabel(dStr))+' · '+fmtDataBR(dStr)+'</span>'+
        '<span class="week-day-meta">'+contagem+' <span style="display:inline-flex;transform:rotate('+(expandido?180:0)+'deg);">'+ICONS.chevD+'</span></span>'+
        '</div>';
      if (expandido){
        html += aulasDia.length ? aulasDia.map(function(c){ return cardAula(c, getAluno(c.alunoId)); }).join("")
          : '<div class="empty-state sm">Sem aulas</div>';
      }
    }
    document.getElementById("agenda-lista").innerHTML = html;
  }

  window.toggleDiaSemana = function(dStr){
    var hojeStr = fmtData(hoje);
    var atual = agendaDiasExpandido.hasOwnProperty(dStr) ? agendaDiasExpandido[dStr] : (dStr === hojeStr);
    agendaDiasExpandido[dStr] = !atual;
    renderAgendaSemana();
  };

  function mesLabel(mesStr){
    var partes = mesStr.split("-");
    return MESES_ABREV[Number(partes[1])-1] + "/" + partes[0];
  }

  function calcularPrevistoMes(mesStr){
    var total = 0;
    state.alunos.filter(function(a){ return a.ativo; }).forEach(function(aluno){
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

  function calcularRecebidoMes(mesStr){
    return state.pagamentos.filter(function(p){
      return p.status==="pago" && p.dataPagamento && p.dataPagamento.slice(0,7)===mesStr;
    }).reduce(function(s,p){ return s+p.valor; }, 0);
  }

  function calcularPendenteMes(mesStr){
    return state.pagamentos.filter(function(p){
      return p.status==="pendente" && p.mesReferencia===mesStr;
    }).reduce(function(s,p){ return s+p.valor; }, 0);
  }

  function renderVisaoMensal(){
    var mesAtualStr = fmtData(hoje).slice(0,7);
    var meses = [];
    for (var i=-2; i<=2; i++){
      meses.push(fmtData(new Date(hoje.getFullYear(), hoje.getMonth()+i, 1)).slice(0,7));
    }
    var linhas = [
      {label:"Previsto", calc:calcularPrevistoMes, cor:""},
      {label:"Recebido", calc:calcularRecebidoMes, cor:"ok"},
      {label:"A receber", calc:calcularPendenteMes, cor:"warn"}
    ];
    var html = '<div class="tabela-mensal-wrap"><table class="tabela-mensal"><thead><tr><th></th>';
    meses.forEach(function(m){
      html += '<th class="'+(m===mesAtualStr?'atual':'')+'">'+mesLabel(m)+'</th>';
    });
    html += '</tr></thead><tbody>';
    linhas.forEach(function(linha){
      html += '<tr><td class="tabela-mensal-label">'+linha.label+'</td>';
      meses.forEach(function(m){
        html += '<td class="'+(m===mesAtualStr?'atual ':'')+linha.cor+'">'+fmtMoeda(linha.calc(m))+'</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    document.getElementById("fin-visao-mensal").innerHTML = html;
  }

  var financeiroFiltro = "todos";
  window.mudarFiltroFinanceiro = function(f){
    financeiroFiltro = f;
    document.querySelectorAll("#fin-filtro-toggle .seg-btn").forEach(function(b){ b.classList.toggle("active", b.dataset.filtro===f); });
    renderFinanceiro();
  };

  function ehVencido(p){
    return p.status==="pendente" && p.dataVencimento && p.dataVencimento < fmtData(hoje);
  }

  function renderFinanceiro(){
    var hojeStr = fmtData(hoje);
    var todosPendentes = state.pagamentos.filter(function(p){return p.status==="pendente";});
    var vencidos = todosPendentes.filter(ehVencido);
    var pendentesExibidos = financeiroFiltro==="vencidos" ? vencidos : todosPendentes;
    pendentesExibidos = pendentesExibidos.slice().sort(function(a,b){
      return (a.dataVencimento||"") < (b.dataVencimento||"") ? -1 : 1;
    });
    var pagos = state.pagamentos.filter(function(p){return p.status==="pago";})
      .sort(function(a,b){ return a.dataPagamento < b.dataPagamento ? 1 : -1; });

    var mesAtual = hojeStr.slice(0,7);
    var totalReceber = todosPendentes.reduce(function(s,p){return s+p.valor;},0);
    var totalVencidos = vencidos.reduce(function(s,p){return s+p.valor;},0);
    var totalMes = pagos.filter(function(p){return p.dataPagamento.slice(0,7)===mesAtual;}).reduce(function(s,p){return s+p.valor;},0);
    document.getElementById("fin-total-receber").textContent = fmtMoeda(totalReceber);
    document.getElementById("fin-total-vencidos").textContent = fmtMoeda(totalVencidos);
    document.getElementById("fin-total-mes").textContent = fmtMoeda(totalMes);

    document.getElementById("fin-pendentes").innerHTML = pendentesExibidos.length ? pendentesExibidos.map(function(p){
      var aluno = getAluno(p.alunoId);
      var vencido = ehVencido(p);
      var subLabel = p.referencia + ' · ' + fmtMoeda(p.valor) + (p.dataVencimento ? (' · vence ' + fmtDataBR(p.dataVencimento)) : '');
      return '<div class="card"><div class="card-row"><div class="card-main"><div class="card-title">'+aluno.nome+'</div><div class="card-sub">'+subLabel+'</div></div>'+
        (vencido ? '<span class="badge danger">vencido</span>' : '<span class="badge warn">pendente</span>')+'</div>'+
        '<div class="action-row">'+
        '<button class="btn sm" onclick="abrirRecibo(\''+p.id+'\')">'+ICONS.recibo+' Recibo</button>'+
        '<button class="btn sm" onclick="abrirCobranca(\''+p.id+'\')">'+ICONS.whats+' Cobrar</button>'+
        '<button class="btn sm primary" onclick="marcarPago(\''+p.id+'\')">'+ICONS.check+' Marcar pago</button>'+
        '</div></div>';
    }).join("") : '<div class="empty-state"><div class="display">'+(financeiroFiltro==="vencidos" ? "Nada vencido" : "Nada em aberto")+'</div></div>';

    document.getElementById("fin-pagos").innerHTML = pagos.slice(0,6).map(function(p){
      var aluno = getAluno(p.alunoId);
      return '<div class="card"><div class="card-row"><div class="card-main"><div class="card-title">'+aluno.nome+'</div><div class="card-sub">'+p.referencia+' · '+fmtDataBR(p.dataPagamento)+'</div></div><span class="badge ok">'+fmtMoeda(p.valor)+'</span></div>'+
        '<div class="action-row"><button class="btn sm" onclick="abrirRecibo(\''+p.id+'\')">'+ICONS.recibo+' Ver recibo</button></div></div>';
    }).join("") || '<div class="empty-state"><div class="display">Sem recebimentos ainda</div></div>';

    renderVisaoMensal();
  }

  function renderAll(){
    renderResumo();
    renderAlunos();
    renderAgenda();
    renderFinanceiro();
    renderPerfil();
  }

  iniciar();
})();
