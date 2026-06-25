// src/utils/calendar.js
// Helpers for the Training Sessions page (src/views/TrainingPage.js).
//
// Sessions are stored in Supabase as a date (`session_date`) plus wall-clock
// start/end times (`start_time`, `end_time`) that are understood to be in
// Houston **Central time**. These helpers turn that wall-clock data into real
// absolute instants (Date objects) and into calendar exports:
//   - sessionToInstants()    → { start, end } Date objects (used by the page's
//                              soft time-gate AND by both calendar builders, so
//                              the saved event always matches what's displayed).
//   - buildIcsDataUri()      → a `data:text/calendar` URI for an "Add to
//                              Calendar" download link. Universal: every
//                              calendar app (Apple, Outlook, Yahoo, Thunderbird,
//                              even Google) understands .ics — no server needed.
//   - buildGoogleCalendarUrl() → a one-click Google Calendar "TEMPLATE" link
//                              for the many users on Google Calendar.

const SESSION_TZ = "America/Chicago";

// Offset (ms) between `timeZone` wall-clock and UTC at the given instant.
// Positive/negative such that:  wallClockAsUTC = realInstant + offset.
// For Central in summer (CDT, UTC-5) this returns -5h; in winter (CST) -6h.
function getTimeZoneOffsetMs(timeZone, date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map = {};
  for (const part of dtf.formatToParts(date)) {
    map[part.type] = part.value;
  }
  // `hour` can come back as "24" at midnight in some engines — normalize to 0.
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return asUTC - date.getTime();
}

// Convert a Central-time wall-clock (date "YYYY-MM-DD" + time "HH:MM[:SS]")
// into the real UTC instant it represents. DST-correct: it measures the actual
// Central offset in effect on that date rather than assuming a fixed -5/-6.
function centralWallClockToDate(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, mo, d] = String(dateStr).split("-").map(Number);
  const [hh, mm = 0, ss = 0] = String(timeStr).split(":").map(Number);
  if ([y, mo, d, hh].some((n) => Number.isNaN(n))) return null;

  // First guess: pretend the wall-clock is already UTC, then correct by the
  // zone offset measured at that guessed instant. A single correction is exact
  // except in the ~1hr DST fold/gap, which training sessions never land in.
  const guess = Date.UTC(y, mo - 1, d, hh, mm, ss);
  const offset = getTimeZoneOffsetMs(SESSION_TZ, new Date(guess));
  return new Date(guess - offset);
}

// { start, end } absolute Date instants for a session row, or nulls if the
// row is missing date/time fields.
export function sessionToInstants(session) {
  if (!session) return { start: null, end: null };
  return {
    start: centralWallClockToDate(session.session_date, session.start_time),
    end: centralWallClockToDate(session.session_date, session.end_time),
  };
}

// Display formatters pinned to Houston time so a viewer in another timezone
// still reads the schedule as Central. Shared by the Training page and the
// in-app "session starting" popup so they format identically.
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "numeric",
  minute: "2-digit",
});

// { dateLabel, timeLabel } for display, or nulls if the row lacks valid times.
// e.g. { dateLabel: "Monday, June 15, 2026", timeLabel: "2:00 PM – 2:40 PM CT" }
export function formatSessionDateTime(session) {
  const { start, end } = sessionToInstants(session);
  if (!start || !end) return { dateLabel: null, timeLabel: null };
  return {
    dateLabel: DATE_FMT.format(start),
    timeLabel: `${TIME_FMT.format(start)} – ${TIME_FMT.format(end)} CT`,
  };
}

// Short formatters for the Training card's DATE / STARTS / DURATION grid.
const DATE_SHORT_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "short",
  month: "short",
  day: "numeric",
});
const YEAR_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
});

// Broken-out display pieces for the Training card, or null if times are invalid.
// e.g. { weekdayDate: "Mon, Jun 1", year: "2026", startTime: "10:45 AM",
//        endTime: "11:30 AM", durationMin: 45, start, end }
export function getSessionDisplayParts(session) {
  const { start, end } = sessionToInstants(session);
  if (!start || !end) return null;
  return {
    start,
    end,
    weekdayDate: DATE_SHORT_FMT.format(start),
    year: YEAR_FMT.format(start),
    startTime: TIME_FMT.format(start),
    endTime: TIME_FMT.format(end),
    durationMin: Math.round((end.getTime() - start.getTime()) / 60000),
  };
}

// ── Join-button state machine ────────────────────────────────────────────────
// Shared by the Training page, the in-app popup, and the footer button. All
// windows are relative to the session start time S:
//   future (gray)    now < S − 20m    → "Starts …" countdown, not clickable
//   soon   (yellow)  S − 20m → S − 5m → "Starts …" countdown, not clickable
//   live   (green)   S − 5m  → S + 5m → "Join Now - Live" + pulse
//   late   (orange)  S + 5m  → S + 15m → "Join Now" + pulse
//   gone             now ≥ S + 15m    → panel/button removed
export const TRAINING_YELLOW_BEFORE_MS = 20 * 60 * 1000;
export const TRAINING_GREEN_BEFORE_MS = 5 * 60 * 1000;
export const TRAINING_GREEN_AFTER_MS = 5 * 60 * 1000;
export const TRAINING_REMOVE_AFTER_MS = 15 * 60 * 1000;

