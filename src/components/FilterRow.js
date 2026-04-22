// src/components/FilterRow.js
// Inline filter row below ResultsHeader
// Organization (text), Hours (day dropdown), Requirements (text)
// Uses same GRID_COLUMNS as ResultsHeader for alignment

import { GRID_COLUMNS } from "../layout/ResultsHeader";

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

// Status filter options — default hides Inactive and Closed
const STATUS_OPTIONS = [
  { label: "Active + Limited", value: "active-limited" },
  { label: "All", value: "all" },
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
        right: "4px",
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

      {/* Zip column - empty */}
      <div />
    </div>
  );
}
