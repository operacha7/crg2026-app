# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Community Resources Guide (CRG) Houston - a React application that helps organizations find and share community assistance resources. Users log in via organization passcodes and can search for resources by zip code, organization, or assistance type, then email or PDF selected results to clients.

## Documentation Structure

- **CLAUDE.md** (this file) - Active reference for working on the app
- **[CLAUDE-ARCHIVE.md](CLAUDE-ARCHIVE.md)** - Historical context, completed implementation plans, design decisions

## UI Shell Components

The app shell consists of:
1. **NavBar1** - Logo, title, counters (filtered/selected), Send Email & Create PDF buttons
2. **NavBar2** - Search mode selector + mode-specific filters (see Search Modes below)
3. **NavBar3** - Assistance type filters with dropdown panel (see Assistance Types below)
4. **Results Header** - Display controls (to be designed)
5. **Footer** - Static, copyright only
6. **Vertical Nav Bar** - Information, Reports, Privacy Policy, Contact Support, etc.

Results display format is consistent regardless of filters applied.

## Remaining TODO

- ⬜ Simplify usage reporting
- ⬜ LLM search (Anthropic API)
- ⬜ Announcement popup redesign (typewriter/memo style)
- ✅ Opportunity Scan system + News feed — BUILT and live July 2026 (Cloudflare, not a Supabase Edge
  Function). See "Opportunity Scan System (BUILT)" for the as-built design, gotchas, and what's deferred.

## Components Reference

### Footer (`src/layout/Footer.js`)
- Height: 30px
- Background: `#B8001F` (red)
- Text: white, Open Sans font, 10px
- Content: Copyright + US flag icon

### Vertical Nav Bar (`src/layout/VerticalNavBar.js`)
- Position: Right side of layout
- Two bars:
  - Accent stripe: 20px wide, `#948979` (tan)
  - Main bar: 60px wide, `#222831` (dark charcoal)
- Icons (bottom-aligned, 80px from bottom):
  - QuickTipsIcon (lightbulb)
  - HelpBubbleIcon (speech bubble with ?)
  - ReportsIcon
  - AnnouncementsIcon
  - PrivacyPolicyIcon
  - ContactSupportIcon
- Icon size: 35x35px, gap: 25px
- States: inactive (red `#b8001f`) / active (green `#5cb800`)
- Hover effect: `brightness-125`

### NavBar1 (`src/layout/NavBar1.js`)
- Height: 80px
- Background: `#222831`
- Left side: Logo (40x40) + Title "Community Resources Guide Houston"
  - Title: Comfortaa, 28px, Semibold, 10% letter-spacing, white
- Right side: Counters + Buttons
  - Counters: 45x45 circles, 20px font, Open Sans
    - Filtered count: `#EB6E1F` (orange) bg
    - Selected count: `#00A8A8` (teal) bg
    - Text: `#222831`
  - Buttons: 150x38px, 22px font, Open Sans
    - Send Email: `#FFC857` (gold) bg, `#222831` text
    - Create Pdf: `#228B22` (green) bg, white text

### NavBar2 (`src/layout/NavBar2.js`)
- Height: 70px
- Background: `#4A4F56` (updated from `#393E46`)
- Right side: Search mode buttons (Zip Code, Organization, Location, Ask a Question)
  - Button: auto-width (20px padding), 38px height, 10px radius
  - Inactive: transparent bg, white text, no border
  - Active: `#652C57` bg, `#FFC857` text
  - Font: 20px, Medium (500), 5% letter-spacing
  - Hover effect: `brightness-125`
- Left side: Mode-specific filters (changes based on active mode)
  - Dropdowns: `#005C72` bg, white text, 20px font, Medium (500)
  - Neighborhood link: `#8FB6FF`, 14px
  - Distance icon: same button styling, white (inactive) / gold (active)
  - Hover effect: `brightness-125` on all interactive elements

### NavBar3 (`src/layout/NavBar3.js`) - COMPLETE
- Height: 60px
- Background: `#948979` (tan - same as vertical nav accent)
- Left padding: 20px
- **Connected to Supabase** - fetches from `assistance` table for dynamic/evergreen groups

**Assistance Button:**
- Height: 35px (slightly smaller than NavBar2 buttons)
- Includes chevron down icon
- Text changes based on state:
  - No selections: "Select Assistance"
  - Has selections: "Change Assistance"
- Inactive: transparent bg, white text
- Active (has selections): `#652C57` bg, `#FFC857` text

**Assistance Chips (in NavBar3):**
- Appear after selections are saved from panel
- Gap: 40px from button to first chip, 15px between chips
- Include icons from the `icon` field in Supabase
- Two visual states:
  | State | Background | Text | Border |
  |-------|------------|------|--------|
  | Inactive | White | Black | Black 1px |
  | Active | Teal (`#005C72`) | White | White 1px |
- Click chip to toggle between inactive/active
- Multiple chips can be active simultaneously
- Single selection auto-activates on save

**Assistance Panel (dropdown):**
- Opens when clicking Assistance button
- Header: `#4A4F56` bg, 70px height
  - Title: "Assistance Types" in gold (`#FFC857`), 18px, semibold
  - Subtitle: "(Select one Group or up to three Assistance Types)" in `#D7D5D1`, 14px
- Body: `#948979` bg
- 6 groups (dynamic from Supabase)
- Group colors (unselected):
  - Group 1: `#E5E292` (yellow)
  - Group 2: `#B592E5` (purple)
  - Group 3: `#E592A6` (pink)
  - Group 4: `#C2E592` (green)
  - Group 5: `#92DEE5` (cyan)
  - Group 6: `#E5C392` (orange)
- Selected chips: white bg, black 1px border
- All chips: 15% corner radius, 14px font, 2% letter-spacing
- Footer: Cancel (red `#FF0000`), HelpIcon, OK (green `#3DB800`)
- Buttons: 100x38px, black text, 5px radius

**Icon Map (`src/icons/iconMap.js`):**
- Maps icon names from Supabase to React components
- `getIconByName(iconName)` function for dynamic icon loading

### Results Header (`src/layout/ResultsHeader.js`)
- Height: 30px
- Background: `#B8001F` (red - same as footer)
- Text: white, Open Sans, 14px, 2% letter-spacing
- **Grid columns aligned with ResultRow:** `4% 3% 20% 8% 17% 6% 6% 33% 3%`
- Columns: Select | Miles | Organization | Assistance | Hours | Status | Telephone | Requirements | Zip
- Column gaps (paddingLeft): Hours +30px, Status +40px, Telephone +20px
- Exports `GRID_COLUMNS` constant for use by ResultRow
- **Note:** Address column removed (combined with Organization), redistributed: 8% to new Assistance column, 4% to Requirements

### ResultRow (`src/components/ResultRow.js`)
- Individual result row for displaying resource data
- Uses same grid template as ResultsHeader for alignment
- **Grid columns:** `4% 3% 20% 8% 17% 6% 6% 33% 3%`

**Row Layout:**
- Min height: 100px
- Background states: Alternating colors (no hover effect)
  - Even rows (0, 2, 4...): `#F0F8FF` (light blue)
  - Odd rows (1, 3, 5...): `#F0FFF0` (light green)
  - Selected: `#FEF0FF` (light pink)
- Border: 0.5px bottom, `#CCCCCC`
- Checkbox: Green (`#228B22`) when checked

**Columns:**
1. **Select** - Assistance type icon (25px, red `#B8001F`) + checkbox (20px) side by side
2. **Miles** - Distance with "mi" suffix underneath (smaller, gray)
3. **Organization** - Org name (18px, semibold) + address below (10px gap, regular weight)
   - No favicon (removed)
   - Address consolidated from org_address1, org_address2, city/state/zip
   - **Transit directions icon** (right side of column, 28px, `--color-results-transit-icon` `#FF0000`, with 100px right margin so it visually belongs to the Organization column rather than the Assistance icons) — deep-links to Google Maps with `travelmode=transit`, origin=clientCoordinates if set, destination=org_coordinates. Free (no API). See `src/utils/transitUrl.js`.
4. **Assistance** (NEW) - All assistance type icons for this org (20px, olive `#808000`)
   - Moved from Organization column to dedicated column
5. **Hours** - Two-column layout (days right-aligned, hours right-aligned)
   - Regular hours from JSON `hours` field
   - Exceptions in smaller italic gray text
   - **Hours notes:** Gold background (token), semibold, 5px border radius, centered
6. **Status** - Pill with rounded corners (25px radius)
   - Active: `#8FBC8F` (green)
   - Limited: `#FFDA6A` (yellow)
   - Inactive: `#E74C3E` (red)
7. **Telephone** - Plain text
8. **Requirements** - Bulleted list with expand/collapse (increased from 28.5% to 33%)
   - Max 5 visible lines, then "More Info" link with double chevron (`#FF0004`)
9. **Zip** - List of client zip codes with expand/collapse
   - Same expand/collapse behavior as Requirements (no label, just chevron)

**Hours JSON Format:**
```json
{
  "regular": [
    { "days": ["Mon", "Tue"], "open": "09:00", "close": "17:00" }
  ],
  "exceptions": [
    { "type": "closed", "start": "12:00", "end": "13:00" }
  ]
}
```

### ResultsList (`src/components/ResultsList.js`)
- Container component that renders ResultsHeader + list of ResultRows
- Manages selection state (which rows are checked)
- Passes assistance icon data and `orgAssistanceMap` to each row
- Sorts records by: status_id → assist_id → miles
- Connected to live Supabase data via `AppDataContext`

