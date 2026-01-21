// src/layout/ResultsHeader.js
// Column headers for the results table
// Red bar with column labels that stays fixed while results scroll
// Grid columns must match ResultRow component

// Shared grid column definition - must match ResultRow.js
// Using percentages for responsive scaling (like legacy SearchResults.js)
// Select(4%) + Miles(3%) + Org(20%) + Assistance(8%) + Hours(17%) + Status(6%) + Phone(6%) + Requirements(33%) + Zip(3%)
// Note: Address column removed (combined with Organization), old Address 12% redistributed: 8% to Assistance, 4% to Requirements
// Gaps: 20px before Org, 30px before Hours, 40px before Status, 20px before Phone (applied as paddingLeft)
const GRID_COLUMNS = "4% 3% 25% 6% 17% 6% 6.5% 29% 3%";

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

export default function ResultsHeader() {
  return (
    // Hide header on mobile - cards are self-explanatory
    <div
      className="hidden md:flex bg-results-header-bg text-results-header-text font-opensans items-center"
      style={{
        height: "var(--height-results-header)",
        fontSize: "var(--font-size-results-header)",
        fontWeight: "var(--font-weight-results-header)",
        letterSpacing: "var(--letter-spacing-results-header)",
      }}
    >
      {/* Grid container for column headers */}
      <div
        className="w-full grid"
        style={{
          gridTemplateColumns: GRID_COLUMNS,
          paddingLeft: "10px",
        }}
      >
        {columns.map((col) => (
          <div
            key={col.id}
            className="text-center"
            style={col.gapBefore ? { paddingLeft: `${col.gapBefore}px` } : undefined}
          >
            {col.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export { GRID_COLUMNS };
