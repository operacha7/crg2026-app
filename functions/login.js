// Cloudflare Pages Function: POST /login
// Server-side replacement for the previous client-side passcode check, which
// fetched the entire registered_organizations table (including org_passcode)
// from Supabase. That fetch let any visitor scrape every org's passcode via
// the Network tab. Authentication now happens here using the service-role
// key (which bypasses RLS), and a signed httpOnly session cookie is returned
// instead of the passcode.

import { createClient } from "@supabase/supabase-js";
import {
  hashPassword, // re-exported for the migration script via this module path if ever needed
  verifyPassword,
  signSession,
  buildSessionCookie,
  next2amCentralUnix,
  isSecureRequest,
} from "./_lib/session.js";

const MAX_FIELD_LENGTH = 200;

// YYYY-MM-DD in Central Time, matching the helper in log-usage.js so login
// rows stamp the same way regular activity does.
function getCentralDate() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
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
    console.error("login: missing env config");
    return new Response(
      JSON.stringify({ success: false, message: "Auth service misconfigured" }),
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

  const reg_organization = String(body?.reg_organization || "").slice(0, MAX_FIELD_LENGTH).trim();
  const passcode = String(body?.passcode || "").slice(0, MAX_FIELD_LENGTH);

  if (!reg_organization || !passcode) {
    return new Response(
      JSON.stringify({ success: false, message: "Organization and passcode are required" }),
      { status: 400, headers }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: row, error } = await supabase
    .from("registered_organizations")
    .select("account_id, reg_organization, org_passcode, org_color")
    .eq("reg_organization", reg_organization)
    .maybeSingle();

  if (error) {
    console.error("login: supabase error", error);
    return new Response(
      JSON.stringify({ success: false, message: "Auth service unavailable" }),
      { status: 503, headers }
    );
  }

  // Same generic message whether the org doesn't exist or the passcode is
  // wrong — denies an attacker the ability to enumerate registered orgs by
  // probing for "invalid passcode" vs "unknown org" responses.
  const genericFail = new Response(
    JSON.stringify({ success: false, message: "Invalid organization or passcode." }),
    { status: 401, headers }
  );

  if (!row) return genericFail;

  const valid = await verifyPassword(passcode, row.org_passcode);
  if (!valid) return genericFail;

  // Fire-and-forget login row for the Sessions Chart in Reports.
  // Skip Administrator to match the Reports filter (Administrator activity is
  // testing noise and excluded everywhere else). Wrapped in waitUntil so the
  // Workers runtime keeps the request context alive until the insert
  // completes — without it, the response returns immediately and the in-flight
  // insert gets cancelled, which is why early Sessions Chart data only
  // captured registered-org logins intermittently. Errors are caught inside
  // the promise so a logging failure can't reject up and break login.
  if (row.reg_organization !== "Administrator") {
    waitUntil(
      supabase
        .from("app_usage_logs")
        .insert({
          log_date: getCentralDate(),
          reg_organization: row.reg_organization,
          action_type: "login",
          search_mode: null,
          assistance_type: null,
          search_value: null,
        })
        .then(({ error: logErr }) => {
          if (logErr) console.error("login: usage log insert failed", logErr);
        })
        .catch((err) => {
          console.error("login: usage log insert threw", err);
        })
    );
  }

  const exp = next2amCentralUnix();
  const token = await signSession(
    {
      sub: row.account_id,
      org: row.reg_organization,
      iat: Math.floor(Date.now() / 1000),
      exp,
    },
    signingKey
  );

  const cookie = buildSessionCookie(token, exp, { secure: isSecureRequest(request) });

  // The user object the React app consumes. Mirrors the shape passed by the
  // old LoginModal so downstream consumers don't have to change.
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
    headers: { ...headers, "Set-Cookie": cookie },
  });
}

// Re-export for any caller that wants to hash from this module (kept for
// discoverability — the migration script imports directly from _lib/session).
export { hashPassword };
