// Cloudflare Pages Function: POST /sendEmail
// Endpoint: http(s)://<host>/sendEmail
//
// Note: Email-send counts are recorded client-side via logUsage() →
// app_usage_logs (see src/services/usageService.js + ZipCodePage's
// logDeliveryAction). The old denormalized increment_email_count RPC was
// removed because the function was never created in Supabase and the
// counts are derived from app_usage_logs by the Reports page.

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

  console.log("📩 Incoming email request...");
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
