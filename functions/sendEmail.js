// Cloudflare Pages Function: POST /sendEmail
// Endpoint: http(s)://<host>/sendEmail

import { createClient } from "@supabase/supabase-js";

// Helper function to increment email count in Supabase
async function incrementEmailCount(env, organization) {
  try {
    console.log(
      `[incrementEmailCount] Starting for organization: "${organization}"`
    );

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[incrementEmailCount] Missing Supabase credentials");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the RPC function to increment email count
    console.log(
      `[incrementEmailCount] Calling RPC with org_name: "${organization}"`
    );

    let response;
    try {
      response = await supabase.rpc("increment_email_count", {
        org_name: organization,
      });
      console.log(
        `[incrementEmailCount] RPC returned:`,
        JSON.stringify(response)
      );
    } catch (rpcErr) {
      console.error("[incrementEmailCount] RPC Exception:", rpcErr);
      throw rpcErr;
    }

    const { data, error } = response;

    if (error) {
      console.error("[incrementEmailCount] RPC Error:", JSON.stringify(error));
    } else {
      console.log(`[incrementEmailCount] Success. Data:`, data);
    }
  } catch (err) {
    console.error("[incrementEmailCount] Exception:", err);
    // Don't throw - this is non-critical
  }
}

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

    // Increment email count - wait for it to complete
    if (organization) {
      console.log(
        `[sendEmail] Triggering increment for organization: "${organization}"`
      );
      try {
        await incrementEmailCount(env, organization);
        console.log("[sendEmail] Increment completed successfully");
      } catch (err) {
        console.error("[sendEmail] Increment failed:", err);
      }
    } else {
      console.warn("[sendEmail] No organization provided in payload");
    }

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
