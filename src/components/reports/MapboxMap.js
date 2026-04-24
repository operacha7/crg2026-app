// src/components/reports/MapboxMap.js
// Interactive Mapbox map with three interaction modes:
// 1. No assistance selected → empty map with zip boundaries only
// 2. Assistance selected (no parent) → pins + click for teal zip highlights
// 3. Assistance + parent selected → purple density choropleth + pins + teal overlay on click
// Filters: assistance type, county, parent org, organization (status frozen to Active)

import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import MapGL, { Source, Layer, Marker, NavigationControl } from "react-map-gl/mapbox";
import { useAppData } from "../../Contexts/AppDataContext";
import { MapPinIcon } from "../../icons/MapPinIcon";
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

// Population colors - 5 quintile bands (purple gradient, light to dark)
const POP_BAND_1 = "rgba(200, 170, 230, 0.30)";   // q1: 0-20 (light lavender)
const POP_BAND_2 = "rgba(175, 130, 215, 0.33)";   // q2: 20-40 (medium lavender)
const POP_BAND_3 = "rgba(150, 85, 195, 0.38)";    // q3: 40-60 (medium purple)
const POP_BAND_4 = "rgba(110, 40, 160, 0.45)";    // q4: 60-80 (dark purple)
const POP_BAND_5 = "rgba(75, 0, 130, 0.55)";      // q5: 80-100 (deep indigo)

