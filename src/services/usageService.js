// src/services/usageService.js
// Usage logging utility for reports

import { supabase } from '../supabaseClient';

// TODO: remove after 2027-06-01 — by then the trailing-12-month window has
// fully rolled past the 2026-05 org rename and no legacy names remain in
// app_usage_logs that fall inside any active report range. This was a
// one-time structural change (org-level → parent-level login credentials);
// not expected to recur.
const LEGACY_ORG_RENAMES = {
  "Christian Community Service Center (Central)": "Christian Community Service Center (CCSC)",
  "Harris County Housing & Community Development": "Harris County",
  "St Michael the Archangel (SVdP D3)": "Society of St Vincent de Paul",
  "St Theresa (SVdP D2) Sugar Land": "Society of St Vincent de Paul",
  "St Thomas More (SVdP D3)": "Society of St Vincent de Paul",
  "St Vincent de Paul (SVdP D3)": "Society of St Vincent de Paul",
};
const canonicalOrg = (name) => LEGACY_ORG_RENAMES[name] || name;
const legacyNamesFor = (currentName) =>
  Object.keys(LEGACY_ORG_RENAMES).filter(k => LEGACY_ORG_RENAMES[k] === currentName);
const remapRowsToCanonical = (rows) =>
  (rows || []).map(row => ({ ...row, reg_organization: canonicalOrg(row.reg_organization) }));

/**
 * Get current date in Central Time as YYYY-MM-DD string.
 * Used by fetchDailyUsage's date-range query. logUsage no longer needs
 * this — the server stamps log_date itself to prevent backdating.
 */
function getCentralDate() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Chicago'
  });
}

/**
 * Log a usage event to app_usage_logs.
 *
 * Routes through /log-usage (an auth-aware Cloudflare Function) instead of
 * inserting into Supabase directly from the browser. The old direct insert
 * required an anon-writable INSERT policy on app_usage_logs, which let
 * anyone spam the table — that policy is being dropped. The Function uses
 * the session cookie to authoritatively set reg_organization (registered
 * orgs can't spoof each other's logs); guest writes are still allowed but
 * must claim "Guest" exactly.
 *
 * Server stamps log_date in Central Time so a malicious caller can't
 * backdate rows.
 *
 * @param {Object} params
 * @param {string} params.reg_organization - Organization name or "Guest"
 * @param {string} params.action_type - "search", "email", or "pdf"
 * @param {string} [params.search_mode] - "Zip Code", "Organization", "Location", "Ask a Question"
 * @param {string} [params.assistance_type] - Assistance type name (e.g., "Food", "Rent")
 * @param {string} [params.search_value] - The actual value searched (e.g., zip code "77025")
 */
export async function logUsage({
  reg_organization,
  action_type,
  search_mode = null,
  assistance_type = null,
  search_value = null
}) {
  try {
    const res = await fetch('/log-usage', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reg_organization: reg_organization || 'Guest',
        action_type,
        search_mode,
        assistance_type,
        search_value,
      }),
    });
    if (!res.ok) {
      // Non-2xx — surface to the console but don't break the user's flow.
      // Logging is fire-and-forget UX-wise; we don't want a logging failure
      // to make a search appear broken.
      console.error('Usage log error: HTTP', res.status);
    }
  } catch (err) {
    console.error('Usage log error:', err);
  }
}

/**
 * Fetch live stats for NavBar3 ticker
 * Returns top zip, top assistance, top reg org with counts and percentages
 */
export async function fetchLiveStats() {
  const { data, error } = await supabase
    .from('v_live_stats')
    .select('*')
    .single();

  if (error) {
    console.error('Live stats error:', error);
    return null;
  }

  return {
    topZip: {
      value: data.top_zip,
      count: data.top_zip_count,
      total: data.total_zip_searches,
      percentage: data.total_zip_searches > 0
        ? Math.round((data.top_zip_count / data.total_zip_searches) * 100)
        : 0
    },
    topAssistance: {
      value: data.top_assistance,
      count: data.top_assistance_count,
      total: data.total_assistance_searches,
      percentage: data.total_assistance_searches > 0
        ? Math.round((data.top_assistance_count / data.total_assistance_searches) * 100)
        : 0
    },
    topRegOrg: {
      value: data.top_reg_org,
      count: data.top_reg_org_count,
      total: data.total_searches,
      percentage: data.total_searches > 0
        ? Math.round((data.top_reg_org_count / data.total_searches) * 100)
        : 0
    }
  };
}

