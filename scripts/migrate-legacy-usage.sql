-- ============================================================
-- LEGACY USAGE DATA MIGRATION SCRIPT
-- ============================================================
-- This script migrates usage data from the legacy crg-app database
-- to the new crg2026-app database.
--
-- Run these scripts in the NEW crg2026-app Supabase database
-- (except Step 2 which runs in the LEGACY database)
--
-- Created: 2026-01-17
-- ============================================================


-- ============================================================
-- STEP 1: Create usage_log_summary table for historical data
-- Run this in: NEW crg2026-app database
-- ============================================================
DROP TABLE IF EXISTS usage_log_summary CASCADE;

CREATE TABLE usage_log_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month DATE NOT NULL,  -- First day of month (e.g., 2025-07-01)
  reg_organization TEXT NOT NULL,
  action_type TEXT NOT NULL,  -- 'search', 'email', 'pdf'
  search_mode TEXT,  -- 'Zip Code', 'Organization', 'Location'
  assistance_type TEXT,  -- 'Food', 'Rent', etc. (when search_field = 'assistance')
  search_value TEXT,  -- '77002', etc. (when search_mode = 'Zip Code')
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_usage_summary_month ON usage_log_summary(month);
CREATE INDEX IF NOT EXISTS idx_usage_summary_org ON usage_log_summary(reg_organization);
CREATE INDEX IF NOT EXISTS idx_usage_summary_action ON usage_log_summary(action_type);


-- ============================================================
-- STEP 2: Export Legacy Data (SUMMARIZED)
-- Run this in: LEGACY crg-app database
-- Then export results to CSV and import into usage_log_summary
-- ============================================================
/*
SELECT
  DATE_TRUNC('month', date)::DATE as month,
  reg_organization,
  CASE
    WHEN action_type IN ('select', 'search') THEN 'search'
    ELSE action_type
  END as action_type,
  nav_item as search_mode,
  CASE
    WHEN search_field = 'assistance' THEN search_value
    ELSE NULL
  END as assistance_type,
  CASE
    WHEN search_field = 'zip code' THEN search_value
    ELSE NULL
  END as search_value,
  COUNT(*) as count
FROM app_usage_logs
WHERE date <= '2026-01-31'
GROUP BY
  DATE_TRUNC('month', date),
  reg_organization,
  CASE
    WHEN action_type IN ('select', 'search') THEN 'search'
    ELSE action_type
  END,
  nav_item,
  CASE
    WHEN search_field = 'assistance' THEN search_value
    ELSE NULL
  END,
  CASE
    WHEN search_field = 'zip code' THEN search_value
    ELSE NULL
  END
ORDER BY month, reg_organization;
*/


-- ============================================================
-- STEP 3: Update v_monthly_usage to include summary data
-- Run this in: NEW crg2026-app database (AFTER importing CSV)
-- ============================================================
-- NOTE: Returns month as TEXT 'YYYY-MM' to avoid JavaScript timezone issues
-- NOTE: search_value is NOT included - monthly reports aggregate at a higher level
--       to avoid row explosion (each unique zip code would create separate rows)
-- First drop the existing view
DROP VIEW IF EXISTS v_monthly_usage;

-- Then create the new version without search_value
CREATE OR REPLACE VIEW v_monthly_usage AS
SELECT
  month,
  reg_organization,
  action_type,
  search_mode,
  assistance_type,
  SUM(count) as count
FROM (
  -- Current detail data (Feb 2026+)
  SELECT
    TO_CHAR(log_date, 'YYYY-MM') as month,
    reg_organization,
    action_type,
    search_mode,
    assistance_type,
    COUNT(*) as count
  FROM app_usage_logs
  GROUP BY TO_CHAR(log_date, 'YYYY-MM'), reg_organization, action_type, search_mode, assistance_type

  UNION ALL

  -- Historical summary data (through Jan 2026)
  SELECT
    TO_CHAR(month, 'YYYY-MM') as month,
    reg_organization,
    action_type,
    search_mode,
    assistance_type,
    SUM(count) as count
  FROM usage_log_summary
  GROUP BY TO_CHAR(month, 'YYYY-MM'), reg_organization, action_type, search_mode, assistance_type
) combined
GROUP BY month, reg_organization, action_type, search_mode, assistance_type;


-- ============================================================
-- STEP 4: v_daily_usage - NO CHANGE NEEDED
-- Daily view only shows detail data from app_usage_logs
-- Summary data is monthly only
-- ============================================================
-- Original view remains:
-- SELECT log_date, reg_organization, action_type, search_mode, assistance_type, count(*)
-- FROM app_usage_logs
-- GROUP BY log_date, reg_organization, action_type, search_mode, assistance_type;


-- ============================================================
-- STEP 5: Update v_live_stats to include summary data
-- Run this in: NEW crg2026-app database (AFTER importing CSV)
-- ============================================================
-- NOTE: Filters exclude NULL, empty string, and literal 'null' (from CSV import)
-- NOTE: Administrator is excluded from org stats (test account)
DROP VIEW IF EXISTS v_live_stats;

