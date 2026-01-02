-- TZTest Debug Trap
-- Run this in Supabase SQL Editor to catch what's inserting TZTest records
-- The trigger should fire tomorrow (July 1st) around 4:30 AM UTC (11:30 PM CST tonight)

-- Step 1: Create a log table to capture the insert
CREATE TABLE IF NOT EXISTS debug_tztest_log (
  id SERIAL PRIMARY KEY,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  query TEXT,
  client_info TEXT,
  db_session_user TEXT,
  db_current_user TEXT,
  pg_backend_pid INTEGER
);

-- Step 2: Create trigger function that logs TZTest inserts
CREATE OR REPLACE FUNCTION log_tztest_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reg_organization = 'TZTest' THEN
    INSERT INTO debug_tztest_log (query, client_info, db_session_user, db_current_user, pg_backend_pid)
    VALUES (
      current_query(),
      COALESCE(inet_client_addr()::text, 'no_client_addr') || ' | ' || COALESCE(current_setting('application_name', true), 'no_app_name'),
      session_user::text,
      current_user::text,
      pg_backend_pid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Attach trigger to app_usage_logs table
DROP TRIGGER IF EXISTS catch_tztest ON app_usage_logs;
CREATE TRIGGER catch_tztest
BEFORE INSERT ON app_usage_logs
FOR EACH ROW
EXECUTE FUNCTION log_tztest_insert();

-- Verify setup
SELECT 'Trap is set! Check debug_tztest_log after July 1st 4:30 AM UTC' as status;

-- After the event triggers, run this to see what was captured:
-- SELECT * FROM debug_tztest_log;

-- Cleanup (run these AFTER you've caught the culprit):
-- DROP TRIGGER IF EXISTS catch_tztest ON app_usage_logs;
-- DROP FUNCTION IF EXISTS log_tztest_insert();
-- DROP TABLE IF EXISTS debug_tztest_log;
