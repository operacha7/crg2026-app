# Reports Implementation Plan

**Date:** January 16, 2026
**Status:** Ready to implement

---

## Overview

Simplify the current 8-report system down to 4 reports with cleaner code, server-side aggregation, and a new logging structure.

---

## Database Schema

### Table: `app_usage_logs`

```sql
CREATE TABLE app_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL,              -- Central Time date (no timezone issues)
  reg_organization TEXT NOT NULL,      -- "Guest" for non-logged-in users
  action_type TEXT NOT NULL,           -- "search", "email", "pdf"
  search_mode TEXT,                    -- "Zip Code", "Organization", "Location", "LLM Search"
  assistance_type TEXT,                -- "Food", "Rent", etc. (null if not filtering by assistance)
  search_value TEXT                    -- The actual zip code searched (for Top Zip stat)
);

CREATE INDEX idx_usage_logs_date ON app_usage_logs(log_date);
CREATE INDEX idx_usage_logs_org ON app_usage_logs(reg_organization);
CREATE INDEX idx_usage_logs_action ON app_usage_logs(action_type);
```

### Views (all math done server-side)

**v_daily_usage** - For daily reports
```sql
CREATE VIEW v_daily_usage AS
SELECT
  log_date,
  reg_organization,
  action_type,
  search_mode,
  COUNT(*) as count
FROM app_usage_logs
GROUP BY log_date, reg_organization, action_type, search_mode;
```

**v_monthly_usage** - For monthly reports and Usage Data Tables
```sql
CREATE VIEW v_monthly_usage AS
SELECT
  DATE_TRUNC('month', log_date)::DATE as month,
  reg_organization,
  action_type,
  search_mode,
  assistance_type,
  COUNT(*) as count
FROM app_usage_logs
GROUP BY DATE_TRUNC('month', log_date), reg_organization, action_type, search_mode, assistance_type;
```

**v_live_stats** - For NavBar3 ticker (all time)
```sql
CREATE VIEW v_live_stats AS
SELECT
  (SELECT search_value FROM app_usage_logs
   WHERE search_mode = 'Zip Code' AND search_value IS NOT NULL
   GROUP BY search_value ORDER BY COUNT(*) DESC LIMIT 1) as top_zip,

  (SELECT COUNT(*) FROM app_usage_logs
   WHERE search_mode = 'Zip Code' AND search_value = (
     SELECT search_value FROM app_usage_logs
     WHERE search_mode = 'Zip Code' AND search_value IS NOT NULL
     GROUP BY search_value ORDER BY COUNT(*) DESC LIMIT 1
   )) as top_zip_count,

  (SELECT COUNT(*) FROM app_usage_logs
   WHERE search_mode = 'Zip Code') as total_zip_searches,

  (SELECT assistance_type FROM app_usage_logs
   WHERE assistance_type IS NOT NULL
   GROUP BY assistance_type ORDER BY COUNT(*) DESC LIMIT 1) as top_assistance,

  (SELECT COUNT(*) FROM app_usage_logs
   WHERE assistance_type = (
     SELECT assistance_type FROM app_usage_logs
     WHERE assistance_type IS NOT NULL
     GROUP BY assistance_type ORDER BY COUNT(*) DESC LIMIT 1
   )) as top_assistance_count,

  (SELECT COUNT(*) FROM app_usage_logs
   WHERE assistance_type IS NOT NULL) as total_assistance_searches,

  (SELECT reg_organization FROM app_usage_logs
   GROUP BY reg_organization ORDER BY COUNT(*) DESC LIMIT 1) as top_reg_org,

  (SELECT COUNT(*) FROM app_usage_logs
   WHERE reg_organization = (
     SELECT reg_organization FROM app_usage_logs
     GROUP BY reg_organization ORDER BY COUNT(*) DESC LIMIT 1
   )) as top_reg_org_count,

  (SELECT COUNT(*) FROM app_usage_logs) as total_searches;
```

