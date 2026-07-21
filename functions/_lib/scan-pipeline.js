// functions/_lib/scan-pipeline.js
// The weekly Opportunity Scan pipeline — the transport-free engine.
//
// This file is a LIBRARY (underscore dir → not a Cloudflare route). It runs from
// Node on Omar's always-on home desktop via scripts/run-scan.mjs, scheduled by
// launchd (Mondays 2pm local). It moved OFF Cloudflare because the two things a
// datacenter can't do are exactly what this needs: reach Google News RSS (which
// 503s Cloudflare's shared egress IPs but serves a residential IP fine) and run
// for minutes (Cloudflare cancels waitUntil at ~30s; a real run takes minutes of
// LLM latency). See CLAUDE.md → "Opportunity Scan System" for the full history.
//
// Pipeline (runScan):
//   1. Poll curated news sources (direct RSS + Google News RSS + GDELT)   [free]
//   2. Date-window (14d), dedupe by link, cap the candidate set
//   3. Haiku: cheap relevance cull against the rubric
//   4. Sonnet: cluster same-event stories → one finding w/ best link;
//        cross-reference the CRG org list (prompt-cached); tag category +
//        crg_action; emit a semantic dedupe_key
//   5. Insert into scan_findings status='new' ON CONFLICT (dedupe_key) DO NOTHING
//   6. Email a review-nudge digest via Resend (grouped + source scorecard)
//
// Design of record: ~/.claude/plans/claude-md-includes-an-opportunity-woolly-music.md

import { HAIKU_MODEL, SONNET_MODEL } from "../config.js";
import {
  DIRECT_FEEDS,
  GOOGLE_NEWS_QUERIES,
  GDELT_QUERIES,
  googleNewsRssUrl,
  gdeltRssUrl,
  RELEVANCE_RUBRIC,
  COUNTIES,
  isPaywalledSource,
} from "./scan-sources.js";
import { pollFeed, withinDays, dedupeByLink } from "./rss.js";
import { dedupeKeyFor } from "./dedupe.js";

const WINDOW_DAYS = 14;        // how far back to consider candidates
const MAX_CANDIDATES = 500;    // hard cap before the LLM sees anything
const PER_FEED_CAP = 30;       // max items any single feed contributes (anti-flood)
const FEED_TIMEOUT_MS = 15000; // per-feed fetch timeout (starts when the fetch does)
const FEED_CONCURRENCY = 6;    // feeds in flight at once — see mapWithConcurrency
const HAIKU_CHUNK = 200;       // candidates per Haiku call (bigger chunk = same # of calls despite higher cap)

