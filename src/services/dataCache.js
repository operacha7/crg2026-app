// src/services/dataCache.js
// localStorage-backed cache for the Phase 1 directory/assistance/zip_codes
// payload (the data the search UI needs to render). On a return visit the
// cached copy renders immediately while AppDataContext refetches in the
// background ("stale-while-revalidate"), so users skip the ~2s cold-start
// loading screen on every visit after the first.
//
// Versioning: bump CACHE_KEY when the directory/assistance/zip_codes schemas
// change in a way that would crash older shapes (e.g. removing a field that
// components read). The version bump invalidates every existing browser's
// cache on the next deploy, falling back to a fresh fetch — one slow load,
// then back to instant.
//
// TTL: 7 days. Past that we refuse to serve stale cache and force a fresh
// fetch — limits how out-of-date data can get if Supabase has been down or
// if the user hasn't visited in a while.

const CACHE_KEY = "crg-phase1-v1";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function readPhase1Cache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || !parsed?.data) return null;
    if (Date.now() - parsed.timestamp > TTL_MS) return null;
    const { directory, assistance, zipCodes } = parsed.data;
    if (!Array.isArray(directory) || !Array.isArray(assistance) || !Array.isArray(zipCodes)) {
      return null;
    }
    return parsed.data;
  } catch {
    // Corrupt JSON, disabled storage, etc. — treat as cache miss.
    return null;
  }
}

export function writePhase1Cache({ directory, assistance, zipCodes }) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data: { directory, assistance, zipCodes },
      })
    );
  } catch {
    // QuotaExceededError, private mode restrictions, etc. — silently skip;
    // caching is purely a performance optimization, not load-bearing.
  }
}
