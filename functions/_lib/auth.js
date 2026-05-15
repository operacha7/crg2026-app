// functions/_lib/auth.js
// Cookie-validation helper used by gated endpoints (sendEmail, createPdf, etc.)
// to confirm the request comes from a logged-in registered organization.
//
// Usage in a Pages Function:
//   import { requireSession } from "./_lib/auth.js";
//   const auth = await requireSession(request, env);
//   if (!auth.ok) return auth.response; // 401 already prepared
//   // auth.session is { sub: account_id, org: reg_organization, exp }

import { readSessionCookie, verifySession } from "./session.js";

export async function requireSession(request, env) {
  const signingKey = env.SESSION_SIGNING_KEY;
  if (!signingKey) {
    // Misconfiguration on the server side, not the client's fault — but we
    // still refuse to authenticate. 500 surfaces this in logs.
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, message: "Auth not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  const token = readSessionCookie(request);
  const session = token ? await verifySession(token, signingKey) : null;

  if (!session) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, message: "Sign in required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return { ok: true, session };
}
