// src/components/reports/PdfsReport.js
// PDFs Created report

import { useMemo } from "react";
import ChartReport from "./ChartReport";

export default function PdfsReport({ selectedOrg, viewMode }) {
  // Memoize fetch params to prevent unnecessary re-renders
  const fetchParams = useMemo(() => ({
    action_type: "pdf",
  }), []);

  return (
    <ChartReport
      selectedOrg={selectedOrg}
      viewMode={viewMode}
      fetchParams={fetchParams}
    />
  );
}
