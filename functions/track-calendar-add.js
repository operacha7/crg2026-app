// Cloudflare Pages Function: POST /track-calendar-add
// Records a "saved to calendar" for a Training Session. When a user clicks "Add
// to Calendar" for a session, the browser fires a fire-and-forget POST here and
// we append one row to the `training_taken` log.
//
// What we store (mirrors functions/log-usage.js's parent/child model):
//   reg_organization — the PARENT/login org, read authoritatively from the
//     session cookie's `org` claim (NOT trusted from the body, so it can't be
//     spoofed); "Guest" when there's no valid session.
//   organization     — the selected CHILD org. The server can't read this (it
//     lives in the browser's localStorage), so it comes from the body; capped
//     and falls back to reg_organization when absent (solo orgs / guests) so
//     the column is never null.
//   session_id       — training_sessions.id_no (identifies which live session)
//   training         — the session title (looked up server-side, authoritative)
//   medium           — 'live' (video views will log medium 'video' later)
//   attended         — defaults TRUE on add; the admin flips it to FALSE later
//     for no-shows (a calendar-add is optimistic, not proof of attendance).
//   date / time      — Central (America/Chicago) date + time of the add.
//
// Why server-side writes: browser writes to training_taken are blocked by RLS
// (select-only), same reasoning as functions/training-request.js and
// functions/log-usage.js — only the secret (service-role) key may insert.
//
// The "N saved this session" counter is now DERIVED from a COUNT of these rows
// (see dataService.getTrainingSessions) — training_sessions.calendar_adds and
// the increment_training_calendar_adds RPC are retired. Per-browser dedupe stays
// client-side (localStorage) so one browser can't inflate the count.

import { createClient } from "@supabase/supabase-js";
import { readSessionCookie, verifySession } from "./_lib/session.js";

// Central-time (America/Chicago) "YYYY-MM-DD" and "HH:MM:SS" for the event stamp.
function centralDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function centralTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
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

  const signingKey = env.SESSION_SIGNING_KEY;
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

  // Parent/login org from the session cookie's `org` claim; default "Guest".
  // Signing key may be absent in some misconfigured envs — fall back to Guest
  // rather than failing the write.
  let reg_organization = "Guest";
  if (signingKey) {
    const token = readSessionCookie(request);
    const session = token ? await verifySession(token, signingKey) : null;
    if (session?.org) reg_organization = session.org;
  }

  // Selected child org (informational, from the body — the server can't read
  // the localStorage-resolved child). Cap length; fall back to the parent so
  // the column is never null.
  let organization = body?.organization ? String(body.organization).slice(0, 200) : null;
  if (!organization) organization = reg_organization;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Authoritative title lookup — the log stores a human-readable label so the
  // admin can read the table directly without joining. Best-effort: a missing
  // title still logs the row (session_id keeps it identifiable).
  let training = null;
  const { data: sess } = await supabase
    .from("training_sessions")
    .select("title")
    .eq("id_no", sessionId)
    .single();
  if (sess?.title) training = sess.title;

  const { error } = await supabase.from("training_taken").insert({
    reg_organization,
    organization,
    session_id: sessionId,
    training,
    medium: "live",
    attended: true,
    date: centralDate(),
    time: centralTime(),
  });

  if (error) {
    console.error("track-calendar-add: insert failed", error);
    return new Response(
      JSON.stringify({ success: false, message: "Tracking failed" }),
      { status: 503, headers }
    );
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}
