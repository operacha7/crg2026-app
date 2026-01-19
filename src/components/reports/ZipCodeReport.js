// src/components/reports/ZipCodeReport.js
// Zip Code Searches report

import { useMemo } from "react";
import ChartReport from "./ChartReport";

export default function ZipCodeReport({ selectedOrg, viewMode }) {
  // Memoize fetch params to prevent unnecessary re-renders
  const fetchParams = useMemo(() => ({
    action_type: "search",
    search_mode: "Zip Code",
  }), []);

  return (
    <ChartReport
      selectedOrg={selectedOrg}
      viewMode={viewMode}
      fetchParams={fetchParams}
    />
  );
}
