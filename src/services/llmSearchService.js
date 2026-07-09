// src/services/llmSearchService.js
// Service for LLM-powered natural language search

/**
 * Send a natural language query to the LLM search endpoint
 * @param {string} query - The user's natural language search query
 * @param {Array} assistanceTypes - Available assistance types (for context)
 * @param {Array} zipCodes - Available zip codes (for context)
 * @returns {Promise<{success: boolean, filters?: object, interpretation?: string, message?: string}>}
 */
export async function searchWithLLM(query, assistanceTypes = [], zipCodes = []) {
  try {
    const endpoint = "/llm-search";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        assistanceTypes,
        zipCodes,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "LLM search failed",
      };
    }

    return {
      success: true,
      filters: data.filters,
      interpretation: data.interpretation,
      geocode_address: data.geocode_address,
      related_searches: data.related_searches || [],
    };
  } catch (error) {
    console.error("LLM search error:", error);
    return {
      success: false,
      message: "Network error. Please try again.",
    };
  }
}

/**
 * Apply LLM-generated filters to directory data
 * @param {Array} directory - The full directory data
 * @param {object} filters - Filters from LLM search
 * @param {object} assistanceLookup - Map of assistance name to assist_id
 * @returns {Array} Filtered directory records
 */
export function applyLLMFilters(directory, filters, assistanceLookup = {}) {
  if (!filters || !directory) return directory;

  let filtered = [...directory];

  // Filter by explicit record id_no list (e.g. "Show me id_no 1256, 147, 3").
  // Composes like every other field; for a pure id_no query the LLM returns only
  // id_nos, so the result is exactly those records regardless of status.
  if (filters.id_nos && filters.id_nos.length > 0) {
    const wanted = new Set(filters.id_nos.map(Number));
    filtered = filtered.filter(record => wanted.has(Number(record.id_no)));
  }

  // Filter by assistance types
  if (filters.assistance_types && filters.assistance_types.length > 0) {
    // Convert assistance names to assist_ids
    const assistIds = filters.assistance_types
      .map(name => {
        // Try exact match first
        if (assistanceLookup[name]) return assistanceLookup[name];
        // Try case-insensitive match
        const key = Object.keys(assistanceLookup).find(
          k => k.toLowerCase() === name.toLowerCase()
        );
        return key ? assistanceLookup[key] : null;
      })
      .filter(Boolean);

    if (assistIds.length > 0) {
      filtered = filtered.filter(record => assistIds.includes(record.assist_id));
    }
  }

  // Filter by zip codes (client_zip_codes field - orgs that SERVE these zips)
  if (filters.zip_codes && filters.zip_codes.length > 0) {
    filtered = filtered.filter(record => {
      const clientZips = parseClientZipCodes(record.client_zip_codes);
      return filters.zip_codes.some(zip => clientZips.includes(zip));
    });
  }

  // Filter by status
  if (filters.status_ids && filters.status_ids.length > 0) {
    filtered = filtered.filter(record =>
      filters.status_ids.includes(record.status_id)
    );
  }

  // Filter by day of week.
  // Strict when ANY day info is present anywhere — in hours.regular[].days,
  // hours.special[].pattern (e.g. "2nd Tu"), hours.labeled[].days, or in
  // hours_notes free text. Lenient only when no day info exists anywhere.
  if (filters.days && filters.days.length > 0) {
    const wantedDays = filters.days.map(normalizeDay);
    filtered = filtered.filter(record => {
      const hours = parseHoursJson(record.hours || record.org_hours);
      const knownDays = collectKnownDays(hours, record.hours_notes);

      if (knownDays.length > 0) {
        return wantedDays.some(d => knownDays.includes(d));
      }

      // Truly no day info — include
      return true;
    });
  }

  // Filter by time of day
  // Note: Records with null hours are INCLUDED (hours unknown, might be available)
  if (filters.time_filter) {
    filtered = filtered.filter(record => {
      const hours = parseHoursJson(record.hours || record.org_hours);
      // Include records with unknown hours - they might be open
      if (!hours || !hours.regular) return true;

      return hours.regular.some(slot => {
        return matchesTimeFilter(slot, filters.time_filter);
      });
    });
  }

  // Filter by requirements keywords (also searches hours_notes)
  if (filters.requirements_keywords && filters.requirements_keywords.length > 0) {
    filtered = filtered.filter(record => {
      const requirements = (record.requirements || "").toLowerCase();
      const hoursNotes = (record.hours_notes || "").toLowerCase();
      const searchableText = requirements + " " + hoursNotes;
      return filters.requirements_keywords.some(keyword =>
        searchableText.includes(keyword.toLowerCase())
      );
    });
  }

  // Filter by neighborhood
  if (filters.neighborhood && filters.neighborhood.trim()) {
    const searchNeighborhood = filters.neighborhood.toLowerCase().trim();
    filtered = filtered.filter(record => {
      const orgNeighborhood = (record.org_neighborhood || "").toLowerCase();
      const zipNeighborhoods = (record.zip_neighborhoods || "").toLowerCase();
      return orgNeighborhood.includes(searchNeighborhood) ||
             zipNeighborhoods.includes(searchNeighborhood);
    });
  }

  // Filter by organization name
  if (filters.organization_name && filters.organization_name.trim()) {
    const searchOrg = filters.organization_name.toLowerCase().trim();
    filtered = filtered.filter(record => {
      const orgName = (record.organization || "").toLowerCase();
      const orgParent = (record.org_parent || "").toLowerCase();
      return orgName.includes(searchOrg) || orgParent.includes(searchOrg);
    });
  }

  // Filter by county (org_county field - where the organization is LOCATED)
  if (filters.county && filters.county.trim()) {
    const searchCounty = filters.county.toLowerCase().trim();
    filtered = filtered.filter(record => {
      const orgCounty = (record.org_county || "").toLowerCase();
      return orgCounty.includes(searchCounty);
    });
  }

  // Filter by city (org_city field - where the organization is LOCATED)
  if (filters.city && filters.city.trim()) {
    const searchCity = filters.city.toLowerCase().trim();
    filtered = filtered.filter(record => {
      const orgCity = (record.org_city || "").toLowerCase();
      return orgCity.includes(searchCity);
    });
  }

  // Note: max_miles filter requires coordinates and will be applied in ZipCodePage
  // after distance calculation

  return filtered;
}

