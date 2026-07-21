// Cloudflare Pages Function: POST /sendEmail
// Endpoint: http(s)://<host>/sendEmail
//
// Note: Email-send counts are recorded client-side via logUsage() →
// app_usage_logs (see src/services/usageService.js + ZipCodePage's
// logDeliveryAction). The old denormalized increment_email_count RPC was
// removed because the function was never created in Supabase and the
// counts are derived from app_usage_logs by the Reports page.

import { requireSession } from "./_lib/auth.js";

// June 2026 trial: temporarily opened Send Email to guests (unauthenticated) to
// gauge usage. Closed again 2026-07-01 — email is registered-orgs-only. Must be
// kept in sync with the UI lever (GUEST_EMAIL_PDF_OPEN in src/layout/NavBar1.js)
// and the matching flag in functions/createPdf.js. (Text/SMS stays open to
// guests, but that's client-side only and has no server gate here.)
// WARNING: while true, this endpoint is callable by anyone on the internet,
// not just app guests — it is backed by a paid API (Resend).
const GUEST_ACTIONS_OPEN = true;

export async function onRequest({ request, env }) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Gate: only signed-in registered orgs can send. The React UI already
  // hides Send Email from guests; this stops a direct caller from bypassing
  // the UI gate by hitting the endpoint. During the GUEST_ACTIONS_OPEN trial
  // the gate is skipped so guests (who have no session cookie) can send.
  let senderOrg = "Guest";
  if (!GUEST_ACTIONS_OPEN) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    senderOrg = auth.session.org;
  }

  console.log("📩 Incoming email request from:", senderOrg);
  console.log(
    "🔐 Using API Key:",
    env.RESEND_API_KEY ? "✅ Set" : "❌ Missing"
  );

  try {
    const { recipient, subject, htmlBody, cc, organization } =
      await request.json();

    const payload = {
      from: '"Community Resources Guide" <info@crghouston.org>',
      to: recipient,
      subject,
      html: htmlBody,
      ...(cc && { cc }),
    };

    console.log("📦 Payload:", JSON.stringify(payload, null, 2));

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Resend error:", data);
      return new Response(
        JSON.stringify({
          success: false,
          message: data.message || "Send failed",
        }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[sendEmail] Email sent successfully. Organization: "${organization}"`
    );

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("🚨 Function error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
