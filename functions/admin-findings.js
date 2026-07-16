// Cloudflare Pages Function: /admin-findings
// Endpoint: http(s)://<host>/admin-findings
//
// The Opportunity Scan review API — the back end of the Admin Review page.
// Replaces editing scan_findings by hand in Supabase.
//
//   GET  /admin-findings?status=new   → the review queue
//   POST { action: "update", id, patch }  → publish / dismiss / edit a finding
//   POST { action: "create", fields }     → manually add a story (the mid-week
//                                            fast lane; published immediately)
//
// Gated to the CRG admin org: the session JWT's `sub` IS the
// registered_organizations.account_id, so we compare it to ADMIN_ACCOUNT_ID.
// This is the real gate — the nav icon being hidden for everyone else is only
// cosmetic.

import { createClient } from "@supabase/supabase-js";
import { requireSession } from "./_lib/auth.js";
import { dedupeKeyFor } from "./_lib/dedupe.js";
import { ADMIN_ACCOUNT_ID } from "./config.js";

// Only these columns may be written from the browser. Everything else —
// dedupe_key, run_date, created_at, confidence, source attribution — is either
// derived here or owned by the scan, and must not be client-settable.
const WRITABLE = new Set([
  "category",
  "title",
  "summary",
  "eligibility",
  "deadline",
  "county",
  "org_name",
  "directory_id_no",
  "notes",
  "status",
  "expires_at",
]);

const ALLOWED_STATUS = new Set(["new", "published", "dismissed"]);

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function todayPlus(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Keep only writable keys; normalize "" → null so cleared fields don't store
// empty strings. Returns null if the caller sent an invalid status.
function sanitizePatch(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (!WRITABLE.has(k)) continue;
    if (k === "status" && !ALLOWED_STATUS.has(v)) return null;
    out[k] = v === "" ? null : v;
  }
  return out;
}

async function requireAdmin(request, env) {
  const auth = await requireSession(request, env);
  if (!auth.ok) return { ok: false, response: auth.response };
  if (String(auth.session.sub) !== String(ADMIN_ACCOUNT_ID)) {
    return { ok: false, response: json({ ok: false, error: "Not authorized" }, 403) };
  }
  return { ok: true, session: auth.session };
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response("", { status: 200 });

  const admin = await requireAdmin(request, env);
  if (!admin.ok) return admin.response;

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SECRET_KEY || env.VITE_SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return json({ ok: false, error: "Supabase not configured" }, 500);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ---- Review queue -----------------------------------------------------
    if (request.method === "GET") {
      const status = new URL(request.url).searchParams.get("status") || "new";
      if (!ALLOWED_STATUS.has(status)) return json({ ok: false, error: "Bad status" }, 400);

      let query = supabase.from("scan_findings").select("*").eq("status", status);

      // The published tab exists to manage what's LIVE, not to browse the
      // archive — so it mirrors the feed's own filter (see news-feed.js). Expired
      // stories drop off both, and the two can't disagree.
      if (status === "published") {
        query = query.or(`expires_at.is.null,expires_at.gte.${todayPlus(0)}`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return json({ ok: true, items: data || [] });
    }

    if (request.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, 405);

    const body = await request.json().catch(() => ({}));

    // ---- Publish / dismiss / edit ----------------------------------------
    if (body.action === "update") {
      if (!body.id) return json({ ok: false, error: "id required" }, 400);
      const patch = sanitizePatch(body.patch);
      if (!patch) return json({ ok: false, error: "Invalid status" }, 400);
      if (Object.keys(patch).length === 0) return json({ ok: false, error: "Nothing to update" }, 400);

      const { data, error } = await supabase
        .from("scan_findings")
        .update(patch)
        .eq("id", body.id)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      return json({ ok: true, item: data });
    }

    // ---- Manual add (mid-week fast lane) ---------------------------------
    if (body.action === "create") {
      const f = body.fields || {};
      if (!f.title || !f.summary || !f.category) {
        return json({ ok: false, error: "title, summary and category are required" }, 400);
      }

      // Derive the dedupe key the same way the scan does, so a story added by
      // hand blocks the scan from re-adding it later.
      const row = {
        run_date: todayPlus(0),
        category: f.category,
        title: f.title,
        summary: f.summary,
        eligibility: f.eligibility || null,
        deadline: f.deadline || null,
        county: f.county || null,
        org_name: f.org_name || null,
        directory_id_no: f.directory_id_no || null,
        source: f.source || null,
        source_url: f.source_url || null,
        notes: f.notes || null,
        dedupe_key: dedupeKeyFor(f),
        status: f.status && ALLOWED_STATUS.has(f.status) ? f.status : "published",
        expires_at: f.expires_at || todayPlus(7),
      };

      const { data, error } = await supabase
        .from("scan_findings")
        .insert(row)
        .select()
        .maybeSingle();

      if (error) {
        // 23505 = unique violation on dedupe_key: this story is already here.
        if (error.code === "23505") {
          return json({ ok: false, error: "That story is already in the feed." }, 409);
        }
        throw new Error(error.message);
      }
      return json({ ok: true, item: data });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (err) {
    console.error("🚨 /admin-findings error:", err);
    return json({ ok: false, error: err.message }, 500);
  }
}
