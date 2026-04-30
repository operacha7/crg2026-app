# CRG Houston — SEO Phase 1 Handoff Plan (Updated)

**For:** Claude Code
**Project:** crghouston.operacha.org
**Stack:** Vite + JavaScript + Supabase, deployed on Cloudflare Pages
**Last updated:** April 2026
**Scope:** Phase 1 — Foundation work only. Full SEO content architecture is intentionally deferred (see "Highest-leverage deferred item" section).
**Rollout note:** Omar plans to ship next week. Organization administrators will be given a heads-up and an in-app announcement will warn users of the upcoming changes before deploy.

---

## Why this work, in one paragraph

The site is currently invisible in Google search. Search Console shows 1 indexed page, 0 internal links, and only 4 search clicks in 3 months — both clicks were navigational queries for organization names that happened to appear in a decorative scrolling list on the homepage. The root causes: (1) the homepage presents as a login screen rather than a community resource directory, so Google's relevance algorithms don't associate it with client-facing queries; (2) the site has only ~3-5 indexable URLs total because filter-states inside the app don't have URLs; (3) zero internal links means Google has no signal about site structure or page authority. The on-page SEO basics (title tags, meta descriptions, JSON-LD structured data, OpenGraph/Twitter Cards, canonical URLs, geo tags) are already well-implemented in `index.html` and should be preserved as the model for new pages. Phase 1 fixes the most visible problems and creates the URL routing primitive (`/assistance/[slug]`) that future SEO work will build on.

---

## Goals & non-goals for Phase 1

**Goals**

- Move from 1 indexed page to ~20–40 indexed pages
- Make the homepage understandable to Google as a community resource directory
- Add About page (E-E-A-T trust signal)
- Establish URL routing pattern for assistance types (`/assistance/[slug]`)
- Eliminate the "0 internal links" problem
- Establish a single consistent footer across all pages (homepage and in-app)
- Preserve Omar's app UX exactly — no editorial content added

**Explicitly NOT in scope (deferred to Phase 2)**

- Per-zip-code landing pages (`/zip/[code]`)
- Zip × assistance cross-product pages (`/assistance/[slug]/[zip]`)
- Per-organization resource detail pages (`/resource/[slug]`)
- Editorial / explanatory content on landing pages
- Backlink acquisition strategy

---

## Current data scope (use these everywhere)

These numbers should be consistent across the homepage tagline, the About page, and the JSON-LD blocks in `index.html`:

- **1,000+ resources** (each resource = one organization × one assistance type; one organization can appear as multiple resources)
- **526 organizations**
- **30 assistance types** organized in **6 groups**
- **284 zip codes**
- **136 cities**
- **14 counties**
- Serving the Greater Houston Area since 2008

---

## Implementation work

### 1. Homepage redesign

Replace the current login-form-as-homepage with a client-first layout. Preserve the artwork background. The login flow moves entirely to the footer.

