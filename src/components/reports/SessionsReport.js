// src/components/reports/SessionsReport.js
// Sessions Chart — counts logins for registered orgs (one row per successful
// passcode submit, stamped server-side by functions/login.js) and guest
// sessions (one row per browser tab, stamped client-side by App.js with a
// sessionStorage dedupe). Administrator is excluded by the same downstream
// filter ChartReport applies to every chart.

import { useMemo } from "react";
import ChartReport from "./ChartReport";

export default function SessionsReport({ selectedOrg, viewMode }) {
  const fetchParams = useMemo(() => ({
    action_type: "login",
  }), []);

  return (
    <ChartReport
      selectedOrg={selectedOrg}
      viewMode={viewMode}
      fetchParams={fetchParams}
    />
  );
}