### Tooltip (`src/components/Tooltip.js`)
- Instant CSS tooltip component (0ms delay vs browser's ~750ms)
- Supports 4 positions: `top` (default), `bottom`, `left`, `right`
- Used by: NavBar1 counters, NavBar2 distance icon, NavBar3 help icon, VerticalNavBar icons, ResultRow assistance icons
- All styling uses design tokens

### Login Page (`src/auth/Login.js`)
- Full-screen background image with login panel overlay
- Background: `CRG Background NEW 2025.webp` aligned left, dark fallback (`#1a1a2e`) on right
- Panel: max-width 500px, positioned top-right on desktop (80px top, 60px right), centered on mobile

**Panel Structure:**
- Header: Logo (30x30) + title "Community Resources Guide Houston" (Comfortaa, 18px, gold)
  - Title nudged down 4px to optically center with logo
- Body: Tan background (`--color-login-panel-bg`)
  - "Browse Without Account" button (teal `--color-login-btn-guest-bg`)
  - "Registered Organizations" section with dropdown + passcode input
  - Passcode input has Chrome autofill override (maintains design colors)

**Responsive Behavior:**
- Desktop (`md:` 768px+): Panel top-right with padding
- Mobile: Panel centered both horizontally and vertically

**Chrome Autofill Fix:**
- Uses `-webkit-box-shadow` inset trick to override Chrome's autofill background
- Uses `-webkit-text-fill-color` to maintain text color
- Class: `.login-passcode-input:-webkit-autofill`

**Easter Egg:**
- Floating sparkle emojis (✨) in dark right area on wide screens (`xl:` 1280px+)
- Hidden "You found me! 🎉" message that fades in/out
- Uses Framer Motion for animations

**Design Tokens for Login:**
- `--color-login-panel-header-bg` - Panel header background
- `--color-login-panel-bg` - Panel body background
- `--color-login-panel-title` - Gold title text
- `--color-login-input-bg: #2C4146` - Input field background
- `--color-login-input-text: #F3EED9` - Input field text
- `--color-login-btn-guest-bg` - Browse Without Account button
- `--color-login-btn-login-bg` - Log in button
- `--radius-login-btn` - Button border radius

## Commands

```bash
npm start          # Vite dev server at localhost:3000
npm run build      # Vite production build to /build (runs prebuild sitemap gen first)
npm run preview    # Preview the production build locally
```

**Build tooling:** Vite (`vite.config.js`) with `@vitejs/plugin-react`. (Note: this project was migrated off Create React App — ignore any lingering CRA/react-scripts/Jest references.)

## Architecture

### Data Flow
- **Supabase Backend**: All data fetched from Supabase (`MainApp.js` exports the `supabase` client)
- **Client-side filtering**: All data loaded once on app start, filtered in-memory for instant results
- **dataService** (`src/services/dataService.js`): Centralized data access layer (updated for 2026 schema)

### Performance Strategy
With ~1000 directory records, ~28 assistance types, ~450 organizations, and ~270 zip codes, client-side filtering is optimal for instant user feedback. Data is fetched once on app load and filtered in React state.

### Key Components Structure
```
src/
├── MainApp.js           # Main app shell, routing, Supabase client export
├── App.js               # Root with login state, UTM preservation
├── auth/Login.js        # Organization/passcode authentication
├── Contexts/
│   ├── AppDataContext.js     # Central data context - loads directory, assistance, zipCodes
│   │                         # Also computes: organizations (derived), orgAssistanceMap
│   └── StatisticsContext.js  # Shared state for reports/charts
├── views/
│   ├── ZipCodePage.js   # Main search page - filters and displays results
│   ├── ReportsPage.js   # Usage analytics and reports
│   ├── LegalPage.js     # Privacy policy and terms
│   ├── SupportPage.js   # Contact support page
│   └── AnnouncementsPage.js # Announcements history
├── components/
│   ├── ResultRow.js     # Individual result row with expand/collapse
│   │                    # Uses orgAssistanceMap for Assistance column icons
│   ├── ResultsList.js   # Container for ResultRows, handles sorting
│   ├── Tooltip.js       # Instant CSS tooltip
│   ├── DropPanel.js     # Reusable dropdown panel (used by Address, Email, PDF panels)
│   ├── EmailPanel.js    # Email/PDF entry panel with inactive warning
│   ├── AddressPanel.js  # Address override panel — entered address overrides zip centroid for distance calc
│   ├── HelpPanel.js     # LLM-powered help chat (opens from VerticalNavBar)
│   ├── QuickTipsPanel.js # Visual reference guide sidebar (accordion sections)
│   ├── AnnouncementPopup.js  # Modal popup for announcements
│   ├── AnnouncementManager.js # Orchestrates announcement display
│   └── reports/
│       └── ChartReport.js    # Usage charts component
├── layout/
│   ├── PageLayout.js    # Shared layout with header/footer/vertical nav
│   ├── NavBar1.js       # Top header (logo, counters, buttons)
│   ├── NavBar2.js       # Search mode selector + filters (uses context)
│   ├── NavBar3.js       # Assistance type filters + dropdown panel
│   ├── ResultsHeader.js # Red column header bar for results
│   ├── Footer.js        # Bottom footer bar
│   └── VerticalNavBar.js # Right-side icon navigation
├── icons/               # Centralized SVG icon components
│   ├── index.js         # Re-exports all icons
│   ├── iconMap.js       # Maps Supabase icon names to components
│   ├── HelpIcon.js      # Fixed-color help icon for panels
│   └── HelpBubbleIcon.jsx # Speech bubble with "?" - liquid glass style for vertical nav
├── data/
│   └── constants.js     # Static constants (logo URL for emails)
├── styles/
│   └── tokens.css       # Design tokens (CSS custom properties)
├── utils/
│   └── formatters.js    # Shared formatting utilities (hours, address, distance)
├── Utility/
│   └── ScheduledReload.js # Auto-reload at 2am for session reset
└── services/
    ├── dataService.js   # Supabase query methods (directory, assistance, zip_codes)
    ├── emailService.js  # Email/PDF sending logic (sendEmail, createPdf, checkLimits)
    ├── geocodeService.js # Geocoding + driving distances (geocodeAddress, getDrivingDistances)
    ├── usageService.js  # Usage logging
    ├── llmSearchService.js # LLM search filter application
    └── AnnouncementService.js # Announcement queries
```

### Cloudflare Functions
- `functions/sendEmail.js` - Resend integration for email delivery
- `functions/createPdf.js` - PDFShift integration for PDF generation
- `functions/translate.js` - Google Cloud Translation API v2 for email/PDF translation
- `functions/help.js` - LLM help assistant (Anthropic Claude API)
- `functions/geocode.js` - Geocodio API for address geocoding
- `functions/distance.js` - Google Distance Matrix API for driving distances
- `functions/llm-search.js` - LLM search query processing

### Authentication
- Organizations authenticate with passcodes stored in `registered_organizations` table
- User object passed as `loggedInUser` prop throughout the app
- Controls email/PDF permissions
- **Guest access:** Users can browse without login via "Browse Without Account" button
  - Guest user object: `{ id: 'guest', organization: 'Guest', isGuest: true, canEmail: true, canPdf: true }`
    (the `canEmail`/`canPdf` fields are unused/cosmetic — real gating is in `src/config/guestAccess.js` + the server functions)
  - **As of 2026-07-21 guests have full parity with registered orgs:** they can search, view, Send Email, Create PDF, Send Text, and view Reports — the same as a logged-in org. The ONLY difference is the sender identity on sent media: a guest has no org, so guest-sent email/PDF/text is simply signed **"Sent by: Guest"** / **"Prepared by: Guest"** (name only, no phone/email/parent). This is set in AppDataContext's `senderFooter` (`if guest → { name: "Guest" }`); usage logs record guests as `reg_organization: "Guest"` independently. Levers: `GUEST_EMAIL_OPEN`/`GUEST_PDF_OPEN`/`GUEST_TEXT_OPEN` in `src/config/guestAccess.js`; `GUEST_ACTIONS_OPEN` in `functions/sendEmail.js` + `functions/createPdf.js` (must move in lockstep with the client email/PDF flags); Reports opened via `/reports` in `PUBLIC_MAIN_PATH_PREFIXES` (`src/App.js`) + the unauthed `/list-org-colors` Function. (A brief first pass defaulted guest sends to sign as SVdP D3 with a `(G)` marker — reversed same day; see git history / the guest-actions memory.)

### Main Routes
- `/` - Main app (ZipCodePage - single page for all search modes)
- `/reports` - ReportsPage (usage analytics)
- `/announcements` - AnnouncementsPage (announcements history)
- `/privacy` - LegalPage (privacy policy and terms)
- `/support` - SupportPage (contact support)

**Architecture Decision:** Search modes (Zip Code, Organization, Location, LLM) do NOT use routing. They change UI state within NavBar2, but results display is always the same format. This simplifies the codebase significantly.

## Search Modes (NavBar2)

NavBar2 has 4 search modes selected by buttons on the right. Only one can be active at a time. Default is "Zip Code".

### Mode 1: Zip Code (Default)
- **Left frame:** Zip dropdown → Neighborhood link → Distance icon
- **Dropdown populated from:** `zip_codes.zip_code`
- **Filters against:** `directory.client_zip_codes` (multi-value field - one org serves multiple zips)
- **Use case:** "Show me all resources that serve clients in zip code 77025"

### Mode 2: Organization
- **Left frame:** Parent Org dropdown → Child Org dropdown → Distance icon
- **Dropdown populated from:** Organizations derived from `directory` table (computed in AppDataContext)
- **Filters against:** `directory.org_parent` (parent) or `directory.organization` (child)
- **Cascading:** Selecting parent filters child dropdown to only that parent's children
- **Skip allowed:** User can skip parent and select child directly
- **Note:** Most orgs have 1:1 parent/child, but large orgs have many children

### Mode 3: Location
- **Left frame:** County dropdown → City dropdown → Zip dropdown → Neighborhood link → Distance icon
- **Dropdowns populated from:** `zip_codes` table (`county`, `city`, `zip_code` fields)
- **Filters against:** `directory` table (`org_county`, `org_city`, `org_zip_code` fields)
- **Cascading:** County filters City options, City filters Zip options
- **Skip allowed:** User can skip County/City and select Zip directly (shows all zips)
- **Use case:** "Show me all resources physically located in Richmond"

**Location Filtering Logic (most specific wins):**
| User Selection | Filter Applied | Field Mapping |
|----------------|----------------|---------------|
| County only | `org_county === selectedCounty` | `zip_codes.county` → `directory.org_county` |
| City only | `org_city === selectedCity` | `zip_codes.city` → `directory.org_city` |
| Zip only | `org_zip_code === selectedZip` | `zip_codes.zip_code` → `directory.org_zip_code` |
| County + City | City filter (more specific) | |
| City + Zip | Zip filter (most specific) | |
| All three | Zip filter (most specific) | |

**State management:** `selectedLocationCounty`, `selectedLocationCity`, `selectedLocationZip` are stored in `AppDataContext` (not local state) to support email/PDF headers.

### Mode 4: Ask a Question
- **Left frame:** Text input field
- **Uses:** Anthropic API for natural language queries
- **Example:** "food pantry within 5 miles open Thursday morning"
- **id_no lookup:** also understands direct record references, e.g. "Show me id_no 1256, 147, 3" → shows exactly those directory records (regardless of status). Powers the announcement "Link to associated CRG resource" (see Announcements System).

### Distance Calculation

The app calculates distances from a reference point (zip centroid or user-entered address) to each organization.

**Two calculation modes:**

| Mode | Reference Point | Distance Type | API Used | Visual Indicator |
|------|-----------------|---------------|----------|------------------|
| **Default** | Zip code centroid | Straight-line (Haversine) | None (client-side) | No icon |
| **Custom Address** | User-entered address | Driving distance | Google Distance Matrix API | Gold car icon |

**Default behavior (Haversine):**
- Uses stored coordinates: `zip_codes.coordinates` (centroids) and `directory.org_coordinates`
- Calculated client-side using Haversine formula in `src/services/dataService.js`
- Fast, no API cost, but straight-line (not driving distance)
- No visual indicator in results - just distance number

**Custom address behavior (Google Distance Matrix):**
- User clicks the red "Address" chip (in NavBar2 / below NavBar3) → enters address in AddressPanel
- Address geocoded via Geocodio API (`/geocode` endpoint)
- Driving distances fetched via Google Distance Matrix API (`/distance` endpoint)
- Results update with actual driving distances
- **Visual indicator:** Red address-marker icon (matches the Address chip) appears in the Miles column for each row
- The Address chip itself fills in (red bg / white text) when an address is active
- **Clear button:** Immediately reverts to Haversine from centroid; the Miles-column markers and chip fill state revert

**Batching for large result sets:**
- Google Distance Matrix API allows max 25 destinations per request
- `src/services/geocodeService.js` automatically batches requests
- Example: 37 destinations → 2 API calls (25 + 12)

**Filter changes with custom address:**
- When user changes assistance filters while custom address is active
- New records that don't have driving distances are automatically fetched
- Existing driving distances are preserved (merged, not replaced)
- Prevents unnecessary API calls for already-calculated distances

**Key files:**
- `functions/distance.js` - Cloudflare Function calling Google Distance Matrix API
- `src/services/geocodeService.js` - `getDrivingDistances()` function with caching and batching
- `src/views/ZipCodePage.js` - useEffect fetches driving distances when `clientCoordinates` is set
- `src/Contexts/AppDataContext.js` - `drivingDistances` state (Map of record id → miles)
- `src/components/AddressPanel.js` - Address entry panel with Clear button
- `src/icons/HomeMarkerIcon.jsx` - Map-pin teardrop used by the Address chip and the Miles-column driving-distance indicator

**Google Distance Matrix API:**
- Pricing: $5 per 1,000 elements ($200/month free = ~40,000 elements)
- 1 element = 1 origin × 1 destination
- Typical search: 1 origin × 25 destinations = 25 elements = 1 API request
- Monitor usage: Google Cloud Console → APIs & Services → Quotas → Distance Matrix API
- Environment variable: `GOOGLE_MAPS_API_KEY` in `.dev.vars` and Cloudflare

**API Key Security:**
- Application restrictions: None (required for server-side Cloudflare Functions)
- API restrictions: Limited to Distance Matrix API only
- Daily quota: 1,000 elements/day (configurable in Google Cloud Console)
- Key stored in Cloudflare environment variables (never exposed to browser)

**Design Decision:** Haversine for default searches is intentional - it's fast, free, and good enough for most use cases. Users who need accurate driving distances can enter a custom address. This balances user experience with API costs.

### Dropdown Behavior
- Standard `<select>` with type-ahead (browser native: type "Ri" jumps to Richmond)
- May enhance to combobox pattern later for richer filtering

## Assistance Types (NavBar3)

NavBar3 provides filtering by assistance type via a dropdown panel. This is independent of search modes - assistance filters can be applied regardless of which search mode is active.

### Selection Rules
- **Up to 3 types from ANY combination of groups** - can pick across multiple groups
- **OR all types from ONE group** - clicking group button selects entire group (even if >3 items)
- When a full group is selected, other groups are disabled until deselected

### Panel Visual States
Types in the panel have two states:
| State | Background | Text |
|-------|------------|------|
| Unselected | Group color (pink, blue, yellow, green, brown) | Black |
| Selected | White | Black |

### NavBar3 Chip Visual States
Chips in NavBar3 have two states:
| State | Background | Text | Effect |
|-------|------------|------|--------|
| Inactive | White | Black | Not filtering results |
| Active | Teal (`#005C72`) | White | Filtering results to this type |

### Panel Behavior
1. **Open panel:** Click "Select Assistance" or "Change Assistance" button
2. **Panel shows current selections:** Previously saved selections appear as white bg
3. **Toggle items:** Click to select/deselect individual types
4. **Group button:** Toggles all items in that group (select all / deselect all)
5. **Cancel:** Closes panel, reverts to previous selections
6. **Save:** Applies selections to NavBar3 chips

### NavBar3 Chip Behavior
- **All selections auto-activate:** When saved, all selected chips turn teal and filter immediately
- **Click chip:** Toggles between active (teal) and inactive (white)
- **Multiple active:** Allowed - results show resources matching ANY active type
- **First multi-selection:** Opens Quick Tips sidebar to "Assistance Types" section (once per session)

### Session Persistence
- Selections persist while navigating between search modes (Zip Code, Organization, Location, LLM)
- Selections clear on logout or session expiry (2am daily reset)
- No bookmark/save feature - intentional to ensure users see all options each session

### 6 Groups (28 types total) - Dynamic from Supabase
Groups are **evergreen** - determined by the `group` field in the `assistance` table. Code automatically adapts if groups are added/removed or types are moved between groups.

- **Group 1** (Yellow): Rent, Utilities, Food, Clothing
- **Group 2** (Purple): Homeless - Shelters, Homeless - Day Centers, Homeless - Other, Housing
- **Group 3** (Pink): Medical - Primary Care, Medical - Dental & Vision, Medical - Mental Health, Medical - Addiction Recovery, Medical - Program Enrollment, Medical - Bill Payment
- **Group 4** (Green): Domestic Abuse - Shelters, Domestic Abuse - Other, Education - Children, Mother & Child
- **Group 5** (Cyan): Education - Adults, Jobs, Transportation, Legal, Immigration
- **Group 6** (Orange): Seniors, Handyman, Animals, Christmas, Other

Each type has an icon in `/src/icons/` mapped via `src/icons/iconMap.js`.

## Supabase Tables (7 tables total)

All tables are synced from the Google Sheets master data via `npm run sync` (`scripts/sync-to-supabase.js`). The sync is a generic passthrough — whatever columns exist in a sheet tab land in the matching Supabase table (columns must exist in Supabase first via `ALTER TABLE`). The 7 synced tables: `directory`, `zip_codes`, `assistance`, `organizations`, `registered_organizations`, `announcements`, `zip_code_data`.

### `directory` (main resources table - ~836 records, expect ~1000)
This is the primary data displayed in results. All filtering happens against this table.

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id_no` | int4 | `1` | Primary key |
| `organization` | text | `"3 \"A\" Bereavement Foundation (3ABF)"` | Child org name |
| `org_parent` | text | `"3 \"A\" Bereavement Foundation (3ABF)"` | Parent org name |
| `client_zip_codes` | json array | `["77002", "77003", ...]` | Zips this org SERVES (Zip Code search) |
| `org_address1` | text | `"5330 Griggs Road"` | Street address |
| `org_address2` | text | `"Suite A108"` | Suite/unit (nullable) |
| `org_city` | text | `"Houston"` | City |
| `org_state` | text | `"TX"` | State |
| `org_zip_code` | text | `"77021"` | Org's physical zip (Location search) |
| `org_county` | text | `"Harris"` | County |
| `org_telephone` | text | `"713-649-3232"` | Phone |
| `org_hours` | json | `{"regular":[...]}` | Hours in JSON format |
| `hours_notes` | text | `"Open until midnight"` | Additional hours info |
| `assist_id` | text | `"65"` | FK to assistance.assist_id |
| `assistance` | text | `"Other"` | Assistance type name (denormalized) |
| `status_id` | int4 | `1` | 1=Active, 2=Limited, 3=Inactive |
| `status` | text | `"Active"` | Status label |
| `status_date` | text | `"05/12/2025"` | Last verified date |
| `status_text` | text | `"verified online"` | Verification note |
| `requirements` | text | Multi-line | Eligibility requirements |
| `webpage` | text | URL | Organization website |
| `googlemaps` | text | URL | Google Maps link |
| `org_email` | text | Email | Contact email (nullable) |
| `org_coordinates` | text | `"29.6967871, -95.3336860"` | Lat/long for distance calc |
| `org_neighborhood` | text | `"South Side"` | Neighborhood name |
| `zip_neighborhoods` | text | `"MacGregor, Riverside..."` | Neighborhoods served |

**Field name mapping (mock data → Supabase):**
- `hours` → `org_hours`
- `distance` → calculated at runtime from `org_coordinates`

### `assistance` (28 records - static)
| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id_no` | int4 | `11` | Primary key (auto-increment) |
| `group` | text | `"1"` | Group number 1-6 |
| `assistance` | text | `"Rent"` | Display name |
| `icon` | text | `"RentIcon"` | Maps to icon component |
| `assist_id` | text | `"11"` | Used for filtering (matches directory.assist_id) |

### `zip_codes` (269 records - static)
| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id_no` | int4 | `7` | Primary key |
| `zip_code` | text | `"77002"` | The zip code |
| `city` | text | `"Houston"` | City name |
| `county` | text | `"Harris"` | County name |
| `state` | text | `"TX"` | State |
| `houston_area` | text | `"Y"` | Is in Houston area |
| `coordinates` | text | `"29.756845, -95.365652"` | Centroid for distance calc |
| `zip_link` | text | URL | Reference link |
| `neighborhood` | text | `"Downtown, East Downtown..."` | Neighborhoods in this zip |
| `county_city_zip` | text | `"Harris \| Houston \| 77002"` | Combined display |
| `county_city_zip_neighborhood` | text | Full combined string | For dropdowns |

### `organizations` (~452 records - one row per child org)
Synced from the `organizations` sheet tab. Distinct from the directory-derived org list used for NavBar2 dropdowns — this is the real table, loaded via `dataService.getOrganizations()` and used in `AppDataContext` (e.g. `senderChildren`, per-org block flag). One row per child organization.

**Columns for Opportunity Scan (Omar is adding these to the sheet tab + Supabase, July 2026):**
| Field | Type | Notes |
|-------|------|-------|
| `scan` | integer, default 0 | Org-check tier. **0** = never proactively checked by name — as if the row didn't exist for org checks (but STILL included in cross-reference matching: a news hit on a scan=0 org is still tagged "IN CRG — update existing record"). **1** = rotating by-name news check on rotation Mondays (full cycle **twice a year**). **2** = monthly page scan on the first Monday of each month. **3** = quarterly page scan on the second Monday of each quarter's first month (Jan/Apr/Jul/Oct). On page-scan days rotation pauses — only that tier gets org checks. Omar manages flags so scan=2 AND scan=3 each resolve to **≤40 distinct org_url values** (all homepage-level; as of July 2026: ~40 twos, ~40 threes, ~348 ones) — the code never reasons about parent/child, it just does `SELECT DISTINCT org_url WHERE scan = 2` (or 3). |
| `org_url` | text | Highest-level (parent) HOMEPAGE URL. **Added to the sheet July 2026.** Repeated on every child row of the same parent — all 4 locations of a parent carry the same org_url. |

**Parent/child + URL idiosyncrasies (matter for the scan):**
- A "child" can be a **program** (veterans, food pantry, rent…) — each program row in `directory` usually has its own `webpage` URL
- A "child" can be a **location/branch** — sometimes each location has its own page (distinct `webpage` values), sometimes all locations share one page (identical `webpage` on all rows, may equal `org_url`)
- Therefore: **never treat org rows and URLs as 1:1.** Always `DISTINCT` URLs before fetching, and map a finding on a shared URL back to ALL child rows/locations that carry it.

### `zip_code_data` (census/demographic data by zip)
Synced from the `zip_code_data` sheet tab (primary key `id`). Rate fields stored as fractions (e.g. `0.194` = 19.4%). Used by Reports map (`src/components/reports/MapboxMapV2.js`) for medians and bivariate map codes (e.g. `fvi_map_code`).

### `registered_organizations` (auth - implement last)
| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id_no` | int4 | `1042` | Primary key |
| `reg_organization` | text | `"Christian Community..."` | Org name for login |
| `org_passcode` | text | `"he3aq6"` | Login passcode |
| `org_color` | text | `"#FF7C7C"` | Branding color |

**Note:** sync applies `transformRegisteredOrg` (PBKDF2 passcode hashing, primary key `account_id`) — the raw sheet columns above may predate that transform; verify against the live table when working on auth.

## Styling

**Design Tokens** (`src/styles/tokens.css`):
All design values defined as CSS custom properties, referenced by Tailwind config.

**Current tokens:**
- Footer: `--color-footer-bg: #B8001F`, `--color-footer-text: #FFFFFF`, `--height-footer: 30px`
- Vertical Nav: `--color-vertical-nav-accent: #948979`, `--color-vertical-nav-bg: #222831`
- Vertical Nav sizing: `--width-vertical-nav-accent: 20px`, `--width-vertical-nav-main: 60px`
- Icons: `--size-vertical-nav-icon: 35px`, `--gap-vertical-nav-icons: 25px`
- NavBar3: `--color-navbar3-bg: #948979`, `--height-navbar3: 60px`, `--height-navbar3-btn: 35px`
- NavBar3 chips: `--color-navbar3-chip-active-bg: #005C72`, `--color-navbar3-chip-inactive-bg: #FFFFFF`
- NavBar3 spacing: `--padding-navbar3-left: 20px`, `--gap-navbar3-button-chips: 40px`, `--gap-navbar3-chips: 15px`
- Panel/Modal: `--color-panel-header-bg: #4A4F56`, `--color-panel-body-bg: #948979`, `--height-panel-header: 70px`
- Panel buttons: `--color-panel-btn-cancel-bg: #FF0000`, `--color-panel-btn-ok-bg: #3DB800`, `--width-panel-btn: 100px`
- Assistance groups: `--color-assistance-group1` through `--color-assistance-group6` (see tokens.css)
- Results Header: `--color-results-header-bg: #B8001F`, `--height-results-header: 30px`
- Results Row: Alternating colors `--color-results-row-even-bg: #F0F8FF`, `--color-results-row-odd-bg: #F0FFF0`, `--color-results-row-selected-bg: #FEF0FF`
- Results Row elements: `--size-results-checkbox: 20px`, `--radius-results-status-pill: 25px`, `--color-results-checkbox-checked: #228B22`
- Results status pills: `--color-results-status-active-bg: #8FBC8F`, `--color-results-status-limited-bg: #FFDA6A`, `--color-results-status-inactive-bg: #E74C3E`
- Hours notes: `--color-results-hours-notes-bg: #FFB302` (gold)
- Results icons: `--color-results-assistance-icon: #B8001F` (primary), `--color-results-assistance-icon-secondary: #999999` (gray)
- Expand/collapse: `--color-results-expand-chevron: #FF0004`, `--color-results-distance-label: #666666`
- Tooltip: `--color-tooltip-bg: #1F2937`, `--color-tooltip-text: #FFFFFF`, `--font-size-tooltip: 12px`

**Fonts:** (only these two — standardized June 2026; Lexend/Montserrat/Marcellus SC/Lora all removed)
- Open Sans (body - the single primary font for ALL UI, weights: 400, 500, 600, 700). Applied app-wide via the `font-opensans` root wrapper in `App.js` + `--font-family-body`. The `body`/`lexend` Tailwind aliases are kept for back-compat but now map to Open Sans.
- Comfortaa (title only - "Community Resources Guide Houston")

**Hover Effects:**
- Standardized across all components: `hover:brightness-125`
- Applies to: buttons, dropdowns, links, icons

**Brand colors:**
- `#222831` (dark charcoal - NavBar1 bg, vertical nav main)
- `#4A4F56` (medium charcoal - NavBar2 bg)
- `#948979` (tan - vertical nav accent stripe)
- `#652C57` (purple - active search mode button)
- `#005C72` (teal - dropdown bg)
- `#FFC857` (gold - accent, active text, Send Email button)
- `#EB6E1F` (orange - filtered count)
- `#00A8A8` (teal - selected count)
- `#228B22` (green - Create PDF button)
- `#B8001F` (red - footer, inactive vertical nav icons)
- `#5cb800` (green - active vertical nav icons)
- `#8FB6FF` (light blue - neighborhood hyperlink)

## Email & PDF System

### Architecture
- **Email Templates:** React Email components (`src/emails/`)
- **Email Service:** Resend API via Cloudflare Function (`functions/sendEmail.js`)
- **PDF Service:** PDFShift API via Cloudflare Function (`functions/createPdf.js`)
- **Translation Service:** Google Cloud Translation API v2 via Cloudflare Function (`functions/translate.js`)
- **From Address:** `info@crghouston.org` (configured in Resend)
- **Email Service Module:** `src/services/emailService.js` - Centralized email/PDF logic
- **UI Components:**
  - `src/components/EmailPanel.js` - Dropdown panel UI for email/PDF entry with preview and language selector
  - `src/components/DropPanel.js` - Reusable dropdown panel component (shared styling)

### React Email Integration (January 2026)
Email templates are built using [React Email](https://react.email) for better maintainability and cross-client compatibility.

**Template Structure:**
```
src/emails/
├── ResourceEmail.jsx       # Main email template
├── components/
│   ├── ResourceCard.jsx    # Individual resource display
│   └── HoursTable.jsx      # Hours formatting component
├── index.js                # Exports
└── README.md               # Integration docs
```

**Key Files:**
- `src/emails/ResourceEmail.jsx` - Main email template component
- `src/services/emailService.js` - Uses `render()` from `@react-email/components`

**Development Preview:**
```bash
npm run email:dev
```
Opens preview server at http://localhost:3001 to test email templates without sending.

**Benefits:**
- Component-based templates (easier to maintain)
- Cross-client compatibility (Gmail, Outlook quirks handled automatically)
- Preview before sending (in EmailPanel)
- Spam score checking available

### Email/PDF Panel UI (2026 Redesign)
The email and PDF buttons in NavBar1 now use dropdown panels instead of modal popups.

**Panel Flow:**
1. User clicks "Send Email" or "Create PDF" button in NavBar1
2. If no records selected → Toast error, panel doesn't open
3. If inactive resources selected → Warning panel appears first
4. Warning panel: Cancel returns to results, Continue proceeds to input panel
5. Email panel: Enter recipient email, click "Show Preview" to see email, click Send
6. PDF panel: Confirmation message, click OK to create

**Panel Styling (consistent across all panels):**
- Header: `#4A4F56` bg, 70px height, gold title text
- Body: `#948979` (tan) bg
- Border: 2px white (`--color-panel-border`) - provides visual separation from NavBar2
- Buttons: Cancel (red `#FF0000`), OK/Send (green `#3DB800`), 100x38px
- Drop position: Below trigger button with 25px margin

**Panels using this pattern:**
- Distance panel (NavBar2) - uses `DropPanel`
- Assistance panel (NavBar3) - custom render with same tokens
- Email entry panel (NavBar1) - uses `DropPanel` via `EmailPanel`
- PDF confirmation panel (NavBar1) - uses `DropPanel` via `EmailPanel`
- Inactive warning panel (NavBar1) - custom render in `EmailPanel`

**Design Tokens for panels:**
- `--color-panel-header-bg: #4A4F56`
- `--color-panel-body-bg: #948979`
- `--color-panel-title: #FFC857`
- `--color-panel-border: #FFFFFF`
- `--width-panel-border: 2px`
- `--height-panel-header: 70px`
- `--radius-panel: 5px`

### Shared Formatters (`src/utils/formatters.js`)
Centralized formatting utilities used by both ResultRow (screen) and EmailDialog (email/PDF):
- `formatHoursFromJson(hoursJson)` - Parses JSON hours to structured display data
- `formatAddress(record)` - Returns array of address lines from org_address1, org_address2, city/state/zip
- `formatAddressHtml(record)` - Returns address with `<br/>` tags for HTML
- `formatDistance(distance)` - Formats as "X.X miles"
- `parseRequirements(requirements)` - Splits requirements text into array
- `formatIconName(iconName)` - Converts "DomesticAbuseOtherIcon" to "Domestic Abuse Other"

### Email Format (2026 Redesign)
Single-column, mobile-friendly layout:
```
Resources for Zip Code: 77003

[Intro paragraph with disclaimer]

Assistance: Rent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Organization Name (blue underlined link)
   713-555-1234 (bold, 16px)

   3.7 miles
   123 Main Street (blue underlined link to Google Maps)
   Houston, TX 77003

   Mon, Wed, Fri:  10:00 a.m. to 1:30 p.m
   Sat:            7:00 a.m. to 12:30 p.m
   By appointment only. (red italic)

   Important Details:
   • Requirement 1
   • Requirement 2

[Closing with callback phone number]
[Footer with logo]
```

**Key Design Decisions:**
- Single column for mobile compatibility (email clients have poor CSS support)
- Org name and address are blue underlined hyperlinks (#0066cc)
- Phone number prominent (same size as org name, bold)
- Distance placed above address (related to location)
- Hours notes in red italic (no border - email client compatibility)
- Grouped by assist_id, sorted by assist_id → distance within groups
- Status field removed from email (warning shown before send if Inactive selected)
- **"Bus Route" pill below the address** (both email and PDF) — outlined red pill linking to Google Maps `travelmode=transit`. **Origin is intentionally omitted from sent media (email, PDF, SMS share link)** so Google Maps prompts the recipient for their own starting point. This is a deliberate privacy decision: an earlier version embedded the sender's `clientCoordinates` (typically one client's address) as origin, which created a real risk of leaking that address into another client's email/PDF/text. After review, omit-from-sent-media was chosen over the convenience of pre-filled origin. All inline styles only — falls back gracefully to a plain red "Bus Route" hyperlink if an email client strips the border/padding. Implementation: `buildTransitDirectionsUrl()` in `src/utils/transitUrl.js` is reused across the on-screen row, SMS share link, email, and PDF; **the on-screen Bus Route still uses `clientCoordinates` as origin** (no recipient involved, no privacy risk) — only the sent-media callers omit it.

### Dynamic Email/PDF Headers
The header text changes based on the active search mode. Uses "most specific wins" logic.

**Header by Search Mode:**
| Search Mode | Selection | Header Text |
|-------------|-----------|-------------|
| Zip Code | 77025 | "Resources for Zip Code: 77025" |
| Organization | Parent only | "Resources for Organization: [Parent Name]" |
| Organization | Child only | "Resources for Organization: [Child Name]" |
| Organization | Both | "Resources for Organization: [Child Name]" |
| Location | County only | "Resources for Location: Harris" |
| Location | City only | "Resources for Location: Houston" |
| Location | Zip only | "Resources for Location: 77002" |
| Location | County + City | "Resources for Location: Houston" |
| Location | City + Zip | "Resources for Location: 77002" |
| Ask a Question | Query text | "Resources for: [query]" |
| Ask a Question | No query | "Search Results" |

**PDF Filename:** Uses same logic - `CRG - [Header Text] - YYYY-MM-DD.pdf`

**Implementation:** `generateSearchHeader(searchContext)` in `src/services/emailService.js`

### PDF Format (2026 Redesign)
PDF uses a different layout than email - optimized for printing (multi-column, dense layout).

**Key Differences from Email:**
- **Email:** Single column, vertical layout (mobile-friendly for phone users)
- **PDF:** 3-column layout (print-optimized, paper-efficient for walk-in clients)

**PDF Layout Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Community Resources Guide Houston      (PAGE 1 ONLY) │
│        Resources for [Search Mode]: [Value]                 │
│        Generated: MM/DD/YYYY                                │
│        By: [Registered Org Name]                            │
├─────────────────────────────────────────────────────────────┤
│ [Disclaimer paragraph]                        (PAGE 1 ONLY) │
│                                                             │
│ Assistance: [Type]                                          │
│ ┌──────────────────────────────┬────────────────────────────┤
│ │ 1. Org Name (link)           │ 713-271-4290 (bold, right) │
│ │    Address Line 1  2.7 miles │ Mon, Wed, Fri: 10-1:30     │
│ │    City, State Zip           │ By appointment only (red)  │
│ ├──────────────────────────────┴────────────────────────────┤
│ │ Important Details:                                        │
│ │ • Requirement 1                                           │
│ │ • Requirement 2                                           │
│ └───────────────────────────────────────────────────────────┘
├─────────────────────────────────────────────────────────────┤
│                              Page 1 of 2 (FOOTER - repeats) │
└─────────────────────────────────────────────────────────────┘
```

**3-Column Row Layout:**
- **Left column (55%):** Number + Org name (link), address (link to Google Maps), distance (italic gray, right of address)
- **Right column (45%):** Phone (bold, right-aligned), hours table (right-aligned), hours notes (red italic)
- **Full-width bottom:** "Important Details:" + bulleted requirements (no border separator)

**Sort Order:** assist_id (ascending) → distance/miles (ascending)

**Hyperlinks:**
- Org name → `webpage` field (organization website)
- Address → `googlemaps` field (Google Maps link)

**Implementation:**
- `formatPdfResourcesHtml()` in `src/services/emailService.js` - PDF-specific 3-column layout
- `formatResourcesHtml()` in `src/services/emailService.js` - Email single-column layout
- `createPdf()` - Assembles HTML and calls PDFShift API

### Development Workflow
**Two-terminal setup for local development:**
```bash
# Terminal 1 - React dev server (hot reload for UI changes)
npm start

# Terminal 2 - Wrangler for Cloudflare Functions (API calls)
npx wrangler pages dev ./functions --port 8788
```

Access app at `http://localhost:3000`. The app automatically routes API calls to `localhost:8788`.

**When to restart Wrangler:**
- Changes to `.dev.vars` (API keys) require Wrangler restart
- Changes to React components (EmailDialog.js) hot reload automatically

### API Keys Configuration
**Local development:** `.dev.vars` file (not committed)
```
RESEND_API_KEY=re_xxxxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SECRET_KEY=xxx
PDFSHIFT_API_KEY=xxx
GEOCODIO_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
GOOGLE_MAPS_API_KEY=xxx
GOOGLE_TRANSLATE_API_KEY=xxx
```

**Production:** Cloudflare dashboard → Pages → Settings → Environment variables

### Translation System (March 2026)

The email and PDF system supports translation to Spanish (and other languages) using Google Cloud Translation API v2. Translation happens as a post-processing step — HTML content is assembled in English first, then translated with HTML tag preservation before sending.

**How it works:**
1. User selects "Español" from language dropdown in EmailPanel (visible in both email and PDF modes)
2. For email: preview translates live when language changes (with "Translating..." overlay)
3. On send/create: `emailService.js` calls `translateHtml()` which sends assembled HTML to `/translate` Cloudflare Function
4. Cloudflare Function calls Google Cloud Translation API v2 with `format=html` (preserves all HTML tags)
5. Translated HTML is used for the email body / PDF content
6. Email subject line is also translated; PDF filename stays English (filesystem compatibility)
7. If translation fails for any reason, the email/PDF is sent in English (graceful fallback)

**Language selector UI:**
- Dropdown with "English" / "Español" options
- Styled with teal background (`#005C72`) matching other dropdowns
- Visible in both email and PDF panel modes
- Resets to English each time panel opens

**Email preview translation:**
- When language is switched to Español with preview open, the preview iframe updates to show translated content
- Uses same `/translate` endpoint as send flow
- "Translating..." overlay appears during translation
- Falls back to English preview if translation fails
- Switching back to English is instant (uses cached original HTML, no API call)

**Data flow for language parameter:**
`EmailPanel` (language state) → `onSend(recipient, language)` → `NavBar1` (passes through) → `ZipCodePage` handler → `emailService.sendEmail/createPdf({ language })`

**Key files:**
- `functions/translate.js` - Cloudflare Function calling Google Cloud Translation API v2
- `src/components/EmailPanel.js` - Language dropdown + translated preview
- `src/services/emailService.js` - `translateHtml()` helper, used by both `sendEmail()` and `createPdf()`

**Google Cloud Translation API v2:**
- Pricing: $20 per million characters (first 500,000 chars/month free)
- Quota: Set to 50,000 characters/day in Google Cloud Console (adjustable)
- When quota is exceeded, translation fails gracefully and content is sent in English
- API key restricted to Cloud Translation API only
- Environment variable: `GOOGLE_TRANSLATE_API_KEY` in `.dev.vars` and Cloudflare
- Google Cloud Console: APIs & Services → Cloud Translation API → Quotas & System Limits

**Adding more languages:**
To add another language, add an `<option>` to the language `<select>` in `EmailPanel.js` with the Google Translate language code (e.g., `fr` for French, `zh` for Chinese). No other code changes needed — the translation function and Cloudflare Function are language-agnostic.

## Toast Notifications

The app uses `react-hot-toast` for user feedback notifications with custom animated styling.

### Architecture
- **Library:** react-hot-toast
- **Provider:** `<Toaster position="top-center" />` in `MainApp.js`
- **Custom styling:** Animated toasts using Framer Motion in `ZipCodePage.js`

### Usage Pattern
```javascript
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";

// Custom animated toast helper
const showAnimatedToast = (msg, type = "success") => {
  toast.custom(() => (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 400, opacity: 1 }}
      exit={{ y: 300, opacity: 0 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      className={`px-6 py-4 rounded-lg shadow-lg text-lg font-semibold text-white ${
        type === "error" ? "bg-red-500" : "bg-green-600"
      }`}
    >
      {msg}
    </motion.div>
  ));
};
```

### When Toasts Appear
- **Email sent:** Green success toast "✅ Email sent successfully."
- **PDF created:** Green success toast "✅ PDF created successfully in your Download Folder."
- **No selection error:** Red error toast when user tries to email/PDF without selecting records

### Design Notes
- Toasts animate from top, slide down, then fade out
- Duration: 1.5 seconds ease-out transition
- Success: Green background (`bg-green-600`)
- Error: Red background (`bg-red-500`)
- Positioned at top-center of screen

## Announcements System

Announcements are messages posted by the administrator to notify users of important information. They appear automatically on login and are accessible from the vertical navbar.

### Behavior
- **On login:** Active announcements display one at a time in a modal popup
- **Active window:** Announcements show when current date is between `start_date` and `expiration_date`
- **After expiration:** No longer shows on login, but remains accessible via Announcements icon in vertical navbar
- **MessagesPage (`/messages`):** Shows history of all announcements

### Data Management
Announcements are managed in Google Sheets (same spreadsheet as directory data) and synced to Supabase via `npm run sync`.

**Google Sheet tab:** `announcements`

**Column Structure:**
| Column | Field | Notes |
|--------|-------|-------|
| A | start_date | MM/DD/YYYY - when announcement becomes visible |
| B | expiration_date | MM/DD/YYYY - when it stops showing on login |
| C | audience_code | "1-All CRG Users", "2-Registered Organizations", "3-Specific org" |
| D | reg_organization | Only used when audience_code starts with "3" |
| E | title | Announcement title (appears in Subject: line) |
| F | format_1 | Format codes for para_1 (optional) |
| G | para_1 | First paragraph text |
| H | format_2 | Format codes for para_2 (optional) |
| I | para_2 | Second paragraph text |
| J | format_3 | Format codes for para_3 (optional) |
| K | para_3 | Third paragraph text |
| L | format_4 | Format codes for para_4 (optional) |
| M | para_4 | Fourth paragraph text |
| … | directory_id_no | Optional. Comma-separated directory `id_no` values (e.g. `1256, 147, 3`). See "Link to associated CRG resource" below. |

**Link to associated CRG resource (`directory_id_no`):**
For a time-sensitive resource already in the `directory` table, list its `id_no`(s) in the
`directory_id_no` column (comma-separated). The sync script appends a single centered link —
**"Link to associated CRG resource"** — at the bottom of the announcement. Clicking it runs a
normal **"Ask a Question"** search for those records (query: `Show me id_no 1256, 147, 3`) in the
same tab and closes the popup, so the user lands on the results with those resources shown, ready
to select and Email/PDF.
- **No new capability is special-cased:** anyone can type `Show me id_no 1256, 147, 3` into Ask a
  Question and get the same result — the link just auto-types it. The `/llm-search` function
  understands id_no lookups (`id_nos` in its tool schema); `applyLLMFilters` filters on `id_no`.
- **Works for everyone** (guests and registered orgs) and **preserves the session** — the link is
  internal/same-tab and never uses `guest=1` (which would downgrade a registered user and block
  Email/PDF). Implementation: `buildResourceLink()` in `scripts/sync-to-supabase.js` generates the
  link; `src/hooks/useResourceLinkHandler.js` intercepts the click.
- `directory_id_no` is consumed at sync time only — the ids are baked into the generated link, so
  there is no `directory_id_no` column in the Supabase `announcements` table.

**Format Codes (comma-separated in format columns):**
| Code | Effect |
|------|--------|
| `bold` | Bold text |
| `italic` | Italic text |
| `underline` | Underlined text |
| `bullet` | Each line becomes a bullet point |
| `link` | Whole paragraph becomes a clickable hyperlink (para cell uses `Display text \| URL`; no pipe → bare URL is the link text). Opens in a new tab. |
| 6-char hex (e.g., `B8001F`) | Text color |

**Examples:**
- `bold, italic` → Bold and italic
- `bullet` → Bulleted list
- `B8001F` → Red text
- `bold, B8001F` → Bold red text
- `link` with para `Register here | https://example.com` → "Register here" clickable link
- `link, bold` with para `https://example.com` → bold link, URL shown as the text
- (blank) → Default styling (regular weight, black)

**Audience Codes:**
| Code | "To:" field displays | Who sees it |
|------|---------------------|-------------|
| 1 | "All CRG Users" | Everyone (including guests) |
| 2 | "Registered Organizations" | Logged-in users (not guests) |
| 3 | Value from reg_organization | Specific organization only |

Note: Guest-only code was removed (redundant - only one Guest account exists).

### Supabase Table: `announcements`

| Field | Type | Notes |
|-------|------|-------|
| `id_no` | SERIAL | Primary key (auto-generated) |
| `start_date` | DATE | When visible |
| `expiration_date` | DATE | When stops showing on login |
| `audience_code` | INTEGER | 1-3 (see above) |
| `reg_organization` | TEXT | Org name when audience_code=3 |
| `title` | TEXT | Announcement title |
| `message_html` | TEXT | Generated HTML from format/para columns |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-set |

### Sync Script
The `scripts/sync-to-supabase.js` script includes a `transformAnnouncement()` function that:
1. Extracts audience code from "1-All CRG Users" → `1`
2. Parses dates from MM/DD/YYYY to YYYY-MM-DD
3. Converts format/para column pairs into a single `message_html` field
4. Applies format codes as inline CSS styles

**Key Files:**
- `src/components/AnnouncementPopup.js` - Modal popup component
- `src/components/AnnouncementManager.js` - Orchestrates fetching and sequential display
- `src/services/AnnouncementService.js` - Supabase query logic
- `src/views/AnnouncementsPage.js` - Announcements history page
- `scripts/sync-to-supabase.js` - Includes announcement sync with HTML generation

## Sync Gotcha: "Loading..." in synced fields (RECURRING)

**Symptom:** Some records show the literal text `Loading...` (or `Loading . . .`) in the Hours column (or any other field) instead of their real value.

**Cause:** The sync script snapshots whatever each Google Sheet cell *currently shows*. Formula-driven cells (`IMPORTRANGE`, `GOOGLETRANSLATE`, `ARRAYFORMULA`, etc.) display the literal text `Loading...` while still recalculating — they re-fetch on sheet open and after edits. If `npm run sync` runs during that window, it writes `Loading...` into Supabase. For `org_hours`, this then renders as-is via the formatter's legacy/raw-string fallback ([formatters.js](src/utils/formatters.js)). **This is a data/sync timing issue, not a code bug** — the string `Loading...` does not exist anywhere in the codebase.

**Fix:** Wait for the sheet to fully settle (no cell anywhere shows `Loading...`) before running `npm run sync`. After syncing, verify clean:
```sql
SELECT id_no, organization FROM directory WHERE org_hours ILIKE '%Loading%';
```
Zero rows = clean. (Has happened more than once — the fix is always the same: re-sync from a settled sheet.)

## Help System (LLM-Powered)

The Help system provides an AI-powered chat assistant that helps users learn how to use the CRG app. It uses Claude (Anthropic API) to answer questions with contextual, visual responses.

### ⚠️ PRIMARY DIRECTIVE: Strengthen Help System Intelligence

**The primary goal is to make the Help system smarter and more accurate over time.** The system should learn how the CRG app works and provide increasingly helpful, contextually appropriate responses.

**When reviewing change requests, warn the user if a proposed change would:**
- Over-constrain the LLM's ability to adapt responses to user questions
- Remove flexibility in favor of rigid, scripted answers
- Prevent the system from synthesizing information naturally
- Stifle the LLM's reasoning capabilities

**The balance to maintain:**
- **Accurate facts on day one** - Users must not get incorrect information that damages trust
- **Flexible enough to adapt** - Don't over-script; let the LLM reason about edge cases
- **Improve through iteration** - Use logged queries to identify gaps and update the system prompt

### Architecture
- **Backend:** Cloudflare Function (`functions/help.js`) calls Anthropic API
- **Frontend:** `src/components/HelpPanel.js` - draggable chat panel
- **Icon:** `src/icons/HelpBubbleIcon.jsx` - speech bubble with "?" in liquid glass style
- **Model:** Claude 3.5 Haiku (fast, cost-effective for help queries)
- **Logging:** Queries logged to `help_logs` Supabase table for improvement tracking

### How It Works
1. User clicks the Help icon (speech bubble with ?) in the vertical nav bar
2. HelpPanel opens - draggable, non-modal (user can interact with app while open)
3. User types a question or clicks a suggested question
4. Question is sent to `/help` Cloudflare Function with conversation history
5. Claude responds using the system prompt that describes the app
6. Response includes visual tokens that render as actual UI elements

### Visual Tokens
The system prompt instructs Claude to use visual tokens that render as miniature UI elements in chat responses. This helps users identify exactly what to click.

**Available tokens (defined in HelpPanel.js ICON_MAP):**

| Token | Renders As | Description |
|-------|------------|-------------|
| `[[ORANGE_CIRCLE]]` | Orange circle with "5" | Filtered results counter |
| `[[BLUE_CIRCLE]]` | Blue circle with "2" | Selected results counter |
| `[[EMAIL_BTN]]` | Gold "Send Email" button | Email button |
| `[[PDF_BTN]]` | Purple "Create PDF" button | PDF button |
| `[[ZIP_CODE_BTN]]` | Dark button "Zip Code" | Active search mode |
| `[[ORGANIZATION_BTN]]` | Gray button "Organization" | Inactive search mode |
| `[[LOCATION_BTN]]` | Gray button "Location" | Inactive search mode |
| `[[ASK_QUESTION_BTN]]` | Gray button "Ask a Question" | Inactive search mode |
| `[[ZIP_DROPDOWN]]` | Green dropdown "77002 ▾" | Zip code selector |
| `[[LLM_INPUT]]` | Teal field "What are you looking for today?" | Ask a Question input field |
| `[[SELECT_ASSISTANCE_BTN]]` | Tan button "Select Assistance ▾" | Assistance panel trigger |
| `[[CHIP_ACTIVE]]` | Green chip "Food" | Active assistance filter |
| `[[CHIP_INACTIVE]]` | White chip "Rent" | Inactive assistance filter |
| `[[HOME_ICON]]` | Home icon (green) | Reset/home navigation |
| `[[INFO_ICON]]` | Help bubble icon (green) | Help panel trigger |
| `[[REPORTS_ICON]]` | Reports icon (green) | Reports navigation |
| `[[DISTANCE_ICON]]` | Pin emoji on gray bg | Distance override |
| `[[FOOD_ICON]]` | Food assistance icon | Assistance type |
| `[[RENT_ICON]]` | Rent assistance icon | Assistance type |
| `[[UTILITIES_ICON]]` | Utilities assistance icon | Assistance type |

### Design Tokens (tokens.css)
```css
--width-help-panel: 700px;
--height-help-panel: 800px;
--height-help-header: 50px;
```

### System Prompt Location
The system prompt that teaches Claude about the app is in `functions/help.js` as `HELP_SYSTEM_PROMPT`. Edit this to:
- Update when UI changes
- Add new features
- Improve response quality
- Add new visual tokens

### Panel Features
- **Draggable:** Drag header to reposition
- **Non-modal:** User can interact with app while panel is open
- **Conversation history:** Last 6 messages sent for context
- **Suggested questions:** Shown when chat is empty
- **Auto-clear:** Closing panel clears conversation (no explicit clear button needed)

### Query Logging for Improvement

All help queries are logged to the `help_logs` Supabase table for weekly review and system prompt improvement.

**Table Schema:**
```sql
CREATE TABLE help_logs (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  session_id TEXT,  -- anonymous identifier
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Weekly Review Workflow:**
1. Query recent logs: `SELECT question, response, created_at FROM help_logs ORDER BY created_at DESC LIMIT 100;`
2. Look for patterns: common questions, incorrect responses, confusion points
3. Update `HELP_SYSTEM_PROMPT` in `functions/help.js` to address gaps
4. Clear old logs: `DELETE FROM help_logs WHERE created_at < NOW() - INTERVAL '7 days';`

**Privacy Considerations:**
- No PII stored (questions only, no user identifiers)
- Anonymous session IDs generated per query
- Recommend 90-day retention policy
- Update privacy policy to disclose help query logging

### Key Files
- `functions/help.js` - Cloudflare Function with system prompt
- `src/components/HelpPanel.js` - React chat panel component
- `src/icons/HelpBubbleIcon.jsx` - Speech bubble icon (liquid glass style)
- `src/layout/VerticalNavBar.js` - Triggers HelpPanel on icon click

### API Key
Requires `ANTHROPIC_API_KEY` in Cloudflare environment variables (or `.dev.vars` for local development).

## Quick Tips System

The Quick Tips system provides a visual reference guide for users. It's a sidebar panel with accordion sections that explain how to use each feature with visual examples.

### Purpose
- **In-context help:** Replaces modal popups with a persistent, accessible reference
- **Visual learning:** Shows actual UI elements (chips, buttons, icons) instead of text descriptions
- **Session-based onboarding:** Auto-opens to relevant section on first use of a feature

### Architecture
- **Component:** `src/components/QuickTipsPanel.js` - Accordion sidebar with visual examples
- **Icon:** `src/icons/QuickTipsIcon.jsx` - Lightbulb icon (liquid glass style)
- **State:** Managed in `AppDataContext` (`quickTipsOpen`, `quickTipsExpandedSection`, `quickTipsShownThisSession`)

### Topics (Alphabetical)
Each topic has visual examples using actual UI component tokens:

1. **Assistance Types** - Chip toggling (active teal vs inactive white)
2. **Distance** - Address entry for accurate distance calculations
3. **Email / PDF** - How to send selected resources
4. **Location Search** - County/City/Zip filtering
5. **Ask a Question** - Natural language queries
6. **Organization Search** - Parent/child organization filtering
7. **Results** - Checkboxes, status pills, expand/collapse
8. **Sidebar Icons** - Each icon with label (includes actual icons)
9. **Zip Code Search** - Default search mode

### Behavior
- **Manual access:** Click lightbulb icon in vertical nav bar
- **Auto-open:** First time user selects 2+ assistance types, sidebar opens to "Assistance Types" section
- **Once per session:** Auto-open only happens once per session (tracked via `quickTipsShownThisSession`)
- **Accordion:** Only one section expanded at a time
- **Click outside:** Closes the panel

### Design Tokens
```css
--color-quicktips-header-bg: #222831;
--color-quicktips-header-text: #FFC857;
--color-quicktips-body-bg: #F3EED9;
--color-quicktips-section-header-bg: #4A4F56;
--color-quicktips-section-header-text: #F3EED9;
--color-quicktips-section-body-bg: #FFFFFF;
--width-quicktips-panel: 380px;
--height-quicktips-header: 50px;
```

### Key Files
- `src/components/QuickTipsPanel.js` - Main panel component with all topic content
- `src/icons/QuickTipsIcon.jsx` - Lightbulb icon
- `src/layout/VerticalNavBar.js` - Renders panel, handles icon click
- `src/Contexts/AppDataContext.js` - State management
- `src/layout/NavBar3.js` - Triggers auto-open on first multi-selection

### Future Use
The Quick Tips pattern can be reused for other contextual help. When a feature changes or is new:
1. Add topic content function in `QuickTipsPanel.js`
2. Add to `QUICK_TIPS_TOPICS` array
3. Trigger auto-open by calling `setQuickTipsOpen(true)` and `setQuickTipsExpandedSection("topic-id")`

**Note:** Avoid overusing auto-open. Reserve for truly new or confusing features. Manual access via lightbulb should be the primary discovery method.

## Opportunity Scan System (BUILT — runs on Omar's home desktop via launchd)

> **⚠️ STATUS 2026-07-16 — the runtime lives OFF Cloudflare. Read before touching the scan.**
> The pipeline runs from Node on Omar's **always-on home desktop**, scheduled **Mondays 7am local**
> by `launchd` (`scripts/launchd/`). It was migrated off Cloudflare because two blockers made a
> datacenter fundamentally unable to run it — both are the *reason for the current architecture*:
> 1. **Google News RSS refuses Cloudflare** — every query 503s from Cloudflare's (shared, heavily-
>    used) egress IPs, while the identical query returns fresh items from a residential IP, same
>    minute. Not rate limiting, not fixable by backoff. That's ~half the feeds and the curated
>    "workhorse" of the source design. A residential IP (home desktop) gets them fine — **verified
>    2026-07-16**: a Node dry-run polled all the Google News queries live and returned items.
> 2. **`waitUntil` is capped at ~30s** — a real run takes minutes (LLM latency), so Cloudflare
>    cancels it. Node has no such cap.
>
> Rationale for accepting a home-machine's reliability downsides: the news feed is **nice-to-have,
> not mission-critical** — CRG's core purpose is resource referrals, a stale feed for a few weeks
> harms nobody, so **"best data" beats "best uptime."** Later, optionally a Raspberry Pi (kills the
> macOS-specific fragility: login-session requirement, FileVault, forced update restarts, sleep —
> but NOT house power/internet). See "Runtime (home desktop / launchd)" below.
>
> The engine (`runScan()` and everything it calls) is transport-free and unchanged from the
> Cloudflare build; only the trigger + transport moved. The Cloudflare `/opportunity-scan` route is
> **deleted** (git history has it if a degraded cloud fallback is ever built).

A weekly automated scan that sweeps 15-county Houston-area news for new/changed assistance
resources, drafts findings, and holds them for Omar's review. Approved findings publish to a
**public News feed** (chyron + `/news` page). Replaces discovering opportunities by chance.

> **Design history:** the original plan made **org-website page-scanning** the centerpiece with a
> `scan` 0/1/2/3 tier system and rotation math. That was **abandoned** — two years of manual
> monitoring showed org sites are the *worst* signal (stale; closures structurally invisible since
> a closed org keeps a live donation page; announcements buried and late). v2 re-centered on **news
> feeds + Claude as triager/synthesizer, not crawler**. Page-diff is deferred (see bottom).
> Full design rationale: `~/.claude/plans/claude-md-includes-an-opportunity-woolly-music.md`.

### Pipeline (`functions/_lib/scan-pipeline.js`, run by `scripts/run-scan.mjs`)

```
launchd (Mon 7am local) ──> node scripts/run-scan.mjs ──> runScan({env, supabase, …})
                                                            │  (loads .dev.vars, builds env + client)
  1. Poll feeds (RSS/Google News RSS/GDELT)                 │  free, dependency-free parser
  2. 14-day window → dedupe by link → cap 500               │  concurrency-pooled (6)
  3. Haiku 4.5 relevance cull (RELEVANCE_RUBRIC)
  4. Sonnet 5 synthesis: cluster same-event stories → ONE finding + best link;
       cross-reference CRG org list (prompt-cached); tag category + crg_action
  5. Upsert scan_findings status='new'  ON CONFLICT (dedupe_key) DO NOTHING
  6. Resend digest → operacha@sbcglobal.net ("N new to review")   [+ crash email on failure]

Omar (or a volunteer reviewer) reviews at /admin → dismiss, or attach resource + publish
Published + unexpired → /news-feed → chyron + /news page
```

`runScan()` throws on failure; `run-scan.mjs` catches it and emails a "⚠️ FAILED" notice (the
digest is the heartbeat, so a crash-before-digest must announce itself). `--dry-run` skips the DB
insert + digest and prints the findings.

**Tuning constants** (top of `scan-pipeline.js`): `WINDOW_DAYS=14`, `MAX_CANDIDATES=500`,
`PER_FEED_CAP=30`, `FEED_TIMEOUT_MS=15000`, `FEED_CONCURRENCY=6`, `HAIKU_CHUNK=200`.

**Why a 14-day window on a 7-day cadence:** every article gets two chances to be seen. A single run
is not exhaustive (live feeds shift, recall is generous), so the overlap is deliberate — `dedupe_key`
prevents the second look from creating duplicates.

### Key files

| File | Role |
|------|------|
| `functions/_lib/scan-pipeline.js` | **The scan engine.** `runScan()` = the transport-free pipeline (poll → Haiku → Sonnet → upsert → digest). Underscore dir = library, not a route |
| `scripts/run-scan.mjs` | **Node entry point.** Loads `.dev.vars`, builds env + Supabase client, calls `runScan()`, emails on crash. `--dry-run` supported |
| `scripts/launchd/org.crghouston.opportunity-scan.plist` | launchd schedule — Mondays 7am local |
| `scripts/launchd/README.md` | Install / test / update / remove commands + reliability notes |
| `functions/_lib/scan-sources.js` | `DIRECT_FEEDS`, `GOOGLE_NEWS_QUERIES`, `GDELT_QUERIES`, `COUNTIES` (15), `RELEVANCE_RUBRIC`, paywall tokens |
| `functions/_lib/rss.js` | Dependency-free fetch + tolerant RSS/Atom parser; `pollFeed` never throws |
| `functions/_lib/dedupe.js` | `normalizeUrl()` / `dedupeKeyFor()` — shared by scan + admin manual-add |
| `functions/news-feed.js` | Public GET: published + unexpired findings (+ `paywalled` flag) — **still on Cloudflare** |
| `functions/admin-findings.js` | Admin GET/PATCH; `WRITABLE` allowlist; `requireAdmin` — **still on Cloudflare** |
| `src/views/NewsPage.js` | `/news` — public feed, grouped by category |
| `src/views/AdminReviewPage.js` | `/admin` — Queue / Published tabs, resource picker |
| `src/data/newsCategories.js` | Client mirror of the category enum (icon + accent per category) |
| `src/layout/Footer.js` | `NewsChyron` — scrolling published headlines → `/news` |

Only the **scan trigger + pipeline** moved to the home desktop. Everything user-facing (News page,
chyron, Admin Review) and its two read/write Functions (`news-feed.js`, `admin-findings.js`) stay
on Cloudflare — they read/write `scan_findings` and don't care what populated it.

**Source curation notes:** `docs/scan-sources-draft.md` (provenance; which feeds were verified live).

### Categories

`food` · `housing` · `utilities` · `health` · `mother_child` · `jobs_education` · `seasonal` ·
`disaster` · `news_policy` · `other`

**Mirrored in FOUR places — keep in sync when tuning:** `CATEGORY_ENUM` + the tool schema
description + the synthesis prompt (all in `scan-pipeline.js`) + the digest label map, plus
`NEWS_CATEGORIES` in `src/data/newsCategories.js`.
(`disaster` and `news_policy` currently fall back to `OtherIcon` — Omar is drawing art for both.)

### Review workflow (`/admin`, admin org only)

`ADMIN_ACCOUNT_ID = 10000` (`functions/config.js`). Hiding the nav icon is convenience, not
security — both `/admin-findings` and the page enforce the account check.

- **Queue tab** (`status='new'`): read the finding, optionally add a note and attach a CRG resource,
  then Publish or Dismiss. Deliberately one-at-a-time — no bulk select. Omar tested bulk and
  rejected it: *"Clicking Publish individually makes me look at each story."*
- **Published tab**: published **and unexpired** only (not everything) — for fixing a live item.
- **Resource picker** accepts an **id_no OR an org name**. Attaching reuses the announcement
  mechanism (`buildResourceLink()` / `useResourceLinkHandler.js`) → a same-tab "Show me id_no …"
  Ask-a-Question search landing on the record, ready to Email/PDF. Works for guests; preserves session.
- **Manual add** = the real-time fast lane (`origin='manual'`). The weekly scan is the wide net;
  manual adds are the highest-value training signal (they are, by definition, the scan's blind spots).

### `scan_findings` schema

**Actual live columns (verified 2026-07-16):** `id`, `run_date`, `created_at`, `source`,
`source_url`, `dedupe_key` (UNIQUE), `category`, `title`, `summary`, `eligibility`, `deadline`
(free text), `county`, `org_name`, `directory_id_no` (int4), `confidence`, `status`, `notes`,
`expires_at`.

`category`/`status` are **conventions, not DB enums** — new values need no migration. Findings
insert with `status='new'` + `expires_at` = **the upcoming Sunday** (computed in `run-scan.mjs`);
the feed shows `status='published'` rows whose `expires_at` is in the future. `expires_at` is a
**DATE** and `news-feed.js` compares `expires_at >= today(UTC)`, so a story drops off at UTC-midnight
the day after its date ≈ **6–7pm Central that date** — i.e. the coming-Sunday stamp clears each
week's stories ~6–7pm Central Sunday, a clean slate before Monday's 7am run. The model is
day-granular (no time-of-day); a literal clock time (e.g. "2am") would need a `timestamptz` migration
plus a `news-feed.js` timestamp comparison.

> **⚠️ Documented-but-NOT-in-live-table (verified absent 2026-07-16):** `crg_action`, `origin`
> ('scan'|'manual'), `published_at`, `pinned`. The v2.x plan said these were added; they were not.
> Nothing is broken — the app code (`news-feed.js`, `admin-findings.js`, NewsPage, AdminReviewPage)
> only ever touches the live columns above, driving freshness off `status` + `expires_at`, not
> `published_at`. The deferred features that need them (`pinned`/evergreen, `origin`/manual-add
> tagging) are simply unbuilt. Add the column **and** wire the feature together if/when wanted —
> don't add bare columns.

### ⚠️ Hard-won gotchas (each one cost a debugging cycle — do not re-learn)

- **`temperature` is DEPRECATED on `claude-sonnet-5`** and errors if sent. `callClaude` only
  attaches it when it's a number; Haiku gets `temperature: 0`, Sonnet gets none. Don't "helpfully"
  add it back.
- **Sonnet `max_tokens` must stay generous (8000).** At 4096 it truncated mid-tool-call while
  clustering 20+ items → no complete tool call → parsed as `[]`. Symptom is **zero findings from a
  healthy run**, not an error. `stop_reason` is logged for exactly this.
- **`dedupe_key` is derived IN CODE** (`dedupeKeyFor()` — normalized host+path, lowercased, no
  query/trailing slash), **not** LLM-generated. An earlier LLM-authored key was non-deterministic
  and the second run re-inserted 12 rows. It is deliberately absent from the Sonnet tool schema.
- **URL dedup can't catch same-story-different-URL** (found 2026-07-16). A story reaches us via a
  direct outlet link one week and an opaque `news.google.com/rss/articles/CBMi…` **redirect** the
  next (Google News URLs ≠ the article's real URL and aren't locally decodable), so `dedupe_key`
  sees two different strings and `ON CONFLICT` misses it. Mitigation is **flag, not drop** (recall
  beats dedup — a false MERGE would silently lose a story; a false flag is an ignorable note):
  `annotateDuplicates()` sets `_dupOf` on a new finding whose title Jaccard ≥ 0.5 AND same category
  as a recent row. **Surfaced in the digest email ONLY — never written to `notes`, which is PUBLIC**
  (renders on `/news`). The `/admin` queue and DB are unaffected; the reviewer one-click-dismisses.
- **The digest reports NEW findings, not everything found.** Built from the rows actually inserted
  (`.select("dedupe_key")` after the ignore-duplicates upsert returns only genuinely-new keys), so a
  story already in `scan_findings` no longer reappears in the email. Footer shows `found N → new M`.
- **Geography is a HARD GATE, not a recall-favoring judgment.** "When uncertain, include" applies to
  RELEVANCE ONLY. Loose wording once surfaced a South Carolina shelter story.
- **EVERY response body must be read or `cancel()`ed — even on an error status.** The original
  `pollFeed` did `if (!res.ok) return []` without touching the body. On Cloudflare those unread
  responses stayed in-flight forever, holding the runtime's limited connection slots ("A stalled
  HTTP response was canceled to prevent deadlock"), so the remaining feeds never got a slot and
  died on their own abort timers. **Result: `raw 0` from all 43 feeds in production while local dev
  was perfect** — local never got the 503s that triggered it. Fixed 2026-07-16.
- **Poll feeds through `mapWithConcurrency` (6), never `Promise.all` over all 43.** Two reasons:
  Google News 503s a burst of ~24 simultaneous requests from a datacenter IP (your laptop's
  residential IP is never throttled, so this is invisible in dev), and `pollFeed` starts its abort
  timer when *called* — under `Promise.all` all 43 timers start at t=0 and queued fetches time out
  before they ever dial. Retryable statuses (429/5xx) get exponential backoff + jitter.
- **Candidate flooding:** without `PER_FEED_CAP` + query-feeds-first ordering, a handful of chatty
  direct feeds filled the entire cap and **zero Google News queries were evaluated**. The
  `filterToRegion` flag on statewide feeds must stay wired.
- **RLS on `scan_findings`: enabled with NO policies — this is correct and intentional.** It locks
  the browser/anon key out entirely; the Functions use the **secret key, which bypasses RLS**. If a
  write fails, RLS is *not* the cause (it cannot allow one column and block another).
- **`/news-feed` is named that way on purpose** — a function at `/news` would shadow the `/news`
  page route. Both `/news-feed` and `/admin-findings` must be in the **explicit Vite proxy
  allowlist** (`vite.config.mjs`) or they 404 in dev.
- **Anthropic 429/5xx/529 "Overloaded" are transient — `callClaude` retries them** (exponential
  backoff + jitter; Sonnet gets `retries: 5` ≈ up to ~30s because it's the one critical, expensive
  call). Verified 2026-07-16: Sonnet 5 was in a sustained overload and every retry 529'd — that's an
  Anthropic capacity event, not a bug; re-running later succeeds. A hard 4xx (bad request/auth)
  rethrows immediately. Don't "simplify" the retry loop away.
- **`dev == prod` now.** The scan runs on the same home machine you'd dev on, with the same
  residential IP — so the whole class of "worked locally, failed on Cloudflare" bugs (the 503s, the
  connection-slot deadlock) can no longer hide. The flip side: there is **no staging** — a bad edit
  to `scan-pipeline.js`/`run-scan.mjs` runs live next Monday. Keep the working tree clean.

### Runtime (home desktop / launchd)

Full install/test/update/remove commands + reliability notes: **`scripts/launchd/README.md`**.

- **Schedule:** `~/Library/LaunchAgents/org.crghouston.opportunity-scan.plist` → `node
  scripts/run-scan.mjs`, **Mondays 7am local** (launchd handles DST; no UTC drift).
- **Absolute node path** in the plist (`/usr/local/bin/node`) — launchd's PATH is minimal. Verify
  with `which node` if node ever moves.
- **Secrets** come from `.dev.vars` (same file wrangler uses), loaded by dotenv and resolved
  relative to the script (not cwd). Needs `ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_SECRET_KEY`. Optional `SCAN_DIGEST_RECIPIENT` (defaults to Omar).
- **Logs:** `logs/scan.out.log` / `logs/scan.err.log` (gitignored). **Silence = broken** — even a
  0-findings run emails the digest; a crash emails a "⚠️ FAILED" notice. A Monday with *no* email of
  either kind = check the logs.
- **Test now:** `node scripts/run-scan.mjs --dry-run` (no writes), or
  `launchctl kickstart -k gui/$(id -u)/org.crghouston.opportunity-scan` (real run).
- **Reliability trade-off:** a per-user LaunchAgent only runs in a logged-in GUI session, so a
  powered-off machine or a post-update FileVault/login screen at 7am = a skipped week (accepted;
  nice-to-have feed). Hardening options (LaunchDaemon / auto-login / Raspberry Pi) deferred.

### Cloudflare teardown — remaining manual steps (Omar, in the dashboards)

The `/opportunity-scan` route + `scripts/schedule-opportunity-scan.sql` are **deleted from the
repo**. Still to remove outside the repo (none are urgent — they're just dead weight now):

1. **Unschedule the pg_cron job:** `SELECT cron.unschedule('weekly-opportunity-scan');` in the
   Supabase SQL editor.
2. **Delete the Vault secret:** `DELETE FROM vault.secrets WHERE name = 'scan_trigger_secret';`
3. **Delete the `SCAN_TRIGGER_SECRET`** Cloudflare env var (Pages → Settings → env vars) + redeploy.
4. **Delete the Cowork task** `crg-weekly-opportunity-scan` (the interim reminder), if still around.

### Copyright — the aggregator pattern (non-negotiable)

Own summary in CRG's words (never the outlet's text or verbatim headline) · link out, don't host ·
attribute the outlet · **no scraped images/thumbnails/logos** · prefer RSS/sanctioned feeds.
Paywalled outlets (Chronicle, HBJ) are still surfaced but badged.

### News feed vs. announcements — separate channels (decided July 2026)

Two independent systems; the feed does **not** absorb announcements.
- **Announcements = push.** "I need you to know this." Keeps its login popup. Unchanged.
- **News feed = pull.** "Here's what's happening, browse if you want." Chyron + `/news`.

This split is what removes the hard problems (no personalization, no audience targeting, no
priority-pop logic). Only the Training **chyron** was repurposed — everything else Training does is
untouched.

### Runtime migration — Cloudflare → home desktop (DONE 2026-07-16)

Done: `runScan()` extracted to `functions/_lib/scan-pipeline.js`; `scripts/run-scan.mjs` +
`scripts/launchd/` added; the Cloudflare `/opportunity-scan` route and `schedule-opportunity-scan.sql`
deleted. **~90% of the system was reused untouched** — the whole pipeline (`pollAllSources` → Haiku →
Sonnet → upsert → Resend digest), all prompts/rubric/tool schemas, `_lib/rss.js` / `_lib/dedupe.js` /
`_lib/scan-sources.js`, the Supabase schema, and everything user-facing (NewsPage, chyron, Admin
Review, `news-feed.js`, `admin-findings.js`, all still on Cloudflare reading `scan_findings`). The
`runScan()` transport-free split (`{env, supabase, runDate, expiresDate, dryRun}`) — originally cut
for the `waitUntil` fix — was exactly the seam this needed. Google News queries came back live
(verified from Node on the residential IP).

**Known trade-offs, accepted:** single point of failure (house power/internet/machine); runs the
working tree, not a built artifact (an uncommitted half-edit will run — no build gate); no staging;
no remote fix while away; DIY observability. Accepted because **the news feed is nice-to-have, not
mission-critical**. **Wins:** no deploys to tune the rubric/sources (the slowest loop in the
project), no 30s ceiling, no shared secret/Vault, local-time scheduling.

**Later:** Raspberry Pi — kills the macOS-specific fragility (login session, FileVault, update
restarts, sleep) but NOT house power/internet. Portable by design: same Node script, swap launchd
for a systemd timer. Optional safety net (NOT now): a degraded Cloudflare scan (direct feeds +
GDELT, no Google) that runs only if home hasn't reported in — a scraping-proxy (e.g. ScraperAPI free
tier) is what would let *that* cloud fallback reach Google News from a datacenter, if ever built.

### Deferred / next

- ⬜ **Unattended "vacation mode"** (auto-publish while Omar is away 3-8 weeks hiking) — **TABLED
  July 2026**, possible October trip. Scenario, Claude's recommendation (a date not a boolean; the
  confidence-gate question), and Omar's counter-position ("I'd rather have a bad story published
  than a good story not published") are all documented in the plan file. Revisit with real
  confidence-distribution data.
- ⬜ After a few runs: review digest quality + Anthropic Console spend; tune the source list + rubric.
- ⬜ Source scorecard (which outlets produce findings Omar actually publishes).
- ⬜ `scan_config` table (prompt/limits editable without redeploy) — the vacation switch is its
  likely forcing function.
- ⬜ **Org-website page-diff ("Model A")** — later, and only after the news scan is proven. Single
  source of truth = `organizations.scan` as a simple 1/0 (NOT the old 0/1/2/3 tiers) → dedup URLs →
  fetch + extract/normalize main content → hash → Haiku only on *changed* pages. Needs a `scan_pages`
  tripwire table. Cost scales with pages that change, not page count.

## Hosting & Infrastructure

- **Domain:** crghouston.org (migrated from crghouston.operacha.org; old subdomain 301-redirects to new domain)
- **Hosting:** Cloudflare Pages
- **Database:** Supabase (new 2026 schema)
- **Email:** Resend (domain: crghouston.org)
- **PDF:** PDFShift
- **LLM Help:** Anthropic Claude API
- **API Keys:** Configured in Cloudflare environment variables
