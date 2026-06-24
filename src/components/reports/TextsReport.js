// src/components/reports/TextsReport.js
// Texts Sent report

import { useMemo } from "react";
import ChartReport from "./ChartReport";

export default function TextsReport({ selectedOrg, viewMode }) {
  // Memoize fetch params to prevent unnecessary re-renders
  const fetchParams = useMemo(() => ({
    action_type: "sms",
  }), []);

  return (
    <ChartReport
      selectedOrg={selectedOrg}
      viewMode={viewMode}
      fetchParams={fetchParams}
    />
  );
}
