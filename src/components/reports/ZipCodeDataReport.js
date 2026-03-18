// src/components/reports/ZipCodeDataReport.js
// Displays zip code data table with distress, working poor, eviction,
// and census data by zip code. Default sort: normal_consol_score descending.
// Includes assistance icons column with expand/collapse to show organizations.

import React, { useState, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { useAppData } from "../../Contexts/AppDataContext";
import { getIconByName } from "../../icons/iconMap";
import { formatIconName } from "../../utils/formatters";

// Column definitions: key, label, and format function
const COLUMNS = [
  { key: "zip_code", label: "Zip\nCode", format: (v) => v ?? "—" },
  { key: "county", label: "County", format: (v) => v ?? "—" },
  { key: "distress_score", label: "Distress\nScore", format: fmtOne },
  { key: "working_poor_score", label: "Working\nPoor Score", format: fmtOne },
  { key: "eviction_score", label: "Eviction\nScore", format: fmtOne },
  { key: "population", label: "Population", format: fmtPopulation },
  { key: "median_household_income", label: "Median\nIncome", format: fmtDollar },
  { key: "income_ratio", label: "Income\nRatio", format: fmtTwo },
  { key: "poverty_rate", label: "Poverty\nRate", format: fmtOne },
  { key: "unemployment_rate", label: "Unemploy\nRate", format: fmtOne },
  { key: "no_health_insurance", label: "No Health\nInsurance", format: fmtOne },
  { key: "snap", label: "SNAP", format: fmtOne },
  { key: "filings_count", label: "Eviction\nFilings", format: fmtOne },
  { key: "amount_per_filing", label: "Claim Per\nFiling", format: fmtDollarOne },
  { key: "normal_consol_score", label: "Consol\nScore", format: fmtOne },
];

// Format helpers
function fmtOne(v) {
  if (v == null || v === "") return "—";
  return Number(v).toFixed(1);
}

function fmtTwo(v) {
  if (v == null || v === "") return "—";
  return Number(v).toFixed(2);
}

function fmtPopulation(v) {
  if (v == null || v === "") return "—";
  return Math.round(Number(v)).toLocaleString();
}

function fmtDollar(v) {
  if (v == null || v === "") return "—";
  return "$" + Math.round(Number(v)).toLocaleString();
}

function fmtDollarOne(v) {
  if (v == null || v === "") return "—";
  return "$" + Math.round(Number(v)).toLocaleString();
}

// Sort arrow indicator
function SortArrow({ active, direction }) {
  return (
    <span style={{ marginLeft: "4px", fontSize: "10px", opacity: active ? 1 : 0.4 }}>
      {direction === "asc" ? "▲" : "▼"}
    </span>
  );
}

// Active icon color when clicked/filtered
const ICON_ACTIVE_COLOR = "#B8001F";

// Group colors for icons (darker/more saturated than chip pastels for visibility at small size)
const GROUP_ICON_COLORS = {
  "1": "#B0A800", // yellow group - olive
  "2": "#7B42C9", // purple group
  "3": "#C94275", // pink group
  "4": "#5BA825", // green group
  "5": "#1A9EA8", // cyan group
  "6": "#C98A32", // orange group
};

const ZipCodeDataReport = forwardRef(function ZipCodeDataReport({ county, zipCode, parentOrg, organization, assistanceType, onAssistanceTypeChange }, ref) {
  const { zipCodeData, directory, assistance } = useAppData();

  // Sort state - default: normal_consol_score descending
  const [sortBy, setSortBy] = useState("normal_consol_score");
  const [sortDir, setSortDir] = useState("desc");

  // Expand state for individual icon click: { zip, assist_id } or null
  const [expandedRow, setExpandedRow] = useState(null);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "zip_code" || column === "county" ? "asc" : "desc");
    }
  };

  // Build zip → Set<assist_id> lookup from directory (active records only)
  // 99999 in client_zip_codes means the assist_id applies to ALL zips
  const zipAssistLookup = useMemo(() => {
    const lookup = new Map();
    const universalAssistIds = new Set();

    // First pass: collect universal assist_ids (99999)
    directory.forEach(r => {
      if (r.status_id !== 1) return;
      const cz = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      if (cz.includes("99999")) {
        universalAssistIds.add(r.assist_id);
      }
    });

    // Second pass: build per-zip sets
    directory.forEach(r => {
      if (r.status_id !== 1) return;
      const cz = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      if (cz.includes("99999")) return; // Already handled
      cz.forEach(z => {
        if (!lookup.has(z)) lookup.set(z, new Set(universalAssistIds));
        lookup.get(z).add(r.assist_id);
      });
    });

    // Ensure zips that only have universal coverage still get an entry
    return { lookup, universalAssistIds };
  }, [directory]);

  // Build assist_id → assistance record map for icon/name lookup
  const assistMap = useMemo(() => {
    const map = {};
    assistance.forEach(a => { map[a.assist_id] = a; });
    return map;
  }, [assistance]);

  // Get sorted assistance records for a zip code
  const getAssistanceForZip = useCallback((zip) => {
    const { lookup, universalAssistIds } = zipAssistLookup;
    const zipSet = lookup.get(zip);
    const ids = zipSet || new Set(universalAssistIds);
    return [...ids]
      .map(id => assistMap[id])
      .filter(Boolean)
      .sort((a, b) => parseInt(a.assist_id) - parseInt(b.assist_id));
  }, [zipAssistLookup, assistMap]);

  // Get organizations for a zip + assist_id combo
  const getOrgsForZipAssist = useCallback((zip, assistId) => {
    return directory
      .filter(r => {
        if (r.status_id !== 1) return false;
        if (r.assist_id !== assistId) return false;
        const cz = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
        return cz.includes("99999") || cz.includes(zip);
      })
      .map(r => r.organization)
      .filter(Boolean)
      .sort();
  }, [directory]);

  // Handle icon click - toggle expand for that row/assist
  const handleIconClick = useCallback((zip, assistId) => {
    // If NavBar2 filter is active, don't allow individual clicks
    if (assistanceType) return;
    setExpandedRow(prev => {
      if (prev && prev.zip === zip && prev.assist_id === assistId) return null;
      return { zip, assist_id: assistId };
    });
  }, [assistanceType]);

  // Resolve NavBar2 assistance filter to assist_id
  const filterAssistId = useMemo(() => {
    if (!assistanceType) return null;
    const match = assistance.find(a => a.assistance === assistanceType);
    return match ? match.assist_id : null;
  }, [assistanceType, assistance]);

  // Build set of zip codes served by matching directory records (for org filters)
  const servedZips = useMemo(() => {
    if (!parentOrg && !organization) return null;

    let filtered = directory.filter(r => r.status_id === 1);
    if (parentOrg) filtered = filtered.filter(r => r.org_parent === parentOrg);
    if (organization) filtered = filtered.filter(r => r.organization === organization);

    const zips = new Set();
    let hasWildcard = false;
    filtered.forEach(r => {
      const cz = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      if (cz.includes("99999")) hasWildcard = true;
      else cz.forEach(z => zips.add(z));
    });

    return hasWildcard ? null : zips;
  }, [directory, parentOrg, organization]);

  // Numeric column keys for median calculation
  const NUMERIC_KEYS = COLUMNS.filter(c => c.key !== "zip_code" && c.key !== "county").map(c => c.key);

  // Compute Houston median row from exclude === 2 records (always from full dataset, not filtered)
  const houstonMedianRow = useMemo(() => {
    if (!zipCodeData || zipCodeData.length === 0) return null;
    const eligible = zipCodeData.filter(r => r.exclude === 2);
    if (eligible.length === 0) return null;

    const medianRow = { zip_code: "Houston", county: "", _isMedian: true };
    NUMERIC_KEYS.forEach(key => {
      const values = eligible.map(r => r[key]).filter(v => v != null && v !== "").map(Number).sort((a, b) => a - b);
      if (values.length === 0) { medianRow[key] = null; return; }
      const mid = Math.floor(values.length / 2);
      medianRow[key] = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    });
    return medianRow;
  }, [zipCodeData, NUMERIC_KEYS]);

  // Filter and sort data, then insert Houston median at correct position
  const sortedData = useMemo(() => {
    if (!zipCodeData || zipCodeData.length === 0) return [];

    let data = zipCodeData;

    if (county && county !== "All Counties") {
      data = data.filter(r => r.county === county);
    }
    if (zipCode) {
      data = data.filter(r => r.zip_code === zipCode);
    }
    if (servedZips) {
      data = data.filter(r => servedZips.has(r.zip_code));
    }

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (sortBy === "zip_code" || sortBy === "county") {
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = Number(aVal) - Number(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });

    // Insert Houston median at correct sort position
    if (houstonMedianRow) {
      if (sortBy === "zip_code" || sortBy === "county") {
        // For text sorts, put median at the top
        sorted.unshift(houstonMedianRow);
      } else {
        const medianVal = houstonMedianRow[sortBy];
        if (medianVal == null) {
          sorted.push(houstonMedianRow);
        } else {
          // Find insertion point based on sort direction
          let insertIdx = sorted.findIndex(r => {
            const v = r[sortBy];
            if (v == null) return true;
            return sortDir === "desc" ? Number(v) < medianVal : Number(v) > medianVal;
          });
          if (insertIdx === -1) insertIdx = sorted.length;
          sorted.splice(insertIdx, 0, houstonMedianRow);
        }
      }
    }

    return sorted;
  }, [zipCodeData, county, zipCode, servedZips, sortBy, sortDir, houstonMedianRow]);

  // For CSV download: build visible data including expansion state
  const getDownloadData = useCallback(() => {
    const rows = sortedData.map(row => {
      const base = {};
      COLUMNS.forEach(col => { base[col.label.replace(/\n/g, " ")] = col.format(row[col.key]); });

      // Determine if this row is expanded
      const isFilterExpanded = !!filterAssistId;
      const isClickExpanded = expandedRow && expandedRow.zip === row.zip_code;

      if (isFilterExpanded) {
        const assistRecord = assistMap[filterAssistId];
        base["Assistance"] = assistRecord ? assistRecord.assistance : "";
        base["Organizations"] = getOrgsForZipAssist(row.zip_code, filterAssistId).join(" | ");
      } else if (isClickExpanded) {
        const assistRecord = assistMap[expandedRow.assist_id];
        base["Assistance"] = assistRecord ? assistRecord.assistance : "";
        base["Organizations"] = getOrgsForZipAssist(row.zip_code, expandedRow.assist_id).join(" | ");
      } else {
        base["Assistance"] = "";
        base["Organizations"] = "";
      }

      return base;
    });
    return rows;
  }, [sortedData, filterAssistId, expandedRow, assistMap, getOrgsForZipAssist]);

  // Download CSV
  const handleDownload = useCallback(() => {
    const rows = getDownloadData();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.map(h => `"${h}"`).join(","),
      ...rows.map(r => headers.map(h => {
        const val = r[h] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")),
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `CRG - Zip Code Data - ${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getDownloadData]);

  // Expose download to parent via ref
  useImperativeHandle(ref, () => ({ download: handleDownload }), [handleDownload]);

  if (!zipCodeData || zipCodeData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 font-opensans">
        No zip code data available.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="font-opensans font-semibold text-white cursor-pointer select-none"
                style={{
                  backgroundColor: "#B8001F",
                  padding: "6px 8px",
                  textAlign: "center",
                  fontSize: "12px",
                  borderRight: "1px solid rgba(255,255,255,0.15)",
                  whiteSpace: "pre-line",
                  lineHeight: "1.3",
                }}
              >
                {col.label}
                <SortArrow active={sortBy === col.key} direction={sortBy === col.key ? sortDir : "desc"} />
              </th>
            ))}
            {/* Assistance icons column header */}
            <th
              className="font-opensans font-semibold text-white select-none"
              style={{
                backgroundColor: "#B8001F",
                padding: "6px 8px",
                textAlign: "center",
                fontSize: "12px",
                whiteSpace: "pre-line",
                lineHeight: "1.3",
              }}
            >
              Assistance
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, idx) => {
            const zip = row.zip_code;
            const isMedian = !!row._isMedian;
            const assistTypes = isMedian ? [] : getAssistanceForZip(zip);
            const isFilterExpanded = !isMedian && !!filterAssistId;
            const isClickExpanded = !isMedian && expandedRow && expandedRow.zip === zip;
            const expandedAssistId = isFilterExpanded ? filterAssistId : (isClickExpanded ? expandedRow.assist_id : null);
            const bgColor = isMedian ? "#EEF4FF" : (idx % 2 === 0 ? "#FFFFFF" : "#F5F5F5");

            // Split icons into two rows: groups 1-3 (top) and groups 4-6 (bottom)
            const topRow = assistTypes.filter(at => at.group === "1" || at.group === "2" || at.group === "3");
            const bottomRow = assistTypes.filter(at => at.group === "4" || at.group === "5" || at.group === "6");

            // Render a row of icons with group spacing
            const renderIconRow = (icons) => {
              const items = [];
              let lastGroup = null;
              icons.forEach(at => {
                if (lastGroup !== null && at.group !== lastGroup) {
                  items.push(<span key={`sp-${lastGroup}-${at.group}`} style={{ width: "6px", display: "inline-block" }} />);
                }
                const iconResult = getIconByName(at.icon);
                const IconComp = Array.isArray(iconResult) ? iconResult[0] : iconResult;
                if (!IconComp) { lastGroup = at.group; return; }
                const isActive = expandedAssistId === at.assist_id;
                const groupColor = GROUP_ICON_COLORS[at.group] || "#999";
                const tooltipText = formatIconName(at.icon);
                items.push(
                  <span
                    key={at.assist_id}
                    className="inline-flex cursor-pointer group/icon"
                    style={{
                      position: "relative",
                      color: isActive ? ICON_ACTIVE_COLOR : groupColor,
                      transition: "color 0.15s",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleIconClick(zip, at.assist_id);
                    }}
                  >
                    <IconComp size={20} className="pointer-events-none" />
                    {tooltipText && (
                      <span
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/icon:opacity-100 transition-opacity duration-100 pointer-events-none"
                        style={{
                          backgroundColor: "var(--color-tooltip-bg)",
                          color: "var(--color-tooltip-text)",
                          fontSize: "var(--font-size-tooltip)",
                          zIndex: 9999,
                        }}
                      >
                        {tooltipText}
                      </span>
                    )}
                  </span>
                );
                lastGroup = at.group;
              });
              return items;
            };

            return (
              <React.Fragment key={zip || idx}>
                {/* Data row */}
                <tr
                  className="transition-colors duration-150"
                  style={{ backgroundColor: bgColor }}
                  onMouseEnter={(e) => { if (!isMedian && !expandedAssistId) e.currentTarget.style.backgroundColor = "#f2f3cc"; }}
                  onMouseLeave={(e) => { if (!isMedian && !expandedAssistId) e.currentTarget.style.backgroundColor = bgColor; }}
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className="font-opensans"
                      style={{
                        padding: "5px 8px",
                        textAlign: col.key === "zip_code" || col.key === "county" ? "left" : "right",
                        verticalAlign: "middle",
                        borderRight: "1px solid #E5E5E5",
                        whiteSpace: "nowrap",
                        fontSize: "15px",
                        color: isMedian ? "#1A56DB" : undefined,
                        fontWeight: isMedian ? 600 : undefined,
                      }}
                    >
                      {col.format(row[col.key])}
                    </td>
                  ))}
                  {/* Assistance icons - groups 1-3 on top, groups 4-6 on bottom */}
                  <td style={{ padding: "4px 8px", verticalAlign: "middle", position: "relative", overflow: "visible" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                      {renderIconRow(topRow)}
                    </div>
                    {bottomRow.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", whiteSpace: "nowrap" }}>
                        {renderIconRow(bottomRow)}
                      </div>
                    )}
                  </td>
                </tr>
                {/* Expanded org row - spans from County column to end */}
                {expandedAssistId && (
                  <tr style={{ backgroundColor: bgColor }}>
                    {/* Empty Zip Code cell for indent */}
                    <td style={{ borderRight: "1px solid #E5E5E5" }} />
                    {/* Org list spans from County to end */}
                    <td
                      colSpan={COLUMNS.length} // County through Consol Score + Assistance
                      style={{
                        padding: "4px 8px 8px",
                        fontSize: "13px",
                        lineHeight: "1.6",
                        cursor: isFilterExpanded ? "default" : "pointer",
                      }}
                      onClick={() => { if (!isFilterExpanded) setExpandedRow(null); }}
                    >
                      <div style={{
                        padding: "6px 10px",
                        backgroundColor: "#F9F9F0",
                        borderRadius: "4px",
                        borderLeft: `3px solid ${ICON_ACTIVE_COLOR}`,
                      }}>
                        <span style={{ fontWeight: 600, color: ICON_ACTIVE_COLOR, fontSize: "13px" }}>
                          {assistMap[expandedAssistId]?.assistance}:
                        </span>{" "}
                        {getOrgsForZipAssist(zip, expandedAssistId).map((org, orgIdx, arr) => (
                          <span key={org}>
                            <span className="font-opensans">{org}</span>
                            {orgIdx < arr.length - 1 && (
                              <span style={{ color: "#CCCCCC", margin: "0 4px" }}>|</span>
                            )}
                          </span>
                        ))}
                        {getOrgsForZipAssist(zip, expandedAssistId).length === 0 && (
                          <span style={{ color: "#999", fontStyle: "italic" }}>No organizations found</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

export default ZipCodeDataReport;
