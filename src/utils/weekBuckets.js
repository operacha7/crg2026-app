// src/utils/weekBuckets.js
// Helpers for the Weekly view of the Reports charts + Usage Data Table.
// A "week" runs Sunday → Saturday. Daily usage rows (v_daily_usage, keyed by
// log_date "YYYY-MM-DD") are bucketed into weeks client-side, so no new
// Supabase view is required — the weekly view just re-aggregates the same
// daily fetch the old Daily view used.

// How many complete weeks the weekly column chart and the Usage Data Table show.
export const WEEKS_TO_SHOW = 12;

// Days of daily data to fetch for the weekly view. One extra week beyond
// WEEKS_TO_SHOW covers the partial boundary week so, after bucketing, at least
// WEEKS_TO_SHOW complete buckets are available to slice.
export const WEEKLY_FETCH_DAYS = 7 * (WEEKS_TO_SHOW + 1); // 91

// Given a "YYYY-MM-DD" date string, return the "YYYY-MM-DD" of the Sunday that
// starts its week. Parsed as a local date (no timezone conversion) so we only
// ever do day-of-week + day arithmetic and never risk a UTC off-by-one.
export function getWeekStartStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - dt.getDay()); // getDay() 0 = Sunday
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Given a week-start "YYYY-MM-DD" (a Sunday), return { start, end } as short
// "M/D" strings for the Saturday-ending week — used for the wrapped column
// labels and headers (start on line 1, end on line 2).
export function formatWeekRange(weekStartStr) {
  const [y, m, d] = weekStartStr.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  return {
    start: `${start.getMonth() + 1}/${start.getDate()}`,
    end: `${end.getMonth() + 1}/${end.getDate()}`,
  };
}