// Statewide/national-mix feeds (filterToRegion) are kept only when the item
// text mentions our region — Houston, a county, or a local city.
const REGION_CITIES = [
  "Houston", "Katy", "Sugar Land", "Pearland", "Pasadena", "Baytown", "Conroe",
  "Galveston", "Bryan", "College Station", "Huntsville", "Bay City", "Angleton",
  "Richmond", "Rosenberg", "Missouri City", "Spring", "Cypress", "Humble",
  "Tomball", "Hempstead", "Bellville", "Navasota", "Liberty", "Anahuac",
  "Texas City", "League City", "Friendswood", "Stafford", "Wharton",
];
const REGION_RE = new RegExp(
  `\\b(${[...COUNTIES, ...REGION_CITIES].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i"
);
function mentionsRegion(text) {
  return REGION_RE.test(text || "");
}
const DIGEST_FROM = '"CRG Opportunity Scan" <info@crghouston.org>';

const ANTHROPIC_HEADERS = (env) => ({
  "Content-Type": "application/json",
  "x-api-key": env.ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
});

// ---- Anthropic tool schemas (forced tool_use → guaranteed JSON) ----

const HAIKU_TOOL = {
  name: "keep_relevant",
  description:
    "Return the indices of the candidate news items that are relevant to CRG per the rubric. Be VERY inclusive at this stage — Sonnet does the careful synthesis, and a human reviews everything after. When in doubt, KEEP it. Drop only obvious noise (sports, crime, weather, routine business/politics with no assistance angle, clearly out-of-area).",
  input_schema: {
    type: "object",
    properties: {
      keep: {
        type: "array",
        description: "Indices (from the numbered list) of items worth keeping.",
        items: { type: "integer" },
      },
    },
    required: ["keep"],
  },
};

// Topical categories (edit here + in CATEGORY_LABELS to tune the grouping).
const CATEGORY_ENUM = [
  "food", "housing", "utilities", "health", "mother_child", "jobs_education",
  "seasonal", "disaster", "news_policy", "other",
];

const SONNET_TOOL = {
  name: "report_findings",
  description:
    "Report the synthesized findings worth surfacing to CRG, PLUS a list of items you considered but did NOT surface. Cluster multiple stories about the SAME event into ONE finding with the single most useful link. Favor recall: when unsure, surface it as a low-confidence finding rather than dropping it — a human reviews and dismisses everything.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: CATEGORY_ENUM,
              description:
                "Topical bucket: food | housing (rent/eviction/homelessness) | utilities (bill help) | health (clinics/vaccines/ACA/Medicaid) | mother_child (pregnancy, childbirth, infants, new mothers, diapers/baby supplies, childcare) | jobs_education (training/scholarships/internships) | seasonal (back-to-school/holiday) | disaster (relief) | news_policy (legislation/trends/closures/FYI) | other.",
            },
            title: { type: "string", description: "CRG's own short headline (do NOT copy the outlet's verbatim)." },
            summary: { type: "string", description: "CRG's own 1-2 sentence summary in plain facts (copyright-safe)." },
            eligibility: { type: "string" },
            deadline: { type: "string", description: "A date or free text like 'open until capacity'; empty if none." },
            county: { type: "string", description: "Which of the 15 counties, if identifiable." },
            org_name: { type: "string", description: "The organization's name whenever one is identifiable from the story — fill this any time an org is named." },
            confidence: { type: "string", enum: ["high", "medium", "low"], description: "How solid/actionable — mark borderline items 'low' but STILL surface them." },
            source: { type: "string", description: "Outlet/feed name of the single best story chosen." },
            source_url: { type: "string", description: "The single best story URL." },
          },
          required: ["category", "title", "summary", "confidence", "source", "source_url"],
        },
      },
      also_considered: {
        type: "array",
        description:
          "Items you saw but chose NOT to surface (true duplicates already covered by a finding, or clearly not assistance-relevant). One line each so a human can audit for missed items. Never include anything already in findings.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            source: { type: "string" },
            source_url: { type: "string" },
            reason: { type: "string", description: "Brief why-not, e.g. 'duplicate of X', 'not assistance-related', 'outside 15 counties'." },
          },
          required: ["title", "reason"],
        },
      },
    },
    required: ["findings"],
  },
};

// ---- Anthropic call helper (forced tool use) ----

// Anthropic statuses worth a retry: rate-limit (429), transient server errors,
// and 529 "Overloaded" (the API is momentarily busy). Everything else — a bad
// request, auth, etc. — is a hard fail and rethrows immediately.
const ANTHROPIC_RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

async function callClaude(env, { model, system, userText, tool, maxTokens, temperature, retries = 3 }) {
  const payload = {
    model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: userText }],
  };
  // Claude 5 models (Sonnet 5) deprecated the `temperature` knob and 400 if it's
  // sent; Haiku 4.5 still supports it. Callers pass temperature only where valid.
  if (typeof temperature === "number") payload.temperature = temperature;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: ANTHROPIC_HEADERS(env),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || res.status;
      // A momentary overload must NOT sink the whole unattended run — back off
      // and retry. Weekly cadence means we can afford to wait several seconds.
      if (ANTHROPIC_RETRYABLE.has(res.status) && attempt < retries) {
        const waitMs = 1000 * 2 ** attempt + Math.floor(Math.random() * 500);
        console.log(`↻ ${model} HTTP ${res.status} (${msg}) — retry ${attempt + 1}/${retries} in ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw new Error(`Anthropic ${model} error: ${msg}`);
    }
    if (data.usage) console.log(`📊 ${model} usage:`, JSON.stringify(data.usage));
    console.log(`   ${model} stop_reason: ${data.stop_reason}`);
    const block = data.content?.find((b) => b.type === "tool_use");
    if (!block) {
      console.log(`   ⚠️ ${model} no tool_use block. content:`, JSON.stringify(data.content).slice(0, 600));
    }
    return block?.input || null;
  }
}

// ---- Pipeline steps ----

