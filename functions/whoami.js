// Cloudflare Pages Function: GET /whoami
// Restores React user state on app load. Reads the session cookie, validates
// the JWT, then re-fetches the org row from Supabase so the returned user
// object reflects current org_color etc. — this is cheap (1 row) and avoids
// staleness if the org was edited between login and refresh.
//
// Returns { success: true, user: null } if there's no valid cookie. The 200
// (vs 401) is intentional: the unauthenticated state is a normal app state,
// not an error worth alarming on in client-side error monitoring.

import { createClient } from "@supabase/supabase-js";
import { readSessionCookie, verifySession } from "./_lib/session.js";

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

  const signingKey = env.SESSION_SIGNING_KEY;
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY;

  if (!signingKey || !supabaseUrl || !supabaseKey) {
    console.error("whoami: missing env config");
    return new Response(
      JSON.stringify({ success: false, message: "Service misconfigured" }),
      { status: 500, headers }
    );
  }

  const token = readSessionCookie(request);
  const session = token ? await verifySession(token, signingKey) : null;

  if (!session) {
    return new Response(JSON.stringify({ success: true, user: null }), {
      status: 200,
      headers,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: row, error } = await supabase
    .from("registered_organizations")
    .select("account_id, reg_organization, org_color")
    .eq("account_id", session.sub)
    .maybeSingle();

  // If the org was deleted between login and now, treat as logged-out.
  if (error || !row) {
    return new Response(JSON.stringify({ success: true, user: null }), {
      status: 200,
      headers,
    });
  }

  const user = {
    account_id: row.account_id,
    reg_organization: row.reg_organization,
    org_color: row.org_color || null,
    isGuest: false,
    canEmail: true,
    canPdf: true,
  };

  return new Response(JSON.stringify({ success: true, user }), {
    status: 200,
    headers,
  });
}
