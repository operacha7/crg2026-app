// Cloudflare Pages Function: POST /training-request
// Records anonymous "preferred training time" votes for the /training matrix.
// The browser sends a batch of {day, time} selections; we attribute them to the
// caller's organization (resolved from the session cookie — NOT trusted from the
// request body, so it can't be spoofed) or "Guest" when there's no valid session,
// stamp each with today's Central date, and insert one row per selection.
//
// Why server-side writes: browser writes to this table are blocked by policy
// (RLS select-only), same reasoning as functions/track-calendar-add.js and
// functions/log-usage.js — only the secret key (service role) may insert.
//
// Privacy: we store the organization name (or "Guest") + day/time + date. No
// individual identity, no IP. Per-browser dedupe is client-side (localStorage),
// so this endpoint stays simple and idempotency isn't enforced here.

import { createClient } from "@supabase/supabase-js";
import { readSessionCookie, verifySession } from "./_lib/session.js";

const VALID_DAYS = new Set(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
const VALID_TIMES = new Set(["Morning", "Afternoon", "Evening"]);
const MAX_SELECTIONS = 21; // 7 days × 3 times — the whole grid

// Today's date in Central time as YYYY-MM-DD (en-CA formats that way). The
// 30-day read window makes a UTC-vs-Central skew immaterial, but we match the
// rest of the app (America/Chicago) for consistency.
function centralToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
    console.error("training-request: missing env config");
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

  // Validate + dedupe selections within this request.
  const raw = Array.isArray(body?.selections) ? body.selections : [];
  const seen = new Set();
  const selections = [];
  for (const sel of raw) {
    const day = sel?.day;
    const time = sel?.time;
    if (!VALID_DAYS.has(day) || !VALID_TIMES.has(time)) continue;
    const key = `${day}|${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selections.push({ day, time });
  }

  if (selections.length === 0) {
    return new Response(
      JSON.stringify({ success: false, message: "No valid selections" }),
      { status: 400, headers }
    );
  }
  if (selections.length > MAX_SELECTIONS) {
    return new Response(
      JSON.stringify({ success: false, message: "Too many selections" }),
      { status: 400, headers }
    );
  }

  // Attribute to the caller's org from the session cookie; default to "Guest".
  // Signing key may be absent in some misconfigured envs — fall back to Guest
  // rather than failing the vote.
  let reg_organization = "Guest";
  if (signingKey) {
    const token = readSessionCookie(request);
    const session = token ? await verifySession(token, signingKey) : null;
    if (session?.reg_organization) reg_organization = session.reg_organization;
  }

  const date = centralToday();
  const rows = selections.map(({ day, time }) => ({ date, day, time, reg_organization }));

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase.from("training_request").insert(rows);

  if (error) {
    console.error("training-request: insert failed", error);
    return new Response(
      JSON.stringify({ success: false, message: "Could not record preferences" }),
      { status: 503, headers }
    );
  }

  return new Response(JSON.stringify({ success: true, inserted: rows.length }), {
    status: 200,
    headers,
  });
}
