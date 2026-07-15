# CRG Opportunity Scan — Curated News Source List (DRAFT for review)

Draft compiled 2026-07-14/15. Every feed marked **WORKING** was actually fetched and returned
valid RSS/Atom XML with items dated within the last day or two. This is the "wide net" to eyeball
before any scan code is written — tell me what to keep, drop, or add.

## The 15 counties (confirm this list)

Greater Houston / H-GAC region, ranked by CRG org density (from `docs/org-scan-reference.csv`):

**Core (95% of CRG orgs):** Harris · Fort Bend · Montgomery · Galveston · Brazoria · Waller · Austin · Walker
**Outer:** Chambers · Colorado · Liberty · Matagorda · Wharton · Brazos · Grimes

> **CONFIRMED 2026-07-15** (from the app's landing panel): 13 Texas Gulf Coast (H-GAC) counties —
> Austin, Brazoria, Chambers, Colorado, Fort Bend, Galveston, Harris, Liberty, Matagorda,
> Montgomery, Walker, Waller, Wharton — **plus 2 Brazos Valley counties: Brazos and Grimes.**
> (My earlier San Jacinto guess was wrong — it is NOT one of the 15.)

## How the three tiers work together

- **Tier 3 (Google News RSS + GDELT) is the workhorse** — deterministic keyword queries that
  already index virtually every outlet below, including the paywalled/blocked ones and the outer
  counties that have no clean feed. If we only had Tier 3, we'd still have broad coverage.
- **Tiers 1 & 2 (direct outlet feeds) are the speed/reliability bonus** — faster, cleaner, and
  they catch local items a keyword query might miss. They're additive, not load-bearing.

---

## Tier 1 — High-signal metro (VERIFIED unless noted)

| Outlet | Coverage | RSS URL | Status |
|--------|----------|---------|--------|
| ABC13 / KTRK | Houston metro (ABC) | `https://abc13.com/feed/` | **WORKING** |
| KPRC 2 / Click2Houston | Houston metro (NBC) | `https://www.click2houston.com/arc/outboundfeeds/rss/category/news/?outputType=xml` | **WORKING** |
| FOX 26 / KRIV | Houston metro (Fox) | `https://www.fox26houston.com/rss/category/news` | **WORKING** |
| Houston Public Media / News 88.7 | Houston NPR/PBS | `https://www.houstonpublicmedia.org/feed/` | **WORKING** ⚠️ needs browser User-Agent (403s the default UA) |
| Texas Tribune | Statewide + Houston | `https://feeds.texastribune.org/feeds/main/` | **WORKING** (301 from the `www.` host; no Houston-only tag feed — filter the main feed) |
| Texas Standard | Statewide public radio (benefits/policy) | `https://texasstandard.org/feed/` | **WORKING** |
| Houston Defender | Black community news | `https://www.defendernetwork.com/feed/` | **WORKING** |
| Telemundo Houston (KTMD) | **Spanish** — immigration/health/enforcement | `https://www.telemundohouston.com/?rss=y` | **WORKING** (highest-signal Spanish source) |
| KHOU 11 | Houston metro (CBS) | `https://www.khou.com/feeds/syndication/rss/news/local` | **UNVERIFIED** (free) — host timed out on every attempt; standard Tegna path, validate from a normal reader |

> **Dropped (paywalled → dead-end links):** Houston Chronicle (`chron.com`) and Houston Business
> Journal (`bizjournals.com`). Their RSS shows only headlines behind a paywall, so a user clicking
> through hits a wall. Excluded by decision 2026-07-15. Google News RSS still surfaces their
> stories when another outlet also covers the item.

## Tier 2 — Suburban / county (outer-county coverage)

Most of these run on the **BLOX / TownNews** platform (Southern Newspapers Inc / CNHI). Verified
RSS pattern: `<domain>/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc`. The RSS
(headlines + summaries) is public even where article pages are paywalled. Their shared WAF
throttles rapid automated hits (429) — **fetch politely and cache**; a weekly poll is fine.

| Outlet | County | RSS URL | Status |
|--------|--------|---------|--------|
| **Community Impact** | all 15 (hyperlocal) | `https://communityimpact.com/rss/` | **WORKING** — ⚠️ ONE global feed only; per-edition feeds don't exist (all 404). Ingest global, filter by city/keyword ourselves |
| Galveston County Daily News | Galveston | `https://www.galvnews.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` | **WORKING** |
| Huntsville Item | Walker | `https://www.itemonline.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` | **WORKING** (domain is `itemonline.com`) |
| The Facts (Brazosport) | Brazoria | `https://www.thefacts.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` | **LIKELY** (BLOX pattern; WAF-throttled during test) |
| Fort Bend Herald | Fort Bend | `https://www.fbherald.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` | **LIKELY** (BLOX; throttled) |
| Bay City Tribune | Matagorda | `https://baycitytribune.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` | **LIKELY** (BLOX; throttled) — your only Matagorda paper |
| Baytown Sun | Chambers (+ E. Harris) | `https://baytownsun.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` | **LIKELY** (BLOX; throttled) — closest Chambers coverage |
| ¡Que Onda Magazine! | **Spanish** — Houston Hispanic | `https://queondamagazine.com/feed/` | **WORKING** (use non-`www` host) |

**County coverage gaps — no dedicated feed wired in (by decision, keep it simple):** Waller,
Austin, Colorado, Liberty, Brazos, Grimes, Wharton. These lean on Community Impact's global feed +
Tier 3 (Google News RSS / GDELT) keyword coverage — **no per-county feeds added**, per Omar (these
counties see very few searches, so simplest wins). *(If ever wanted later: Brazos has **The Eagle**,
Bryan–College Station, on the same BLOX pattern; Grimes/Wharton have no usable feed.)*

## Tier 3 — Query backbone (the workhorse; deterministic, no per-feed maintenance)

### Google News RSS (VERIFIED live)

Template — any search becomes RSS:
```
https://news.google.com/rss/search?q=<URL-ENCODED-QUERY>&hl=en-US&gl=US&ceid=US:en
```
Supports the `when:14d` recency operator, quotes, and `OR`. Verified example (returned live
July-2026 items):
`https://news.google.com/rss/search?q=%22rental+assistance%22+Houston+when:14d&hl=en-US&gl=US&ceid=US:en`

Starter query set (raw `q` strings — the scan URL-encodes each):

*Assistance windows / basic needs*
1. `"rental assistance" Houston when:14d`
2. `"utility assistance" OR "utility bill help" Houston when:14d`
3. `"rent relief" OR "rental help" Houston when:14d`
4. `"food distribution" OR "food pantry" Houston when:14d`
5. `eviction OR "eviction assistance" OR "eviction diversion" Houston when:14d`
6. `LIHEAP OR CEAP Houston when:14d`
7. `SNAP OR Medicaid OR CHIP enrollment Houston when:14d`
8. `"back to school" supplies distribution Houston when:14d`
9. `"holiday assistance" OR "Angel Tree" OR "Toys for Tots" Houston when:14d`
10. `"diaper bank" OR "baby supplies" Houston when:14d`
11. `"free clinic" OR "pop-up clinic" OR "mobile health" Houston when:14d`
12. `CenterPoint OR Reliant bill assistance Houston when:14d`
13. `"back to school" OR "school supplies" Houston free when:14d`

*Evictions / homelessness — PRIORITY THEME (Houston's trend is toward easier evictions; tightly tied to rental assistance)*
- `eviction OR "eviction diversion" OR "writ of possession" Houston OR "Harris County" when:14d`
- `homelessness OR "homeless shelter" OR "homeless services" funding Houston when:14d`
- `"rental assistance" OR "emergency rental" OR "housing voucher" Houston when:14d`

*Org status changes*
14. `Houston nonprofit closing OR "shuts down" OR relocating when:14d`
15. `Houston charity "permanently closed" OR "suspends program" when:14d`

*Low-barrier opportunities*
16. `Houston "paid internship" "no experience" when:14d`
17. `Houston free "job training" OR apprenticeship low-income when:14d`

*Outer-county geography*
18. `"Fort Bend County" assistance OR aid when:14d`
19. `"Montgomery County" Texas assistance program when:14d`
20. `"Galveston County" OR "Brazoria County" assistance when:14d`
21. `"Waller County" OR "Liberty County" assistance when:14d`

### GDELT DOC 2.0 API (free catch-all, no key)

Template:
```
https://api.gdeltproject.org/api/v2/doc/doc?query=<QUERY>&mode=ArtList&format=rss&timespan=14d&sort=DateDesc
```
Example:
`https://api.gdeltproject.org/api/v2/doc/doc?query=(%22rental%20assistance%22%20OR%20%22utility%20assistance%22%20OR%20%22food%20distribution%22)%20Houston&mode=ArtList&format=rss&timespan=14d&sort=DateDesc`

> Status: the DOC 2.0 endpoint is standard and free; my live test returned HTTP 429 (rate-limit —
> GDELT throttles bursts). Poll it once per run with a backoff and it's reliable. Good as a
> redundancy layer behind Google News RSS, not the primary.

---

## Excluded — do NOT wire in (verified dead / no feed)

| Outlet | Why excluded |
|--------|--------------|
| **Houston Landing** | **Ceased operations May 15, 2025** (funding ran out, all 43 staff laid off). Gone. |
| Univision Houston (KXLN) | SPA site, no RSS endpoint (all feed paths 404). |
| La Voz de Houston (Chronicle) | Hearst BLOX, no working feed; the HPM `la-voz` tag feed is stale to 2016. |
| United Way Greater Houston | `/feed/` returns HTTP 500; no working feed path. |
| Understanding Houston | SPA, returns HTML not XML. |
| Houston in Action | Feed exists but only 2019 placeholder posts. |
| Wharton Journal-Spectator | PDF-only digital edition, no RSS. |

## Engineering caveats to carry into the build

1. **User-Agent:** several feeds (Houston Public Media, some BLOX sites) 403/429 the default
   fetcher UA but serve fine to a normal browser UA. The scan must send a realistic
   `User-Agent` header.
2. **BLOX WAF throttling:** Southern Newspapers Inc sites share a WAF that 429s rapid hits. Fetch
   sequentially with a small delay + cache; a weekly cadence is well within tolerance.
3. **Community Impact = one global feed**, not per-edition — filter for our cities/counties
   ourselves. Same for Texas Tribune / Texas Standard (statewide → filter for the 15 counties).
4. **Two reusable platform patterns** (lets us add sibling papers without re-verifying):
   - ABC O&O TV: `https://<station>.com/feed/`
   - BLOX / TownNews / CNHI: `<domain>/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc`

## Decisions (resolved 2026-07-15)

- **15 counties confirmed** — 13 Gulf Coast (H-GAC) + **Brazos & Grimes** (Brazos Valley); see top.
  San Jacinto is NOT one of them.
- **Paywalled feeds DROPPED** — Houston Chronicle + Houston Business Journal removed (headlines
  behind a paywall = dead-end links for users).
- **Spanish = sufficient** — Telemundo Houston + Que Onda; no further hunting.
- **Rural counties = keyword net only** — no per-county Google Alerts/dedicated feeds; Community
  Impact + Google News RSS cover them. These counties see very few searches, so simplest wins.

**Still needs a real-reader validation pass (free, just fetch-blocked in testing):** KHOU 11, and
the throttled BLOX papers (The Facts, Fort Bend Herald, Bay City Tribune, Baytown Sun). Not
blockers — the scan will simply skip a feed that errors and lean on the keyword net.
