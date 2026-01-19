// src/components/reports/EmailsReport.js
// Emails Sent report

import { useMemo } from "react";
import ChartReport from "./ChartReport";

export default function EmailsReport({ selectedOrg, viewMode }) {
  // Memoize fetch params to prevent unnecessary re-renders
  const fetchParams = useMemo(() => ({
    action_type: "email",
  }), []);

  return (
    <ChartReport
      selectedOrg={selectedOrg}
      viewMode={viewMode}
      fetchParams={fetchParams}
    />
  );
}