---

## Logging Logic

### When to Log

| User Action | action_type | search_mode | assistance_type | search_value |
|-------------|-------------|-------------|-----------------|--------------|
| Selects zip code | search | Zip Code | null | "77025" |
| Selects organization | search | Organization | null | null |
| Selects location filter | search | Location | null | null |
| Uses LLM search | search | LLM Search | null | null |
| Clicks assistance chip | search | (current mode) | "Food" | null |
| Sends email successfully | email | null | null | null |
| Creates PDF successfully | pdf | null | null | null |

### Logging Utility

File: `src/services/usageService.js`

```javascript
import { supabase } from '../MainApp';

function getCentralDate() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Chicago'
  }); // Returns "2026-01-15" format
}

export async function logUsage({
  reg_organization,
  action_type,
  search_mode = null,
  assistance_type = null,
  search_value = null
}) {
  const { error } = await supabase
    .from('app_usage_logs')
    .insert({
      log_date: getCentralDate(),
      reg_organization: reg_organization || 'Guest',
      action_type,
      search_mode,
      assistance_type,
      search_value
    });

  if (error) console.error('Log error:', error);
}
```

---

## Reports Page Structure

### Navigation

**NavBar1Reports** (new component)
- Left: Logo + "Community Resources Guide Houston" title (same as main NavBar1)
- Right: "Reports" button that opens dropdown panel
- Dropdown options:
  1. Zip Code
  2. Emails Sent
  3. PDFs Created
  4. Usage Data Tables

**NavBar2Reports** (new component)
- Left: "Select Organization" dropdown (includes "All" + all registered orgs + "Guest")
- Right: Daily/Monthly toggle buttons (two buttons, one active at a time)

**NavBar3Reports** (new component)
- Live stats ticker showing:
  - `Top Zip: 77025 (12%)`
  - `Top Assistance: Food (28%)`
  - `Top Reg Org: St Vincent de Paul (23%)`
- Data from `v_live_stats` view (all time)

### Report 1-3: Zip Code / Emails Sent / PDFs Created

Same layout as current daily reports:
- Top-left: Donut chart (breakdown by organization)
- Top-right: Daily/monthly numbers
- Bottom: Bar chart (trend over time)

**Daily mode:** Shows last 30 days (today + 29 previous)
**Monthly mode:** Shows last 12 calendar months (current + 11 previous)

### Report 4: Usage Data Tables

Red header row (same styling as main app results header)

**Three sections with gaps and gray dividers:**

1. **Communications**
   - Send Email
   - Create PDF
   - Total (darker gray row)

2. **Search**
   - Zip Code
   - Organization
   - Location
   - LLM Search
   - Total (darker gray row)

3. **Assistance**
   - All 28 assistance types listed (sorted by assist_id)
   - Show even if count is zero
   - Total (darker gray row)

**Columns:**
- Daily mode: 30 day columns (1/1, 1/2, ... 1/30) + Da/Mo + Mo/Yr
- Monthly mode: 12 month columns (02/25, 03/25, ... 01/26) + Da/Mo + Mo/Yr

**Percentage calculations:**
- Da/Mo = Row value / Column total for the LAST date column
- Mo/Yr = Row total / Grand total for all displayed columns

**Example:**
```
                08/25  09/25  10/25  11/25  12/25  01/26  Da/Mo  Mo/Yr
Send Email        125    135    145    226    350    325    68%    71%
Create PDF         45     66     78     55    125    156    32%    29%
Total             170    201    223    281    475    481   100%   100%
```

---

## Design Tokens

From `docs/design/Design Tokens Reports.txt`:

**Font:** Open Sans (consistent with app)

**Reports button:**
- bg-color: none (transparent)
- text-color: #F3EED9

**Dropdown panel:**
- bg-color: #F3EED9
- font-size: 16px
- text-color: #222831

