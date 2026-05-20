// src/components/reports/ZipCodeReport.js
// Search Chart report — all filtering activity, regardless of mode.
// Counts both NavBar2 mode selections (search) and FilterRow header
// filters (filter). search_mode is intentionally not constrained so all
// five sources roll up: Zip Code, Organization, Location, Ask a Question,
// and Header Filter. NavBar3 assistance chip clicks are included too,
// since they log action_type='search' with the active mode.
// (File name kept as ZipCodeReport.js for now; can be renamed later.)

import { useMemo } from "react";
import ChartReport from "./ChartReport";

export default function ZipCodeReport({ selectedOrg, viewMode }) {
  // Memoize fetch params to prevent unnecessary re-renders
  const fetchParams = useMemo(() => ({
    action_type: ["search", "filter"],
  }), []);

  return (
    <ChartReport
      selectedOrg={selectedOrg}
      viewMode={viewMode}
      fetchParams={fetchParams}
    />
  );
}
