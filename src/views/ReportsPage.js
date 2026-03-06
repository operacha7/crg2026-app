// src/views/ReportsPage.js
// Main Reports page container
// Shows NavBar1Reports, NavBar2Reports, NavBar3Reports, and selected report content

import { useState, useCallback, useMemo } from "react";
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
import ZipCodeMap from "../components/reports/ZipCodeMap";

export default function ReportsPage() {
  // State for report selection
  const [selectedReport, setSelectedReport] = useState("zip-code");

  // State for organization filter (used by chart reports)
  const [selectedOrg, setSelectedOrg] = useState("All Registered Organizations");

  // State for daily/monthly toggle
  const [viewMode, setViewMode] = useState("daily");

  // Coverage Report filter state
  const [coverageCounty, setCoverageCounty] = useState("All Counties");
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
    parentOrg: coverageParentOrg,
    childOrg: coverageChildOrg,
    assistanceType: coverageAssistanceType,
    status: coverageStatus,
  }), [coverageCounty, coverageParentOrg, coverageChildOrg, coverageAssistanceType, coverageStatus]);

  // Map Report filter state
  const [mapPovertyLevel, setMapPovertyLevel] = useState("");
  const [mapZipCode, setMapZipCode] = useState("");
  const [mapAssistanceType, setMapAssistanceType] = useState("");

  const handleMapReset = useCallback(() => {
    setMapPovertyLevel("");
    setMapZipCode("");
    setMapAssistanceType("");
  }, []);

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
      case "map":
        return (
          <ZipCodeMap
            povertyLevel={mapPovertyLevel}
            zipCode={mapZipCode}
            assistanceType={mapAssistanceType}
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
          coverageParentOrg={coverageParentOrg}
          onCoverageParentOrgChange={setCoverageParentOrg}
          coverageChildOrg={coverageChildOrg}
          onCoverageChildOrgChange={setCoverageChildOrg}
          coverageAssistanceType={coverageAssistanceType}
          onCoverageAssistanceTypeChange={setCoverageAssistanceType}
          coverageStatus={coverageStatus}
          onCoverageStatusChange={setCoverageStatus}
          onCoverageReset={handleCoverageReset}
          mapPovertyLevel={mapPovertyLevel}
          onMapPovertyLevelChange={setMapPovertyLevel}
          mapZipCode={mapZipCode}
          onMapZipCodeChange={setMapZipCode}
          mapAssistanceType={mapAssistanceType}
          onMapAssistanceTypeChange={setMapAssistanceType}
          onMapReset={handleMapReset}
        />
        {selectedReport !== "map" && <NavBar3Reports
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
        <main className={`flex-1 bg-gray-50 ${selectedReport === "usage-tables" || selectedReport === "map" ? "overflow-hidden" : "overflow-auto"}`}>
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
