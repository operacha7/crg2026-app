// src/layout/ResultsHeader.js
// Column headers for the results table
// Sort: three horizontal bars icon (inactive) → up/down arrow (active) next to Miles & Organization
// Filter: outline funnel (inactive) → solid funnel (active) next to Organization, Hours, Requirements
// Grid columns must match ResultRow component

import { FunnelIcon } from "../icons";

// Shared grid column definition - must match ResultRow.js
const GRID_COLUMNS = "4% 3% 25% 6% 17% 6% 6.5% 29% 3%";

// Columns with sort capability
const SORTABLE = new Set(["miles", "organization"]);
// Columns with filter capability (get a funnel icon)
const FILTERABLE = new Set(["organization", "hours", "status", "requirements"]);

const columns = [
  { id: "select", label: "Select" },
  { id: "miles", label: "Miles" },
  { id: "organization", label: "Organization", gapBefore: 20 },
  { id: "assistance", label: "Assistance" },
  { id: "hours", label: "Hours", gapBefore: 30 },
  { id: "status", label: "Status", gapBefore: 40 },
  { id: "telephone", label: "Telephone", gapBefore: 20 },
  { id: "requirements", label: "Requirements", gapBefore: 20 },
  { id: "zip", label: "Zip" },
];

// Three horizontal bars — classic sort icon (inactive state)
function SortBarsIcon({ size = 14, color = "#FFFFFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="2" rx="1" fill={color} />
      <rect x="4" y="7" width="8" height="2" rx="1" fill={color} />
      <rect x="6" y="11" width="4" height="2" rx="1" fill={color} />
    </svg>
  );
}

// Arrow icon — active sort direction
function SortArrowIcon({ direction = "asc", size = 14, color = "#FFFFFF" }) {
  if (direction === "asc") {
    // Up arrow
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M8 3L13 10H3L8 3Z" fill={color} />
        <rect x="7" y="9" width="2" height="4" rx="0.5" fill={color} />
      </svg>
    );
  }
  // Down arrow
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 13L3 6H13L8 13Z" fill={color} />
      <rect x="7" y="3" width="2" height="4" rx="0.5" fill={color} />
    </svg>
  );
}

// Sort icon — bars when inactive, arrow when active
function SortIcon({ active, direction }) {
  if (active) {
    return (
      <span style={{ marginLeft: "4px", display: "inline-flex", alignItems: "center" }}>
        <SortArrowIcon direction={direction} size={14} />
      </span>
    );
  }
  return (
    <span style={{ marginLeft: "4px", display: "inline-flex", alignItems: "center" }}>
      <SortBarsIcon size={14} />
    </span>
  );
}

export default function ResultsHeader({
  sortColumn = null,
  sortDirection = "asc",
  onSort,
  filterRowVisible = false,
  onToggleFilterRow,
  hasActiveFilters = false,
}) {
  const isFunnelActive = hasActiveFilters || filterRowVisible;

  return (
    <div
      className="hidden lg:flex bg-results-header-bg text-results-header-text font-opensans items-center"
      style={{
        height: "var(--height-results-header)",
        fontSize: "var(--font-size-results-header)",
        fontWeight: "var(--font-weight-results-header)",
        letterSpacing: "var(--letter-spacing-results-header)",
        flexShrink: 0,
      }}
    >
      {/* Grid container for column headers */}
      <div
        className="w-full grid items-center"
        style={{
          gridTemplateColumns: GRID_COLUMNS,
          paddingLeft: "10px",
        }}
      >
        {columns.map((col) => {
          const isSortable = SORTABLE.has(col.id);
          const isFilterable = FILTERABLE.has(col.id);
          const isActiveSort = sortColumn === col.id;

          return (
            <div
              key={col.id}
              className="text-center flex items-center justify-center"
              style={{
                ...(col.gapBefore ? { paddingLeft: `${col.gapBefore}px` } : {}),
                gap: "3px",
              }}
            >
              {/* Column label — clickable if sortable */}
              {isSortable ? (
                <span
                  className="cursor-pointer hover:brightness-125 select-none flex items-center"
                  onClick={() => onSort?.(col.id)}
                  title={`Sort by ${col.label}`}
                >
                  {col.label}
                  <SortIcon active={isActiveSort} direction={sortDirection} />
                </span>
              ) : (
                <span>{col.label}</span>
              )}

              {/* Funnel icon for filterable columns — outline when inactive, solid when active */}
              {isFilterable && (
                <button
                  onClick={onToggleFilterRow}
                  className="hover:brightness-125 transition-all duration-200"
                  title={filterRowVisible ? "Hide filters" : "Show filters"}
                  style={{
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    padding: "0",
                    marginLeft: "3px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <FunnelIcon size={12} color="#FFFFFF" filled={isFunnelActive} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { GRID_COLUMNS };
