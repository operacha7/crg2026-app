// Cloudflare Pages Function: GET /list-org-colors
// Public (no session required). Returns the (reg_organization, org_color) pairs
// the Reports page needs to color-code charts and bold registered orgs in
// coverage tables. Replaces a client-side `select('reg_organization, org_color')`
// that kept the registered_organizations table publicly readable from the
// browser. With this endpoint in place, the public SELECT RLS policy can be
// dropped — this Function reads via the secret key, which bypasses RLS.
//
// Not auth-gated: org_color is not sensitive, and as of 2026-07-21 Reports is
// guest-accessible (guests have the same access as registered orgs — see
// src/config/guestAccess.js). Guests have no session cookie, so gating this on
// requireSession made every chart render gray for them. The usage data behind
// the charts is likewise read straight from Supabase views in the browser, so
// leaving colors unauthed keeps the whole Reports data layer consistent.

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
    console.error("list-org-colors: missing supabase env config");
    return new Response(
      JSON.stringify({ success: false, message: "Service misconfigured" }),
      { status: 500, headers }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("registered_organizations")
    .select("reg_organization, org_color")
    .order("reg_organization", { ascending: true });

  if (error) {
    console.error("list-org-colors: supabase error", error);
    return new Response(
      JSON.stringify({ success: false, message: "Service unavailable" }),
      { status: 503, headers }
    );
  }

  // Normalize to the same shape the previous browser query returned, so the
  // three Reports callers (NavBar2Reports, ChartReport, CoverageReport) need
  // no logic changes — just swap the fetch call.
  const orgs = (data || []).filter((r) => r.reg_organization);

  return new Response(JSON.stringify({ success: true, orgs }), {
    status: 200,
    headers,
  });
}
