// functions/_lib/scan-sources.js
// Curated news-source list + relevance rubric for the Opportunity Scan.
// This is the "config Claude maintains" — edit here to add/drop sources or
// tune the rubric as we learn what's useful (no DB migration needed).
//
// Provenance & verification notes live in docs/scan-sources-draft.md.
// Every DIRECT_FEED marked verified:true was actually fetched and returned
// valid RSS with recent items during curation (2026-07-15).

// The 15 counties CRG serves (13 Texas Gulf Coast / H-GAC + 2 Brazos Valley).
export const COUNTIES = [
  "Harris", "Fort Bend", "Montgomery", "Galveston", "Brazoria", "Waller",
  "Austin", "Walker", "Chambers", "Colorado", "Liberty", "Matagorda",
  "Wharton", "Brazos", "Grimes",
];

// Direct outlet feeds (Tiers 1 & 2). `filterToRegion:true` marks statewide /
// national-mix feeds whose items must be filtered down to our counties by the
// relevance pass. `needsBrowserUA:true` feeds 403 the default fetcher UA.
// `verified:false` = correct-by-convention URL that was fetch-blocked during
// curation; left enabled so it works from Cloudflare, and simply skipped if it
// errors. Paywalled outlets (Chronicle, HBJ) and defunct ones (Houston Landing)
// are intentionally excluded — see the draft doc.
export const DIRECT_FEEDS = [
  // ---- Tier 1: high-signal metro ----
  { name: "ABC13 / KTRK", url: "https://abc13.com/feed/", verified: true },
  { name: "KPRC 2 / Click2Houston", url: "https://www.click2houston.com/arc/outboundfeeds/rss/category/news/?outputType=xml", verified: true },
  { name: "FOX 26 / KRIV", url: "https://www.fox26houston.com/rss/category/news", verified: true },
  { name: "Houston Public Media", url: "https://www.houstonpublicmedia.org/feed/", verified: true, needsBrowserUA: true },
  { name: "Texas Tribune", url: "https://feeds.texastribune.org/feeds/main/", verified: true, filterToRegion: true },
  { name: "Texas Standard", url: "https://texasstandard.org/feed/", verified: true, filterToRegion: true },
  { name: "Houston Defender", url: "https://www.defendernetwork.com/feed/", verified: true },
  { name: "Telemundo Houston", url: "https://www.telemundohouston.com/?rss=y", verified: true, lang: "es" },
  { name: "KHOU 11", url: "https://www.khou.com/feeds/syndication/rss/news/local", verified: false },

  // ---- Tier 2: suburban / county (BLOX papers cover the outer counties) ----
  { name: "Community Impact", url: "https://communityimpact.com/rss/", verified: true, filterToRegion: true },
  { name: "Galveston County Daily News", url: "https://www.galvnews.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc", verified: true },
  { name: "Huntsville Item", url: "https://www.itemonline.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc", verified: true },
  { name: "The Facts (Brazosport)", url: "https://www.thefacts.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc", verified: false },
  { name: "Fort Bend Herald", url: "https://www.fbherald.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc", verified: false },
  { name: "Bay City Tribune", url: "https://baycitytribune.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc", verified: false },
  { name: "Baytown Sun", url: "https://baytownsun.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc", verified: false },
  { name: "¡Que Onda Magazine!", url: "https://queondamagazine.com/feed/", verified: true, lang: "es" },
];

