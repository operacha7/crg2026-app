// src/components/reports/ZipCodeDataReport.js
// Displays zip code data table with distress, working poor, eviction,
// and census data by zip code. Default sort: normal_consol_score descending.
// Includes assistance icons column with expand/collapse to show organizations.

import React, { useState, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { useAppData } from "../../Contexts/AppDataContext";
import { getIconByName } from "../../icons/iconMap";
import VerticalLineIcon from "../../icons/VerticalLineIcon";
import ColumnHeaderFilter from "../ColumnHeaderFilter";

// Format helpers mapped by config format string
const FORMAT_MAP = {
  text: (v) => v ?? "—",
  one_decimal: (v) => (v == null || v === "") ? "—" : Number(v).toFixed(1),
  two_decimal: (v) => (v == null || v === "") ? "—" : Number(v).toFixed(2),
  whole_number: (v) => (v == null || v === "") ? "—" : Math.round(Number(v)).toLocaleString(),
  whole_dollar: (v) => (v == null || v === "") ? "—" : "$" + Math.round(Number(v)).toLocaleString(),
};

function getFormatter(formatStr) {
  return FORMAT_MAP[formatStr] || FORMAT_MAP.text;
}

// Sort arrow indicator
function SortArrow({ active, direction }) {
  return (
    <span style={{ marginLeft: "4px", fontSize: "10px", opacity: active ? 1 : 0.4 }}>
      {direction === "asc" ? "▲" : "▼"}
    </span>
  );
}

// Score highlight: applies to fields containing "score" in the name (dynamic, config-driven)
function isScoreField(fieldName) {
  return fieldName && fieldName.includes("score");
}
function getScoreHighlight(value) {
  if (value == null || value === "") return undefined;
  const v = Number(value);
  if (v >= 90) return "rgba(220, 40, 40, 0.40)";     // red
  if (v >= 60) return "rgba(240, 150, 30, 0.40)";    // orange
  if (v >= 30) return "rgba(230, 200, 50, 0.40)";    // yellow
  if (v >= 0)  return "rgba(80, 170, 80, 0.40)";     // green
  return undefined;
}

// DCI highlight: based on dci_quin quintile (5=distressed/red, 1=prosperous/blue)
const DCI_FIELDS = new Set(["dci_score", "dci_catg"]);
function getDciHighlight(quinValue) {
  if (quinValue == null || quinValue === "") return undefined;
  const q = Number(quinValue);
  if (q === 5) return "rgba(220, 40, 40, 0.40)";     // red - Distressed
  if (q === 4) return "rgba(240, 150, 30, 0.40)";    // orange - At Risk
  if (q === 3) return "rgba(230, 200, 50, 0.40)";    // yellow - Mid-Tier
  if (q === 2) return "rgba(140, 180, 220, 0.50)";   // light blue - Comfortable
  if (q === 1) return "rgba(80, 120, 180, 0.50)";    // darker blue - Prosperous
  return undefined;
}

// Section headers for exclude groups
const SECTION_HEADERS = {
  2: "Core Houston Area",
  1: "Small Population (under 10,000)",
  0: "PO Box / No Data Available",
};

// Field-specific aggregation rules for summary rows (Houston & org summaries)
// Fields not listed default to "weighted" (population-weighted average)
const FIELD_AGG = {
  population: "sum",
  filings_count: "sum",
  claim_amount: "sum",
  amount_per_filing: "calculated",  // claim_amount / filings_count
  income_ratio: "calculated",       // org: weighted income / Houston weighted income
  dci_quin: "derived",              // from weighted dci_score
  dci_catg: "derived",              // from dci_quin
};

// DCI quintile from score: 0-20=1, 20-40=2, 40-60=3, 60-80=4, 80-100=5
function dciQuinFromScore(score) {
  if (score == null) return null;
  const s = Number(score);
  if (s <= 20) return 1;
  if (s <= 40) return 2;
  if (s <= 60) return 3;
  if (s <= 80) return 4;
  return 5;
}

const DCI_CATG_LABELS = { 1: "Prosperous", 2: "Comfortable", 3: "Mid-Tier", 4: "At Risk", 5: "Distressed" };

// Compute a summary row (Houston or org summary) from Core Houston Area rows
// Uses population-weighted averages for rates/scores, sums for counts, calculated for derived fields
// numericKeys: array of field names to aggregate
// label: display text for zip_code column
// marker: object to spread onto the row (e.g. { _isMedian: true } or { _isOrgMedian: true })
// houstonRow: (optional) Houston summary row, needed for org income_ratio calculation
// isOrgRow: boolean — true for org summaries (income_ratio = org/houston), false for Houston
function computeSummaryRow(rows, numericKeys, label, marker, houstonRow, isOrgRow) {
  const summaryRow = { zip_code: label, county: "", neighborhood: "", ...marker };

  // Helper: compute sum of numeric values
  const sum = (arr) => {
    const valid = arr.filter(v => v != null && v !== "").map(Number);
    return valid.length === 0 ? null : valid.reduce((a, b) => a + b, 0);
  };

  // Helper: compute population-weighted average
  // Pairs each value with its row's population, skipping rows where either is null
  const weightedAvg = (key) => {
    let totalWeight = 0;
    let weightedSum = 0;
    rows.forEach(r => {
      const val = r[key];
      const pop = r.population;
      if (val == null || val === "" || pop == null || pop === "" || Number(pop) === 0) return;
      const w = Number(pop);
      totalWeight += w;
      weightedSum += Number(val) * w;
    });
    return totalWeight === 0 ? null : weightedSum / totalWeight;
  };

  // Pass 1: compute weighted/sum fields
  numericKeys.forEach(key => {
    const agg = FIELD_AGG[key] || "weighted";
    if (agg === "calculated" || agg === "derived") return; // computed in pass 2
    if (agg === "sum") {
      summaryRow[key] = sum(rows.map(r => r[key]));
    } else {
      // "weighted" — population-weighted average
      summaryRow[key] = weightedAvg(key);
    }
  });

  // Pass 2: calculated fields
  // amount_per_filing = claim_amount / filings_count
  if (summaryRow.claim_amount != null && summaryRow.filings_count != null && summaryRow.filings_count !== 0) {
    summaryRow.amount_per_filing = summaryRow.claim_amount / summaryRow.filings_count;
  } else {
    summaryRow.amount_per_filing = null;
  }

  // income_ratio: org weighted income / Houston weighted income
  if (isOrgRow && houstonRow) {
    const orgIncome = weightedAvg("median_household_income");
    const houstonIncome = houstonRow.median_household_income;
    summaryRow.income_ratio = (orgIncome != null && houstonIncome != null && houstonIncome !== 0)
      ? orgIncome / houstonIncome : null;
  }
  // For Houston, income_ratio was already computed as weighted avg in pass 1

  // dci_quin and dci_catg derived from weighted dci_score
  summaryRow.dci_quin = dciQuinFromScore(summaryRow.dci_score);
  summaryRow.dci_catg = summaryRow.dci_quin != null ? (DCI_CATG_LABELS[summaryRow.dci_quin] || "") : "";

  return summaryRow;
}

// Active icon color when clicked/filtered
const ICON_ACTIVE_COLOR = "#B8001F";


const ZipCodeDataReport = forwardRef(function ZipCodeDataReport({ parentOrg, organization }, ref) {
  const { zipCodeData, directory, assistance, headerConfig } = useAppData();

  // Internal multi-select filter state (null = all selected / no filter)
  const [selectedCounties, setSelectedCounties] = useState(null);
  const [selectedZipCodes, setSelectedZipCodes] = useState(null);

  // Clear county/zip filters when parent or child org selection changes
  useEffect(() => {
    setSelectedCounties(null);
    setSelectedZipCodes(null);
  }, [parentOrg, organization]);

  // Build columns from header_config (filtered to zip_code_data, visible only, ordered by id_no)
  const COLUMNS = useMemo(() => {
    const configs = headerConfig
      .filter(c => c.table === "zip_code_data" && c.visible)
      .sort((a, b) => a.id_no - b.id_no);
    return configs.map(c => ({
      key: c.field_name,
      label: (c.display_label || "").replaceAll("|", "\n"),
      format: getFormatter(c.format),
      isText: c.format === "text",
    }));
  }, [headerConfig]);

  // Sort state - default: normal_consol_score descending
  const [sortBy, setSortBy] = useState("normal_consol_score");
  const [sortDir, setSortDir] = useState("desc");

  // Expand state: Set of expanded zip codes (supports expand all)
  const [expandedZips, setExpandedZips] = useState(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      const colConfig = COLUMNS.find(c => c.key === column);
      setSortDir(colConfig?.isText ? "asc" : "desc");
    }
  };

  // Set of assist_ids that are financial assistance (is_fin_assist = true)
  const finAssistIds = useMemo(() => {
    return new Set(assistance.filter(a => a.is_fin_assist).map(a => a.assist_id));
  }, [assistance]);

  // Build zip → Set<assist_id> lookup from directory (active records, financial assistance only)
  // 99999 in client_zip_codes means the assist_id applies to ALL zips
  // Build assist_id → assistance record map for icon/name lookup
  const assistMap = useMemo(() => {
    const map = {};
    assistance.forEach(a => { map[a.assist_id] = a; });
    return map;
  }, [assistance]);

  // Get all financial assistance orgs for a zip, with their assist type icons
  // Returns: [{ name: "Org A", assistTypes: [{ assist_id, icon, assistance }] }, ...]
  const getFinancialOrgsForZip = useCallback((zip) => {
    const orgMap = {};
    directory.forEach(r => {
      if (r.status_id !== 1) return;
      if (!finAssistIds.has(r.assist_id)) return;
      const cz = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      if (!cz.includes("99999") && !cz.includes(zip)) return;
      const name = r.organization;
      if (!name) return;
      if (!orgMap[name]) orgMap[name] = { name, assistTypes: [] };
      const at = assistMap[r.assist_id];
      if (at && !orgMap[name].assistTypes.find(a => a.assist_id === at.assist_id)) {
        orgMap[name].assistTypes.push(at);
      }
    });
    return Object.values(orgMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [directory, finAssistIds, assistMap]);

  // Toggle expand for a zip code row
  const toggleExpand = useCallback((zip) => {
    setExpandedZips(prev => {
      const next = new Set(prev);
      if (next.has(zip)) next.delete(zip);
      else next.add(zip);
      return next;
    });
  }, []);

  // Build set of zip codes served by matching directory records (for org filters)
  // Filter by finAssistIds so parent org selection matches the Organization dropdown behavior
  const hasOrgFilter = organization instanceof Set && organization.size > 0;
  const servedZips = useMemo(() => {
    if (!parentOrg && !hasOrgFilter) return null;

    let filtered = directory.filter(r => r.status_id === 1 && finAssistIds.has(r.assist_id));
    if (parentOrg) filtered = filtered.filter(r => r.org_parent === parentOrg);
    if (hasOrgFilter) filtered = filtered.filter(r => organization.has(r.organization));

    const zips = new Set();
    let hasWildcard = false;
    filtered.forEach(r => {
      const cz = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      if (cz.includes("99999")) hasWildcard = true;
      else cz.forEach(z => zips.add(z));
    });

    return hasWildcard ? null : zips;
  }, [directory, parentOrg, organization, finAssistIds]);

  // Build set of org names to highlight in expanded rows (based on parent/org filter)
  const highlightedOrgs = useMemo(() => {
    if (!parentOrg && !hasOrgFilter) return null;
    let filtered = directory.filter(r => r.status_id === 1 && finAssistIds.has(r.assist_id));
    if (parentOrg) filtered = filtered.filter(r => r.org_parent === parentOrg);
    if (hasOrgFilter) filtered = filtered.filter(r => organization.has(r.organization));
    return new Set(filtered.map(r => r.organization).filter(Boolean));
  }, [directory, parentOrg, organization, finAssistIds]);

  // Numeric column keys for median calculation
  // Numeric keys for median calculation (all non-text visible columns)
  const NUMERIC_KEYS = useMemo(() => COLUMNS.filter(c => !c.isText).map(c => c.key), [COLUMNS]);

  // Compute Houston median/summary row from exclude === 2 records (always from full dataset, not filtered)
  const houstonMedianRow = useMemo(() => {
    if (!zipCodeData || zipCodeData.length === 0) return null;
    const eligible = zipCodeData.filter(r => r.exclude === 2);
    if (eligible.length === 0) return null;
    return computeSummaryRow(eligible, NUMERIC_KEYS, "Houston", { _isMedian: true }, null, false);
  }, [zipCodeData, NUMERIC_KEYS]);

  // Sort helper: sort an array by current sortBy/sortDir
  // Check if a column is text-type based on config
  const isTextColumn = useCallback((fieldName) => {
    const colConfig = COLUMNS.find(c => c.key === fieldName);
    return colConfig ? colConfig.isText : false;
  }, [COLUMNS]);

  const sortSection = useCallback((data, defaultSort) => {
    return [...data].sort((a, b) => {
      const col = defaultSort || sortBy;
      const dir = defaultSort ? (isTextColumn(col) ? "asc" : "desc") : sortDir;
      const aVal = a[col];
      const bVal = b[col];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (isTextColumn(col)) {
        const cmp = String(aVal).localeCompare(String(bVal));
        return dir === "asc" ? cmp : -cmp;
      }
      const cmp = Number(aVal) - Number(bVal);
      return dir === "asc" ? cmp : -cmp;
    });
  }, [sortBy, sortDir, isTextColumn]);

  // Helper: insert a summary row at the correct sort position in a sorted array
  const insertAtSortPosition = useCallback((arr, summaryRow) => {
    if (isTextColumn(sortBy)) {
      arr.unshift(summaryRow);
    } else {
      const val = summaryRow[sortBy];
      if (val == null) {
        arr.push(summaryRow);
      } else {
        let idx = arr.findIndex(r => {
          const v = r[sortBy];
          if (v == null) return true;
          return sortDir === "desc" ? Number(v) < val : Number(v) > val;
        });
        if (idx === -1) idx = arr.length;
        arr.splice(idx, 0, summaryRow);
      }
    }
  }, [sortBy, sortDir, isTextColumn]);

  // Helper: build sections from a set of zip code data rows
  // prependRows: rows to place at the top of Core Houston Area (org summary, Houston) — used in org grouping mode
  // insertRows: rows to insert at sort position in Core Houston Area — used in flat mode
  const buildSections = useCallback((data, { prependRows = [], insertRows = [] } = {}) => {
    const section2 = sortSection(data.filter(r => r.exclude === 2));
    const section1 = sortSection(data.filter(r => r.exclude === 1));
    const section0 = sortSection(data.filter(r => r.exclude !== 2 && r.exclude !== 1), "zip_code");

    const result = [];
    if (section2.length > 0 || prependRows.length > 0) {
      result.push({ _sectionHeader: true, _sectionLabel: SECTION_HEADERS[2], _sectionExclude: 2 });
      // Prepend summary rows at top (org grouping mode)
      prependRows.forEach(row => { if (row) result.push(row); });
      // Insert summary rows at sort position (flat mode)
      insertRows.forEach(row => { if (row) insertAtSortPosition(section2, row); });
      result.push(...section2);
    }
    if (section1.length > 0) {
      result.push({ _sectionHeader: true, _sectionLabel: SECTION_HEADERS[1], _sectionExclude: 1 });
      result.push(...section1);
    }
    if (section0.length > 0) {
      result.push({ _sectionHeader: true, _sectionLabel: SECTION_HEADERS[0], _sectionExclude: 0 });
      result.push(...section0);
    }
    return result;
  }, [sortSection, insertAtSortPosition]);

  // Determine list of child orgs for grouping (when parent or org filter is active)
  // Filter by finAssistIds so parent org produces same org list as the Organization dropdown
  const orgGroupList = useMemo(() => {
    if (!parentOrg && !hasOrgFilter) return null;
    let filtered = directory.filter(r => r.status_id === 1 && finAssistIds.has(r.assist_id));
    if (parentOrg) filtered = filtered.filter(r => r.org_parent === parentOrg);
    if (hasOrgFilter) filtered = filtered.filter(r => organization.has(r.organization));
    return [...new Set(filtered.map(r => r.organization).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [directory, parentOrg, hasOrgFilter, organization, finAssistIds]);

  // Build per-org zip lookup: org name → Set<zip_code>
  // Only consider financial assistance records so zip lists match what the org actually covers
  const orgZipLookup = useMemo(() => {
    if (!orgGroupList) return null;
    const lookup = {};
    orgGroupList.forEach(org => {
      const zips = new Set();
      let hasWildcard = false;
      directory.filter(r => r.status_id === 1 && r.organization === org && finAssistIds.has(r.assist_id)).forEach(r => {
        const cz = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
        if (cz.includes("99999")) hasWildcard = true;
        else cz.forEach(z => zips.add(z));
      });
      lookup[org] = hasWildcard ? null : zips; // null = serves all zips
    });
    return lookup;
  }, [orgGroupList, directory, finAssistIds]);

  // Filter data, split into sections by exclude, sort within each, add section headers
  const sortedData = useMemo(() => {
    if (!zipCodeData || zipCodeData.length === 0) return [];

    // Apply column header filters (county, zip)
    let baseData = zipCodeData;
    if (selectedCounties) {
      baseData = baseData.filter(r => selectedCounties.has(r.county));
    }
    if (selectedZipCodes) {
      baseData = baseData.filter(r => selectedZipCodes.has(r.zip_code));
    }

    // === ORG GROUPING MODE ===
    if (orgGroupList && orgZipLookup) {
      const result = [];
      orgGroupList.forEach(orgName => {
        const orgZips = orgZipLookup[orgName]; // null = all zips (wildcard)
        const orgData = orgZips ? baseData.filter(r => orgZips.has(r.zip_code)) : baseData;
        if (orgData.length === 0) return;

        // Compute org summary from Core Houston Area zips
        const orgCoreZips = orgData.filter(r => r.exclude === 2);
        const orgSummaryRow = orgCoreZips.length > 0
          ? computeSummaryRow(orgCoreZips, NUMERIC_KEYS, orgName, { _isOrgMedian: true, _orgName: orgName }, houstonMedianRow, true)
          : null;

        // Org header
        result.push({ _orgHeader: true, _orgName: orgName });

        // Build sections with org summary and Houston prepended at top of Core Houston
        const sections = buildSections(orgData, { prependRows: [orgSummaryRow, houstonMedianRow] });
        result.push(...sections);
      });
      return result;
    }

    // === FLAT MODE (no org filter) ===
    if (servedZips) {
      baseData = baseData.filter(r => servedZips.has(r.zip_code));
    }
    return buildSections(baseData, { prependRows: [houstonMedianRow] });
  }, [zipCodeData, selectedCounties, selectedZipCodes, servedZips, sortBy, sortDir, houstonMedianRow, sortSection, isTextColumn, orgGroupList, orgZipLookup, buildSections, NUMERIC_KEYS]);

  // Toggle all expand/collapse
  const toggleAllExpanded = useCallback(() => {
    if (allExpanded) {
      setExpandedZips(new Set());
      setAllExpanded(false);
    } else {
      const allZips = new Set(sortedData.filter(r => !r._sectionHeader && !r._orgHeader && !r._isMedian && !r._isOrgMedian && r.zip_code).map(r => r.zip_code));
      setExpandedZips(allZips);
      setAllExpanded(true);
    }
  }, [allExpanded, sortedData]);

  // For CSV download: build visible data including expansion state
  const getDownloadData = useCallback(() => {
    const rows = sortedData.filter(row => !row._sectionHeader && !row._orgHeader).map(row => {
      const base = {};
      COLUMNS.forEach(col => { base[col.label.replace(/\n/g, " ")] = col.format(row[col.key]); });

      // Include financial orgs if row is expanded
      if (row.zip_code && expandedZips.has(row.zip_code)) {
        const orgs = getFinancialOrgsForZip(row.zip_code);
        base["Organizations"] = orgs.map(o => {
          const types = o.assistTypes.map(at => at.assistance).join(", ");
          return `${o.name} (${types})`;
        }).join(" | ");
      } else {
        base["Organizations"] = "";
      }

      return base;
    });
    return rows;
  }, [sortedData, expandedZips, getFinancialOrgsForZip]);

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

  // Generate PDF report: all filtered data with all orgs expanded, score highlights preserved
  // Generate PDF report: landscape, no neighborhood/orgs columns, all filtered data, score highlights preserved
  const SKIP_PDF_FIELDS = new Set(["neighborhood"]);
  const handlePdfDownload = useCallback(async () => {
    if (sortedData.length === 0) return;

    // Filter out neighborhood column for PDF
    const pdfCols = COLUMNS.filter(c => !SKIP_PDF_FIELDS.has(c.key));
    const colCount = pdfCols.length;

    const thCells = pdfCols.map(c =>
      `<th style="background:#B8001F;color:#fff;padding:4px 6px;font-size:10px;border:1px solid #ccc;white-space:nowrap;">${c.label.replace(/\n/g, " ")}</th>`
    ).join("");

    const bodyRows = [];
    sortedData.forEach((row) => {
      if (row._orgHeader) {
        bodyRows.push(`<tr><td colspan="${colCount}" style="background:#E8E0D4;color:#222831;font-weight:bold;padding:4px 10px;font-size:11px;border:1px solid #ccc;">| ${row._orgName}</td></tr>`);
        return;
      }
      if (row._sectionHeader) {
        bodyRows.push(`<tr><td colspan="${colCount}" style="font-weight:bold;padding:6px 10px;font-size:11px;border:1px solid #ccc;">|| ${row._sectionLabel}</td></tr>`);
        return;
      }

      const isMedian = !!row._isMedian;
      const isOrgMedian = !!row._isOrgMedian;
      const isSummaryRow = isMedian || isOrgMedian;
      const rowColor = isMedian ? "#8939ac" : isOrgMedian ? "#1A56DB" : "#222";
      const rowWeight = isSummaryRow ? "bold" : "normal";

      const cells = pdfCols.map(col => {
        const scoreHighlight = DCI_FIELDS.has(col.key) ? getDciHighlight(row.dci_quin)
          : isScoreField(col.key) ? getScoreHighlight(row[col.key])
          : undefined;
        const formatted = col.format(row[col.key]);
        const align = col.isText ? "left" : "right";
        const bg = scoreHighlight ? `background:${scoreHighlight};` : "";
        return `<td style="padding:3px 5px;text-align:${align};font-size:10px;border:1px solid #ddd;color:${rowColor};font-weight:${rowWeight};white-space:nowrap;${bg}">${formatted}</td>`;
      }).join("");

      bodyRows.push(`<tr>${cells}</tr>`);

      // Neighborhood row below each zip code
      if (!isSummaryRow && row.zip_code && row.neighborhood) {
        bodyRows.push(`<tr><td></td><td colspan="${colCount - 1}" style="padding:2px 8px;font-size:9px;border:1px solid #eee;border-top:none;border-bottom:none;background:#FAFAFA;line-height:1.4;"><b style="color:#4A4F56;">Neighborhoods:</b> <span style="color:#555;">${row.neighborhood}</span></td></tr>`);
      }

      // Expanded orgs row below each zip code (always shown in PDF)
      if (!isSummaryRow && row.zip_code) {
        const orgs = getFinancialOrgsForZip(row.zip_code);
        if (orgs.length > 0) {
          const orgsHtml = orgs.map(o => {
            const types = o.assistTypes.map(at => at.assistance).join(", ");
            const nameStyle = highlightedOrgs?.has(o.name) ? "color:#2323ff;font-weight:bold;" : "";
            return `<span style="${nameStyle}">${o.name}</span> <span style="color:#888;">(${types})</span>`;
          }).join(" &nbsp;|&nbsp; ");
          bodyRows.push(`<tr><td></td><td colspan="${colCount - 1}" style="padding:2px 8px 4px;font-size:9px;border:1px solid #eee;border-top:none;background:#F9F9F0;border-left:3px solid #B8001F;line-height:1.5;"><b style="color:#B8001F;">Financial Assistance:</b> ${orgsHtml}</td></tr>`);
        }
      }
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
      table { border-collapse: collapse; width: 100%; }
      .title { font-size: 14px; font-weight: bold; padding: 8px 10px 2px; color: #222831; }
      .subtitle { font-size: 10px; color: #B8001F; font-style: italic; padding: 0 10px 6px; }
    </style></head><body>
      <div class="title">CRG Zip Code Data Report</div>
      <div class="subtitle">All data from 2024 unless stated otherwise &nbsp;|&nbsp; Generated ${dateStr}</div>
      <table><thead><tr>${thCells}</tr></thead><tbody>${bodyRows.join("")}</tbody></table>
    </body></html>`;

    const filename = `CRG - Zip Code Data - ${dateStr}.pdf`;
    const pdfFooter = `<div style="width:100%;padding:10px 0.5in 0 0.5in;font-family:Arial,sans-serif;"><div style="text-align:right;font-size:10px;font-style:italic;color:#666;">Page {{page}} of {{total}}</div></div>`;

    const pdfServiceUrl = window.location.hostname === "localhost"
      ? "http://localhost:8788/createPdf"
      : "/createPdf";

    try {
      const res = await fetch(pdfServiceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          htmlBody,
          filename,
          landscape: true,
          footer: { source: pdfFooter, spacing: "10px" },
          margin: { top: "0.3in", bottom: "0.3in", left: "0.3in", right: "0.3in" },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`PDF creation failed: ${res.status} - ${errorText}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("PDF download error:", err);
    }
  }, [sortedData, COLUMNS, getFinancialOrgsForZip, highlightedOrgs]);

  // Expose download, pdf, and resetFilters to parent via ref
  useImperativeHandle(ref, () => ({
    download: handleDownload,
    downloadPdf: handlePdfDownload,
    resetFilters: () => { setSelectedCounties(null); setSelectedZipCodes(null); setExpandedZips(new Set()); setAllExpanded(false); },
    toggleAllExpanded,
    allExpanded,
  }), [handleDownload, handlePdfDownload, toggleAllExpanded, allExpanded]);

  // Column width tiers for visual symmetry
  // "wide" columns get more space; everything else gets uniform narrow width
  // Zip Code, County, Neighborhood, and Orgs have their own fixed widths
  const WIDE_FIELDS = new Set(["dci_catg"]);
  const getColumnWidth = useCallback((key) => {
    if (key === "zip_code") return "4%";
    if (key === "county") return "6%";
    if (key === "population" || key === "claim_amount") return "4.5%";
    if (key === "neighborhood") return undefined; // takes remaining space
    if (WIDE_FIELDS.has(key)) return "5.5%";
    return "4%"; // standard numeric columns
  }, []);

  // Available values for column header filters
  const allCounties = useMemo(() =>
    [...new Set(zipCodeData.map(r => r.county).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [zipCodeData]
  );
  const allZipCodes = useMemo(() =>
    [...new Set(zipCodeData.map(r => r.zip_code).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [zipCodeData]
  );

  // Sort handler that accepts explicit direction (for ColumnHeaderFilter)
  const handleSortWithDirection = useCallback((column, direction) => {
    setSortBy(column);
    setSortDir(direction);
  }, []);

  if (!zipCodeData || zipCodeData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 font-opensans">
        No zip code data available.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <thead className="sticky top-0 z-10">
          <tr>
            {COLUMNS.map((col) => {
              // County and Zip Code use ColumnHeaderFilter with popover
              const colWidth = getColumnWidth(col.key);
              const baseThStyle = {
                backgroundColor: "#B8001F",
                padding: "6px 8px",
                textAlign: "center",
                fontSize: "12px",
                borderRight: "1px solid rgba(255,255,255,0.15)",
                whiteSpace: "pre-line",
                lineHeight: "1.3",
                width: colWidth,
                overflow: "hidden",
              };
              if (col.key === "county") {
                return (
                  <ColumnHeaderFilter
                    key={col.key}
                    label={col.label}
                    values={allCounties}
                    selectedValues={selectedCounties}
                    onSelectionChange={setSelectedCounties}
                    sortActive={sortBy === col.key}
                    sortDirection={sortBy === col.key ? sortDir : "asc"}
                    onSort={(dir) => handleSortWithDirection(col.key, dir)}
                    thStyle={{
                      ...baseThStyle,
                      fontFamily: "Open Sans, sans-serif",
                      fontWeight: 600,
                      color: "white",
                    }}
                  />
                );
              }
              if (col.key === "zip_code") {
                return (
                  <ColumnHeaderFilter
                    key={col.key}
                    label={col.label}
                    values={allZipCodes}
                    selectedValues={selectedZipCodes}
                    onSelectionChange={setSelectedZipCodes}
                    sortActive={sortBy === col.key}
                    sortDirection={sortBy === col.key ? sortDir : "asc"}
                    onSort={(dir) => handleSortWithDirection(col.key, dir)}
                    thStyle={{
                      ...baseThStyle,
                      fontFamily: "Open Sans, sans-serif",
                      fontWeight: 600,
                      color: "white",
                    }}
                  />
                );
              }
              return (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="font-opensans font-semibold text-white cursor-pointer select-none"
                  style={baseThStyle}
                >
                  {col.label}
                  <SortArrow active={sortBy === col.key} direction={sortBy === col.key ? sortDir : "desc"} />
                </th>
              );
            })}
            {/* Expand/Orgs column header */}
            <th
              className="font-opensans font-semibold text-white select-none"
              style={{
                backgroundColor: "#B8001F",
                padding: "6px 4px",
                textAlign: "center",
                fontSize: "11px",
                whiteSpace: "nowrap",
                width: "70px",
              }}
            >
              Orgs
            </th>
          </tr>
        </thead>
        <tbody>
          {/* "All data from 2024" notice — always first, rendered once */}
          <tr className="bg-white">
            <td
              colSpan={COLUMNS.length + 1}
              className="font-opensans"
              style={{
                color: "#B8001F",
                fontStyle: "italic",
                fontSize: "13px",
                paddingLeft: "10px",
                paddingTop: "8px",
                paddingBottom: "2px",
              }}
            >
              All data from 2024 unless stated otherwise
            </td>
          </tr>
          {sortedData.map((row, idx) => {
            // Organization group header row
            if (row._orgHeader) {
              return (
                <tr key={`org-${row._orgName}`} className="bg-white">
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="font-opensans font-bold"
                    style={{
                      backgroundColor: "#E8E0D4",
                      color: "#222831",
                      paddingLeft: "10px",
                      paddingTop: "4px",
                      paddingBottom: "4px",
                      fontSize: "15px",
                    }}
                  >
                    <span className="inline-flex items-center">
                      <VerticalLineIcon size={18} color="#222831" />
                      {row._orgName}
                    </span>
                  </td>
                </tr>
              );
            }

            // Section header row
            if (row._sectionHeader) {
              return (
                <React.Fragment key={`section-${row._sectionExclude}-${idx}`}>
                <tr className="bg-white">
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="font-opensans font-bold"
                    style={{
                      color: "#222831",
                      paddingLeft: "10px",
                      paddingTop: "8px",
                      fontSize: "15px",
                    }}
                  >
                    <span className="inline-flex items-center">
                      <VerticalLineIcon size={18} color="#222831" />
                      <span style={{ marginLeft: "-4px" }}><VerticalLineIcon size={18} color="#222831" /></span>
                      {row._sectionLabel}
                    </span>
                  </td>
                </tr>
                </React.Fragment>
              );
            }

            const zip = row.zip_code;
            const isMedian = !!row._isMedian;
            const isOrgMedian = !!row._isOrgMedian;
            const isSummaryRow = isMedian || isOrgMedian;
            const isExpanded = !isSummaryRow && expandedZips.has(zip);
            const bgColor = idx % 2 === 0 ? "#FFFFFF" : "#F5F5F5";

            return (
              <React.Fragment key={zip || idx}>
                {/* Data row */}
                <tr
                  className="transition-colors duration-150"
                  style={{ backgroundColor: bgColor }}
                  onMouseEnter={(e) => { if (!isSummaryRow) e.currentTarget.style.backgroundColor = "#f2f3cc"; }}
                  onMouseLeave={(e) => { if (!isSummaryRow) e.currentTarget.style.backgroundColor = bgColor; }}
                >
                  {COLUMNS.map((col, colIdx) => {
                    // Org summary row: span zip_code across zip+county columns, skip county cell
                    if (isOrgMedian && col.key === "county") return null;
                    const colSpan = (isOrgMedian && col.key === "zip_code") ? 2 : undefined;

                    const scoreHighlight = DCI_FIELDS.has(col.key) ? getDciHighlight(row.dci_quin)
                      : isScoreField(col.key) ? getScoreHighlight(row[col.key])
                      : undefined;
                    const formatted = col.format(row[col.key]);
                    const isWideText = col.key === "neighborhood";
                    return (
                      <td
                        key={col.key}
                        colSpan={colSpan}
                        className="font-opensans"
                        style={{
                          padding: "5px 8px",
                          textAlign: col.isText ? "left" : "right",
                          verticalAlign: "middle",
                          borderRight: "1px solid #E5E5E5",
                          whiteSpace: isWideText ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: isWideText ? undefined : "ellipsis",
                          fontSize: isWideText ? "13px" : "15px",
                          color: isMedian ? "#8939ac" : isOrgMedian ? "#1A56DB" : undefined,
                          fontWeight: isSummaryRow ? 600 : 500,
                        }}
                      >
                        {scoreHighlight ? (
                          <span style={{
                            backgroundColor: scoreHighlight,
                            padding: "1px 4px",
                            borderRadius: "3px",
                          }}>
                            {formatted}
                          </span>
                        ) : formatted}
                      </td>
                    );
                  })}
                  {/* More Info / expand toggle */}
                  <td style={{ padding: "4px 6px", verticalAlign: "middle", textAlign: "center" }}>
                    {!isSummaryRow && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(zip); }}
                        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                        style={{ fontSize: "11px", background: "none", border: "none", cursor: "pointer", margin: "0 auto" }}
                      >
                        <span style={{ color: "var(--color-results-expand-chevron)" }}>
                          {isExpanded ? "Less" : "More"}
                        </span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--color-results-expand-chevron)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        >
                          <polyline points="6 7 12 13 18 7" />
                          <polyline points="6 13 12 19 18 13" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
                {/* Expanded row: all financial orgs with assist type icons */}
                {isExpanded && (
                  <tr style={{ backgroundColor: bgColor }}>
                    <td style={{ borderRight: "1px solid #E5E5E5" }} />
                    <td
                      colSpan={COLUMNS.length}
                      style={{
                        padding: "4px 8px 8px",
                        fontSize: "13px",
                        lineHeight: "1.6",
                      }}
                    >
                      <div style={{
                        padding: "6px 10px",
                        backgroundColor: "#F9F9F0",
                        borderRadius: "4px",
                        borderLeft: `3px solid ${ICON_ACTIVE_COLOR}`,
                      }}>
                        <span style={{ fontWeight: 600, color: ICON_ACTIVE_COLOR, fontSize: "13px" }}>
                          Financial Assistance:
                        </span>{" "}
                        {(() => {
                          const orgs = getFinancialOrgsForZip(zip);
                          if (orgs.length === 0) return <span style={{ color: "#999", fontStyle: "italic" }}>No organizations found</span>;
                          return orgs.map((org, orgIdx) => (
                            <span key={org.name}>
                              <span
                                className="font-opensans"
                                style={{
                                  color: highlightedOrgs?.has(org.name) ? "#2323ff" : undefined,
                                  fontWeight: highlightedOrgs?.has(org.name) ? 600 : undefined,
                                }}
                              >
                                {org.name}
                              </span>
                              {/* Assist type icons after org name */}
                              {org.assistTypes.map(at => {
                                const iconResult = getIconByName(at.icon);
                                const IconComp = Array.isArray(iconResult) ? iconResult[0] : iconResult;
                                return IconComp ? (
                                  <span key={at.assist_id} className="inline-flex" style={{ color: ICON_ACTIVE_COLOR, marginLeft: "3px", verticalAlign: "middle" }}>
                                    <IconComp size={14} />
                                  </span>
                                ) : null;
                              })}
                              {orgIdx < orgs.length - 1 && (
                                <span style={{ color: "#CCCCCC", margin: "0 4px" }}>|</span>
                              )}
                            </span>
                          ));
                        })()}
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
