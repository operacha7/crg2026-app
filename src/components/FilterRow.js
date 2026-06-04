// src/components/FilterRow.js
// Inline filter row below ResultsHeader
// Organization (text), Hours (day dropdown), Requirements (text)
// Uses same GRID_COLUMNS as ResultsHeader for alignment

import { useEffect } from "react";
import { GRID_COLUMNS } from "../layout/ResultsHeader";
import { useAppData } from "../Contexts/AppDataContext";
import { logUsage } from "../services/usageService";

// Debounce window for text-input filters. Long enough that mid-typing
// keystrokes don't log ("c" → "ca" → "cat" gets one log line for "cat"),
// short enough that a real filter intent gets recorded promptly.
const TEXT_FILTER_DEBOUNCE_MS = 1500;

// Map dropdown display names to 2-letter day codes used in org_hours JSON
const DAY_OPTIONS = [
  { label: "Any Day", value: "" },
  { label: "Monday", value: "Mo" },
  { label: "Tuesday", value: "Tu" },
  { label: "Wednesday", value: "We" },
  { label: "Thursday", value: "Th" },
  { label: "Friday", value: "Fr" },
  { label: "Saturday", value: "Sa" },
  { label: "Sunday", value: "Su" },
];

// Status filter options — default is "All" so users see every record
// (Active + Limited + Inactive + Closed). Showing everything by default
// makes "missing" truly mean "not in CRG"; users can narrow from there.
const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Active + Limited", value: "active-limited" },
  { label: "Active only", value: "active" },
  { label: "Limited only", value: "limited" },
  { label: "Inactive only", value: "inactive" },
  { label: "Closed only", value: "closed" },
];

// Shared input style
const inputStyle = {
  backgroundColor: "var(--color-filter-input-bg)",
  color: "var(--color-filter-input-text)",
  height: "var(--height-filter-input)",
  fontSize: "var(--font-size-filter-input)",
  padding: "0 24px 0 8px",
  borderRadius: "4px",
  border: "none",
  outline: "none",
  width: "100%",
};

// Clear X button inside inputs
function ClearButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "absolute",
        // Wrapper has paddingRight 8px, so the X needs to sit at least that
        // far in to fall inside the input rather than in the gutter beside it.
        right: "9px",
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        color: "var(--color-filter-reset-text)",
        fontSize: "14px",
        cursor: "pointer",
        lineHeight: 1,
        padding: "2px",
      }}
      title="Clear"
    >
      ✕
    </button>
  );
}

export default function FilterRow({
  filterOrganization,
  filterDay,
  filterStatus,
  filterRequirements,
  onFilterOrganizationChange,
  onFilterDayChange,
  onFilterStatusChange,
  onFilterRequirementsChange,
  onClearFilter,
}) {
  // Filter usage is logged so Reports can show whether the column-header
  // filters are actually getting used. Server-side /log-usage stamps the
  // org from the session cookie when present, so reg_organization here is
  // the guest-fallback path; logged-in callers' value gets overridden.
  const { loggedInUser } = useAppData();
  const regOrgName = loggedInUser?.reg_organization || "Guest";

  // Status dropdown — log immediately on change. Skip the "all" default so
  // we only record the user actively narrowing.
  useEffect(() => {
    if (filterStatus && filterStatus !== "all") {
      logUsage({
        reg_organization: regOrgName,
        action_type: "filter",
        search_mode: "status",
        search_value: filterStatus,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  // Hours day dropdown — log immediately on change. Skip the "" (Any Day)
  // default; same reasoning as status.
  useEffect(() => {
    if (filterDay) {
      logUsage({
        reg_organization: regOrgName,
        action_type: "filter",
        search_mode: "hours",
        search_value: filterDay,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDay]);

  // Organization text input — debounce so we log the settled filter event
  // rather than every keystroke. Effect cleanup cancels the pending log if
  // the user types again within the debounce window.
  // search_value is intentionally NOT logged here: the typed string is
  // redundant with the known org list and the debounce can still emit
  // mid-typing fragments, so it adds noise without analytic value. The
  // event itself is still logged (counts under Header Filter in Reports).
  // (Status/Hours come from dropdowns and Requirements is a genuine demand
  // signal, so those three keep their search_value.)
  useEffect(() => {
    const trimmed = filterOrganization.trim();
    if (!trimmed) return undefined;
    const timer = setTimeout(() => {
      logUsage({
        reg_organization: regOrgName,
        action_type: "filter",
        search_mode: "organization",
      });
    }, TEXT_FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOrganization]);

  // Requirements text input — same pattern as Organization.
  useEffect(() => {
    const trimmed = filterRequirements.trim();
    if (!trimmed) return undefined;
    const timer = setTimeout(() => {
      logUsage({
        reg_organization: regOrgName,
        action_type: "filter",
        search_mode: "requirements",
        search_value: trimmed,
      });
    }, TEXT_FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRequirements]);

  return (
    <div
      className="hidden lg:grid items-center font-opensans"
      style={{
        gridTemplateColumns: GRID_COLUMNS,
        paddingLeft: "10px",
        backgroundColor: "var(--color-filter-row-bg)",
        height: "var(--height-filter-row)",
        borderBottom: "1px solid var(--color-results-row-border)",
        flexShrink: 0,
      }}
    >
      {/* Select column - empty */}
      <div />

      {/* Miles column - empty */}
      <div />

      {/* Organization filter */}
      <div style={{ paddingLeft: "20px", paddingRight: "8px", position: "relative" }}>
        <input
          type="text"
          value={filterOrganization}
          onChange={(e) => onFilterOrganizationChange(e.target.value)}
          placeholder="Filter organizations..."
          style={inputStyle}
        />
        {filterOrganization && (
          <ClearButton onClick={() => onClearFilter("filterOrganization")} />
        )}
      </div>

      {/* Assistance column - empty */}
      <div />

      {/* Hours day filter */}
      <div style={{ paddingLeft: "30px", paddingRight: "8px" }}>
        <select
          value={filterDay}
          onChange={(e) => onFilterDayChange(e.target.value)}
          style={{
            ...inputStyle,
            padding: "0 4px",
            cursor: "pointer",
            appearance: "auto",
          }}
        >
          {DAY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status filter */}
      <div style={{ paddingLeft: "40px", paddingRight: "8px" }}>
        <select
          value={filterStatus}
          onChange={(e) => onFilterStatusChange(e.target.value)}
          style={{
            ...inputStyle,
            padding: "0 4px",
            cursor: "pointer",
            appearance: "auto",
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Telephone column - empty */}
      <div />

      {/* Requirements filter */}
      <div style={{ paddingLeft: "20px", paddingRight: "8px", position: "relative" }}>
        <input
          type="text"
          value={filterRequirements}
          onChange={(e) => onFilterRequirementsChange(e.target.value)}
          placeholder="Filter requirements..."
          style={inputStyle}
        />
        {filterRequirements && (
          <ClearButton onClick={() => onClearFilter("filterRequirements")} />
        )}
      </div>

    </div>
  );
}
