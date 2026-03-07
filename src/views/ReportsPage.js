// src/views/ReportsPage.js
// Main Reports page container
// Shows NavBar1Reports, NavBar2Reports, NavBar3Reports, and selected report content

import { useState, useCallback, useMemo, useEffect } from "react";
import NavBar1Reports from "../layout/NavBar1Reports";
import NavBar2Reports from "../layout/NavBar2Reports";
import NavBar3Reports from "../layout/NavBar3Reports";
import Footer from "../layout/Footer";
import VerticalNavBar from "../layout/VerticalNavBar";
import ZipCodeReport from "../components/reports/ZipCodeReport";
import EmailsReport from "../components/reports/EmailsReport";
import PdfsReport from "../components/reports/PdfsReport";
import UsageDataTables from "../components/reports/UsageDataTables";
import CoverageReport from "../components/reports/CoverageReport";
import MapboxMap from "../components/reports/MapboxMap";

export default function ReportsPage() {
  // State for report selection
  const [selectedReport, setSelectedReport] = useState("zip-code");

  // State for organization filter (used by chart reports)
  const [selectedOrg, setSelectedOrg] = useState("All Registered Organizations");

  // State for daily/monthly toggle
  const [viewMode, setViewMode] = useState("daily");

  // Coverage Report filter state
  const [coverageCounty, setCoverageCounty] = useState("All Counties");
  const [coverageZipCode, setCoverageZipCode] = useState("");
  const [coverageParentOrg, setCoverageParentOrg] = useState("");
  const [coverageChildOrg, setCoverageChildOrg] = useState("");
  const [coverageAssistanceType, setCoverageAssistanceType] = useState("");
  const [coverageStatus, setCoverageStatus] = useState("Active");

  // Coverage Report summary (passed from CoverageReport to NavBar3)
  const [coverageSummary, setCoverageSummary] = useState(null);
  const handleSummaryChange = useCallback((summary) => {
    setCoverageSummary(summary);
  }, []);

  // Coverage display data (passed from CoverageReport for download)
  const [coverageDisplayData, setCoverageDisplayData] = useState([]);
  const handleDisplayDataChange = useCallback((data) => {
    setCoverageDisplayData(data);
  }, []);

  // Coverage display filters (NavBar3 clickable stats)
  const [coverageDisplayFilter, setCoverageDisplayFilter] = useState("all");
  const [coverageRestrictionFilter, setCoverageRestrictionFilter] = useState("all");

  // Reset all coverage filters
  const handleCoverageReset = useCallback(() => {
    setCoverageCounty("All Counties");
    setCoverageZipCode("");
    setCoverageParentOrg("");
    setCoverageChildOrg("");
    setCoverageAssistanceType("");
    setCoverageStatus("Active");
    setCoverageDisplayFilter("all");
    setCoverageRestrictionFilter("all");
  }, []);

  // Coverage filters object for download header
  const coverageFilters = useMemo(() => ({
    county: coverageCounty,
    zipCode: coverageZipCode,
    parentOrg: coverageParentOrg,
    childOrg: coverageChildOrg,
    assistanceType: coverageAssistanceType,
    status: coverageStatus,
  }), [coverageCounty, coverageZipCode, coverageParentOrg, coverageChildOrg, coverageAssistanceType, coverageStatus]);

  // Zip Code Map (Mapbox) filter state
  const [map2County, setMap2County] = useState("All Counties");
  const [map2ZipCode, setMap2ZipCode] = useState("");
  const [map2ParentOrg, setMap2ParentOrg] = useState("");
  const [map2Organization, setMap2Organization] = useState("");
  const [map2AssistanceType, setMap2AssistanceType] = useState("");

  const handleMap2Reset = useCallback(() => {
    setMap2County("All Counties");
    setMap2ZipCode("");
    setMap2ParentOrg("");
    setMap2Organization("");
    setMap2AssistanceType("");
  }, []);

  // Reset Map 2 filters when navigating away
  useEffect(() => {
    if (selectedReport !== "map2") {
      handleMap2Reset();
    }
  }, [selectedReport, handleMap2Reset]);

  // Render the selected report
  const renderReport = () => {
    const commonProps = {
      selectedOrg,
      viewMode,
    };

    switch (selectedReport) {
      case "coverage":
        return (
          <CoverageReport
            county={coverageCounty}
            zipCode={coverageZipCode}
            parentOrg={coverageParentOrg}
            childOrg={coverageChildOrg}
            assistanceType={coverageAssistanceType}
            status={coverageStatus}
            displayFilter={coverageDisplayFilter}
            restrictionFilter={coverageRestrictionFilter}
            onSummaryChange={handleSummaryChange}
            onDisplayDataChange={handleDisplayDataChange}
          />
        );
      case "zip-code":
        return <ZipCodeReport {...commonProps} />;
      case "emails-sent":
        return <EmailsReport {...commonProps} />;
      case "pdfs-created":
        return <PdfsReport {...commonProps} />;
      case "usage-tables":
        return <UsageDataTables {...commonProps} />;
      case "map2":
        return (
          <MapboxMap
            county={map2County}
            zipCode={map2ZipCode}
            parentOrg={map2ParentOrg}
            organization={map2Organization}
            assistanceType={map2AssistanceType}
          />
        );
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
          selectedReport={selectedReport}
          selectedOrg={selectedOrg}
          onOrgChange={setSelectedOrg}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          coverageCounty={coverageCounty}
          onCoverageCountyChange={setCoverageCounty}
          coverageZipCode={coverageZipCode}
          onCoverageZipCodeChange={setCoverageZipCode}
          coverageParentOrg={coverageParentOrg}
          onCoverageParentOrgChange={setCoverageParentOrg}
          coverageChildOrg={coverageChildOrg}
          onCoverageChildOrgChange={setCoverageChildOrg}
          coverageAssistanceType={coverageAssistanceType}
          onCoverageAssistanceTypeChange={setCoverageAssistanceType}
          coverageStatus={coverageStatus}
          onCoverageStatusChange={setCoverageStatus}
          onCoverageReset={handleCoverageReset}
          map2County={map2County}
          onMap2CountyChange={setMap2County}
          map2ZipCode={map2ZipCode}
          onMap2ZipCodeChange={setMap2ZipCode}
          map2ParentOrg={map2ParentOrg}
          onMap2ParentOrgChange={setMap2ParentOrg}
          map2Organization={map2Organization}
          onMap2OrganizationChange={setMap2Organization}
          map2AssistanceType={map2AssistanceType}
          onMap2AssistanceTypeChange={setMap2AssistanceType}
          onMap2Reset={handleMap2Reset}
        />
        {selectedReport !== "map2" && <NavBar3Reports
          selectedReport={selectedReport}
          coverageSummary={coverageSummary}
          coverageDisplayFilter={coverageDisplayFilter}
          onCoverageDisplayFilterChange={setCoverageDisplayFilter}
          coverageRestrictionFilter={coverageRestrictionFilter}
          onCoverageRestrictionFilterChange={setCoverageRestrictionFilter}
          coverageDisplayData={coverageDisplayData}
          coverageFilters={coverageFilters}
        />}

        {/* Report content - UsageDataTables handles its own scroll for sticky header */}
        <main className={`flex-1 bg-gray-50 ${selectedReport === "usage-tables" || selectedReport === "map" || selectedReport === "map2" ? "overflow-hidden" : "overflow-auto"}`}>
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
