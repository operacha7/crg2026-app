// src/utils/homeOrigin.js
//
// "Home" on the secondary/info pages should return the user to the PRIMARY page
// they came from — /find, the marketing home /, or an /assistance/* deep link —
// no matter how many info pages they hopped through.
//
// Why not navigate(-1): it steps back exactly one history entry, so a multi-hop
// trail (e.g. /find → Contact Support → Training → About → Home) landed on the
// previous page instead of the origin. And the vertical-bar Home was hardcoded
// to /find, so Contact Support always returned there regardless of entry point.
//
// Instead we remember the last primary page in sessionStorage (survives the
// page-component remounts that happen crossing the App.js ⇄ MainApp layers) and
// send Home there. Secondary pages never overwrite the memory.

const STORAGE_KEY = "crg_home_origin";

// Pages that must NOT be treated as a home origin. Landing on one of these
// leaves the remembered origin untouched, so Home still returns to the primary
// page the user came from.
const SECONDARY_PATHS = new Set([
  "/about",
  "/privacy",
  "/terms",
  "/training",
  "/support",
  "/reports",
  "/announcements",
]);

// Record the current location as the home origin, unless it's a secondary page.
export function recordHomeOrigin(pathname, search = "") {
  if (SECONDARY_PATHS.has(pathname)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, pathname + search);
  } catch {
    /* best-effort only — Home just falls back to the default */
  }
}

// Where Home should go. Falls back to the marketing/login home when nothing has
// been recorded yet (e.g. the user cold-landed directly on a secondary page).
export function getHomeOrigin(fallback = "/") {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || fallback;
  } catch {
    return fallback;
  }
}
