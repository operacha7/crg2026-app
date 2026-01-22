# CLAUDE-ARCHIVE.md

This file contains historical context, completed implementation plans, and design decisions from the 2025-2026 redesign. For active development reference, see [CLAUDE.md](CLAUDE.md).

---

## Project History & Redesign Context

**Origin:** This is `crg2026-app`, a complete redesign of the original `crg-app` (built ~2024). The original was a learning project with trial-and-error development, inconsistent patterns, and phantom files from abandoned features.

**Goals of this redesign:**
- Clean, maintainable codebase with standardized patterns
- Centralized resources (icons in `/src/icons`, design tokens planned)
- Single-source-of-truth for styling (change once, apply everywhere)
- Restructured Supabase database (already completed)
- Complete UX redesign (completed in Figma)

**Removed from original:**
- Spanish language version
- Tour/onboarding feature (driver.js, intro.js removed)
- Storybook
- Legacy components cleaned up (Jan 2026): NavBar.js, SearchResults.js, AssistanceSidebar.js, EmailDialog.js, OrganizationPage.js, GeneralSearchPage.js, charts/, and related files

**Unchanged:**
- Resend for emails
- PDFShift for PDF generation
- Core functionality (search, email, PDF)

**Infrastructure Migration:**
- Hosted on Cloudflare (migrated from Netlify)
- Supabase backend (new restructured database)

---

## Development Roadmap (Completed Jan 2026)

1. ✅ Set up icons (centralized in `/src/icons`)
2. ✅ Set up design tokens (`src/styles/tokens.css`)
3. ✅ Build shell (NavBars, Footer, layout) - **Visual shells first, then wire up**
   - ✅ Footer component
   - ✅ Vertical Nav Bar (right side)
   - ✅ NavBar1 (header with logo, counters, buttons)
   - ✅ NavBar2 (search mode selector + filters)
   - ✅ NavBar3 (assistance type filters + dropdown panel) - connected to Supabase
   - ✅ Remove legacy controls from ZipCodePage
   - ✅ Results Header
4. ✅ Results display component (ResultRow + ResultsList)
5. ✅ Wire up NavBar state to ZipCodePage (zip selection, assistance filtering)
6. ✅ Add geocoding feature (Google Geocoding API)
7. ✅ Email redesign (single-column, mobile-friendly format)
8. ✅ PDF redesign (3-column, print-optimized format)
9. ✅ Help system (LLM-powered chat assistant)
10. ✅ Quick Tips system (visual reference sidebar)

---

## Implementation Plan: Supabase Connection ✅ COMPLETE

### Overview
Connect the UI shell (NavBars, ResultsList) to live Supabase data with client-side filtering for instant results.

### Completed Steps

#### Step 1: Update dataService.js ✅ COMPLETE
- Fetches from `directory`, `assistance`, `zip_codes` tables
- `organizations` table no longer fetched (derived from directory)

#### Step 2: Create AppDataContext ✅ COMPLETE
- Central data context loads all data on app start
- Exports: `directory`, `assistance`, `zipCodes`, `organizations` (derived), `orgAssistanceMap`
- `orgAssistanceMap` = lookup table: org name → array of assist_ids (for Assistance column icons)

#### Step 3: Wire NavBar2 Dropdowns ✅ COMPLETE
- All dropdowns populated from context
- Organizations derived from directory (no separate table fetch)

#### Step 4: Wire Results Display ✅ COMPLETE
- ResultsList displays filtered directory data
- ResultRow uses `orgAssistanceMap` for Assistance column icons

#### Step 5: Implement Zip Code Filtering ✅ COMPLETE
- Filters `directory.client_zip_codes` containing selected zip
- Distance calculated from `zip_codes.coordinates` to `directory.org_coordinates`

#### Step 6: Implement Assistance Filtering ✅ COMPLETE
- Filters by `directory.assist_id` matching active NavBar3 chips
- Uses `assistance.assist_id` (text) for matching