// Unified fill layer - one color per zip at any given time
// Priority: childHighlighted (teal) > base highlight > hover > [parent coverage in filter view] > metric colors
// Uses feature-state for interactive states, GeoJSON property "density" for parent coverage
function getUnifiedFillStyle(metric = "distress", showParentCoverage = true, thresholds = {}, showInteractiveHighlights = true) {
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
    // 5 quintile bands based on evictions_score (0-100 scale, -1 = no data)
    metricExpression = [
      [">=", ["coalesce", ["get", "evictions_score"], -1], 80], EV_BAND_5,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 60], EV_BAND_4,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 40], EV_BAND_3,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 20], EV_BAND_2,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 0],  EV_BAND_1,
    ];
  } else if (metric === "population") {
    // 5 quintile bands based on population_score (0-100 scale, -1 = no data)
    metricExpression = [
      [">=", ["coalesce", ["get", "population_score"], -1], 80], POP_BAND_5,
      [">=", ["coalesce", ["get", "population_score"], -1], 60], POP_BAND_4,
      [">=", ["coalesce", ["get", "population_score"], -1], 40], POP_BAND_3,
      [">=", ["coalesce", ["get", "population_score"], -1], 20], POP_BAND_2,
      [">=", ["coalesce", ["get", "population_score"], -1], 0],  POP_BAND_1,
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
    // 5 quintile bands based on efficiency_ratio score (0-100 scale, same colors as distress)
    metricExpression = [
      [">=", ["coalesce", ["get", "efficiency_score"], -1], 80], DISTRESS_RED,
      [">=", ["coalesce", ["get", "efficiency_score"], -1], 60], DISTRESS_ORANGE,
      [">=", ["coalesce", ["get", "efficiency_score"], -1], 40], DISTRESS_YELLOW,
      [">=", ["coalesce", ["get", "efficiency_score"], -1], 20], DISTRESS_GREEN,
      [">",  ["coalesce", ["get", "efficiency_score"], -1], 0],  DISTRESS_BLUE,
    ];
  } else if (metric === "bivariate") {
    // 3x3 bivariate choropleth using bivariate_map_code (text: "11"-"33")
    metricExpression = [
      ["==", ["get", "bivariate_code"], "31"], "rgba(200, 90, 90, 0.65)",    // high distress, low funding (dark red)
      ["==", ["get", "bivariate_code"], "32"], "rgba(184, 112, 112, 0.65)", // high distress, mid funding (mid red)
      ["==", ["get", "bivariate_code"], "33"], "rgba(153, 153, 153, 0.60)", // high distress, high funding (dark gray)
      ["==", ["get", "bivariate_code"], "21"], "rgba(221, 170, 170, 0.65)", // mid distress, low funding (light red)
      ["==", ["get", "bivariate_code"], "22"], "rgba(187, 187, 187, 0.55)", // mid distress, mid funding (mid gray)
      ["==", ["get", "bivariate_code"], "23"], "rgba(123, 174, 191, 0.65)", // mid distress, high funding (light blue)
      ["==", ["get", "bivariate_code"], "11"], "rgba(232, 232, 232, 0.45)", // low distress, low funding (lightest gray)
      ["==", ["get", "bivariate_code"], "12"], "rgba(168, 204, 216, 0.55)", // low distress, mid funding (light blue)
      ["==", ["get", "bivariate_code"], "13"], "rgba(100, 172, 190, 0.65)", // low distress, high funding (dark blue)
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
        fontFamily: "Lexend, sans-serif",
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
            fontSize: "12px",
            color: "#00A8A8",
            fontWeight: 500,
            borderTop: "1px solid rgba(255,255,255,0.15)",
            paddingTop: "8px",
          }}
        >
          Serves {info.zipCount} zip code{info.zipCount !== 1 ? "s" : ""}
          <span style={{ color: "#888", fontWeight: 400 }}>
            {" "}(highlighted on map)
          </span>
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
// showMedian: true = show Houston metro median in comparison column
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
  { key: "poverty_rate", label: "Poverty Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "median_household_income", label: "Median Household Income", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
  { key: "income_ratio", label: "Income Ratio", format: fmtRatio, showMedian: true, medianFormat: fmtRatio },
  { key: "unemployment_rate", label: "Unemployment Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_health_insurance", label: "No Health Insurance", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "snap", label: "SNAP Recipients", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_hs_diploma", label: "No HS Diploma", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "vacancy_rate", label: "Vacancy Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "owner_occupancy", label: "Owner Occupancy", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_vehicle", label: "No Vehicle", format: fmtPct, showMedian: true, medianFormat: fmtPct },
];

// Compute Houston metro medians from zip_code_data
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
// showMedian: true = show Houston metro median in comparison column
const WORKING_POOR_FIELDS = [
  { key: "working_poor_score", label: "Working Poor Score", format: fmtScore, highlight: true, showMedian: true, medianFormat: fmtScore },
  { key: "working_poor_rank", label: "Rank", format: (v, total) => v != null ? `${v} of ${total}` : "—", isRank: true },
  { key: "population", label: "Population", format: fmtPop, showMedian: true, medianFormat: fmtPop },
  { key: "poverty_rate", label: "Poverty Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "unemployment_rate", label: "Unemployment Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_health_insurance", label: "No Health Insurance", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "snap", label: "SNAP Recipients", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_hs_diploma", label: "No HS Diploma", format: fmtPct, showMedian: true, medianFormat: fmtPct },
];

// Compute Houston metro medians from zip_code_data
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
// showMedian: true = show Houston metro median in comparison column
const EVICTIONS_FIELDS = [
  { key: "evictions_score", label: "Evictions Score", format: fmtScore, highlight: true, showMedian: true, medianFormat: fmtScore },
  { key: "rank", label: "Rank", format: (v, total) => v != null ? `${v} of ${total}` : "—", isRank: true },
  { key: "claim_amount", label: "Total Claims", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
  { key: "filings_count", label: "Filings Count", format: (v) => v != null ? Math.round(Number(v)).toLocaleString() : "—", showMedian: true, medianFormat: (v) => Math.round(Number(v)).toLocaleString() },
  { key: "amount_per_filing", label: "Amount per Filing", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
];

// Compute Houston metro medians from zip_code_data
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
        fontFamily: "Lexend, sans-serif",
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
            Not scored or ranked. Excluded from Houston metro statistics.
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
          * Houston metro area median
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
        fontFamily: "Lexend, sans-serif",
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
            Not scored or ranked. Excluded from Houston metro statistics.
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
          * Houston metro area median
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
        fontFamily: "Lexend, sans-serif",
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
            Not scored or ranked. Excluded from Houston metro statistics.
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
          * Houston metro area median
        </span>
      </div>
    </div>
  );
}

// Simple draggable population info box - shows just population for the clicked zip
function DraggablePopulationTable({ population, zipCode, neighborhood, county, onClose, hasKeyData = true }) {
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

  if (!zipCode) return null;

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "280px",
        backgroundColor: hasKeyData ? "rgba(34, 40, 49, 0.95)" : "rgba(105, 105, 118, 0.95)",
        fontFamily: "Lexend, sans-serif",
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
          {county && (
            <p style={{ fontSize: "11px", color: "#CCCCCC", margin: "2px 0 0", lineHeight: 1.3 }}>
              {county} County
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

      {/* Banner when population data is unavailable */}
      {!hasKeyData && (
        <div style={{
          padding: "6px 14px",
          backgroundColor: "rgba(255, 179, 2, 0.15)",
          borderBottom: "1px solid rgba(255, 179, 2, 0.25)",
        }}>
          <span style={{ fontSize: "10px", color: "#FFB302", fontWeight: 500 }}>
            Population data not available for this zip code.
          </span>
        </div>
      )}

      {/* Population value */}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Population</span>
          <span style={{ fontSize: "16px", color: "#FFFFFF", fontWeight: 600 }}>
            {population != null ? population.toLocaleString() : "—"}
          </span>
        </div>
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
        fontFamily: "Lexend, sans-serif",
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

  const rawRatio = data.raw_efficiency_ratio != null ? Number(data.raw_efficiency_ratio).toFixed(2) : "—";
  const distressScore = data.distress_score != null ? Number(data.distress_score).toFixed(1) : "—";
  const fundingAmount = data.zip_fin_funding != null ? `$${Math.round(Number(data.zip_fin_funding)).toLocaleString()}` : "—";

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "300px",
        backgroundColor: "rgba(34, 40, 49, 0.95)",
        fontFamily: "Lexend, sans-serif",
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

      {/* Efficiency ratio + explanation + distress + funding */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#CCC", fontWeight: 500 }}>Efficiency Ratio</span>
          <span style={{ fontSize: "16px", color: "#FFFFFF", fontWeight: 600 }}>
            {rawRatio}
          </span>
        </div>
        <p style={{ fontSize: "10px", color: "#999", margin: "-4px 0 2px", lineHeight: 1.4, fontStyle: "italic" }}>
          This is the amount of distress per available $1 of funding in this zip code.
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
  "31": "Critical Priority - High Need / Low Funds",
  "32": "High Priority",
  "33": "High Need / High Funds",
  "21": "Moderate Gap",
  "22": "Balanced Need & Funds",
  "23": "Moderate Surplus",
  "11": "Low Priority (Baseline)",
  "12": "Low Need / Medium Funds",
  "13": "High Surplus - Low Need / High Funds",
};

const BIVARIATE_COLORS = {
  "31": "#C85A5A", "32": "#B87070", "33": "#999999",
  "21": "#DDAAAA", "22": "#BBBBBB", "23": "#7BAEBF",
  "11": "#E8E8E8", "12": "#A8CCD8", "13": "#64ACBE",
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
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        right: "60px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "300px",
        backgroundColor: "rgba(34, 40, 49, 0.95)",
        fontFamily: "Lexend, sans-serif",
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
        fontFamily: "Lexend, sans-serif",
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
    </div>
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
function PopulationLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Population Score
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 1, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(200, 170, 230, 0.45)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(175, 130, 215, 0.45)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(150, 85, 195, 0.48)" }} />
        <div style={{ flex: 1, height: "10px", backgroundColor: "rgba(110, 40, 160, 0.52)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(75, 0, 130, 0.55)" }} />
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

// Evictions legend bar - same quintile colors as distress
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
        Efficiency Ratio Score
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
  const colors = [
    ["#E8E8E8", "#A8CCD8", "#64ACBE"], // row 1 (low distress): low→high funding
    ["#DDAAAA", "#BBBBBB", "#7BAEBF"], // row 2 (mid distress)
    ["#C85A5A", "#B87070", "#999999"], // row 3 (high distress)
  ];
  // Codes grid matching display order (reversed: high distress at top)
  const codes = [
    ["31", "32", "33"], // high distress
    ["21", "22", "23"], // mid distress
    ["11", "12", "13"], // low distress
  ];
  // Use white text on dark cells, dark text on light cells
  const darkCells = new Set(["31", "32", "33", "13", "23"]);
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
            Funding →
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric legend bar switcher - renders the correct legend bar based on viewMode
function MetricLegendBar({ viewMode, standalone }) {
  if (viewMode === "working_poor") return <WorkingPoorLegendBar standalone={standalone} />;
  if (viewMode === "evictions") return <EvictionsLegendBar standalone={standalone} />;
  if (viewMode === "population") return <PopulationLegendBar standalone={standalone} />;
  if (viewMode === "funding_level") return <FundingLegendBar standalone={standalone} />;
  if (viewMode === "efficiency_ratio") return <EfficiencyLegendBar standalone={standalone} />;
  if (viewMode === "bivariate") return <BivariateLegend standalone={standalone} />;
  return <DistressLegendBar standalone={standalone} />;
}

// Base legend - always visible, shows distress colors from the start
function BaseLegend({ viewMode }) {
  return (
    <div
      data-legend="true"
      className="absolute bottom-6 left-4 rounded-lg shadow-lg"
      style={{
        backgroundColor: "rgba(255,255,255,0.95)",
        padding: "12px 16px",
        fontFamily: "Lexend, sans-serif",
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
        fontFamily: "Lexend, sans-serif",
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
            backgroundColor: "#00A8A8",
            opacity: 0.5,
            marginLeft: "2px",
          }}
        />
        <span style={{ color: "#444" }}>Zip codes served (on click)</span>
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
  { value: "population", label: "Population" },
  { value: "funding_level", label: "Funding Level" },
  { value: "efficiency_ratio", label: "Distress vs. Funding" },
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

const MapboxMap = forwardRef(function MapboxMap({
  county,
  zipCode,
  parentOrg,
  organization,
  assistanceType,
  viewMode = "filter_view",
  activeBase = "distress",
  onViewModeChange,
}, ref) {
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

  // Distress data table state (base view zip click)
  const [distressTableZip, setDistressTableZip] = useState(null);
  const distressSelectedRef = useRef(null); // feature id of currently highlighted zip

  // Working poor data table state (base view zip click)
  const [workingPoorTableZip, setWorkingPoorTableZip] = useState(null);
  const workingPoorSelectedRef = useRef(null); // feature id of currently highlighted zip

  // Evictions data table state (base view zip click)
  const [evictionsTableZip, setEvictionsTableZip] = useState(null);
  const evictionsSelectedRef = useRef(null); // feature id of currently highlighted zip
  const [populationTableZip, setPopulationTableZip] = useState(null);
  const populationSelectedRef = useRef(null);
  const [fundingTableZip, setFundingTableZip] = useState(null);
  const fundingSelectedRef = useRef(null);
  const [efficiencyTableZip, setEfficiencyTableZip] = useState(null);
  const efficiencySelectedRef = useRef(null);
  const [bivariateTableZip, setBivariateTableZip] = useState(null);
  const bivariateSelectedRef = useRef(null);
  const [efficiencySubMode, setEfficiencySubMode] = useState("efficiency"); // "efficiency" or "bivariate"

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

  // Population score lookup: zip_code -> population_score (0-100)
  const populationScoreLookup = useMemo(() => {
    const lookup = {};
    if (!zipCodeData) return lookup;
    zipCodeData.forEach((d) => {
      if (d.zip_code && d.population_score != null) {
        lookup[d.zip_code] = Number(d.population_score) ?? -1;
      }
    });
    return lookup;
  }, [zipCodeData]);

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

  // Houston metro medians (rows where distress_score is populated)
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

  // Is the map in base view (clean metric) vs filter view (overlay + metric)?
  const isBaseView = viewMode !== "filter_view";

  // Which metric to display: in base view use viewMode, in filter view use activeBase
  // When efficiency_ratio is active and toggle is set to bivariate, use "bivariate" metric
  const rawDisplayMetric = isBaseView ? viewMode : activeBase;
  const displayMetric = (rawDisplayMetric === "efficiency_ratio" && efficiencySubMode === "bivariate") ? "bivariate" : rawDisplayMetric;

  // Memoized unified fill style - recomputed when viewMode or activeBase change
  const unifiedFillStyle = useMemo(() => {
    return getUnifiedFillStyle(displayMetric, !isBaseView, {}, !isBaseView);
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

  // Zip codes to draw on the map (boundaries) - based on county filter
  const boundaryZips = useMemo(() => {
    if (!county || county === "All Counties" || !zipCodes) return houstonZips;
    return new Set(
      zipCodes
        .filter((z) => z.houston_area === "Y" && z.county === county)
        .map((z) => z.zip_code)
    );
  }, [county, zipCodes, houstonZips]);

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
      filtered = filtered.filter((r) => r.org_parent === parentOrg);
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
            population_score: populationScoreLookup[f.properties.ZCTA5CE20] ?? -1,
            evictions_score: evictionsLookup[f.properties.ZCTA5CE20] ?? -1,
            funding_score: fundingScoreLookup[f.properties.ZCTA5CE20] ?? -1,
            efficiency_score: efficiencyScoreLookup[f.properties.ZCTA5CE20] ?? -1,
            bivariate_code: bivariateCodeLookup[f.properties.ZCTA5CE20] || "",
          },
        })),
    };
    return filtered;
  }, [allGeoJsonData, boundaryZips, parentCoverage, distressLookup, workingPoorLookup, populationLookup, populationScoreLookup, evictionsLookup, fundingScoreLookup, efficiencyScoreLookup, bivariateCodeLookup]);

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
      });

      setSelectedOrgKey(org.key);
      highlightChildZips(clientZips);
    },
    [highlightChildZips, boundaryZips, selectedOrgKey, clearChildHighlights, zipCode, setBaseHighlight]
  );

  // Handle clicking map area
  const handleMapClick = useCallback((e) => {
    // In distress base view, clicking a zip boundary opens/toggles the distress data table
    if (isBaseView && displayMetric === "distress") {
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

    // In population base view, clicking a zip boundary opens/toggles the
    // population info box. Allow any zip in zipCodeData — when population is
    // null the info box shows a banner and an em-dash value.
    if (isBaseView && displayMetric === "population") {
      const map = mapRef.current?.getMap();
      if (map && map.getLayer("unified-fill")) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["unified-fill"],
        });
        if (features.length > 0) {
          const clickedZip = features[0].properties.ZCTA5CE20;
          if (clickedZip && distressDataLookup[clickedZip]) {
            setPopulationTableZip(prev => prev === clickedZip ? null : clickedZip);
            return;
          }
        }
      }
      setPopulationTableZip(null);
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

        if (activeBase === "efficiency_ratio" && efficiencySubMode === "bivariate" && clickedZip && fundingDataLookup[clickedZip]) {
          setBivariateTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setWorkingPoorTableZip(null); setEvictionsTableZip(null); setPopulationTableZip(null); setFundingTableZip(null); setEfficiencyTableZip(null);
          return;
        } else if (activeBase === "efficiency_ratio" && clickedZip && fundingDataLookup[clickedZip]) {
          setEfficiencyTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setWorkingPoorTableZip(null); setEvictionsTableZip(null); setPopulationTableZip(null); setFundingTableZip(null); setBivariateTableZip(null);
          return;
        } else if (activeBase === "funding_level" && clickedZip && fundingDataLookup[clickedZip]) {
          setFundingTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setWorkingPoorTableZip(null); setEvictionsTableZip(null); setPopulationTableZip(null);
          return;
        } else if (activeBase === "population" && clickedZip && distressDataLookup[clickedZip]) {
          setPopulationTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setWorkingPoorTableZip(null); setEvictionsTableZip(null); setFundingTableZip(null);
          return;
        } else if (activeBase === "evictions" && clickedZip && evictionsDataLookup[clickedZip]) {
          setEvictionsTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setWorkingPoorTableZip(null); setPopulationTableZip(null); setFundingTableZip(null);
          return;
        } else if (activeBase === "working_poor" && clickedZip && workingPoorDataLookup[clickedZip]) {
          setWorkingPoorTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null); setEvictionsTableZip(null); setPopulationTableZip(null); setFundingTableZip(null);
          return;
        } else if (clickedZip && distressDataLookup[clickedZip]) {
          setDistressTableZip(prev => prev === clickedZip ? null : clickedZip);
          setWorkingPoorTableZip(null); setEvictionsTableZip(null); setPopulationTableZip(null); setFundingTableZip(null);
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
    setPopulationTableZip(null);
    setFundingTableZip(null);
    setEfficiencyTableZip(null);
    setBivariateTableZip(null);
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
    setPopulationTableZip(null);
    setFundingTableZip(null);
    setEfficiencyTableZip(null);
    setBivariateTableZip(null);

    if (isBaseView) {
      if (displayMetric === "distress" && distressDataLookup[zip]) {
        setDistressTableZip(zip);
      } else if (displayMetric === "working_poor" && workingPoorDataLookup[zip]) {
        setWorkingPoorTableZip(zip);
      } else if (displayMetric === "evictions" && evictionsDataLookup[zip]) {
        setEvictionsTableZip(zip);
      } else if (displayMetric === "population" && distressDataLookup[zip]) {
        setPopulationTableZip(zip);
      } else if (displayMetric === "funding_level" && fundingDataLookup[zip]) {
        setFundingTableZip(zip);
      } else if (displayMetric === "efficiency_ratio" && fundingDataLookup[zip]) {
        setEfficiencyTableZip(zip);
      } else if (displayMetric === "bivariate" && fundingDataLookup[zip]) {
        setBivariateTableZip(zip);
      }
    } else {
      // Filter view — use activeBase
      if (activeBase === "efficiency_ratio" && fundingDataLookup[zip]) {
        setEfficiencyTableZip(zip);
      } else if (activeBase === "funding_level" && fundingDataLookup[zip]) {
        setFundingTableZip(zip);
      } else if (activeBase === "population" && distressDataLookup[zip]) {
        setPopulationTableZip(zip);
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

  // Close all data tables on any view mode change
  useEffect(() => {
    setDistressTableZip(null);
    setWorkingPoorTableZip(null);
    setEvictionsTableZip(null);
    setPopulationTableZip(null);
    setFundingTableZip(null);
    setEfficiencyTableZip(null);
    setBivariateTableZip(null);
  }, [viewMode]);

  // Close efficiency/bivariate tables when toggling sub-mode
  useEffect(() => {
    setEfficiencyTableZip(null);
    setBivariateTableZip(null);
  }, [efficiencySubMode]);

  // Sync distress-selected visual highlight with distressTableZip
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;

    // Clear previous selection
    if (distressSelectedRef.current !== null) {
      map.setFeatureState(
        { source: "zip-boundaries", id: distressSelectedRef.current },
        { distressSelected: false }
      );
      distressSelectedRef.current = null;
    }

    // Set new selection
    if (distressTableZip) {
      const featureId = zipToFeatureId[distressTableZip];
      if (featureId !== undefined) {
        map.setFeatureState(
          { source: "zip-boundaries", id: featureId },
          { distressSelected: true }
        );
        distressSelectedRef.current = featureId;
      }
    }
  }, [distressTableZip, zipToFeatureId]);

  // Close working poor data table on any view mode change
  useEffect(() => {
    setWorkingPoorTableZip(null);
  }, [viewMode]);

  // Sync working-poor-selected visual highlight with workingPoorTableZip
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;

    // Clear previous selection
    if (workingPoorSelectedRef.current !== null) {
      map.setFeatureState(
        { source: "zip-boundaries", id: workingPoorSelectedRef.current },
        { distressSelected: false }
      );
      workingPoorSelectedRef.current = null;
    }

    // Set new selection
    if (workingPoorTableZip) {
      const featureId = zipToFeatureId[workingPoorTableZip];
      if (featureId !== undefined) {
        map.setFeatureState(
          { source: "zip-boundaries", id: featureId },
          { distressSelected: true }
        );
        workingPoorSelectedRef.current = featureId;
      }
    }
  }, [workingPoorTableZip, zipToFeatureId]);

  // Close evictions data table on any view mode change
  useEffect(() => {
    setEvictionsTableZip(null);
  }, [viewMode]);

  // Sync evictions-selected visual highlight with evictionsTableZip
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;

    // Clear previous selection
    if (evictionsSelectedRef.current !== null) {
      map.setFeatureState(
        { source: "zip-boundaries", id: evictionsSelectedRef.current },
        { distressSelected: false }
      );
      evictionsSelectedRef.current = null;
    }

    // Set new selection
    if (evictionsTableZip) {
      const featureId = zipToFeatureId[evictionsTableZip];
      if (featureId !== undefined) {
        map.setFeatureState(
          { source: "zip-boundaries", id: featureId },
          { distressSelected: true }
        );
        evictionsSelectedRef.current = featureId;
      }
    }
  }, [evictionsTableZip, zipToFeatureId]);

  // Sync population-selected visual highlight with populationTableZip
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;

    if (populationSelectedRef.current !== null) {
      map.setFeatureState(
        { source: "zip-boundaries", id: populationSelectedRef.current },
        { distressSelected: false }
      );
      populationSelectedRef.current = null;
    }

    if (populationTableZip) {
      const featureId = zipToFeatureId[populationTableZip];
      if (featureId !== undefined) {
        map.setFeatureState(
          { source: "zip-boundaries", id: featureId },
          { distressSelected: true }
        );
        populationSelectedRef.current = featureId;
      }
    }
  }, [populationTableZip, zipToFeatureId]);

  // Sync funding-selected visual highlight with fundingTableZip
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;

    if (fundingSelectedRef.current !== null) {
      map.setFeatureState(
        { source: "zip-boundaries", id: fundingSelectedRef.current },
        { distressSelected: false }
      );
      fundingSelectedRef.current = null;
    }

    if (fundingTableZip) {
      const featureId = zipToFeatureId[fundingTableZip];
      if (featureId !== undefined) {
        map.setFeatureState(
          { source: "zip-boundaries", id: featureId },
          { distressSelected: true }
        );
        fundingSelectedRef.current = featureId;
      }
    }
  }, [fundingTableZip, zipToFeatureId]);

  // Sync efficiency-selected visual highlight with efficiencyTableZip
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;

    if (efficiencySelectedRef.current !== null) {
      map.setFeatureState(
        { source: "zip-boundaries", id: efficiencySelectedRef.current },
        { distressSelected: false }
      );
      efficiencySelectedRef.current = null;
    }

    if (efficiencyTableZip) {
      const featureId = zipToFeatureId[efficiencyTableZip];
      if (featureId !== undefined) {
        map.setFeatureState(
          { source: "zip-boundaries", id: featureId },
          { distressSelected: true }
        );
        efficiencySelectedRef.current = featureId;
      }
    }
  }, [efficiencyTableZip, zipToFeatureId]);

  // Sync bivariate-selected visual highlight with bivariateTableZip
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;

    if (bivariateSelectedRef.current !== null) {
      map.setFeatureState(
        { source: "zip-boundaries", id: bivariateSelectedRef.current },
        { distressSelected: false }
      );
      bivariateSelectedRef.current = null;
    }

    if (bivariateTableZip) {
      const featureId = zipToFeatureId[bivariateTableZip];
      if (featureId !== undefined) {
        map.setFeatureState(
          { source: "zip-boundaries", id: featureId },
          { distressSelected: true }
        );
        bivariateSelectedRef.current = featureId;
      }
    }
  }, [bivariateTableZip, zipToFeatureId]);

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
        });
      }
    }
  }, [isBaseView, selectedOrgKey, orgPins, boundaryZips]);

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
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [organization, orgPins, highlightChildZips, boundaryZips]);

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

    ctx.font = "600 14px Lexend, sans-serif";
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
      ctx.font = "400 11px Lexend, sans-serif";
      ctx.fillStyle = "#AAAAAA";
      ctx.fillText(truncateText(ctx, info.orgParent, w - pad * 2), x + pad, cy);
      cy += 16;
    }

    // Assistance type
    ctx.font = "500 12px Lexend, sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(info.assistance, x + pad, cy);
    cy += 16;

    // Phone
    if (info.telephone) {
      ctx.font = "600 13px Lexend, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(info.telephone, x + pad, cy);
      cy += 16;
    }

    // Address
    ctx.font = "400 11px Lexend, sans-serif";
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
    ctx.font = "500 12px Lexend, sans-serif";
    ctx.fillStyle = "#00A8A8";
    const zipText = `Serves ${info.zipCount} zip code${info.zipCount !== 1 ? "s" : ""}`;
    ctx.fillText(zipText, x + pad, cy);
    const tw = ctx.measureText(zipText).width;
    ctx.font = "400 12px Lexend, sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText(" (highlighted on map)", x + pad + tw, cy);
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
    ctx.font = "600 15px Lexend, sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    // County (if present)
    if (data.county) {
      ctx.font = "400 11px Lexend, sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(`${data.county} County`, x + pad, cy);
      cy += 14;
    }

    // Neighborhood (if present)
    if (neighborhood) {
      ctx.font = "400 10px Lexend, sans-serif";
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
      ctx.font = "500 10px Lexend, sans-serif";
      ctx.fillStyle = "#FFB302";
      ctx.fillText("Distress score not available — data shown for reference only", x + pad, cy);
      cy += 13;
      ctx.font = "italic 9px Lexend, sans-serif";
      ctx.fillStyle = "#999999";
      ctx.fillText("Not scored or ranked. Excluded from Houston metro statistics.", x + pad, cy);
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

    ctx.font = "600 9px Lexend, sans-serif";
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
      ctx.font = highlight ? "600 12px Lexend, sans-serif" : "400 11px Lexend, sans-serif";
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
      ctx.font = highlight ? "700 14px Lexend, sans-serif" : "500 12px Lexend, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(formattedVal, col2024X + col2024W, cy);

      // Houston median value
      const medianVal = medians?.[key];
      if (showMedian && medianVal != null) {
        ctx.font = "400 11px Lexend, sans-serif";
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

    ctx.font = "italic 9px Lexend, sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText(`Source: ${CENSUS_SOURCE}`, x + pad, cy);
    cy += 12;
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("* Houston metro area median", x + pad, cy);
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
    ctx.font = "600 15px Lexend, sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    // County (if present)
    if (data.county) {
      ctx.font = "400 11px Lexend, sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(`${data.county} County`, x + pad, cy);
      cy += 14;
    }

    // Neighborhood (if present)
    if (neighborhood) {
      ctx.font = "400 10px Lexend, sans-serif";
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
      ctx.font = "500 10px Lexend, sans-serif";
      ctx.fillStyle = "#FFB302";
      ctx.fillText("Working Poor score not available — data shown for reference only", x + pad, cy);
      cy += 13;
      ctx.font = "italic 9px Lexend, sans-serif";
      ctx.fillStyle = "#999999";
      ctx.fillText("Not scored or ranked. Excluded from Houston metro statistics.", x + pad, cy);
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

    ctx.font = "600 9px Lexend, sans-serif";
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
      ctx.font = highlight ? "600 12px Lexend, sans-serif" : "400 11px Lexend, sans-serif";
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
      ctx.font = highlight ? "700 14px Lexend, sans-serif" : "500 12px Lexend, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(formattedVal, col2024X + col2024W, cy);

      // Houston median value
      const medianVal = medians?.[key];
      if (showMedian && medianVal != null) {
        ctx.font = "400 11px Lexend, sans-serif";
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

    ctx.font = "italic 9px Lexend, sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText(`Source: ${CENSUS_SOURCE}`, x + pad, cy);
    cy += 12;
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("* Houston metro area median", x + pad, cy);
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

    ctx.font = "600 15px Lexend, sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    if (data.county) {
      ctx.font = "400 11px Lexend, sans-serif";
      ctx.fillStyle = "#CCCCCC";
      ctx.fillText(`${data.county} County`, x + pad, cy);
      cy += 14;
    }

    if (neighborhood) {
      ctx.font = "400 10px Lexend, sans-serif";
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
      ctx.font = "500 10px Lexend, sans-serif";
      ctx.fillStyle = "#FFB302";
      ctx.textAlign = "left";
      ctx.fillText("Evictions score not available — data shown for reference only", x + pad, cy + 6);
      ctx.font = "italic 9px Lexend, sans-serif";
      ctx.fillStyle = "#999999";
      ctx.fillText("Not scored or ranked. Excluded from Houston metro statistics.", x + pad, cy + 18);
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

    ctx.font = "600 9px Lexend, sans-serif";
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

      ctx.font = highlight ? "600 12px Lexend, sans-serif" : "400 11px Lexend, sans-serif";
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
      ctx.font = highlight ? "700 14px Lexend, sans-serif" : "500 12px Lexend, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(formattedVal, valCol1X + valColW, cy);

      const medianVal = medians?.[key];
      if (showMedian && medianVal != null) {
        ctx.font = "400 11px Lexend, sans-serif";
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

    ctx.font = "italic 9px Lexend, sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText("Source: Harris County Justice of the Peace Courts", x + pad, cy);
    cy += 12;
    ctx.fillStyle = "#8FB6FF";
    ctx.fillText("* Houston metro area median", x + pad, cy);
  };

  // Draw a simple legend directly on canvas
  const drawSimpleLegendOnCanvas = (ctx, label, count, countyName, containerEl, mode) => {
    const el = containerEl.querySelector("[data-legend]");
    if (!el) return;

    const cRect = containerEl.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const x = eRect.left - cRect.left;
    const y = eRect.top - cRect.top;
    const w = eRect.width;
    const h = eRect.height;
    const pad = 16;

    drawRoundedRect(ctx, x, y, w, h, 8, "rgba(255, 255, 255, 0.95)");
    ctx.textBaseline = "top";
    let cy = y + 12;

    // Assistance label
    if (label) {
      ctx.font = "600 13px Lexend, sans-serif";
      ctx.fillStyle = "#222831";
      ctx.fillText(label, x + pad, cy);
      cy += 22;
    }

    // Green pin circle + "Organization location"
    ctx.fillStyle = "#00CC44";
    ctx.beginPath();
    ctx.arc(x + pad + 5, cy + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "400 12px Lexend, sans-serif";
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

    // Teal square + "Zip codes served (on click)"
    ctx.fillStyle = "rgba(0, 168, 168, 0.5)";
    ctx.fillRect(x + pad + 1, cy + 2, 10, 10);
    ctx.fillStyle = "#444444";
    ctx.fillText("Zip codes served (on click)", x + pad + 18, cy);
    cy += 22;

    // Org count
    ctx.font = "400 11px Lexend, sans-serif";
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
    const y = eRect.top - cRect.top;
    const w = eRect.width;
    const h = eRect.height;
    const pad = 16;

    drawRoundedRect(ctx, x, y, w, h, 8, "rgba(255, 255, 255, 0.95)");
    ctx.textBaseline = "top";
    let cy = y + 12;

    // Assistance label
    if (label) {
      ctx.font = "600 13px Lexend, sans-serif";
      ctx.fillStyle = "#222831";
      ctx.fillText(label, x + pad, cy);
      cy += 18;
    }

    // Parent org
    if (parentName) {
      ctx.font = "500 12px Lexend, sans-serif";
      ctx.fillStyle = "#652C57";
      ctx.fillText(truncateText(ctx, `${parentName} — ${count} child${count !== 1 ? "ren" : ""}`, w - pad * 2), x + pad, cy);
      cy += 22;
    }

    // Purple swatch + "Parent coverage area"
    ctx.fillStyle = PARENT_COVERAGE_COLOR;
    ctx.fillRect(x + pad + 1, cy + 2, 10, 10);
    ctx.font = "400 12px Lexend, sans-serif";
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
    ctx.font = "400 12px Lexend, sans-serif";
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
      ctx.font = "400 11px Lexend, sans-serif";
      ctx.fillStyle = "#888888";
      ctx.fillText(`${countyName} County`, x + pad, cy);
      cy += 16;
    }

    // Metric legend bar
    drawMetricBarOnCanvas(ctx, x, cy, w, pad, mode);
  };

  // Draw metric legend bar on canvas (distress/working poor/population)
  const drawMetricBarOnCanvas = (ctx, x, y, w, pad, mode) => {
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
    if (mode === "bivariate") {
      drawBivariateGridOnCanvas(ctx, x, cy);
      return cy + 110;
    }

    // Label
    ctx.font = "500 11px Lexend, sans-serif";
    ctx.fillStyle = "#444444";
    const labels = {
      distress: "Distress Score",
      working_poor: "Working Poor Score",
      evictions: "Evictions Score",
      population: "Population Score",
      funding_level: "Funding Level Score",
      efficiency_ratio: "Efficiency Ratio Score",
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
    ctx.font = "400 9px Lexend, sans-serif";
    ctx.fillStyle = "#666666";
    if (mode === "distress" || mode === "working_poor" || mode === "evictions" || mode === "population" || mode === "efficiency_ratio") {
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
  const drawBivariateGridOnCanvas = (ctx, x, y) => {
    const cellSize = 28;
    const gridColors = [
      ["#C85A5A", "#B87070", "#999999"], // row 3 (high distress)
      ["#DDAAAA", "#BBBBBB", "#7BAEBF"], // row 2 (mid distress)
      ["#E8E8E8", "#A8CCD8", "#64ACBE"], // row 1 (low distress)
    ];

    // Title
    ctx.font = "500 11px Lexend, sans-serif";
    ctx.fillStyle = "#444444";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("Distress vs. Funding", x + 20, y);

    // 3x3 grid (drawn top-down: high distress at top)
    const gridX = x + 20;
    const gridY = y + 16;
    const gridCodes = [
      ["31", "32", "33"],
      ["21", "22", "23"],
      ["11", "12", "13"],
    ];
    const darkCells = new Set(["31", "32", "33", "13", "23"]);
    gridColors.forEach((row, ri) => {
      row.forEach((color, ci) => {
        const cx = gridX + ci * cellSize;
        const cy2 = gridY + ri * cellSize;
        ctx.fillStyle = color;
        ctx.fillRect(cx, cy2, cellSize, cellSize);
        // Draw code label centered in cell
        const code = gridCodes[ri][ci];
        ctx.font = "500 8px Lexend, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = darkCells.has(code) ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.4)";
        ctx.fillText(code, cx + cellSize / 2, cy2 + cellSize / 2);
      });
    });
    ctx.textBaseline = "top"; // reset

    // Axis labels
    ctx.font = "400 8px Lexend, sans-serif";
    ctx.fillStyle = "#666666";
    ctx.textAlign = "center";
    ctx.fillText("Funding →", gridX + cellSize * 1.5, gridY + cellSize * 3 + 4);

    ctx.save();
    ctx.translate(gridX - 4, gridY + cellSize * 1.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Distress →", 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
  };

  const drawBaseLegendOnCanvas = (ctx, containerEl, mode) => {
    const { height } = containerEl.getBoundingClientRect();

    if (mode === "bivariate") {
      // Draw 3x3 bivariate grid legend
      const w = 140;
      const boxH = 120;
      const x = 16;
      const y = height - boxH - 24;
      drawRoundedRect(ctx, x, y, w, boxH, 8);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
      drawBivariateGridOnCanvas(ctx, x, y + 8);
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
    const labels = { distress: "Distress Score", working_poor: "Working Poor Score", evictions: "Evictions Score", population: "Population", funding_level: "Funding Level Score", efficiency_ratio: "Efficiency Ratio Score" };
    let cy = y + 10;
    ctx.font = "500 11px Lexend, sans-serif";
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
    ctx.font = "400 9px Lexend, sans-serif";
    ctx.fillStyle = "#666666";
    if (mode === "distress" || mode === "working_poor" || mode === "evictions" || mode === "population" || mode === "efficiency_ratio") {
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
          ctx.font = "500 10px Lexend, sans-serif";
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

      // Step 3: Draw base map title on canvas (top left)
      const baseMapLabels = { distress: "Distress Levels", working_poor: "Working Poor", evictions: "Evictions", population: "Population", funding_level: "Funding Level", efficiency_ratio: "Distress vs. Funding", bivariate: "Distress vs. Funding" };
      const baseMapTitle = `Base Map: ${baseMapLabels[displayMetric] || "Distress Levels"}`;
      ctx.font = "700 16px 'Open Sans', sans-serif";
      ctx.fillStyle = "#2E5A88";
      ctx.textBaseline = "top";
      ctx.fillText(baseMapTitle, 20, 14);

      // Sub-heading for Distress vs. Funding maps
      if (displayMetric === "efficiency_ratio" || displayMetric === "bivariate") {
        ctx.font = "500 13px 'Open Sans', sans-serif";
        ctx.fillStyle = "#555555";
        ctx.fillText(displayMetric === "bivariate" ? "Bivariate Map" : "Efficiency Ratio Map", 20, 34);
      }

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
  }, [isDownloading, assistanceLabel, hasAssistance, orgPins, selectedOrgKey, showOrgLabels, infoBoxData, isDensityMode, parentCoverage, parentOrg, county, displayMetric, isBaseView, distressTableZip, distressDataLookup, distressRankLookup, houstonMedians, workingPoorTableZip, workingPoorDataLookup, workingPoorRankLookup, workingPoorMedians, evictionsTableZip, evictionsDataLookup, evictionsMedians, zipCodes]);

  // Expose download method to parent via ref
  useImperativeHandle(ref, () => ({
    download: handleDownload,
    isDownloading,
  }), [handleDownload, isDownloading]);

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
            {!isBaseView && hasAssistance && <Layer {...orgCoverageBorderTealStyle} />}
            {!isBaseView && hasAssistance && <Layer {...orgCoverageBorderMagentaStyle} />}
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
                      fontFamily: "Lexend, sans-serif",
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
                      fontFamily: "Lexend, sans-serif",
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

      {/* Base map title + View Mode dropdown - top left */}
      <div
        className="absolute"
        style={{
          top: "10px",
          left: "20px",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "9px",
          width: "320px",
        }}
      >
        {/* Base map title - prominent with background pill */}
        <div
          style={{
            fontFamily: "'Open Sans', sans-serif",
            fontSize: "clamp(13px, 1.3vw, 17px)",
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "0.5px",
            userSelect: "none",
            backgroundColor: "rgba(34, 40, 49, 0.85)",
            padding: "6px 14px",
            borderRadius: "6px",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Base Map: {{ distress: "Distress Levels", working_poor: "Working Poor", evictions: "Evictions", population: "Population", funding_level: "Funding Level", efficiency_ratio: "Distress vs. Funding", bivariate: "Distress vs. Funding" }[displayMetric] || "Distress Levels"}
        </div>

        {/* View Mode dropdown (custom) */}
        {onViewModeChange && (
          <ViewModeDropdown viewMode={viewMode} onViewModeChange={onViewModeChange} />
        )}

        {/* Efficiency / Bivariate toggle - only when Distress vs. Funding is active */}
        {(isBaseView ? (displayMetric === "efficiency_ratio" || displayMetric === "bivariate") : activeBase === "efficiency_ratio") && (
          <div
            className="relative flex items-center rounded-full cursor-pointer"
            style={{
              backgroundColor: "#222831",
              padding: "4px",
              width: "180px",
              height: "38px",
            }}
            onClick={() => setEfficiencySubMode(prev => prev === "efficiency" ? "bivariate" : "efficiency")}
          >
            <div
              className="absolute rounded-full transition-all duration-300 ease-in-out"
              style={{
                backgroundColor: "#2E5A88",
                width: "calc(50% - 4px)",
                height: "30px",
                left: efficiencySubMode === "bivariate" ? "calc(50% + 2px)" : "4px",
              }}
            />
            <span
              className={`relative z-10 flex-1 text-center font-opensans text-sm transition-colors duration-300 ${
                efficiencySubMode === "efficiency" ? "text-white" : "text-white/70"
              }`}
              style={{ fontWeight: 500 }}
            >
              Efficiency
            </span>
            <span
              className={`relative z-10 flex-1 text-center font-opensans text-sm transition-colors duration-300 ${
                efficiencySubMode === "bivariate" ? "text-white" : "text-white/70"
              }`}
              style={{ fontWeight: 500 }}
            >
              Bivariate
            </span>
          </div>
        )}
      </div>

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
      {(isBaseView ? displayMetric === "distress" : activeBase === "distress") && distressTableZip && distressDataLookup[distressTableZip] && (
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

      {/* Draggable population info box - in population base view or when activeBase is population in filter view */}
      {(isBaseView ? displayMetric === "population" : activeBase === "population") && populationTableZip && (
        <DraggablePopulationTable
          population={populationLookup[populationTableZip]}
          zipCode={populationTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === populationTableZip)?.neighborhood || ""}
          county={distressDataLookup[populationTableZip]?.county || ""}
          hasKeyData={populationLookup[populationTableZip] != null}
          onClose={() => setPopulationTableZip(null)}
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

export default MapboxMap;
