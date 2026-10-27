// Edge Function: enviar-push
// NÃO IMPLANTADA automaticamente — deploy manual (dashboard ou
// "supabase functions deploy enviar-push"). Secrets necessários:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
//   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY vêm automáticos.
//
// Tipos aceitos (POST JSON):
//   { tipo:"solicitacao", solicitacao_id }            -> avisa o ALUNO (resposta)
//   { tipo:"solicitacao_aberta", solicitacao_id }     -> avisa o PERSONAL
//   { tipo:"pagamento_informado", pagamento_id }      -> avisa o PERSONAL
//   { tipo:"contraproposta_respondida", solicitacao_id, aceitar } -> avisa o PERSONAL
//   { tipo:"pagamento_confirmado", pagamento_id }      -> avisa o ALUNO
//   { tipo:"aula_remarcada", aula_id }                 -> avisa o ALUNO
//   { tipo:"aula_cancelada", aula_id }                 -> avisa o ALUNO

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@lt360.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function fmtData(iso: string) { const p = (iso || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}` : iso; }
function hhmm(h: string) { return (h || "").slice(0, 5); }

async function enviar(col: "aluno_id" | "professor_id", ownerId: string, payload: Record<string, unknown>) {
  const { data: subs, error } = await admin
    .from("push_subscriptions").select("endpoint, p256dh, auth").eq(col, ownerId);
  if (error) throw error;
  if (!subs || !subs.length) return { enviados: 0 };
  let enviados = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      enviados++;
    } catch (err) {
      const code = (err && (err as { statusCode?: number }).statusCode) || 0;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      else console.error("push falhou:", code, (err as Error)?.message);
    }
  }
  return { enviados };
}

async function nomeAluno(id: string): Promise<string> {
  const { data } = await admin.from("alunos").select("nome").eq("id", id).maybeSingle();
  return (data?.nome as string) || "Seu aluno";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, erro: "Método não permitido." }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ ok: false, erro: "JSON inválido." }, 400); }
  const tipo = b.tipo as string;

  try {
    // ---- Avisos para o ALUNO -------------------------------------------------
    if (tipo === "solicitacao" || tipo === "pagamento_confirmado" || tipo === "aula_remarcada" || tipo === "aula_cancelada") {
      let alunoId = "", payload: Record<string, unknown> | null = null;

      if (tipo === "solicitacao") {
        const { data: s } = await admin.from("solicitacoes").select("aluno_id, status").eq("id", b.solicitacao_id as string).maybeSingle();
        if (!s) return json({ ok: false, erro: "Solicitação não encontrada." }, 404);
        alunoId = s.aluno_id;
        if (s.status === "aprovada") payload = { title: "Solicitação aprovada ✅", body: "Seu personal aprovou sua solicitação.", url: "/" };
        else if (s.status === "negada") payload = { title: "Solicitação respondida", body: "Seu personal respondeu sua solicitação.", url: "/" };
        else if (s.status === "contraproposta") payload = { title: "Novo horário sugerido", body: "Seu personal sugeriu um horário. Toque para responder.", url: "/" };
      } else if (tipo === "pagamento_confirmado") {
        const { data: p } = await admin.from("pagamentos").select("aluno_id, periodo_label, referencia").eq("id", b.pagamento_id as string).maybeSingle();
        if (!p) return json({ ok: false, erro: "Pagamento não encontrado." }, 404);
        alunoId = p.aluno_id;
        payload = { title: "Pagamento confirmado ✅", body: `Seu pagamento de ${p.periodo_label || p.referencia || "cobrança"} foi confirmado.`, url: "/" };
      } else if (tipo === "aula_remarcada" || tipo === "aula_cancelada") {
        const { data: a } = await admin.from("aulas").select("aluno_id, data, hora").eq("id", b.aula_id as string).maybeSingle();
        if (!a) return json({ ok: false, erro: "Aula não encontrada." }, 404);
        alunoId = a.aluno_id;
        payload = tipo === "aula_remarcada"
          ? { title: "Aula remarcada", body: `Sua aula foi remarcada para ${fmtData(a.data)} às ${hhmm(a.hora)}.`, url: "/" }
          : { title: "Aula cancelada", body: `Sua aula de ${fmtData(a.data)} às ${hhmm(a.hora)} foi cancelada.`, url: "/" };
      }

      if (!payload) return json({ ok: true, enviados: 0, nota: "sem notificação para este estado" });
      return json({ ok: true, ...(await enviar("aluno_id", alunoId, payload)) });
    }

    // ---- Avisos para o PERSONAL ---------------------------------------------
    if (tipo === "solicitacao_aberta" || tipo === "contraproposta_respondida") {
      const { data: s } = await admin.from("solicitacoes").select("professor_id, aluno_id, tipo").eq("id", b.solicitacao_id as string).maybeSingle();
      if (!s) return json({ ok: false, erro: "Solicitação não encontrada." }, 404);
      const nome = await nomeAluno(s.aluno_id);
      let payload: Record<string, unknown>;
      if (tipo === "solicitacao_aberta") {
        const oque = s.tipo === "remarcar" ? "remarcação" : "cancelamento";
        payload = { title: "Nova solicitação", body: `${nome} abriu uma solicitação de ${oque}.`, url: "/" };
      } else {
        payload = b.aceitar
          ? { title: "Horário aceito ✅", body: `${nome} aceitou o horário que você sugeriu.`, url: "/" }
          : { title: "Horário recusado", body: `${nome} recusou o horário que você sugeriu.`, url: "/" };
      }
      return json({ ok: true, ...(await enviar("professor_id", s.professor_id, payload)) });
    }

    if (tipo === "pagamento_informado") {
      const { data: p } = await admin.from("pagamentos").select("professor_id, aluno_id, periodo_label, referencia").eq("id", b.pagamento_id as string).maybeSingle();
      if (!p) return json({ ok: false, erro: "Pagamento não encontrado." }, 404);
      const nome = await nomeAluno(p.aluno_id);
      const payload = { title: "Pagamento sinalizado", body: `${nome} sinalizou o pagamento de ${p.periodo_label || p.referencia || "uma cobrança"}.`, url: "/" };
      return json({ ok: true, ...(await enviar("professor_id", p.professor_id, payload)) });
    }

    return json({ ok: false, erro: "tipo inválido." }, 400);
  } catch (err) {
    console.error(err);
    return json({ ok: false, erro: (err as Error)?.message || "erro" }, 500);
  }
});
