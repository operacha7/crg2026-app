// functions/_lib/rss.js
// Minimal, dependency-free RSS 2.0 / Atom fetcher + parser for the Opportunity
// Scan. Feeds we poll are simple; a tolerant regex parser is lighter than
// pulling in an XML library and is enough to extract title/link/date/summary.

// A realistic browser UA — several feeds (Houston Public Media, BLOX papers)
// 403/429 the default fetcher UA but serve fine to a normal browser.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Pull the text content of the first <tag>…</tag> within a block.
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return decodeEntities(stripCdata(m[1]))
    .replace(/<[^>]+>/g, " ") // drop any nested HTML (summaries)
    .replace(/\s+/g, " ")
    .trim();
}

// Atom links live in an attribute: <link href="…"/> (prefer rel="alternate").
function atomLink(block) {
  const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (alt) return alt[1];
  const any = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return any ? any[1] : "";
}

function toIso(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Parse raw feed XML into normalized items:
 *   { source, title, link, publishedAt (ISO|null), summary }
 * Handles RSS <item> and Atom <entry>.
 */
export function parseFeed(xml, sourceName) {
  if (!xml || typeof xml !== "string") return [];
  const items = [];

  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blockRe = isAtom
    ? /<entry[\s>][\s\S]*?<\/entry>/gi
    : /<item[\s>][\s\S]*?<\/item>/gi;

  const blocks = xml.match(blockRe) || [];
  for (const block of blocks) {
    const title = tag(block, "title");
    const link = isAtom ? atomLink(block) : tag(block, "link");
    const dateRaw = isAtom
      ? tag(block, "updated") || tag(block, "published")
      : tag(block, "pubDate") || tag(block, "dc:date");
    const summary = isAtom
      ? tag(block, "summary") || tag(block, "content")
      : tag(block, "description");

    if (!title && !link) continue;
    items.push({
      source: sourceName,
      title,
      link,
      publishedAt: toIso(dateRaw),
      summary: (summary || "").slice(0, 800),
    });
  }
  return items;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Statuses worth a retry: the origin is throttling or briefly unavailable, not
// refusing us. Google News answers 503 when it dislikes our request rate.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * Fetch one feed and return normalized items. Never throws — on any error
 * (timeout, 403/429, malformed) it logs and returns [], so one bad feed can't
 * sink a run. Retries throttling responses with exponential backoff + jitter.
 *
 * CRITICAL — every response body MUST be read or explicitly cancelled, even on
 * an error status. An unread body stays in-flight and holds one of the runtime's
 * limited concurrent-connection slots forever; enough of them and every later
 * fetch queues until its abort timer fires. That deadlock made a full production
 * run return ZERO items from all 43 feeds while local dev looked fine (local
 * never got the 503s that triggered it). Do not "simplify" the cancel() away.
 */
export async function pollFeed(feed, { timeoutMs = 12000, retries = 2 } = {}) {
  const label = feed.source || feed.name;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let retryAfterMs = null;

    try {
      const res = await fetch(feed.url, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        // Release the connection slot before doing anything else.
        await res.body?.cancel().catch(() => {});
        if (RETRYABLE.has(res.status) && attempt < retries) {
          retryAfterMs = 500 * 2 ** attempt + Math.floor(Math.random() * 400);
        } else {
          console.log(`⚠️ ${label}: HTTP ${res.status}`);
          return [];
        }
      } else {
        const xml = await res.text();
        const items = parseFeed(xml, label);
        console.log(`📥 ${label}: ${items.length} items`);
        return items;
      }
    } catch (err) {
      console.log(`⚠️ ${label}: ${err.name || "error"} ${err.message || ""}`.trim());
      return [];
    } finally {
      clearTimeout(timer);
    }

    // Only reached when a retryable status was seen (backoff outside the timer).
    console.log(`↻ ${label}: retrying after ${retryAfterMs}ms`);
    await sleep(retryAfterMs);
  }
}

/** Keep only items published within the last `days` (undated items are kept). */
export function withinDays(items, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter(
    (it) => !it.publishedAt || Date.parse(it.publishedAt) >= cutoff
  );
}

/** De-duplicate a candidate list by normalized link (cheap pre-LLM pass). */
export function dedupeByLink(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = (it.link || it.title || "").split("?")[0].replace(/\/+$/, "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}
