// Cloudflare Pages Function: POST /log-usage
// Server-side replacement for the previous client-side
// `supabase.from('app_usage_logs').insert(...)`. That direct write needed
// an INSERT policy on app_usage_logs that was open to anon, which let any
// browser spam the table (cost / data-pollution risk). With this endpoint
// in place we can drop that policy.
//
// Auth flow:
//   - If a valid session cookie is present, the row's reg_organization is
//     forced to the cookie's `org` value. The body's reg_organization is
//     ignored — a logged-in caller can't spoof another org's logs.
//   - If no session cookie is present, the body must claim
//     reg_organization === "Guest". This preserves guest activity logging
//     (which the Reports page relies on) without letting an unauthenticated
//     caller pretend to be a registered org.
//
// All input fields are length-capped so a malicious caller can't store
// large blobs in search_value or assistance_type.

import { createClient } from "@supabase/supabase-js";
import { readSessionCookie, verifySession } from "./_lib/session.js";

const MAX_FIELD_LENGTH = 200;
const MAX_SEARCH_VALUE_LENGTH = 1000; // larger because LLM queries land here

function cap(value, max) {
  if (value === null || value === undefined) return null;
  return String(value).slice(0, max);
}

function getCentralDate() {
  // YYYY-MM-DD in Central Time, matching the previous client-side helper.
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
}

export async function onRequest({ request, env }) {
  const headers = { "Content-Type": "application/json" };

  if (request.method === "OPTIONS") return new Response("", { status: 200, headers });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method Not Allowed" }), {
      status: 405,
      headers,
    });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY;
  const signingKey = env.SESSION_SIGNING_KEY;

  if (!supabaseUrl || !supabaseKey || !signingKey) {
    console.error("log-usage: missing env config");
    return new Response(
      JSON.stringify({ success: false, message: "Service misconfigured" }),
      { status: 500, headers }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: "Invalid request" }), {
      status: 400,
      headers,
    });
  }

  // Session is optional here — guests log without a cookie. We only need it
  // to decide whose name goes on the row.
  const token = readSessionCookie(request);
  const session = token ? await verifySession(token, signingKey) : null;

  let reg_organization;
  if (session) {
    // Server-authoritative: never trust the body when there's a session,
    // so a logged-in org can't backdoor logs onto another org's report.
    reg_organization = session.org;
  } else {
    // No session → must be a guest. Reject anything else; an anon caller
    // shouldn't be able to write rows attributed to a real org.
    const claimed = cap(body?.reg_organization, MAX_FIELD_LENGTH);
    if (claimed !== "Guest") {
      console.error(
        `log-usage: rejecting unauth request — claimed=${JSON.stringify(claimed)}, action_type=${JSON.stringify(body?.action_type)}, hasCookie=${!!token}`
      );
      return new Response(
        JSON.stringify({ success: false, message: "Sign in required to log activity for a registered org" }),
        { status: 401, headers }
      );
    }
    reg_organization = "Guest";
  }

  const action_type = cap(body?.action_type, MAX_FIELD_LENGTH);
  if (!action_type) {
    return new Response(JSON.stringify({ success: false, message: "action_type required" }), {
      status: 400,
      headers,
    });
  }

  // Sender child (conference/location) for child-level usage analytics. Comes
  // from the body — the server can't know the localStorage-resolved child.
  // Informational, not security-sensitive. Falls back to reg_organization when
  // absent (solo orgs, guests) so the column is never null.
  let organization = cap(body?.organization, MAX_FIELD_LENGTH);
  if (!organization) organization = reg_organization;

  const row = {
    log_date: getCentralDate(),
    reg_organization,
    organization,
    action_type,
    search_mode: cap(body?.search_mode, MAX_FIELD_LENGTH),
    assistance_type: cap(body?.assistance_type, MAX_FIELD_LENGTH),
    search_value: cap(body?.search_value, MAX_SEARCH_VALUE_LENGTH),
  };

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase.from("app_usage_logs").insert(row);

  if (error) {
    console.error("log-usage: supabase insert failed", error);
    return new Response(
      JSON.stringify({ success: false, message: "Logging failed" }),
      { status: 503, headers }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
}
