// src/views/ReportsPage.js
// Main Reports page container
// Shows NavBar1Reports, NavBar2Reports, NavBar3Reports, and selected report content

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import NavBar1Reports from "../layout/NavBar1Reports";
import NavBar2Reports from "../layout/NavBar2Reports";
import NavBar3Reports from "../layout/NavBar3Reports";
import Footer from "../layout/Footer";
import VerticalNavBar from "../layout/VerticalNavBar";
import ZipCodeReport from "../components/reports/ZipCodeReport";
import EmailsReport from "../components/reports/EmailsReport";
import PdfsReport from "../components/reports/PdfsReport";
import ReportsReport from "../components/reports/ReportsReport";
import UsageDataTables from "../components/reports/UsageDataTables";
import CoverageReport from "../components/reports/CoverageReport";
import MapboxMap from "../components/reports/MapboxMap";
import ZipCodeDataReport from "../components/reports/ZipCodeDataReport";

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
  const [map2ViewMode, setMap2ViewMode] = useState("distress");
  const [map2ActiveBase, setMap2ActiveBase] = useState("distress");

  // When user selects a base, update both viewMode and activeBase
  // When user selects Filter View, only viewMode changes (activeBase preserved)
  const handleMap2ViewModeChange = useCallback((newMode) => {
    setMap2ViewMode(newMode);
    if (newMode !== "filter_view") {
      setMap2ActiveBase(newMode);
    }
  }, []);

  // Wrapped filter setters: auto-switch to filter_view when user applies a filter from a base view
  // Only triggers on non-empty values (so auto-clear logic in NavBar2Reports won't cause a switch)
  const handleMap2CountyChange = useCallback((v) => {
    setMap2County(v);
    if (v && v !== "All Counties") setMap2ViewMode("filter_view");
  }, []);
  const handleMap2ZipCodeChange = useCallback((v) => {
    setMap2ZipCode(v);
    if (v) setMap2ViewMode("filter_view");
  }, []);
  const handleMap2ParentOrgChange = useCallback((v) => {
    setMap2ParentOrg(v);
    if (v) setMap2ViewMode("filter_view");
  }, []);
  const handleMap2OrganizationChange = useCallback((v) => {
    setMap2Organization(v);
    if (v) setMap2ViewMode("filter_view");
  }, []);
  const handleMap2AssistanceTypeChange = useCallback((v) => {
    setMap2AssistanceType(v);
    if (v) setMap2ViewMode("filter_view");
  }, []);

  // Zip Code Data report filter state (same filter pattern as map2)
  const [zcdCounty, setZcdCounty] = useState("All Counties");
  const [zcdZipCode, setZcdZipCode] = useState("");
  const [zcdParentOrg, setZcdParentOrg] = useState("");
  const [zcdOrganization, setZcdOrganization] = useState("");
  const [zcdAssistanceType, setZcdAssistanceType] = useState("");

  const handleZcdReset = useCallback(() => {
    setZcdCounty("All Counties");
    setZcdZipCode("");
    setZcdParentOrg("");
    setZcdOrganization("");
    setZcdAssistanceType("");
  }, []);

  // Reset Zip Code Data filters when navigating away
  useEffect(() => {
    if (selectedReport !== "consolidated") {
      handleZcdReset();
    }
  }, [selectedReport, handleZcdReset]);

  // Ref to ZipCodeDataReport for download trigger
  const zcdReportRef = useRef(null);

  const handleZcdDownload = useCallback(() => {
    zcdReportRef.current?.download();
  }, []);

  // Ref to MapboxMap for download trigger
  const mapboxMapRef = useRef(null);

  const handleMap2Download = useCallback(() => {
    mapboxMapRef.current?.download();
  }, []);

  const handleMap2Reset = useCallback(() => {
    setMap2County("All Counties");
    setMap2ZipCode("");
    setMap2ParentOrg("");
    setMap2Organization("");
    setMap2AssistanceType("");
    setMap2ViewMode("distress");
    setMap2ActiveBase("distress");
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
      case "reports-chart":
        return <ReportsReport {...commonProps} />;
      case "usage-tables":
        return <UsageDataTables {...commonProps} />;
      case "map2":
        return (
          <MapboxMap
            ref={mapboxMapRef}
            county={map2County}
            zipCode={map2ZipCode}
            parentOrg={map2ParentOrg}
            organization={map2Organization}
            assistanceType={map2AssistanceType}
            viewMode={map2ViewMode}
            activeBase={map2ActiveBase}
            onViewModeChange={handleMap2ViewModeChange}
          />
        );
      case "consolidated":
        return (
          <ZipCodeDataReport
            ref={zcdReportRef}
            county={zcdCounty}
            zipCode={zcdZipCode}
            parentOrg={zcdParentOrg}
            organization={zcdOrganization}
            assistanceType={zcdAssistanceType}
            onAssistanceTypeChange={setZcdAssistanceType}
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
          map2ViewMode={map2ViewMode}
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
          onMap2CountyChange={handleMap2CountyChange}
          map2ZipCode={map2ZipCode}
          onMap2ZipCodeChange={handleMap2ZipCodeChange}
          map2ParentOrg={map2ParentOrg}
          onMap2ParentOrgChange={handleMap2ParentOrgChange}
          map2Organization={map2Organization}
          onMap2OrganizationChange={handleMap2OrganizationChange}
          map2AssistanceType={map2AssistanceType}
          onMap2AssistanceTypeChange={handleMap2AssistanceTypeChange}
          onMap2Reset={handleMap2Reset}
          onMap2Download={handleMap2Download}
          zcdCounty={zcdCounty}
          onZcdCountyChange={setZcdCounty}
          zcdZipCode={zcdZipCode}
          onZcdZipCodeChange={setZcdZipCode}
          zcdParentOrg={zcdParentOrg}
          onZcdParentOrgChange={setZcdParentOrg}
          zcdOrganization={zcdOrganization}
          onZcdOrganizationChange={setZcdOrganization}
          zcdAssistanceType={zcdAssistanceType}
          onZcdAssistanceTypeChange={setZcdAssistanceType}
          onZcdReset={handleZcdReset}
          onZcdDownload={handleZcdDownload}
        />
        {selectedReport !== "map2" && selectedReport !== "consolidated" && <NavBar3Reports
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
        <main className={`flex-1 bg-gray-50 ${selectedReport === "usage-tables" || selectedReport === "map" || selectedReport === "map2" || selectedReport === "consolidated" ? "overflow-hidden" : "overflow-auto"}`}>
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
