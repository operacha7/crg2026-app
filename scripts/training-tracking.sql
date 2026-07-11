-- training-tracking.sql
-- Pending manual Supabase steps for the July 2026 training changes. Run once in
-- the Supabase SQL editor. Each statement is idempotent (safe to re-run).
--
-- Context:
--   1) Participation moved to a new append-only log, `training_taken` (one row
--      per calendar-add now, video views later). The "N saved this session"
--      count is DERIVED from a COUNT of its rows, so the old
--      training_sessions.calendar_adds counter + its RPC are retired.
--   2) The "suggest a better time" availability matrix was removed (zero usage),
--      so its `training_request` table is dropped.
--
-- Code side is already done (functions/track-calendar-add.js,
-- src/services/dataService.js). This file is the DB half.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) training_taken — participation log
-- ─────────────────────────────────────────────────────────────────────────────
-- The table itself was already created by hand; this CREATE is here as the
-- authoritative schema of record (no-op if it exists). NOTE: no created_at
-- column (intentionally omitted).
create table if not exists training_taken (
  id               bigint generated always as identity primary key,
  reg_organization text,     -- PARENT/login org (from session cookie 'org' claim), else 'Guest'
  session_id       integer,  -- training_sessions.id_no for live; null for video
  training         text,     -- session title (live) or video name (video)
  medium           text,     -- 'live' | 'video'
  attended         boolean,  -- defaults true on add; flip to false later for no-shows
  date             date,     -- Central date of the event
  time             time,     -- Central time of the event
  organization     text      -- selected CHILD org (from request body), falls back to parent
);

-- Browser may READ (needed to derive the "N saved this session" count). Only the
-- secret/service key may INSERT (via functions/track-calendar-add.js) — there is
-- deliberately NO insert policy.
alter table training_taken enable row level security;
drop policy if exists "training_taken read" on training_taken;
create policy "training_taken read" on training_taken
  for select to public using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Retire the old counter (count now comes from training_taken)
-- ─────────────────────────────────────────────────────────────────────────────
alter table training_sessions drop column if exists calendar_adds;

-- The atomic-increment RPC is no longer called. Drop whichever signature exists
-- (id_no is int4, so `integer` is the likely one; bigint kept as a fallback).
drop function if exists increment_training_calendar_adds(integer);
drop function if exists increment_training_calendar_adds(bigint);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Remove the availability matrix's table (feature removed)
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists training_request;
