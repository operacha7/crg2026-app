// Cloudflare Pages Function: GET /news-feed
// Endpoint: http(s)://<host>/news-feed
//
// Public read of the PUBLISHED, unexpired Opportunity Scan findings that power
// the News page and the footer chyron. Served server-side with the secret key so
// `scan_findings` is never exposed to the browser (same pattern as the app's
// other browser-locked tables).
//
// NOTE: deliberately NOT named /news — a Pages Function takes precedence over the
// SPA proxy, so a /news function would shadow the React /news page route.
//
// Returns only what the feed needs — never `status`, `confidence`, or the
// review-workflow internals.

import { createClient } from "@supabase/supabase-js";
import { isPaywalledSource } from "./_lib/scan-sources.js";

export async function onRequest({ request, env }) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }
  if (request.method !== "GET") {
    return json({ ok: false, error: "Method Not Allowed" }, 405, corsHeaders);
  }

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SECRET_KEY || env.VITE_SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return json({ ok: false, error: "Supabase not configured" }, 500, corsHeaders);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const today = new Date().toISOString().slice(0, 10);

    // Published + not past its expiration date. A null expires_at means
    // "no expiry" (continuous) — see the plan's feed rules.
    const { data, error } = await supabase
      .from("scan_findings")
      .select(
        "id, category, title, summary, eligibility, deadline, county, org_name, directory_id_no, source, source_url, notes, created_at, expires_at"
      )
      .eq("status", "published")
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Badge paywalled outlets so the UI can warn before the click. Derived from
    // the source name so no extra column is needed.
    const items = (data || []).map((f) => ({
      ...f,
      paywalled: isPaywalledSource(f.source),
    }));

    return json({ ok: true, items }, 200, corsHeaders);
  } catch (err) {
    console.error("🚨 /news error:", err);
    return json({ ok: false, error: err.message }, 500, corsHeaders);
  }
}

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...extraHeaders, "Content-Type": "application/json" },
  });
}
