// src/components/reports/ReportsReport.js
// Reports usage chart

import { useMemo } from "react";
import ChartReport from "./ChartReport";

export default function ReportsReport({ selectedOrg, viewMode }) {
  // Memoize fetch params to prevent unnecessary re-renders
  const fetchParams = useMemo(() => ({
    action_type: "reports",
  }), []);

  return (
    <ChartReport
      selectedOrg={selectedOrg}
      viewMode={viewMode}
      fetchParams={fetchParams}
    />
  );
}
