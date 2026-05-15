// Cloudflare Pages Function: POST /logout
// Clears the session cookie. Called from App.handleLogout and the 2 AM
// scheduled reload path so the cookie expiry stays in lockstep with the
// React-state reset.

import { buildClearCookie, isSecureRequest } from "./_lib/session.js";

export async function onRequest(context) {
  const { request } = context;
  const headers = { "Content-Type": "application/json" };

  if (request.method === "OPTIONS") return new Response("", { status: 200, headers });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method Not Allowed" }), {
      status: 405,
      headers,
    });
  }

  const cookie = buildClearCookie({ secure: isSecureRequest(request) });
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...headers, "Set-Cookie": cookie },
  });
}
