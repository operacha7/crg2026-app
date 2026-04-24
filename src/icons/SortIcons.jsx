// Shared sort-column icons used by ResultsHeader, ZipCodeDataReport, and ColumnHeaderFilter.
// - SortBarsIcon: three horizontal bars, shown when a column is not the active sort.
// - SortArrowIcon: up/down triangle, shown when a column is the active sort.
// - SortIcon: convenience wrapper that picks between bars and arrow based on `active`.

import React from "react";

export function SortBarsIcon({ size = 14, color = "#FFFFFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="2" rx="1" fill={color} />
      <rect x="4" y="7" width="8" height="2" rx="1" fill={color} />
      <rect x="6" y="11" width="4" height="2" rx="1" fill={color} />
    </svg>
  );
}

export function SortArrowIcon({ direction = "asc", size = 14, color = "#FFFFFF" }) {
  if (direction === "asc") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M8 3L13 10H3L8 3Z" fill={color} />
        <rect x="7" y="9" width="2" height="4" rx="0.5" fill={color} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 13L3 6H13L8 13Z" fill={color} />
      <rect x="7" y="3" width="2" height="4" rx="0.5" fill={color} />
    </svg>
  );
}

export default function SortIcon({ active, direction = "asc", size = 14, color = "#FFFFFF" }) {
  return (
    <span style={{ marginLeft: "4px", display: "inline-flex", alignItems: "center" }}>
      {active
        ? <SortArrowIcon direction={direction} size={size} color={color} />
        : <SortBarsIcon size={size} color={color} />}
    </span>
  );
}