// Run `fn` over `items` with at most `limit` in flight. NOT a nicety: firing all
// ~43 feeds at once made Google News 503 the burst, and every queued fetch burned
// its abort timeout waiting for a connection slot (timers start when pollFeed is
// CALLED, so a lazy pool is also what keeps each feed's timeout honest).
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function pollAllSources() {
  // Query feeds FIRST (targeted, high-signal) so the backbone always clears the
  // cap; direct outlet feeds after. Each feed is region-filtered if flagged and
  // capped so no single high-volume feed floods the candidate pool.
  const queryFeeds = [
    ...GOOGLE_NEWS_QUERIES.map((q) => ({ name: `Google News: ${q.slice(0, 40)}`, url: googleNewsRssUrl(q) })),
    ...GDELT_QUERIES.map((q, i) => ({ name: `GDELT ${i + 1}`, url: gdeltRssUrl(q) })),
  ];
  const feeds = [...queryFeeds, ...DIRECT_FEEDS.map((f) => ({ ...f }))];
  const results = await mapWithConcurrency(feeds, FEED_CONCURRENCY, async (f) => {
    let items = await pollFeed(f, { timeoutMs: FEED_TIMEOUT_MS });
    if (f.filterToRegion) {
      items = items.filter((it) => mentionsRegion(`${it.title} ${it.summary}`));
    }
    return items.slice(0, PER_FEED_CAP);
  });
  return results.flat();
}

async function haikuFilter(env, candidates) {
  const kept = [];
  for (let i = 0; i < candidates.length; i += HAIKU_CHUNK) {
    const chunk = candidates.slice(i, i + HAIKU_CHUNK);
    const list = chunk
      .map((c, j) => `${j}. [${c.source}] ${c.title}${c.summary ? " — " + c.summary.slice(0, 160) : ""}`)
      .join("\n");
    const out = await callClaude(env, {
      model: HAIKU_MODEL,
      maxTokens: 1024,
      temperature: 0, // Haiku 4.5 supports it → deterministic relevance cull
      tool: HAIKU_TOOL,
      system: RELEVANCE_RUBRIC,
      userText: `Candidate news items (indices are local to this list):\n\n${list}\n\nReturn the indices worth keeping.`,
    });
    for (const idx of out?.keep || []) {
      if (chunk[idx]) kept.push(chunk[idx]);
    }
  }
  return kept;
}

async function sonnetSynthesize(env, survivors, orgContext) {
  if (survivors.length === 0) return { findings: [], alsoConsidered: [] };
  const list = survivors
    .map(
      (c, i) =>
        `${i + 1}. [${c.source}] ${c.title}\n   url: ${c.link}\n   date: ${c.publishedAt || "n/a"}\n   ${c.summary || ""}`.trim()
    )
    .join("\n\n");

  const system = `${RELEVANCE_RUBRIC}

You are the synthesis step. From the candidate items:
- CLUSTER stories about the same event into ONE finding; choose the SINGLE most useful link
  (most actionable detail — dates, eligibility, how to apply — whether that's a news outlet or
  the org's own page).
- LINK PREFERENCE: when the same event is covered by both a free and a hard-paywalled outlet
  (e.g. Houston Chronicle, Houston Business Journal), pick the FREE source for the link. If the
  ONLY coverage is paywalled, still surface it — it will be badged "behind paywall" for readers.
- Assign each finding a TOPICAL category (food, housing, utilities, health, mother_child,
  jobs_education, seasonal, disaster, news_policy, other).
- Fill org_name whenever an org is named. Use the CRG organization list below only to spell
  org_name accurately — you do NOT need to decide add-vs-update.
- Write CRG's OWN title and summary (never copy an outlet's headline/text verbatim).
- FAVOR RECALL on relevance: surface borderline-but-plausibly-useful items as findings with
  confidence 'low' rather than dropping them — a human reviews and dismisses. Only leave OUT true
  duplicates (already covered by a finding), items clearly unrelated to assistance, and items
  clearly OUTSIDE the 15 counties (another state/region with no Houston tie) — put those in
  also_considered.
- Put everything you leave out into also_considered (one line + reason each) so the human can
  audit for missed items.

CRG ORGANIZATIONS (for org_name matching):
${orgContext}`;

  const out = await callClaude(env, {
    model: SONNET_MODEL,
    maxTokens: 8000,
    tool: SONNET_TOOL,
    system,
    userText: `Synthesize findings from these ${survivors.length} candidate items:\n\n${list}`,
    // The one critical, expensive call of an unattended weekly job — be extra
    // patient through an Anthropic capacity dip (5 retries ≈ up to ~30s of
    // backoff) rather than crash the whole run over a transient 529.
    retries: 5,
  });
  console.log(`   sonnet returned ${out?.findings?.length ?? "null"} findings, ${out?.also_considered?.length ?? 0} also-considered`);
  return { findings: out?.findings || [], alsoConsidered: out?.also_considered || [] };
}

