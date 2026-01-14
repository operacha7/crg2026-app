// src/utils/formatters.js
// Shared formatting utilities for displaying resource data
// Used by: ResultRow (screen display), EmailDialog (email/PDF output)

// ============ HOURS FORMATTING UTILITIES ============

// Day order for determining consecutiveness
const DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Map 2-letter codes to 3-letter display codes
const DAY_DISPLAY_MAP = {
  'Mo': 'Mon',
  'Tu': 'Tue',
  'We': 'Wed',
  'Th': 'Thu',
  'Fr': 'Fri',
  'Sa': 'Sat',
  'Su': 'Sun'
};

/**
 * Convert 24h time to 12h format with a.m./p.m.
 * "09:00" -> "9:00 a.m."
 * "14:00" -> "2:00 p.m."
 */
function formatTime(time24) {
  if (!time24) return null;

  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'p.m.' : 'a.m.';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format days array into display string
 * - 4+ consecutive days: "Mon - Fri"
 * - Less than 4 consecutive or non-consecutive: "Thu, Fri, Sat"
 */
function formatDays(days) {
  if (!days || days.length === 0) return '';

  // Get indices in week order
  const indices = days
    .map(d => DAY_ORDER.indexOf(d))
    .filter(i => i !== -1)
    .sort((a, b) => a - b);

  if (indices.length === 0) return '';
  if (indices.length === 1) return DAY_DISPLAY_MAP[days[0]] || days[0];

  // Check if all consecutive
  let isConsecutive = true;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) {
      isConsecutive = false;
      break;
    }
  }

  // 4+ consecutive days: use range format "Mon - Fri"
  if (isConsecutive && indices.length >= 4) {
    const firstDay = DAY_DISPLAY_MAP[DAY_ORDER[indices[0]]] || DAY_ORDER[indices[0]];
    const lastDay = DAY_DISPLAY_MAP[DAY_ORDER[indices[indices.length - 1]]] || DAY_ORDER[indices[indices.length - 1]];
    return `${firstDay} - ${lastDay}`;
  }

  // Less than 4 consecutive or non-consecutive: list them "Thu, Fri, Sat"
  return indices.map(i => DAY_DISPLAY_MAP[DAY_ORDER[i]] || DAY_ORDER[i]).join(', ');
}

/**
 * Format a time range for display
 */
function formatTimeRange(open, close) {
  const openFormatted = formatTime(open);
  const closeFormatted = formatTime(close);

  if (openFormatted && closeFormatted) {
    return `${openFormatted} to ${closeFormatted}`;
  } else if (openFormatted) {
    return openFormatted; // Open time only (no close)
  }
  return null;
}

/**
 * Parse JSON hours and format for display
 * Returns structured data: { rows: [{days, hours}], special: [{days, hours}], labeled: [{label, days, hours}], legacy }
 *
 * @param {string|object} hoursJson - The org_hours field from database
 * @returns {object|null} Formatted hours data or null if no hours
 */
export function formatHoursFromJson(hoursJson) {
  if (!hoursJson) return null;

  let hoursData;
  try {
    hoursData = typeof hoursJson === "string" ? JSON.parse(hoursJson) : hoursJson;
    // Handle double-encoded JSON (safety net)
    if (typeof hoursData === "string") {
      hoursData = JSON.parse(hoursData);
    }
  } catch {
    // If not valid JSON, return as-is (legacy format)
    return { legacy: hoursJson, rows: [], special: [], labeled: [] };
  }

  const rows = [];
  const special = [];
  const labeled = [];

  // Format regular hours
  if (hoursData.regular && Array.isArray(hoursData.regular)) {
    hoursData.regular.forEach((entry) => {
      const days = formatDays(entry.days);
      const hours = formatTimeRange(entry.open, entry.close);

      if (days) {
        rows.push({
          days: `${days}:`,
          hours: hours || 'Call for hours',
        });
      }
    });
  }

  // Format special hours (1st Saturday, 3rd Monday, etc.)
  if (hoursData.special && Array.isArray(hoursData.special)) {
    hoursData.special.forEach((entry) => {
      const pattern = entry.pattern || '';
      const hours = formatTimeRange(entry.open, entry.close);

      if (pattern) {
        special.push({
          days: `${pattern}:`,
          hours: hours || 'Call for hours',
        });
      }
    });
  }

  // Format labeled hours (Office, Shelter, etc.)
  if (hoursData.labeled && Array.isArray(hoursData.labeled)) {
    hoursData.labeled.forEach((entry) => {
      const label = entry.label || '';
      const days = entry.days ? formatDays(entry.days) : '';
      const hours = formatTimeRange(entry.open, entry.close);

      if (label) {
        labeled.push({
          label: label,
          days: days ? `${days}:` : '',
          hours: hours || 'Call for hours',
        });
      }
    });
  }

  return {
    rows,
    special,
    labeled,
    legacy: rows.length === 0 && special.length === 0 && labeled.length === 0
      ? (typeof hoursJson === "string" ? hoursJson : null)
      : null,
  };
}

// ============ ADDRESS FORMATTING ============

/**
 * Format address from individual database fields into display lines
 *
 * @param {object} record - Database record with org_address1, org_address2, org_city, org_state, org_zip_code
 * @returns {string[]} Array of address lines for display
 */
export function formatAddress(record) {
  const lines = [];
  if (record.org_address1) lines.push(record.org_address1);
  if (record.org_address2) lines.push(record.org_address2);
  if (record.org_city || record.org_state || record.org_zip_code) {
    const cityStateZip = [
      record.org_city,
      record.org_state,
      record.org_zip_code,
    ].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " $1"); // Format as "City, State Zip"
    lines.push(cityStateZip);
  }
  return lines;
}

/**
 * Format address as a single string (for email/PDF)
 *
 * @param {object} record - Database record
 * @returns {string} Full address as single string with line breaks
 */
export function formatAddressString(record) {
  return formatAddress(record).join('\n');
}

/**
 * Format address as HTML (for email/PDF)
 *
 * @param {object} record - Database record
 * @returns {string} Full address as HTML with <br/> tags
 */
export function formatAddressHtml(record) {
  return formatAddress(record).join('<br/>');
}

// ============ DISTANCE FORMATTING ============

/**
 * Format distance for display
 *
 * @param {number|null} distance - Distance in miles
 * @returns {string} Formatted distance string (e.g., "3.7 miles") or empty string
 */
export function formatDistance(distance) {
  if (distance === null || distance === undefined) return "";
  return `${distance.toFixed(1)} miles`;
}

// ============ REQUIREMENTS FORMATTING ============

/**
 * Parse requirements text into array of items
 *
 * @param {string} requirements - Raw requirements text (newline or comma separated)
 * @returns {string[]} Array of requirement items
 */
export function parseRequirements(requirements) {
  if (!requirements) return [];
  return requirements.split(/[\n]/).map(r => r.trim()).filter(Boolean);
}

// ============ ICON NAME FORMATTING ============

/**
 * Format icon name for tooltip display
 * "DomesticAbuseOtherIcon" → "Domestic Abuse Other"
 *
 * @param {string} iconName - Icon component name
 * @returns {string} Human-readable name
 */
export function formatIconName(iconName) {
  if (!iconName) return "";
  return iconName
    .replace(/Icon$/, "")           // Remove "Icon" suffix
    .replace(/([A-Z])/g, " $1")     // Add space before capitals
    .trim();                         // Remove leading space
}
