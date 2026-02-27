// src/layout/NavBar3Reports.js
// Live stats cards for Reports page
// Shows: Top Zip Code | Top Assistance | Top Organization (all time)
// Coverage report: clickable stats to filter table + download button
// Includes Restricted/Unrestricted counts (unrestricted label shown in italic)

import { useState, useEffect } from "react";
import { fetchLiveStats } from "../services/usageService";
import { DownloadIcon } from "../icons/DownloadIcon";

// NavBar2 button blue - used for active filter highlight
const FILTER_ACTIVE_COLOR = "#2E5A88";

// Stat card component (for non-coverage reports)
function StatCard({ heading, value, percentage }) {
  const hasData = value && value !== 'N/A';

  return (
    <div
      className="flex items-center justify-center px-5 py-2"
      style={{
        backgroundColor: "var(--color-navbar3-reports-card-bg)",
        borderRadius: "var(--radius-navbar3-reports-card)",
      }}
    >
      <div className="flex flex-col items-start">
        <span
          className="font-opensans uppercase"
          style={{
            fontSize: "var(--font-size-navbar3-reports-heading)",
            color: "var(--color-navbar3-reports-heading)",
            fontWeight: 500,
            letterSpacing: "0.05em",
          }}
        >
          {heading}
        </span>
        <div
          className="flex items-baseline"
          style={{ gap: "var(--gap-navbar3-reports-value-pct)" }}
        >
          <span
            className="font-opensans"
            style={{
              fontSize: "var(--font-size-navbar3-reports-value)",
              color: "var(--color-navbar3-reports-value)",
              fontWeight: 500,
            }}
          >
            {hasData ? value : "--"}
          </span>
          {hasData && (
            <span
              className="font-opensans"
              style={{
                fontSize: "var(--font-size-navbar3-reports-percentage)",
                color: "var(--color-navbar3-reports-percentage)",
                fontWeight: 500,
              }}
            >
              {percentage}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable clickable stat button for NavBar3 coverage
function ClickableStat({ label, value, isActive, onClick, title, italic = false }) {
  return (
    <button
      onClick={onClick}
      className="transition-all duration-200 hover:brightness-125"
      style={{
        background: isActive ? "rgba(46, 90, 136, 0.25)" : "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 12px",
        borderRadius: "6px",
      }}
      title={title}
    >
      <span className="font-opensans" style={{
        fontSize: "18px",
        color: isActive ? FILTER_ACTIVE_COLOR : "#FDF6E3",
        fontWeight: isActive ? 500 : 200,
        transition: "color 0.2s",
        textDecoration: isActive ? "underline" : "none",
        fontStyle: italic ? "italic" : "normal",
      }}>
        {label}: <strong>{value}</strong>
      </span>
    </button>
  );
}

// Separator dot between stat groups
function StatSeparator() {
  return (
    <span style={{ color: "#FDF6E3", fontSize: "18px", opacity: 0.4 }}>|</span>
  );
}

export default function NavBar3Reports({
  selectedReport,
  coverageSummary,
  coverageDisplayFilter,
  onCoverageDisplayFilterChange,
  coverageRestrictionFilter,
  onCoverageRestrictionFilterChange,
  coverageDisplayData,
  coverageFilters,
}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      const data = await fetchLiveStats();
      setStats(data);
      setLoading(false);
    }
    loadStats();
  }, []);

  // Click stat to toggle filter - click again to remove
  const handleDisplayFilterClick = (filterType) => {
    if (!onCoverageDisplayFilterChange) return;
    onCoverageDisplayFilterChange(coverageDisplayFilter === filterType ? "all" : filterType);
  };

  const handleRestrictionFilterClick = (filterType) => {
    if (!onCoverageRestrictionFilterChange) return;
    onCoverageRestrictionFilterChange(coverageRestrictionFilter === filterType ? "all" : filterType);
  };

  // Download CSV
  const handleDownload = () => {
    if (!coverageDisplayData || coverageDisplayData.length === 0) return;

    const filterLines = [];
    filterLines.push("The Matt Report - Coverage Download");
    filterLines.push(`Generated: ${new Date().toLocaleDateString()}`);
    if (coverageFilters) {
      if (coverageFilters.county && coverageFilters.county !== "All Counties") {
        filterLines.push(`County: ${coverageFilters.county}`);
      }
      if (coverageFilters.parentOrg) {
        filterLines.push(`Parent Organization: ${coverageFilters.parentOrg}`);
      }
      if (coverageFilters.childOrg) {
        filterLines.push(`Child Organization: ${coverageFilters.childOrg}`);
      }
      if (coverageFilters.assistanceType) {
        filterLines.push(`Assistance Type: ${coverageFilters.assistanceType}`);
      }
      if (coverageFilters.status) {
        filterLines.push(`Status: ${coverageFilters.status}`);
      }
    }
    if (coverageDisplayFilter && coverageDisplayFilter !== "all") {
      filterLines.push(`Coverage Filter: ${coverageDisplayFilter === "covered" ? "Covered Only" : "No Coverage Only"}`);
    }
    if (coverageRestrictionFilter && coverageRestrictionFilter !== "all") {
      filterLines.push(`Restriction Filter: ${coverageRestrictionFilter === "restricted" ? "Restricted Only" : "Unrestricted Only"}`);
    }
    if (coverageSummary) {
      filterLines.push(`Total Zip Codes: ${coverageSummary.totalZips} | Covered: ${coverageSummary.zipsWithCoverage} | No Coverage: ${coverageSummary.zipsWithoutCoverage}`);
      filterLines.push(`Restricted Orgs: ${coverageSummary.totalRestricted} | Unrestricted Orgs: ${coverageSummary.totalUnrestricted}`);
    }
    filterLines.push("");

    const csvRows = [];
    filterLines.forEach(line => csvRows.push(`"${line}"`));
    csvRows.push("Zip Code,County,Count,Organizations");
    coverageDisplayData.forEach(row => {
      const orgs = row.organizations.join("; ");
      csvRows.push(`${row.zipCode},"${row.county || ""}",${row.count},"${orgs.replace(/"/g, '""')}"`);
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    const assistType = coverageFilters?.assistanceType || "all";
    link.download = `CRG-Coverage-${assistType}-${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Coverage report: clickable stats + download
  if (selectedReport === "coverage") {
    const hasDisplayData = coverageDisplayData && coverageDisplayData.length > 0;

    return (
      <nav
        className="bg-navbar3-bg flex items-center justify-between"
        style={{
          height: "var(--height-navbar3)",
          paddingLeft: "var(--padding-navbar3-left)",
          paddingRight: "20px",
        }}
      >
        {coverageSummary ? (
          <div className="flex items-center gap-6">
            {/* Total Zip Codes - not clickable */}
            <span className="font-opensans" style={{ fontSize: "18px", color: "#FDF6E3", fontWeight: 200 }}>
              Total Zip Codes: <strong>{coverageSummary.totalZips}</strong>
            </span>

            {/* Zip Codes Covered - clickable */}
            <ClickableStat
              label="Zip Codes Covered"
              value={coverageSummary.zipsWithCoverage}
              isActive={coverageDisplayFilter === "covered"}
              onClick={() => handleDisplayFilterClick("covered")}
              title={coverageDisplayFilter === "covered" ? "Click to show all" : "Click to show only covered"}
            />

            {/* Zip Codes No Coverage - clickable */}
            <ClickableStat
              label="Zip Codes No Coverage"
              value={coverageSummary.zipsWithoutCoverage}
              isActive={coverageDisplayFilter === "no-coverage"}
              onClick={() => handleDisplayFilterClick("no-coverage")}
              title={coverageDisplayFilter === "no-coverage" ? "Click to show all" : "Click to show only no coverage"}
            />

            <StatSeparator />

            {/* Restricted - clickable */}
            <ClickableStat
              label="Restricted"
              value={coverageSummary.totalRestricted}
              isActive={coverageRestrictionFilter === "restricted"}
              onClick={() => handleRestrictionFilterClick("restricted")}
              title={coverageRestrictionFilter === "restricted" ? "Click to show all" : "Click to show only restricted orgs"}
            />

            {/* Unrestricted - clickable, italic to match table styling */}
            <ClickableStat
              label="Unrestricted"
              value={coverageSummary.totalUnrestricted}
              isActive={coverageRestrictionFilter === "unrestricted"}
              onClick={() => handleRestrictionFilterClick("unrestricted")}
              title={coverageRestrictionFilter === "unrestricted" ? "Click to show all" : "Click to show only unrestricted orgs"}
              italic
            />
          </div>
        ) : (
          <span className="text-white/70 font-opensans" style={{ fontSize: "14px" }}>
            Select an Assistance Type to view coverage data
          </span>
        )}

        {/* Download button - Google Blue */}
        {coverageSummary && hasDisplayData && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 transition-all duration-200 hover:brightness-125"
            style={{
              background: "#4285F4",
              border: "none",
              borderRadius: "6px",
              padding: "6px 14px",
              cursor: "pointer",
              color: "#FFFFFF",
            }}
            title="Download CSV"
          >
            <DownloadIcon size={20} color="#FFFFFF" />
            <span className="font-opensans" style={{ fontSize: "18px", fontWeight: 400 }}>
              Download
            </span>
          </button>
        )}
      </nav>
    );
  }

  // Other reports: stat cards at full height
  return (
    <nav
      className="bg-navbar3-bg flex items-center justify-center"
      style={{
        height: "var(--height-navbar3-reports)",
        paddingLeft: "var(--padding-navbar3-left)",
        paddingRight: "20px",
      }}
    >
      {loading ? (
        <span className="text-white font-opensans" style={{ fontSize: "14px" }}>
          Loading stats...
        </span>
      ) : stats ? (
        <div
          className="flex items-center justify-center"
          style={{ gap: "var(--gap-navbar3-reports-cards)" }}
        >
          <StatCard
            heading="Top Zip Code"
            value={stats.topZip.value}
            percentage={stats.topZip.percentage}
          />
          <StatCard
            heading="Top Assistance"
            value={stats.topAssistance.value}
            percentage={stats.topAssistance.percentage}
          />
          <StatCard
            heading="Top Organization"
            value={stats.topRegOrg.value}
            percentage={stats.topRegOrg.percentage}
          />
        </div>
      ) : (
        <span className="text-white font-opensans" style={{ fontSize: "14px" }}>
          No data available
        </span>
      )}
    </nav>
  );
}
