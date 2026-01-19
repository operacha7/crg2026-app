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
      // Always include orgs that serve all areas (99999)
      if (clientZips.includes("99999")) return true;
      return filters.zip_codes.some(zip => clientZips.includes(zip));
    });
  }

  // Filter by status
  if (filters.status_ids && filters.status_ids.length > 0) {
    filtered = filtered.filter(record =>
      filters.status_ids.includes(record.status_id)
    );
  }

  // Filter by day of week (check org_hours JSON)
  // Note: Records with null hours are INCLUDED (hours unknown, might be available)
  if (filters.days && filters.days.length > 0) {
    filtered = filtered.filter(record => {
      const hours = parseHoursJson(record.hours || record.org_hours);
      // Include records with unknown hours - they might be open
      if (!hours || !hours.regular) return true;

      return filters.days.some(day => {
        return hours.regular.some(slot => {
          // Handle both single day and day ranges
          const days = slot.days || [];
          return days.some(d => normalizeDay(d) === normalizeDay(day));
        });
      });
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
