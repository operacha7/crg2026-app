// Cloudflare Pages Function: POST /sendSupportEmail
// Endpoint: http(s)://<host>/sendSupportEmail

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
    return new Response(
      JSON.stringify({ success: false, message: "Method Not Allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log("📩 Incoming support request...");
  console.log(
    "🔐 Using API Key:",
    env.RESEND_API_KEY ? "✅ Set" : "❌ Missing"
  );

  try {
    const { name, email, organization, subject, message } =
      await request.json();

    console.log(
      "📦 Payload:",
      JSON.stringify({ name, email, organization, subject }, null, 2)
    );

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required fields",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create email content
    const emailSubject = `CRG Support: ${subject}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4A4E69; border-bottom: 2px solid #4A4E69; padding-bottom: 10px;">
          Support Request
        </h2>
        
        <div style="margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 120px;">Name:</td>
              <td style="padding: 8px 0;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Email:</td>
              <td style="padding: 8px 0;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Organization:</td>
              <td style="padding: 8px 0;">${organization || "Not provided"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Subject:</td>
              <td style="padding: 8px 0;">${subject}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 20px 0;">
          <h3 style="color: #4A4E69; margin-bottom: 10px;">Message:</h3>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${message}</div>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
          <p>This email was sent from the CRG Support Form.</p>
          <p>Reply directly to this email to respond to: ${email}</p>
        </div>
      </div>
    `;

    // Prepare payload for Resend API
    const payload = {
      from: '"CRG Support" <info@crghouston.operacha.org>',
      to: "developer@operacha.org",
      reply_to: email,
      subject: emailSubject,
      html: emailHtml,
    };

    // Send email via Resend API
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

    console.log("✅ Support email sent successfully:", data.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Support request sent successfully",
        id: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("🚨 Support function error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to send support request",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
