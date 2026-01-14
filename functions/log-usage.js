// Cloudflare Pages Function: POST /log-usage
// Endpoint: http(s)://<host>/log-usage

import { createClient } from "@supabase/supabase-js";

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
    return new Response(JSON.stringify({ message: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Initialize Supabase client
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({
        message: "Server configuration error - missing Supabase credentials",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Parse incoming event
    const usageEvent = await request.json();

    // Extract client IP from request headers
    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      "unknown";

    // Add source information
    const logEntry = {
      ...usageEvent,
      // Add server-generated fields
      logged_at: new Date().toISOString(),
      client_ip: clientIp,
      environment: env.ENVIRONMENT || "production",
      // Extract components from the event for better querying
      organization: usageEvent.regOrganization,
      action_type: usageEvent.tab,
      search_type: usageEvent.search,
      search_value: usageEvent.value,
      action_status: usageEvent.status,
      week_number: usageEvent.week,
      user_language: usageEvent.language,
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from("usage_logs")
      .insert([logEntry]);

    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        message: "Usage logged successfully to database",
        id: data ? data[0]?.id : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error logging usage:", err);
    return new Response(
      JSON.stringify({
        message: "Failed to log usage",
        error: err.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
