// Cloudflare Pages Function: GET /list-orgs
// Returns just the names of registered organizations for the login dropdown.
// Replaces a client-side `select('*') from registered_organizations` that
// previously also exposed every org's passcode.

import { createClient } from "@supabase/supabase-js";

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { "Content-Type": "application/json" };

  if (request.method === "OPTIONS") return new Response("", { status: 200, headers });
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ success: false, message: "Method Not Allowed" }), {
      status: 405,
      headers,
    });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("list-orgs: missing supabase env config");
    return new Response(
      JSON.stringify({ success: false, message: "Service misconfigured" }),
      { status: 500, headers }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("registered_organizations")
    .select("reg_organization")
    .order("reg_organization", { ascending: true });

  if (error) {
    console.error("list-orgs: supabase error", error);
    return new Response(
      JSON.stringify({ success: false, message: "Service unavailable" }),
      { status: 503, headers }
    );
  }

  const orgs = (data || [])
    .map((r) => r.reg_organization)
    .filter(Boolean);

  return new Response(JSON.stringify({ success: true, orgs }), {
    status: 200,
    headers,
  });
}
