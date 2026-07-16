-- scripts/schedule-opportunity-scan.sql
-- Weekly trigger for the Opportunity Scan (Supabase pg_cron + pg_net → Cloudflare).
--
-- Run this ONCE in the Supabase SQL editor, after SCAN_TRIGGER_SECRET is set in
-- the Cloudflare Pages environment variables. Steps 1-3 are one-time setup;
-- step 4 is the schedule itself and is the only part you'd re-run to change the
-- cadence.
--
-- Why pg_cron only *triggers* Cloudflare rather than doing the work: the scan
-- lives in functions/opportunity-scan.js alongside the app's other Anthropic
-- calls, reusing the same secrets and patterns. Postgres just rings the bell.

-- 1. Extensions (both live in the `extensions` schema on Supabase).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Store the trigger secret in Vault — NOT inline in the cron command, which
--    would otherwise sit in cron.job in plaintext for anyone with DB access.
--    Replace the first argument with the same value set as SCAN_TRIGGER_SECRET
--    in Cloudflare. Keep the single quotes — they are SQL string delimiters and
--    are NOT stored; the Cloudflare value must be bare (no quotes) to match.
--
--    FIRST TIME ONLY. `create_secret` inserts, and the name is unique, so
--    re-running it errors with "duplicate key ... secrets_name_idx". To CHANGE
--    the value later (rotation, or fixing a bad paste), update in place instead:
--
--      SELECT vault.update_secret(
--        (SELECT id FROM vault.secrets WHERE name = 'scan_trigger_secret'),
--        'THE_NEW_SECRET');
SELECT vault.create_secret('REPLACE_WITH_SCAN_TRIGGER_SECRET', 'scan_trigger_secret');

-- 3. Sanity-check the secret reads back before scheduling anything against it.
--    Expect exactly one row matching what you set above. Do not skip this: the
--    cron command reads the secret via a subquery, and jsonb_build_object turns
--    a NULL result into 'x-scan-secret': null WITHOUT erroring — which the
--    endpoint rejects as a 401 that looks exactly like a wrong secret.
SELECT name, decrypted_secret
FROM vault.decrypted_secrets
WHERE name = 'scan_trigger_secret';

-- 4. Schedule: Mondays at 13:00 UTC.
--
--    TIMEZONE NOTE: pg_cron schedules are UTC. 13:00 UTC = 8am Houston during
--    CDT (Mar-Nov) and 7am during CST (Nov-Mar). The hour drifting once or twice
--    a year is harmless for a weekly digest, so this deliberately does NOT try to
--    track DST — chasing it would mean two jobs and a seasonal swap.
--
--    `async: true` is REQUIRED. pg_net gives up on the response after a few
--    seconds; a real run takes minutes. That flag makes the endpoint ack
--    immediately (202) and finish the work in waitUntil. Without it the run
--    would be cancelled when pg_net hangs up, and no findings would land.
SELECT cron.schedule(
  'weekly-opportunity-scan',
  '0 13 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://crghouston.org/opportunity-scan',
    body := '{"async": true}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scan-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
                        WHERE name = 'scan_trigger_secret')
    )
  );
  $$
);

-- ---------------------------------------------------------------------------
-- Operating notes (not run as part of setup)
-- ---------------------------------------------------------------------------

-- Confirm the job registered:
--   SELECT jobid, jobname, schedule, active FROM cron.job;

-- Last few runs (this only reports whether pg_net POSTed, NOT whether the scan
-- succeeded — the run outlives the request, so the real outcome is in the
-- Cloudflare logs and the digest email):
--   SELECT jobid, status, return_message, start_time
--   FROM cron.job_run_details
--   WHERE jobname = 'weekly-opportunity-scan'
--   ORDER BY start_time DESC LIMIT 5;

-- The HTTP response pg_net actually got (expect 202 {"ok":true,"started":true}):
--   SELECT id, status_code, content, created
--   FROM net._http_response ORDER BY created DESC LIMIT 5;

-- Fire it manually without waiting for Monday (same call as the schedule):
--   SELECT net.http_post(
--     url := 'https://crghouston.org/opportunity-scan',
--     body := '{"async": true}'::jsonb,
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-scan-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
--                         WHERE name = 'scan_trigger_secret')));

-- Pause / resume / remove:
--   UPDATE cron.job SET active = false WHERE jobname = 'weekly-opportunity-scan';
--   UPDATE cron.job SET active = true  WHERE jobname = 'weekly-opportunity-scan';
--   SELECT cron.unschedule('weekly-opportunity-scan');

-- Change the cadence — re-running cron.schedule with the SAME jobname replaces
-- the existing schedule rather than creating a second job.