**Usage Data Tables header:**
- Same styling as main results header (red background)

**Section styling:**
- Gap between sections
- Gray horizontal line separating sections
- Total rows: darker shade of gray

---

## File Structure

### New Files to Create

```
src/
├── services/
│   └── usageService.js          # Logging utility
├── layout/
│   ├── NavBar1Reports.js        # Reports page header
│   ├── NavBar2Reports.js        # Org filter + Daily/Monthly toggle
│   └── NavBar3Reports.js        # Live stats ticker
├── views/
│   └── ReportsPage.js           # Main reports page (replaces StatisticsPage)
└── components/
    └── reports/
        ├── ZipCodeReport.js     # Donut + numbers + bar chart
        ├── EmailsReport.js      # Donut + numbers + bar chart
        ├── PdfsReport.js        # Donut + numbers + bar chart
        └── UsageDataTables.js   # Three-section table view
```

### Files to Delete (after migration)

```
src/
├── Contexts/
│   └── StatisticsContext.js     # No longer needed
├── components/
│   └── charts/
│       ├── containers/          # All container files
│       ├── shared/              # All layout files
│       ├── TopReferrals.js
│       ├── TopZipCodes.js
│       └── utils/
└── views/
    └── StatisticsPage.js        # Replaced by ReportsPage.js
```

### Supabase Objects to Delete

- `v_top25_zip_org_12mo` view
- `v_top25_referrals_12mo` view
- `email_referrals` table (if not used elsewhere)
- Any scheduled jobs for report aggregation

---

## Implementation Order

1. **Database Setup**
   - Create `app_usage_logs` table in Supabase
   - Create `v_daily_usage` view
   - Create `v_monthly_usage` view
   - Create `v_live_stats` view

2. **Logging Utility**
   - Create `src/services/usageService.js`
   - Add logging calls to ZipCodePage, NavBar2, NavBar3, email/PDF handlers

3. **Reports Navigation**
   - Create NavBar1Reports.js
   - Create NavBar2Reports.js
   - Create NavBar3Reports.js

4. **Reports Pages**
   - Create ReportsPage.js (container)
   - Create ZipCodeReport.js
   - Create EmailsReport.js
   - Create PdfsReport.js
   - Create UsageDataTables.js

5. **Cleanup**
   - Delete old chart components
   - Delete StatisticsContext
   - Delete old StatisticsPage
   - Update routes

---

## Date Range Logic

**Daily View:**
- Today (Central Time) + previous 29 days = 30 days total
- Example on Jan 16: Shows Dec 18 through Jan 16

**Monthly View:**
- Current calendar month + previous 11 months = 12 months total
- Example on Jan 16: Shows Feb 2025 through Jan 2026
- January shows data from Jan 1-16 (partial month)

**Note:** Calendar months, not rolling. February means Feb 1-28/29, not "30 days ending in February".

---

## Organization Filter

- Dropdown includes: "All" + all registered organizations from `registered_organizations` table + "Guest"
- "All" aggregates data across all organizations
- Individual org selection filters to just that org's data
- "Guest" shows data logged with `reg_organization = 'Guest'`

---

## Decisions Made

1. **Simplify from 8 reports to 4** - Remove Top 25 Zip Codes and Top 25 Referrals
2. **Server-side math** - All aggregation done in Supabase views, not JavaScript
3. **No timestamps** - Just DATE field in Central Time, no timezone conversion issues
4. **Single table** - One `app_usage_logs` table instead of multiple
5. **No email_referrals table** - Not needed for new reports
6. **Separate NavBars for Reports** - NavBar1Reports, NavBar2Reports, NavBar3Reports
7. **Live stats in NavBar3** - Top Zip, Top Assistance, Top Reg Org (all time)
8. **Organization filter applies to all reports** - Not just monthly
9. **Daily/Monthly toggle** - Two buttons, applies to all 4 reports
10. **Calendar periods** - Months are calendar months, not rolling
