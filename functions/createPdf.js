// Cloudflare Pages Function: POST /createPdf
// Endpoint: http(s)://<host>/createPdf

import { createClient } from "@supabase/supabase-js";

// Helper function to increment PDF count in Supabase
async function incrementPdfCount(env, organization) {
  try {
    console.log(
      `[incrementPdfCount] Starting for organization: "${organization}"`
    );

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[incrementPdfCount] Missing Supabase credentials");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the RPC function to increment PDF count
    console.log(
      `[incrementPdfCount] Calling RPC with org_name: "${organization}"`
    );

    let response;
    try {
      response = await supabase.rpc("increment_pdf_count", {
        org_name: organization,
      });
      console.log(
        `[incrementPdfCount] RPC returned:`,
        JSON.stringify(response)
      );
    } catch (rpcErr) {
      console.error("[incrementPdfCount] RPC Exception:", rpcErr);
      throw rpcErr;
    }

    const { data, error } = response;

    if (error) {
      console.error("[incrementPdfCount] RPC Error:", JSON.stringify(error));
    } else {
      console.log(`[incrementPdfCount] Success. Data:`, data);
    }
  } catch (err) {
    console.error("[incrementPdfCount] Exception:", err);
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
    return new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { htmlBody, header, headerHtml, footer, filename, margin, organization } =
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

    // Increment PDF count - wait for it to complete
    if (organization) {
      console.log(
        `[createPdf] Triggering increment for organization: "${organization}"`
      );
      try {
        await incrementPdfCount(env, organization);
        console.log("[createPdf] Increment completed successfully");
      } catch (err) {
        console.error("[createPdf] Increment failed:", err);
      }
    } else {
      console.warn("[createPdf] No organization provided in payload");
    }

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
