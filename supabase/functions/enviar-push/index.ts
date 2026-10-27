// Edge Function: enviar-push
// NÃO IMPLANTADA ainda — precisa ser deployada manualmente
// (supabase functions deploy enviar-push) e precisa dos segredos abaixo
// configurados no painel (Supabase > Edge Functions > Secrets):
//
//   SUPABASE_URL               (automático no runtime)
//   SUPABASE_SERVICE_ROLE_KEY  (automático no runtime)
//   VAPID_PUBLIC_KEY           — chave pública VAPID (a mesma que fica no portal)
//   VAPID_PRIVATE_KEY          — chave privada VAPID (NUNCA vai para o navegador)
//   VAPID_SUBJECT              — ex.: mailto:contato@lt360.com.br
//
// Etapa 1: envia o push de "solicitação respondida". A estrutura já prevê os
// tipos de tempo (aula/pagamento) da Etapa 2.
//
// Entrada (POST, autenticado com JWT do personal ou service role):
//   { "tipo": "solicitacao", "solicitacao_id": "<uuid>" }

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Envia um payload para todas as assinaturas de um aluno; limpa as expiradas.
async function enviarParaAluno(alunoId: string, payload: Record<string, unknown>) {
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("aluno_id", alunoId);
  if (error) throw error;
  if (!subs || !subs.length) return { enviados: 0 };

  let enviados = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      enviados++;
    } catch (err) {
      const code = (err && (err as { statusCode?: number }).statusCode) || 0;
      // 404/410 = assinatura expirada/cancelada -> remove
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        console.error("push falhou:", code, (err as Error)?.message);
      }
    }
  }
  return { enviados };
}

function payloadSolicitacao(status: string) {
  if (status === "aprovada") {
    return { title: "Solicitação aprovada ✅", body: "Seu personal aprovou sua solicitação.", url: "/" };
  }
  if (status === "negada") {
    return { title: "Solicitação respondida", body: "Seu personal respondeu sua solicitação.", url: "/" };
  }
  if (status === "contraproposta") {
    return { title: "Novo horário sugerido", body: "Seu personal sugeriu um horário. Toque para responder.", url: "/" };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, erro: "Método não permitido." }, 405);

  let body: { tipo?: string; solicitacao_id?: string };
  try { body = await req.json(); } catch { return json({ ok: false, erro: "JSON inválido." }, 400); }

  try {
    if (body.tipo === "solicitacao" && body.solicitacao_id) {
      const { data: solic, error } = await admin
        .from("solicitacoes")
        .select("aluno_id, status")
        .eq("id", body.solicitacao_id)
        .maybeSingle();
      if (error) throw error;
      if (!solic) return json({ ok: false, erro: "Solicitação não encontrada." }, 404);

      const payload = payloadSolicitacao(solic.status);
      if (!payload) return json({ ok: true, enviados: 0, nota: "status sem notificação" });

      const r = await enviarParaAluno(solic.aluno_id, payload);
      return json({ ok: true, ...r });
    }
    return json({ ok: false, erro: "tipo inválido." }, 400);
  } catch (err) {
    console.error(err);
    return json({ ok: false, erro: (err as Error)?.message || "erro" }, 500);
  }
});
