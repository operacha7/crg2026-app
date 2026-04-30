// src/services/usageService.js
// Usage logging utility for reports

import { supabase } from '../supabaseClient';

/**
 * Get current date in Central Time as YYYY-MM-DD string
 */
function getCentralDate() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Chicago'
  });
}

/**
 * Log a usage event to app_usage_logs
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

  if (error) {
    console.error('Usage log error:', error);
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
    query = query.eq('reg_organization', reg_organization);
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
  return data || [];
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
      query = query.eq('reg_organization', reg_organization);
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
      return allData;
    }

    allData = allData.concat(data);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log('fetchMonthlyUsage result:', allData);
  return allData;
}

/**
 * Fetch list of registered organizations for dropdown
 */
export async function fetchOrganizations() {
  const { data, error } = await supabase
    .from('registered_organizations')
    .select('reg_organization, org_color')
    .order('reg_organization', { ascending: true });

  if (error) {
    console.error('Fetch orgs error:', error);
    return [];
  }

  return data || [];
}