**Final design** (Omar's Figma is the source of truth; this section captures the spec for Claude Code):

**Layout (desktop)**

```

┌────────────────────────────────────────────────────────────────────────┐
│ [Logo] CRG Houston                                              About  │  ← top header (dark)
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   [Background artwork — left ~65% of viewport]                         │
│                                              ┌──────────────────────┐  │
│                                              │ Free help across     │  │
│                                              │ Greater Houston      │  │
│                                              │ Quickly search ...   │  │
│                                              │ Select Your Zip Code │  │
│                                              │ ┌──────────────────┐ │  │
│                                              │ │ Choose Assistance│ │  │
│                                              │ │ [chips in groups]│ │  │
│                                              │ └──────────────────┘ │  │
│                                              └──────────────────────┘  │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  About · Privacy Policy · Terms of Service · Contact Support · Organization Log-in │  ← secondary footer
├────────────────────────────────────────────────────────────────────────┤
│ 🇺🇸 © 2026 O Peracha. All Rights Reserved. Icons by icons8.com         │  ← copyright footer (red)
└────────────────────────────────────────────────────────────────────────┘
```

**Specific elements**

- **Top header (dark navy, slim):** Logo + "Community Resources Guide Houston" wordmark on left. Single "About" button in top-right corner — neutral cream/beige pill button. No Login button in header.
- **Hero panel (cream/beige rounded panel, right side of viewport over artwork):**
  - **H1:** `Free help across Greater Houston` — dark red / maroon color
  - **Tagline:** `Quickly search through 1000+ resources to find help in your area. Select a zip code and assistance type from below.` — with `zip code` and `assistance` highlighted in red as inline emphasis
  - **Zip code dropdown:** labeled "Select Your Zip Code" with empty state by default. Standard `<select>` element.
  - **Choose Assistance section:** white background nested inside the cream panel, with rounded corners. Heading text "Choose Assistance" in red.
- **Chips:** all 30 assistance types visible, organized by the 6 groups, each chip is a real `<a>` tag (see implementation note below). Group color coding matches the existing in-app modal (yellow / purple / pink / light green / light blue / cream-tan). The four chips in Group 1 (Rent, Utilities, Food, Clothing) are rendered LARGER than the rest to emphasize they are the most-requested types. Larger spacing between groups creates visual separation; group labels are intentionally NOT included.
- **Secondary footer (dark, above copyright):** five links: `About · Privacy Policy · Terms of Service · Contact Support · Organization Log-in`. Plain text link styling.
- **Copyright footer (red, bottom):** unchanged from current — flag emoji, copyright line, icons8 attribution.

**Layout (mobile)**

To be mocked separately, but the documented plan is:
- Top-right "About" replaced by a hamburger icon
- Hamburger menu contains: About, Privacy Policy, Terms of Service, Contact Support, Organization Log-in
- Artwork compresses to a banner at the top
- Hero panel takes full width below
- Chip groups stack vertically with the same group spacing pattern
- Copyright footer remains visible at the bottom

**Critical implementation detail: every chip must be a real `<a>` tag, not a `<button>` with a JS handler.**

```html
<!-- DO -->
<a href="/assistance/rent" class="chip chip--group-1 chip--featured">Rent</a>

<!-- DO NOT -->
<button onclick="navigate('/assistance/rent')" class="chip">Rent</button>
```

Google reads `<a>` tags as crawlable URLs and discovers them automatically. Buttons with JS handlers are effectively invisible to crawl discovery.

**Click behavior:**

- **Click a chip with no zip selected:** navigate to `/assistance/[slug]` directly. The destination page loads with assistance pre-selected; the existing "Please select a zip code" UX kicks in there.
- **Click a chip with a zip already selected on the homepage:** navigate to `/assistance/[slug]` with the zip stored in sessionStorage (or URL state — implementation choice). The destination page reads the zip and pre-applies it, so results render immediately.
- **No "Find Help Now" or "Go" button needed.** The chip click IS the action. The new tagline ("Select a zip code and assistance type from below") instructs users on the flow.
- **Edge case — zip selected, no chip clicked:** acceptable as-is. The tagline tells users to pick both. Users who pick only a zip and wait will figure out within seconds that they need to click a chip. No flashing indicators, no enabled-when-ready Go button.

**Remove**

- The decorative scrolling org-name list (Omar confirmed it was a placeholder).
- The current "Browse Without Account" button + "Registered Organizations" panel layout. Both are subsumed: clients use the chips directly; caseworkers use Organization Log-in in the footer.

### 2. Assistance type URL routes

Create routes `/assistance/[slug]` that render the existing search interface with the corresponding assistance type pre-selected. The URL shape is the SEO unlock; the user experience inside the app does not change.

**Important: chip label, database name, URL slug, and `assist_id` are all distinct.** The Supabase `assistance_types` table stores full canonical names like "Medical - Dental & Vision". The homepage chip displays a shortened label like "Dental & Vision". The URL slug is a kebab-cased version of the chip label. The codebase identifies assistance types by `assist_id` (a numeric-like text code, e.g. "32"). The full mapping for all 30 types is below.

**Mapping table** (use these exact slugs):

| id_no | DB `assistance` | Homepage chip label | URL slug | `assist_id` |
|-------|-----------------|---------------------|----------|-------------|
| 1 | Rent | Rent | `rent` | 11 |
| 2 | Utilities | Utilities | `utilities` | 12 |
| 3 | Food | Food | `food` | 13 |
| 4 | Clothing | Clothing | `clothing` | 14 |
| 5 | Homeless - Shelters | Homeless Shelters | `homeless-shelters` | 21 |
| 6 | Homeless - Day Centers | Homeless Day Centers | `homeless-day-centers` | 22 |
| 7 | Homeless - Other | Homeless Other | `homeless-other` | 23 |
| 8 | Housing | Housing | `housing` | 24 |
| 9 | Medical - Primary Care | Medical Primary Care | `medical-primary-care` | 31 |
| 10 | Medical - Dental & Vision | Dental & Vision | `dental-vision` | 32 |
| 11 | Medical - Behavioral Health | Behavioral Health | `behavioral-health` | 33 |
| 12 | Medical - Addiction Recovery | Addiction Recovery | `addiction-recovery` | 34 |
| 13 | Medical - Program Enrollment | Medical Enrollment | `medical-enrollment` | 35 |
| 14 | Medical - Bill Payment | Medical Bills | `medical-bills` | 36 |
| 15 | Medical - Housing | Medical Housing | `medical-housing` | 37 |
| 16 | Domestic Abuse - Shelters | Domestic Abuse Shelters | `domestic-abuse-shelters` | 41 |
| 17 | Domestic Abuse - Other | Domestic Abuse Other | `domestic-abuse-other` | 42 |
| 18 | Education - Children | Education Children | `education-children` | 43 |
| 19 | Mother & Child | Mother & Child | `mother-and-child` | 44 |
| 20 | Education - Adults | Education Adults | `education-adults` | 51 |
| 21 | Jobs | Jobs | `jobs` | 52 |
| 22 | Transportation | Transportation | `transportation` | 53 |
| 23 | Legal | Legal | `legal` | 54 |
| 24 | Immigration | Immigration | `immigration` | 55 |
| 30 | Veterans | Veterans | `veterans` | 56 |
| 25 | Seniors | Seniors | `seniors` | 61 |
| 26 | Handyman | Handyman | `handyman` | 62 |
| 27 | Animals | Animals | `animals` | 63 |
| 28 | Christmas | Christmas | `christmas` | 64 |
| 29 | Other | (skip — too generic) | — | 65 |

Total: 29 routes (skip "Other"). The slug `/assistance/other` would not rank for anything meaningful and looks unprofessional.

**Slug-to-`assist_id` mapping — two implementation approaches.** Pick whichever fits the codebase better:

**Option A (recommended): add a `slug` column to the Supabase `assistance_types` table.** Populate it once with the values above. The build script reads slugs from there. The routing layer reads from there. A single source of truth keeps URLs stable even if chip labels change. Adds one column and a small data migration. Optionally also add a `meta_title_template` and `meta_description_template` column so per-route metadata is data-driven too.

**Option B (no schema change): hardcode the slug ↔ `assist_id` mapping in a JS module.** Faster to ship; mapping lives in code. Use only if a schema change is impractical.

Either way, the routing logic is:

1. User visits `/assistance/dental-vision`
2. Router looks up the slug → finds `assist_id` = 32
3. Existing search interface mounts with `assist_id` 32 pre-selected
4. The component operates on `assist_id` as it does today; nothing about app behavior changes

**Per-route metadata**

Each `/assistance/[slug]` route must override the default homepage metadata with type-specific values. The chip label is what we want Google to associate with the page, but the chip label alone doesn't always read well as a page title — append "Assistance," "Resources," "Care," or similar based on what reads naturally.

Suggested page titles and meta descriptions (template these from the table above with overrides where noted):

| Slug | `<title>` | Meta description |
|------|-----------|------------------|
| `rent` | Rent Assistance in Houston \| CRG Houston | Find rent and eviction assistance from organizations serving the Greater Houston Area. Search by zip code to find help available in your area. |
| `utilities` | Utility Assistance in Houston \| CRG Houston | Find help paying utility bills from organizations serving the Greater Houston Area. Search by zip code to find help available in your area. |
| `food` | Food Assistance & Pantries in Houston \| CRG Houston | Find food pantries and food assistance from organizations serving the Greater Houston Area. Search by zip code. |
| `clothing` | Clothing Assistance in Houston \| CRG Houston | Find free clothing assistance from organizations serving the Greater Houston Area. Search by zip code. |
| `homeless-shelters` | Homeless Shelters in Houston \| CRG Houston | Find homeless shelters serving the Greater Houston Area. Search by zip code to find help nearest you. |
| `homeless-day-centers` | Homeless Day Centers in Houston \| CRG Houston | Find homeless day centers serving the Greater Houston Area. Search by zip code. |
| `homeless-other` | Homeless Services in Houston \| CRG Houston | Find homeless services and outreach programs across the Greater Houston Area. |
| `housing` | Housing Assistance in Houston \| CRG Houston | Find housing assistance, transitional housing, and affordable housing programs across the Greater Houston Area. |
| `medical-primary-care` | Medical Primary Care in Houston \| CRG Houston | Find low-cost and free primary care clinics across the Greater Houston Area. Search by zip code. |
| `dental-vision` | Dental & Vision Care in Houston \| CRG Houston | Find low-cost and free dental and vision care across the Greater Houston Area. Search by zip code. |
| `behavioral-health` | Behavioral Health Resources in Houston \| CRG Houston | Find behavioral and mental health resources across the Greater Houston Area. Search by zip code. |
| `addiction-recovery` | Addiction Recovery Resources in Houston \| CRG Houston | Find addiction recovery and substance use treatment resources across the Greater Houston Area. |
| `medical-enrollment` | Medical Program Enrollment in Houston \| CRG Houston | Find help enrolling in medical assistance programs across the Greater Houston Area. |
| `medical-bills` | Medical Bill Assistance in Houston \| CRG Houston | Find help paying medical bills across the Greater Houston Area. |
| `medical-housing` | Medical Housing in Houston \| CRG Houston | Find medical-related housing and respite housing across the Greater Houston Area. |
| `domestic-abuse-shelters` | Domestic Abuse Shelters in Houston \| CRG Houston | Find domestic violence shelters and emergency safe housing across the Greater Houston Area. |
| `domestic-abuse-other` | Domestic Abuse Resources in Houston \| CRG Houston | Find domestic violence and abuse support resources across the Greater Houston Area. |
| `education-children` | Education Resources for Children in Houston \| CRG Houston | Find education resources, after-school programs, and tutoring for children across the Greater Houston Area. |
| `mother-and-child` | Mother & Child Resources in Houston \| CRG Houston | Find pregnancy support, maternal care, and child resources across the Greater Houston Area. |
| `education-adults` | Adult Education Resources in Houston \| CRG Houston | Find adult education, GED, and ESL resources across the Greater Houston Area. |
| `jobs` | Job Search Resources in Houston \| CRG Houston | Find job training, placement, and search assistance across the Greater Houston Area. |
| `transportation` | Transportation Assistance in Houston \| CRG Houston | Find transportation help across the Greater Houston Area. |
| `legal` | Free Legal Aid in Houston \| CRG Houston | Find free and low-cost legal aid across the Greater Houston Area. |
| `immigration` | Immigration Resources in Houston \| CRG Houston | Find immigration legal services and support across the Greater Houston Area. |
| `veterans` | Veterans Resources in Houston \| CRG Houston | Find resources, benefits help, and support for veterans across the Greater Houston Area. |
| `seniors` | Senior Services in Houston \| CRG Houston | Find resources for seniors across the Greater Houston Area. |
| `handyman` | Handyman & Repair Help in Houston \| CRG Houston | Find handyman services and home repair help across the Greater Houston Area. |
| `animals` | Animal Assistance in Houston \| CRG Houston | Find low-cost veterinary care, pet food, and animal services across the Greater Houston Area. |
| `christmas` | Christmas Assistance in Houston \| CRG Houston | Find Christmas assistance, toy drives, and holiday programs across the Greater Houston Area. |

Refine titles/descriptions with Omar before shipping. These are starting points, not final copy.

Each route also needs:
- A canonical link tag pointing to itself
- OpenGraph and Twitter Card tags mirroring the title and description
- An H1 on the page that matches the page title (without the "| CRG Houston" suffix)

**Important: render content as real HTML on first response.**

Search Console URL Inspection confirmed Google's renderer successfully executes the JS and reads the rendered DOM on the homepage. The assistance routes need to do the same: when Googlebot fetches `/assistance/rent`, the response HTML should include the page title, the H1 reflecting the assistance type, and the visible search interface. Do not introduce client-side-only rendering for these routes.

### 3. About page (`/about`)

Create a public-facing About page at `/about`. Drop the page-level "About Community Resources Guide Houston" H1 — the page opens directly with "Why I Built This." For SEO, the HTML `<title>` tag in the `<head>` provides page-level identification.

**Page metadata**

```html
<title>About | CRG Houston — Community Resources Guide</title>
<meta name="description" content="Free directory of 1,000+ community resources from 526 organizations across the Greater Houston Area, serving clients and caseworkers since 2008.">
<link rel="canonical" href="https://crghouston.operacha.org/about">
```

**Page content**

```markdown
# Why I Built This

I'm Omar Peracha. I built this guide because of a specific challenge I encountered while answering phone calls from neighbors in need.

After a 27-year career in finance at Chevron and Shell, I retired to travel and pursue long-distance hiking. Eventually I looked for ways to give back locally, and started volunteering with the Society of St. Vincent de Paul and the Christian Community Service Center.

Both organizations get constant calls for financial assistance, and when a caller's needs fell outside our service area we relied on paper referral directories. They had real limitations: multiple directories meant multiple versions of the truth, updates were difficult so the data went stale, and the time pressure of a phone call usually meant we could share only two or three resources before moving on.

I've always been drawn to solving problems through code, often by following the old adage of "ask forgiveness, not permission." So I started a Google Sheet of 100 referrals to do better. As it grew, it had to get more interactive: data validation, then scripts, then a real application with its own database. I'm now on version 8. These days the actual coding is done by Claude Code while I focus on design, data integrity, and maintenance — including refreshing financial assistance providers at least twice a year, since their funding and program rules change frequently.

The site is free, has no ads, and exists for one reason: when someone reaches out for help, they should get the most comprehensive and current options available — not just two or three pulled from an out-of-date page.

## What's in the Guide

The directory contains over 1,000 resources from 526 organizations across the Greater Houston Area — nonprofits, government agencies, faith-based organizations, and community programs. When an organization offers more than one type of help, each is its own entry, so a single organization can appear as several resources.

Each listing shows contact details, hours of operation, eligibility requirements, the zip codes the resource serves, distance from your search zip code, and a current status — active, limited, inactive, or closed. Organizations are never removed from the directory; when a program closes, the entry stays, marked closed, so nothing is silently missing.

Coverage spans:

- 14 counties
- 136 cities
- 284 zip codes
- 30 categories of assistance, from emergency food to long-term housing

## Who It's For

- **Individuals and families** — Anyone in the Greater Houston Area seeking help for themselves or a loved one. No account or signup required.
- **Navigators and caseworkers** — Built for social workers, case managers, hospital discharge planners, school counselors, and others helping clients access services. Registered partner organizations get additional features: emailing or texting customized resource lists to clients, and generating PDF handouts.

## Contact

If you represent an organization and would like to request an account, update resource information, or suggest a new resource, please reach out directly:

developer@operacha.org

Add `/about` to the sitemap. About is linked from both the top header (homepage only) and the footer (every page).

### 4. Footer with site-wide navigation

The same secondary footer + copyright footer combination must appear on EVERY page (homepage, /about, /assistance/*, /privacy, /terms, /login, in-app pages). This is the single biggest consistency win — it solves the 0-internal-links problem and gives every page the same set of trust/navigation links.

**Secondary footer (dark band, above copyright):**

Order matters; render as plain text links separated by a middle-dot or vertical bar:

`About · Privacy Policy · Terms of Service · Contact Support · Organization Log-in`

Each is a real `<a>` tag pointing to:
- `/about`
- `/privacy`
- `/terms`
- A contact destination (mailto link or `/contact` if creating one)
- `/login`

**Copyright footer (red band, bottom):**

Unchanged: flag emoji, "© 2026 O Peracha. All Rights Reserved. Icons by icons8.com"

**Why same footer everywhere matters:** the inside-app pages currently have only the copyright line. Once Phase 1 ships, those pages get the full secondary footer too. Privacy Policy, Terms of Service, About, and the Organization Log-in entry are reachable from every page in the system, not just the homepage. For Google, this dramatically improves crawl coverage and internal link signal. For users, it means they always know where to find these items — bottom of any page, same spot, every time.

### 5. In-app caseworker login + vertical bar updates

A caseworker who clicks a chip on the homepage lands in the app as a guest user (no caseworker features). Currently they would have to navigate back to the homepage to log in, losing their search context. Change this.

**Vertical right navbar updates**

Current vertical bar (top to bottom):
1. Home (top)
2. Quick Tips
3. Help
4. Reports
5. Announcements
6. Legal (Privacy Policy & Terms of Service)
7. Contact Support

New vertical bar:
1. Home (top)
2. Quick Tips
3. Help
4. Reports
5. Announcements
6. **Login** (new — visible only when user is browsing as guest)
7. ~~Legal~~ — **remove**, now lives in the footer on every page
8. ~~Contact Support~~ — **remove**, now lives in the footer on every page

The Login icon opens a modal or slide-out containing the existing login form (Select Organization dropdown + passcode). On successful login:
- Dismiss the modal
- Re-render the app with caseworker permissions (Send Email, Create PDF, Send Text buttons transition from inactive to active)
- **Preserve the user's current search context** — zip code, assistance type, any other filter state must NOT be reset

**Optional reinforcements** (Omar's "log in every session" goal):

These are recommended but not strictly required:

- **Guest-session banner**: a small dismissable banner at the top of the app for guest sessions: "You're browsing as a guest. Log in to access caseworker features." Direct prompt every guest sees on every app load.
- **Make the grayed-out Send Email / Create PDF / Send Text buttons clickable for guests**: when a guest clicks one, show a small modal: "Log in to use this feature." Catches caseworkers exactly when they need it and converts them.

**Add the secondary footer to all in-app pages.** Match the homepage footer pattern. The existing thin copyright bar at the bottom of in-app pages becomes a two-tier footer with the navigation links above the copyright.

### 6. Public Privacy and Terms pages

Currently Privacy Policy and Terms of Service are accessible only inside the app (vertical bar → Legal). For SEO trust signals, these need public URLs:

- `/privacy` — same content as the in-app Privacy Policy
- `/terms` — same content as the in-app Terms of Service

Implementation: extract the content into shared components and render them at both the public routes and the existing in-app routes (which now reach them via the footer rather than the vertical bar). No new content needed.

Add both to the sitemap and the footer.

### 7. Sitemap regeneration

The current `/sitemap.xml` lists only 5 URLs and was last read by Google on Feb 7. After this work, the sitemap should include:

- `/` (homepage)
- `/about`
- `/privacy`
- `/terms`
- `/contact` (if created)
- `/login`
- `/announcements`
- All 29 `/assistance/[slug]` routes (one per assistance type, skipping "Other")

Each entry should include a `<lastmod>` date in ISO 8601 format. For static pages, use the build date. For assistance routes, use the most recent `updated_at` timestamp from the resources tagged with that assistance type.

Generate the sitemap at build time, not at request time. The Cloudflare Pages build runs a Node script that queries Supabase, writes `/sitemap.xml` to the build output, and serves it as a static file. Sketch:

```js
// scripts/generate-sitemap.js — runs in CF Pages build step
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Pull assistance types with slug column (Option A) or use hardcoded mapping (Option B)
const { data: types } = await supabase
  .from('assistance_types')
  .select('slug, assist_id')
  .neq('assistance', 'Other')   // skip the generic "Other" category

const staticUrls = [
  { loc: '/', priority: 1.0 },
  { loc: '/about', priority: 0.8 },
  { loc: '/privacy', priority: 0.3 },
  { loc: '/terms', priority: 0.3 },
  { loc: '/announcements', priority: 0.5 },
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...types.map(t => ({
  loc: `/assistance/${t.slug}`,
  priority: 0.7
}))].map(url => `  <url>
    <loc>https://crghouston.operacha.org${url.loc}</loc>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`

fs.writeFileSync('dist/sitemap.xml', xml)
```

Adjust column names to match the actual Supabase schema. If going Option B, replace the Supabase query with the hardcoded mapping.

### 8. Quick technical fixes

**Fix the `?zip={search_term_string}` artifact** that appears in Search Console as "Crawled — currently not indexed". This URL is being crawled because of the SearchAction in the JSON-LD WebSite block. Add to `/public/robots.txt`:

```
User-agent: *
Disallow: /?zip=
Sitemap: https://crghouston.operacha.org/sitemap.xml
```

This stops Google from crawling the placeholder URL going forward. The existing entry in Search Console will eventually drop out.

**Update resource counts in `index.html` JSON-LD blocks** to reflect the current accurate scope. Both the Organization schema's `description` field and the Dataset schema's `description` field currently say "800+ community assistance organizations." Update both to:

> "Free online directory of 1,000+ community resources from 526 organizations across the Greater Houston Area"

The visible homepage tagline says "1,000+" so the structured data must match. Same applies anywhere else in `index.html` where resource counts appear.

**Verify the JSON-LD SearchAction target URL** in `index.html`. The current target is `https://crghouston.operacha.org/?zip={search_term_string}` which is fine as-is for the SearchAction declaration. With the `Disallow: /?zip=` line in `robots.txt`, this is harmless.

### 9. Mobile design

Mobile design has not been finalized in Figma yet. Documented intent for Claude Code:

- Top-right "About" button replaced by a hamburger icon
- Hamburger menu contains: About, Privacy Policy, Terms of Service, Contact Support, Organization Log-in (mirrors the secondary footer items, plus About)
- Artwork compresses to a banner at the top of the page
- Hero panel takes full viewport width below the artwork banner
- All 30 chips stack into the same group order, with the same group-spacing pattern; first 4 chips remain larger for visual emphasis
- Copyright footer remains visible at the bottom of every page
- Scrolling is fine; mobile users expect to scroll

Coordinate with Omar on the final mobile mockup before implementation.

---

## Validation checklist (after deploy)

In Search Console:
- [ ] Submit the new sitemap (Sitemaps → enter `sitemap.xml` → Submit)
- [ ] Verify the sitemap status reads Success and Discovered pages reflects ~35
- [ ] URL Inspection on `/about` → Request Indexing
- [ ] URL Inspection on 3-5 representative `/assistance/[slug]` URLs → Request Indexing
- [ ] URL Inspection on the homepage → confirm the new HTML reflects the redesigned layout (the rendered HTML should contain the H1 "Free help across Greater Houston" text and the chip `<a>` links)

Manually:
- [ ] View source on the homepage and confirm chips render as `<a href="/assistance/rent">` etc., not as buttons
- [ ] Confirm the first 4 chips (Rent, Utilities, Food, Clothing) render visibly larger than the rest
- [ ] Navigate to `/assistance/rent` and confirm the existing search interface loads with Rent (assist_id 11) pre-selected
- [ ] Navigate to `/assistance/dental-vision` and confirm Medical - Dental & Vision (assist_id 32) is pre-selected
- [ ] Navigate to `/about` and confirm the page renders with proper title, meta tags, and the new content
- [ ] Navigate to `/privacy` and `/terms` and confirm public access works
- [ ] Click every secondary footer link from the homepage and from at least one in-app page; confirm each goes to a real page
- [ ] Confirm the secondary footer appears on every in-app page (not just the homepage)
- [ ] Confirm the Privacy icon has been removed from the in-app vertical right navbar and the Login icon has been added
- [ ] Confirm Login icon opens the existing login form modal and that successful login preserves search context (zip, assistance type)
- [ ] In responsive mode, scale the browser to mobile width and confirm the layout adapts (artwork compresses, hero panel goes full-width, hamburger menu replaces About)
- [ ] Confirm `index.html` JSON-LD blocks now reflect "1,000+ community resources from 526 organizations"

After 2-4 weeks, check Search Console:
- [ ] Indexed pages count increased from 1 to ≥10 (target ≥20)
- [ ] About page shows as indexed
- [ ] At least a few `/assistance/[slug]` pages show as indexed
- [ ] Internal links count went from 0 to a positive number

---

## What comes next (Phase 2, when ready)

When Omar is ready to take on the next phase, the work that unlocks high-intent client queries is:

1. **Per-zip landing pages** at `/zip/[code]` for all 284 served zip codes, each rendering the resources serving that zip
2. **Cross-product pages** at `/assistance/[slug]/[zip]` for combinations with at least N resources (probably 1,500–3,000 generated pages)
3. **Per-resource detail pages** at `/resource/[slug]` for each of the 526 organizations × their assistance types
4. **Static pre-rendering at build time** for all of the above so Google indexes them reliably
5. **Backlink acquisition strategy** — outreach to 211 Texas, United Way, BakerRipley, Houston Public Library, etc.
6. **Google Ad Grant** application for $10,000/month in free Google Ads for nonprofits

Phase 1 is the foundation that makes Phase 2 work straightforward — once the routing pattern, sitemap generation, and per-route metadata are in place, Phase 2 is largely a matter of expanding the same patterns to more URL types.

---

## Highest-leverage deferred item — for discussion with Claude Code

Of everything in Phase 2, this is the one Omar has indicated he'd push to the top of the list. He deliberately deferred Phase 2 to keep this scope manageable, but is open to discussing whether a partial version could ship now if it doesn't substantially change the current user experience or look.

### What it is: cross-product URL routes — `/assistance/[slug]/[zip]`

When a user navigates inside the app and applies both an assistance type filter and a zip code filter, the resulting state should have its own URL. So selecting Rent + 77002 produces `/assistance/rent/77002` with the filtered list of resources rendered as HTML on first response.

That's the entire change. No new templates. No editorial content. No design changes. The URL becomes the source of truth for the filter state, and Google can index every meaningful combination as its own landing page.

### Why this is the highest-leverage SEO move

- **It matches the highest-intent, lowest-competition queries.** "Rent assistance 77002" has small search volume but even smaller competition. Someone in crisis searching that exact phrase has very high conversion potential. The big established sites generally do not have dedicated pages for `[type] in [specific zip]`. These are pages CRG can win.
- **The content already exists.** No new prose to write. The filtered resource list, with phone numbers, addresses, hours, and eligibility, is the SEO content. Each combination is a unique, useful page by virtue of the data displayed.
- **Omar's UX is preserved exactly.** Users navigate the app the same way. Caseworkers do their job the same way. The URL just happens to update as the filter state changes.
- **It's the natural extension of Phase 1's routing pattern.** `/assistance/[slug]` becomes `/assistance/[slug]/[zip]` — one more URL segment, same routing primitive.
- **Realistic SEO impact:** moves from ~20–40 indexed pages (Phase 1 alone) to potentially 1,500–3,000 indexed pages, each targeting a specific high-intent query.

### Realistic scale

- 30 assistance types × 284 zip codes = 8,520 possible combinations
- Many combinations have zero resources
- Generate URLs only for combinations with at least N resources (suggest N=2 or N=3)
- Realistic count: 1,500–3,000 generated pages

### Three partial implementations, in order of decreasing scope

**Partial A — full scope, automated.** Generate every `/assistance/[slug]/[zip]` URL where the resource count is ≥ N. Yields 1,500–3,000 indexable pages. Highest SEO impact.

**Partial B — top types × top zips.** Limit to the 8 highest-volume assistance types (Rent, Utilities, Food, Medical Primary Care, Domestic Abuse Shelters, Housing, Legal, Jobs) × the top 50 zip codes by resource count. Yields ~400 pages.

**Partial C — single category, all zips.** Pick the single highest-volume category (Omar identified Rent + Utilities as ~70% of searches — start with Rent). Generate `/assistance/rent/[zip]` for every zip with rent resources. Yields ~50–80 pages. Useful as a 4-week experiment before committing to Partial A.

### What needs to change to ship any version

- **Routing**: add `/assistance/:slug/:zip` route that loads the existing search interface with both filters pre-applied
- **Build script**: query Supabase for `(assist_id, zip) → resource_count` aggregations, generate the URL list for combinations meeting the threshold
- **Sitemap**: include all generated combination URLs
- **Per-route metadata**: title pattern like `Rent Assistance in 77002 | CRG Houston`
- **Critical**: ensure the filtered resource list renders as part of the HTML on first response, not only after client-side React reconciliation

### What does NOT change

- The homepage redesign already specified in Phase 1
- The user's interaction with the app (search by zip, then filter by assistance, then see results)
- Any visual design or layout
- The forced-zip-selection UX for users who land on `/assistance/[slug]` without a zip
- Any of the existing app components

### Questions for Claude Code

- Does the existing search interface render the filtered list as part of the initial server response, or only after client-side state updates? (If only after, the routes need a way to get the filtered data into the initial render.)
- What's the cleanest way to query Supabase for `(assist_id, zip) → resource_count` aggregations for the build script?
- Cloudflare Pages build performance with 1,500–3,000 sitemap entries (likely no issue, but worth verifying).
- Whether to ship Partial C as a 4-week experiment first.

### Recommendation if going partial

Ship **Partial C** as a controlled experiment alongside Phase 1. Pick Rent. Generate ~50 pages. Wait 4 weeks after deploy. Check Search Console for indexing rates and impressions on those URLs. If `/assistance/rent/77026` and similar start showing up in queries data, expand to Partial A. If they don't, the SEO theory was wrong somewhere and re-evaluate before investing more.

Partial C is roughly 1–2 days of additional work on top of Phase 1, depending on how the existing routing is structured. Minimal risk because it doesn't change anything users see, and gives a clean A/B-style signal about whether the broader architecture investment will pay off.

---

## Notes for Claude Code

- The existing on-page SEO work (title, meta description, OpenGraph, Twitter Cards, JSON-LD WebSite/Organization/Dataset, geo tags, canonical, robots) in `index.html` is well-done. Preserve it as the homepage default and use it as the model for new pages.
- Site is a Vite SPA. The earlier hypothesis that Google can't see SPA-rendered content turned out to be false — Search Console URL Inspection confirmed Google's renderer successfully executes the JS and reads the rendered DOM. So no need for a major prerendering migration in this phase. Just ensure new routes also render their content into HTML on first response.
- Omar's app philosophy is action-oriented and minimal. Do not add editorial content to assistance pages (he was clear about this multiple times). The resource list itself, with names/addresses/hours/eligibility, is the SEO content.
- Cloudflare Pages build runs on git push. The sitemap generation script should run as part of the build step.
- Omar's Figma is the source of truth for all visual specifics. This document captures the spec but design details (exact colors, exact spacing, exact font sizes, mobile layout) should match the Figma.
- Omar plans to give organization administrators a heads-up and post an in-app announcement before pushing this to production, to warn existing caseworker users about the layout change. Coordinate the deploy timing with him.
- The Supabase `assistance_types` table is the source of truth for assistance type identity. Every resource is keyed to an `assist_id`. The chip label and URL slug are presentation concerns; the codebase identifies types by `assist_id`.