/**
 * Fetch daily usage data for reports
 *
 * @param {Object} params
 * @param {string} [params.reg_organization] - Filter by org, or null for all
 * @param {string} [params.action_type] - Filter by action type
 * @param {string} [params.search_mode] - Filter by search mode
 * @param {number} [params.days] - Number of days to fetch (default 30)
 */
export async function fetchDailyUsage({
  reg_organization = null,
  action_type = null,
  search_mode = null,
  days = 30
} = {}) {
  // Calculate date range
  const endDate = getCentralDate();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startDateStr = startDate.toLocaleDateString('en-CA', {
    timeZone: 'America/Chicago'
  });

  console.log('fetchDailyUsage date range:', { startDateStr, endDate, days });

  let query = supabase
    .from('v_daily_usage')
    .select('*')
    .gte('log_date', startDateStr)
    .lte('log_date', endDate)
    .order('log_date', { ascending: true });

  if (reg_organization && reg_organization !== 'All' && reg_organization !== 'All Organizations') {
    const aliases = legacyNamesFor(reg_organization);
    query = aliases.length > 0
      ? query.in('reg_organization', [reg_organization, ...aliases])
      : query.eq('reg_organization', reg_organization);
  }

  if (action_type) {
    query = query.eq('action_type', action_type);
  }

  if (search_mode) {
    query = query.eq('search_mode', search_mode);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Daily usage error:', error);
    return [];
  }

  console.log('fetchDailyUsage result:', data);
  return remapRowsToCanonical(data);
}

/**
 * Format a month as YYYY-MM (matches v_monthly_usage TEXT format)
 */
function formatMonthLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Fetch monthly usage data for reports
 *
 * @param {Object} params
 * @param {string} [params.reg_organization] - Filter by org, or null for all
 * @param {string} [params.action_type] - Filter by action type
 * @param {string} [params.search_mode] - Filter by search mode
 * @param {number} [params.months] - Number of months to fetch (default 12)
 */
export async function fetchMonthlyUsage({
  reg_organization = null,
  action_type = null,
  search_mode = null,
  months = 12
} = {}) {
  // Calculate date range (current month + previous months)
  // View returns month as TEXT 'YYYY-MM', so we compare as strings
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const startMonthStr = formatMonthLocal(startMonth);
  const endMonthStr = formatMonthLocal(now);

  console.log('fetchMonthlyUsage date range:', { startMonthStr, endMonthStr, months });

  // Supabase enforces a server-side max-rows cap (default 1000) regardless of
  // .limit(), so paginate via .range() to be sure we get every row. Without
  // this, the most recent month's rows (last in ascending order) get silently
  // dropped once the view exceeds 1000 rows.
  const PAGE_SIZE = 1000;
  let allData = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('v_monthly_usage')
      .select('*')
      .gte('month', startMonthStr)
      .lte('month', endMonthStr)
      .order('month', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (reg_organization && reg_organization !== 'All' && reg_organization !== 'All Organizations') {
      const aliases = legacyNamesFor(reg_organization);
      query = aliases.length > 0
        ? query.in('reg_organization', [reg_organization, ...aliases])
        : query.eq('reg_organization', reg_organization);
    }

    if (action_type) {
      query = query.eq('action_type', action_type);
    }

    if (search_mode) {
      query = query.eq('search_mode', search_mode);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Monthly usage error:', error);
      return remapRowsToCanonical(allData);
    }

    allData = allData.concat(data);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log('fetchMonthlyUsage result:', allData);
  return remapRowsToCanonical(allData);
}

/**
 * Fetch list of registered organizations for Reports dropdowns and color
 * mapping. Routes through /list-org-colors (an auth-gated Cloudflare
 * Function) instead of selecting registered_organizations directly from
 * the browser — that table no longer has a public read policy. Falls back
 * to an empty array on any error so Reports degrades gracefully (charts
 * just render with default colors and the dropdown shows only "All").
 */
export async function fetchOrganizations() {
  try {
    const res = await fetch('/list-org-colors', { credentials: 'include' });
    if (!res.ok) {
      console.error('Fetch orgs error: HTTP', res.status);
      return [];
    }
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.orgs)) {
      console.error('Fetch orgs error: malformed response', data);
      return [];
    }
    return data.orgs;
  } catch (err) {
    console.error('Fetch orgs error:', err);
    return [];
  }
}
