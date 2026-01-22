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
│   ├── ReportsPage.js   # Usage analytics and reports
│   ├── LegalPage.js     # Privacy policy and terms
│   ├── SupportPage.js   # Contact support page
│   └── AnnouncementsPage.js # Announcements history
├── components/
│   ├── ResultRow.js     # Individual result row with expand/collapse
│   │                    # Uses orgAssistanceMap for Assistance column icons
│   ├── ResultsList.js   # Container for ResultRows, handles sorting
│   ├── Tooltip.js       # Instant CSS tooltip
│   ├── DropPanel.js     # Reusable dropdown panel (used by Distance, Email, PDF panels)
│   ├── EmailPanel.js    # Email/PDF entry panel with inactive warning
│   ├── DistancePanel.js # Distance override panel (address entry)
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
    ├── geocodeService.js # Google Geocoding API wrapper
    ├── usageService.js  # Usage logging
    ├── llmSearchService.js # LLM search filter application
    └── AnnouncementService.js # Announcement queries
```

### Cloudflare Functions
- `functions/sendEmail.js` - Resend integration for email delivery
- `functions/createPdf.js` - PDFShift integration for PDF generation
- `functions/help.js` - LLM help assistant (Anthropic Claude API)
- `functions/geocode.js` - Google Geocoding API wrapper
- `functions/llm-search.js` - LLM search query processing

### Authentication
- Organizations authenticate with passcodes stored in `registered_organizations` table
- User object passed as `loggedInUser` prop throughout the app
- Controls email/PDF permissions
- **Guest access:** Users can browse without login via "Browse Without Account" button
  - Guest user object: `{ id: 'guest', organization: 'Guest', isGuest: true, canEmail: false, canPdf: false }`
  - Guests can search and view results but cannot send emails or create PDFs

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
```

**Production:** Cloudflare dashboard → Pages → Settings → Environment variables

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

**Format Codes (comma-separated in format columns):**
| Code | Effect |
|------|--------|
| `bold` | Bold text |
| `italic` | Italic text |
| `underline` | Underlined text |
| `bullet` | Each line becomes a bullet point |
| 6-char hex (e.g., `B8001F`) | Text color |

**Examples:**
- `bold, italic` → Bold and italic
- `bullet` → Bulleted list
- `B8001F` → Red text
- `bold, B8001F` → Bold red text
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

## Hosting & Infrastructure

- **Domain:** crghouston.operacha.org
- **Hosting:** Cloudflare Pages
- **Database:** Supabase (new 2026 schema)
- **Email:** Resend (domain: crghouston.operacha.org)
- **PDF:** PDFShift
- **LLM Help:** Anthropic Claude API
- **API Keys:** Configured in Cloudflare environment variables
