# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Community Resources Guide (CRG) Houston - a React application that helps organizations find and share community assistance resources. Users log in via organization passcodes and can search for resources by zip code, organization, or assistance type, then email or PDF selected results to clients.

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
- Tour/onboarding feature
- Storybook

**Unchanged:**
- Resend for emails
- PDFShift for PDF generation
- Core functionality (search, email, PDF)

**New features planned:**
- **Google Geocoding**: Users can enter a client address directly in the app to get lat/long (previously required manual copy from Google Maps). Resources sorted by distance from client location.
- **LLM Search (Anthropic)**: Natural language queries like "food pantry within 5 miles open Thursday morning" or "food pantry that delivers to 77027"
- **Public access**: Users without accounts can search but cannot email/PDF

**Infrastructure:**
- Hosted on Cloudflare (migrated from Netlify)
- Supabase backend (new restructured database)

## Design & Development Workflow

**Design source:** Figma (complete redesign)
**Design assets:** Screenshots stored in `/docs/design/`
**Process:** Export Figma screenshots → Claude interprets and implements → Validate

## UI Shell Components

The app shell consists of:
1. **NavBar1** - Logo, title, counters (filtered/selected), Send Email & Create PDF buttons
2. **NavBar2** - Search mode selector + mode-specific filters (see Search Modes below)
3. **NavBar3** - Assistance type filters with dropdown panel (see Assistance Types below)
4. **Results Header** - Display controls (to be designed)
5. **Footer** - Static, copyright only
6. **Vertical Nav Bar** - Information, Reports, Privacy Policy, Contact Support, etc.

Results display format is consistent regardless of filters applied.

## Development Roadmap

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
8. ✅ PDF redesign (3-column, print-optimized format) - **header repeat on pages TODO**
9. ⬜ Simplify usage reporting
10. ⬜ LLM search (Anthropic API)

## Current Development Status

**Login bypass active** for development - app loads directly to main view.

**Design tokens system established:**
- `src/styles/tokens.css` - CSS custom properties (single source of truth)
- `tailwind.config.js` - References CSS variables for Tailwind classes
- `src/index.js` - Imports tokens.css globally
- **New components fully tokenized:** NavBar1-3, Footer, VerticalNavBar, ResultsHeader, ResultRow, Tooltip
- **Legacy components not yet tokenized:** Charts, SearchResults, AnnouncementPopup (to be migrated later)

**Legacy controls removed from ZipCodePage:**
The following legacy UI elements have been removed from `src/views/ZipCodePage.js` as they are now handled by the new NavBar components:
- ~~Zip Code dropdown~~ → Now in NavBar2
- ~~Assistance buttons and "More options" link~~ → Now in NavBar3
- ~~Orange animated results counter~~ → Now in NavBar1 (filtered/selected counters)

**Supabase connection complete:**
- All data loads from Supabase on app start via `AppDataContext`
- Zip code filtering works (filters `directory.client_zip_codes`)
- Assistance filtering works (filters by `directory.assist_id`)
- Distance calculation works (uses `zip_codes.coordinates` and `directory.org_coordinates`)
- Results sorted by: status_id → assist_id → miles
- Assistance column shows all assistance types for each organization (computed from directory)

**Geocoding feature complete:**
- Distance icon in NavBar2 opens DistancePanel for address entry
- Google Geocoding API converts addresses to coordinates (via Cloudflare Function)
- User can also paste coordinates directly
- Override coordinates stored in `AppDataContext` (`clientAddress`, `clientCoordinates`)
- `ZipCodePage` uses override coordinates instead of zip centroid when set
- Distance calculated using Haversine formula (straight-line, not driving distance)
- Distance icon shows active state (plum bg, gold icon) when override is set
- Override clears automatically when zip code changes
- Footnote in panel explains distances are approximate straight-line

**Completed components:**

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
  - InformationIcon
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
- Right side: Search mode buttons (Zip Code, Organization, Location, LLM Search)
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
- Text: white, Lexend, 14px, 2% letter-spacing
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

**Design assets location:** `/docs/design/`
- `ZipCode.png` - Overall page layout
- `Footer.png` - Footer specs
- `Frame 503 Vertical Bar.png` - Vertical nav bar specs
- `Frame 494 NavBar 1.png` - NavBar1 specs
- `Frame 496 NavBar 2.png` - NavBar2 specs (shows all 4 search modes)
- `Frame 505 NavBar 3.png` - NavBar3 with assistance panel
- `Supabase Schema.png` - Database schema reference
- `Design Tokens.txt` - NavBar1 design specs (RTF format)
- `Design Tokens NavBar 2.txt` - NavBar2 design specs
- `Design Tokens NavBar 3.txt` - NavBar3 and panel design specs

## Commands

