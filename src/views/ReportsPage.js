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
import SessionsReport from "../components/reports/SessionsReport";
import EmailsReport from "../components/reports/EmailsReport";
import PdfsReport from "../components/reports/PdfsReport";
import ReportsReport from "../components/reports/ReportsReport";
import UsageDataTables from "../components/reports/UsageDataTables";
import CoverageReport from "../components/reports/CoverageReport";
import MapboxMap from "../components/reports/MapboxMap";
import MapboxMapV2 from "../components/reports/MapboxMapV2";
import ReportsSidebarV2 from "../components/reports/ReportsSidebarV2";
import ZipCodeDataReport from "../components/reports/ZipCodeDataReport";
import { useAppData } from "../Contexts/AppDataContext";

// Allowed assistance labels for the v2 (New Zip Code Maps) page. Default is
// the entry with the smallest assist_id at runtime (so adding a label here
// slots into the right order automatically once data loads).
const V2_ASSISTANCE_ALLOWED = new Set(["Rent", "Utilities", "Food"]);

export default function ReportsPage() {
  // State for report selection
  const [selectedReport, setSelectedReport] = useState("zip-code");

  // State for organization filter (used by chart reports)
  const [selectedOrg, setSelectedOrg] = useState("All Users");

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

  // Coverage display filter (NavBar3 clickable stat)
  const [coverageDisplayFilter, setCoverageDisplayFilter] = useState("all");

  // Reset all coverage filters
  const handleCoverageReset = useCallback(() => {
    setCoverageCounty("All Counties");
    setCoverageZipCode("");
    setCoverageParentOrg("");
    setCoverageChildOrg("");
    setCoverageAssistanceType("");
    setCoverageStatus("Active");
    setCoverageDisplayFilter("all");
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

  // Zip Code Data report filter state
  const [zcdCounties, setZcdCounties] = useState(new Set());
  const [zcdParentOrg, setZcdParentOrg] = useState("");
  const [zcdOrganization, setZcdOrganization] = useState(new Set());
  const [zcdAllExpanded, setZcdAllExpanded] = useState(false);

  const handleZcdReset = useCallback(() => {
    setZcdCounties(new Set());
    setZcdParentOrg("");
    setZcdOrganization(new Set());
    setZcdAllExpanded(false);
    zcdReportRef.current?.resetFilters();
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

  const handleZcdPdfDownload = useCallback(() => {
    zcdReportRef.current?.downloadPdf();
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
    // Stay on current base map — only clear filters, don't reset the metric view
    setMap2ViewMode(map2ActiveBase);
  }, [map2ActiveBase]);

  // Reset Map 2 filters when navigating away
  useEffect(() => {
    if (selectedReport !== "map2") {
      handleMap2Reset();
    }
  }, [selectedReport, handleMap2Reset]);

  // Zip Code Maps v2 state
  const { assistance: v2AssistanceTable } = useAppData();

  // Default assistance = the allowed entry with the smallest assist_id.
  // Computed once the assistance table loads; stays empty until then.
  const v2DefaultAssistance = useMemo(() => {
    if (!v2AssistanceTable) return "";
    const sorted = v2AssistanceTable
      .filter((a) => a.assistance && V2_ASSISTANCE_ALLOWED.has(a.assistance))
      .slice()
      .sort((a, b) => Number(a.assist_id) - Number(b.assist_id));
    return sorted.length > 0 ? sorted[0].assistance : "";
  }, [v2AssistanceTable]);

  const [v2Mode, setV2Mode] = useState("conditions"); // conditions | services | compare
  const [v2BaseMap, setV2BaseMap] = useState("distress"); // distress | evictions
  const [v2Assistance, setV2Assistance] = useState(""); // populated when table loads
  const [v2ServicesView, setV2ServicesView] = useState("pins"); // pins | coverage
  const [v2County, setV2County] = useState("All Counties");
  // Who filter: cross-cutting overlay applied to every v2 mode. Parent
  // narrows the Organization list (and vice versa via the helpers in
  // utils/orgFilters); both "" means "Any".
  const [v2ParentOrg, setV2ParentOrg] = useState("");
  const [v2Organization, setV2Organization] = useState("");

  // Hydrate the assistance default once the table arrives.
  useEffect(() => {
    if (!v2Assistance && v2DefaultAssistance) {
      setV2Assistance(v2DefaultAssistance);
    }
  }, [v2Assistance, v2DefaultAssistance]);

  const mapboxMapV2Ref = useRef(null);
  const handleV2Reset = useCallback(() => {
    setV2Mode("conditions");
    setV2BaseMap("distress");
    setV2Assistance(v2DefaultAssistance);
    setV2ServicesView("pins");
    setV2County("All Counties");
    setV2ParentOrg("");
    setV2Organization("");
    mapboxMapV2Ref.current?.clearSelection?.();
  }, [v2DefaultAssistance]);

  const handleV2Download = useCallback(() => {
    mapboxMapV2Ref.current?.download();
  }, []);

  // Reset v2 when navigating away
  useEffect(() => {
    if (selectedReport !== "map2-v2") {
      handleV2Reset();
    }
  }, [selectedReport, handleV2Reset]);

  // Derive effective viewMode for the v2 map from mode + sub-selections.
  // The map already understands these metric strings; we just compose them here.
  // v2BaseMap is shared between Conditions and Compare so the user's Distress
  // vs Evictions choice persists when they flip between the two modes.
  const v2ViewMode = useMemo(() => {
    if (v2Mode === "compare") {
      return v2BaseMap === "evictions"
        ? "evictions_coverage_bivariate"
        : "distress_coverage_bivariate";
    }
    if (v2Mode === "services") {
      return v2ServicesView === "coverage" ? "service_coverage" : "service_pins";
    }
    return v2BaseMap; // conditions
  }, [v2Mode, v2BaseMap, v2ServicesView]);

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
            onSummaryChange={handleSummaryChange}
            onDisplayDataChange={handleDisplayDataChange}
          />
        );
      case "zip-code":
        return <ZipCodeReport {...commonProps} />;
      case "sessions":
        return <SessionsReport {...commonProps} />;
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
      case "map2-v2":
        return (
          <div className="flex flex-row h-full w-full overflow-hidden">
            <ReportsSidebarV2
              mode={v2Mode}
              onModeChange={setV2Mode}
              baseMap={v2BaseMap}
              onBaseMapChange={setV2BaseMap}
              assistance={v2Assistance}
              onAssistanceChange={setV2Assistance}
              servicesView={v2ServicesView}
              onServicesViewChange={setV2ServicesView}
              county={v2County}
              onCountyChange={setV2County}
              parentOrg={v2ParentOrg}
              onParentOrgChange={setV2ParentOrg}
              organization={v2Organization}
              onOrganizationChange={setV2Organization}
              onReset={handleV2Reset}
              onDownload={handleV2Download}
            />
            <div className="flex-1 relative overflow-hidden">
              <MapboxMapV2
                ref={mapboxMapV2Ref}
                county={v2County}
                assistanceType={v2Mode === "conditions" ? "" : v2Assistance}
                parentOrg={v2ParentOrg}
                organization={v2Organization}
                viewMode={v2ViewMode}
              />
            </div>
          </div>
        );
      case "consolidated":
        return (
          <ZipCodeDataReport
            ref={zcdReportRef}
            counties={zcdCounties}
            parentOrg={zcdParentOrg}
            organization={zcdOrganization}
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
        {selectedReport !== "map2-v2" && <NavBar2Reports
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
          map2ActiveBase={map2ActiveBase}
          onMap2Reset={handleMap2Reset}
          onMap2Download={handleMap2Download}
          zcdCounties={zcdCounties}
          onZcdCountiesChange={setZcdCounties}
          zcdParentOrg={zcdParentOrg}
          onZcdParentOrgChange={setZcdParentOrg}
          zcdOrganization={zcdOrganization}
          onZcdOrganizationChange={setZcdOrganization}
          onZcdReset={handleZcdReset}
          onZcdDownload={handleZcdDownload}
          onZcdPdfDownload={handleZcdPdfDownload}
          onZcdToggleExpand={() => { zcdReportRef.current?.toggleAllExpanded(); setZcdAllExpanded(prev => !prev); }}
          zcdAllExpanded={zcdAllExpanded}
        />}
        {selectedReport !== "map2" && selectedReport !== "map2-v2" && selectedReport !== "consolidated" && selectedReport !== "usage-tables" && <NavBar3Reports
          selectedReport={selectedReport}
          coverageSummary={coverageSummary}
          coverageDisplayFilter={coverageDisplayFilter}
          onCoverageDisplayFilterChange={setCoverageDisplayFilter}
          coverageDisplayData={coverageDisplayData}
          coverageFilters={coverageFilters}
        />}

        {/* Report content - UsageDataTables handles its own scroll for sticky header */}
        <main className={`flex-1 bg-gray-50 ${selectedReport === "usage-tables" || selectedReport === "map" || selectedReport === "map2" || selectedReport === "map2-v2" || selectedReport === "consolidated" ? "overflow-hidden" : "overflow-auto"}`}>
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