export function getButtonState(start, now) {
  if (!start) return "unavailable";
  const s = start.getTime();
  if (now >= s + TRAINING_REMOVE_AFTER_MS) return "gone";
  if (now < s - TRAINING_YELLOW_BEFORE_MS) return "future"; // gray
  if (now < s - TRAINING_GREEN_BEFORE_MS) return "soon"; // yellow
  if (now < s + TRAINING_GREEN_AFTER_MS) return "live"; // green
  return "late"; // orange (→ +15m)
}

// Humanized time-until-start for the non-clickable gray + yellow states, e.g.
// "Starts 3d 4h" / "Starts 2h 14m" / "Starts 18m".
export function formatCountdown(startMs, now) {
  const ms = startMs - now;
  if (ms <= 0) return "Starts now";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  if (days >= 1) {
    const hrs = Math.floor((totalMin % 1440) / 60);
    return `Starts ${days}d ${hrs}h`;
  }
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours >= 1) return `Starts ${hours}h ${mins}m`;
  return `Starts ${mins}m`;
}

// How far ahead a session starts surfacing in the footer button / popup. Set to
// ~1 week so users get advance notice and can add it to their calendar before the
// day arrives (rather than only finding out the day-of). Tunable.
export const TRAINING_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

// The single session to surface in the footer button / popup: the one currently
// in its live/late window if any, else the earliest upcoming session that starts
// within `leadMs` from now (default ~1 week) and hasn't passed its +15m cutoff.
// null if none. Broadened from today-only so an upcoming session is announced —
// and can be calendar-added — days ahead, not just on its own day.
export function getUpcomingSession(sessions, now, leadMs = TRAINING_LEAD_MS) {
  if (!Array.isArray(sessions)) return null;
  const horizon = now + leadMs;
  const candidates = sessions
    .map((s) => ({ s, start: centralWallClockToDate(s.session_date, s.start_time) }))
    .filter(({ start }) => start && now < start.getTime() + TRAINING_REMOVE_AFTER_MS)
    .filter(({ start }) => start.getTime() <= horizon)
    .sort((a, b) => a.start - b.start);
  const liveNow = candidates.find(
    ({ start }) => now >= start.getTime() - TRAINING_GREEN_BEFORE_MS
  );
  return (liveNow || candidates[0])?.s || null;
}

// Central-time calendar day key for a Date instant, "YYYY-MM-DD" (en-CA gives
// ISO order). Used by the sidebar calendar to mark session days / today in
// Houston time regardless of the viewer's own timezone.
const YMD_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function centralYmd(date) {
  return YMD_FMT.format(date);
}

// Format a Date as the iCalendar/Google UTC basic format: 20260615T190000Z
function toICalUtc(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Escape text for an ICS property value (RFC 5545 §3.3.11).
function escapeIcsText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Ensure a Meet link is an absolute URL. Admins sometimes paste a scheme-less
// link (e.g. "meet.google.com/abc-defg-hij"); used raw as an <a href> that's a
// *relative* path, so the browser navigates within the SPA (→ catch-all → /find)
// instead of opening Meet. Prepend https:// when no http(s) scheme is present.
// Returns "" for empty input so callers can treat it as "no link".
export function normalizeMeetUrl(link) {
  const raw = String(link || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}

// Build the human-readable event body shared by both calendar exports.
function buildDescription(session) {
  const parts = [];
  if (session.description) parts.push(session.description);
  const link = normalizeMeetUrl(session.meet_link);
  if (link) parts.push(`Join Google Meet: ${link}`);
  return parts.join("\n\n");
}

// Build a `data:text/calendar` URI for an .ics download. Returns null if the
// session lacks valid date/time data.
export function buildIcsDataUri(session) {
  const { start, end } = sessionToInstants(session);
  if (!start || !end) return null;

  const title = session.title || "CRG Houston Training";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRG Houston//Training Sessions//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:training-${session.id_no || toICalUtc(start)}@crghouston.org`,
    `DTSTAMP:${toICalUtc(new Date())}`,
    `DTSTART:${toICalUtc(start)}`,
    `DTEND:${toICalUtc(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(buildDescription(session))}`,
    session.meet_link ? `URL:${escapeIcsText(normalizeMeetUrl(session.meet_link))}` : null,
    "LOCATION:Google Meet (online)",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  // CRLF line endings per the spec; encode for use as an href.
  const ics = lines.join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

// A safe-ish filename for the .ics download, e.g. "crg-training-session-1.ics".
export function buildIcsFilename(session) {
  const base = (session.title || "crg-training")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "crg-training"}.ics`;
}

// Build a one-click Google Calendar "Add event" link. Returns null if the
// session lacks valid date/time data.
export function buildGoogleCalendarUrl(session) {
  const { start, end } = sessionToInstants(session);
  if (!start || !end) return null;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: session.title || "CRG Houston Training",
    dates: `${toICalUtc(start)}/${toICalUtc(end)}`,
    details: buildDescription(session),
    location: "Google Meet (online)",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Build a one-click Outlook.com "Add event" link (also works for Outlook web /
// Microsoft 365 personal accounts). Uses ISO timestamps with the trailing Z so
// Outlook reads them as UTC, matching the Google/.ics events. Returns null if
// the session lacks valid date/time data.
export function buildOutlookCalendarUrl(session) {
  const { start, end } = sessionToInstants(session);
  if (!start || !end) return null;

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: session.title || "CRG Houston Training",
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: buildDescription(session),
    location: "Google Meet (online)",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