/**
 * Parse client_zip_codes field - handles both JSON string and array formats
 */
function parseClientZipCodes(clientZipCodes) {
  if (!clientZipCodes) return [];
  if (Array.isArray(clientZipCodes)) return clientZipCodes;
  if (typeof clientZipCodes === "string") {
    try {
      const parsed = JSON.parse(clientZipCodes);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Parse hours JSON safely
 */
function parseHoursJson(hours) {
  if (!hours) return null;
  if (typeof hours === "object") return hours;
  try {
    return JSON.parse(hours);
  } catch {
    return null;
  }
}

/**
 * Collect every day-of-week mention anywhere in a record's hours data.
 * Returns deduped 2-letter codes. Used by the day filter to decide whether the
 * record has ANY day info (strict match required) or none at all (include).
 *
 * Hours JSON has three arrays: regular[].days, special[].pattern (free text
 * like "2nd Tu"), and labeled[].days. Plus hours_notes free text.
 */
function collectKnownDays(hours, hoursNotes) {
  const daysFromEntries = (entries) =>
    (entries || []).flatMap(e => (e.days || []).map(normalizeDay));
  const daysFromPatterns = (entries) =>
    (entries || []).flatMap(e => extractDaysFromText(e.pattern));

  const all = [
    ...daysFromEntries(hours?.regular),
    ...daysFromPatterns(hours?.special),
    ...daysFromEntries(hours?.labeled),
    ...extractDaysFromText(hoursNotes),
  ];

  // Strip any non-2-letter codes that snuck through normalizeDay's fallback
  return [...new Set(all)].filter(d => d.length === 2);
}

/**
 * Extract day-of-week mentions from free text (e.g. hours_notes).
 * Returns a deduped list of 2-letter codes that appear in the text.
 * Used so a record like "2nd & 4th We: Call for hours" is excluded from a
 * Saturday-only filter even though it has no structured hours.regular data.
 */
function extractDaysFromText(text) {
  if (!text || typeof text !== "string") return [];
  const lower = text.toLowerCase();
  const patterns = [
    { code: "mo", regex: /\b(mondays?|mon|mo)\b/ },
    { code: "tu", regex: /\b(tuesdays?|tues|tue|tu)\b/ },
    { code: "we", regex: /\b(wednesdays?|wed|we)\b/ },
    { code: "th", regex: /\b(thursdays?|thurs|thu|th)\b/ },
    { code: "fr", regex: /\b(fridays?|fri|fr)\b/ },
    { code: "sa", regex: /\b(saturdays?|sat|sa)\b/ },
    { code: "su", regex: /\b(sundays?|sun|su)\b/ },
  ];
  const found = [];
  for (const { code, regex } of patterns) {
    if (regex.test(lower)) found.push(code);
  }
  return found;
}

/**
 * Normalize day abbreviation to 2-letter format
 */
function normalizeDay(day) {
  if (!day) return "";
  const normalized = day.toLowerCase().trim();
  const dayMap = {
    'monday': 'mo', 'mon': 'mo', 'mo': 'mo',
    'tuesday': 'tu', 'tue': 'tu', 'tu': 'tu',
    'wednesday': 'we', 'wed': 'we', 'we': 'we',
    'thursday': 'th', 'thu': 'th', 'th': 'th',
    'friday': 'fr', 'fri': 'fr', 'fr': 'fr',
    'saturday': 'sa', 'sat': 'sa', 'sa': 'sa',
    'sunday': 'su', 'sun': 'su', 'su': 'su',
  };
  return dayMap[normalized] || normalized;
}

/**
 * Check if time slot matches time filter
 */
function matchesTimeFilter(slot, timeFilter) {
  if (!slot.open || !slot.close) return false;

  const openMinutes = timeToMinutes(slot.open);
  const closeMinutes = timeToMinutes(slot.close);

  switch (timeFilter.type) {
    case "morning":
      // Open before noon
      return openMinutes < 720; // 12:00 = 720 minutes
    case "afternoon":
      // Open during 12:00-17:00
      return openMinutes < 1020 && closeMinutes > 720;
    case "evening":
      // Open after 5pm
      return closeMinutes > 1020; // 17:00 = 1020 minutes
    case "before":
      if (!timeFilter.time) return true;
      const beforeMinutes = timeToMinutes(timeFilter.time);
      return openMinutes < beforeMinutes;
    case "after":
      if (!timeFilter.time) return true;
      const afterMinutes = timeToMinutes(timeFilter.time);
      return closeMinutes > afterMinutes;
    case "between":
      if (!timeFilter.start || !timeFilter.end) return true;
      const startMinutes = timeToMinutes(timeFilter.start);
      const endMinutes = timeToMinutes(timeFilter.end);
      return openMinutes <= endMinutes && closeMinutes >= startMinutes;
    default:
      return true;
  }
}

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}
