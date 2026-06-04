// Cloudflare Pages Function: POST /track-calendar-add
// Anonymous counter for the Training Sessions page. When a user clicks "Add to
// Calendar" (.ics) or "Google Calendar" for a session, the browser fires a
// fire-and-forget POST here and we increment training_sessions.calendar_adds.
//
// Privacy: NO user information is collected or stored — no names, no auth, no
// identifiers, no IP. The only thing recorded is a per-session integer count.
// Browser writes to training_sessions are blocked by policy, so the increment
// has to come through this function (same reasoning as functions/log-usage.js).
//
// Dedupe happens client-side via localStorage so one browser can't inflate the
// count by clicking twice; this endpoint stays deliberately simple.

import { createClient } from "@supabase/supabase-js";

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

  if (!supabaseUrl || !supabaseKey) {
    console.error("track-calendar-add: missing env config");
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

  // session_id must be a positive integer matching training_sessions.id_no.
  const sessionId = Number(body?.session_id);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return new Response(
      JSON.stringify({ success: false, message: "Valid session_id required" }),
      { status: 400, headers }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  // Atomic increment via SQL function — avoids a read-modify-write race.
  const { data, error } = await supabase.rpc("increment_training_calendar_adds", {
    p_session_id: sessionId,
  });

  if (error) {
    console.error("track-calendar-add: rpc failed", error);
    return new Response(
      JSON.stringify({ success: false, message: "Tracking failed" }),
      { status: 503, headers }
    );
  }

  return new Response(JSON.stringify({ success: true, count: data }), {
    status: 200,
    headers,
  });
}