```bash
npm start          # Development server at localhost:3000
npm run build      # Production build to /build
npm test           # Jest test runner (interactive watch mode)
```

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
│   ├── OrganizationPage.js  # LEGACY - to be removed
│   ├── MessagesPage.js
│   └── GeneralSearchPage.js # LEGACY - to be removed
├── components/
│   ├── ResultRow.js     # Individual result row with expand/collapse
│   │                    # Uses orgAssistanceMap for Assistance column icons
│   ├── ResultsList.js   # Container for ResultRows, handles sorting
│   ├── Tooltip.js       # Instant CSS tooltip
│   ├── DropPanel.js     # Reusable dropdown panel (used by Distance, Email, PDF panels)
│   ├── EmailPanel.js    # Email/PDF entry panel with inactive warning
│   ├── DistancePanel.js # Distance override panel (address entry)
│   ├── SearchResults.js # LEGACY - reference only, do not modify
│   ├── EmailDialog.js   # LEGACY - replaced by EmailPanel + emailService
│   ├── AssistanceSidebar.js # LEGACY - to be removed
│   └── charts/          # LEGACY - not tokenized, may keep for reports
├── layout/
│   ├── PageLayout.js    # Shared layout with header/footer/vertical nav
│   ├── NavBar.js        # LEGACY - ignore, delete later
│   ├── NavBar1.js       # Top header (logo, counters, buttons)
│   ├── NavBar2.js       # Search mode selector + filters (uses context)
│   ├── NavBar3.js       # Assistance type filters + dropdown panel
│   ├── ResultsHeader.js # Red column header bar for results
│   ├── Footer.js        # Bottom footer bar
│   └── VerticalNavBar.js # Right-side icon navigation
├── icons/               # Centralized SVG icon components
│   ├── index.js         # Re-exports all icons
│   ├── iconMap.js       # Maps Supabase icon names to components
│   └── HelpIcon.js      # Fixed-color help icon for panels
├── data/
│   ├── mockResults.js   # Mock data - NO LONGER USED (kept for reference)
│   └── FetchDataSupabase.js # LEGACY - ignore, reference only
├── styles/
│   └── tokens.css       # Design tokens (CSS custom properties)
├── utils/
│   └── formatters.js    # Shared formatting utilities (hours, address, distance)
└── services/
    ├── dataService.js   # Supabase query methods (directory, assistance, zip_codes)
    ├── emailService.js  # Email/PDF sending logic (sendEmail, createPdf, checkLimits)
    └── geocodeService.js # Google Geocoding API wrapper
```

### Legacy Files (Reference Only - Do Not Modify)
These files exist from the original `crg-app` and should be ignored or used only as reference:
- `src/layout/NavBar.js` - Old navbar, replaced by NavBar1/2/3
- `src/components/SearchResults.js` - Old results display, replaced by ResultRow/ResultsList
- `src/components/AssistanceSidebar.js` - Old assistance picker, replaced by NavBar3
- `src/components/EmailDialog.js` - Old modal popup, replaced by EmailPanel + emailService
- `src/data/FetchDataSupabase.js` - Old data fetching hook
- `src/views/OrganizationPage.js` - Will be consolidated into single page
- `src/views/GeneralSearchPage.js` - Will be consolidated into single page

### Files to Keep from Legacy (Working - Updated for 2026)
- `functions/sendEmail.js` - Resend integration (updated domain)
- `functions/createPdf.js` - PDFShift integration

### Authentication
- Organizations authenticate with passcodes stored in `registered_organizations` table
- User object passed as `loggedInUser` prop throughout the app
- Controls email/PDF permissions

### Main Routes
- `/` - Main app (single page, no routing for search modes)
- `/reports` - StatisticsPage (usage analytics)
- `/messages` - MessagesPage (system announcements)

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

### Mode 4: LLM Search
- **Left frame:** Text input field
- **Uses:** Anthropic API for natural language queries
- **Example:** "food pantry within 5 miles open Thursday morning"

### Distance Sorting
- Results are sorted by distance from zip code centroid (not alphabetically)
- `zip_codes.coordinates` = centroid of each zip code
- `directory.org_coordinates` = lat/long of each organization
- **Distance icon:** Opens modal for user to enter client address → Google Geocoding API converts to coordinates → overrides default zip centroid for distance calculation
- Distance icon appears in Zip Code, Organization, and Location modes

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
- **Single selection saved:** Auto-activates (turns teal), shows results immediately
- **Multiple selections saved:** All appear inactive (white), user must click to activate
- **Click chip:** Toggles between active (teal) and inactive (white)
- **Multiple active:** Allowed - results show resources matching ANY active type

### Session Persistence
- Selections persist while navigating between search modes (Zip Code, Organization, Location, LLM)
- Selections clear on logout or session expiry (2am daily reset)
- No bookmark/save feature - intentional to ensure users see all options each session

### 6 Groups (28 types total) - Dynamic from Supabase
Groups are **evergreen** - determined by the `group` field in the `assistance` table. Code automatically adapts if groups are added/removed or types are moved between groups.

- **Group 1** (Yellow): Rent, Utilities, Food, Clothing
- **Group 2** (Purple): Homeless - Shelters, Homeless - Day Centers, Homeless - Other, Housing
- **Group 3** (Pink): Medical - Primary Care, Medical - Equipment, Medical - Mental Health, Medical - Addiction Recovery, Medical - Program Enrollment, Medical - Bill Payment
- **Group 4** (Green): Domestic Abuse - Shelters, Domestic Abuse - Other, Education - Children, Childcare
- **Group 5** (Cyan): Education - Adults, Jobs, Transportation, Legal, Immigration
- **Group 6** (Orange): Seniors, Handyman, Animals, Christmas, Other

Each type has an icon in `/src/icons/` mapped via `src/icons/iconMap.js`.

## Supabase Tables (5 tables total)

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

### `organizations` - NO LONGER USED
**Note:** The `organizations` table is no longer fetched. Organization data for NavBar2 dropdowns is now derived from the `directory` table. The `org_assistance` field has been replaced by computing assistance types from directory records.

**Deprecated fields:**
| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id_no` | int4 | `1001` | Primary key |
| `organization` | text | `"3 \"A\" Bereavement..."` | Org name |
| `org_parent` | text | Same or parent name | Parent org |
| `org_assistance` | text | `["65"]` | **DEPRECATED** - Now computed from directory |

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

