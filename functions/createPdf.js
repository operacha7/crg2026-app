// Cloudflare Pages Function: POST /createPdf
// Endpoint: http(s)://<host>/createPdf
//
// Note: PDF creation counts are recorded client-side via logUsage() →
// app_usage_logs (see src/services/usageService.js + ZipCodePage's
// logDeliveryAction). The old denormalized increment_pdf_count RPC was
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
    return new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { htmlBody, header, headerHtml, footer, filename, margin, landscape, organization } =
      await request.json();

    if (!htmlBody) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing HTML content" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build the PDFShift payload
    const pdfShiftPayload = {
      source: htmlBody,
      // sandbox: true,
    };

    // Support both new 'header' object and legacy 'headerHtml' string
    if (header?.source) {
      pdfShiftPayload.header = {
        source: header.source,
        spacing: header.spacing || "10px",
      };
    } else if (headerHtml) {
      pdfShiftPayload.header = {
        source: headerHtml,
        height: "1in",
      };
    }

    if (footer?.source) {
      pdfShiftPayload.footer = {
        source: footer.source,
        spacing: footer.spacing || "10px",
      };
    } else if (footer) {
      // Legacy: footer passed directly
      pdfShiftPayload.footer = footer;
    }

    if (margin) {
      pdfShiftPayload.margin = margin;
    }

    if (landscape) {
      pdfShiftPayload.landscape = true;
    }

    const resp = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": env.PDFSHIFT_API_KEY,
        "X-Processor-Version": "142", // Use new Chromium engine (becomes default Jan 20, 2026)
      },
      body: JSON.stringify(pdfShiftPayload),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(
        JSON.stringify({
          success: false,
          message: "PDFShift failed",
          details: err,
        }),
        {
          status: resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const pdfArrayBuffer = await resp.arrayBuffer();

    console.log(
      `[createPdf] PDF created successfully. Organization: "${organization}"`
    );

    return new Response(pdfArrayBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${
          filename || "output.pdf"
        }"`,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error?.message || String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
