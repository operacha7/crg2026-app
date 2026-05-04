// src/components/reports/ZipCodeDataReport.js
// Displays zip code data table with distress, working poor, eviction,
// and census data by zip code.
//
// Two top-level groups: "Distress Score Calculated" (distress_score != null) and
// "Distress Score Not Calculated" (the rest). Default sort (when the user hasn't
// clicked a column) is compound: county asc, then distress_score desc in the
// Calculated group and zip_code asc in the Not Calculated group.
//
// In default-sort mode, the Calculated group also shows a Houston Overall median
// at the top and a per-county median at the top of each county block (Available
// Funds / zip_fin_funding is intentionally blank in those summary rows).
//
// Click cycle on sortable column headers: asc → desc → default.

import React, { useState, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { useAppData } from "../../Contexts/AppDataContext";
import { getIconByName } from "../../icons/iconMap";
import VerticalLineIcon from "../../icons/VerticalLineIcon";
import ColumnHeaderFilter from "../ColumnHeaderFilter";
import SortIcon from "../../icons/SortIcons";
import { matchesParentOrSubgroup } from "../../utils/orgFilters";

// Format helpers mapped by config format string
// `percentage`: values are stored as fractions in zip_code_data (e.g. 0.194 for
// 19.4%), so we multiply by 100 and append "%". Always one decimal place.
const FORMAT_MAP = {
  text: (v) => v ?? "—",
  one_decimal: (v) => (v == null || v === "") ? "—" : Number(v).toFixed(1),
  two_decimal: (v) => (v == null || v === "") ? "—" : Number(v).toFixed(2),
  whole_number: (v) => (v == null || v === "") ? "—" : Math.round(Number(v)).toLocaleString(),
  whole_dollar: (v) => (v == null || v === "") ? "—" : "$" + Math.round(Number(v)).toLocaleString(),
  percentage: (v) => (v == null || v === "") ? "—" : (Number(v) * 100).toFixed(1) + "%",
};

function getFormatter(formatStr) {
  return FORMAT_MAP[formatStr] || FORMAT_MAP.text;
}

// Score highlight: applies to fields containing "score" in the name (dynamic, config-driven)
function isScoreField(fieldName) {
  return fieldName && fieldName.includes("score");
}
function getScoreHighlight(value) {
  if (value == null || value === "") return undefined;
  const v = Number(value);
  if (v >= 80) return "rgba(220, 40, 40, 0.40)";     // red (80-100)
  if (v >= 60) return "rgba(240, 150, 30, 0.40)";    // orange (60-80)
  if (v >= 40) return "rgba(230, 200, 50, 0.40)";    // yellow (40-60)
  if (v >= 20) return "rgba(80, 170, 80, 0.40)";     // green (20-40)
  if (v >= 0)  return "rgba(66, 133, 244, 0.40)";    // blue (0-20)
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

// Top-level section headers — split by whether distress_score is populated
const SECTION_HEADERS = {
  calculated: "Distress Score Calculated",
  notCalculated: "Distress Score Not Calculated",
};

// Keys intentionally left blank on summary rows — aggregating them across
// zips would be misleading (e.g. Available Funds is a per-zip allocation,
// not something that sums or averages meaningfully at the metro level).
const MEDIAN_SKIP_KEYS = new Set(["zip_fin_funding"]);

// Field-level aggregation rules for summary rows. Anything not listed here
// defaults to "median" (true median across the row set, with null values
// filtered per-field).
const FIELD_AGG = {
  population: "sum",
  households: "sum",
  filings_count: "sum",
  claim_amount: "sum",
  amount_per_filing: "calculated",  // sum(claim_amount) / sum(filings_count)
  income_ratio: "calculated",       // summary.median_household_income / houston.median_household_income
  dci_quin: "derived",              // from median dci_score
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

// Compute a summary row (Houston Overall, per-county, or per-org).
//
// Semantics:
//   - Fields flagged "sum" in FIELD_AGG get a straight sum (nulls skipped).
//   - Fields flagged "calculated" are derived in pass 2 from the sums/medians.
//   - Fields flagged "derived" are derived in pass 3.
//   - Everything else gets a true median of per-zip values (nulls skipped per-field).
//
// rows        — zip rows to aggregate
// numericKeys — all visible numeric fields (from header_config)
// label       — placeholder for the zip_code cell (caller overrides for clarity)
// marker      — marker props for the row (e.g. { _isMedian, _isCountyMedian, ... })
// houstonRow  — Houston Overall summary, used as the denominator for income_ratio.
//               Pass null when computing Houston Overall itself — the function
//               then uses summaryRow's own income as the denominator, so the
//               ratio naturally resolves to 1.00 without any hardcoding.
function computeSummaryRow(rows, numericKeys, label, marker, houstonRow) {
  const summaryRow = { zip_code: label, county: "", neighborhood: "", ...marker };

  const toNumbers = (key) => rows
    .map(r => r[key])
    .filter(v => v != null && v !== "")
    .map(Number)
    .filter(n => !Number.isNaN(n));

  const sum = (key) => {
    const values = toNumbers(key);
    return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
  };

  const trueMedian = (key) => {
    const values = toNumbers(key).sort((a, b) => a - b);
    if (values.length === 0) return null;
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
  };

  // Pass 1: sums and medians
  numericKeys.forEach(key => {
    const agg = FIELD_AGG[key] || "median";
    if (agg === "calculated" || agg === "derived") return;
    if (agg === "sum") {
      summaryRow[key] = sum(key);
    } else {
      summaryRow[key] = trueMedian(key);
    }
  });

  // Pass 2: calculated fields
  // amount_per_filing = total claim amount / total filings count
  summaryRow.amount_per_filing = (summaryRow.claim_amount != null && summaryRow.filings_count)
    ? summaryRow.claim_amount / summaryRow.filings_count
    : null;

  // income_ratio = this row's median income / Houston's median income.
  // For Houston Overall itself, houstonRow is null → denominator = this row's
  // own income → ratio = 1.00 by definition, no hardcoding.
  const denom = houstonRow ? houstonRow.median_household_income : summaryRow.median_household_income;
  summaryRow.income_ratio = (denom != null && denom !== 0 && summaryRow.median_household_income != null)
    ? summaryRow.median_household_income / denom
    : null;

  // Pass 3: derived
  summaryRow.dci_quin = dciQuinFromScore(summaryRow.dci_score);
  summaryRow.dci_catg = summaryRow.dci_quin != null ? (DCI_CATG_LABELS[summaryRow.dci_quin] || "") : "";

  // Blank keys (don't aggregate)
  MEDIAN_SKIP_KEYS.forEach(key => { summaryRow[key] = null; });

  return summaryRow;
}

// Active icon color when clicked/filtered
const ICON_ACTIVE_COLOR = "#B8001F";


const ZipCodeDataReport = forwardRef(function ZipCodeDataReport({ counties, parentOrg, organization }, ref) {
  const { zipCodeData, directory, assistance, headerConfig } = useAppData();

  // Internal filter state (null = no filter). Only Map Code has a popover —
  // County and Zip Code are plain sortable headers now.
  const [selectedMapCodes, setSelectedMapCodes] = useState(null);

  // Clear map-code filter when parent, child org, or county selection changes
  useEffect(() => {
    setSelectedMapCodes(null);
  }, [parentOrg, organization, counties]);

  // Whether the user has an active county filter (Set of selected county names)
  const hasCountyFilter = counties instanceof Set && counties.size > 0;

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

  // Sort state. Default (sortBy === null) renders rows by distress_score desc
  // with no column highlighted — matches the neutral bars icon in headers.
  // Click cycle depends on column type:
  //   numeric: desc → asc → default
  //   text:    asc  → desc → default
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState(null);

  // Expand state: Set of expanded zip codes (supports expand all)
  const [expandedZips, setExpandedZips] = useState(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  // Set of assist_ids we filter orgs to: Rent + Utilities only.
  // This report is scoped to rent/utilities providers — the grayed-out chips
  // in NavBar2Reports show the user which types are being filtered to.
  const finAssistIds = useMemo(() => {
    return new Set(
      assistance
        .filter(a => a.assistance === "Rent" || a.assistance === "Utilities")
        .map(a => a.assist_id)
    );
  }, [assistance]);

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
      if (!cz.includes(zip)) return;
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
    if (parentOrg) filtered = filtered.filter(r => matchesParentOrSubgroup(r, parentOrg));
    if (hasOrgFilter) filtered = filtered.filter(r => organization.has(r.organization));

    const zips = new Set();
    filtered.forEach(r => {
      const cz = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      cz.forEach(z => zips.add(z));
    });

    return zips;
  }, [directory, parentOrg, organization, finAssistIds]);

  // Build set of org names to highlight in expanded rows (based on parent/org filter)
  const highlightedOrgs = useMemo(() => {
    if (!parentOrg && !hasOrgFilter) return null;
    let filtered = directory.filter(r => r.status_id === 1 && finAssistIds.has(r.assist_id));
    if (parentOrg) filtered = filtered.filter(r => matchesParentOrSubgroup(r, parentOrg));
    if (hasOrgFilter) filtered = filtered.filter(r => organization.has(r.organization));
    return new Set(filtered.map(r => r.organization).filter(Boolean));
  }, [directory, parentOrg, organization, finAssistIds]);

  // Numeric column keys for median calculation
  // Numeric keys for median calculation (all non-text visible columns)
  const NUMERIC_KEYS = useMemo(() => COLUMNS.filter(c => !c.isText).map(c => c.key), [COLUMNS]);

  // Check if a column is text-type based on config
  const isTextColumn = useCallback((fieldName) => {
    const colConfig = COLUMNS.find(c => c.key === fieldName);
    return colConfig ? colConfig.isText : false;
  }, [COLUMNS]);

  // Click cycle:
  //   numeric column: first click → desc, second → asc, third → default (null)
  //   text    column: first click → asc,  second → desc, third → default (null)
  const handleSort = useCallback((column) => {
    const textCol = isTextColumn(column);
    if (sortBy !== column) {
      setSortBy(column);
      setSortDir(textCol ? "asc" : "desc");
      return;
    }
    // Same column clicked again — advance the cycle.
    if (textCol && sortDir === "asc") setSortDir("desc");
    else if (!textCol && sortDir === "desc") setSortDir("asc");
    else { setSortBy(null); setSortDir(null); }
  }, [sortBy, sortDir, isTextColumn]);

  // Houston Overall summary — median of all zips in the table (nulls filtered
  // per-field). Always computed from the full dataset, not the filtered view.
  const houstonMedianRow = useMemo(() => {
    if (!zipCodeData || zipCodeData.length === 0) return null;
    const row = computeSummaryRow(zipCodeData, NUMERIC_KEYS, "Greater Houston Overall",
      { _isMedian: true, _isHoustonMedian: true }, null);
    if (row) { row.county = ""; row.zip_code = "Greater Houston Overall"; }
    return row;
  }, [zipCodeData, NUMERIC_KEYS]);

  // Per-county summary rows. One median per county that has at least one
  // scored zip (so the median always lands in the Calculated group when
  // sorted). The median itself uses all zips in that county — nulls are
  // filtered per-field inside computeSummaryRow.
  // When a county filter is active, only emit medians for selected counties.
  const countySummaryRows = useMemo(() => {
    if (!zipCodeData || zipCodeData.length === 0) return [];
    const byCounty = new Map();
    zipCodeData.forEach(r => {
      const c = r.county || "";
      if (!c) return;
      if (hasCountyFilter && !counties.has(c)) return;
      if (!byCounty.has(c)) byCounty.set(c, []);
      byCounty.get(c).push(r);
    });
    const result = [];
    byCounty.forEach((rows, countyName) => {
      if (!rows.some(r => r.distress_score != null)) return;
      const med = computeSummaryRow(rows, NUMERIC_KEYS, "Median",
        { _isMedian: true, _isCountyMedian: true, _medianCounty: countyName }, houstonMedianRow);
      if (med) {
        // Keep the county name on the row for sort-by-county stability,
        // but the rendered label lives in zip_code spanning both columns
        // (matches Greater Houston Overall). The county cell is skipped
        // during render via the spanned-label branch.
        med.county = countyName;
        med.zip_code = `${countyName} County`;
        result.push(med);
      }
    });
    return result;
  }, [zipCodeData, NUMERIC_KEYS, houstonMedianRow, hasCountyFilter, counties]);

  // Two-key compare: primary sortBy/sortDir, with distress_score desc as the
  // implicit secondary key. Secondary is skipped when primary IS distress_score.
  // Nulls always sort to the end regardless of direction.
  const compareField = useCallback((a, b, key, dir) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (isTextColumn(key)) {
      const cmp = String(aVal).localeCompare(String(bVal));
      return dir === "asc" ? cmp : -cmp;
    }
    const cmp = Number(aVal) - Number(bVal);
    return dir === "asc" ? cmp : -cmp;
  }, [isTextColumn]);

  const compoundSort = useCallback((data) => {
    // Default state (no column explicitly sorted): flat distress_score desc.
    if (sortBy == null) {
      return [...data].sort((a, b) => compareField(a, b, "distress_score", "desc"));
    }
    return [...data].sort((a, b) => {
      const primaryCmp = compareField(a, b, sortBy, sortDir);
      if (primaryCmp !== 0 || sortBy === "distress_score") return primaryCmp;
      return compareField(a, b, "distress_score", "desc");
    });
  }, [sortBy, sortDir, compareField]);

  // Build the report sections. Summary rows (Houston Overall, county medians,
  // optional org summary) are merged into the Calculated group and sort
  // alongside data rows — they are NOT pinned to the top.
  const buildSections = useCallback((data, { summaryRows = [] } = {}) => {
    const calcData = data.filter(r => r.distress_score != null);
    const notCalcData = data.filter(r => r.distress_score == null);

    const allCalc = [...summaryRows, ...calcData];
    const sortedCalc = compoundSort(allCalc);
    const sortedNotCalc = compoundSort(notCalcData);

    const result = [];
    if (sortedCalc.length > 0) {
      result.push({ _sectionHeader: true, _sectionLabel: SECTION_HEADERS.calculated, _sectionKey: "calculated" });
      result.push(...sortedCalc);
    }
    if (sortedNotCalc.length > 0) {
      result.push({ _sectionHeader: true, _sectionLabel: SECTION_HEADERS.notCalculated, _sectionKey: "notCalculated" });
      result.push(...sortedNotCalc);
    }
    return result;
  }, [compoundSort]);

  // Determine list of child orgs for grouping (when parent or org filter is active)
  // Filter by finAssistIds so parent org produces same org list as the Organization dropdown
  const orgGroupList = useMemo(() => {
    if (!parentOrg && !hasOrgFilter) return null;
    let filtered = directory.filter(r => r.status_id === 1 && finAssistIds.has(r.assist_id));
    if (parentOrg) filtered = filtered.filter(r => matchesParentOrSubgroup(r, parentOrg));
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
      directory.filter(r => r.status_id === 1 && r.organization === org && finAssistIds.has(r.assist_id)).forEach(r => {
        const cz = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
        cz.forEach(z => zips.add(z));
      });
      lookup[org] = zips;
    });
    return lookup;
  }, [orgGroupList, directory, finAssistIds]);

  // Top-level sorted data. Summary rows (Houston Overall + per-county medians,
  // or in org mode per-org + Houston) are passed to buildSections as data and
  // sort inline with everything else.
  const sortedData = useMemo(() => {
    if (!zipCodeData || zipCodeData.length === 0) return [];

    let baseData = zipCodeData;
    if (hasCountyFilter) {
      baseData = baseData.filter(r => counties.has(r.county));
    }
    if (selectedMapCodes) {
      baseData = baseData.filter(r => selectedMapCodes.has(String(r.bivariate_map_code)));
    }

    // === ORG GROUPING MODE ===
    if (orgGroupList && orgZipLookup) {
      const result = [];
      orgGroupList.forEach(orgName => {
        const orgZips = orgZipLookup[orgName];
        const orgData = orgZips ? baseData.filter(r => orgZips.has(r.zip_code)) : baseData;
        if (orgData.length === 0) return;

        const orgSummaryRow = orgData.some(r => r.distress_score != null)
          ? computeSummaryRow(orgData, NUMERIC_KEYS, orgName, { _isOrgMedian: true, _orgName: orgName }, houstonMedianRow)
          : null;

        result.push({ _orgHeader: true, _orgName: orgName });
        const summaryRowsForOrg = [orgSummaryRow, houstonMedianRow].filter(Boolean);
        const sections = buildSections(orgData, { summaryRows: summaryRowsForOrg });
        result.push(...sections);
      });
      return result;
    }

    // === FLAT MODE (no org filter) ===
    if (servedZips) {
      baseData = baseData.filter(r => servedZips.has(r.zip_code));
    }
    const summaries = [houstonMedianRow, ...countySummaryRows].filter(Boolean);
    return buildSections(baseData, { summaryRows: summaries });
  }, [zipCodeData, selectedMapCodes, servedZips, houstonMedianRow, countySummaryRows, orgGroupList, orgZipLookup, buildSections, NUMERIC_KEYS, hasCountyFilter, counties]);

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
      let rowColor = "#222";
      if (row._isHoustonMedian) rowColor = "#005C72";
      else if (row._isCountyMedian) rowColor = "#8939ac";
      else if (isOrgMedian) rowColor = "#1A56DB";
      const rowWeight = isSummaryRow ? "bold" : "normal";

      const isSpannedLabelRow = row._isHoustonMedian || row._isCountyMedian || isOrgMedian;
      const cells = pdfCols.map(col => {
        if (isSpannedLabelRow && col.key === "county") return null;
        const spanAttr = (isSpannedLabelRow && col.key === "zip_code") ? ' colspan="2"' : '';
        const scoreHighlight = DCI_FIELDS.has(col.key) ? getDciHighlight(row.dci_quin)
          : isScoreField(col.key) ? getScoreHighlight(row[col.key])
          : undefined;
        const formatted = col.format(row[col.key]);
        const align = col.isText ? "left" : "right";
        const bg = scoreHighlight ? `background:${scoreHighlight};` : "";
        return `<td${spanAttr} style="padding:3px 5px;text-align:${align};font-size:10px;border:1px solid #ddd;color:${rowColor};font-weight:${rowWeight};white-space:nowrap;${bg}">${formatted}</td>`;
      }).filter(Boolean).join("");

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
      <div class="subtitle">Evictions data for 12 months ending April 2026. All other data from 2025 unless stated otherwise. &nbsp;|&nbsp; Generated ${dateStr}</div>
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
    resetFilters: () => {
      setSelectedMapCodes(null);
      setSortBy("county");
      setSortDir("asc");
      setExpandedZips(new Set());
      setAllExpanded(false);
    },
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

  // Available values for the Map Code filter popover (the only remaining filter)
  const allMapCodes = useMemo(() =>
    [...new Set(zipCodeData.map(r => r.bivariate_map_code != null ? String(r.bivariate_map_code) : null).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [zipCodeData]
  );

  // Sort handler accepting an explicit direction (used by the Map Code popover
  // buttons). Clicking the already-active direction clears the sort back to
  // the default (no explicit column → flat distress_score desc).
  const handleSortWithDirection = useCallback((column, direction) => {
    if (sortBy === column && sortDir === direction) {
      setSortBy(null);
      setSortDir(null);
    } else {
      setSortBy(column);
      setSortDir(direction);
    }
  }, [sortBy, sortDir]);

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
              if (col.key === "bivariate_map_code") {
                return (
                  <ColumnHeaderFilter
                    key={col.key}
                    label={col.label}
                    values={allMapCodes}
                    selectedValues={selectedMapCodes}
                    onSelectionChange={setSelectedMapCodes}
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
                  <SortIcon active={sortBy === col.key} direction={sortBy === col.key ? sortDir : "asc"} size={12} />
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
              Evictions data for 12 months ending April 2026. All other data from 2024 unless stated otherwise.
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
                <React.Fragment key={`section-${row._sectionKey}-${idx}`}>
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

            // Unique key per row. Plain zip_code isn't enough because every
            // county median uses zip_code="Median" — all 15+ rows would share
            // the same key and React would mis-reconcile on sort.
            const rowKey = row._isHoustonMedian
              ? "summary-houston-overall"
              : row._isCountyMedian
              ? `summary-county-${row._medianCounty}`
              : row._isOrgMedian
              ? `summary-org-${row._orgName}`
              : `zip-${zip}-${idx}`;

            // Summary-row text color:
            //   Greater Houston Overall → teal (#005C72)
            //   per-county median       → purple (#8939ac)
            //   per-org median          → blue (#1A56DB)
            let summaryColor;
            if (row._isHoustonMedian) summaryColor = "#005C72";
            else if (row._isCountyMedian) summaryColor = "#8939ac";
            else if (isOrgMedian) summaryColor = "#1A56DB";

            return (
              <React.Fragment key={rowKey}>
                {/* Data row */}
                <tr
                  className="transition-colors duration-150"
                  style={{ backgroundColor: bgColor }}
                  onMouseEnter={(e) => { if (!isSummaryRow) e.currentTarget.style.backgroundColor = "#f2f3cc"; }}
                  onMouseLeave={(e) => { if (!isSummaryRow) e.currentTarget.style.backgroundColor = bgColor; }}
                >
                  {COLUMNS.map((col, colIdx) => {
                    // Houston Overall and Org summary rows: span the zip_code label
                    // across zip+county columns; skip the county cell.
                    const isSpannedLabelRow = isOrgMedian || row._isHoustonMedian || row._isCountyMedian;
                    if (isSpannedLabelRow && col.key === "county") return null;
                    const colSpan = (isSpannedLabelRow && col.key === "zip_code") ? 2 : undefined;

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
                          color: summaryColor,
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