// Tier 3a — Google News RSS query backbone (the workhorse; indexes ~every
// outlet incl. paywalled/rural). Raw `q` strings — googleNewsRssUrl() encodes
// them. Keep the `when:` recency operator so each run only sees fresh items.
export const GOOGLE_NEWS_QUERIES = [
  // assistance windows / basic needs
  `"rental assistance" Houston when:14d`,
  `"utility assistance" OR "utility bill help" Houston when:14d`,
  `"rent relief" OR "rental help" Houston when:14d`,
  `"food distribution" OR "food pantry" Houston when:14d`,
  `eviction OR "eviction assistance" OR "eviction diversion" Houston when:14d`,
  `LIHEAP OR CEAP Houston when:14d`,
  `SNAP OR Medicaid OR CHIP enrollment Houston when:14d`,
  `"back to school" supplies distribution Houston when:14d`,
  `"holiday assistance" OR "Angel Tree" OR "Toys for Tots" Houston when:14d`,
  `"diaper bank" OR "baby supplies" Houston when:14d`,
  `"free clinic" OR "pop-up clinic" OR "mobile health" Houston when:14d`,
  `CenterPoint OR Reliant bill assistance Houston when:14d`,
  // PRIORITY THEME — evictions & homelessness (tied to rental assistance)
  `eviction OR "eviction diversion" OR "writ of possession" Houston OR "Harris County" when:14d`,
  `homelessness OR "homeless shelter" OR "homeless services" funding Houston when:14d`,
  `"rental assistance" OR "emergency rental" OR "housing voucher" Houston when:14d`,
  // org status changes
  `Houston nonprofit closing OR "shuts down" OR relocating when:14d`,
  `Houston charity "permanently closed" OR "suspends program" when:14d`,
  // low-barrier opportunities
  `Houston "paid internship" "no experience" when:14d`,
  `Houston free "job training" OR apprenticeship low-income when:14d`,
  // outer-county geography
  `"Fort Bend County" assistance OR aid when:14d`,
  `"Montgomery County" Texas assistance program when:14d`,
  `"Galveston County" OR "Brazoria County" assistance when:14d`,
  `"Waller County" OR "Liberty County" assistance when:14d`,
];

// Tier 3b — GDELT DOC 2.0 (free, no key; redundancy behind Google News).
export const GDELT_QUERIES = [
  `(\"rental assistance\" OR \"utility assistance\" OR \"food distribution\" OR eviction OR homelessness) Houston`,
];

// Outlets behind a hard paywall. We still SURFACE their stories (some readers
// have subscriptions or workarounds) but badge them "behind paywall" in the
// digest and News feed. Matched loosely against the finding's `source` name.
export const PAYWALLED_SOURCE_TOKENS = ["chronicle", "chron.com", "bizjournals", "business journal"];
export function isPaywalledSource(source) {
  const s = (source || "").toLowerCase();
  return PAYWALLED_SOURCE_TOKENS.some((t) => s.includes(t));
}

export function googleNewsRssUrl(q) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
}

export function gdeltRssUrl(q) {
  return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=ArtList&format=rss&timespan=14d&sort=DateDesc`;
}

// Default feed lifespan (unpinned items are "fresh" for this many days).
export const FRESHNESS_DAYS = 7;

// The relevance rubric — injected into the Haiku first-pass and the Sonnet
// synthesis. Tune this as the feedback loop teaches us what matters.
export const RELEVANCE_RUBRIC = `You are triaging local news for the Community Resources Guide (CRG) Houston, which helps caseworkers connect low-income clients to assistance across 15 Southeast Texas counties (${COUNTIES.join(", ")}).

INCLUDE items a caseworker could act on for a low-income client:
- Assistance application windows opening/closing (rental, utility/LIHEAP-CEAP, rent relief).
- Food/supply distributions, pop-up/mobile clinics, back-to-school and holiday assistance signups.
- Benefits enrollment windows (SNAP, Medicaid, CHIP, Marketplace).
- Pregnancy, childbirth, infant and new-mother support: prenatal care, pregnancy centers, diaper
  banks, baby supplies, formula, childcare assistance.
- New or temporary aid programs/resources; disaster-relief resources after storms/floods/heat.
- Nonprofit/charity closures, relocations, suspended programs, changed eligibility or hours.
- Low-barrier opportunities open to the people CRG serves: no/low-experience or free/paid job
  training, apprenticeships, internships, scholarships for low-income applicants.
- PRIORITY THEME — evictions & homelessness: eviction news, eviction-diversion programs, and
  homeless-services / shelter funding (tightly tied to rental assistance; treat as high value).

EXCLUDE:
- Routine hiring with experience/education prerequisites; internal org operations; galas/fundraisers.
- Ordinary business, sports, crime, weather, or political news with no assistance angle.
- Anything outside the 15 counties, UNLESS it is a statewide/national program open to Houston-area
  residents.

WHEN UNCERTAIN whether an in-area item is relevant enough, INCLUDE it (mark confidence low) — a
human reviews everything, so a borderline keep beats a miss. Favor recall over precision ON RELEVANCE.

GEOGRAPHY IS A HARD GATE (do NOT "include when uncertain" here): the story must concern the 15
counties / Houston-area residents, or be a statewide/national program open to them. EXCLUDE anything
clearly about another state, city, or region with no Houston-area connection (e.g. a homeless shelter
in South Carolina) no matter how on-topic it is.`;