CREATE OR REPLACE VIEW v_live_stats AS
WITH combined_data AS (
  -- Current detail (each row = 1 event)
  SELECT reg_organization, search_mode, search_value, assistance_type, 1 as count
  FROM app_usage_logs

  UNION ALL

  -- Historical summary (count is pre-aggregated)
  SELECT reg_organization, search_mode, search_value, assistance_type, count
  FROM usage_log_summary
),
zip_stats AS (
  SELECT search_value AS top_zip, SUM(count) AS top_zip_count
  FROM combined_data
  WHERE search_mode = 'Zip Code'
    AND search_value IS NOT NULL
    AND search_value != ''
    AND search_value != 'null'
  GROUP BY search_value
  ORDER BY SUM(count) DESC
  LIMIT 1
),
zip_total AS (
  SELECT SUM(count) AS total
  FROM combined_data
  WHERE search_mode = 'Zip Code'
    AND search_value IS NOT NULL
    AND search_value != ''
    AND search_value != 'null'
),
assistance_stats AS (
  SELECT assistance_type AS top_assistance, SUM(count) AS top_assistance_count
  FROM combined_data
  WHERE assistance_type IS NOT NULL
    AND assistance_type != ''
    AND assistance_type != 'null'
  GROUP BY assistance_type
  ORDER BY SUM(count) DESC
  LIMIT 1
),
assistance_total AS (
  SELECT SUM(count) AS total
  FROM combined_data
  WHERE assistance_type IS NOT NULL
    AND assistance_type != ''
    AND assistance_type != 'null'
),
org_stats AS (
  SELECT reg_organization AS top_reg_org, SUM(count) AS top_reg_org_count
  FROM combined_data
  WHERE reg_organization IS NOT NULL
    AND reg_organization != ''
    AND reg_organization != 'null'
    AND reg_organization != 'Administrator'
  GROUP BY reg_organization
  ORDER BY SUM(count) DESC
  LIMIT 1
),
org_total AS (
  SELECT SUM(count) AS total
  FROM combined_data
  WHERE reg_organization IS NOT NULL
    AND reg_organization != ''
    AND reg_organization != 'null'
    AND reg_organization != 'Administrator'
)
SELECT
  COALESCE(z.top_zip, 'N/A') AS top_zip,
  COALESCE(z.top_zip_count, 0) AS top_zip_count,
  COALESCE(zt.total, 0) AS total_zip_searches,
  COALESCE(a.top_assistance, 'N/A') AS top_assistance,
  COALESCE(a.top_assistance_count, 0) AS top_assistance_count,
  COALESCE(at.total, 0) AS total_assistance_searches,
  COALESCE(o.top_reg_org, 'N/A') AS top_reg_org,
  COALESCE(o.top_reg_org_count, 0) AS top_reg_org_count,
  COALESCE(ot.total, 0) AS total_searches
FROM (SELECT 1) dummy
LEFT JOIN zip_stats z ON true
LEFT JOIN zip_total zt ON true
LEFT JOIN assistance_stats a ON true
LEFT JOIN assistance_total at ON true
LEFT JOIN org_stats o ON true
LEFT JOIN org_total ot ON true;


-- ============================================================
-- VERIFICATION QUERIES
-- Run these AFTER importing the CSV to verify migration
-- ============================================================

-- Total records imported into summary
SELECT SUM(count) as summary_total FROM usage_log_summary;

-- Breakdown by month
SELECT month, SUM(count) as total
FROM usage_log_summary
GROUP BY month
ORDER BY month;

-- Breakdown by action type
SELECT action_type, SUM(count) as total
FROM usage_log_summary
GROUP BY action_type;

-- Test the updated monthly view (should show all months including historical)
SELECT month, SUM(count) as total
FROM v_monthly_usage
GROUP BY month
ORDER BY month;

-- Compare totals: v_monthly_usage should equal app_usage_logs + usage_log_summary
SELECT
  (SELECT SUM(count) FROM v_monthly_usage) as view_total,
  (SELECT COUNT(*) FROM app_usage_logs) as detail_total,
  (SELECT SUM(count) FROM usage_log_summary) as summary_total;


-- ============================================================
-- FUTURE: Summarization Script for New Detail Data
-- Run this annually to summarize old detail data
-- ============================================================
/*
-- Example: Summarize 2026 data at end of year, then delete detail

-- Step 1: Insert summaries into usage_log_summary
INSERT INTO usage_log_summary (month, reg_organization, action_type, search_mode, assistance_type, search_value, count)
SELECT
  DATE_TRUNC('month', log_date)::DATE as month,
  reg_organization,
  action_type,
  search_mode,
  assistance_type,
  search_value,
  COUNT(*) as count
FROM app_usage_logs
WHERE log_date < '2027-01-01'  -- Adjust year as needed
GROUP BY DATE_TRUNC('month', log_date), reg_organization, action_type, search_mode, assistance_type, search_value;

-- Step 2: Verify counts match before deleting
SELECT
  (SELECT COUNT(*) FROM app_usage_logs WHERE log_date < '2027-01-01') as detail_count,
  (SELECT SUM(count) FROM usage_log_summary WHERE month >= '2026-01-01' AND month < '2027-01-01') as summary_count;

-- Step 3: Delete detail data (only after verification!)
-- DELETE FROM app_usage_logs WHERE log_date < '2027-01-01';
*/