async function loadOrgContext(supabase) {
  const { data, error } = await supabase
    .from("organizations")
    .select("organization, org_parent");
  if (error) {
    console.log("⚠️ org context load failed:", error.message);
    return "(org list unavailable)";
  }
  const names = new Set();
  for (const r of data || []) {
    if (r.org_parent) names.add(r.org_parent.trim());
    if (r.organization) names.add(r.organization.trim());
  }
  return Array.from(names).sort().join("\n");
}

// ---- Possible-duplicate flagging (digest-only; never stored on the row) ----
// A story can reach us via different URLs on different runs — e.g. a direct
// outlet link one week, an opaque news.google.com redirect the next — so the
// URL-derived dedupe_key can't tell they're the same event and ON CONFLICT
// misses it. Rather than risk silently dropping a genuinely-new story (recall
// beats dedupe here — Omar's call), we FLAG a new finding that closely resembles
// a recent one. The flag lives ONLY in the digest email — NOT in `notes`, which
// is public (it renders on the /news page).
const DUP_STOPWORDS = new Set(
  "a an and the of for to in on with at by from as is are be or new amid could after over into".split(" ")
);
function titleTokens(t) {
  return new Set(
    (t || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !DUP_STOPWORDS.has(w))
  );
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
const DUP_TITLE_THRESHOLD = 0.5; // same category + this title overlap → flag

async function loadRecentFindings(supabase) {
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("scan_findings")
    .select("id, title, category, status, run_date")
    .gte("created_at", since);
  if (error) {
    console.log("⚠️ recent-findings load failed (dup-flagging skipped):", error.message);
    return [];
  }
  return data || [];
}

// Mutates each finding: sets `_dupOf` to the best-matching recent row (same
// category + title Jaccard ≥ threshold), if any. A false flag is cheap (an
// ignorable note); a false MERGE would lose a story — so we only ever annotate.
// Exported for unit testing.
export function annotateDuplicates(findings, recentRows) {
  const existing = recentRows.map((r) => ({ ...r, tokens: titleTokens(r.title) }));
  for (const f of findings) {
    const ftok = titleTokens(f.title);
    let best = null;
    let bestScore = 0;
    for (const e of existing) {
      if (e.category !== f.category) continue;
      const s = jaccard(ftok, e.tokens);
      if (s > bestScore) {
        bestScore = s;
        best = e;
      }
    }
    if (best && bestScore >= DUP_TITLE_THRESHOLD) {
      f._dupOf = { id: best.id, title: best.title, status: best.status, run_date: best.run_date };
    }
  }
}

function buildDigestHtml(findings, alsoConsidered, stats) {
  const CATEGORY_LABELS = {
    food: "Food",
    housing: "Housing, Rent & Eviction",
    utilities: "Utilities & Bill Help",
    health: "Health & Insurance",
    mother_child: "Mother & Child",
    jobs_education: "Jobs, Training & Education",
    seasonal: "Back-to-School & Seasonal",
    disaster: "Disaster Relief",
    news_policy: "News & Policy",
    other: "Other",
  };
  const byCat = {};
  for (const f of findings) (byCat[f.category] ||= []).push(f);

  let html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#222">`;
  html += `<h2 style="color:#B8001F">CRG Opportunity Scan — ${stats.runDate}</h2>`;
  const dupNote = stats.duplicatesSkipped
    ? ` <span style="color:#888">(${stats.duplicatesSkipped} more found this run were already in the system and skipped — not shown.)</span>`
    : "";
  const flagNote = stats.flaggedDupes
    ? ` <span style="color:#B8001F">${stats.flaggedDupes} flagged below as a possible duplicate (⚠) — check before publishing.</span>`
    : "";
  html += `<p><strong>${findings.length}</strong> new finding(s) await review.${dupNote}${flagNote} Approve on the Admin Review page (or in Supabase <code>scan_findings</code> for now): flip <code>status</code> to <code>published</code>, optionally attach <code>directory_id_no</code> and adjust <code>expires_at</code>.</p>`;

  if (findings.length === 0) {
    html += `<p style="color:#666">No new findings this run${stats.duplicatesSkipped ? " (everything found was already in the system)" : ""}.</p>`;
  }
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    const items = byCat[cat];
    if (!items || items.length === 0) continue;
    html += `<h3 style="color:#4A4F56;border-bottom:1px solid #ccc;padding-bottom:4px">${CATEGORY_LABELS[cat]}</h3>`;
    for (const f of items) {
      html += `<div style="margin:0 0 16px">`;
      html += `<div style="font-weight:bold;font-size:15px">${escapeHtml(f.title)}</div>`;
      if (f._dupOf) {
        html += `<div style="font-size:12px;color:#B8001F;font-weight:bold">⚠ Possible duplicate of #${f._dupOf.id} "${escapeHtml(f._dupOf.title)}" (${escapeHtml(f._dupOf.status)}${f._dupOf.run_date ? " · " + escapeHtml(f._dupOf.run_date) : ""}) — dismiss if the same story.</div>`;
      }
      html += `<div style="margin:2px 0">${escapeHtml(f.summary)}</div>`;
      const meta = [];
      if (f.eligibility) meta.push(`<em>Eligibility:</em> ${escapeHtml(f.eligibility)}`);
      if (f.deadline) meta.push(`<em>Deadline:</em> ${escapeHtml(f.deadline)}`);
      if (f.county) meta.push(`<em>County:</em> ${escapeHtml(f.county)}`);
      if (f.org_name) meta.push(`<em>Org:</em> ${escapeHtml(f.org_name)}`);
      if (meta.length) html += `<div style="font-size:13px;color:#555">${meta.join(" &nbsp;·&nbsp; ")}</div>`;
      const paywall = isPaywalledSource(f.source) ? ` <span style="color:#B8001F">🔒 behind paywall</span>` : "";
      html += `<div style="font-size:13px">${escapeHtml(f.confidence || "")} · <a href="${encodeURI(f.source_url || "#")}">${escapeHtml(f.source || "source")}</a>${paywall}</div>`;
      html += `</div>`;
    }
  }

  // Audit list — what the scan saw but did NOT surface (email only, early-trust aid)
  if (alsoConsidered && alsoConsidered.length) {
    html += `<h3 style="color:#4A4F56;border-bottom:1px solid #ccc;padding-bottom:4px">Also considered — not surfaced (audit for anything missed)</h3><ul style="font-size:13px;color:#555">`;
    for (const a of alsoConsidered) {
      const link = a.source_url ? ` — <a href="${encodeURI(a.source_url)}">${escapeHtml(a.source || "link")}</a>` : "";
      html += `<li>${escapeHtml(a.title)} <em>(${escapeHtml(a.reason || "")})</em>${link}</li>`;
    }
    html += `</ul>`;
  }

  // Source scorecard for the manual feedback loop
  html += `<h3 style="color:#4A4F56;border-bottom:1px solid #ccc;padding-bottom:4px">Source scorecard</h3><ul style="font-size:13px;color:#555">`;
  for (const [src, n] of Object.entries(stats.perSourceCandidates).sort((a, b) => b[1] - a[1])) {
    const kept = stats.perSourceKept[src] || 0;
    html += `<li>${escapeHtml(src)}: ${n} candidate(s), ${kept} kept</li>`;
  }
  html += `</ul>`;
  html += `<p style="font-size:12px;color:#888">Candidates ${stats.candidates} → relevant ${stats.relevant} → found ${stats.found ?? findings.length} → new ${findings.length}${stats.duplicatesSkipped ? ` (${stats.duplicatesSkipped} already in system)` : ""}.</p>`;
  html += `</div>`;
  return html;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendDigest(env, html, runDate) {
  const recipient = env.SCAN_DIGEST_RECIPIENT || "operacha@sbcglobal.net";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: DIGEST_FROM,
      to: recipient,
      subject: `CRG Opportunity Scan — ${runDate}`,
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Resend error: ${data.message || res.status}`);
  return data.id;
}

// ---- Entry point ----

// The scan pipeline. Transport-free: the caller (scripts/run-scan.mjs) loads env,
// builds the Supabase client, and picks runDate/expiresDate. Returns a plain
// result object; throws on failure so the caller can email a crash notice.
export async function runScan({ env, supabase, runDate, expiresDate, dryRun }) {
  // 1-2. Poll + window + dedupe + cap
  const raw = await pollAllSources();
  const windowed = withinDays(raw, WINDOW_DAYS);
  const candidates = dedupeByLink(windowed).slice(0, MAX_CANDIDATES);
  console.log(`🧮 raw ${raw.length} → windowed ${windowed.length} → candidates ${candidates.length}`);

  const perSourceCandidates = tally(candidates.map((c) => c.source));

  // 3. Haiku relevance cull
  const survivors = await haikuFilter(env, candidates);
  const perSourceKept = tally(survivors.map((c) => c.source));
  console.log(`🎯 survivors ${survivors.length}`);

  // 4. Sonnet synthesis (with cached CRG org context)
  const orgContext = await loadOrgContext(supabase);
  const { findings, alsoConsidered } = await sonnetSynthesize(env, survivors, orgContext);
  console.log(`✅ findings ${findings.length}, also-considered ${alsoConsidered.length}`);

  // Load recent findings (BEFORE this run's insert, so no self-match) for the
  // possible-duplicate flag — catches same-story-different-URL cases the URL
  // dedupe_key can't. Digest-only; never written to the row.
  const recentRows = await loadRecentFindings(supabase);

  const stats = {
    runDate,
    candidates: candidates.length,
    relevant: survivors.length,
    perSourceCandidates,
    perSourceKept,
  };

  if (dryRun) {
    return { ok: true, dryRun: true, stats, findings, alsoConsidered };
  }

  // 5. Insert (dedupe on dedupe_key). expiresDate is the coming Sunday (set by
  //    run-scan.mjs; editable per-story at review).
  //    Findings whose dedupe_key already exists (a prior run within the 14-day
  //    window) are blocked and return NOTHING from .select(), so the returned
  //    keys are exactly the genuinely-new findings this run.
  let inserted = 0;
  let newFindings = findings;
  if (findings.length) {
    const rows = findings.map((f) => ({
      run_date: runDate,
      source: f.source || null,
      source_url: f.source_url || null,
      dedupe_key: dedupeKeyFor(f),
      category: f.category,
      title: f.title,
      summary: f.summary,
      eligibility: f.eligibility || null,
      deadline: f.deadline || null,
      county: f.county || null,
      org_name: f.org_name || null,
      confidence: f.confidence || null,
      status: "new",
      expires_at: expiresDate,
    }));
    const { data, error } = await supabase
      .from("scan_findings")
      .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("dedupe_key");
    if (error) throw new Error(`Insert failed: ${error.message}`);
    inserted = data?.length || 0;
    const insertedKeys = new Set((data || []).map((r) => r.dedupe_key));
    // The digest must mirror the /admin review queue: only findings actually
    // inserted as status='new'. Anything blocked as a duplicate was already
    // reviewed (or is already queued), so re-showing it in the email is noise.
    newFindings = findings.filter((f) => insertedKeys.has(dedupeKeyFor(f)));
  }
  const duplicatesSkipped = findings.length - newFindings.length;

  // Flag (don't drop) new findings that resemble a recent one but slipped past
  // the URL dedupe_key (e.g. a Google News redirect this week vs a direct outlet
  // link last week). Sets `_dupOf` on the finding — surfaced in the digest ONLY.
  annotateDuplicates(newFindings, recentRows);
  const flaggedDupes = newFindings.filter((f) => f._dupOf).length;
  console.log(`🔁 flagged ${flaggedDupes} possible duplicate(s) of recent findings`);

  // 6. Digest email — NEW findings only (what actually needs review this run).
  const digestStats = { ...stats, found: findings.length, duplicatesSkipped, flaggedDupes };
  const html = buildDigestHtml(newFindings, alsoConsidered, digestStats);
  let emailId = null;
  if (env.RESEND_API_KEY) emailId = await sendDigest(env, html, runDate);

  return { ok: true, stats, found: findings.length, inserted, duplicatesSkipped, flaggedDupes, emailId };
}

function tally(arr) {
  const m = {};
  for (const x of arr) m[x] = (m[x] || 0) + 1;
  return m;
}
