// functions/translate.js
// Cloudflare Function for translating HTML content via Google Cloud Translation API v2
// Used by email and PDF flows to translate resource content to Spanish (or other languages)

export async function onRequest({ request, env }) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Method Not Allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { htmlBody, subject, targetLanguage } = await request.json();

    // Validate input
    if (!htmlBody || !targetLanguage) {
      return new Response(
        JSON.stringify({ success: false, message: "htmlBody and targetLanguage are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If target language is English, return unchanged (no API call needed)
    if (targetLanguage === "en") {
      return new Response(
        JSON.stringify({ success: true, htmlBody, subject: subject || "" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      console.error("❌ GOOGLE_TRANSLATE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, message: "Translation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const translateUrl = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    // Translate HTML body (format=html preserves all HTML tags)
    console.log(`📝 Translating HTML content to ${targetLanguage} (${htmlBody.length} chars)`);
    const htmlResponse = await fetch(translateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: htmlBody,
        target: targetLanguage,
        format: "html",
      }),
    });

    const htmlData = await htmlResponse.json();
    if (!htmlResponse.ok || htmlData.error) {
      const errorMsg = htmlData.error?.message || "Translation API error";
      console.error("❌ HTML translation failed:", errorMsg);
      throw new Error(errorMsg);
    }

    const translatedHtml = htmlData.data.translations[0].translatedText;

    // Translate subject line if provided (plain text)
    let translatedSubject = subject || "";
    if (subject) {
      const subjectResponse = await fetch(translateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: subject,
          target: targetLanguage,
          format: "text",
        }),
      });

      const subjectData = await subjectResponse.json();
      if (subjectResponse.ok && !subjectData.error) {
        translatedSubject = subjectData.data.translations[0].translatedText;
      } else {
        console.warn("⚠️ Subject translation failed, using original");
      }
    }

    console.log(`✅ Translation complete (${translatedHtml.length} chars)`);

    return new Response(
      JSON.stringify({
        success: true,
        htmlBody: translatedHtml,
        subject: translatedSubject,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("🚨 Translation error:", error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
