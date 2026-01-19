// src/views/ReportsPage.js
// Main Reports page container
// Shows NavBar1Reports, NavBar2Reports, NavBar3Reports, and selected report content

import { useState } from "react";
import NavBar1Reports from "../layout/NavBar1Reports";
import NavBar2Reports from "../layout/NavBar2Reports";
import NavBar3Reports from "../layout/NavBar3Reports";
import Footer from "../layout/Footer";
import VerticalNavBar from "../layout/VerticalNavBar";
import ZipCodeReport from "../components/reports/ZipCodeReport";
import EmailsReport from "../components/reports/EmailsReport";
import PdfsReport from "../components/reports/PdfsReport";
import UsageDataTables from "../components/reports/UsageDataTables";

export default function ReportsPage() {
  // State for report selection
  const [selectedReport, setSelectedReport] = useState("zip-code");

  // State for organization filter
  const [selectedOrg, setSelectedOrg] = useState("All Organizations");

  // State for daily/monthly toggle
  const [viewMode, setViewMode] = useState("daily");

  // Render the selected report
  const renderReport = () => {
    const commonProps = {
      selectedOrg,
      viewMode,
    };

    switch (selectedReport) {
      case "zip-code":
        return <ZipCodeReport {...commonProps} />;
      case "emails-sent":
        return <EmailsReport {...commonProps} />;
      case "pdfs-created":
        return <PdfsReport {...commonProps} />;
      case "usage-tables":
        return <UsageDataTables {...commonProps} />;
      default:
        return <ZipCodeReport {...commonProps} />;
    }
  };

  return (
    <div className="h-screen flex flex-row overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navigation bars */}
        <NavBar1Reports
          selectedReport={selectedReport}
          onReportChange={setSelectedReport}
        />
        <NavBar2Reports
          selectedOrg={selectedOrg}
          onOrgChange={setSelectedOrg}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        <NavBar3Reports />

        {/* Report content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          {renderReport()}
        </main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Vertical nav bar */}
      <VerticalNavBar />
    </div>
  );
}
