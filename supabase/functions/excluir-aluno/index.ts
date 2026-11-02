// Edge Function: excluir-aluno
// Deploy manual (supabase functions deploy excluir-aluno) ou via painel/MCP.
// Usa apenas segredos que o runtime do Supabase já injeta automaticamente:
//
//   SUPABASE_URL              (automático no runtime)
//   SUPABASE_ANON_KEY         (automático no runtime)
//   SUPABASE_SERVICE_ROLE_KEY (automático no runtime)
//
// O que esta função faz:
//   1) Recebe { alunoId } via POST, autenticada com o JWT do PERSONAL que fez
//      a chamada (header Authorization: Bearer <access_token>).
//   2) Valida, usando um client com ESSE JWT (nunca a service role pra isso),
//      que o aluno existe e pertence a esse personal — a RLS garante: o select
//      só retorna linha se professor_id = auth.uid().
//   3) Apaga a linha do aluno usando o CLIENT DO PERSONAL (o JWT recebido),
//      não a service role. Isso é importante: a RLS já permite o personal
//      excluir o próprio aluno, a cascata do banco derruba todo o histórico
//      (aulas, pagamentos, avaliações físicas + itens + histórico,
//      push_subscriptions, solicitações) de qualquer forma, e — ao rodar com
//      o JWT do personal — auth.uid() fica preenchido dentro dos triggers de
//      auditoria que disparam na cascata (ex.: histórico de item de avaliação
//      física, que grava alterado_por = auth.uid() com NOT NULL). Com a
//      service role, auth.uid() seria null e a exclusão abortaria.
//   4) Só então usa a service role (que nunca chega ao navegador) para apagar
//      o usuário de auth.users (login/acesso ao portal), se o aluno já tinha
//      acesso vinculado (auth_user_id).
//
// Ordem importa: a linha de `alunos` referencia auth.users via auth_user_id,
// então apagamos o aluno PRIMEIRO (removendo essa referência e todo o
// histórico por cascata) e só depois o usuário de auth.users.
//
// Por que não dá pra fazer tudo no frontend: admin.deleteUser exige a service
// role key, que nunca pode ser exposta no navegador (daria acesso total ao
// banco, sem RLS, pra qualquer um que abrisse o DevTools).

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// O app do personal roda em outra origem, então o navegador faz chamada
// cross-origin e exige CORS. A segurança não depende da origem — depende do
// JWT do personal (validado abaixo) e da RLS — por isso "*" aqui é aceitável.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Não autenticado." }, 401);
  }

  let body: { alunoId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Corpo inválido." }, 400);
  }
  const alunoId = body.alunoId;
  if (!alunoId) {
    return jsonResponse({ error: "alunoId é obrigatório." }, 400);
  }

  // Client "como o personal": respeita RLS, então só enxerga o aluno se ele
  // realmente for dono (professor_id = auth.uid() do token recebido).
  const comoPersonal = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: userData, error: userErr } = await comoPersonal.auth.getUser();
  if (userErr || !userData.user) {
    return jsonResponse({ error: "Sessão inválida." }, 401);
  }

  const callerId = userData.user.id;

  // Posse EXPLÍCITA, não só a visibilidade do SELECT: a tabela `alunos` tem
  // uma policy que deixa o próprio aluno ver seu cadastro (auth.uid() =
  // auth_user_id). Sem o filtro professor_id abaixo, um ALUNO logado poderia
  // chamar esta função com o próprio id, passar nesse SELECT e disparar um
  // delete (service role) de registros que são do PERSONAL. Exigir
  // professor_id = quem chamou garante que só o personal dono exclui.
  const { data: aluno, error: alunoErr } = await comoPersonal
    .from("alunos")
    .select("id, nome, auth_user_id, professor_id")
    .eq("id", alunoId)
    .eq("professor_id", callerId)
    .maybeSingle();

  if (alunoErr) {
    return jsonResponse({ error: "Erro ao buscar o aluno." }, 500);
  }
  if (!aluno) {
    return jsonResponse({ error: "Aluno não encontrado." }, 404);
  }

  // Daqui pra frente, service role — nunca chega ao navegador.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Decide se PODE remover o login — ANTES de apagar qualquer coisa. Nunca
  // confiar cegamente em alunos.auth_user_id: essa coluna é gravável pelo
  // personal (a policy ALL só checa professor_id), então um personal poderia
  // apontá-la para o uid de QUALQUER usuário (outro personal, etc.) e usar
  // esta função pra apagar a conta dele. Só removemos o login se o auth user
  // de fato for o aluno deste cadastro — o que o fluxo de convite
  // (convidar-aluno) grava no user_metadata, server-side: role='aluno' e
  // aluno_id = id deste aluno. Se não bater, apagamos o cadastro/histórico
  // (que são mesmo deste personal), mas NÃO tocamos no auth user.
  let podeRemoverLogin = false;
  if (aluno.auth_user_id) {
    const { data: alvo, error: getErr } = await admin.auth.admin.getUserById(aluno.auth_user_id);
    if (!getErr && alvo?.user) {
      const meta = (alvo.user.user_metadata || {}) as Record<string, unknown>;
      podeRemoverLogin = meta.role === "aluno" && meta.aluno_id === aluno.id;
    }
  }

  // 1) Apaga a linha do aluno COM O CLIENT DO PERSONAL (não a service role),
  //    para que auth.uid() fique preenchido nos triggers de auditoria que
  //    disparam durante a cascata (senão o INSERT em
  //    avaliacoes_fisicas_historico, com alterado_por NOT NULL, aborta tudo).
  //    A RLS restringe a exclusão ao aluno do próprio personal; o filtro
  //    professor_id abaixo é defesa extra. As FKs ON DELETE CASCADE derrubam,
  //    na mesma transação, aulas, pagamentos, avaliações físicas (+ itens +
  //    histórico), push_subscriptions e solicitações desse aluno — a cascata
  //    não depende de RLS/grants nas tabelas filhas.
  const { error: delErr } = await comoPersonal
    .from("alunos")
    .delete()
    .eq("id", aluno.id)
    .eq("professor_id", callerId);
  if (delErr) {
    return jsonResponse({ error: "Não foi possível excluir o aluno: " + delErr.message }, 500);
  }

  // 2) Remove o login/acesso ao portal, se verificado acima. Já sem a linha de
  //    `alunos` referenciando este usuário, a remoção fica livre. Se falhar
  //    aqui, o cadastro e o histórico já foram apagados: reportamos.
  if (podeRemoverLogin) {
    const { error: authErr } = await admin.auth.admin.deleteUser(aluno.auth_user_id!);
    if (authErr) {
      return jsonResponse({
        ok: true,
        loginRemovido: false,
        aviso: "O cadastro e o histórico foram apagados, mas não consegui remover o login do aluno. Avise o suporte: auth_user_id=" + aluno.auth_user_id
      });
    }
  }

  return jsonResponse({ ok: true, loginRemovido: podeRemoverLogin });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