### `registered_organizations` (auth - implement last)
| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id_no` | int4 | `1042` | Primary key |
| `reg_organization` | text | `"Christian Community..."` | Org name for login |
| `org_passcode` | text | `"he3aq6"` | Login passcode |
| `org_color` | text | `"#FF7C7C"` | Branding color |

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

**Fonts:**
- Lexend (body - primary font for all UI, weights: 400, 500, 600, 700)
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

#### Step 8: Wire Counters ⬜ PENDING
- Filtered count and selected count need to be wired to NavBar1

#### Step 9: Email/PDF Redesign ✅ COMPLETE
- Email format redesigned (single-column, mobile-friendly)
- Uses shared formatters from `src/utils/formatters.js`
- From address updated to `info@crghouston.operacha.org`

### Key Technical Decisions

**assist_id is TEXT:** Both `directory.assist_id` and `assistance.assist_id` are text fields. This allows consistent string comparison without type conversion issues.

**Org assistance computed from directory:** Instead of using `organizations.org_assistance` array, we compute a lookup map from directory records. This ensures single source of truth and eliminates sync issues.

**Sort order:** status_id (1=Active first) → assist_id (numeric order) → miles (nearest first)

### Future Steps (Not This Phase)
- Organization search mode filtering
- Location search mode filtering
- LLM search mode (Anthropic API)
- Google Geocoding for distance override
- Public access mode (no login required)

## Email & PDF System

### Architecture
- **Email Service:** Resend API via Cloudflare Function (`functions/sendEmail.js`)
- **PDF Service:** PDFShift API via Cloudflare Function (`functions/createPdf.js`)
- **From Address:** `info@crghouston.operacha.org` (configured in Resend)
- **Email Service Module:** `src/services/emailService.js` - Centralized email/PDF logic
- **UI Components:**
  - `src/components/EmailPanel.js` - Dropdown panel UI for email/PDF entry
  - `src/components/DropPanel.js` - Reusable dropdown panel component (shared styling)

### Email/PDF Panel UI (2026 Redesign)
The email and PDF buttons in NavBar1 now use dropdown panels instead of modal popups.

**Panel Flow:**
1. User clicks "Send Email" or "Create PDF" button in NavBar1
2. If no records selected → Toast error, panel doesn't open
3. If inactive resources selected → Warning panel appears first
4. Warning panel: Cancel returns to results, Continue proceeds to input panel
5. Email panel: Enter recipient email, click Send
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
| LLM Search | Query text | "Resources for: [query]" |
| LLM Search | No query | "Search Results" |

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

**Known Issue (TODO):**
- Header does not repeat on subsequent pages (only appears on page 1)
- PDFShift running headers require special formatting; current workaround puts header in body HTML
- Need to debug PDFShift header/footer source validation error

**PDFShift Requirements:**
- Header/footer `source` must start with `<` (no leading whitespace)
- External resources (images, fonts) must be publicly accessible URLs
- `{{page}}` and `{{total}}` template variables for page numbers

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
```

**Production:** Cloudflare dashboard → Pages → Settings → Environment variables

## Hosting & Infrastructure

- **Domain:** crghouston.operacha.org
- **Hosting:** Cloudflare Pages
- **Database:** Supabase (new 2026 schema)
- **Email:** Resend (domain: crghouston.operacha.org)
- **PDF:** PDFShift
- **API Keys:** Configured in Cloudflare environment variables
