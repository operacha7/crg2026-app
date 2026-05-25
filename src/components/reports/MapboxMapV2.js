// src/components/reports/MapboxMapV2.js
// V2 of the Zip Code Maps view. Controls live in ReportsSidebarV2 (left rail),
// not in an in-canvas dropdown. Driven by a single `viewMode` prop:
//   - "distress"                        → distress base map
//   - "evictions"                       → evictions base map
//   - "service_pins"                    → blank map + org pins for selected assistance
//   - "service_coverage"                → choropleth: # of orgs serving each zip
//   - "distress_coverage_bivariate"     → 3×3 bivariate of distress × coverage
//   - "evictions_coverage_bivariate"    → 3×3 bivariate of evictions × coverage
// Internally translates v2 viewMode into the legacy isBaseView/displayMetric
// machinery so most of the original rendering code keeps working unchanged.

// Both bivariate metrics share the same render path (3×3 grid, same palette,
// same code field on features); only the Y-axis data source differs. This
// helper is the single source of truth so the metric set can grow without
// scattering string-equality checks across the file.
function isCoverageBivariate(metric) {
  return metric === "distress_coverage_bivariate" || metric === "evictions_coverage_bivariate";
}

import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import MapGL, { Source, Layer, Marker, NavigationControl } from "react-map-gl/mapbox";
import { useAppData } from "../../Contexts/AppDataContext";
import { MapPinIcon } from "../../icons/MapPinIcon";
import { matchesParentOrSubgroup } from "../../utils/orgFilters";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const HOUSTON_CENTER = { longitude: -95.37, latitude: 29.76 };
const DEFAULT_ZOOM = 9.5;

// Parent coverage color - blue for served zips (related to child teal, distinct from distress)
const PARENT_COVERAGE_COLOR = "rgba(0, 28, 168, 0.5)"; // medium blue at 35%

// Distress colors - 5 quintile bands: blue → green → yellow → orange → red
const DISTRESS_BLUE = "rgba(66, 133, 244, 0.30)";    // q1: 0-20 (calm blue - most prosperous)
const DISTRESS_GREEN = "rgba(76, 175, 80, 0.30)";    // q2: 20-40 (green)
const DISTRESS_YELLOW = "rgba(255, 213, 0, 0.35)";   // q3: 40-60 (yellow)
const DISTRESS_ORANGE = "rgba(245, 124, 0, 0.42)";   // q4: 60-80 (orange)
const DISTRESS_RED = "rgba(220, 50, 50, 0.50)";      // q5: 80-100 (red - most distressed)

// Working poor colors - same 5 quintile bands as distress (blue → green → yellow → orange → red)
const WP_BAND_1 = DISTRESS_BLUE;
const WP_BAND_2 = DISTRESS_GREEN;
const WP_BAND_3 = DISTRESS_YELLOW;
const WP_BAND_4 = DISTRESS_ORANGE;
const WP_BAND_5 = DISTRESS_RED;

// Evictions colors - same 5 quintile bands as distress (blue → green → yellow → orange → red)
const EV_BAND_1 = DISTRESS_BLUE;
const EV_BAND_2 = DISTRESS_GREEN;
const EV_BAND_3 = DISTRESS_YELLOW;
const EV_BAND_4 = DISTRESS_ORANGE;
const EV_BAND_5 = DISTRESS_RED;

// V2 service-coverage colors. Convention matches every other Reports map:
// 0 = good (well-served, blue), 100 = bad (underserved, red). The coverage
// score is computed as an inverse rank-percentile of org count, so high
// score = few orgs = worst. Uses the shared distress palette so the
// Conditions and Resources maps read identically.
const COV_BAND_1 = DISTRESS_BLUE;   // 0-20   → most orgs (best, lowest coverage gap)
const COV_BAND_2 = DISTRESS_GREEN;  // 20-40
const COV_BAND_3 = DISTRESS_YELLOW; // 40-60
const COV_BAND_4 = DISTRESS_ORANGE; // 60-80
const COV_BAND_5 = DISTRESS_RED;    // 80-100 → fewest orgs (worst, highest gap)

// Plain-English label for each Distress × Service Coverage bivariate cell.
// Code reads (distress)(gap): 1 = low, 2 = mid, 3 = high. 33 (top-right) is
// the priority corner — high distress with few providers serving the zip.
// Mirrors the BIVARIATE_LABELS pattern used by the Distress vs. Funding map.
const COVERAGE_BIVARIATE_LABELS = {
  "33": "Critical Priority — High distress with few providers",
  "32": "High Priority — High distress with moderate coverage",
  "31": "Well-Resourced Despite Stress — High distress with many providers",
  "23": "Emerging Gap — Moderate distress with few providers",
  "22": "Mid-Range — Balanced distress and coverage",
  "21": "Tracking — Moderate distress with many providers",
  "13": "Possible Reallocation — Low distress with few providers",
  "12": "Mild Gap — Low distress with moderate coverage",
  "11": "Baseline — Low distress, well-served",
};

// Textbook two-hue Stevens bivariate palette: red (distress) × blue (X-axis)
// blending through purple. Worst corner is 33 (high/high). Shared by both
// bivariate maps: FVI (X = children %) and Distress vs. Funding (X = funding gap).
// Rows = distress (low→high), columns = X-axis (low→high).
const FAM_11 = "rgba(232, 232, 232, 0.45)";   // low / low — near-white (baseline)
const FAM_12 = "rgba(190, 215, 230, 0.55)";   // low distress, mid children — pale blue
const FAM_13 = "rgba(95, 165, 215, 0.65)";    // low distress, high children — saturated blue
const FAM_21 = "rgba(230, 195, 210, 0.55)";   // mid distress, low children — pale pink
const FAM_22 = "rgba(180, 165, 195, 0.55)";   // mid / mid — muted gray-purple
const FAM_23 = "rgba(130, 130, 195, 0.65)";   // mid distress, high children — blue-purple
const FAM_31 = "rgba(220, 110, 140, 0.65)";   // high distress, low children — saturated red/pink
const FAM_32 = "rgba(170, 95, 155, 0.65)";    // high distress, mid children — red-purple
const FAM_33 = "rgba(110, 50, 130, 0.78)";    // high distress + high children — dark purple (worst)

// Friendly labels for each family-bivariate cell — shown in the info box when a
// zip is clicked. Code reads (distress)(children%): 1=low, 2=mid, 3=high.
// Edit these strings to refine wording without touching component logic.
const FAMILY_BIVARIATE_LABELS = {
  "33": "Critical for Families — High distress, many households with children",
  "32": "High Family Priority — High distress with moderate share of children",
  "31": "Adult-Heavy Distress — High distress, few children (target adult/senior services here)",
  "23": "Emerging Family Need — Moderate distress, many households with children",
  "22": "Mid-Range — Mid distress, mid share of children",
  "21": "Mixed Adult Concern — Moderate distress, few children",
  "13": "Family-Rich, Stable — Low distress, many households with children",
  "12": "Mild — Low distress with moderate share of children",
  "11": "Baseline — Low distress, few children",
};

// Solid-color version of the FAM_* palette (legend swatches + info box swatch).
// Kept in sync with the legend grid; if you change one, change the other.
const FAMILY_BIVARIATE_LEGEND_COLORS = {
  "31": "#DC6E8C", "32": "#AA5F9B", "33": "#6E3282",
  "21": "#E6C3D2", "22": "#B4A5C3", "23": "#8282C3",
  "11": "#E8E8E8", "12": "#BED7E6", "13": "#5FA5D7",
};

// Per-band interpretation for the FVI choropleth, shown in the info box
// directly under the FVI score. Bands match the 5 quintile cutoffs (0/20/40/60/80).
// Edit wording here without touching component logic.
const FVI_QUINTILE_LABELS = {
  5: "Critical for Families — High distress combined with many family households (priority for Mother & Child, Education-Children, and other family-focused programs)",
  4: "Elevated — Significant distress with notable family presence",
  3: "Moderate — Mid-range distress and family presence",
  2: "Low — Modest distress, limited family vulnerability",
  1: "Baseline — Low distress and/or few family households",
};

// Maps a 0–100 FVI score to its quintile band (1–5). null/undefined → null.
function getFviQuintileLabel(score) {
  if (score == null || isNaN(Number(score))) return null;
  const s = Number(score);
  if (s >= 80) return FVI_QUINTILE_LABELS[5];
  if (s >= 60) return FVI_QUINTILE_LABELS[4];
  if (s >= 40) return FVI_QUINTILE_LABELS[3];
  if (s >= 20) return FVI_QUINTILE_LABELS[2];
  return FVI_QUINTILE_LABELS[1];
}

// Unified fill layer - one color per zip at any given time
// Priority: childHighlighted (teal) > base highlight > hover > [parent coverage in filter view] > metric colors
// Uses feature-state for interactive states, GeoJSON property "density" for parent coverage
function getUnifiedFillStyle(metric = "distress", showParentCoverage = true, showInteractiveHighlights = true) {
  // Build metric color expression based on active metric
  let metricExpression;
  if (metric === "working_poor") {
    // 5 quintile bands based on working_poor_score (0-100 scale, -1 = no data)
    metricExpression = [
      [">=", ["coalesce", ["get", "working_poor_score"], -1], 80], WP_BAND_5,
      [">=", ["coalesce", ["get", "working_poor_score"], -1], 60], WP_BAND_4,
      [">=", ["coalesce", ["get", "working_poor_score"], -1], 40], WP_BAND_3,
      [">=", ["coalesce", ["get", "working_poor_score"], -1], 20], WP_BAND_2,
      [">=", ["coalesce", ["get", "working_poor_score"], -1], 0],  WP_BAND_1,
    ];
  } else if (metric === "evictions") {
    // 5 equal-interval bands on evictions_score (0-100 scale, -1 = no data).
    metricExpression = [
      [">=", ["coalesce", ["get", "evictions_score"], -1], 80], EV_BAND_5,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 60], EV_BAND_4,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 40], EV_BAND_3,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 20], EV_BAND_2,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 0],  EV_BAND_1,
    ];
  } else if (metric === "family_vulnerability") {
    // 5 quintile bands based on family_vulnerability_index (0-100, -1 = no data).
    // Uses distress palette (blue→red) so the FVI choropleth reads as low→high.
    metricExpression = [
      [">=", ["coalesce", ["get", "fvi_score"], -1], 80], DISTRESS_RED,
      [">=", ["coalesce", ["get", "fvi_score"], -1], 60], DISTRESS_ORANGE,
      [">=", ["coalesce", ["get", "fvi_score"], -1], 40], DISTRESS_YELLOW,
      [">=", ["coalesce", ["get", "fvi_score"], -1], 20], DISTRESS_GREEN,
      [">=", ["coalesce", ["get", "fvi_score"], -1], 0],  DISTRESS_BLUE,
    ];
  } else if (metric === "family_bivariate") {
    // 3x3 bivariate choropleth: distress × households_w_children, bright palette
    metricExpression = [
      ["==", ["get", "family_bivariate_code"], "33"], FAM_33,
      ["==", ["get", "family_bivariate_code"], "32"], FAM_32,
      ["==", ["get", "family_bivariate_code"], "31"], FAM_31,
      ["==", ["get", "family_bivariate_code"], "23"], FAM_23,
      ["==", ["get", "family_bivariate_code"], "22"], FAM_22,
      ["==", ["get", "family_bivariate_code"], "21"], FAM_21,
      ["==", ["get", "family_bivariate_code"], "13"], FAM_13,
      ["==", ["get", "family_bivariate_code"], "12"], FAM_12,
      ["==", ["get", "family_bivariate_code"], "11"], FAM_11,
    ];
  } else if (metric === "funding_level") {
    // 5 quintile bands based on zip_fin_fund_score (0-100 scale, same colors as distress)
    // Score of 0 = no funding → stays white/transparent (not colored)
    metricExpression = [
      [">=", ["coalesce", ["get", "funding_score"], -1], 80], DISTRESS_RED,
      [">=", ["coalesce", ["get", "funding_score"], -1], 60], DISTRESS_ORANGE,
      [">=", ["coalesce", ["get", "funding_score"], -1], 40], DISTRESS_YELLOW,
      [">=", ["coalesce", ["get", "funding_score"], -1], 20], DISTRESS_GREEN,
      [">",  ["coalesce", ["get", "funding_score"], -1], 0],  DISTRESS_BLUE,
    ];
  } else if (metric === "efficiency_ratio") {
    // 5 equal-interval bands on normal_efficiency_ratio (0-100 scale).
    // Score of 0 stays transparent (matches funding map convention).
    metricExpression = [
      [">=", ["coalesce", ["get", "efficiency_score"], -1], 80], DISTRESS_RED,
      [">=", ["coalesce", ["get", "efficiency_score"], -1], 60], DISTRESS_ORANGE,
      [">=", ["coalesce", ["get", "efficiency_score"], -1], 40], DISTRESS_YELLOW,
      [">=", ["coalesce", ["get", "efficiency_score"], -1], 20], DISTRESS_GREEN,
      [">",  ["coalesce", ["get", "efficiency_score"], -1], 0],  DISTRESS_BLUE,
    ];
  } else if (metric === "no_base_map") {
    metricExpression = [];
  } else if (metric === "service_coverage") {
    // 5 quintile bands on the coverage-gap score. Same convention as every
    // other Reports map: 0 = best (most orgs, blue), 100 = worst (fewest
    // orgs, red). Zips with no Active orgs at all render transparent so
    // they're visually distinct from "few but some".
    metricExpression = [
      [">=", ["coalesce", ["get", "coverage_score"], -1], 80], COV_BAND_5,
      [">=", ["coalesce", ["get", "coverage_score"], -1], 60], COV_BAND_4,
      [">=", ["coalesce", ["get", "coverage_score"], -1], 40], COV_BAND_3,
      [">=", ["coalesce", ["get", "coverage_score"], -1], 20], COV_BAND_2,
      [">",  ["coalesce", ["get", "coverage_score"], -1], 0],  COV_BAND_1,
    ];
  } else if (isCoverageBivariate(metric)) {
    // 3×3 bivariate: condition (rows) × coverage gap (columns).
    // Y axis is either Distress or Evictions depending on viewMode — the
    // coverage_bivariate_code feature property is populated against whichever
    // is active. Stevens palette, 33 = high condition + low coverage (worst).
    metricExpression = [
      ["==", ["get", "coverage_bivariate_code"], "33"], FAM_33,
      ["==", ["get", "coverage_bivariate_code"], "32"], FAM_32,
      ["==", ["get", "coverage_bivariate_code"], "31"], FAM_31,
      ["==", ["get", "coverage_bivariate_code"], "23"], FAM_23,
      ["==", ["get", "coverage_bivariate_code"], "22"], FAM_22,
      ["==", ["get", "coverage_bivariate_code"], "21"], FAM_21,
      ["==", ["get", "coverage_bivariate_code"], "13"], FAM_13,
      ["==", ["get", "coverage_bivariate_code"], "12"], FAM_12,
      ["==", ["get", "coverage_bivariate_code"], "11"], FAM_11,
    ];
  } else if (metric === "bivariate") {
    // 3x3 bivariate choropleth using bivariate_map_code (text: "11"-"33")
    // Textbook two-hue Stevens palette: red (distress) × blue (funding gap)
    // blending through purple. Worst corner is 33 (high distress + large gap).
    metricExpression = [
      ["==", ["get", "bivariate_code"], "33"], FAM_33,  // high distress + large gap — dark purple (worst)
      ["==", ["get", "bivariate_code"], "32"], FAM_32,  // high distress, moderate gap — red-purple
      ["==", ["get", "bivariate_code"], "31"], FAM_31,  // high distress, low gap (well-funded) — saturated red/pink
      ["==", ["get", "bivariate_code"], "23"], FAM_23,  // mid distress, large gap — blue-purple
      ["==", ["get", "bivariate_code"], "22"], FAM_22,  // mid / mid — muted gray-purple
      ["==", ["get", "bivariate_code"], "21"], FAM_21,  // mid distress, low gap — pale pink
      ["==", ["get", "bivariate_code"], "13"], FAM_13,  // low distress, large gap — saturated blue
      ["==", ["get", "bivariate_code"], "12"], FAM_12,  // low distress, moderate gap — pale blue
      ["==", ["get", "bivariate_code"], "11"], FAM_11,  // low / low — near-white (baseline)
    ];
  } else {
    // distress (default) - 5 quintile bands: blue → green → yellow → orange → red
    metricExpression = [
      [">=", ["coalesce", ["get", "distress_score"], -1], 80], DISTRESS_RED,
      [">=", ["coalesce", ["get", "distress_score"], -1], 60], DISTRESS_ORANGE,
      [">=", ["coalesce", ["get", "distress_score"], -1], 40], DISTRESS_YELLOW,
      [">=", ["coalesce", ["get", "distress_score"], -1], 20], DISTRESS_GREEN,
      [">=", ["coalesce", ["get", "distress_score"], -1], 0],  DISTRESS_BLUE,
    ];
  }

  // Build the full case expression
  const fillColorExpr = [
    "case",
  ];

  // Priority 1 & 2: Interactive highlights - only in filter view
  if (showInteractiveHighlights) {
    fillColorExpr.push(
      // Priority 1: Child teal (pin click) - now handled by org-coverage-circles layer
      // (removed polygon fill to preserve base metric gradient visibility)
      // Priority 2: Base zip highlight (zip code filter)
      ["boolean", ["feature-state", "highlighted"], false],
      "rgba(0, 253, 253, 0.50)",
    );
  }

  // Priority 3: Hover
  fillColorExpr.push(
    ["boolean", ["feature-state", "hovered"], false],
    "rgba(184, 0, 31, 0.15)",
  );

  // Priority 4: Parent coverage - now handled by org-coverage-circles layer (centroid dots)
  // (removed solid fill - circles preserve base metric gradient visibility)

  // Priority 5: Metric colors
  fillColorExpr.push(...metricExpression);

  // Fallback: no data
  fillColorExpr.push("rgba(0, 0, 0, 0)");

  return {
    id: "unified-fill",
    type: "fill",
    paint: {
      "fill-color": fillColorExpr,
      "fill-opacity": 1,
    },
  };
}

// Render a county-breakdown object as plain comma-joined text. Used by the
// canvas (PNG export) path; the on-screen path renders structured JSX so it
// can color the user's selected county.
function formatCountyBreakdownText(breakdown) {
  if (!breakdown) return "";
  if (breakdown.isWildcard) return "All Houston-area counties";
  const parts = breakdown.pieces.map((p) => `${p.county} (${p.count})`);
  if (breakdown.unknown > 0) parts.push(`Outside Houston area (${breakdown.unknown})`);
  return parts.join(", ");
}

// Color used to call out the user's currently-selected county in the pin
// info-box breakdown. Bright magenta — matches the on-map highlight color
// applied to "Selected org's zips" when a pin is clicked.
const SELECTED_COUNTY_COLOR = "#FF66FF";