#### Step 7: Implement Sorting ✅ COMPLETE
- Results sorted by: status_id → assist_id → miles (all ascending)
- Sorting handled in `ResultsList.js`

#### Step 8: Wire Counters ✅ COMPLETE
- Filtered count and selected count wired to NavBar1

#### Step 9: Email/PDF Redesign ✅ COMPLETE
- Email format redesigned (single-column, mobile-friendly)
- Uses shared formatters from `src/utils/formatters.js`
- From address updated to `info@crghouston.operacha.org`

### Key Technical Decisions

**assist_id is TEXT:** Both `directory.assist_id` and `assistance.assist_id` are text fields. This allows consistent string comparison without type conversion issues.

**Org assistance computed from directory:** Instead of using `organizations.org_assistance` array, we compute a lookup map from directory records. This ensures single source of truth and eliminates sync issues.

**Sort order:** status_id (1=Active first) → assist_id (numeric order) → miles (nearest first)

---

## Legacy Controls Removed from ZipCodePage

The following legacy UI elements were removed from `src/views/ZipCodePage.js` as they are now handled by the new NavBar components:
- ~~Zip Code dropdown~~ → Now in NavBar2
- ~~Assistance buttons and "More options" link~~ → Now in NavBar3
- ~~Orange animated results counter~~ → Now in NavBar1 (filtered/selected counters)

---

## Design Assets Location

Design assets stored in `/docs/design/`:
- `ZipCode.png` - Overall page layout
- `Footer.png` - Footer specs
- `Frame 503 Vertical Bar.png` - Vertical nav bar specs
- `Frame 494 NavBar 1.png` - NavBar1 specs
- `Frame 496 NavBar 2.png` - NavBar2 specs (shows all 4 search modes)
- `Frame 505 NavBar 3.png` - NavBar3 with assistance panel
- `Login Panel.png` - Login page design
- `Design Tokens Login.txt` - Login page design specs
- `Supabase Schema.png` - Database schema reference
- `Design Tokens.txt` - NavBar1 design specs (RTF format)
- `Design Tokens NavBar 2.txt` - NavBar2 design specs
- `Design Tokens NavBar 3.txt` - NavBar3 and panel design specs

---

## Deprecated: `organizations` Table

**Note:** The `organizations` table is no longer fetched. Organization data for NavBar2 dropdowns is now derived from the `directory` table. The `org_assistance` field has been replaced by computing assistance types from directory records.

**Deprecated fields:**
| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id_no` | int4 | `1001` | Primary key |
| `organization` | text | `"3 \"A\" Bereavement..."` | Org name |
| `org_parent` | text | Same or parent name | Parent org |
| `org_assistance` | text | `["65"]` | **DEPRECATED** - Now computed from directory |

---

## Announcement System TODO (Pending Redesign)

These items were planned but not yet implemented:
- ⬜ Redesign AnnouncementPopup.js with typewriter/memo style
- ⬜ Add Courier Prime font to the app
- ⬜ Add design tokens for memo styling
- ⬜ Redesign MessagesPage.js (Figma design pending)
- ⬜ Update AnnouncementService.js to use new table structure

**Planned Design Tokens (not yet added):**
- `--font-memo: 'Courier Prime', monospace`
- `--font-size-memo-title: 110px`
- `--font-size-memo-body: 16px`
- `--color-memo-title: #2500E2`
- `--color-memo-text: #000000`

---

## PDF Known Issue

**Header does not repeat on subsequent pages** (only appears on page 1)
- PDFShift running headers require special formatting
- Current workaround puts header in body HTML
- Need to debug PDFShift header/footer source validation error

**PDFShift Requirements:**
- Header/footer `source` must start with `<` (no leading whitespace)
- External resources (images, fonts) must be publicly accessible URLs
- `{{page}}` and `{{total}}` template variables for page numbers