// Draggable info box component
function DraggableInfoBox({ info, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Reset position when info changes
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [info?.organization]);

  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    };

    const handleMouseMove = (e) => {
      if (!dragState.current.isDragging) return;
      setPosition({
        x: e.clientX - dragState.current.startX,
        y: e.clientY - dragState.current.startY,
      });
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!info) return null;

  return (
    <div
      data-info-box="true"
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        top: "80px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "320px",
        backgroundColor: "rgba(34, 40, 49, 0.95)",
        fontFamily: "'Open Sans', sans-serif",
        userSelect: "none",
      }}
    >
      {/* Drag handle header */}
      <div
        data-drag-handle="true"
        className="flex items-center justify-between rounded-t-lg"
        style={{
          padding: "10px 14px 6px",
          cursor: "grab",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="flex items-center gap-2">
          {/* Green pin indicator */}
          <MapPinIcon size={22} active={true} />
          <h3
            style={{
              fontSize: "14px",
              color: "#FFFFFF",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {info.organization}
          </h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            background: "none",
            border: "none",
            color: "#999",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 4px",
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "10px 14px 12px" }}>
        {info.orgParent !== info.organization && (
          <p style={{ fontSize: "11px", color: "#AAA", marginBottom: "6px" }}>
            {info.orgParent}
          </p>
        )}
        <p style={{ fontSize: "12px", color: "#FFC857", fontWeight: 500, marginBottom: "4px" }}>
          {info.assistance}
        </p>
        {info.telephone && (
          <p style={{ fontSize: "13px", color: "#FFFFFF", fontWeight: 600, marginBottom: "4px" }}>
            {info.telephone}
          </p>
        )}
        <p style={{ fontSize: "11px", color: "#CCC", marginBottom: "8px" }}>
          {info.address}
        </p>
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.15)",
            paddingTop: "8px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#00A8A8",
              fontWeight: 500,
            }}
          >
            Serves {info.zipCount} zip code{info.zipCount !== 1 ? "s" : ""}
          </div>
          {info.countyBreakdown && (
            <div
              style={{
                fontSize: "11px",
                color: "#CCC",
                fontWeight: 400,
                marginTop: "3px",
                lineHeight: 1.35,
              }}
            >
              {info.countyBreakdown.isWildcard ? (
                "All Houston-area counties"
              ) : (
                <>
                  {info.countyBreakdown.pieces.map((p, i) => {
                    const isSelected =
                      info.selectedCounty &&
                      info.selectedCounty !== "All Counties" &&
                      p.county === info.selectedCounty;
                    return (
                      <span key={p.county}>
                        {i > 0 && ", "}
                        <span
                          style={
                            isSelected
                              ? { color: SELECTED_COUNTY_COLOR, fontWeight: 600 }
                              : undefined
                          }
                        >
                          {p.county} ({p.count})
                        </span>
                      </span>
                    );
                  })}
                  {info.countyBreakdown.unknown > 0 && (
                    <>
                      {info.countyBreakdown.pieces.length > 0 && ", "}
                      <span>Outside Houston area ({info.countyBreakdown.unknown})</span>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Census data source citation
const CENSUS_SOURCE = "U.S. Census Bureau, ACS 5-Year Estimates (ZCTA)";

// Get the distress band color for a given score value (solid colors for the circle indicator)
function getDistressBandColor(score) {
  if (score == null) return "#888";
  if (score >= 80) return "rgba(220, 50, 50, 0.85)";     // Red
  if (score >= 60) return "rgba(245, 124, 0, 0.85)";     // Orange
  if (score >= 40) return "rgba(255, 213, 0, 0.85)";     // Yellow
  if (score >= 20) return "rgba(76, 175, 80, 0.85)";     // Green
  return "rgba(66, 133, 244, 0.85)";                      // Blue
}

// Distress data field labels for display in the table
// showMedian: true = show Greater Houston median in comparison column
// Rate fields are stored as fractions in zip_code_data (e.g. 0.194 for 19.4%),
// so multiply by 100 for display.
const fmtPct = (v) => v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—";
const fmtDollar = (v) => v != null ? `$${Math.round(Number(v)).toLocaleString()}` : "—";
const fmtPop = (v) => v != null ? Math.round(Number(v)).toLocaleString() : "—";
const fmtRatio = (v) => v != null ? Number(v).toFixed(2) : "—";
const fmtScore = (v) => v != null ? Number(v).toFixed(1) : "—";

const DISTRESS_FIELDS = [
  { key: "distress_score", label: "Distress Score", format: fmtScore, highlight: true, showMedian: true, medianFormat: fmtScore },
  { key: "rank", label: "Rank", format: (v, total) => v != null ? `${v} of ${total}` : "—", isRank: true },
  { key: "population", label: "Population", format: fmtPop, showMedian: true, medianFormat: fmtPop },
  { key: "households", label: "Households", format: fmtPop, showMedian: true, medianFormat: fmtPop },
  { key: "households_w_children", label: "Households w/ Children", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "poverty_rate", label: "Poverty Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "median_household_income", label: "Median Household Income", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
  { key: "median_rent", label: "Median Rent", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
  { key: "income_ratio", label: "Income Ratio", format: fmtRatio, showMedian: true, medianFormat: fmtRatio },
  { key: "unemployment_rate", label: "Unemployment Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_health_insurance", label: "No Health Insurance", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "snap", label: "SNAP Recipients", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_hs_diploma", label: "No HS Diploma", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "vacancy_rate", label: "Vacancy Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "owner_occupancy", label: "Owner Occupancy", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_vehicle", label: "No Vehicle", format: fmtPct, showMedian: true, medianFormat: fmtPct },
];

// Compute Greater Houston medians from zip_code_data
// (filtered to rows where distress_score is populated — the "Calculated" set)
function computeHoustonMedians(distressData) {
  if (!distressData || distressData.length === 0) return {};
  const medians = {};
  const medianFields = DISTRESS_FIELDS.filter(f => f.showMedian).map(f => f.key);
  const reliableData = distressData.filter(d => d.distress_score != null);

  medianFields.forEach(field => {
    const values = reliableData
      .map(d => d[field])
      .filter(v => v != null && !isNaN(v))
      .sort((a, b) => a - b);
    if (values.length === 0) { medians[field] = null; return; }
    const mid = Math.floor(values.length / 2);
    medians[field] = values.length % 2 === 0
      ? Math.round(((values[mid - 1] + values[mid]) / 2) * 100) / 100
      : values[mid];
  });
  return medians;
}

// Working poor data field labels for display in the table
// showMedian: true = show Greater Houston median in comparison column
const WORKING_POOR_FIELDS = [
  { key: "working_poor_score", label: "Working Poor Score", format: fmtScore, highlight: true, showMedian: true, medianFormat: fmtScore },
  { key: "working_poor_rank", label: "Rank", format: (v, total) => v != null ? `${v} of ${total}` : "—", isRank: true },
  { key: "population", label: "Population", format: fmtPop, showMedian: true, medianFormat: fmtPop },
  { key: "households", label: "Households", format: fmtPop, showMedian: true, medianFormat: fmtPop },
  { key: "households_w_children", label: "Households w/ Children", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "poverty_rate", label: "Poverty Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "median_rent", label: "Median Rent", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
  { key: "unemployment_rate", label: "Unemployment Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_health_insurance", label: "No Health Insurance", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "snap", label: "SNAP Recipients", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_hs_diploma", label: "No HS Diploma", format: fmtPct, showMedian: true, medianFormat: fmtPct },
];

// Compute Greater Houston medians from zip_code_data
// (filtered to rows where working_poor_score is populated)
function computeWorkingPoorMedians(zipCodeData) {
  if (!zipCodeData || zipCodeData.length === 0) return {};
  const medians = {};
  const medianFields = WORKING_POOR_FIELDS.filter(f => f.showMedian).map(f => f.key);
  const reliableData = zipCodeData.filter(d => d.working_poor_score != null);

  medianFields.forEach(field => {
    const values = reliableData
      .map(d => d[field])
      .filter(v => v != null && !isNaN(v))
      .sort((a, b) => a - b);
    if (values.length === 0) { medians[field] = null; return; }
    const mid = Math.floor(values.length / 2);
    medians[field] = values.length % 2 === 0
      ? Math.round(((values[mid - 1] + values[mid]) / 2) * 100) / 100
      : values[mid];
  });
  return medians;
}

// Get the working poor band color for a given score value (solid colors for the circle indicator)
function getWorkingPoorBandColor(score) {
  return getDistressBandColor(score);
}

// Evictions data field labels for display in the table
// showMedian: true = show Greater Houston median in comparison column
const EVICTIONS_FIELDS = [
  { key: "evictions_score", label: "Evictions Score", format: fmtScore, highlight: true, showMedian: true, medianFormat: fmtScore },
  { key: "rank", label: "Rank", format: (v, total) => v != null ? `${v} of ${total}` : "—", isRank: true },
  { key: "claim_amount", label: "Total Claims", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
  { key: "filings_count", label: "Filings Count", format: (v) => v != null ? Math.round(Number(v)).toLocaleString() : "—", showMedian: true, medianFormat: (v) => Math.round(Number(v)).toLocaleString() },
  { key: "amount_per_filing", label: "Amount per Filing", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
  { key: "households", label: "Households", format: fmtPop, showMedian: true, medianFormat: fmtPop },
  { key: "households_w_children", label: "Households w/ Children", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "median_rent", label: "Median Rent", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
];

// Compute Greater Houston medians from zip_code_data
// (filtered to rows where evictions_score is populated)
function computeEvictionsMedians(evictionsData) {
  if (!evictionsData || evictionsData.length === 0) return {};
  const reliableData = evictionsData.filter(d => d.evictions_score != null);
  const medians = {};
  const medianFields = EVICTIONS_FIELDS.filter(f => f.showMedian).map(f => f.key);

  medianFields.forEach(field => {
    const values = reliableData
      .map(d => d[field])
      .filter(v => v != null && !isNaN(v))
      .sort((a, b) => a - b);
    if (values.length === 0) { medians[field] = null; return; }
    const mid = Math.floor(values.length / 2);
    medians[field] = values.length % 2 === 0
      ? Math.round(((values[mid - 1] + values[mid]) / 2) * 100) / 100
      : values[mid];
  });
  return medians;
}

// Get the evictions band color for a given score value (solid colors for the circle indicator)
function getEvictionsBandColor(score) {
  return getDistressBandColor(score);
}

// Family Vulnerability Index field labels for display in the table.
// showMedian: true = show Greater Houston median in comparison column.
const FVI_FIELDS = [
  { key: "family_vulnerability_index", label: "Family Vulnerability Index", format: fmtScore, highlight: true, showMedian: true, medianFormat: fmtScore },
  { key: "fvi_rank", label: "Rank", format: (v, total) => v != null ? `${v} of ${total}` : "—", isRank: true },
  { key: "distress_score", label: "Distress Score", format: fmtScore, showMedian: true, medianFormat: fmtScore },
  { key: "households_w_children", label: "Households w/ Children", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "households", label: "Households", format: fmtPop, showMedian: true, medianFormat: fmtPop },
  { key: "median_rent", label: "Median Rent", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
  { key: "population", label: "Population", format: fmtPop, showMedian: true, medianFormat: fmtPop },
];

// Compute Greater Houston medians for the FVI info box (zips with FVI calculated).
function computeFamilyMedians(zipCodeData) {
  if (!zipCodeData || zipCodeData.length === 0) return {};
  const reliableData = zipCodeData.filter(d => d.family_vulnerability_index != null);
  const medians = {};
  const medianFields = FVI_FIELDS.filter(f => f.showMedian).map(f => f.key);

  medianFields.forEach(field => {
    const values = reliableData
      .map(d => d[field])
      .filter(v => v != null && !isNaN(v))
      .sort((a, b) => a - b);
    if (values.length === 0) { medians[field] = null; return; }
    const mid = Math.floor(values.length / 2);
    medians[field] = values.length % 2 === 0
      ? Math.round(((values[mid - 1] + values[mid]) / 2) * 100) / 100
      : values[mid];
  });
  return medians;
}

// Ranked counts are computed dynamically from data (count of exclude===2 records)

// Draggable distress data table component - shows census indicators for a clicked zip
function DraggableDistressTable({ data, zipCode, neighborhood, houstonMedians, rankedCount, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Reset position when zip changes
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [zipCode]);

  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    };

    const handleMouseMove = (e) => {
      if (!dragState.current.isDragging) return;
      setPosition({
        x: e.clientX - dragState.current.startX,
        y: e.clientY - dragState.current.startY,
      });
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!data || !zipCode) return null;

  // Key data for the distress map is distress_score — drives bg color, banner,
  // and whether score/rank rows render (replaces prior data.exclude logic).
  const hasKeyData = data.distress_score != null;

  return (
    <div
      data-distress-table="true"
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "400px",
        backgroundColor: hasKeyData ? "rgba(34, 40, 49, 0.95)" : "rgba(105, 105, 118, 0.95)",
        fontFamily: "'Open Sans', sans-serif",
        userSelect: "none",
      }}
    >
      {/* Drag handle header */}
      <div
        data-drag-handle="true"
        className="flex items-center justify-between rounded-t-lg"
        style={{
          padding: "10px 14px 8px",
          cursor: "grab",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "15px",
              color: "#FFC857",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Zip Code {zipCode}
          </h3>
          {data.county && (
            <p style={{
              fontSize: "11px",
              color: "#CCCCCC",
              margin: "2px 0 0",
              lineHeight: 1.3,
            }}>
              {data.county} County
            </p>
          )}
          {neighborhood && (
            <p style={{
              fontSize: "10px",
              color: "#8FB6FF",
              margin: "2px 0 0",
              lineHeight: 1.3,
            }}>
              {neighborhood}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            background: "none",
            border: "none",
            color: "#999",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 4px",
            alignSelf: "flex-start",
          }}
        >
          ×
        </button>
      </div>

      {/* Banner when distress score is unavailable for this zip */}
      {!hasKeyData && (
        <div style={{
          padding: "6px 14px",
          backgroundColor: "rgba(255, 179, 2, 0.15)",
          borderBottom: "1px solid rgba(255, 179, 2, 0.25)",
        }}>
          <span style={{ fontSize: "10px", color: "#FFB302", fontWeight: 500 }}>
            Distress score not available — data shown for reference only
          </span>
          <br />
          <span style={{ fontSize: "9px", color: "#999", fontStyle: "italic" }}>
            Not scored or ranked. Excluded from Greater Houston statistics.
          </span>
        </div>
      )}

      {/* Column headers */}
      <div style={{
        display: "flex",
        padding: "6px 14px 4px",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
      }}>
        <span style={{ flex: 1, fontSize: "9px", color: "#888", fontWeight: 500 }}></span>
        <span style={{ width: "72px", textAlign: "right", fontSize: "9px", color: "#FFFFFF", fontWeight: 600 }}>
          Value
        </span>
        <span style={{ width: "60px", textAlign: "right", fontSize: "9px", color: "#8FB6FF", fontWeight: 600 }}>
          Houston*
        </span>
      </div>

      {/* Data rows — when distress_score is missing, skip score/rank rows
          (same pattern as the old exclude=1 branch) and show remaining raw
          fields with an em-dash for any null values. */}
      <div style={{ padding: "4px 14px 2px" }}>
        {DISTRESS_FIELDS.map(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
            if (!hasKeyData && (highlight || isRank)) return null;

            const medianVal = houstonMedians?.[key];
            const fmtMedian = showMedian && medianVal != null
              ? (medianFormat ? medianFormat(medianVal) : medianVal.toLocaleString())
              : "";

            return (
              <div key={key}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: highlight ? "6px 0" : "3px 0",
                    borderBottom: highlight ? "1px solid rgba(255,255,255,0.1)" : "none",
                  }}
                >
                  {/* Label */}
                  <span style={{
                    flex: 1,
                    fontSize: highlight ? "12px" : isRank ? "10px" : "11px",
                    color: highlight ? "#FFC857" : isRank ? "#AAA" : "#CCC",
                    fontWeight: highlight ? 600 : 400,
                  }}>
                    {label}
                  </span>
                  {/* Value */}
                  <span style={{
                    width: "72px",
                    textAlign: "right",
                    fontSize: highlight ? "14px" : isRank ? "10px" : "12px",
                    color: isRank ? "#AAA" : "#FFFFFF",
                    fontWeight: highlight ? 700 : 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "4px",
                  }}>
                    {highlight && (
                      <span style={{
                        display: "inline-block",
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: getDistressBandColor(data.distress_score),
                        flexShrink: 0,
                      }} />
                    )}
                    {isRank ? format(data[key], rankedCount) : format(data[key])}
                  </span>
                  {/* Houston median value (skip for rank rows) */}
                  <span style={{
                    width: "60px",
                    textAlign: "right",
                    fontSize: "11px",
                    color: "#8FB6FF",
                    fontWeight: 400,
                  }}>
                    {isRank ? "" : fmtMedian}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Source citation + footnote */}
      <div
        style={{
          padding: "6px 14px 10px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span style={{ fontSize: "9px", color: "#888", fontStyle: "italic" }}>
          Source: {CENSUS_SOURCE}
        </span>
        <br />
        <span style={{ fontSize: "9px", color: "#8FB6FF", fontStyle: "italic" }}>
          * Greater Houston area median
        </span>
      </div>
    </div>
  );
}


// Draggable working poor data table component - shows working poor indicators for a clicked zip
function DraggableWorkingPoorTable({ data, zipCode, neighborhood, houstonMedians, rankedCount, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Reset position when zip changes
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [zipCode]);

  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    };

    const handleMouseMove = (e) => {
      if (!dragState.current.isDragging) return;
      setPosition({
        x: e.clientX - dragState.current.startX,
        y: e.clientY - dragState.current.startY,
      });
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!data || !zipCode) return null;

  const hasKeyData = data.working_poor_score != null;

  return (
    <div
      data-working-poor-table="true"
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "400px",
        backgroundColor: hasKeyData ? "rgba(34, 40, 49, 0.95)" : "rgba(105, 105, 118, 0.95)",
        fontFamily: "'Open Sans', sans-serif",
        userSelect: "none",
      }}
    >
      {/* Drag handle header */}
      <div
        data-drag-handle="true"
        className="flex items-center justify-between rounded-t-lg"
        style={{
          padding: "10px 14px 8px",
          cursor: "grab",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "15px",
              color: "#FFC857",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Zip Code {zipCode}
          </h3>
          {data.county && (
            <p style={{
              fontSize: "11px",
              color: "#CCCCCC",
              margin: "2px 0 0",
              lineHeight: 1.3,
            }}>
              {data.county} County
            </p>
          )}
          {neighborhood && (
            <p style={{
              fontSize: "10px",
              color: "#8FB6FF",
              margin: "2px 0 0",
              lineHeight: 1.3,
            }}>
              {neighborhood}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            background: "none",
            border: "none",
            color: "#999",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 4px",
            alignSelf: "flex-start",
          }}
        >
          ×
        </button>
      </div>

      {/* Column headers */}
      <div style={{
        display: "flex",
        padding: "6px 14px 4px",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
      }}>
        <span style={{ flex: 1, fontSize: "9px", color: "#888", fontWeight: 500 }}></span>
        <span style={{ width: "72px", textAlign: "right", fontSize: "9px", color: "#FFFFFF", fontWeight: 600 }}>
          Value
        </span>
        <span style={{ width: "60px", textAlign: "right", fontSize: "9px", color: "#8FB6FF", fontWeight: 600 }}>
          Houston*
        </span>
      </div>

      {/* Banner when working-poor score is unavailable for this zip */}
      {!hasKeyData && (
        <div style={{
          padding: "6px 14px",
          backgroundColor: "rgba(255, 179, 2, 0.15)",
          borderBottom: "1px solid rgba(255, 179, 2, 0.25)",
        }}>
          <span style={{ fontSize: "10px", color: "#FFB302", fontWeight: 500 }}>
            Working Poor score not available — data shown for reference only
          </span>
          <br />
          <span style={{ fontSize: "9px", color: "#999", fontStyle: "italic" }}>
            Not scored or ranked. Excluded from Greater Houston statistics.
          </span>
        </div>
      )}

      {/* Data rows */}
      <div style={{ padding: "4px 14px 2px" }}>
        {WORKING_POOR_FIELDS.map(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
          if (!hasKeyData && (highlight || isRank)) return null;
          const medianVal = houstonMedians?.[key];
          const fmtMedian = showMedian && medianVal != null
            ? (medianFormat ? medianFormat(medianVal) : medianVal.toLocaleString())
            : "";

          return (
            <div key={key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: highlight ? "6px 0" : "3px 0",
                  borderBottom: highlight ? "1px solid rgba(255,255,255,0.1)" : "none",
                }}
              >
                {/* Label */}
                <span style={{
                  flex: 1,
                  fontSize: highlight ? "12px" : isRank ? "10px" : "11px",
                  color: highlight ? "#FFC857" : isRank ? "#AAA" : "#CCC",
                  fontWeight: highlight ? 600 : 400,
                }}>
                  {label}
                </span>
                {/* Value */}
                <span style={{
                  width: "72px",
                  textAlign: "right",
                  fontSize: highlight ? "14px" : isRank ? "10px" : "12px",
                  color: isRank ? "#AAA" : "#FFFFFF",
                  fontWeight: highlight ? 700 : 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "4px",
                }}>
                  {highlight && (
                    <span style={{
                      display: "inline-block",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      backgroundColor: getWorkingPoorBandColor(data.working_poor_score),
                      flexShrink: 0,
                    }} />
                  )}
                  {isRank ? format(data[key], rankedCount) : format(data[key])}
                </span>
                {/* Houston median value (skip for rank rows) */}
                <span style={{
                  width: "60px",
                  textAlign: "right",
                  fontSize: "11px",
                  color: "#8FB6FF",
                  fontWeight: 400,
                }}>
                  {isRank ? "" : fmtMedian}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Source citation + footnote */}
      <div
        style={{
          padding: "6px 14px 10px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span style={{ fontSize: "9px", color: "#888", fontStyle: "italic" }}>
          Source: {CENSUS_SOURCE}
        </span>
        <br />
        <span style={{ fontSize: "9px", color: "#8FB6FF", fontStyle: "italic" }}>
          * Greater Houston area median
        </span>
      </div>
    </div>
  );
}

// Draggable evictions data table component - shows eviction indicators for a clicked zip
function DraggableEvictionsTable({ data, zipCode, neighborhood, houstonMedians, rankedCount, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [zipCode]);

  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    };

    const handleMouseMove = (e) => {
      if (!dragState.current.isDragging) return;
      setPosition({
        x: e.clientX - dragState.current.startX,
        y: e.clientY - dragState.current.startY,
      });
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!data || !zipCode) return null;

  // Key data for the evictions map is evictions_score — drives bg, banner,
  // and whether score/rank rows render.
  const hasKeyData = data.evictions_score != null;

  return (
    <div
      data-evictions-table="true"
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "420px",
        backgroundColor: hasKeyData ? "rgba(34, 40, 49, 0.95)" : "rgba(105, 105, 118, 0.95)",
        fontFamily: "'Open Sans', sans-serif",
        userSelect: "none",
      }}
    >
      {/* Drag handle header */}
      <div
        data-drag-handle="true"
        className="flex items-center justify-between rounded-t-lg"
        style={{
          padding: "10px 14px 8px",
          cursor: "grab",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "15px",
              color: "#FFC857",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Zip Code {zipCode}
          </h3>
          {data.county && (
            <p style={{
              fontSize: "11px",
              color: "#CCCCCC",
              margin: "2px 0 0",
              lineHeight: 1.3,
            }}>
              {data.county} County
            </p>
          )}
          {neighborhood && (
            <p style={{
              fontSize: "10px",
              color: "#8FB6FF",
              margin: "2px 0 0",
              lineHeight: 1.3,
            }}>
              {neighborhood}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            background: "none",
            border: "none",
            color: "#999",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 4px",
            alignSelf: "flex-start",
          }}
        >
          ×
        </button>
      </div>

      {/* Banner when evictions score is unavailable for this zip */}
      {!hasKeyData && (
        <div style={{
          padding: "6px 14px",
          backgroundColor: "rgba(255, 179, 2, 0.15)",
          borderBottom: "1px solid rgba(255, 179, 2, 0.25)",
        }}>
          <span style={{ fontSize: "10px", color: "#FFB302", fontWeight: 500 }}>
            Evictions score not available — data shown for reference only
          </span>
          <br />
          <span style={{ fontSize: "9px", color: "#999", fontStyle: "italic" }}>
            Not scored or ranked. Excluded from Greater Houston statistics.
          </span>
        </div>
      )}

      {/* Column headers */}
      <div style={{
        display: "flex",
        padding: "6px 14px 4px",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
      }}>
        <span style={{ flex: 1, fontSize: "9px", color: "#888", fontWeight: 500 }}></span>
        <span style={{ width: "72px", textAlign: "right", fontSize: "9px", color: "#FFFFFF", fontWeight: 600 }}>
          2024
        </span>
        <span style={{ width: "72px", textAlign: "right", fontSize: "9px", color: "#8FB6FF", fontWeight: 600 }}>
          Houston*
        </span>
      </div>

      {/* Data rows — when evictions_score is missing, skip score/rank rows;
          other fields render with em-dashes for null values. */}
      <div style={{ padding: "4px 14px 2px" }}>
        {EVICTIONS_FIELDS.map(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
            if (!hasKeyData && (highlight || isRank)) return null;

            const medianVal = houstonMedians?.[key];
            const fmtMedian = showMedian && medianVal != null
              ? (medianFormat ? medianFormat(medianVal) : medianVal.toLocaleString())
              : "";

            return (
              <div key={key}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: highlight ? "6px 0" : "3px 0",
                    borderBottom: highlight ? "1px solid rgba(255,255,255,0.1)" : "none",
                  }}
                >
                  <span style={{
                    flex: 1,
                    fontSize: highlight ? "12px" : isRank ? "10px" : "11px",
                    color: highlight ? "#FFC857" : isRank ? "#AAA" : "#CCC",
                    fontWeight: highlight ? 600 : 400,
                  }}>
                    {label}
                  </span>
                  <span style={{
                    width: "72px",
                    textAlign: "right",
                    fontSize: highlight ? "14px" : "12px",
                    color: "#FFFFFF",
                    fontWeight: highlight ? 700 : 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "6px",
                  }}>
                    {highlight && (
                      <span style={{
                        display: "inline-block",
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: getEvictionsBandColor(data.evictions_score),
                        flexShrink: 0,
                      }} />
                    )}
                    {isRank ? format(data[key], rankedCount) : format(data[key])}
                  </span>
                  <span style={{
                    width: "72px",
                    textAlign: "right",
                    fontSize: "11px",
                    color: "#8FB6FF",
                    fontWeight: 400,
                  }}>
                    {fmtMedian}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Source citation + footnote */}
      <div
        style={{
          padding: "6px 14px 10px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span style={{ fontSize: "9px", color: "#888", fontStyle: "italic" }}>
          Source: Harris County Justice of the Peace Courts
        </span>
        <br />
        <span style={{ fontSize: "9px", color: "#8FB6FF", fontStyle: "italic" }}>
          * Greater Houston area median
        </span>
      </div>
    </div>
  );
}

// Draggable Family Vulnerability info box — shows FVI + its component metrics.
// Single info box for both sub-modes (choropleth + bivariate).
// hasKeyData gate: FVI is null for zips missing distress_score or children% —
// those zips render with the dim background + banner, same pattern as distress.
function DraggableFamilyVulnerabilityTable({ data, zipCode, neighborhood, familyMedians, rankedCount, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [zipCode]);

  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    };

    const handleMouseMove = (e) => {
      if (!dragState.current.isDragging) return;
      setPosition({
        x: e.clientX - dragState.current.startX,
        y: e.clientY - dragState.current.startY,
      });
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!data || !zipCode) return null;

  const hasKeyData = data.family_vulnerability_index != null;

  return (
    <div
      data-fvi-table="true"
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "400px",
        backgroundColor: hasKeyData ? "rgba(34, 40, 49, 0.95)" : "rgba(105, 105, 118, 0.95)",
        fontFamily: "'Open Sans', sans-serif",
        userSelect: "none",
      }}
    >
      {/* Drag handle header */}
      <div
        data-drag-handle="true"
        className="flex items-center justify-between rounded-t-lg"
        style={{
          padding: "10px 14px 8px",
          cursor: "grab",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div>
          <h3 style={{ fontSize: "15px", color: "#FFC857", fontWeight: 600, margin: 0 }}>
            Zip Code {zipCode}
          </h3>
          {data.county && (
            <p style={{ fontSize: "11px", color: "#CCCCCC", margin: "2px 0 0", lineHeight: 1.3 }}>
              {data.county} County
            </p>
          )}
          {neighborhood && (
            <p style={{ fontSize: "10px", color: "#8FB6FF", margin: "2px 0 0", lineHeight: 1.3 }}>
              {neighborhood}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: "none",
            border: "none",
            color: "#999",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 4px",
            alignSelf: "flex-start",
          }}
        >
          ×
        </button>
      </div>

      {/* Banner when FVI is unavailable for this zip */}
      {!hasKeyData && (
        <div style={{
          padding: "6px 14px",
          backgroundColor: "rgba(255, 179, 2, 0.15)",
          borderBottom: "1px solid rgba(255, 179, 2, 0.25)",
        }}>
          <span style={{ fontSize: "10px", color: "#FFB302", fontWeight: 500 }}>
            Family Vulnerability Index not available — data shown for reference only
          </span>
          <br />
          <span style={{ fontSize: "9px", color: "#999", fontStyle: "italic" }}>
            Not scored or ranked. Excluded from Greater Houston statistics.
          </span>
        </div>
      )}

      {/* Column headers */}
      <div style={{
        display: "flex",
        padding: "6px 14px 4px",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
      }}>
        <span style={{ flex: 1, fontSize: "9px", color: "#888", fontWeight: 500 }}></span>
        <span style={{ width: "72px", textAlign: "right", fontSize: "9px", color: "#FFFFFF", fontWeight: 600 }}>
          Value
        </span>
        <span style={{ width: "60px", textAlign: "right", fontSize: "9px", color: "#8FB6FF", fontWeight: 600 }}>
          Houston*
        </span>
      </div>

      {/* Data rows */}
      <div style={{ padding: "4px 14px 2px" }}>
        {FVI_FIELDS.map(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
          if (!hasKeyData && (highlight || isRank)) return null;

          const medianVal = familyMedians?.[key];
          const fmtMedian = showMedian && medianVal != null
            ? (medianFormat ? medianFormat(medianVal) : medianVal.toLocaleString())
            : "";

          return (
            <div key={key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: highlight ? "6px 0 4px" : "3px 0",
                  borderBottom: highlight ? "none" : "none",
                }}
              >
                <span style={{
                  flex: 1,
                  fontSize: highlight ? "12px" : isRank ? "10px" : "11px",
                  color: highlight ? "#FFC857" : isRank ? "#AAA" : "#CCC",
                  fontWeight: highlight ? 600 : 400,
                }}>
                  {label}
                </span>
                <span style={{
                  width: "72px",
                  textAlign: "right",
                  fontSize: highlight ? "14px" : isRank ? "10px" : "12px",
                  color: isRank ? "#AAA" : "#FFFFFF",
                  fontWeight: highlight ? 700 : 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "4px",
                }}>
                  {highlight && (
                    <span style={{
                      display: "inline-block",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      backgroundColor: getDistressBandColor(data.family_vulnerability_index),
                      flexShrink: 0,
                    }} />
                  )}
                  {isRank ? format(data[key], rankedCount) : format(data[key])}
                </span>
                <span style={{
                  width: "60px",
                  textAlign: "right",
                  fontSize: "11px",
                  color: "#8FB6FF",
                  fontWeight: 400,
                }}>
                  {isRank ? "" : fmtMedian}
                </span>
              </div>
              {highlight && (
                <div
                  style={{
                    padding: "0 0 8px",
                    fontSize: "10.5px",
                    color: "#DDDDDD",
                    lineHeight: 1.4,
                    fontStyle: "italic",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {getFviQuintileLabel(data.family_vulnerability_index)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Source citation + footnote */}
      <div style={{ padding: "6px 14px 10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ fontSize: "9px", color: "#888", fontStyle: "italic" }}>
          Source: {CENSUS_SOURCE}
        </span>
        <br />
        <span style={{ fontSize: "9px", color: "#8FB6FF", fontStyle: "italic" }}>
          * Greater Houston area median
        </span>
      </div>
    </div>
  );
}

// Simple draggable funding info box - shows funding amount for the clicked zip
function DraggableFundingTable({ data, zipCode, neighborhood, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [zipCode]);

  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    };

    const handleMouseMove = (e) => {
      if (!dragState.current.isDragging) return;
      setPosition({
        x: e.clientX - dragState.current.startX,
        y: e.clientY - dragState.current.startY,
      });
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!data || !zipCode) return null;

  const fundingAmount = data.zip_fin_funding != null ? `$${Math.round(Number(data.zip_fin_funding)).toLocaleString()}` : "—";

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "280px",
        backgroundColor: "rgba(34, 40, 49, 0.95)",
        fontFamily: "'Open Sans', sans-serif",
        userSelect: "none",
      }}
    >
      {/* Drag handle header */}
      <div
        data-drag-handle="true"
        className="flex items-center justify-between rounded-t-lg"
        style={{
          padding: "10px 14px 8px",
          cursor: "grab",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div>
          <h3 style={{ fontSize: "15px", color: "#FFC857", fontWeight: 600, margin: 0 }}>
            Zip Code {zipCode}
          </h3>
          {data.county && (
            <p style={{ fontSize: "11px", color: "#CCCCCC", margin: "2px 0 0", lineHeight: 1.3 }}>
              {data.county} County
            </p>
          )}
          {neighborhood && (
            <p style={{ fontSize: "10px", color: "#8FB6FF", margin: "2px 0 0", lineHeight: 1.3 }}>
              {neighborhood}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: "none",
            border: "none",
            color: "#999",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 4px",
            alignSelf: "flex-start",
          }}
        >
          ×
        </button>
      </div>

      {/* Funding value + population */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Funding Level</span>
          <span style={{ fontSize: "16px", color: "#FFFFFF", fontWeight: 600 }}>
            {fundingAmount}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Population</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {data.population != null ? Number(data.population).toLocaleString() : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function DraggableEfficiencyTable({ data, zipCode, neighborhood, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [zipCode]);

  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    };

    const handleMouseMove = (e) => {
      if (!dragState.current.isDragging) return;
      setPosition({
        x: e.clientX - dragState.current.startX,
        y: e.clientY - dragState.current.startY,
      });
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!data || !zipCode) return null;

  // Display the efficiency score from the database (normal_efficiency_ratio,
  // 0–100, normalized in your data pipeline). Higher score = more distress per
  // dollar of funding (greater unmet need relative to available funding).
  const efficiencyScore = data.normal_efficiency_ratio != null
    ? Number(data.normal_efficiency_ratio).toFixed(1)
    : "—";
  const distress = data.distress_score != null ? Number(data.distress_score) : null;
  const funding = data.zip_fin_funding != null ? Number(data.zip_fin_funding) : null;
  const distressScore = distress != null ? distress.toFixed(1) : "—";
  const fundingAmount = funding != null ? `$${Math.round(funding).toLocaleString()}` : "—";

  return (
    <div
      data-efficiency-table="true"
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "300px",
        backgroundColor: "rgba(34, 40, 49, 0.95)",
        fontFamily: "'Open Sans', sans-serif",
        userSelect: "none",
      }}
    >
      {/* Drag handle header */}
      <div
        data-drag-handle="true"
        className="flex items-center justify-between rounded-t-lg"
        style={{
          padding: "10px 14px 8px",
          cursor: "grab",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div>
          <h3 style={{ fontSize: "15px", color: "#FFC857", fontWeight: 600, margin: 0 }}>
            Zip Code {zipCode}
          </h3>
          {data.county && (
            <p style={{ fontSize: "11px", color: "#CCCCCC", margin: "2px 0 0", lineHeight: 1.3 }}>
              {data.county} County
            </p>
          )}
          {neighborhood && (
            <p style={{ fontSize: "10px", color: "#8FB6FF", margin: "2px 0 0", lineHeight: 1.3 }}>
              {neighborhood}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: "none",
            border: "none",
            color: "#999",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 4px",
            alignSelf: "flex-start",
          }}
        >
          ×
        </button>
      </div>

      {/* Efficiency score + explanation + distress + funding */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Efficiency Score</span>
          <span style={{ fontSize: "16px", color: "#FFFFFF", fontWeight: 600 }}>
            {efficiencyScore}
          </span>
        </div>
        <p style={{ fontSize: "10px", color: "#999", margin: "-4px 0 2px", lineHeight: 1.4, fontStyle: "italic" }}>
          Higher score means more distress per dollar of funding — greater unmet need relative to funding.
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Distress Score</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {distressScore}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Funding Level</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {fundingAmount}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Population</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {data.population != null ? Number(data.population).toLocaleString() : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

const BIVARIATE_LABELS = {
  "33": "Critical Priority — High distress + large funding gap",
  "32": "High Priority — High distress with moderate funding gap",
  "31": "Verify Impact — High distress despite peer-level funding (is it reaching outcomes?)",
  "23": "Emerging Need — Moderate distress with large funding gap",
  "22": "Mid-Range — Balanced distress and funding",
  "21": "Tracking — Moderate distress, well-funded",
  "13": "Possible Reallocation — Low distress yet under-funded vs. peers",
  "12": "Mild Gap — Low distress with modest funding shortfall",
  "11": "Baseline — Low distress, well-funded",
};

const BIVARIATE_COLORS = {
  "31": "#DC6E8C", "32": "#AA5F9B", "33": "#6E3282",
  "21": "#E6C3D2", "22": "#B4A5C3", "23": "#8282C3",
  "11": "#E8E8E8", "12": "#BED7E6", "13": "#5FA5D7",
};

function DraggableBivariateTable({ data, zipCode, neighborhood, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [zipCode]);

  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    };

    const handleMouseMove = (e) => {
      if (!dragState.current.isDragging) return;
      setPosition({
        x: e.clientX - dragState.current.startX,
        y: e.clientY - dragState.current.startY,
      });
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!data || !zipCode) return null;

  const mapCode = data.bivariate_map_code != null ? String(data.bivariate_map_code) : "";
  const codeLabel = BIVARIATE_LABELS[mapCode] || "—";
  const codeColor = BIVARIATE_COLORS[mapCode] || "#666";
  const distressScore = data.distress_score != null ? Number(data.distress_score).toFixed(1) : "—";
  const fundingAmount = data.zip_fin_funding != null ? `$${Math.round(Number(data.zip_fin_funding)).toLocaleString()}` : "—";

  return (
    <div
      data-bivariate-table="true"
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "300px",
        backgroundColor: "rgba(34, 40, 49, 0.95)",
        fontFamily: "'Open Sans', sans-serif",
        userSelect: "none",
      }}
    >
      {/* Drag handle header */}
      <div
        data-drag-handle="true"
        className="flex items-center justify-between rounded-t-lg"
        style={{
          padding: "10px 14px 8px",
          cursor: "grab",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div>
          <h3 style={{ fontSize: "15px", color: "#FFC857", fontWeight: 600, margin: 0 }}>
            Zip Code {zipCode}
          </h3>
          {data.county && (
            <p style={{ fontSize: "11px", color: "#CCCCCC", margin: "2px 0 0", lineHeight: 1.3 }}>
              {data.county} County
            </p>
          )}
          {neighborhood && (
            <p style={{ fontSize: "10px", color: "#8FB6FF", margin: "2px 0 0", lineHeight: 1.3 }}>
              {neighborhood}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: "none",
            border: "none",
            color: "#999",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 4px",
            alignSelf: "flex-start",
          }}
        >
          ×
        </button>
      </div>

      {/* Map code + label + data */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Bivariate classification */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            backgroundColor: codeColor,
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 600 }}>{codeLabel}</div>
            <div style={{ fontSize: "10px", color: "#999" }}>Code: {mapCode || "—"}</div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "2px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Distress Score</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {distressScore}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Funding Level</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {fundingAmount}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Population</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {data.population != null ? Number(data.population).toLocaleString() : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

// Draggable info box for the FVI bivariate sub-mode — shows the cell label,
// code, color swatch, and the underlying metric values. Mirrors the
// DraggableBivariateTable pattern used for distress × funding.
function DraggableFamilyBivariateTable({ data, zipCode, neighborhood, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [zipCode]);

  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    };

    const handleMouseMove = (e) => {
      if (!dragState.current.isDragging) return;
      setPosition({
        x: e.clientX - dragState.current.startX,
        y: e.clientY - dragState.current.startY,
      });
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!data || !zipCode) return null;

  const distress = data.distress_score != null ? Number(data.distress_score) : null;
  const childrenPct = data.households_w_children != null ? Number(data.households_w_children) : null;
  const mapCode = data.fvi_map_code != null ? String(data.fvi_map_code) : "";
  const codeLabel = FAMILY_BIVARIATE_LABELS[mapCode] || "—";
  const codeColor = FAMILY_BIVARIATE_LEGEND_COLORS[mapCode] || "#666";
  const fvi = data.family_vulnerability_index != null ? Number(data.family_vulnerability_index).toFixed(1) : "—";
  const distressDisplay = distress != null ? distress.toFixed(1) : "—";
  const childrenDisplay = childrenPct != null ? `${(childrenPct * 100).toFixed(1)}%` : "—";
  const householdsDisplay = data.households != null ? Math.round(Number(data.households)).toLocaleString() : "—";

  return (
    <div
      data-family-bivariate-table="true"
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "300px",
        backgroundColor: "rgba(34, 40, 49, 0.95)",
        fontFamily: "'Open Sans', sans-serif",
        userSelect: "none",
      }}
    >
      {/* Drag handle header */}
      <div
        data-drag-handle="true"
        className="flex items-center justify-between rounded-t-lg"
        style={{
          padding: "10px 14px 8px",
          cursor: "grab",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div>
          <h3 style={{ fontSize: "15px", color: "#FFC857", fontWeight: 600, margin: 0 }}>
            Zip Code {zipCode}
          </h3>
          {data.county && (
            <p style={{ fontSize: "11px", color: "#CCCCCC", margin: "2px 0 0", lineHeight: 1.3 }}>
              {data.county} County
            </p>
          )}
          {neighborhood && (
            <p style={{ fontSize: "10px", color: "#8FB6FF", margin: "2px 0 0", lineHeight: 1.3 }}>
              {neighborhood}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: "none",
            border: "none",
            color: "#999",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "0 4px",
            alignSelf: "flex-start",
          }}
        >
          ×
        </button>
      </div>

      {/* Cell label + code + data fields */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            backgroundColor: codeColor,
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 600 }}>{codeLabel}</div>
            <div style={{ fontSize: "10px", color: "#999" }}>Code: {mapCode || "—"}</div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "2px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Family Vulnerability Index</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {fvi}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Distress Score</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {distressDisplay}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Households w/ Children</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {childrenDisplay}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Households</span>
          <span style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
            {householdsDisplay}
          </span>
        </div>
      </div>
    </div>
  );
}

// (Fill layers consolidated into getUnifiedFillStyle() above)

// Org coverage circles - rendered at zip centroids to show which zips are served
// Uses small circles instead of polygon fill so base metric gradient stays visible
const orgCoverageCircleStyle = {
  id: "org-coverage-circles",
  type: "circle",
  // No filter — visibility controlled via paint opacity (feature-state can't be used in filters)
  paint: {
    "circle-color": [
      "case",
      ["boolean", ["feature-state", "childHighlighted"], false],
      "rgba(255, 0, 255, 0.50)",   // magenta when pin clicked
      "rgba(0, 28, 168, 0.50)",    // teal-blue for parent coverage
    ],
    "circle-radius": ["step", ["zoom"], 6, 10, 11],
    "circle-stroke-width": 1.5,
    "circle-stroke-color": "#FFFFFF",
    // Show circle when childHighlighted (pin click) OR density >= 1 (parent coverage)
    "circle-opacity": [
      "case",
      ["boolean", ["feature-state", "childHighlighted"], false], 1,
      [">=", ["coalesce", ["get", "density"], 0], 1], 1,
      0,
    ],
    "circle-stroke-opacity": [
      "case",
      ["boolean", ["feature-state", "childHighlighted"], false], 1,
      [">=", ["coalesce", ["get", "density"], 0], 1], 1,
      0,
    ],
  },
};

// Org coverage border (teal) - parent coverage areas
// Rendered BELOW the magenta child layer so magenta fully covers shared edges
const orgCoverageBorderTealStyle = {
  id: "org-coverage-border-teal",
  type: "line",
  paint: {
    "line-color": "rgba(0, 28, 168, 0.70)",
    "line-width": [
      "case",
      [">=", ["coalesce", ["get", "density"], 0], 1], 4,
      0,
    ],
    "line-opacity": [
      "case",
      [">=", ["coalesce", ["get", "density"], 0], 1], 0.8,
      0,
    ],
  },
};

// V2 Who overlay border. Drawn on top of everything except labels. Color +
// width are driven by the `who_type` feature property injected into
// geoJsonData based on the Who filter: "org" = pink, "parent" = dark blue,
// "" = invisible. Single layer for both cases so there's no z-order race.
const whoOverlayStyle = {
  id: "v2-who-overlay",
  type: "line",
  paint: {
    "line-color": [
      "case",
      ["==", ["coalesce", ["get", "who_type"], ""], "org"], "rgba(255, 0, 255, 1.0)",
      ["==", ["coalesce", ["get", "who_type"], ""], "parent"], "rgba(0, 28, 168, 1.0)",
      "rgba(0,0,0,0)",
    ],
    "line-width": [
      "case",
      ["!=", ["coalesce", ["get", "who_type"], ""], ""], 3.5,
      0,
    ],
    "line-opacity": [
      "case",
      ["!=", ["coalesce", ["get", "who_type"], ""], ""], 0.95,
      0,
    ],
  },
};

// Org coverage border (magenta) - selected child org's served zips
// Rendered ABOVE teal layer so it fully covers teal on shared polygon edges
const orgCoverageBorderMagentaStyle = {
  id: "org-coverage-border-magenta",
  type: "line",
  paint: {
    "line-color": "rgba(255, 0, 255, 1.0)",
    "line-width": [
      "case",
      ["boolean", ["feature-state", "childHighlighted"], false], 4,
      0,
    ],
    "line-opacity": [
      "case",
      ["boolean", ["feature-state", "childHighlighted"], false], 1.0,
      0,
    ],
  },
};

const boundaryLineStyle = {
  id: "zip-boundaries-line",
  type: "line",
  paint: {
    "line-color": [
      "case",
      ["boolean", ["feature-state", "distressSelected"], false],
      "#222831",
      "#B8001F",
    ],
    "line-width": [
      "case",
      ["boolean", ["feature-state", "distressSelected"], false],
      3.5,
      1.5,
    ],
    "line-opacity": [
      "case",
      ["boolean", ["feature-state", "distressSelected"], false],
      1,
      0.7,
    ],
  },
};

const zipLabelStyle = {
  id: "zip-labels",
  type: "symbol",
  layout: {
    "text-field": ["get", "ZCTA5CE20"],
    "text-size": 11,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
    "text-allow-overlap": false,
    "text-ignore-placement": false,
  },
  paint: {
    "text-color": [
      "case",
      ["boolean", ["feature-state", "distressSelected"], false],
      "#222831",
      ["boolean", ["feature-state", "childHighlighted"], false],
      "#ff0000",
      ["boolean", ["feature-state", "highlighted"], false],
      "#ff0000",
      "#000000",
    ],
    "text-halo-color": "#FFFFFF",
    "text-halo-width": 1.5,
    "text-opacity": 1,
  },
};

// V2 Coverage / Compare info box. Opens when a zip is clicked in
// service_coverage or distress_coverage_bivariate mode. Shows the zip's
// distress score (header) plus the list of orgs providing the selected
// assistance type for that zip. Draggable, like the other info tables.
function DraggableCoverageInfoBox({ zipCode, county, selectedCounty, distressInfo, orgs, assistanceLabel, showDistress, conditionLabel = "Distress", bivariateCode, siteMode = false, selectedOrgId = null, onOrgClick = null, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => { setPosition({ x: 0, y: 0 }); }, [zipCode]);

  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = { isDragging: true, startX: e.clientX - position.x, startY: e.clientY - position.y };
    const move = (ev) => {
      if (!dragState.current.isDragging) return;
      setPosition({ x: ev.clientX - dragState.current.startX, y: ev.clientY - dragState.current.startY });
    };
    const up = () => {
      dragState.current.isDragging = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  if (!zipCode) return null;
  // Pick the right condition score for the bivariate panel — the same row
  // carries both `distress_score` and `evictions_score`, so we just switch
  // which field we display based on the active condition.
  const conditionScoreField = conditionLabel === "Evictions" ? "evictions_score" : "distress_score";
  const conditionScore = distressInfo?.[conditionScoreField];
  const conditionDisplay = conditionScore != null ? Number(conditionScore).toFixed(1) : null;
  const bivariateLabel = bivariateCode ? COVERAGE_BIVARIATE_LABELS[bivariateCode] : null;
  const bivariateColor = bivariateCode ? FAMILY_BIVARIATE_LEGEND_COLORS[bivariateCode] : null;

  return (
    <div
      data-coverage-info-box="true"
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "30px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "340px",
        maxHeight: "460px",
        backgroundColor: "rgba(34, 40, 49, 0.97)",
        fontFamily: "'Open Sans', sans-serif",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        data-drag-handle="true"
        className="flex items-center justify-between rounded-t-lg"
        style={{ padding: "10px 14px 8px", cursor: "grab", borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}
      >
        <div>
          <div style={{ fontSize: "14px", color: "#FFFFFF", fontWeight: 600 }}>
            Zip {zipCode}
          </div>
          {county && (
            <div style={{ fontSize: "11px", color: "#AAA", marginTop: "2px" }}>{county} County</div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "0 4px" }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: "10px 14px 12px", overflowY: "auto" }}>
        {showDistress && (
          <div style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.12)", display: "flex", flexDirection: "column", gap: "10px" }}>
            {bivariateLabel && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "4px",
                  backgroundColor: bivariateColor || "#666",
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: "13px", color: "#FFFFFF", fontWeight: 600, lineHeight: 1.3 }}>
                    {bivariateLabel}
                  </div>
                  <div style={{ fontSize: "10px", color: "#999", marginTop: "1px" }}>
                    Code: {bivariateCode}
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#9DA3AE", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {conditionLabel} score
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#FFFFFF", fontWeight: 500 }}>
                {conditionScore != null && (
                  <span style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: getDistressBandColor(conditionScore),
                    flexShrink: 0,
                  }} />
                )}
                {conditionDisplay != null ? conditionDisplay : "No data"}
              </span>
            </div>
          </div>
        )}

        <div style={{ fontSize: "11px", color: "#9DA3AE", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>
          {assistanceLabel || "Assistance"} providers
        </div>
        <div style={{ fontSize: "13px", color: "#FFC857", fontWeight: 600, marginBottom: "8px" }}>
          {siteMode
            ? `${orgs.length} Active organization${orgs.length === 1 ? "" : "s"} located in this zip`
            : `${orgs.length} Active organization${orgs.length === 1 ? "" : "s"} serve${orgs.length === 1 ? "s" : ""} this zip`}
        </div>

        {orgs.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>
            {siteMode
              ? `No Active organizations providing ${assistanceLabel || "this assistance"} are located in this zip.`
              : `No Active organizations provide ${assistanceLabel || "this assistance"} to this zip.`}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {orgs.map((o) => {
              const isClickable = typeof onOrgClick === "function";
              const isSelectedOrg = selectedOrgId != null && o.id_no === selectedOrgId;
              return (
                <div
                  key={o.id_no}
                  onMouseDown={isClickable ? (e) => {
                    // Prevent the drag handler on the panel root from hijacking
                    // this mousedown; the click below still fires.
                    e.stopPropagation();
                  } : undefined}
                  onClick={isClickable ? () => onOrgClick(o) : undefined}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    backgroundColor: isSelectedOrg ? "rgba(255, 102, 255, 0.10)" : "rgba(255,255,255,0.04)",
                    border: isSelectedOrg ? "1px solid rgba(255, 102, 255, 0.45)" : "1px solid rgba(255,255,255,0.06)",
                    cursor: isClickable ? "pointer" : "default",
                  }}
                >
                  <div style={{ fontSize: "13px", color: isSelectedOrg ? SELECTED_COUNTY_COLOR : "#FFFFFF", fontWeight: 600, lineHeight: 1.25 }}>
                    {o.organization}
                  </div>
                  {o.org_parent && o.org_parent !== o.organization && (
                    <div style={{ fontSize: "10px", color: "#AAA", marginTop: "2px" }}>{o.org_parent}</div>
                  )}
                  {o.org_telephone && (
                    <div style={{ fontSize: "12px", color: "#FFFFFF", marginTop: "4px" }}>{o.org_telephone}</div>
                  )}
                  <div style={{ fontSize: "10px", color: "#BBB", marginTop: "3px", lineHeight: 1.35 }}>
                    {[o.org_address1, o.org_address2, [o.org_city, o.org_state, o.org_zip_code].filter(Boolean).join(", ")].filter(Boolean).join(" • ")}
                  </div>
                  {o.countyBreakdown && (
                    <div style={{
                      marginTop: "6px",
                      paddingTop: "6px",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <div style={{ fontSize: "11px", color: "#00A8A8", fontWeight: 500 }}>
                        Serves {o.zipCount} zip code{o.zipCount === 1 ? "" : "s"}
                      </div>
                      <div style={{
                        fontSize: "10px",
                        color: "#CCC",
                        fontWeight: 400,
                        marginTop: "2px",
                        lineHeight: 1.35,
                      }}>
                        {o.countyBreakdown.isWildcard ? (
                          "All Houston-area counties"
                        ) : (
                          <>
                            {o.countyBreakdown.pieces.map((p, i) => {
                              const isSelected =
                                selectedCounty &&
                                selectedCounty !== "All Counties" &&
                                p.county === selectedCounty;
                              return (
                                <span key={p.county}>
                                  {i > 0 && ", "}
                                  <span style={isSelected ? { color: SELECTED_COUNTY_COLOR, fontWeight: 600 } : undefined}>
                                    {p.county} ({p.count})
                                  </span>
                                </span>
                              );
                            })}
                            {o.countyBreakdown.unknown > 0 && (
                              <>
                                {o.countyBreakdown.pieces.length > 0 && ", "}
                                <span>Outside Houston area ({o.countyBreakdown.unknown})</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Expandable out-of-area orgs section for legends
// onExpandChange callback triggers teal highlight on all boundary zips
function OutOfAreaSection({ outOfAreaOrgs, onExpandChange }) {
  const [expanded, setExpanded] = useState(false);
  if (!outOfAreaOrgs || outOfAreaOrgs.length === 0) return null;

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (onExpandChange) onExpandChange(next);
  };

  return (
    <div style={{ marginTop: "8px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div
        onClick={handleToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer",
          fontSize: "11px",
          color: "#888",
        }}
      >
        <span style={{ color: "#EB6E1F", fontSize: "13px", lineHeight: 1 }}>
          {expanded ? "▾" : "▸"}
        </span>
        <span>
          {outOfAreaOrgs.length} org{outOfAreaOrgs.length !== 1 ? "s" : ""} located outside area
        </span>
      </div>
      {expanded && (
        <div style={{ marginTop: "6px", paddingLeft: "4px" }}>
          {outOfAreaOrgs.map((org) => (
            <div
              key={org.key}
              style={{
                fontSize: "11px",
                color: "#555",
                marginBottom: "4px",
                lineHeight: 1.4,
              }}
            >
              <span style={{ fontWeight: 500 }}>{org.organization}</span>
              {org.org_telephone && (
                <span style={{ color: "#888" }}> · {org.org_telephone}</span>
              )}
              {org.org_city && (
                <span style={{ color: "#AAA", fontStyle: "italic" }}>
                  {" "}— {org.org_city}, {org.org_state}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Parent coverage legend component - shows flat purple swatch for parent mode
function ParentCoverageLegend({ parentOrgName, assistanceLabel, orgCount, county, outOfAreaOrgs, onOutOfAreaToggle, viewMode }) {
  return (
    <div
      data-legend="true"
      className="absolute bottom-6 left-4 rounded-lg shadow-lg"
      style={{
        backgroundColor: "rgba(255,255,255,0.95)",
        padding: "12px 16px",
        fontFamily: "'Open Sans', sans-serif",
        fontSize: "12px",
        maxWidth: "260px",
      }}
    >
      {assistanceLabel && (
        <div style={{ fontWeight: 600, marginBottom: "4px", color: "#222831", fontSize: "13px" }}>
          {assistanceLabel}
        </div>
      )}
      {parentOrgName && (
        <div style={{ fontWeight: 500, marginBottom: "8px", color: "#652C57", fontSize: "12px" }}>
          {parentOrgName} — {orgCount} child{orgCount !== 1 ? "ren" : ""}
        </div>
      )}

      {/* Parent coverage swatch */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <div
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "4px",
            backgroundColor: PARENT_COVERAGE_COLOR,
            marginLeft: "2px",
          }}
        />
        <span style={{ color: "#444" }}>Parent coverage area</span>
      </div>

      {/* Pin legend */}
      <div style={{ marginTop: "6px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <MapPinIcon size={18} active={false} />
          <span style={{ color: "#444" }}>Organization location</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <MapPinIcon size={18} active={true} />
          <span style={{ color: "#444" }}>Selected organization</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "4px",
              backgroundColor: "rgba(255, 0, 255, 0.50)",
              marginLeft: "2px",
            }}
          />
          <span style={{ color: "#444" }}>Selected org's zips</span>
        </div>
      </div>

      {county && county !== "All Counties" && (
        <div style={{ marginTop: "6px", color: "#888", fontSize: "11px" }}>
          {county} County
        </div>
      )}

      <MetricLegendBar viewMode={viewMode} />

      <OutOfAreaSection outOfAreaOrgs={outOfAreaOrgs} onExpandChange={onOutOfAreaToggle} />
    </div>
  );
}

// Distress score legend bar - 5 quintile bands: blue → green → yellow → orange → red
function DistressLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Distress Score
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 1, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(66, 133, 244, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(76, 175, 80, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(255, 213, 0, 0.45)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(245, 124, 0, 0.50)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(220, 50, 50, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
        <span>0</span>
        <span>20</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666", marginTop: "2px" }}>
        <span>Less distress</span>
        <span>More distress</span>
      </div>
      <div style={{ fontSize: "9px", color: "#888", marginTop: "3px", fontStyle: "italic" }}>
        Score = rank-percentile across all Houston-area zips
      </div>
    </div>
  );
}

// Methodology blurbs shown when hovering the ⓘ icon next to the metric dropdown.
// Keys match `displayMetric` values; only metrics listed here show the icon.
// Edit copy here without touching component code.
const METRIC_INFO_BLURBS = {
  family_vulnerability: "Family Vulnerability Index. Combines distress score with the number of households with children in each zip. Higher scores flag zips where many family households are exposed to high distress.",
  family_bivariate: "3×3 grid: distress (vertical) crossed with the share of households with children (horizontal). Top-right (33) is the priority corner — high distress overlapping with a large family population. Bottom-left (11) is the baseline.",
  bivariate: "3×3 grid: distress (vertical) crossed with funding gap (horizontal — how under-funded the zip is relative to peers). Top-right (33) flags high distress with a large funding gap — the priority corner. Bottom-left (11) is the baseline.",
  working_poor: "Combines three at-risk indicators (no health insurance, SNAP enrollment, no high school diploma) minus the unemployment rate — isolating employed residents in distress. Normalized 0–100.",
  efficiency_ratio: "Household need (distress score × number of households) divided by available funding dollars in the zip. Rank-percentile normalized 0–100. Higher scores flag zips where need outpaces funding.",
};

// Gold ⓘ icon next to the metric dropdown. On hover, reveals the methodology
// blurb in a tooltip below. Only renders when the active metric has a blurb
// in METRIC_INFO_BLURBS (otherwise returns null).
function MetricInfoIcon({ blurb }) {
  const [show, setShow] = useState(false);
  if (!blurb) return null;
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "help", flexShrink: 0 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        backgroundColor: "#2E5A88",
        color: "#FFFFFF",
        fontFamily: "'Open Sans', sans-serif",
        fontSize: "14px",
        fontWeight: 500,
        fontStyle: "italic",
        lineHeight: 1,
        boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
      }}>i</span>
      {show && (
        <div
          style={{
            position: "absolute",
            left: "0",
            top: "28px",
            backgroundColor: "rgba(34, 40, 49, 0.97)",
            color: "#FFFFFF",
            padding: "10px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 400,
            lineHeight: 1.45,
            width: "300px",
            zIndex: 1000,
            pointerEvents: "none",
            whiteSpace: "normal",
            boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
          }}
        >
          {blurb}
        </div>
      )}
    </span>
  );
}

// Working poor legend bar - same quintile colors as distress
function WorkingPoorLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Working Poor Score
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 1, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(66, 133, 244, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(76, 175, 80, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(255, 213, 0, 0.45)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(245, 124, 0, 0.50)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(220, 50, 50, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
        <span>0</span>
        <span>20</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
}

// Population legend bar - 5 quintile bands (purple gradient)
function FamilyVulnerabilityLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Family Vulnerability Index
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 1, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(66, 133, 244, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(76, 175, 80, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(255, 213, 0, 0.45)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(245, 124, 0, 0.50)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(220, 50, 50, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
        <span>0</span>
        <span>20</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
}

// 3x3 bivariate legend for distress × households_w_children (bright palette)
function FamilyBivariateLegend({ standalone }) {
  const size = 28;
  // Solid-color approximations of the FAM_* palette (for legend swatches)
  const colors = [
    ["#E8E8E8", "#BED7E6", "#5FA5D7"],  // row 1 (low distress): low→high children
    ["#E6C3D2", "#B4A5C3", "#8282C3"],  // row 2 (mid distress)
    ["#DC6E8C", "#AA5F9B", "#6E3282"],  // row 3 (high distress)
  ];
  const codes = [
    ["31", "32", "33"], // high distress on top
    ["21", "22", "23"],
    ["11", "12", "13"],
  ];
  const darkCells = new Set(["13", "23", "31", "32", "33"]);
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "6px" }}>
        Distress vs. Children %
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: `${size * 3}px`, marginRight: "2px" }}>
          <span style={{ fontSize: "8px", color: "#666", lineHeight: 1, writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center", height: "100%" }}>
            Distress →
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[...colors].reverse().map((row, ri) => (
            <div key={ri} style={{ display: "flex" }}>
              {row.map((color, ci) => {
                const code = codes[ri][ci];
                return (
                  <div
                    key={ci}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      backgroundColor: color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "8px",
                      fontWeight: 500,
                      color: darkCells.has(code) ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.5)",
                    }}
                  >
                    {code}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ fontSize: "8px", color: "#666", textAlign: "center", marginTop: "2px" }}>
            Children % →
          </div>
        </div>
      </div>
    </div>
  );
}

// Evictions legend bar - same quintile colors as distress
// Format a quintile-breakpoint score (0-100) for legend display.
// One decimal when small, integer otherwise — keeps the strip readable.
function EvictionsLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Evictions Score
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 1, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(66, 133, 244, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(76, 175, 80, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(255, 213, 0, 0.45)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(245, 124, 0, 0.50)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(220, 50, 50, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
        <span>0</span>
        <span>20</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666", marginTop: "2px" }}>
        <span>Fewer evictions</span>
        <span>More evictions</span>
      </div>
      <div style={{ fontSize: "9px", color: "#888", marginTop: "3px", fontStyle: "italic" }}>
        Score = rank-percentile across all Houston-area zips
      </div>
    </div>
  );
}

// Funding level legend bar - same quintile colors as distress
function FundingLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Funding Level Score
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 1, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(66, 133, 244, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(76, 175, 80, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(255, 213, 0, 0.45)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(245, 124, 0, 0.50)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(220, 50, 50, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
        <span>0</span>
        <span>20</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
}

function EfficiencyLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Efficiency Score
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 1, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(66, 133, 244, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(76, 175, 80, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(255, 213, 0, 0.45)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(245, 124, 0, 0.50)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(220, 50, 50, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
        <span>0</span>
        <span>20</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
}

function BivariateLegend({ standalone }) {
  const size = 28;
  // Solid-color approximations of the bivariate fill palette (Stevens, 33 = worst)
  const colors = [
    ["#E8E8E8", "#BED7E6", "#5FA5D7"], // row 1 (low distress): low→high funding gap
    ["#E6C3D2", "#B4A5C3", "#8282C3"], // row 2 (mid distress)
    ["#DC6E8C", "#AA5F9B", "#6E3282"], // row 3 (high distress)
  ];
  // Codes grid matching display order (reversed: high distress at top)
  const codes = [
    ["31", "32", "33"], // high distress
    ["21", "22", "23"], // mid distress
    ["11", "12", "13"], // low distress
  ];
  // Use white text on dark cells, dark text on light cells
  const darkCells = new Set(["13", "23", "31", "32", "33"]);
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "6px" }}>
        Distress vs. Funding
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px" }}>
        {/* Y-axis label */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: `${size * 3}px`, marginRight: "2px" }}>
          <span style={{ fontSize: "8px", color: "#666", lineHeight: 1, writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center", height: "100%" }}>
            Distress →
          </span>
        </div>
        {/* 3x3 grid */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[...colors].reverse().map((row, ri) => (
            <div key={ri} style={{ display: "flex" }}>
              {row.map((color, ci) => {
                const code = codes[ri][ci];
                return (
                  <div
                    key={ci}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      backgroundColor: color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "8px",
                      fontWeight: 500,
                      color: darkCells.has(code) ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.4)",
                    }}
                  >
                    {code}
                  </div>
                );
              })}
            </div>
          ))}
          {/* X-axis label */}
          <div style={{ fontSize: "8px", color: "#666", textAlign: "center", marginTop: "2px" }}>
            Funding Gap →
          </div>
        </div>
      </div>
    </div>
  );
}

// Service coverage legend (v2). Shared blue→red palette with the Conditions
// maps so 0 = best (most orgs serving this zip, blue) and 100 = worst
// (fewest orgs, red). Score is the inverse rank-percentile of org count, so
// the quintile bands fall along the displayed distribution.
function ServiceCoverageLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Coverage Gap Score
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 1, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(66, 133, 244, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(76, 175, 80, 0.40)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(255, 213, 0, 0.45)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(245, 124, 0, 0.50)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(220, 50, 50, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
        <span>0</span>
        <span>20</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666", marginTop: "2px" }}>
        <span>More orgs</span>
        <span>Fewer orgs</span>
      </div>
      <div style={{ fontSize: "9px", color: "#888", marginTop: "3px", fontStyle: "italic" }}>
        White = no Active orgs · Score = inverse rank-percentile of org count
      </div>
    </div>
  );
}

// Distress × Service Coverage bivariate legend (v2). Stevens palette; 33 =
// high distress + low coverage = worst corner (dark purple).
function ConditionCoverageBivariateLegend({ standalone, conditionLabel }) {
  const size = 28;
  const colors = [
    ["#E8E8E8", "#BED7E6", "#5FA5D7"], // row 1 (low condition)
    ["#E6C3D2", "#B4A5C3", "#8282C3"], // row 2 (mid condition)
    ["#DC6E8C", "#AA5F9B", "#6E3282"], // row 3 (high condition)
  ];
  const codes = [
    ["31", "32", "33"], // high condition at top
    ["21", "22", "23"],
    ["11", "12", "13"],
  ];
  const darkCells = new Set(["13", "23", "31", "32", "33"]);
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "6px" }}>
        {conditionLabel} × Resources
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: `${size * 3}px`, marginRight: "2px" }}>
          <span style={{ fontSize: "8px", color: "#666", lineHeight: 1, writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center", height: "100%" }}>
            {conditionLabel} →
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[...colors].reverse().map((row, ri) => (
            <div key={ri} style={{ display: "flex" }}>
              {row.map((color, ci) => {
                const code = codes[ri][ci];
                return (
                  <div
                    key={ci}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      backgroundColor: color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "8px",
                      fontWeight: 500,
                      color: darkCells.has(code) ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.4)",
                    }}
                  >
                    {code}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ fontSize: "8px", color: "#666", textAlign: "center", marginTop: "2px" }}>
            Coverage Gap →
          </div>
        </div>
      </div>
      <div style={{ fontSize: "9px", color: "#888", marginTop: "5px", fontStyle: "italic", maxWidth: "180px", lineHeight: 1.3 }}>
        33 (top-right, dark purple) = high {conditionLabel.toLowerCase()} + low coverage — the priority corner.
      </div>
    </div>
  );
}

// Metric legend bar switcher - renders the correct legend bar based on viewMode
function MetricLegendBar({ viewMode, standalone }) {
  if (viewMode === "no_base_map") return null;
  if (viewMode === "service_coverage") return <ServiceCoverageLegendBar standalone={standalone} />;
  if (viewMode === "distress_coverage_bivariate") return <ConditionCoverageBivariateLegend standalone={standalone} conditionLabel="Distress" />;
  if (viewMode === "evictions_coverage_bivariate") return <ConditionCoverageBivariateLegend standalone={standalone} conditionLabel="Evictions" />;
  if (viewMode === "working_poor") return <WorkingPoorLegendBar standalone={standalone} />;
  if (viewMode === "evictions") return <EvictionsLegendBar standalone={standalone} />;
  if (viewMode === "family_vulnerability") return <FamilyVulnerabilityLegendBar standalone={standalone} />;
  if (viewMode === "family_bivariate") return <FamilyBivariateLegend standalone={standalone} />;
  if (viewMode === "funding_level") return <FundingLegendBar standalone={standalone} />;
  if (viewMode === "efficiency_ratio") return <EfficiencyLegendBar standalone={standalone} />;
  if (viewMode === "bivariate") return <BivariateLegend standalone={standalone} />;
  return <DistressLegendBar standalone={standalone} />;
}

// Base legend - always visible, shows distress colors from the start
function BaseLegend({ viewMode }) {
  if (viewMode === "no_base_map") return null;
  return (
    <div
      data-legend="true"
      className="absolute bottom-6 left-4 rounded-lg shadow-lg"
      style={{
        backgroundColor: "rgba(255,255,255,0.95)",
        padding: "12px 16px",
        fontFamily: "'Open Sans', sans-serif",
        fontSize: "12px",
        maxWidth: "240px",
      }}
    >
      <MetricLegendBar viewMode={viewMode} standalone />
    </div>
  );
}

// Simple legend for non-density mode (assistance selected, no parent)
function SimpleLegend({ assistanceLabel, orgCount, county, outOfAreaOrgs, onOutOfAreaToggle, viewMode }) {
  return (
    <div
      data-legend="true"
      className="absolute bottom-6 left-4 rounded-lg shadow-lg"
      style={{
        backgroundColor: "rgba(255,255,255,0.95)",
        padding: "12px 16px",
        fontFamily: "'Open Sans', sans-serif",
        fontSize: "12px",
        maxWidth: "240px",
      }}
    >
      {assistanceLabel && (
        <div style={{ fontWeight: 600, marginBottom: "8px", color: "#222831", fontSize: "13px" }}>
          {assistanceLabel}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <MapPinIcon size={18} active={false} />
        <span style={{ color: "#444" }}>Organization location</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <MapPinIcon size={18} active={true} />
        <span style={{ color: "#444" }}>Selected organization</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <div
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "4px",
            backgroundColor: "rgba(255, 0, 255, 0.50)",
            marginLeft: "2px",
          }}
        />
        <span style={{ color: "#444" }}>Selected org's zips</span>
      </div>
      <div style={{ marginTop: "8px", color: "#888", fontSize: "11px" }}>
        {orgCount} organization{orgCount !== 1 ? "s" : ""} shown
        {county && county !== "All Counties" && <span> · {county} County</span>}
      </div>

      <MetricLegendBar viewMode={viewMode} />

      <OutOfAreaSection outOfAreaOrgs={outOfAreaOrgs} onExpandChange={onOutOfAreaToggle} />
    </div>
  );
}

const VIEW_MODE_OPTIONS = [
  { value: "distress", label: "Distress" },
  { value: "working_poor", label: "Working Poor" },
  { value: "evictions", label: "Evictions" },
  { value: "family_vulnerability", label: "Family Vulnerability Index" },
  { value: "funding_level", label: "Funding Level" },
  { value: "efficiency_ratio", label: "Distress vs. Funding" },
  { value: "no_base_map", label: "No Base Map" },
  { value: "filter_view", label: "Filter Overlay" },
];

function ViewModeDropdown({ viewMode, onViewModeChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLabel = VIEW_MODE_OPTIONS.find((o) => o.value === viewMode)?.label || "Distress";

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="transition-all duration-200 hover:brightness-125"
        style={{
          height: "36px",
          width: "100%",
          padding: "0 14px",
          borderRadius: "10px",
          fontFamily: "'Open Sans', sans-serif",
          fontSize: "14px",
          fontWeight: 500,
          backgroundColor: "#CFD11A",
          color: "#000000",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
        }}
      >
        <span>{currentLabel}</span>
        <svg
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        >
          <path d="M1 1.5L6 6.5L11 1.5" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            backgroundColor: "rgba(34, 40, 49, 0.95)",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.15)",
            overflow: "hidden",
            zIndex: 50,
            backdropFilter: "blur(4px)",
          }}
        >
          {VIEW_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onViewModeChange(option.value);
                setIsOpen(false);
              }}
              className="transition-all duration-150 hover:brightness-150"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 14px",
                fontFamily: "'Open Sans', sans-serif",
                fontSize: "13px",
                fontWeight: viewMode === option.value ? 600 : 400,
                color: option.value === "filter_view" ? "#EB6E1F" : "#FFFFFF",
                backgroundColor: viewMode === option.value ? "rgba(255,255,255,0.1)" : "transparent",
                border: "none",
                borderBottom: option.value !== "filter_view" ? "1px solid rgba(255,255,255,0.08)" : "none",
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const MapboxMapV2 = forwardRef(function MapboxMapV2({
  county,
  assistanceType,
  parentOrg = "",
  organization = "",
  viewMode: incomingViewMode = "distress",
}, ref) {
  // Translate the simplified v2 viewMode into the legacy isBaseView / activeBase
  // pair the rest of the file is built around.
  //   service_pins → filter_view + no underlying base map
  //   everything else → base view at that metric
  const viewMode = incomingViewMode === "service_pins" ? "filter_view" : incomingViewMode;
  const activeBase = incomingViewMode === "service_pins" ? "no_base_map" : incomingViewMode;

  // V2 has no zip filter from the sidebar; parentOrg + organization come in
  // as props from the new Who section.
  const zipCode = "";

  const { directory, assistance, zipCodes, zipCodeData } = useAppData();
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Zoom level tracking for org labels feature
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [showOrgLabels, setShowOrgLabels] = useState(false);
  const ORG_LABEL_ZOOM_THRESHOLD = 9;

  // Draggable org label button position
  const [orgLabelBtnPos, setOrgLabelBtnPos] = useState(null); // null = center
  const orgLabelBtnDrag = useRef({ isDragging: false, startX: 0, startY: 0 });

  // Hover tooltip state
  const [hoveredOrg, setHoveredOrg] = useState(null);

  // GeoJSON data for zip boundaries
  const [allGeoJsonData, setAllGeoJsonData] = useState(null);
  const [geoJsonLoading, setGeoJsonLoading] = useState(true);

  // Selected org for showing served zips (teal overlay)
  const [selectedOrgKey, setSelectedOrgKey] = useState(null);
  const [infoBoxData, setInfoBoxData] = useState(null);
  // Coverage / Compare info box: which org row the user clicked to highlight
  // that org's served zips in magenta. Tracked separately from selectedOrgKey
  // because selectedOrgKey is wired to pin lifecycle in Sites and clearing it
  // there would tangle the two surfaces.
  const [coverageInfoBoxOrgKey, setCoverageInfoBoxOrgKey] = useState(null);

  // Per-mode data-table state (base view zip click). The mode-specific info
  // box decides whether to render off its own slot, but the border highlight
  // is managed centrally by the consolidated v2 sync effect below.
  const [distressTableZip, setDistressTableZip] = useState(null);
  const [workingPoorTableZip, setWorkingPoorTableZip] = useState(null);
  const [evictionsTableZip, setEvictionsTableZip] = useState(null);
  const [fviTableZip, setFviTableZip] = useState(null);
  const [fundingTableZip, setFundingTableZip] = useState(null);
  const [efficiencyTableZip, setEfficiencyTableZip] = useState(null);
  const [bivariateTableZip, setBivariateTableZip] = useState(null);
  // V2: shared info-box state for Coverage + Compare modes. Holds the clicked
  // zip code; renders distress summary + orgs serving that zip for the
  // currently selected assistance.
  const [coverageTableZip, setCoverageTableZip] = useState(null);
  // V2: most-recent selected zip across all v2 base modes (Conditions
  // Distress/Evictions, Resources Coverage, Compare). Used to migrate the
  // border highlight + per-mode info box when the user switches modes so the
  // same zip stays selected. Cleared on Reset, on click-outside, or when the
  // user clicks the same zip again.
  const lastV2SelectedZipRef = useRef(null);
  // V2: single shared ref for the feature ID currently carrying the border
  // highlight (the distressSelected feature state). Replaces the per-table
  // refs in the consolidated sync effect — those were racing during mode
  // migrations and each clearing the highlight the others had just set.
  const v2HighlightedFeatureRef = useRef(null);
  const [efficiencySubMode, setEfficiencySubMode] = useState("efficiency"); // "efficiency" or "bivariate"
  const [familySubMode, setFamilySubMode] = useState("index"); // "index" or "bivariate"

  // Zip search state
  const [searchZipValue, setSearchZipValue] = useState("");


  // Track highlighted zip codes (teal - individual child click)
  const childHighlightedRef = useRef(new Set());

  // Track base highlighted zip (from zip code filter dropdown)
  const baseHighlightedRef = useRef(null);

  // Hovered feature for boundary hover
  const hoveredFeatureRef = useRef(null);

  // Houston-area zip codes from Supabase
  const houstonZips = useMemo(() => {
    if (!zipCodes) return new Set();
    return new Set(
      zipCodes.filter((z) => z.houston_area === "Y").map((z) => z.zip_code)
    );
  }, [zipCodes]);

  // Distress score lookup: zip_code -> distress_score (any row with a populated
  // distress_score gets colored). Uses -1 sentinel for missing data so score 0
  // (best zip) still gets colored.
  const distressLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code && d.distress_score != null) {
        lookup[d.zip_code] = Number(d.distress_score);
      }
    });
    return lookup;
  }, [zipCodeData]);

  // Working poor lookup: zip_code -> working_poor_score value
  const workingPoorLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code && d.working_poor_score != null) {
        lookup[d.zip_code] = Number(d.working_poor_score) || 0;
      }
    });
    return lookup;
  }, [zipCodeData]);

  // Family Vulnerability Index lookup: zip_code -> family_vulnerability_index (0-100)
  const fviScoreLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code && d.family_vulnerability_index != null) {
        lookup[d.zip_code] = Number(d.family_vulnerability_index);
      }
    });
    return lookup;
  }, [zipCodeData]);

  // Family bivariate code lookup: zip_code -> fvi_map_code ("11".."33") from zip_code_data.
  const familyBivariateCodeLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code && d.fvi_map_code != null) {
        lookup[d.zip_code] = String(d.fvi_map_code);
      }
    });
    return lookup;
  }, [zipCodeData]);

  // V2: zip → county lookup, sourced from the zip_codes table. Used to build
  // the per-county "Serves N zips" breakdown shown in the pin info box.
  const zipToCountyLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodes) return lookup;
    zipCodes.forEach((z) => {
      if (z.zip_code && z.county) lookup[z.zip_code] = z.county;
    });
    return lookup;
  }, [zipCodes]);

  // Build a structured breakdown of a pinned org's served zips, grouped by
  // county. Sort by count desc, alphabetical tie-break. Returns:
  //   { isWildcard, pieces: [{ county, count }], unknown }
  // JSX consumers can color the user's selected county; canvas / text
  // consumers go through formatCountyBreakdownText below.
  const buildCountyBreakdown = useCallback((clientZips, isWildcard) => {
    if (isWildcard) return { isWildcard: true, pieces: [], unknown: 0 };
    if (!Array.isArray(clientZips) || clientZips.length === 0) {
      return { isWildcard: false, pieces: [], unknown: 0 };
    }
    const counts = {};
    let unknown = 0;
    clientZips.forEach((z) => {
      const c = zipToCountyLookup[z];
      if (!c) { unknown += 1; return; }
      counts[c] = (counts[c] || 0) + 1;
    });
    const pieces = Object.entries(counts)
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .map(([c, n]) => ({ county: c, count: n }));
    return { isWildcard: false, pieces, unknown };
  }, [zipToCountyLookup]);

  // Population raw value lookup: zip_code -> population (for info box display)
  const populationLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code && d.population != null) {
        lookup[d.zip_code] = Number(d.population) || 0;
      }
    });
    return lookup;
  }, [zipCodeData]);

  // Distress data lookup: zip_code -> full zip_code_data record (for popup info box)
  const distressDataLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code) {
        lookup[d.zip_code] = d;
      }
    });
    return lookup;
  }, [zipCodeData]);

  // Greater Houston medians (rows where distress_score is populated)
  const houstonMedians = useMemo(() => computeHoustonMedians(zipCodeData), [zipCodeData]);

  // Working poor data lookup: zip_code -> full zip_code_data record (same data, different info box)
  const workingPoorDataLookup = distressDataLookup;

  // Working poor metro medians (rows where working_poor_score is populated)
  const workingPoorMedians = useMemo(() => computeWorkingPoorMedians(zipCodeData), [zipCodeData]);

  // Evictions lookup: zip_code -> evictions_score (any row with a populated score)
  const evictionsLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code && d.evictions_score != null) {
        lookup[d.zip_code] = Number(d.evictions_score);
      }
    });
    return lookup;
  }, [zipCodeData]);

  // Funding score lookup: zip_code -> zip_fin_fund_score (from zip_code_data table)
  const fundingScoreLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code && d.zip_fin_fund_score != null) {
        lookup[d.zip_code] = Number(d.zip_fin_fund_score);
      }
    });
    return lookup;
  }, [zipCodeData]);

  // Funding data lookup: zip_code -> full zip_code_data record (for popup info box)
  const fundingDataLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code) {
        lookup[d.zip_code] = d;
      }
    });
    return lookup;
  }, [zipCodeData]);

  // Efficiency ratio score lookup: zip_code -> normal_efficiency_ratio (normalized 0-100, for map coloring)
  const efficiencyScoreLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code && d.normal_efficiency_ratio != null) {
        lookup[d.zip_code] = Number(d.normal_efficiency_ratio);
      }
    });
    return lookup;
  }, [zipCodeData]);

  // Bivariate map code lookup: zip_code -> bivariate_map_code (text, e.g. "31", from zip_code_data table)
  const bivariateCodeLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code && d.bivariate_map_code != null) {
        lookup[d.zip_code] = String(d.bivariate_map_code);
      }
    });
    return lookup;
  }, [zipCodeData]);

  // Evictions data lookup: zip_code -> full zip_code_data record (for popup table)
  const evictionsDataLookup = distressDataLookup;

  // Evictions metro medians (rows where evictions_score is populated)
  const evictionsMedians = useMemo(() => computeEvictionsMedians(zipCodeData), [zipCodeData]);

  // Family Vulnerability medians (rows where family_vulnerability_index is populated)
  const familyMedians = useMemo(() => computeFamilyMedians(zipCodeData), [zipCodeData]);

  // Dynamic ranked counts — per-metric counts of rows with a populated score
  const distressRankedCount = useMemo(() => {
    if (!zipCodeData) return 0;
    return zipCodeData.filter(d => d.distress_score != null).length;
  }, [zipCodeData]);

  const workingPoorRankedCount = useMemo(() => {
    if (!zipCodeData) return 0;
    return zipCodeData.filter(d => d.working_poor_score != null).length;
  }, [zipCodeData]);

  const evictionsRankedCount = useMemo(() => {
    if (!zipCodeData) return 0;
    return zipCodeData.filter(d => d.evictions_score != null).length;
  }, [zipCodeData]);

  const fviRankedCount = useMemo(() => {
    if (!zipCodeData) return 0;
    return zipCodeData.filter(d => d.family_vulnerability_index != null).length;
  }, [zipCodeData]);

  // Per-row in-app ranks (since `rank` / `working_poor_rank` are no longer
  // stored as columns). Rank by descending score within rows where that score
  // is populated, ties broken by zip_code asc.
  const distressRankLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    const ranked = zipCodeData
      .filter(d => d.distress_score != null)
      .sort((a, b) => {
        const diff = Number(b.distress_score) - Number(a.distress_score);
        if (diff !== 0) return diff;
        return String(a.zip_code).localeCompare(String(b.zip_code));
      });
    ranked.forEach((d, i) => { lookup[d.zip_code] = i + 1; });
    return lookup;
  }, [zipCodeData]);

  const workingPoorRankLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    const ranked = zipCodeData
      .filter(d => d.working_poor_score != null)
      .sort((a, b) => {
        const diff = Number(b.working_poor_score) - Number(a.working_poor_score);
        if (diff !== 0) return diff;
        return String(a.zip_code).localeCompare(String(b.zip_code));
      });
    ranked.forEach((d, i) => { lookup[d.zip_code] = i + 1; });
    return lookup;
  }, [zipCodeData]);

  const evictionsRankLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    const ranked = zipCodeData
      .filter(d => d.evictions_score != null)
      .sort((a, b) => {
        const diff = Number(b.evictions_score) - Number(a.evictions_score);
        if (diff !== 0) return diff;
        return String(a.zip_code).localeCompare(String(b.zip_code));
      });
    ranked.forEach((d, i) => { lookup[d.zip_code] = i + 1; });
    return lookup;
  }, [zipCodeData]);

  const fviRankLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    const ranked = zipCodeData
      .filter(d => d.family_vulnerability_index != null)
      .sort((a, b) => {
        const diff = Number(b.family_vulnerability_index) - Number(a.family_vulnerability_index);
        if (diff !== 0) return diff;
        return String(a.zip_code).localeCompare(String(b.zip_code));
      });
    ranked.forEach((d, i) => { lookup[d.zip_code] = i + 1; });
    return lookup;
  }, [zipCodeData]);

  // Is the map in base view (clean metric) vs filter view (overlay + metric)?
  const isBaseView = viewMode !== "filter_view";

  // Which metric to display: in base view use viewMode, in filter view use activeBase
  // When efficiency_ratio is active and toggle is set to bivariate, use "bivariate" metric
  const rawDisplayMetric = isBaseView ? viewMode : activeBase;
  let displayMetric = rawDisplayMetric;
  if (rawDisplayMetric === "efficiency_ratio" && efficiencySubMode === "bivariate") {
    displayMetric = "bivariate";
  } else if (rawDisplayMetric === "family_vulnerability" && familySubMode === "bivariate") {
    displayMetric = "family_bivariate";
  }

  // Memoized unified fill style - recomputed when viewMode or activeBase change
  const unifiedFillStyle = useMemo(() => {
    return getUnifiedFillStyle(displayMetric, !isBaseView, !isBaseView);
  }, [displayMetric, isBaseView]);

  // Zip codes by county lookup
  const houstonZipsByCounty = useMemo(() => {
    const byCounty = {};
    if (!zipCodes) return byCounty;
    zipCodes.filter((z) => z.houston_area === "Y").forEach((z) => {
      if (!byCounty[z.county]) byCounty[z.county] = new Set();
      byCounty[z.county].add(z.zip_code);
    });
    return byCounty;
  }, [zipCodes]);

  // Zip codes to draw on the map (boundaries) — sourced from zipCodeData so every
  // zip in the reporting dataset can render (not limited to houston_area=Y).
  // Zips without the active metric's key data fall through to the transparent
  // fallback fill but still get the red boundary outline and are clickable.
  const boundaryZips = useMemo(() => {
    if (!zipCodeData) return new Set();
    const filtered = (!county || county === "All Counties")
      ? zipCodeData
      : zipCodeData.filter((d) => d.county === county);
    return new Set(filtered.map((d) => d.zip_code).filter(Boolean));
  }, [county, zipCodeData]);

  // Helper: does this org serve the selected geographic area?
  const orgServesArea = useCallback((r) => {
    const clientZips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
    if (clientZips.includes("99999")) return true;
    if (zipCode) return clientZips.includes(zipCode);
    if (county && county !== "All Counties") {
      const countyZipSet = houstonZipsByCounty[county];
      if (!countyZipSet) return false;
      return clientZips.some((z) => countyZipSet.has(z));
    }
    return true;
  }, [county, zipCode, houstonZipsByCounty]);

  // Resolve assistance name to assist_id
  const selectedAssistId = useMemo(() => {
    if (!assistanceType || !assistance) return null;
    const match = assistance.find((a) => a.assistance === assistanceType);
    return match ? match.assist_id : null;
  }, [assistanceType, assistance]);

  // -- V2 service coverage lookups -----------------------------------------
  // Count of distinct active orgs serving each zip for the selected assistance.
  // Wildcard "99999" in client_zip_codes means "serves all zips" — expand to
  // boundaryZips so the count reflects displayed zips.
  const coverageCountLookup = useMemo(() => {
    const lookup = {};
    if (!directory || !selectedAssistId) return lookup;
    directory.forEach((r) => {
      if (String(r.assist_id) !== String(selectedAssistId)) return;
      if (r.status_id !== 1) return;
      const clientZips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      const zips = clientZips.includes("99999") ? Array.from(boundaryZips) : clientZips;
      const seen = new Set();
      zips.forEach((z) => {
        if (!z || seen.has(z)) return;
        seen.add(z);
        lookup[z] = (lookup[z] || 0) + 1;
      });
    });
    return lookup;
  }, [directory, selectedAssistId, boundaryZips]);

  // Convert raw counts → 0-100 inverse rank-percentile (the "coverage gap"
  // score). Convention: 0 = best (most orgs serving this zip), 100 = worst
  // (fewest orgs). This matches every other Reports map where 0 is good and
  // 100 is bad. Sort descending by count so the zip with the most orgs ranks
  // first → score near 0. Zips with 0 orgs stay absent from the lookup so
  // they render transparent (visually distinct from "few but some"). Ties
  // broken by zip code for stability.
  const coverageScoreLookup = useMemo(() => {
    const scores = {};
    const entries = Object.entries(coverageCountLookup).filter(([, c]) => c > 0);
    if (entries.length === 0) return scores;
    const sorted = entries.slice().sort((a, b) => {
      const diff = b[1] - a[1];
      if (diff !== 0) return diff;
      return a[0].localeCompare(b[0]);
    });
    sorted.forEach(([zip], i) => {
      scores[zip] = Math.round(((i + 1) / sorted.length) * 100);
    });
    return scores;
  }, [coverageCountLookup]);

  // 3×3 bivariate code = distress rank × coverage-gap rank.
  // Worst corner ("33") = high distress + low coverage = high gap. Matches the
  // Stevens convention used by the existing bivariate maps. Since
  // coverageScoreLookup is now the gap score (0 = most orgs, 100 = fewest),
  // the coverage rank IS the gap rank — no inversion needed. Zips with no
  // orgs at all (absent from the lookup) default to 100 → worst gap.
  //
  // Round to the nearest integer before bucketing so the classification
  // tracks what the user sees in the info box. Without rounding, a score of
  // 66.7 falls into the mid bucket and a score of 67.8 jumps to high — two
  // values that read as the same thing on screen but disagree on the label.
  // With rounding, both 66.7 (→ 67) and 67.8 (→ 68) land in the high bucket.
  // The Y-axis of the coverage bivariate is the active "condition" metric —
  // distress by default, evictions when the user picks Evictions on the
  // Compare-mode condition toggle. The X-axis (coverage gap) is constant.
  // Recomputing on viewMode change is cheap (a few hundred zips).
  const coverageBivariateCodeLookup = useMemo(() => {
    const codes = {};
    const bucket = (v) => {
      if (v == null || v < 0) return 0;
      const r = Math.round(Number(v));
      if (r >= 67) return 3;
      if (r >= 34) return 2;
      return 1;
    };
    const yLookup = viewMode === "evictions_coverage_bivariate"
      ? evictionsLookup
      : distressLookup;
    const allZips = new Set([
      ...Object.keys(yLookup),
      ...Object.keys(coverageScoreLookup),
    ]);
    allZips.forEach((zip) => {
      const yRank = bucket(yLookup[zip]);
      if (!yRank) return;
      const coverageGapRank = bucket(coverageScoreLookup[zip] ?? 100);
      codes[zip] = `${yRank}${coverageGapRank}`;
    });
    return codes;
  }, [coverageScoreLookup, distressLookup, evictionsLookup, viewMode]);

  // Filter directory records by all active filters (status always Active = 1)
  // Filtering is based on client_zip_codes (service area), not org location
  const filteredOrgs = useMemo(() => {
    if (!directory || !selectedAssistId) return [];

    let filtered = directory.filter((r) => r.status_id === 1);

    // Filter by assistance type (required)
    filtered = filtered.filter((r) => r.assist_id === selectedAssistId);

    // Filter by geographic area (county/zip via client_zip_codes)
    filtered = filtered.filter((r) => orgServesArea(r));

    // Filter by parent org
    if (parentOrg) {
      // parentOrg may be a real parent or a subgroup (e.g., "District 4")
      filtered = filtered.filter((r) => matchesParentOrSubgroup(r, parentOrg));
    }

    // Filter by specific organization
    if (organization) {
      filtered = filtered.filter((r) => r.organization === organization);
    }

    return filtered;
  }, [directory, selectedAssistId, orgServesArea, parentOrg, organization]);

  // Dedupe orgs and create pins (only for orgs with coordinates)
  const orgPins = useMemo(() => {
    const seen = new Map();
    filteredOrgs.forEach((r) => {
      if (!r.org_coordinates) return; // Skip orgs without coordinates (out of area)
      const key = `${r.organization}-${r.org_coordinates}`;
      if (!seen.has(key)) {
        const coords = r.org_coordinates.split(",").map((c) => c.trim());
        const lat = parseFloat(coords[0]);
        const lng = parseFloat(coords[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          seen.set(key, {
            ...r,
            lat,
            lng,
            key,
            clientZips: Array.isArray(r.client_zip_codes)
              ? r.client_zip_codes
              : [],
          });
        }
      }
    });
    return Array.from(seen.values());
  }, [filteredOrgs]);

  // Out-of-area orgs: have pins on the map but org_zip_code is outside Houston area
  // These orgs serve Houston clients (via client_zip_codes) but are physically located elsewhere
  const outOfAreaOrgs = useMemo(() => {
    if (!houstonZips.size) return [];
    return orgPins.filter((r) => !houstonZips.has(r.org_zip_code));
  }, [orgPins, houstonZips]);

  // Determine if we're in density mode (parent org selected with assistance)
  const isDensityMode = Boolean(parentOrg && selectedAssistId);

  // Compute parent coverage: which zips are served by the parent's children
  // Returns a set of zip codes and a simple count (for legend display)
  const parentCoverage = useMemo(() => {
    if (!isDensityMode) return { servedZips: new Set(), childCount: 0 };

    const servedZips = new Set();

    filteredOrgs.forEach((r) => {
      const clientZips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      const isWildcard = clientZips.includes("99999");

      const zipsToMark = isWildcard ? [...boundaryZips] : clientZips;
      zipsToMark.forEach((zip) => servedZips.add(zip));
    });

    return { servedZips, childCount: filteredOrgs.length };
  }, [isDensityMode, filteredOrgs, boundaryZips]);

  // Load all GeoJSON boundaries once
  useEffect(() => {
    fetch("/data/houston-zips.geojson")
      .then((res) => res.json())
      .then((data) => {
        setAllGeoJsonData(data);
        setGeoJsonLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load GeoJSON:", err);
        setGeoJsonLoading(false);
      });
  }, []);

  // V2 Who overlay: which zips does the active Who filter touch, and is it
  // an org (pink) or parent (dark blue) overlay? Organization wins when both
  // are set (more specific). When an assistance type is active (Resources /
  // Compare), the overlay restricts to that assistance so it matches the
  // base map; in Conditions (no assistance), it spans all assist_ids the
  // org/parent provides. Wildcard "99999" client zips expand to boundaryZips.
  const whoOverlay = useMemo(() => {
    const blank = { zips: new Set(), kind: null };
    if (!directory) return blank;
    const isOrg = !!organization;
    const isParent = !isOrg && !!parentOrg;
    if (!isOrg && !isParent) return blank;

    const zips = new Set();
    directory.forEach((r) => {
      if (r.status_id !== 1) return;
      if (selectedAssistId && String(r.assist_id) !== String(selectedAssistId)) return;
      if (isOrg && r.organization !== organization) return;
      if (isParent && !matchesParentOrSubgroup(r, parentOrg)) return;
      const clientZips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      const targetZips = clientZips.includes("99999") ? Array.from(boundaryZips) : clientZips;
      targetZips.forEach((z) => z && zips.add(z));
    });
    return { zips, kind: isOrg ? "org" : "parent" };
  }, [directory, organization, parentOrg, selectedAssistId, boundaryZips]);

  // Filter GeoJSON by county + inject parent coverage into feature properties
  const geoJsonData = useMemo(() => {
    if (!allGeoJsonData) return null;
    const { servedZips } = parentCoverage;
    const filtered = {
      ...allGeoJsonData,
      features: allGeoJsonData.features
        .filter((f) => boundaryZips.has(f.properties.ZCTA5CE20))
        .map((f, i) => ({
          ...f,
          id: i,
          properties: {
            ...f.properties,
            density: servedZips.has(f.properties.ZCTA5CE20) ? 1 : 0,
            distress_score: distressLookup[f.properties.ZCTA5CE20] ?? -1,
            working_poor_score: workingPoorLookup[f.properties.ZCTA5CE20] ?? -1,
            population: populationLookup[f.properties.ZCTA5CE20] || 0,
            fvi_score: fviScoreLookup[f.properties.ZCTA5CE20] ?? -1,
            family_bivariate_code: familyBivariateCodeLookup[f.properties.ZCTA5CE20] || "",
            evictions_score: evictionsLookup[f.properties.ZCTA5CE20] ?? -1,
            funding_score: fundingScoreLookup[f.properties.ZCTA5CE20] ?? -1,
            efficiency_score: efficiencyScoreLookup[f.properties.ZCTA5CE20] ?? -1,
            bivariate_code: bivariateCodeLookup[f.properties.ZCTA5CE20] || "",
            coverage_score: coverageScoreLookup[f.properties.ZCTA5CE20] ?? -1,
            coverage_bivariate_code: coverageBivariateCodeLookup[f.properties.ZCTA5CE20] || "",
            who_type: whoOverlay.kind && whoOverlay.zips.has(f.properties.ZCTA5CE20) ? whoOverlay.kind : "",
          },
        })),
    };
    return filtered;
  }, [allGeoJsonData, boundaryZips, parentCoverage, distressLookup, workingPoorLookup, populationLookup, fviScoreLookup, familyBivariateCodeLookup, evictionsLookup, fundingScoreLookup, efficiencyScoreLookup, bivariateCodeLookup, coverageScoreLookup, coverageBivariateCodeLookup, whoOverlay]);

  // Derive centroid point GeoJSON from polygon data for org coverage circles
  const centroidGeoJson = useMemo(() => {
    if (!geoJsonData) return null;
    return {
      type: "FeatureCollection",
      features: geoJsonData.features.map((f) => ({
        type: "Feature",
        id: f.id,
        properties: {
          ZCTA5CE20: f.properties.ZCTA5CE20,
          density: f.properties.density || 0,
        },
        geometry: {
          type: "Point",
          coordinates: [
            parseFloat(f.properties.INTPTLON20),
            parseFloat(f.properties.INTPTLAT20),
          ],
        },
      })),
    };
  }, [geoJsonData]);

  // Zip code -> feature id lookup
  const zipToFeatureId = useMemo(() => {
    if (!geoJsonData) return {};
    const lookup = {};
    geoJsonData.features.forEach((f) => {
      lookup[f.properties.ZCTA5CE20] = f.id;
    });
    return lookup;
  }, [geoJsonData]);

  // Clear child teal highlights (on both polygon and centroid sources)
  const clearChildHighlights = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;

    childHighlightedRef.current.forEach((featureId) => {
      map.setFeatureState(
        { source: "zip-boundaries", id: featureId },
        { childHighlighted: false }
      );
      // Also clear on centroid source for circle layer
      if (map.getSource("zip-centroids")) {
        map.setFeatureState(
          { source: "zip-centroids", id: featureId },
          { childHighlighted: false }
        );
      }
    });
    childHighlightedRef.current.clear();
  }, []);

  // Clear and set the base zip highlight (from zip code filter)
  const clearBaseHighlight = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;
    if (baseHighlightedRef.current !== null) {
      map.setFeatureState(
        { source: "zip-boundaries", id: baseHighlightedRef.current },
        { highlighted: false }
      );
      baseHighlightedRef.current = null;
    }
  }, []);

  const setBaseHighlight = useCallback(
    (zip) => {
      const map = mapRef.current?.getMap();
      if (!map || !map.getSource("zip-boundaries")) return;
      clearBaseHighlight();
      if (!zip) return;
      const featureId = zipToFeatureId[zip];
      if (featureId !== undefined) {
        map.setFeatureState(
          { source: "zip-boundaries", id: featureId },
          { highlighted: true }
        );
        baseHighlightedRef.current = featureId;
      }
    },
    [zipToFeatureId, clearBaseHighlight]
  );

  // Highlight child's served zips in teal
  // For 99999 wildcard orgs, highlight all boundary zips
  const highlightChildZips = useCallback(
    (clientZips) => {
      const map = mapRef.current?.getMap();
      if (!map || !map.getSource("zip-boundaries")) return;

      clearChildHighlights();

      // If org has 99999 wildcard, highlight all boundary zips
      const zipsToHighlight = clientZips.includes("99999")
        ? [...boundaryZips]
        : clientZips;

      zipsToHighlight.forEach((zip) => {
        const featureId = zipToFeatureId[zip];
        if (featureId !== undefined) {
          map.setFeatureState(
            { source: "zip-boundaries", id: featureId },
            { childHighlighted: true }
          );
          // Also highlight on centroid source for circle layer
          if (map.getSource("zip-centroids")) {
            map.setFeatureState(
              { source: "zip-centroids", id: featureId },
              { childHighlighted: true }
            );
          }
          childHighlightedRef.current.add(featureId);
        }
      });
    },
    [zipToFeatureId, clearChildHighlights, boundaryZips]
  );

  // Handle out-of-area section expand/collapse
  // Expanding highlights all boundary zips in teal; collapsing clears them
  const handleOutOfAreaToggle = useCallback(
    (isExpanding) => {
      if (isExpanding) {
        highlightChildZips(["99999"]); // 99999 triggers "highlight all boundary zips"
      } else {
        clearChildHighlights();
      }
    },
    [highlightChildZips, clearChildHighlights]
  );

  // Handle pin click
  const handlePinClick = useCallback(
    (org) => {
      // Toggle: if clicking the same pin, close the info box
      if (selectedOrgKey === org.key) {
        setInfoBoxData(null);
        setSelectedOrgKey(null);
        clearChildHighlights();
        if (zipCode) setBaseHighlight(zipCode);
        return;
      }

      const clientZips = org.clientZips || [];
      const isWildcard = clientZips.includes("99999");
      const displayZipCount = isWildcard ? boundaryZips.size : clientZips.length;

      setInfoBoxData({
        organization: org.organization,
        orgParent: org.org_parent,
        assistance: org.assistance,
        telephone: org.org_telephone || "",
        address: [
          org.org_address1,
          org.org_address2,
          `${org.org_city || ""}, ${org.org_state || ""} ${org.org_zip_code || ""}`,
        ]
          .filter(Boolean)
          .join(", "),
        status: org.status,
        clientZips,
        zipCount: displayZipCount,
        isWildcard,
        countyBreakdown: buildCountyBreakdown(clientZips, isWildcard),
        selectedCounty: county,
      });

      setSelectedOrgKey(org.key);
      highlightChildZips(clientZips);
    },
    [highlightChildZips, boundaryZips, selectedOrgKey, clearChildHighlights, zipCode, setBaseHighlight, buildCountyBreakdown]
  );

  // V2: orgs (active) providing the selected assistance for the currently-
  // open coverage info box's zip. Empty when no zip is selected or no
  // assistance is selected. Includes wildcard ("99999") orgs.
  const coverageTableOrgs = useMemo(() => {
    if (!coverageTableZip || !directory || !selectedAssistId) return [];
    return directory
      .filter((r) => {
        if (r.status_id !== 1) return false;
        if (String(r.assist_id) !== String(selectedAssistId)) return false;
        const zips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
        return zips.includes("99999") || zips.includes(coverageTableZip);
      })
      .slice()
      .sort((a, b) => (a.organization || "").localeCompare(b.organization || ""))
      .map((r) => {
        const clientZips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
        const isWildcard = clientZips.includes("99999");
        const zipCount = isWildcard ? boundaryZips.size : clientZips.length;
        return {
          ...r,
          clientZips,
          zipCount,
          isWildcard,
          countyBreakdown: buildCountyBreakdown(clientZips, isWildcard),
        };
      });
  }, [coverageTableZip, directory, selectedAssistId, boundaryZips, buildCountyBreakdown]);

  // V2 Sites: orgs LOCATED in the selected zip for the selected assistance
  // type. Intentionally NOT narrowed by the Who filter — the info box's job
  // is to honestly describe what's in the clicked zip, even when that zip
  // sits outside the active Who coverage (black outline, no pins). Pins
  // themselves stay Who-filtered upstream; only this drill-in surface
  // ignores Who. Same principle as the Coverage info box.
  // Different filter from coverageTableOrgs — that one is service-area;
  // this is org_zip_code (physical location). Sorted by org name; each row
  // is enriched with the org's served-zip count + county breakdown.
  const sitesTableOrgs = useMemo(() => {
    if (!coverageTableZip || !directory || !selectedAssistId) return [];
    return directory
      .filter((r) => {
        if (r.status_id !== 1) return false;
        if (String(r.assist_id) !== String(selectedAssistId)) return false;
        if (r.org_zip_code !== coverageTableZip) return false;
        return true;
      })
      .slice()
      .sort((a, b) => (a.organization || "").localeCompare(b.organization || ""))
      .map((r) => {
        const clientZips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
        const isWildcard = clientZips.includes("99999");
        const zipCount = isWildcard ? boundaryZips.size : clientZips.length;
        return {
          ...r,
          zipCount,
          isWildcard,
          countyBreakdown: buildCountyBreakdown(clientZips, isWildcard),
        };
      });
  }, [coverageTableZip, directory, selectedAssistId, boundaryZips, buildCountyBreakdown]);

  // V2 Coverage / Compare: click an org row in the info box to highlight that
  // org's served zips in magenta. Toggle by clicking the same row again. The
  // highlighted zips ignore the active Who filter and any geographic narrowing
  // — drill-in tells the truth about the org's footprint (same principle as
  // the info-box list itself). Pin clicks in Sites use selectedOrgKey via a
  // separate path; this surface uses its own coverageInfoBoxOrgKey.
  const handleCoverageOrgClick = useCallback(
    (org) => {
      if (!org) return;
      const key = org.id_no;
      if (coverageInfoBoxOrgKey === key) {
        setCoverageInfoBoxOrgKey(null);
        clearChildHighlights();
        return;
      }
      setCoverageInfoBoxOrgKey(key);
      const clientZips = Array.isArray(org.clientZips)
        ? org.clientZips
        : Array.isArray(org.client_zip_codes)
        ? org.client_zip_codes
        : [];
      highlightChildZips(clientZips);
    },
    [coverageInfoBoxOrgKey, clearChildHighlights, highlightChildZips]
  );

  // Clear the Coverage/Compare info-box drill-in whenever the underlying zip
  // changes (new zip click, info box closed). Without this, the magenta
  // overlay from a prior zip's org would linger.
  useEffect(() => {
    setCoverageInfoBoxOrgKey(null);
    clearChildHighlights();
  }, [coverageTableZip, clearChildHighlights]);

  // Handle clicking map area
  const handleMapClick = useCallback((e) => {
    // V2: Coverage / Compare modes — open the coverage info box for the clicked zip.
    if (isBaseView && (displayMetric === "service_coverage" || isCoverageBivariate(displayMetric))) {
      const map = mapRef.current?.getMap();
      if (map && map.getLayer("unified-fill")) {
        const features = map.queryRenderedFeatures(e.point, { layers: ["unified-fill"] });
        if (features.length > 0) {
          const clickedZip = features[0].properties.ZCTA5CE20;
          if (clickedZip) {
            setCoverageTableZip(prev => prev === clickedZip ? null : clickedZip);
            return;
          }
        }
      }
      setCoverageTableZip(null);
      return;
    }

    // In distress (or no-base-map) base view, clicking a zip boundary opens/toggles the distress data table
    if (isBaseView && (displayMetric === "distress" || displayMetric === "no_base_map")) {
      const map = mapRef.current?.getMap();
      if (map && map.getLayer("unified-fill")) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["unified-fill"],
        });
        if (features.length > 0) {
          const clickedZip = features[0].properties.ZCTA5CE20;
          if (clickedZip && distressDataLookup[clickedZip]) {
            setDistressTableZip(prev => prev === clickedZip ? null : clickedZip);
            return;
          }
        }
      }
      // Clicked outside any zip boundary - close the table
      setDistressTableZip(null);
      return;
    }

    // In working poor base view, clicking a zip boundary opens/toggles the working poor data table
    if (isBaseView && displayMetric === "working_poor") {
      const map = mapRef.current?.getMap();
      if (map && map.getLayer("unified-fill")) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["unified-fill"],
        });
        if (features.length > 0) {
          const clickedZip = features[0].properties.ZCTA5CE20;
          if (clickedZip && workingPoorDataLookup[clickedZip]) {
            setWorkingPoorTableZip(prev => prev === clickedZip ? null : clickedZip);
            return;
          }
        }
      }
      // Clicked outside any zip boundary - close the table
      setWorkingPoorTableZip(null);
      return;
    }

    // In funding level base view, clicking a zip boundary opens/toggles the funding info box
    if (isBaseView && displayMetric === "funding_level") {
      const map = mapRef.current?.getMap();
      if (map && map.getLayer("unified-fill")) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["unified-fill"],
        });
        if (features.length > 0) {
          const clickedZip = features[0].properties.ZCTA5CE20;
          if (clickedZip && fundingDataLookup[clickedZip]) {
            setFundingTableZip(prev => prev === clickedZip ? null : clickedZip);
            return;
          }
        }
      }
      setFundingTableZip(null);
      return;
    }

    // In efficiency_ratio base view, clicking a zip boundary opens/toggles the efficiency info box
    if (isBaseView && displayMetric === "efficiency_ratio") {
      const map = mapRef.current?.getMap();
      if (map && map.getLayer("unified-fill")) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["unified-fill"],
        });
        if (features.length > 0) {
          const clickedZip = features[0].properties.ZCTA5CE20;
          if (clickedZip && fundingDataLookup[clickedZip]) {
            setEfficiencyTableZip(prev => prev === clickedZip ? null : clickedZip);
            return;
          }
        }
      }
      setEfficiencyTableZip(null);
      return;
    }

    if (isBaseView && displayMetric === "bivariate") {
      const map = mapRef.current?.getMap();
      if (map && map.getLayer("unified-fill")) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["unified-fill"],
        });
        if (features.length > 0) {
          const clickedZip = features[0].properties.ZCTA5CE20;
          if (clickedZip && fundingDataLookup[clickedZip]) {
            setBivariateTableZip(prev => prev === clickedZip ? null : clickedZip);
            return;
          }
        }
      }
      setBivariateTableZip(null);
      return;
    }

    // In Family Vulnerability base view (either choropleth or bivariate sub-mode),
    // clicking a zip opens/toggles the FVI info box. Allow any zip in zipCodeData —
    // when FVI is null (zip missing distress or children%) the box shows a banner
    // and skips the score/rank rows, same pattern as distress.
    if (isBaseView && (displayMetric === "family_vulnerability" || displayMetric === "family_bivariate")) {
      const map = mapRef.current?.getMap();
      if (map && map.getLayer("unified-fill")) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["unified-fill"],
        });
        if (features.length > 0) {
          const clickedZip = features[0].properties.ZCTA5CE20;
          if (clickedZip && distressDataLookup[clickedZip]) {
            setFviTableZip(prev => prev === clickedZip ? null : clickedZip);
            return;
          }
        }
      }
      setFviTableZip(null);
      return;
    }

    // In evictions base view, clicking a zip boundary opens/toggles the evictions data table
    if (isBaseView && displayMetric === "evictions") {
      const map = mapRef.current?.getMap();
      if (map && map.getLayer("unified-fill")) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["unified-fill"],
        });
        if (features.length > 0) {
          const clickedZip = features[0].properties.ZCTA5CE20;
          if (clickedZip && evictionsDataLookup[clickedZip]) {
            setEvictionsTableZip(prev => prev === clickedZip ? null : clickedZip);
            return;
          }
        }
      }
      // Clicked outside any zip boundary - close the table
      setEvictionsTableZip(null);
      return;
    }

    // Filter view: check for zip boundary click first
    const map = mapRef.current?.getMap();
    if (map && map.getLayer("unified-fill")) {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["unified-fill"],
      });
      if (features.length > 0) {
        const clickedZip = features[0].properties.ZCTA5CE20;

        // V2 Sites mode (filter_view + no_base_map): clicking a zip toggles
        // the Sites info box for that zip. Pins are unaffected; clicking a
        // pin still opens its own org info box.
        if (activeBase === "no_base_map" && clickedZip) {
          setCoverageTableZip(prev => prev === clickedZip ? null : clickedZip);
          return;
        }

        if (activeBase === "efficiency_ratio" && efficiencySubMode === "bivariate" && clickedZip && fundingDataLookup[clickedZip]) {
          setBivariateTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setWorkingPoorTableZip(null); setEvictionsTableZip(null); setFviTableZip(null); setFundingTableZip(null); setEfficiencyTableZip(null);
          return;
        } else if (activeBase === "efficiency_ratio" && clickedZip && fundingDataLookup[clickedZip]) {
          setEfficiencyTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setWorkingPoorTableZip(null); setEvictionsTableZip(null); setFviTableZip(null); setFundingTableZip(null); setBivariateTableZip(null);
          return;
        } else if (activeBase === "funding_level" && clickedZip && fundingDataLookup[clickedZip]) {
          setFundingTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setWorkingPoorTableZip(null); setEvictionsTableZip(null); setFviTableZip(null);
          return;
        } else if (activeBase === "family_vulnerability" && clickedZip && distressDataLookup[clickedZip]) {
          setFviTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setWorkingPoorTableZip(null); setEvictionsTableZip(null); setFundingTableZip(null);
          return;
        } else if (activeBase === "evictions" && clickedZip && evictionsDataLookup[clickedZip]) {
          setEvictionsTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setWorkingPoorTableZip(null); setFviTableZip(null); setFundingTableZip(null);
          return;
        } else if (activeBase === "working_poor" && clickedZip && workingPoorDataLookup[clickedZip]) {
          setWorkingPoorTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setEvictionsTableZip(null); setFviTableZip(null); setFundingTableZip(null);
          return;
        } else if (clickedZip && distressDataLookup[clickedZip]) {
          setDistressTableZip(prev => prev === clickedZip ? null : clickedZip);
          setWorkingPoorTableZip(null); setEvictionsTableZip(null); setFviTableZip(null); setFundingTableZip(null);
          return;
        }
      }
    }

    // Clicked outside any boundary - close zip tables, clear org selection
    clearChildHighlights();
    setInfoBoxData(null);
    setSelectedOrgKey(null);
    setDistressTableZip(null);
    setWorkingPoorTableZip(null);
    setEvictionsTableZip(null);
    setFviTableZip(null);
    setFundingTableZip(null);
    setEfficiencyTableZip(null);
    setBivariateTableZip(null);
    setCoverageTableZip(null);
    if (zipCode) {
      setBaseHighlight(zipCode);
    }
  }, [clearChildHighlights, zipCode, setBaseHighlight, isBaseView, displayMetric, distressDataLookup, workingPoorDataLookup, evictionsDataLookup, populationLookup, fundingDataLookup, activeBase, efficiencySubMode]);

  // Handle zip search — fly to zip and open its info box
  const handleZipSearch = useCallback((zipStr) => {
    const zip = zipStr.trim();
    if (!zip) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Find centroid from zipCodes table
    const zipRecord = zipCodes?.find(z => z.zip_code === zip);
    if (!zipRecord?.coordinates) return;

    const coords = zipRecord.coordinates.split(",").map(c => parseFloat(c.trim()));
    if (coords.length !== 2 || coords.some(isNaN)) return;

    // Fly to the zip
    map.flyTo({ center: [coords[1], coords[0]], zoom: 12, duration: 1500 });

    // Open the appropriate info box based on current view
    setDistressTableZip(null);
    setWorkingPoorTableZip(null);
    setEvictionsTableZip(null);
    setFviTableZip(null);
    setFundingTableZip(null);
    setEfficiencyTableZip(null);
    setBivariateTableZip(null);
    setCoverageTableZip(null);

    if (isBaseView) {
      if (displayMetric === "distress" && distressDataLookup[zip]) {
        setDistressTableZip(zip);
      } else if (displayMetric === "working_poor" && workingPoorDataLookup[zip]) {
        setWorkingPoorTableZip(zip);
      } else if (displayMetric === "evictions" && evictionsDataLookup[zip]) {
        setEvictionsTableZip(zip);
      } else if ((displayMetric === "family_vulnerability" || displayMetric === "family_bivariate") && distressDataLookup[zip]) {
        setFviTableZip(zip);
      } else if (displayMetric === "funding_level" && fundingDataLookup[zip]) {
        setFundingTableZip(zip);
      } else if (displayMetric === "efficiency_ratio" && fundingDataLookup[zip]) {
        setEfficiencyTableZip(zip);
      } else if (displayMetric === "bivariate" && fundingDataLookup[zip]) {
        setBivariateTableZip(zip);
      } else if (displayMetric === "service_coverage" || isCoverageBivariate(displayMetric)) {
        setCoverageTableZip(zip);
      }
    } else {
      // Filter view — use activeBase
      if (activeBase === "no_base_map") {
        // V2 Sites: zip search opens the Sites info box for that zip.
        setCoverageTableZip(zip);
      } else if (activeBase === "efficiency_ratio" && fundingDataLookup[zip]) {
        setEfficiencyTableZip(zip);
      } else if (activeBase === "funding_level" && fundingDataLookup[zip]) {
        setFundingTableZip(zip);
      } else if (activeBase === "family_vulnerability" && distressDataLookup[zip]) {
        setFviTableZip(zip);
      } else if (activeBase === "evictions" && evictionsDataLookup[zip]) {
        setEvictionsTableZip(zip);
      } else if (activeBase === "working_poor" && workingPoorDataLookup[zip]) {
        setWorkingPoorTableZip(zip);
      } else if (distressDataLookup[zip]) {
        setDistressTableZip(zip);
      }
    }
  }, [zipCodes, isBaseView, displayMetric, activeBase, distressDataLookup, workingPoorDataLookup, evictionsDataLookup, populationLookup, fundingDataLookup]);

  // Handle boundary hover
  const handleMouseMove = useCallback((e) => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getLayer("unified-fill")) return;

    const features = map.queryRenderedFeatures(e.point, {
      layers: ["unified-fill"],
    });

    if (hoveredFeatureRef.current !== null) {
      map.setFeatureState(
        { source: "zip-boundaries", id: hoveredFeatureRef.current },
        { hovered: false }
      );
    }

    if (features.length > 0) {
      hoveredFeatureRef.current = features[0].id;
      map.setFeatureState(
        { source: "zip-boundaries", id: features[0].id },
        { hovered: true }
      );
    } else {
      hoveredFeatureRef.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || hoveredFeatureRef.current === null) return;

    map.setFeatureState(
      { source: "zip-boundaries", id: hoveredFeatureRef.current },
      { hovered: false }
    );
    hoveredFeatureRef.current = null;
  }, []);

  // Close info box - clear pin highlights but restore base/county highlights
  const handleInfoBoxClose = useCallback(() => {
    setInfoBoxData(null);
    setSelectedOrgKey(null);
    clearChildHighlights();
    // Restore base zip highlight if a zip filter is active
    if (zipCode) {
      setBaseHighlight(zipCode);
    }
  }, [clearChildHighlights, zipCode, setBaseHighlight]);

  // Clear selection when any filter changes (density is data-driven, auto-updates)
  useEffect(() => {
    setInfoBoxData(null);
    setSelectedOrgKey(null);
    clearChildHighlights();
    clearBaseHighlight();
  }, [assistanceType, county, zipCode, parentOrg, organization, clearChildHighlights, clearBaseHighlight]);

  // Keep lastV2SelectedZipRef in sync with whichever v2 slot currently holds
  // the selection. This lets the viewMode-migration effect below pick it up
  // when the user switches between Conditions / Resources / Compare.
  useEffect(() => {
    lastV2SelectedZipRef.current =
      distressTableZip || evictionsTableZip || coverageTableZip || null;
  }, [distressTableZip, evictionsTableZip, coverageTableZip]);

  // Migrate the previously-selected zip into the slot that belongs to the
  // new mode so the border highlight + info box stay attached as the user
  // moves between v2 modes (Conditions ↔ Resources ↔ Compare). Each slot is
  // assigned exactly once via a ternary — never cleared-then-set — so React
  // batching can't drop the migrated value. Resources/Pins (filter_view) and
  // no_base_map keep the carryover in coverageTableZip purely for the border
  // highlight (the info box render condition gates on displayMetric, so it
  // won't open in those modes). User drops the selection by clicking the zip
  // again, clicking outside, or hitting Reset.
  useEffect(() => {
    const carry = lastV2SelectedZipRef.current || null;

    // v1-only slots: always clear, never relevant for the v2 page.
    setWorkingPoorTableZip(null);
    setFviTableZip(null);
    setFundingTableZip(null);
    setEfficiencyTableZip(null);
    setBivariateTableZip(null);

    // v2 slots: pick the one that matches this mode and put the carryover
    // there; null out the others.
    setDistressTableZip(viewMode === "distress" ? carry : null);
    setEvictionsTableZip(viewMode === "evictions" ? carry : null);
    const isCoverageContext =
      viewMode === "service_coverage" ||
      isCoverageBivariate(viewMode) ||
      viewMode === "filter_view" ||
      viewMode === "no_base_map";
    setCoverageTableZip(isCoverageContext ? carry : null);
  }, [viewMode]);

  // Close efficiency/bivariate tables when toggling sub-mode
  useEffect(() => {
    setEfficiencyTableZip(null);
    setBivariateTableZip(null);
  }, [efficiencySubMode]);

  // Close FVI info box when toggling family sub-mode
  useEffect(() => {
    setFviTableZip(null);
  }, [familySubMode]);

  // V2: single sync effect that drives the selected-zip border highlight
  // (distressSelected feature state) from whichever table-zip slot currently
  // holds the selection. Consolidating these into one effect with one shared
  // ref prevents the cross-talk that happened when each mode had its own
  // sync — during a migration both effects would fire, and the second one's
  // "clear previous" step would wipe the highlight the first effect had
  // just set on the same feature.
  const v2ActiveSelectedZip =
    distressTableZip ||
    evictionsTableZip ||
    workingPoorTableZip ||
    fviTableZip ||
    fundingTableZip ||
    efficiencyTableZip ||
    bivariateTableZip ||
    coverageTableZip ||
    null;

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;

    if (v2HighlightedFeatureRef.current !== null) {
      map.setFeatureState(
        { source: "zip-boundaries", id: v2HighlightedFeatureRef.current },
        { distressSelected: false }
      );
      v2HighlightedFeatureRef.current = null;
    }

    if (v2ActiveSelectedZip) {
      const featureId = zipToFeatureId[v2ActiveSelectedZip];
      if (featureId !== undefined) {
        map.setFeatureState(
          { source: "zip-boundaries", id: featureId },
          { distressSelected: true }
        );
        v2HighlightedFeatureRef.current = featureId;
      }
    }
  }, [v2ActiveSelectedZip, zipToFeatureId]);

  // Hide info box when entering base view, restore when returning to filter view
  useEffect(() => {
    if (isBaseView) {
      setInfoBoxData(null);
    } else if (selectedOrgKey && orgPins.length > 0) {
      // Returning to filter view — restore info box from the previously selected org
      const org = orgPins.find((p) => p.key === selectedOrgKey);
      if (org) {
        const clientZips = org.clientZips || [];
        const isWildcard = clientZips.includes("99999");
        const displayZipCount = isWildcard ? boundaryZips.size : clientZips.length;
        setInfoBoxData({
          organization: org.organization,
          orgParent: org.org_parent,
          assistance: org.assistance,
          telephone: org.org_telephone || "",
          address: [
            org.org_address1,
            org.org_address2,
            `${org.org_city || ""}, ${org.org_state || ""} ${org.org_zip_code || ""}`,
          ]
            .filter(Boolean)
            .join(", "),
          status: org.status,
          clientZips,
          zipCount: displayZipCount,
          isWildcard,
          countyBreakdown: buildCountyBreakdown(clientZips, isWildcard),
          selectedCounty: county,
        });
      }
    }
  }, [isBaseView, selectedOrgKey, orgPins, boundaryZips, buildCountyBreakdown, county]);

  // Set base zip highlight when zip filter is active and assistance is selected
  useEffect(() => {
    if (zipCode && selectedAssistId) {
      // Small delay to ensure map source is ready after filter-change clear
      const timer = setTimeout(() => {
        setBaseHighlight(zipCode);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [zipCode, selectedAssistId, setBaseHighlight]);

  // Auto-highlight served zip codes, open info box, and activate pin
  // when a single organization is selected via the filter dropdown
  useEffect(() => {
    if (!organization || orgPins.length === 0) return;

    // Use the first matching pin (the selected org)
    const org = orgPins[0];
    const clientZips = org.clientZips || [];
    const isWildcard = clientZips.includes("99999");
    const displayZipCount = isWildcard ? boundaryZips.size : clientZips.length;

    // Small delay to ensure the clear effect runs first
    const timer = setTimeout(() => {
      // Highlight served zip codes in teal
      highlightChildZips(clientZips);

      // Turn pin green by setting selected org key
      setSelectedOrgKey(org.key);

      // Open info box as if pin was clicked
      setInfoBoxData({
        organization: org.organization,
        orgParent: org.org_parent,
        assistance: org.assistance,
        telephone: org.org_telephone || "",
        address: [
          org.org_address1,
          org.org_address2,
          `${org.org_city || ""}, ${org.org_state || ""} ${org.org_zip_code || ""}`,
        ]
          .filter(Boolean)
          .join(", "),
        status: org.status,
        clientZips,
        zipCount: displayZipCount,
        isWildcard,
        countyBreakdown: buildCountyBreakdown(clientZips, isWildcard),
        selectedCounty: county,
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [organization, orgPins, highlightChildZips, boundaryZips, buildCountyBreakdown]);

  // Handle zoom changes - track level and auto-hide labels when zooming out
  const handleZoom = useCallback((e) => {
    const zoom = e.viewState.zoom;
    setCurrentZoom(zoom);
    if (zoom < ORG_LABEL_ZOOM_THRESHOLD && showOrgLabels) {
      setShowOrgLabels(false);
    }
  }, [showOrgLabels, ORG_LABEL_ZOOM_THRESHOLD]);

  // Get assistance type label for display
  const assistanceLabel = useMemo(() => {
    if (!assistanceType || !assistance) return "";
    const match = assistance.find((a) => a.assistance === assistanceType);
    return match ? match.assistance : assistanceType;
  }, [assistanceType, assistance]);

  // Determine if we have an assistance type selected (required to show anything)
  const hasAssistance = Boolean(selectedAssistId);

  // Helper: draw a rounded rectangle on canvas
  const drawRoundedRect = (ctx, x, y, w, h, r, fillColor) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  };

  // Helper: truncate text to fit maxWidth on canvas
  const truncateText = (ctx, text, maxW) => {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + "…").width > maxW) {
      t = t.slice(0, -1);
    }
    return t + "…";
  };

  // Draw the info box directly on canvas (bypasses dom-to-image artifacts)
  const drawInfoBoxOnCanvas = (ctx, info, containerEl) => {
    if (!info) return;
    const el = containerEl.querySelector("[data-info-box]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const y = eRect.top - cRect.top;
    const w = eRect.width;
    const h = eRect.height;
    const pad = 14;
    const maxTextW = w - pad * 2 - 20;

    drawRoundedRect(ctx, x, y, w, h, 8, "rgba(34, 40, 49, 0.95)");
    ctx.textBaseline = "top";

    // Header: green pin circle + org name
    let cy = y + 10;
    ctx.fillStyle = "#00CC44";
    ctx.beginPath();
    ctx.arc(x + pad + 6, cy + 8, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "600 14px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(truncateText(ctx, info.organization, maxTextW), x + pad + 20, cy);
    cy += 26;

    // Header divider
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 10;

    // Parent org (if different)
    if (info.orgParent !== info.organization) {
      ctx.font = "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#AAAAAA";
      ctx.fillText(truncateText(ctx, info.orgParent, w - pad * 2), x + pad, cy);
      cy += 16;
    }

    // Assistance type
    ctx.font = "500 12px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(info.assistance, x + pad, cy);
    cy += 16;

    // Phone
    if (info.telephone) {
      ctx.font = "600 13px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(info.telephone, x + pad, cy);
      cy += 16;
    }

    // Address
    ctx.font = "400 11px 'Open Sans', sans-serif";
    ctx.fillStyle = "#CCCCCC";
    ctx.fillText(truncateText(ctx, info.address, w - pad * 2), x + pad, cy);
    cy += 20;

    // Divider
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 10;

    // Zip count
    ctx.font = "500 12px 'Open Sans', sans-serif";
    ctx.fillStyle = "#00A8A8";
    const zipText = `Serves ${info.zipCount} zip code${info.zipCount !== 1 ? "s" : ""}`;
    ctx.fillText(zipText, x + pad, cy);
    const breakdownText = formatCountyBreakdownText(info.countyBreakdown);
    if (breakdownText) {
      cy += 16;
      ctx.font = "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(truncateText(ctx, breakdownText, w - pad * 2), x + pad, cy);
    }
  };

  // Draw distress data table on canvas (for base view zip code selection)
  const drawDistressTableOnCanvas = (ctx, data, zipCode, neighborhood, medians, containerEl) => {
    if (!data || !zipCode) return;
    const el = containerEl.querySelector("[data-distress-table]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const y = eRect.top - cRect.top;
    const w = eRect.width;
    const h = eRect.height;
    const pad = 14;

    // Key data = distress_score populated (matches screen info box logic)
    const hasKeyData = data.distress_score != null;
    const bgColor = hasKeyData ? "rgba(34, 40, 49, 0.95)" : "rgba(105, 100, 110, 0.95)";
    drawRoundedRect(ctx, x, y, w, h, 8, bgColor);
    ctx.textBaseline = "top";

    let cy = y + 10;

    // Header: "Zip Code XXXXX"
    ctx.font = "600 15px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    // County (if present)
    if (data.county) {
      ctx.font = "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(`${data.county} County`, x + pad, cy);
      cy += 14;
    }

    // Neighborhood (if present)
    if (neighborhood) {
      ctx.font = "400 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#8FB6FF";
      ctx.fillText(truncateText(ctx, neighborhood, w - pad * 2), x + pad, cy);
      cy += 14;
    }

    // Banner when distress score is unavailable
    if (!hasKeyData) {
      ctx.fillStyle = "rgba(255, 179, 2, 0.15)";
      ctx.fillRect(x, cy, w, 30);
      ctx.strokeStyle = "rgba(255, 179, 2, 0.25)";
      ctx.beginPath();
      ctx.moveTo(x, cy + 30);
      ctx.lineTo(x + w, cy + 30);
      ctx.stroke();
      cy += 6;
      ctx.font = "500 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFB302";
      ctx.fillText("Distress score not available — data shown for reference only", x + pad, cy);
      cy += 13;
      ctx.font = "italic 9px 'Open Sans', sans-serif";
      ctx.fillStyle = "#999999";
      ctx.fillText("Not scored or ranked. Excluded from Greater Houston statistics.", x + pad, cy);
      cy += 15;
    }

    // Header divider
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 8;

    // Column headers: Value | Houston*
    const col2024W = 72;
    const colHoustonW = 60;
    const colHoustonX = x + w - pad - colHoustonW;
    const col2024X = colHoustonX - col2024W;

    ctx.font = "600 9px 'Open Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Value", col2024X + col2024W, cy);
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("Houston*", colHoustonX + colHoustonW, cy);
    ctx.textAlign = "left";
    cy += 14;

    // Divider after column headers
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 6;

    // Data rows
    DISTRESS_FIELDS.forEach(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
      if (!hasKeyData && (highlight || isRank)) return;
      // Row with highlight styling for distress score
      const rowPadY = highlight ? 6 : 3;
      cy += rowPadY;

      // Label
      ctx.font = highlight ? "600 12px 'Open Sans', sans-serif" : "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = highlight ? "#FFC857" : "#CCCCCC";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad, cy);

      // Value (with distress band circle for highlight row)
      ctx.textAlign = "right";
      const formattedVal = isRank ? format(data[key], distressRankedCount) : format(data[key]);
      if (highlight) {
        const circleX = col2024X + col2024W - ctx.measureText(formattedVal).width - 18;
        ctx.fillStyle = getDistressBandColor(data.distress_score);
        ctx.beginPath();
        ctx.arc(circleX, cy + 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = highlight ? "700 14px 'Open Sans', sans-serif" : "500 12px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(formattedVal, col2024X + col2024W, cy);

      // Houston median value
      const medianVal = medians?.[key];
      if (showMedian && medianVal != null) {
        ctx.font = "400 11px 'Open Sans', sans-serif";
        ctx.fillStyle = "#8FB6FF";
        const fmtMedian = medianFormat ? medianFormat(medianVal) : medianVal.toLocaleString();
        ctx.fillText(fmtMedian, colHoustonX + colHoustonW, cy);
      }

      ctx.textAlign = "left";
      cy += (highlight ? 14 : 12) + rowPadY;

      // Bottom border for highlight row
      if (highlight) {
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(x + pad, cy);
        ctx.lineTo(x + w - pad, cy);
        ctx.stroke();
        cy += 2;
      }
    });

    // Source citation
    cy += 4;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 8;

    ctx.font = "italic 9px 'Open Sans', sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText(`Source: ${CENSUS_SOURCE}`, x + pad, cy);
    cy += 12;
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("* Greater Houston area median", x + pad, cy);
  };

  // Draw working poor data table on canvas (for base view zip code selection)
  const drawWorkingPoorTableOnCanvas = (ctx, data, zipCode, neighborhood, medians, containerEl) => {
    if (!data || !zipCode) return;
    const el = containerEl.querySelector("[data-working-poor-table]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const y = eRect.top - cRect.top;
    const w = eRect.width;
    const h = eRect.height;
    const pad = 14;

    // Key data = working_poor_score populated
    const hasKeyData = data.working_poor_score != null;

    // Background
    drawRoundedRect(ctx, x, y, w, h, 8, hasKeyData ? "rgba(34, 40, 49, 0.95)" : "rgba(105, 100, 110, 0.95)");
    ctx.textBaseline = "top";

    let cy = y + 10;

    // Header: "Zip Code XXXXX"
    ctx.font = "600 15px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    // County (if present)
    if (data.county) {
      ctx.font = "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(`${data.county} County`, x + pad, cy);
      cy += 14;
    }

    // Neighborhood (if present)
    if (neighborhood) {
      ctx.font = "400 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#8FB6FF";
      ctx.fillText(truncateText(ctx, neighborhood, w - pad * 2), x + pad, cy);
      cy += 14;
    }

    // Banner when working-poor score is unavailable
    if (!hasKeyData) {
      ctx.fillStyle = "rgba(255, 179, 2, 0.15)";
      ctx.fillRect(x, cy, w, 30);
      ctx.strokeStyle = "rgba(255, 179, 2, 0.25)";
      ctx.beginPath();
      ctx.moveTo(x, cy + 30);
      ctx.lineTo(x + w, cy + 30);
      ctx.stroke();
      cy += 6;
      ctx.font = "500 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFB302";
      ctx.fillText("Working Poor score not available — data shown for reference only", x + pad, cy);
      cy += 13;
      ctx.font = "italic 9px 'Open Sans', sans-serif";
      ctx.fillStyle = "#999999";
      ctx.fillText("Not scored or ranked. Excluded from Greater Houston statistics.", x + pad, cy);
      cy += 15;
    }

    // Header divider
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 8;

    // Column headers: Value | Houston*
    const col2024W = 72;
    const colHoustonW = 60;
    const colHoustonX = x + w - pad - colHoustonW;
    const col2024X = colHoustonX - col2024W;

    ctx.font = "600 9px 'Open Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Value", col2024X + col2024W, cy);
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("Houston*", colHoustonX + colHoustonW, cy);
    ctx.textAlign = "left";
    cy += 14;

    // Divider after column headers
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 6;

    // Data rows
    WORKING_POOR_FIELDS.forEach(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
      if (!hasKeyData && (highlight || isRank)) return;
      // Row with highlight styling for working poor score
      const rowPadY = highlight ? 6 : 3;
      cy += rowPadY;

      // Label
      ctx.font = highlight ? "600 12px 'Open Sans', sans-serif" : "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = highlight ? "#FFC857" : "#CCCCCC";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad, cy);

      // Value (with working poor band circle for highlight row)
      ctx.textAlign = "right";
      const formattedVal = isRank ? format(data[key], workingPoorRankedCount) : format(data[key]);
      if (highlight) {
        const circleX = col2024X + col2024W - ctx.measureText(formattedVal).width - 18;
        ctx.fillStyle = getWorkingPoorBandColor(data.working_poor_score);
        ctx.beginPath();
        ctx.arc(circleX, cy + 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = highlight ? "700 14px 'Open Sans', sans-serif" : "500 12px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(formattedVal, col2024X + col2024W, cy);

      // Houston median value
      const medianVal = medians?.[key];
      if (showMedian && medianVal != null) {
        ctx.font = "400 11px 'Open Sans', sans-serif";
        ctx.fillStyle = "#8FB6FF";
        const fmtMedian = medianFormat ? medianFormat(medianVal) : medianVal.toLocaleString();
        ctx.fillText(fmtMedian, colHoustonX + colHoustonW, cy);
      }

      ctx.textAlign = "left";
      cy += (highlight ? 14 : 12) + rowPadY;

      // Bottom border for highlight row
      if (highlight) {
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(x + pad, cy);
        ctx.lineTo(x + w - pad, cy);
        ctx.stroke();
        cy += 2;
      }
    });

    // Source citation
    cy += 4;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 8;

    ctx.font = "italic 9px 'Open Sans', sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText(`Source: ${CENSUS_SOURCE}`, x + pad, cy);
    cy += 12;
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("* Greater Houston area median", x + pad, cy);
  };

  // Draw evictions data table on canvas (for download)
  const drawEvictionsTableOnCanvas = (ctx, data, zipCode, neighborhood, medians, containerEl) => {
    if (!data || !zipCode) return;
    const el = containerEl.querySelector("[data-evictions-table]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const y = eRect.top - cRect.top;
    const w = eRect.width;
    const h = eRect.height;
    const pad = 14;

    // Key data = evictions_score populated
    const hasKeyData = data.evictions_score != null;
    const bgColor = hasKeyData ? "rgba(34, 40, 49, 0.95)" : "rgba(105, 105, 118, 0.95)";
    drawRoundedRect(ctx, x, y, w, h, 8, bgColor);
    ctx.textBaseline = "top";

    let cy = y + 10;

    ctx.font = "600 15px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    if (data.county) {
      ctx.font = "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(`${data.county} County`, x + pad, cy);
      cy += 14;
    }

    if (neighborhood) {
      ctx.font = "400 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#8FB6FF";
      ctx.fillText(truncateText(ctx, neighborhood, w - pad * 2), x + pad, cy);
      cy += 14;
    }

    // Banner when evictions score is unavailable
    if (!hasKeyData) {
      ctx.fillStyle = "rgba(255, 179, 2, 0.15)";
      ctx.fillRect(x, cy, w, 30);
      ctx.strokeStyle = "rgba(255, 179, 2, 0.25)";
      ctx.beginPath(); ctx.moveTo(x, cy + 30); ctx.lineTo(x + w, cy + 30); ctx.stroke();
      ctx.font = "500 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFB302";
      ctx.textAlign = "left";
      ctx.fillText("Evictions score not available — data shown for reference only", x + pad, cy + 6);
      ctx.font = "italic 9px 'Open Sans', sans-serif";
      ctx.fillStyle = "#999999";
      ctx.fillText("Not scored or ranked. Excluded from Greater Houston statistics.", x + pad, cy + 18);
      cy += 34;
    }

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 8;

    const valColW = 72;
    const valCol1X = x + w - pad - valColW * 2;
    const valCol2X = x + w - pad - valColW;

    ctx.font = "600 9px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "right";
    ctx.fillText("2024", valCol1X + valColW, cy);
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("Houston*", valCol2X + valColW, cy);
    ctx.textAlign = "left";
    cy += 14;

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 6;

    EVICTIONS_FIELDS.forEach(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
      if (!hasKeyData && (highlight || isRank)) return;

      const rowPadY = highlight ? 6 : 3;
      cy += rowPadY;

      ctx.font = highlight ? "600 12px 'Open Sans', sans-serif" : "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = highlight ? "#FFC857" : "#CCCCCC";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad, cy);

      ctx.textAlign = "right";
      const formattedVal = isRank ? format(data[key], evictionsRankedCount) : format(data[key]);
      if (highlight) {
        const circleX = valCol1X + valColW - ctx.measureText(formattedVal).width - 18;
        ctx.fillStyle = getEvictionsBandColor(data.evictions_score);
        ctx.beginPath();
        ctx.arc(circleX, cy + 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = highlight ? "700 14px 'Open Sans', sans-serif" : "500 12px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(formattedVal, valCol1X + valColW, cy);

      const medianVal = medians?.[key];
      if (showMedian && medianVal != null) {
        ctx.font = "400 11px 'Open Sans', sans-serif";
        ctx.fillStyle = "#8FB6FF";
        const fmtMedian = medianFormat ? medianFormat(medianVal) : medianVal.toLocaleString();
        ctx.fillText(fmtMedian, valCol2X + valColW, cy);
      }

      ctx.textAlign = "left";
      cy += (highlight ? 14 : 12) + rowPadY;

      if (highlight) {
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(x + pad, cy);
        ctx.lineTo(x + w - pad, cy);
        ctx.stroke();
        cy += 2;
      }
    });

    cy += 4;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 8;

    ctx.font = "italic 9px 'Open Sans', sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText("Source: Harris County Justice of the Peace Courts", x + pad, cy);
    cy += 12;
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("* Greater Houston area median", x + pad, cy);
  };

  // Draw FVI index info box on canvas — mirrors drawDistressTableOnCanvas,
  // iterates FVI_FIELDS so any field-list edits flow through.
  const drawFamilyVulnerabilityTableOnCanvas = (ctx, data, zipCode, neighborhood, medians, containerEl) => {
    if (!data || !zipCode) return;
    const el = containerEl.querySelector("[data-fvi-table]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const y = eRect.top - cRect.top;
    const w = eRect.width;
    const h = eRect.height;
    const pad = 14;

    const hasKeyData = data.family_vulnerability_index != null;
    const bgColor = hasKeyData ? "rgba(34, 40, 49, 0.95)" : "rgba(105, 100, 110, 0.95)";
    drawRoundedRect(ctx, x, y, w, h, 8, bgColor);
    ctx.textBaseline = "top";

    let cy = y + 10;

    ctx.font = "600 15px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    if (data.county) {
      ctx.font = "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(`${data.county} County`, x + pad, cy);
      cy += 14;
    }
    if (neighborhood) {
      ctx.font = "400 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#8FB6FF";
      ctx.fillText(truncateText(ctx, neighborhood, w - pad * 2), x + pad, cy);
      cy += 14;
    }

    if (!hasKeyData) {
      ctx.fillStyle = "rgba(255, 179, 2, 0.15)";
      ctx.fillRect(x, cy, w, 30);
      ctx.strokeStyle = "rgba(255, 179, 2, 0.25)";
      ctx.beginPath();
      ctx.moveTo(x, cy + 30);
      ctx.lineTo(x + w, cy + 30);
      ctx.stroke();
      cy += 6;
      ctx.font = "500 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFB302";
      ctx.fillText("Family Vulnerability Index not available — data shown for reference only", x + pad, cy);
      cy += 13;
      ctx.font = "italic 9px 'Open Sans', sans-serif";
      ctx.fillStyle = "#999999";
      ctx.fillText("Not scored or ranked. Excluded from Greater Houston statistics.", x + pad, cy);
      cy += 15;
    }

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 8;

    const colValW = 72;
    const colHoustonW = 60;
    const colHoustonX = x + w - pad - colHoustonW;
    const colValX = colHoustonX - colValW;

    ctx.font = "600 9px 'Open Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Value", colValX + colValW, cy);
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("Houston*", colHoustonX + colHoustonW, cy);
    ctx.textAlign = "left";
    cy += 14;

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 6;

    FVI_FIELDS.forEach(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
      if (!hasKeyData && (highlight || isRank)) return;
      const rowPadY = highlight ? 6 : 3;
      cy += rowPadY;

      ctx.font = highlight ? "600 12px 'Open Sans', sans-serif" : "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = highlight ? "#FFC857" : "#CCCCCC";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad, cy);

      ctx.textAlign = "right";
      const formattedVal = isRank ? format(data[key], fviRankedCount) : format(data[key]);
      if (highlight) {
        const circleX = colValX + colValW - ctx.measureText(formattedVal).width - 18;
        ctx.fillStyle = getDistressBandColor(data.family_vulnerability_index);
        ctx.beginPath();
        ctx.arc(circleX, cy + 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = highlight ? "700 14px 'Open Sans', sans-serif" : "500 12px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(formattedVal, colValX + colValW, cy);

      const medianVal = medians?.[key];
      if (showMedian && medianVal != null) {
        ctx.font = "400 11px 'Open Sans', sans-serif";
        ctx.fillStyle = "#8FB6FF";
        const fmtMedian = medianFormat ? medianFormat(medianVal) : medianVal.toLocaleString();
        ctx.fillText(fmtMedian, colHoustonX + colHoustonW, cy);
      }

      ctx.textAlign = "left";
      cy += (highlight ? 14 : 12) + rowPadY;

      if (highlight) {
        // Per-quintile interpretation label for the FVI score.
        const quintileLabel = getFviQuintileLabel(data.family_vulnerability_index);
        if (quintileLabel) {
          ctx.font = "italic 10px 'Open Sans', sans-serif";
          ctx.fillStyle = "#DDDDDD";
          ctx.textAlign = "left";
          const labelLines = wrapText(ctx, quintileLabel, w - pad * 2);
          for (const line of labelLines) {
            ctx.fillText(line, x + pad, cy);
            cy += 13;
          }
          cy += 4;
        }
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(x + pad, cy);
        ctx.lineTo(x + w - pad, cy);
        ctx.stroke();
        cy += 2;
      }
    });

    cy += 4;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 8;

    ctx.font = "italic 9px 'Open Sans', sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText(`Source: ${CENSUS_SOURCE}`, x + pad, cy);
    cy += 12;
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("* Greater Houston area median", x + pad, cy);
  };

  // Draw FVI bivariate info box on canvas — cell label + code + swatch + 4 data rows.
  const drawFamilyBivariateTableOnCanvas = (ctx, data, zipCode, neighborhood, containerEl) => {
    if (!data || !zipCode) return;
    const el = containerEl.querySelector("[data-family-bivariate-table]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const y = eRect.top - cRect.top;
    const w = eRect.width;
    const h = eRect.height;
    const pad = 14;

    drawRoundedRect(ctx, x, y, w, h, 8, "rgba(34, 40, 49, 0.95)");
    ctx.textBaseline = "top";

    let cy = y + 10;

    ctx.font = "600 15px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    if (data.county) {
      ctx.font = "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(`${data.county} County`, x + pad, cy);
      cy += 14;
    }
    if (neighborhood) {
      ctx.font = "400 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#8FB6FF";
      ctx.fillText(truncateText(ctx, neighborhood, w - pad * 2), x + pad, cy);
      cy += 14;
    }

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 12;

    const distress = data.distress_score != null ? Number(data.distress_score) : null;
    const childrenPct = data.households_w_children != null ? Number(data.households_w_children) : null;
    const mapCode = data.fvi_map_code != null ? String(data.fvi_map_code) : "";
    const codeLabel = FAMILY_BIVARIATE_LABELS[mapCode] || "—";
    const codeColor = FAMILY_BIVARIATE_LEGEND_COLORS[mapCode] || "#666";

    // Cell swatch + label + code
    const swatchSize = 24;
    drawRoundedRect(ctx, x + pad, cy, swatchSize, swatchSize, 4, codeColor);
    ctx.font = "600 14px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(truncateText(ctx, codeLabel, w - pad * 2 - swatchSize - 10), x + pad + swatchSize + 10, cy + 2);
    ctx.font = "400 10px 'Open Sans', sans-serif";
    ctx.fillStyle = "#999999";
    ctx.fillText(`Code: ${mapCode || "—"}`, x + pad + swatchSize + 10, cy + 18);
    cy += swatchSize + 10;

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 10;

    const rows = [
      ["Family Vulnerability Index", data.family_vulnerability_index != null ? Number(data.family_vulnerability_index).toFixed(1) : "—"],
      ["Distress Score", distress != null ? distress.toFixed(1) : "—"],
      ["Households w/ Children", childrenPct != null ? `${(childrenPct * 100).toFixed(1)}%` : "—"],
      ["Households", data.households != null ? Math.round(Number(data.households)).toLocaleString() : "—"],
    ];
    rows.forEach(([label, val]) => {
      ctx.font = "500 13px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad, cy);
      ctx.font = "500 14px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "right";
      ctx.fillText(val, x + w - pad, cy);
      ctx.textAlign = "left";
      cy += 22;
    });
  };

  // Word-wrap helper for canvas — splits text at the last space that fits within maxWidth.
  const wrapText = (ctx, text, maxWidth) => {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  // Draw efficiency info box on canvas — efficiency score + explainer + 3 fields.
  const drawEfficiencyTableOnCanvas = (ctx, data, zipCode, neighborhood, containerEl) => {
    if (!data || !zipCode) return;
    const el = containerEl.querySelector("[data-efficiency-table]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const y = eRect.top - cRect.top;
    const w = eRect.width;
    const h = eRect.height;
    const pad = 14;

    drawRoundedRect(ctx, x, y, w, h, 8, "rgba(34, 40, 49, 0.95)");
    ctx.textBaseline = "top";

    let cy = y + 10;

    ctx.font = "600 15px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    if (data.county) {
      ctx.font = "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(`${data.county} County`, x + pad, cy);
      cy += 14;
    }
    if (neighborhood) {
      ctx.font = "400 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#8FB6FF";
      ctx.fillText(truncateText(ctx, neighborhood, w - pad * 2), x + pad, cy);
      cy += 14;
    }

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 12;

    const efficiencyScore = data.normal_efficiency_ratio != null
      ? Number(data.normal_efficiency_ratio).toFixed(1)
      : "—";
    const distressScore = data.distress_score != null ? Number(data.distress_score).toFixed(1) : "—";
    const fundingAmount = data.zip_fin_funding != null
      ? `$${Math.round(Number(data.zip_fin_funding)).toLocaleString()}`
      : "—";
    const populationVal = data.population != null
      ? Math.round(Number(data.population)).toLocaleString()
      : "—";

    // Efficiency Score (bold)
    ctx.font = "500 13px 'Open Sans', sans-serif";
    ctx.fillStyle = "#CCCCCC";
    ctx.textAlign = "left";
    ctx.fillText("Efficiency Score", x + pad, cy);
    ctx.font = "600 16px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "right";
    ctx.fillText(efficiencyScore, x + w - pad, cy);
    ctx.textAlign = "left";
    cy += 22;

    // Explainer (italic, gray, wraps to 2 lines if needed)
    ctx.font = "italic 10px 'Open Sans', sans-serif";
    ctx.fillStyle = "#999999";
    const explainerLines = wrapText(
      ctx,
      "Higher score means more distress per dollar of funding — greater unmet need relative to funding.",
      w - pad * 2
    );
    explainerLines.forEach((line) => { ctx.fillText(line, x + pad, cy); cy += 13; });
    cy += 4;

    [
      ["Distress Score", distressScore],
      ["Funding Level", fundingAmount],
      ["Population", populationVal],
    ].forEach(([label, val]) => {
      ctx.font = "500 13px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad, cy);
      ctx.font = "500 14px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "right";
      ctx.fillText(val, x + w - pad, cy);
      ctx.textAlign = "left";
      cy += 22;
    });
  };

  // Draw distress × funding bivariate info box on canvas — cell label + code + swatch + 3 fields.
  const drawBivariateTableOnCanvas = (ctx, data, zipCode, neighborhood, containerEl) => {
    if (!data || !zipCode) return;
    const el = containerEl.querySelector("[data-bivariate-table]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const y = eRect.top - cRect.top;
    const w = eRect.width;
    const h = eRect.height;
    const pad = 14;

    drawRoundedRect(ctx, x, y, w, h, 8, "rgba(34, 40, 49, 0.95)");
    ctx.textBaseline = "top";

    let cy = y + 10;

    ctx.font = "600 15px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    if (data.county) {
      ctx.font = "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(`${data.county} County`, x + pad, cy);
      cy += 14;
    }
    if (neighborhood) {
      ctx.font = "400 10px 'Open Sans', sans-serif";
      ctx.fillStyle = "#8FB6FF";
      ctx.fillText(truncateText(ctx, neighborhood, w - pad * 2), x + pad, cy);
      cy += 14;
    }

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 12;

    const mapCode = data.bivariate_map_code != null ? String(data.bivariate_map_code) : "";
    const codeLabel = BIVARIATE_LABELS[mapCode] || "—";
    const codeColor = BIVARIATE_COLORS[mapCode] || "#666";

    // Swatch + label + code
    const swatchSize = 24;
    drawRoundedRect(ctx, x + pad, cy, swatchSize, swatchSize, 4, codeColor);
    ctx.font = "600 14px 'Open Sans', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(truncateText(ctx, codeLabel, w - pad * 2 - swatchSize - 10), x + pad + swatchSize + 10, cy + 2);
    ctx.font = "400 10px 'Open Sans', sans-serif";
    ctx.fillStyle = "#999999";
    ctx.fillText(`Code: ${mapCode || "—"}`, x + pad + swatchSize + 10, cy + 18);
    cy += swatchSize + 10;

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 10;

    [
      ["Distress Score", data.distress_score != null ? Number(data.distress_score).toFixed(1) : "—"],
      ["Funding Level", data.zip_fin_funding != null ? `$${Math.round(Number(data.zip_fin_funding)).toLocaleString()}` : "—"],
      ["Population", data.population != null ? Math.round(Number(data.population)).toLocaleString() : "—"],
    ].forEach(([label, val]) => {
      ctx.font = "500 13px 'Open Sans', sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad, cy);
      ctx.font = "500 14px 'Open Sans', sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "right";
      ctx.fillText(val, x + w - pad, cy);
      ctx.textAlign = "left";
      cy += 22;
    });
  };

  // Height the metric bar will occupy when drawn on canvas. Mirrors the
  // y-advances inside drawMetricBarOnCanvas — kept in lockstep so legend
  // boxes are sized correctly up-front.
  const getMetricBarCanvasHeight = (mode) => {
    if (mode === "no_base_map") return 0;
    if (mode === "bivariate" || isCoverageBivariate(mode)) return 10 + 110; // divider + grid
    return 10 + 16 + 14 + 14; // divider + label + bar + scale
  };

  // Shift the legend up if its computed content height would push past the
  // bottom of the canvas (happens with the tall bivariate legend on short
  // maps). The DOM rect anchors the legend with `bottom-6 left-4`, so the
  // top-left we read can land too low when the legend grows.
  const fitLegendY = (naturalY, contentHeight, canvasHeight) => {
    const bottomMargin = 8;
    const topMargin = 8;
    const maxY = canvasHeight - contentHeight - bottomMargin;
    return Math.max(topMargin, Math.min(naturalY, maxY));
  };

  // Draw a simple legend directly on canvas
  const drawSimpleLegendOnCanvas = (ctx, label, count, countyName, containerEl, mode) => {
    const el = containerEl.querySelector("[data-legend]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const w = eRect.width;
    const pad = 16;

    // Predict total content height so we can size the box correctly and
    // lift it above the canvas bottom if needed.
    const contentHeight = 12 // top pad
      + (label ? 22 : 0)
      + 20 + 20 + 22 // 3 pin/swatch rows
      + 16 // count line
      + getMetricBarCanvasHeight(mode)
      + 12; // bottom pad
    const y = fitLegendY(eRect.top - cRect.top, contentHeight, cRect.height);

    drawRoundedRect(ctx, x, y, w, contentHeight, 8, "rgba(255, 255, 255, 0.95)");
    ctx.textBaseline = "top";
    let cy = y + 12;

    // Assistance label
    if (label) {
      ctx.font = "600 13px 'Open Sans', sans-serif";
      ctx.fillStyle = "#222831";
      ctx.fillText(label, x + pad, cy);
      cy += 22;
    }

    // Green pin circle + "Organization location"
    ctx.fillStyle = "#00CC44";
    ctx.beginPath();
    ctx.arc(x + pad + 5, cy + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "400 12px 'Open Sans', sans-serif";
    ctx.fillStyle = "#444444";
    ctx.fillText("Organization location", x + pad + 18, cy);
    cy += 20;

    // Cyan pin circle + "Selected organization"
    ctx.fillStyle = "#00FDFD";
    ctx.beginPath();
    ctx.arc(x + pad + 5, cy + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#444444";
    ctx.fillText("Selected organization", x + pad + 18, cy);
    cy += 20;

    // Magenta square + "Selected org's zips" — matches the highlight that
    // appears on the map when a pin is clicked.
    ctx.fillStyle = "rgba(255, 0, 255, 0.5)";
    ctx.fillRect(x + pad + 1, cy + 2, 10, 10);
    ctx.fillStyle = "#444444";
    ctx.fillText("Selected org's zips", x + pad + 18, cy);
    cy += 22;

    // Org count
    ctx.font = "400 11px 'Open Sans', sans-serif";
    ctx.fillStyle = "#888888";
    let countText = `${count} organization${count !== 1 ? "s" : ""} shown`;
    if (countyName && countyName !== "All Counties") {
      countText += ` · ${countyName} County`;
    }
    ctx.fillText(countText, x + pad, cy);
    cy += 16;

    // Metric legend bar
    drawMetricBarOnCanvas(ctx, x, cy, w, pad, mode);
  };

  // Draw parent coverage legend directly on canvas
  const drawParentCoverageLegendOnCanvas = (ctx, label, parentName, count, countyName, containerEl, mode) => {
    const el = containerEl.querySelector("[data-legend]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const w = eRect.width;
    const pad = 16;

    // Predict total content height so we can size the box correctly and
    // lift it above the canvas bottom if needed (Compare mode's bivariate
    // grid is what pushes this over the edge on shorter maps).
    const showCounty = countyName && countyName !== "All Counties";
    const contentHeight = 12 // top pad
      + (label ? 18 : 0)
      + (parentName ? 22 : 0)
      + 22 // coverage swatch row
      + 10 + 20 + 20 + 22 // divider + 3 pin/swatch rows
      + (showCounty ? 16 : 0)
      + getMetricBarCanvasHeight(mode)
      + 12; // bottom pad
    const y = fitLegendY(eRect.top - cRect.top, contentHeight, cRect.height);

    drawRoundedRect(ctx, x, y, w, contentHeight, 8, "rgba(255, 255, 255, 0.95)");
    ctx.textBaseline = "top";
    let cy = y + 12;

    // Assistance label
    if (label) {
      ctx.font = "600 13px 'Open Sans', sans-serif";
      ctx.fillStyle = "#222831";
      ctx.fillText(label, x + pad, cy);
      cy += 18;
    }

    // Parent org
    if (parentName) {
      ctx.font = "500 12px 'Open Sans', sans-serif";
      ctx.fillStyle = "#652C57";
      ctx.fillText(truncateText(ctx, `${parentName} — ${count} child${count !== 1 ? "ren" : ""}`, w - pad * 2), x + pad, cy);
      cy += 22;
    }

    // Purple swatch + "Parent coverage area"
    ctx.fillStyle = PARENT_COVERAGE_COLOR;
    ctx.fillRect(x + pad + 1, cy + 2, 10, 10);
    ctx.font = "400 12px 'Open Sans', sans-serif";
    ctx.fillStyle = "#444444";
    ctx.fillText("Parent coverage area", x + pad + 18, cy);
    cy += 22;

    // Divider
    ctx.strokeStyle = "#E0E0E0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 10;

    // Green pin + "Organization location"
    ctx.fillStyle = "#00CC44";
    ctx.beginPath();
    ctx.arc(x + pad + 5, cy + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "400 12px 'Open Sans', sans-serif";
    ctx.fillStyle = "#444444";
    ctx.fillText("Organization location", x + pad + 18, cy);
    cy += 20;

    // Cyan pin + "Selected organization"
    ctx.fillStyle = "#00FDFD";
    ctx.beginPath();
    ctx.arc(x + pad + 5, cy + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#444444";
    ctx.fillText("Selected organization", x + pad + 18, cy);
    cy += 20;

    // Teal square + "Selected org's zips"
    ctx.fillStyle = "rgba(0, 168, 168, 0.4)";
    ctx.fillRect(x + pad + 1, cy + 2, 10, 10);
    ctx.fillStyle = "#444444";
    ctx.fillText("Selected org's zips", x + pad + 18, cy);
    cy += 22;

    // County
    if (countyName && countyName !== "All Counties") {
      ctx.font = "400 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#888888";
      ctx.fillText(`${countyName} County`, x + pad, cy);
      cy += 16;
    }

    // Metric legend bar
    drawMetricBarOnCanvas(ctx, x, cy, w, pad, mode);
  };

  // Draw metric legend bar on canvas (distress/working poor/population)
  const drawMetricBarOnCanvas = (ctx, x, y, w, pad, mode) => {
    if (mode === "no_base_map") return y;
    let cy = y;
    // Divider
    ctx.strokeStyle = "#E0E0E0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 10;

    // Bivariate: draw 3x3 grid instead of bar
    if (mode === "bivariate" || isCoverageBivariate(mode)) {
      drawBivariateGridOnCanvas(ctx, x, cy, mode);
      return cy + 110;
    }

    // Label
    ctx.font = "500 11px 'Open Sans', sans-serif";
    ctx.fillStyle = "#444444";
    const labels = {
      distress: "Distress Score",
      working_poor: "Working Poor Score",
      evictions: "Evictions Score",
      population: "Population Score",
      funding_level: "Funding Level Score",
      efficiency_ratio: "Efficiency Ratio Score",
      service_coverage: "Coverage Gap Score",
    };
    ctx.fillText(labels[mode] || "Distress Score", x + pad, cy);
    cy += 16;

    // Color bars
    const barW = w - pad * 2;
    const barH = 10;
    const colors = {
      distress: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
      working_poor: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
      evictions: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
      population: { colors: ["rgba(200, 170, 230, 0.45)", "rgba(175, 130, 215, 0.45)", "rgba(150, 85, 195, 0.48)", "rgba(110, 40, 160, 0.52)", "rgba(75, 0, 130, 0.55)"], weights: [1, 1, 1, 1, 1] },
      funding_level: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
      efficiency_ratio: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
      service_coverage: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
    };
    const colorDef = colors[mode] || colors.distress;
    const isWeighted = colorDef.colors != null;
    const c = isWeighted ? colorDef.colors : colorDef;
    const weights = isWeighted ? colorDef.weights : c.map(() => 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let bx = x + pad;
    c.forEach((color, i) => {
      const sw = barW * weights[i] / totalWeight;
      ctx.fillStyle = color;
      ctx.fillRect(bx, cy, sw, barH);
      bx += sw;
    });
    cy += barH + 4;

    // Scale labels
    ctx.font = "400 9px 'Open Sans', sans-serif";
    ctx.fillStyle = "#666666";
    if (mode === "distress" || mode === "working_poor" || mode === "evictions" || mode === "family_vulnerability" || mode === "efficiency_ratio" || mode === "service_coverage") {
      const scaleValues = ["0", "20", "40", "60", "80", "100"];
      const positions = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
      scaleValues.forEach((val, i) => {
        const lx = x + pad + (barW * positions[i]);
        ctx.textAlign = i === 0 ? "left" : i === scaleValues.length - 1 ? "right" : "center";
        ctx.fillText(val, lx, cy);
      });
    } else {
      const sl = ["Low", "Mid", "High"];
      ctx.textAlign = "left";
      ctx.fillText(sl[0], x + pad, cy);
      ctx.textAlign = "center";
      ctx.fillText(sl[1], x + w / 2, cy);
      ctx.textAlign = "right";
      ctx.fillText(sl[2], x + w - pad, cy);
    }
    ctx.textAlign = "left"; // reset

    return cy + 14; // return new y position
  };

  // Draw base legend on canvas (standalone metric bar in bottom-left, no filters applied)
  const drawBivariateGridOnCanvas = (ctx, x, y, mode = "bivariate") => {
    const cellSize = 28;
    // Stevens palette (33 = worst). Display order: high distress on top.
    const gridColors = [
      ["#DC6E8C", "#AA5F9B", "#6E3282"], // row 3 (high distress)
      ["#E6C3D2", "#B4A5C3", "#8282C3"], // row 2 (mid distress)
      ["#E8E8E8", "#BED7E6", "#5FA5D7"], // row 1 (low distress)
    ];
    const isCoverageBivariateMode = isCoverageBivariate(mode);
    const yLabel = mode === "evictions_coverage_bivariate" ? "Evictions" : "Distress";
    const title = isCoverageBivariateMode ? `${yLabel} × Resources` : "Distress vs. Funding";
    const xAxisLabel = isCoverageBivariateMode ? "Coverage Gap →" : "Funding Gap →";

    // Title
    ctx.font = "500 11px 'Open Sans', sans-serif";
    ctx.fillStyle = "#444444";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(title, x + 20, y);

    // 3x3 grid (drawn top-down: high distress at top)
    const gridX = x + 20;
    const gridY = y + 16;
    const gridCodes = [
      ["31", "32", "33"],
      ["21", "22", "23"],
      ["11", "12", "13"],
    ];
    const darkCells = new Set(["13", "23", "31", "32", "33"]);
    gridColors.forEach((row, ri) => {
      row.forEach((color, ci) => {
        const cx = gridX + ci * cellSize;
        const cy2 = gridY + ri * cellSize;
        ctx.fillStyle = color;
        ctx.fillRect(cx, cy2, cellSize, cellSize);
        // Draw code label centered in cell
        const code = gridCodes[ri][ci];
        ctx.font = "500 8px 'Open Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = darkCells.has(code) ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.4)";
        ctx.fillText(code, cx + cellSize / 2, cy2 + cellSize / 2);
      });
    });
    ctx.textBaseline = "top"; // reset

    // Axis labels
    ctx.font = "400 8px 'Open Sans', sans-serif";
    ctx.fillStyle = "#666666";
    ctx.textAlign = "center";
    ctx.fillText(xAxisLabel, gridX + cellSize * 1.5, gridY + cellSize * 3 + 4);

    ctx.save();
    ctx.translate(gridX - 4, gridY + cellSize * 1.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${yLabel} →`, 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
  };

  const drawBaseLegendOnCanvas = (ctx, containerEl, mode) => {
    if (mode === "no_base_map") return;
    const { height } = containerEl.getBoundingClientRect();

    if (mode === "bivariate" || isCoverageBivariate(mode)) {
      // Draw 3x3 bivariate grid legend
      const w = 160;
      const boxH = 120;
      const x = 16;
      const y = height - boxH - 24;
      drawRoundedRect(ctx, x, y, w, boxH, 8);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
      drawBivariateGridOnCanvas(ctx, x, y + 8, mode);
      return;
    }

    const w = 220;
    const pad = 12;
    const boxH = 75;
    const x = 16;
    const y = height - boxH - 24;

    // White background box
    drawRoundedRect(ctx, x, y, w, boxH, 8);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();

    // Draw the metric bar inside the box (skip the divider by starting below top padding)
    const labels = { distress: "Distress Score", working_poor: "Working Poor Score", evictions: "Evictions Score", population: "Population", funding_level: "Funding Level Score", efficiency_ratio: "Efficiency Ratio Score", service_coverage: "Coverage Gap Score" };
    let cy = y + 10;
    ctx.font = "500 11px 'Open Sans', sans-serif";
    ctx.fillStyle = "#444444";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(labels[mode] || "Distress Score", x + pad, cy);
    cy += 16;

    // Color bars
    const barW = w - pad * 2;
    const barH = 10;
    const colors = {
      distress: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
      working_poor: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
      evictions: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
      population: { colors: ["rgba(200, 170, 230, 0.45)", "rgba(175, 130, 215, 0.45)", "rgba(150, 85, 195, 0.48)", "rgba(110, 40, 160, 0.52)", "rgba(75, 0, 130, 0.55)"], weights: [1, 1, 1, 1, 1] },
      funding_level: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
      efficiency_ratio: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
      service_coverage: { colors: ["rgba(66, 133, 244, 0.40)", "rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.45)", "rgba(245, 124, 0, 0.50)", "rgba(220, 50, 50, 0.55)"], weights: [1, 1, 1, 1, 1] },
    };
    const colorDef = colors[mode] || colors.distress;
    const isWeighted = colorDef.colors != null;
    const c = isWeighted ? colorDef.colors : colorDef;
    const weights = isWeighted ? colorDef.weights : c.map(() => 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let bx = x + pad;
    c.forEach((color, i) => {
      const sw = barW * weights[i] / totalWeight;
      ctx.fillStyle = color;
      ctx.fillRect(bx, cy, sw, barH);
      bx += sw;
    });
    cy += barH + 4;

    // Scale labels
    ctx.font = "400 9px 'Open Sans', sans-serif";
    ctx.fillStyle = "#666666";
    if (mode === "distress" || mode === "working_poor" || mode === "evictions" || mode === "family_vulnerability" || mode === "efficiency_ratio" || mode === "service_coverage") {
      const scaleValues = ["0", "20", "40", "60", "80", "100"];
      const positions = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
      scaleValues.forEach((val, i) => {
        const lx = x + pad + (barW * positions[i]);
        ctx.textAlign = i === 0 ? "left" : i === scaleValues.length - 1 ? "right" : "center";
        ctx.fillText(val, lx, cy);
      });
    } else {
      const sl = ["Low", "Mid", "High"];
      ctx.textAlign = "left";
      ctx.fillText(sl[0], x + pad, cy);
      ctx.textAlign = "center";
      ctx.fillText(sl[1], x + w / 2, cy);
      ctx.textAlign = "right";
      ctx.fillText(sl[2], x + w - pad, cy);
    }
    ctx.textAlign = "left"; // reset
  };

  // Draw a map pin directly on canvas at given pixel position
  const drawPin = (ctx, x, y, isActive, pinSize = 30) => {
    const scale = pinSize / 48; // SVG viewBox is 48x48
    ctx.save();
    // Anchor bottom: shift up by full height, center horizontally
    ctx.translate(x - (24 * scale), y - (48 * scale));
    ctx.scale(scale, scale);

    // Shaft (thin needle)
    ctx.fillStyle = "#889097";
    ctx.beginPath();
    ctx.moveTo(25, 20);
    ctx.lineTo(23, 20);
    ctx.lineTo(23, 41);
    ctx.quadraticCurveTo(24, 45, 24, 45);
    ctx.quadraticCurveTo(24, 45, 25, 41);
    ctx.lineTo(25, 20);
    ctx.closePath();
    ctx.fill();

    // Head (circle)
    const headColor = isActive ? "#00FDFD" : "#00CC44";
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(24, 13, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Draw a Filters panel at top-left (under the page title). Shows only the
  // selections the user actually made in the v2 sidebar (mode + per-mode
  // controls + non-default Where/Who); skips defaults like "All Counties"
  // so the panel stays compact instead of restating the whole sidebar.
  const drawFiltersOnCanvas = (ctx, containerEl, startY = 14) => {
    const isCondMode = displayMetric === "distress" || displayMetric === "evictions";
    const isCompare = isCoverageBivariate(displayMetric);
    const isResources = displayMetric === "service_coverage" || displayMetric === "no_base_map";
    const modeName = isCondMode ? "Conditions" : isCompare ? "Compare" : "Resources";

    const rows = [];
    rows.push({ label: "Mode", value: modeName });

    if (isCondMode || isCompare) {
      const isEvictions = displayMetric === "evictions" || displayMetric === "evictions_coverage_bivariate";
      rows.push({ label: "Condition", value: isEvictions ? "Evictions" : "Distress" });
    }
    if ((isResources || isCompare) && assistanceLabel) {
      rows.push({ label: "Assistance", value: assistanceLabel });
    }
    if (isResources) {
      rows.push({ label: "View", value: displayMetric === "service_coverage" ? "Coverage" : "Locations" });
    }
    if (county && county !== "All Counties") {
      rows.push({ label: "County", value: county });
    }
    if (parentOrg && parentOrg !== "All Parents") {
      rows.push({ label: "Parent", value: parentOrg });
    }
    if (organization && organization !== "All Organizations") {
      rows.push({ label: "Organization", value: organization });
    }

    if (rows.length === 0) return;

    const padX = 14;
    const padY = 12;
    const rowH = 18;
    const titleH = 22;
    const panelW = 280;
    const panelH = padY * 2 + titleH + rows.length * rowH;
    const panelX = 20;
    const panelY = startY;

    drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 8, "rgba(255, 255, 255, 0.95)");

    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    ctx.font = "600 13px 'Open Sans', sans-serif";
    ctx.fillStyle = "#2E5A88";
    ctx.fillText("Filters", panelX + padX, panelY + padY);

    let ry = panelY + padY + titleH;
    rows.forEach(({ label, value }) => {
      ctx.font = "500 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#666666";
      const labelText = `${label}: `;
      ctx.fillText(labelText, panelX + padX, ry);
      const labelW = ctx.measureText(labelText).width;

      ctx.font = "600 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "#222831";
      const valueText = truncateText(ctx, value, panelW - padX * 2 - labelW);
      ctx.fillText(valueText, panelX + padX + labelW, ry);
      ry += rowH;
    });
  };

  // Download map as PNG image
  // Uses Mapbox's preserveDrawingBuffer to capture the WebGL canvas,
  // then draws pins directly on canvas for crisp output
  const handleDownload = useCallback(async () => {
    if (!mapContainerRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const map = mapRef.current?.getMap();
      if (!map) throw new Error("Map not ready");

      const container = mapContainerRef.current;
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Create output canvas at device pixel ratio for crisp output
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = width * dpr;
      outputCanvas.height = height * dpr;
      const ctx = outputCanvas.getContext("2d");
      ctx.scale(dpr, dpr);

      // Step 1: Capture the Mapbox WebGL canvas
      map.triggerRepaint();
      await new Promise((resolve) => map.once("render", resolve));

      const mapCanvas = map.getCanvas();
      ctx.drawImage(mapCanvas, 0, 0, width, height);

      // Step 2: Draw pins directly on canvas (avoids dom-to-image SVG issues)
      if (hasAssistance) {
        orgPins.forEach((org) => {
          const point = map.project([org.lng, org.lat]);
          const isActive = selectedOrgKey === org.key;
          const pinSize = isActive ? 30 * 1.05 : 30;
          drawPin(ctx, point.x, point.y, isActive, pinSize);
        });

        // Step 2b: Draw org labels on canvas when toggle is active
        if (showOrgLabels) {
          ctx.font = "500 10px 'Open Sans', sans-serif";
          ctx.textBaseline = "middle";
          orgPins.forEach((org) => {
            const point = map.project([org.lng, org.lat]);
            const label = org.organization;
            const labelX = point.x + 18; // offset right of pin
            const labelY = point.y - 26; // near pin head

            const textWidth = ctx.measureText(label).width;
            const maxWidth = 180;
            const displayWidth = Math.min(textWidth, maxWidth);

            // Background
            ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
            ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
            ctx.lineWidth = 0.5;
            const bgPad = 4;
            const bgHeight = 16;
            const bgRadius = 3;

            // Rounded rect background
            const bx = labelX - bgPad;
            const by = labelY - bgHeight / 2;
            const bw = displayWidth + bgPad * 2;
            const bh = bgHeight;
            ctx.beginPath();
            ctx.moveTo(bx + bgRadius, by);
            ctx.lineTo(bx + bw - bgRadius, by);
            ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + bgRadius);
            ctx.lineTo(bx + bw, by + bh - bgRadius);
            ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - bgRadius, by + bh);
            ctx.lineTo(bx + bgRadius, by + bh);
            ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - bgRadius);
            ctx.lineTo(bx, by + bgRadius);
            ctx.quadraticCurveTo(bx, by, bx + bgRadius, by);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Text (clipped to maxWidth)
            ctx.save();
            ctx.beginPath();
            ctx.rect(labelX - bgPad, by, displayWidth + bgPad * 2, bh);
            ctx.clip();
            ctx.fillStyle = "#222831";
            ctx.fillText(label, labelX, labelY);
            ctx.restore();
          });
        }
      }

      // Step 3: Draw page title on canvas (top left)
      ctx.font = "700 18px 'Open Sans', sans-serif";
      ctx.fillStyle = "#2E5A88";
      ctx.textBaseline = "top";
      ctx.fillText("New Zip Code Maps", 20, 14);

      let titleBottomY = 14 + 24; // baseline + line height

      // Methodology blurb (under the title) for metrics that have one
      const blurbText = METRIC_INFO_BLURBS[displayMetric];
      if (blurbText) {
        ctx.font = "400 11px 'Open Sans', sans-serif";
        ctx.fillStyle = "#444444";
        const blurbMaxWidth = 540;
        const blurbLines = wrapText(ctx, blurbText, blurbMaxWidth);
        let by = titleBottomY + 4;
        for (const line of blurbLines) {
          ctx.fillText(line, 20, by);
          by += 14;
        }
        titleBottomY = by;
      }

      // Step 3b: Draw Filters panel directly below the title/blurb
      // (top-left), so all chrome stays in the same corner.
      drawFiltersOnCanvas(ctx, container, titleBottomY + 8);

      // Step 4: Draw info box / distress table and legend directly on canvas (avoids dom-to-image border artifacts)
      drawInfoBoxOnCanvas(ctx, infoBoxData, container);
      if (distressTableZip) {
        const distressRecord = distressDataLookup[distressTableZip]
          ? { ...distressDataLookup[distressTableZip], rank: distressRankLookup[distressTableZip] ?? null }
          : null;
        const neighborhood = zipCodes?.find(z => z.zip_code === distressTableZip)?.neighborhood || "";
        drawDistressTableOnCanvas(ctx, distressRecord, distressTableZip, neighborhood, houstonMedians, container);
      }
      if (workingPoorTableZip) {
        const wpRecord = workingPoorDataLookup[workingPoorTableZip]
          ? { ...workingPoorDataLookup[workingPoorTableZip], working_poor_rank: workingPoorRankLookup[workingPoorTableZip] ?? null }
          : null;
        const neighborhood = zipCodes?.find(z => z.zip_code === workingPoorTableZip)?.neighborhood || "";
        drawWorkingPoorTableOnCanvas(ctx, wpRecord, workingPoorTableZip, neighborhood, workingPoorMedians, container);
      }
      if (evictionsTableZip) {
        const evRecord = evictionsDataLookup[evictionsTableZip];
        const neighborhood = zipCodes?.find(z => z.zip_code === evictionsTableZip)?.neighborhood || "";
        drawEvictionsTableOnCanvas(ctx, evRecord, evictionsTableZip, neighborhood, evictionsMedians, container);
      }
      // FVI info box (renders for whichever sub-mode is active — the data-attribute
      // selectors ensure only one draws at a time even though both branches run).
      if (fviTableZip) {
        const fviRecord = distressDataLookup[fviTableZip]
          ? { ...distressDataLookup[fviTableZip], fvi_rank: fviRankLookup[fviTableZip] ?? null }
          : null;
        const neighborhood = zipCodes?.find(z => z.zip_code === fviTableZip)?.neighborhood || "";
        drawFamilyVulnerabilityTableOnCanvas(ctx, fviRecord, fviTableZip, neighborhood, familyMedians, container);
        drawFamilyBivariateTableOnCanvas(ctx, distressDataLookup[fviTableZip], fviTableZip, neighborhood, container);
      }
      // Efficiency / distress×funding bivariate info boxes — same pattern as FVI:
      // call both, the data-attribute selector inside each makes it a no-op when
      // the corresponding screen component isn't mounted.
      if (efficiencyTableZip) {
        const neighborhood = zipCodes?.find(z => z.zip_code === efficiencyTableZip)?.neighborhood || "";
        drawEfficiencyTableOnCanvas(ctx, fundingDataLookup[efficiencyTableZip], efficiencyTableZip, neighborhood, container);
      }
      if (bivariateTableZip) {
        const neighborhood = zipCodes?.find(z => z.zip_code === bivariateTableZip)?.neighborhood || "";
        drawBivariateTableOnCanvas(ctx, fundingDataLookup[bivariateTableZip], bivariateTableZip, neighborhood, container);
      }

      if (isDensityMode && parentCoverage.servedZips.size > 0) {
        drawParentCoverageLegendOnCanvas(ctx, assistanceLabel, parentOrg, orgPins.length, county, container, displayMetric);
      } else if (hasAssistance) {
        drawSimpleLegendOnCanvas(ctx, assistanceLabel, orgPins.length, county, container, displayMetric);
      } else {
        drawBaseLegendOnCanvas(ctx, container, displayMetric);
      }

      // Step 5: Download
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      const assistLabel = assistanceLabel || "map";
      link.download = `CRG-ZipCodeMap-${assistLabel}-${dateStr}.png`;
      link.href = outputCanvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Map download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, assistanceLabel, hasAssistance, orgPins, selectedOrgKey, showOrgLabels, infoBoxData, isDensityMode, parentCoverage, parentOrg, organization, county, displayMetric, isBaseView, distressTableZip, distressDataLookup, distressRankLookup, houstonMedians, workingPoorTableZip, workingPoorDataLookup, workingPoorRankLookup, workingPoorMedians, evictionsTableZip, evictionsDataLookup, evictionsMedians, fviTableZip, fviRankLookup, familyMedians, efficiencyTableZip, bivariateTableZip, fundingDataLookup, zipCodes]);

  // Expose download + clearSelection to the parent. clearSelection drops the
  // cross-mode selected zip (used by Reset in the sidebar).
  const clearSelection = useCallback(() => {
    lastV2SelectedZipRef.current = null;
    setDistressTableZip(null);
    setWorkingPoorTableZip(null);
    setEvictionsTableZip(null);
    setFviTableZip(null);
    setFundingTableZip(null);
    setEfficiencyTableZip(null);
    setBivariateTableZip(null);
    setCoverageTableZip(null);
  }, []);

  useImperativeHandle(ref, () => ({
    download: handleDownload,
    clearSelection,
    isDownloading,
  }), [handleDownload, clearSelection, isDownloading]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <p className="text-red-500 font-semibold">
          Mapbox token not configured. Add VITE_MAPBOX_TOKEN to your .env file.
        </p>
      </div>
    );
  }

  return (
    <div ref={mapContainerRef} className="relative w-full h-full">
      <MapGL
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          ...HOUSTON_CENTER,
          zoom: DEFAULT_ZOOM,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        preserveDrawingBuffer={true}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onZoom={handleZoom}
      >
        <NavigationControl position="top-right" />

        {/* Zip code boundaries */}
        {geoJsonData && (
          <Source
            id="zip-boundaries"
            type="geojson"
            data={geoJsonData}
            generateId={false}
          >
            {/* Unified fill: base zip highlight > hover > metric colors */}
            <Layer {...unifiedFillStyle} />
            <Layer {...boundaryLineStyle} />
            {/* Teal border on parent-covered zips, magenta on selected child's zips */}
            {/* Always mounted; visibility toggled to avoid first-paint race when the layer
                is added in the same render as the geoJsonData density update */}
            <Layer
              {...orgCoverageBorderTealStyle}
              layout={{ visibility: !isBaseView && hasAssistance ? "visible" : "none" }}
            />
            {/* V2 Who overlay (pink for org, dark blue for parent). Rendered
                BELOW the magenta clicked-org border so that clicking a pin
                inside a Who-parent selection paints that org's served zips
                pink over the parent's dark-blue overlay. Always mounted; the
                per-feature paint expressions go transparent when no Who
                filter is active. */}
            <Layer {...whoOverlayStyle} />
            <Layer
              {...orgCoverageBorderMagentaStyle}
              layout={{
                visibility:
                  hasAssistance &&
                  (!isBaseView ||
                    displayMetric === "service_coverage" ||
                    isCoverageBivariate(displayMetric))
                    ? "visible"
                    : "none",
              }}
            />
            <Layer {...zipLabelStyle} />
          </Source>
        )}

        {/* Org coverage circles at zip centroids - temporarily disabled to test borders-only look */}
        {/* {centroidGeoJson && !isBaseView && hasAssistance && (
          <Source
            id="zip-centroids"
            type="geojson"
            data={centroidGeoJson}
            generateId={false}
          >
            <Layer {...orgCoverageCircleStyle} />
          </Source>
        )} */}

        {/* Organization pin markers - only in filter view when assistance is selected */}
        {!isBaseView && hasAssistance &&
          orgPins.map((org) => (
            <Marker
              key={org.key}
              longitude={org.lng}
              latitude={org.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handlePinClick(org);
              }}
              style={{ cursor: "pointer" }}
            >
              <div
                onMouseEnter={() => setHoveredOrg(org.key)}
                onMouseLeave={() => setHoveredOrg(null)}
                style={{
                  transform: selectedOrgKey === org.key ? "scale(1.05)" : "scale(1)",
                  transition: "transform 0.15s ease",
                  transformOrigin: "bottom center",
                  position: "relative",
                }}
              >
                <MapPinIcon
                  size={30}
                  active={selectedOrgKey === org.key}
                />
                {/* Hover tooltip */}
                {hoveredOrg === org.key && selectedOrgKey !== org.key && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      marginBottom: "4px",
                      backgroundColor: "rgba(34, 40, 49, 0.92)",
                      color: "#FFFFFF",
                      fontSize: "11px",
                      fontFamily: "'Open Sans', sans-serif",
                      fontWeight: 500,
                      padding: "4px 8px",
                      borderRadius: "4px",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      zIndex: 40,
                      maxWidth: "220px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {org.organization}
                  </div>
                )}
                {/* Persistent org label (zoom-gated, toggle-controlled) */}
                {showOrgLabels && (
                  <div
                    data-org-label="true"
                    style={{
                      position: "absolute",
                      top: "-2px",
                      left: "calc(100% + 4px)",
                      backgroundColor: "rgba(255, 255, 255, 0.88)",
                      color: "#222831",
                      fontSize: "10px",
                      fontFamily: "'Open Sans', sans-serif",
                      fontWeight: 500,
                      padding: "2px 5px",
                      borderRadius: "3px",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      zIndex: 30,
                      maxWidth: "180px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      border: "0.5px solid rgba(0,0,0,0.15)",
                      lineHeight: 1.3,
                    }}
                  >
                    {org.organization}
                  </div>
                )}
              </div>
            </Marker>
          ))}
      </MapGL>

      {/* In-canvas Base Map title + dropdown removed in v2 — controls live in
          ReportsSidebarV2. Distress vs. Funding + FVI sub-toggles removed
          along with those metrics. */}

      {/* Top-right control stack: Show Labels + Zip search */}
      <div
        className="absolute"
        style={{
          top: "10px",
          right: "52px",
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          alignItems: "flex-end",
        }}
      >
        {/* Org Labels toggle button - always visible */}
        <button
          data-org-label-btn="true"
          onClick={() => setShowOrgLabels((prev) => !prev)}
          className="transition-all duration-200 hover:brightness-125"
          style={{
            backgroundColor: showOrgLabels ? "#005C72" : "rgba(34, 40, 49, 0.85)",
            color: showOrgLabels ? "#FFC857" : "#FFFFFF",
            border: showOrgLabels ? "1px solid #005C72" : "1px solid rgba(255,255,255,0.2)",
            borderRadius: "6px",
            padding: "8px 14px",
            fontFamily: "'Open Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            backdropFilter: "blur(4px)",
            userSelect: "none",
          }}
        >
          {showOrgLabels ? "Hide Labels" : "Show Labels"}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleZipSearch(searchZipValue);
          }}
          style={{ display: "flex", gap: "0" }}
        >
          <input
            type="text"
            value={searchZipValue}
            onChange={(e) => setSearchZipValue(e.target.value)}
            placeholder="Zip code"
            style={{
              width: "90px",
              padding: "7px 10px",
              backgroundColor: "rgba(34, 40, 49, 0.85)",
              color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "6px 0 0 6px",
              fontFamily: "'Open Sans', sans-serif",
              fontSize: "13px",
              outline: "none",
              backdropFilter: "blur(4px)",
            }}
          />
          <button
            type="submit"
            className="transition-all duration-200 hover:brightness-125"
            style={{
              padding: "7px 10px",
              backgroundColor: "rgba(34, 40, 49, 0.85)",
              color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,0.2)",
              borderLeft: "none",
              borderRadius: "0 6px 6px 0",
              fontFamily: "'Open Sans', sans-serif",
              fontSize: "13px",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            Go
          </button>
        </form>
      </div>

      {/* Draggable info box - only in filter view */}
      {/* Draggable info box - only in filter view */}
      {!isBaseView && <DraggableInfoBox info={infoBoxData} onClose={handleInfoBoxClose} />}

      {/* Draggable distress data table - in distress base view or when activeBase is distress in filter view */}
      {(isBaseView
        ? (displayMetric === "distress" || displayMetric === "no_base_map")
        : (activeBase === "distress" || activeBase === "no_base_map")) && distressTableZip && distressDataLookup[distressTableZip] && (
        <DraggableDistressTable
          data={{ ...distressDataLookup[distressTableZip], rank: distressRankLookup[distressTableZip] ?? null }}
          zipCode={distressTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === distressTableZip)?.neighborhood || ""}
          houstonMedians={houstonMedians}
          rankedCount={distressRankedCount}
          onClose={() => setDistressTableZip(null)}
        />
      )}

      {/* Draggable working poor data table - in working poor base view or when activeBase is working_poor in filter view */}
      {(isBaseView ? displayMetric === "working_poor" : activeBase === "working_poor") && workingPoorTableZip && workingPoorDataLookup[workingPoorTableZip] && (
        <DraggableWorkingPoorTable
          data={{ ...workingPoorDataLookup[workingPoorTableZip], working_poor_rank: workingPoorRankLookup[workingPoorTableZip] ?? null }}
          zipCode={workingPoorTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === workingPoorTableZip)?.neighborhood || ""}
          houstonMedians={workingPoorMedians}
          rankedCount={workingPoorRankedCount}
          onClose={() => setWorkingPoorTableZip(null)}
        />
      )}

      {/* Draggable evictions data table - in evictions base view or when activeBase is evictions in filter view */}
      {(isBaseView ? displayMetric === "evictions" : activeBase === "evictions") && evictionsTableZip && evictionsDataLookup[evictionsTableZip] && (
        <DraggableEvictionsTable
          data={{ ...evictionsDataLookup[evictionsTableZip], rank: evictionsRankLookup[evictionsTableZip] ?? null }}
          zipCode={evictionsTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === evictionsTableZip)?.neighborhood || ""}
          houstonMedians={evictionsMedians}
          rankedCount={evictionsRankedCount}
          onClose={() => setEvictionsTableZip(null)}
        />
      )}

      {/* Draggable FVI info box — index sub-mode shows the full FVI_FIELDS table
          with Greater Houston medians; bivariate sub-mode shows the cell label
          + code + colored swatch (mirrors distress × funding bivariate pattern). */}
      {(isBaseView
        ? displayMetric === "family_vulnerability"
        : activeBase === "family_vulnerability" && familySubMode === "index") && fviTableZip && (
        <DraggableFamilyVulnerabilityTable
          data={{
            ...(distressDataLookup[fviTableZip] || {}),
            fvi_rank: fviRankLookup[fviTableZip],
          }}
          zipCode={fviTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === fviTableZip)?.neighborhood || ""}
          familyMedians={familyMedians}
          rankedCount={fviRankedCount}
          onClose={() => setFviTableZip(null)}
        />
      )}

      {(isBaseView
        ? displayMetric === "family_bivariate"
        : activeBase === "family_vulnerability" && familySubMode === "bivariate") && fviTableZip && (
        <DraggableFamilyBivariateTable
          data={distressDataLookup[fviTableZip]}
          zipCode={fviTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === fviTableZip)?.neighborhood || ""}
          onClose={() => setFviTableZip(null)}
        />
      )}

      {/* Draggable funding info box - in funding_level base view or when activeBase is funding_level in filter view */}
      {(isBaseView ? displayMetric === "funding_level" : activeBase === "funding_level") && fundingTableZip && (
        <DraggableFundingTable
          data={fundingDataLookup[fundingTableZip]}
          zipCode={fundingTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === fundingTableZip)?.neighborhood || ""}
          onClose={() => setFundingTableZip(null)}
        />
      )}

      {/* Draggable efficiency info box - in efficiency_ratio base view or when activeBase is efficiency_ratio in filter view */}
      {/* Draggable efficiency info box */}
      {(isBaseView ? displayMetric === "efficiency_ratio" : activeBase === "efficiency_ratio") && efficiencyTableZip && (
        <DraggableEfficiencyTable
          data={fundingDataLookup[efficiencyTableZip]}
          zipCode={efficiencyTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === efficiencyTableZip)?.neighborhood || ""}
          onClose={() => setEfficiencyTableZip(null)}
        />
      )}

      {/* Draggable bivariate info box */}
      {(isBaseView ? displayMetric === "bivariate" : (activeBase === "efficiency_ratio" && efficiencySubMode === "bivariate")) && bivariateTableZip && (
        <DraggableBivariateTable
          data={fundingDataLookup[bivariateTableZip]}
          zipCode={bivariateTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === bivariateTableZip)?.neighborhood || ""}
          onClose={() => setBivariateTableZip(null)}
        />
      )}

      {/* V2: Coverage / Compare / Sites info box. Same component, different
          org list per mode. Sites lists orgs LOCATED in the zip (matches
          visible pinheads); Coverage/Compare list orgs that SERVE the zip. */}
      {coverageTableZip && (
        displayMetric === "service_coverage" ||
        isCoverageBivariate(displayMetric) ||
        displayMetric === "no_base_map"
      ) && (
        <DraggableCoverageInfoBox
          zipCode={coverageTableZip}
          county={zipCodes?.find(z => z.zip_code === coverageTableZip)?.county || ""}
          selectedCounty={county}
          distressInfo={distressDataLookup[coverageTableZip]}
          orgs={displayMetric === "no_base_map" ? sitesTableOrgs : coverageTableOrgs}
          assistanceLabel={assistanceType}
          showDistress={isCoverageBivariate(displayMetric)}
          conditionLabel={displayMetric === "evictions_coverage_bivariate" ? "Evictions" : "Distress"}
          bivariateCode={isCoverageBivariate(displayMetric) ? coverageBivariateCodeLookup[coverageTableZip] : null}
          siteMode={displayMetric === "no_base_map"}
          selectedOrgId={displayMetric === "no_base_map" ? null : coverageInfoBoxOrgKey}
          onOrgClick={displayMetric === "no_base_map" ? null : handleCoverageOrgClick}
          onClose={() => setCoverageTableZip(null)}
        />
      )}

      {/* Base view: always show clean metric legend */}
      {isBaseView && <BaseLegend viewMode={displayMetric} />}

      {/* Filter view: show appropriate filter legend */}
      {!isBaseView && isDensityMode && parentCoverage.servedZips.size > 0 && (
        <ParentCoverageLegend
          parentOrgName={parentOrg}
          assistanceLabel={assistanceLabel}
          orgCount={orgPins.length}
          county={county}
          outOfAreaOrgs={outOfAreaOrgs}
          onOutOfAreaToggle={handleOutOfAreaToggle}
          viewMode={displayMetric}
        />
      )}

      {/* Filter view: simple legend (assistance selected, no parent) */}
      {!isBaseView && hasAssistance && !isDensityMode && (
        <SimpleLegend
          assistanceLabel={assistanceLabel}
          orgCount={orgPins.length}
          county={county}
          outOfAreaOrgs={outOfAreaOrgs}
          onOutOfAreaToggle={handleOutOfAreaToggle}
          viewMode={displayMetric}
        />
      )}

      {/* Filter view: base legend when no assistance selected */}
      {!isBaseView && !hasAssistance && <BaseLegend viewMode={displayMetric} />}
    </div>
  );
});

export default MapboxMapV2;
