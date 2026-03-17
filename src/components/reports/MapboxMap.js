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

// Distress colors - 4 bands: top 10% highlighted, rest in thirds
const DISTRESS_GREEN = "rgba(76, 175, 80, 0.30)";    // p0-30 (light green)
const DISTRESS_YELLOW = "rgba(255, 213, 0, 0.30)";   // p30-60 (yellow)
const DISTRESS_ORANGE = "rgba(245, 124, 0, 0.40)";   // p60-90 (orange)
const DISTRESS_RED = "rgba(220, 50, 50, 0.50)";      // p90-100 (red - top 10%)

// Working poor colors - 4 bands: top 10% highlighted, rest in thirds (red gradient)
const WP_BAND_1 = "rgba(255, 205, 210, 0.30)";   // p0-30 (lightest rose)
const WP_BAND_2 = "rgba(239, 130, 130, 0.35)";   // p30-60 (salmon)
const WP_BAND_3 = "rgba(198, 40, 40, 0.42)";     // p60-90 (dark red)
const WP_BAND_4 = "rgba(100, 0, 0, 0.55)";       // p90-100 (deep maroon - top 10%)

// Evictions colors - 4 bands: top 10% highlighted, rest in thirds (orange gradient)
const EV_BAND_1 = "rgba(255, 224, 178, 0.30)";   // p0-30 (light peach)
const EV_BAND_2 = "rgba(245, 166, 35, 0.35)";    // p30-60 (warm amber)
const EV_BAND_3 = "rgba(230, 100, 0, 0.42)";     // p60-90 (deep orange)
const EV_BAND_4 = "rgba(150, 40, 0, 0.55)";      // p90-100 (dark burnt - top 10%)

// Population colors - purple gradient (higher = darker purple)
const POP_LIGHT = "rgba(200, 170, 230, 0.30)";   // below p25 (light lavender)
const POP_MID = "rgba(128, 60, 170, 0.40)";      // between p25-p75 (medium purple)
const POP_DARK = "rgba(75, 0, 130, 0.50)";       // above p75 (indigo)

// Unified fill layer - one color per zip at any given time
// Priority: childHighlighted (teal) > base highlight > hover > [parent coverage in filter view] > metric colors
// Uses feature-state for interactive states, GeoJSON property "density" for parent coverage
function getUnifiedFillStyle(metric = "distress", showParentCoverage = true, thresholds = {}, showInteractiveHighlights = true, yoyMode = false) {
  // Build metric color expression based on active metric
  let metricExpression;
  if (metric === "working_poor") {
    // 4 bands based on working_poor_score (0-100 scale, -1 = no data)
    metricExpression = [
      [">=", ["coalesce", ["get", "working_poor_score"], -1], 90],
      WP_BAND_4,
      [">=", ["coalesce", ["get", "working_poor_score"], -1], 60],
      WP_BAND_3,
      [">=", ["coalesce", ["get", "working_poor_score"], -1], 30],
      WP_BAND_2,
      [">=", ["coalesce", ["get", "working_poor_score"], -1], 0],
      WP_BAND_1,
    ];
  } else if (metric === "evictions") {
    // 4 bands based on evictions_score (0-100 scale, -1 = no data)
    metricExpression = [
      [">=", ["coalesce", ["get", "evictions_score"], -1], 90],
      EV_BAND_4,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 60],
      EV_BAND_3,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 30],
      EV_BAND_2,
      [">=", ["coalesce", ["get", "evictions_score"], -1], 0],
      EV_BAND_1,
    ];
  } else if (metric === "population") {
    const pop25 = thresholds.population?.p25 ?? 0;
    const pop75 = thresholds.population?.p75 ?? 0;
    // Higher = more population = darker blue
    metricExpression = [
      [">=", ["coalesce", ["get", "population"], 0], pop75],
      POP_DARK,
      [">=", ["coalesce", ["get", "population"], 0], pop25],
      POP_MID,
      [">", ["coalesce", ["get", "population"], 0], 0],
      POP_LIGHT,
    ];
  } else {
    // distress (default) - 4 bands based on distress_score (0-100 scale, -1 = no data)
    metricExpression = [
      [">=", ["coalesce", ["get", "distress_score"], -1], 90],
      DISTRESS_RED,
      [">=", ["coalesce", ["get", "distress_score"], -1], 60],
      DISTRESS_ORANGE,
      [">=", ["coalesce", ["get", "distress_score"], -1], 30],
      DISTRESS_YELLOW,
      [">=", ["coalesce", ["get", "distress_score"], -1], 0],
      DISTRESS_GREEN,
    ];
  }

  // Build the full case expression
  const fillColorExpr = [
    "case",
  ];

  // Priority 1 & 2: Interactive highlights - only in filter view
  if (showInteractiveHighlights) {
    fillColorExpr.push(
      // Priority 1: Child teal (pin click)
      ["boolean", ["feature-state", "childHighlighted"], false],
      "rgba(0, 253, 253, 0.40)",
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

  // Priority 4: Parent coverage blue - only in filter view
  if (showParentCoverage) {
    fillColorExpr.push(
      [">=", ["coalesce", ["get", "density"], 0], 1],
      PARENT_COVERAGE_COLOR
    );
  }

  // Priority 5: YoY overlay (when active, replaces metric colors)
  if (yoyMode) {
    // Single green for all improved zips, single red for all declined zips
    fillColorExpr.push(
      [">=", ["coalesce", ["get", "yoy_improved_rank"], 0], 1], "rgba(46, 125, 50, 0.50)",
      [">=", ["coalesce", ["get", "yoy_declined_rank"], 0], 1], "rgba(211, 47, 47, 0.50)",
    );
    // All other zips: white/transparent
    fillColorExpr.push("rgba(255, 255, 255, 0.08)");
  } else {
    // Priority 5: Metric colors
    fillColorExpr.push(...metricExpression);

    // Fallback: no data
    fillColorExpr.push("rgba(0, 0, 0, 0)");
  }

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
  if (score >= 90) return "rgba(220, 50, 50, 0.85)";     // Red
  if (score >= 60) return "rgba(245, 124, 0, 0.85)";     // Orange
  if (score >= 30) return "rgba(255, 213, 0, 0.85)";     // Yellow
  return "rgba(76, 175, 80, 0.85)";                       // Light green
}

// Fields where higher values are GOOD (up arrow green, down arrow red)
const HIGHER_IS_GOOD = new Set(["median_household_inc", "owner_occupancy", "income_ratio"]);
// Fields where values are neutral (no trend arrow)
const NEUTRAL_FIELDS = new Set(["population"]);

// Trend arrow: direction = which way the number moved, color = good or bad
function getTrendArrow(key, val2024, val2023) {
  if (val2024 == null || val2023 == null || NEUTRAL_FIELDS.has(key)) return null;
  const diff = val2024 - val2023;
  if (diff === 0) return null;
  const wentUp = diff > 0;
  const isGood = HIGHER_IS_GOOD.has(key) ? wentUp : !wentUp;
  return { arrow: wentUp ? "▲" : "▼", color: isGood ? "#4CAF50" : "#E74C3E" };
}

// Distress data field labels for display in the table
// showMedian: true = show Houston metro median in comparison column
const fmtPct = (v) => v != null ? `${Number(v).toFixed(1)}%` : "—";
const fmtDollar = (v) => v != null ? `$${Math.round(Number(v)).toLocaleString()}` : "—";
const fmtPop = (v) => v != null ? Math.round(Number(v)).toLocaleString() : "—";
const fmtRatio = (v) => v != null ? Number(v).toFixed(2) : "—";
const fmtScore = (v) => v != null ? Number(v).toFixed(1) : "—";

const DISTRESS_FIELDS = [
  { key: "distress_score", label: "Distress Score", format: fmtScore, highlight: true, showMedian: true, medianFormat: fmtScore },
  { key: "rank", label: "Rank", format: (v, total) => v != null ? `${v} of ${total}` : "—", isRank: true },
  { key: "population", label: "Population", format: fmtPop, showMedian: true, medianFormat: fmtPop },
  { key: "poverty_rate", label: "Poverty Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "median_household_inc", label: "Median Household Income", format: fmtDollar, showMedian: true, medianFormat: fmtDollar },
  { key: "income_ratio", label: "Income Ratio", format: fmtRatio, showMedian: true, medianFormat: fmtRatio },
  { key: "unemp_rate", label: "Unemployment Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_health_ins", label: "No Health Insurance", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "snap", label: "SNAP Recipients", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_hs_diploma", label: "No HS Diploma", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "vacancy_rate", label: "Vacancy Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "owner_occupancy", label: "Owner Occupancy", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_vehicle", label: "No Vehicle", format: fmtPct, showMedian: true, medianFormat: fmtPct },
];

// Compute Houston metro medians from distress_data array
function computeHoustonMedians(distressData) {
  if (!distressData || distressData.length === 0) return {};
  const medians = {};
  const medianFields = DISTRESS_FIELDS.filter(f => f.showMedian).map(f => f.key);
  // Only include fully scored zips (exclude === 2) in aggregate calculations
  const reliableData = distressData.filter(d => d.exclude === 2);

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
  { key: "unemp_rate", label: "Unemployment Rate", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_health_ins", label: "No Health Insurance", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "snap", label: "SNAP Recipients", format: fmtPct, showMedian: true, medianFormat: fmtPct },
  { key: "no_hs_diploma", label: "No HS Diploma", format: fmtPct, showMedian: true, medianFormat: fmtPct },
];

// Compute Houston metro medians from working_poor_data array
function computeWorkingPoorMedians(workingPoorData) {
  if (!workingPoorData || workingPoorData.length === 0) return {};
  const medians = {};
  const medianFields = WORKING_POOR_FIELDS.filter(f => f.showMedian).map(f => f.key);
  // All working poor records are exclude === 2, so no filter needed
  const reliableData = workingPoorData;

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
  if (score == null) return "#888";
  if (score >= 90) return "rgba(100, 0, 0, 0.85)";       // Deep maroon
  if (score >= 60) return "rgba(198, 40, 40, 0.85)";     // Dark red
  if (score >= 30) return "rgba(239, 130, 130, 0.85)";   // Salmon
  return "rgba(255, 205, 210, 0.85)";                     // Lightest rose
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

// Compute Houston metro medians from evictions_data array (exclude=2 only)
function computeEvictionsMedians(evictionsData) {
  if (!evictionsData || evictionsData.length === 0) return {};
  const reliableData = evictionsData.filter(d => d.exclude === 2);
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
  if (score == null) return "#888";
  if (score >= 90) return "rgba(150, 40, 0, 0.85)";        // Dark burnt - top 10%
  if (score >= 60) return "rgba(230, 100, 0, 0.85)";       // Deep orange
  if (score >= 30) return "rgba(245, 166, 35, 0.85)";      // Warm amber
  return "rgba(255, 224, 178, 0.85)";                       // Light peach
}

// Ranked counts are computed dynamically from data (count of exclude===2 records)

// Draggable distress data table component - shows census indicators for a clicked zip
function DraggableDistressTable({ data, data2023, zipCode, neighborhood, houstonMedians, rankedCount, onClose }) {
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
        backgroundColor: data.exclude === 1 ? "rgba(105, 105, 118, 0.95)" : "rgba(34, 40, 49, 0.95)",
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

      {/* Banner for exclude=1 (small population) */}
      {data.exclude === 1 && (
        <div style={{
          padding: "6px 14px",
          backgroundColor: "rgba(255, 179, 2, 0.15)",
          borderBottom: "1px solid rgba(255, 179, 2, 0.25)",
        }}>
          <span style={{ fontSize: "10px", color: "#FFB302", fontWeight: 500 }}>
            Small population — data shown for reference only
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
        <span style={{ width: "60px", textAlign: "right", fontSize: "9px", color: "#FFFFFF", fontWeight: 600 }}>
          2023
        </span>
        <span style={{ width: "72px", textAlign: "right", fontSize: "9px", color: "#FFFFFF", fontWeight: 600 }}>
          2024
        </span>
        <span style={{ width: "60px", textAlign: "right", fontSize: "9px", color: "#8FB6FF", fontWeight: 600 }}>
          Houston*
        </span>
      </div>

      {/* Data rows */}
      <div style={{ padding: "4px 14px 2px" }}>
        {data.exclude === 0 ? (
          /* Exclude=0: garbage data — show population only + "no data available" */
          <>
            <div style={{ display: "flex", alignItems: "center", padding: "3px 0" }}>
              <span style={{ flex: 1, fontSize: "11px", color: "#CCC" }}>Population</span>
              <span style={{ fontSize: "12px", color: "#FFFFFF", fontWeight: 500 }}>
                {data.population != null ? data.population.toLocaleString() : "—"}
              </span>
            </div>
            <div style={{ padding: "12px 0", textAlign: "center" }}>
              <span style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>No data available</span>
            </div>
          </>
        ) : (
          /* Exclude=1 or 2: show data rows */
          DISTRESS_FIELDS.map(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
            // Skip score and rank rows for exclude=1 (small population, raw data only)
            if (data.exclude === 1 && (highlight || isRank)) return null;

            const medianVal = houstonMedians?.[key];
            const fmtMedian = showMedian && medianVal != null
              ? (medianFormat ? medianFormat(medianVal) : medianVal.toLocaleString())
              : "";
            const val2023 = data2023?.[key];
            const trend = (data.exclude === 2 && !isRank) ? getTrendArrow(key, data[key], val2023) : null;

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
                  {/* 2023 value (skip for rank rows) */}
                  <span style={{
                    width: "60px",
                    textAlign: "right",
                    fontSize: highlight ? "13px" : "11px",
                    color: "#999",
                    fontWeight: highlight ? 600 : 400,
                  }}>
                    {isRank ? "" : (val2023 != null ? format(val2023) : "—")}
                  </span>
                  {/* 2024 value + trend arrow */}
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
                    {trend && (
                      <span style={{
                        fontSize: "9px",
                        color: trend.color,
                        flexShrink: 0,
                        lineHeight: 1,
                      }}>
                        {trend.arrow}
                      </span>
                    )}
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
          })
        )}
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

// Fields used in distress score (exclude rank, population, and score itself — they're not score inputs)
const DISTRESS_SCORE_DRIVERS = DISTRESS_FIELDS.filter(
  f => f.showMedian && !f.isRank && f.key !== "population" && f.key !== "distress_score"
);

// Draggable YoY summary panel for distress data — Houston metro trends
function DraggableDistressYoY({ distressData, distressData2023, houstonMedians, houstonMedians2023, onClose }) {
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

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

  // Compute per-zip score changes and find top/bottom 5 (only fully scored zips)
  const { top5Improved, top5Declined } = useMemo(() => {
    if (!distressData?.length || !distressData2023?.length) return { top5Improved: [], top5Declined: [] };

    const lookup2023 = {};
    distressData2023.forEach(d => { if (d.zip_code) lookup2023[d.zip_code] = d; });

    const changes = distressData
      .filter(d => d.zip_code && d.exclude === 2 && d.distress_score != null && lookup2023[d.zip_code]?.distress_score != null)
      .map(d => {
        const prev = lookup2023[d.zip_code];
        const scoreDiff = d.distress_score - prev.distress_score;

        // Find top 2-3 key changes using percentage change (normalized comparison)
        const metricChanges = [];
        DISTRESS_SCORE_DRIVERS.forEach(({ key, label, format }) => {
          const v2024 = d[key];
          const v2023 = prev[key];
          if (v2024 != null && v2023 != null && v2023 !== 0) {
            const pctChange = ((v2024 - v2023) / Math.abs(v2023)) * 100;
            // Only include meaningful changes (>1% change)
            if (Math.abs(pctChange) > 1) {
              const isGood = HIGHER_IS_GOOD.has(key) ? (v2024 > v2023) : (v2024 < v2023);
              metricChanges.push({ key, label, pctChange, isGood, format, v2024 });
            }
          }
        });
        // Sort by absolute percentage change descending, take top 3
        metricChanges.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
        const keyChanges = metricChanges.slice(0, 3);

        return {
          zip: d.zip_code,
          score2024: d.distress_score,
          score2023: prev.distress_score,
          diff: scoreDiff,
          keyChanges,
        };
      });

    // Sort by diff ascending (most improved = biggest negative diff)
    const sorted = [...changes].sort((a, b) => a.diff - b.diff);
    const top5Improved = sorted.slice(0, 5);
    const top5Declined = sorted.slice(-5).reverse(); // worst at top

    return { top5Improved, top5Declined };
  }, [distressData, distressData2023]);

  if (!houstonMedians || !houstonMedians2023) return null;

  const fmtDiff = (diff) => {
    const sign = diff > 0 ? "+" : "";
    return `${sign}${diff.toLocaleString()}`;
  };

  // Metrics to show in Houston Metro summary (skip percentile)
  const metroFields = DISTRESS_FIELDS.filter(f => f.showMedian && f.key !== "population");

  return (
    <div
      data-distress-yoy="true"
      onMouseDown={handleMouseDown}
      className="absolute z-50 rounded-lg shadow-xl"
      style={{
        bottom: "60px",
        left: "20px",
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: "460px",
        maxHeight: "85vh",
        overflowY: "auto",
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
        <h3 style={{
          fontSize: "15px",
          color: "#FFC857",
          fontWeight: 600,
          margin: 0,
        }}>
          Distress — Year over Year Change
        </h3>
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
          }}
        >
          ×
        </button>
      </div>

      {/* Section 1: Houston Metro Medians */}
      <div style={{ padding: "8px 14px 4px" }}>
        <div style={{
          fontSize: "12px",
          color: "#8FB6FF",
          fontWeight: 600,
          marginBottom: "6px",
        }}>
          Houston Metro Area Medians
        </div>

        {/* Column headers */}
        <div style={{ display: "flex", padding: "0 0 4px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ flex: 1, fontSize: "9px", color: "#888" }}></span>
          <span style={{ width: "60px", textAlign: "right", fontSize: "9px", color: "#FFF", fontWeight: 600 }}>2023</span>
          <span style={{ width: "60px", textAlign: "right", fontSize: "9px", color: "#FFF", fontWeight: 600 }}>2024</span>
          <span style={{ width: "55px", textAlign: "right", fontSize: "9px", color: "#FFF", fontWeight: 600 }}>Change</span>
        </div>

        {metroFields.map(({ key, label, medianFormat, format }) => {
          const v2023 = houstonMedians2023[key];
          const v2024 = houstonMedians[key];
          const fmt = medianFormat || format;
          const trend = getTrendArrow(key, v2024, v2023);

          return (
            <div key={key} style={{
              display: "flex",
              alignItems: "center",
              padding: key === "distress_score" ? "5px 0" : "2px 0",
              borderBottom: key === "distress_score" ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}>
              <span style={{
                flex: 1,
                fontSize: key === "distress_score" ? "11px" : "10px",
                color: key === "distress_score" ? "#FFC857" : "#CCC",
                fontWeight: key === "distress_score" ? 600 : 400,
              }}>
                {label}
              </span>
              <span style={{ width: "60px", textAlign: "right", fontSize: "10px", color: "#999" }}>
                {v2023 != null ? fmt(v2023) : "—"}
              </span>
              <span style={{ width: "60px", textAlign: "right", fontSize: "10px", color: "#FFF", fontWeight: 500 }}>
                {v2024 != null ? fmt(v2024) : "—"}
              </span>
              <span style={{
                width: "55px",
                textAlign: "right",
                fontSize: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "3px",
              }}>
                {trend && (
                  <span style={{ color: trend.color, fontSize: "9px" }}>{trend.arrow}</span>
                )}
                <span style={{ color: "#CCC", fontSize: "9px" }}>
                  {v2024 != null && v2023 != null ? (() => {
                    const diff = Math.abs(v2024 - v2023);
                    if (key === "distress_score") return Math.round(diff).toLocaleString();
                    if (key === "median_household_inc") return `$${Math.round(diff).toLocaleString()}`;
                    if (key === "income_ratio") return diff.toFixed(2);
                    return `${Math.round(diff * 10) / 10}%`;
                  })() : "—"}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Section 2: Most Improved Zip Codes */}
      <div style={{ padding: "8px 14px 4px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{
          fontSize: "12px",
          color: "#4CAF50",
          fontWeight: 600,
          marginBottom: "6px",
        }}>
          Most Improved Zip Codes
        </div>

        <div style={{ display: "flex", padding: "0 0 4px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ width: "50px", fontSize: "9px", color: "#888" }}>Zip</span>
          <span style={{ width: "50px", textAlign: "right", fontSize: "9px", color: "#FFF", fontWeight: 600 }}>Score</span>
          <span style={{ width: "45px", textAlign: "right", fontSize: "9px", color: "#FFF", fontWeight: 600 }}>Chg</span>
          <span style={{ flex: 1, fontSize: "9px", color: "#888", paddingLeft: "12px" }}>Key Changes</span>
        </div>

        {top5Improved.map((z) => {
          const scoreTrend = getTrendArrow("distress_score", z.score2024, z.score2023);
          return (
            <div key={z.zip} style={{ display: "flex", alignItems: "flex-start", padding: "3px 0" }}>
              <span style={{ width: "50px", fontSize: "11px", color: "#FFF", fontWeight: 500 }}>{z.zip}</span>
              <span style={{ width: "50px", textAlign: "right", fontSize: "10px", color: "#FFF" }}>{z.score2024.toLocaleString()}</span>
              <span style={{ width: "45px", textAlign: "right", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "2px" }}>
                {scoreTrend && <span style={{ color: scoreTrend.color, fontSize: "9px" }}>{scoreTrend.arrow}</span>}
                <span style={{ color: "#4CAF50", fontSize: "9px" }}>{fmtDiff(Math.round(z.diff))}</span>
              </span>
              <div style={{ flex: 1, paddingLeft: "12px" }}>
                {z.keyChanges.length > 0 ? z.keyChanges.map((c, i) => (
                  <div key={c.key} style={{ fontSize: "9px", color: "#CCC", lineHeight: "14px" }}>
                    <span>{c.label}</span>
                    <span style={{ color: c.isGood ? "#4CAF50" : "#E74C3E", marginLeft: "4px" }}>
                      {c.pctChange > 0 ? "+" : ""}{c.pctChange.toFixed(1)}%
                    </span>
                  </div>
                )) : <span style={{ fontSize: "9px", color: "#888" }}>—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 3: Most Declined Zip Codes */}
      <div style={{ padding: "8px 14px 4px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{
          fontSize: "12px",
          color: "#E74C3E",
          fontWeight: 600,
          marginBottom: "6px",
        }}>
          Most Declined Zip Codes
        </div>

        <div style={{ display: "flex", padding: "0 0 4px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ width: "50px", fontSize: "9px", color: "#888" }}>Zip</span>
          <span style={{ width: "50px", textAlign: "right", fontSize: "9px", color: "#FFF", fontWeight: 600 }}>Score</span>
          <span style={{ width: "45px", textAlign: "right", fontSize: "9px", color: "#FFF", fontWeight: 600 }}>Chg</span>
          <span style={{ flex: 1, fontSize: "9px", color: "#888", paddingLeft: "12px" }}>Key Changes</span>
        </div>

        {top5Declined.map((z) => {
          const scoreTrend = getTrendArrow("distress_score", z.score2024, z.score2023);
          return (
            <div key={z.zip} style={{ display: "flex", alignItems: "flex-start", padding: "3px 0" }}>
              <span style={{ width: "50px", fontSize: "11px", color: "#FFF", fontWeight: 500 }}>{z.zip}</span>
              <span style={{ width: "50px", textAlign: "right", fontSize: "10px", color: "#FFF" }}>{z.score2024.toLocaleString()}</span>
              <span style={{ width: "45px", textAlign: "right", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "2px" }}>
                {scoreTrend && <span style={{ color: scoreTrend.color, fontSize: "9px" }}>{scoreTrend.arrow}</span>}
                <span style={{ color: "#E74C3E", fontSize: "9px" }}>{fmtDiff(Math.round(z.diff))}</span>
              </span>
              <div style={{ flex: 1, paddingLeft: "12px" }}>
                {z.keyChanges.length > 0 ? z.keyChanges.map((c, i) => (
                  <div key={c.key} style={{ fontSize: "9px", color: "#CCC", lineHeight: "14px" }}>
                    <span>{c.label}</span>
                    <span style={{ color: c.isGood ? "#4CAF50" : "#E74C3E", marginLeft: "4px" }}>
                      {c.pctChange > 0 ? "+" : ""}{c.pctChange.toFixed(1)}%
                    </span>
                  </div>
                )) : <span style={{ fontSize: "9px", color: "#888" }}>—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: "6px 14px 10px",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        <span style={{ fontSize: "9px", color: "#888", fontStyle: "italic" }}>
          Source: {CENSUS_SOURCE}
        </span>
        <br />
        <span style={{ fontSize: "9px", color: "#888", fontStyle: "italic" }}>
          Score change based on distress score (composite of all indicators).
        </span>
      </div>
    </div>
  );
}

// Draggable working poor data table component - shows working poor indicators for a clicked zip
function DraggableWorkingPoorTable({ data, data2023, zipCode, neighborhood, houstonMedians, rankedCount, onClose }) {
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
        <span style={{ width: "60px", textAlign: "right", fontSize: "9px", color: "#FFFFFF", fontWeight: 600 }}>
          2023
        </span>
        <span style={{ width: "72px", textAlign: "right", fontSize: "9px", color: "#FFFFFF", fontWeight: 600 }}>
          2024
        </span>
        <span style={{ width: "60px", textAlign: "right", fontSize: "9px", color: "#8FB6FF", fontWeight: 600 }}>
          Houston*
        </span>
      </div>

      {/* Data rows */}
      <div style={{ padding: "4px 14px 2px" }}>
        {WORKING_POOR_FIELDS.map(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
          const medianVal = houstonMedians?.[key];
          const fmtMedian = showMedian && medianVal != null
            ? (medianFormat ? medianFormat(medianVal) : medianVal.toLocaleString())
            : "";
          const val2023 = data2023?.[key];
          const trend = !isRank ? getTrendArrow(key, data[key], val2023) : null;

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
                {/* 2023 value (skip for rank rows) */}
                <span style={{
                  width: "60px",
                  textAlign: "right",
                  fontSize: highlight ? "13px" : "11px",
                  color: "#999",
                  fontWeight: highlight ? 600 : 400,
                }}>
                  {isRank ? "" : (val2023 != null ? format(val2023) : "—")}
                </span>
                {/* 2024 value + trend arrow */}
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
                  {trend && (
                    <span style={{
                      fontSize: "9px",
                      color: trend.color,
                      flexShrink: 0,
                      lineHeight: 1,
                    }}>
                      {trend.arrow}
                    </span>
                  )}
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
        backgroundColor: data.exclude === 1 ? "rgba(105, 105, 118, 0.95)" : "rgba(34, 40, 49, 0.95)",
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

      {/* Exclude=1 amber banner */}
      {data.exclude === 1 && (
        <div style={{
          padding: "6px 14px",
          backgroundColor: "rgba(255, 179, 2, 0.15)",
          borderBottom: "1px solid rgba(255, 179, 2, 0.25)",
        }}>
          <span style={{ fontSize: "10px", color: "#FFB302", fontWeight: 500 }}>
            Small population — data shown for reference only
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
          Zip
        </span>
        <span style={{ width: "72px", textAlign: "right", fontSize: "9px", color: "#8FB6FF", fontWeight: 600 }}>
          Houston*
        </span>
      </div>

      {/* Data rows */}
      <div style={{ padding: "4px 14px 2px" }}>
        {data.exclude === 0 ? (
          /* Exclude=0: garbage data — show only "no data available" */
          <div style={{ padding: "12px 0", textAlign: "center" }}>
            <span style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>No data available</span>
          </div>
        ) : (
          /* Exclude=1 or 2: show data rows */
          EVICTIONS_FIELDS.map(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
            // Skip score and rank rows for exclude=1
            if (data.exclude === 1 && (highlight || isRank)) return null;

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
          })
        )}
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

// (Fill layers consolidated into getUnifiedFillStyle() above)

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
              backgroundColor: "rgba(0, 253, 253, 0.50)",
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

// Distress score legend bar - smooth gradient matching the map overlay
function DistressLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Distress Score
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 3, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(76, 175, 80, 0.40)" }} />
        <div style={{ flex: 3, height: "10px", backgroundColor: "rgba(255, 213, 0, 0.40)" }} />
        <div style={{ flex: 3, height: "10px", backgroundColor: "rgba(245, 124, 0, 0.45)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(220, 50, 50, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
        <span>0</span>
        <span>30</span>
        <span>60</span>
        <span>90</span>
        <span>100</span>
      </div>
    </div>
  );
}

// Working poor legend bar - 4-band red gradient matching score bands
function WorkingPoorLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Working Poor Score
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 3, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(255, 205, 210, 0.45)" }} />
        <div style={{ flex: 3, height: "10px", backgroundColor: "rgba(239, 130, 130, 0.45)" }} />
        <div style={{ flex: 3, height: "10px", backgroundColor: "rgba(198, 40, 40, 0.50)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(100, 0, 0, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
        <span>0</span>
        <span>30</span>
        <span>60</span>
        <span>90</span>
        <span>100</span>
      </div>
    </div>
  );
}

// Population legend bar - blue gradient (higher = more = darker)
function PopulationLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Population
      </div>
      <div style={{ display: "flex", gap: "2px", marginBottom: "2px" }}>
        <div style={{ flex: 1, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(200, 170, 230, 0.45)" }} />
        <div style={{ flex: 2, height: "10px", backgroundColor: "rgba(128, 60, 170, 0.50)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(75, 0, 130, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#666" }}>
        <span>Low</span>
        <span>Mid</span>
        <span>High</span>
      </div>
    </div>
  );
}

// Evictions legend bar - 5-band blue gradient matching percentile bands
function EvictionsLegendBar({ standalone }) {
  return (
    <div style={standalone ? {} : { marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
      <div style={{ fontWeight: 500, fontSize: "11px", color: "#444", marginBottom: "4px" }}>
        Evictions Score
      </div>
      <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
        <div style={{ flex: 3, height: "10px", borderRadius: "3px 0 0 3px", backgroundColor: "rgba(255, 224, 178, 0.45)" }} />
        <div style={{ flex: 3, height: "10px", backgroundColor: "rgba(245, 166, 35, 0.45)" }} />
        <div style={{ flex: 3, height: "10px", backgroundColor: "rgba(230, 100, 0, 0.50)" }} />
        <div style={{ flex: 1, height: "10px", borderRadius: "0 3px 3px 0", backgroundColor: "rgba(150, 40, 0, 0.55)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
        <span>0</span>
        <span>30</span>
        <span>60</span>
        <span>90</span>
        <span>100</span>
      </div>
    </div>
  );
}

// Metric legend bar switcher - renders the correct legend bar based on viewMode
function MetricLegendBar({ viewMode, standalone }) {
  if (viewMode === "working_poor") return <WorkingPoorLegendBar standalone={standalone} />;
  if (viewMode === "evictions") return <EvictionsLegendBar standalone={standalone} />;
  if (viewMode === "population") return <PopulationLegendBar standalone={standalone} />;
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
  const { directory, assistance, zipCodes, distressData, distressData2023, workingPoorData, workingPoorData2023, evictionsData } = useAppData();
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

  // Distress score lookup: zip_code -> distress_score (only exclude === 2 get colored on map)
  // Uses -1 sentinel for zips without data so score 0 (best zip) still gets colored
  const distressLookup = useMemo(() => {
    const lookup = {};
    if (!distressData) return lookup;
    distressData.forEach((d) => {
      if (d.zip_code && d.exclude === 2 && d.distress_score != null) {
        lookup[d.zip_code] = Number(d.distress_score);
      }
    });
    return lookup;
  }, [distressData]);

  // Working poor lookup: zip_code -> working_poor_score value (from working_poor_data table)
  const workingPoorLookup = useMemo(() => {
    const lookup = {};
    if (!workingPoorData) return lookup;
    workingPoorData.forEach((d) => {
      if (d.zip_code && d.working_poor_score != null) {
        lookup[d.zip_code] = Number(d.working_poor_score) || 0;
      }
    });
    return lookup;
  }, [workingPoorData]);

  // Population lookup: zip_code -> population value (from distress data, includes all exclude levels)
  const populationLookup = useMemo(() => {
    const lookup = {};
    if (!distressData) return lookup;
    distressData.forEach((d) => {
      if (d.zip_code && d.population != null) {
        lookup[d.zip_code] = Number(d.population) || 0;
      }
    });
    return lookup;
  }, [distressData]);

  // Distress data lookup: zip_code -> full distress record (for popup table)
  const distressDataLookup = useMemo(() => {
    const lookup = {};
    if (!distressData) return lookup;
    distressData.forEach((d) => {
      if (d.zip_code) {
        lookup[d.zip_code] = d;
      }
    });
    return lookup;
  }, [distressData]);

  // Distress data 2023 lookup: zip_code -> full 2023 distress record (for YoY comparison)
  const distressData2023Lookup = useMemo(() => {
    const lookup = {};
    if (!distressData2023) return lookup;
    distressData2023.forEach((d) => {
      if (d.zip_code) {
        lookup[d.zip_code] = d;
      }
    });
    return lookup;
  }, [distressData2023]);

  // Houston metro medians computed from distress_data (for comparison column)
  const houstonMedians = useMemo(() => computeHoustonMedians(distressData), [distressData]);
  const houstonMedians2023 = useMemo(() => computeHoustonMedians(distressData2023), [distressData2023]);

  // YoY summary panel state
  const [showDistressYoY, setShowDistressYoY] = useState(false);

  // YoY top/bottom 5 zip codes for map highlighting (lightweight — just zip + rank, only fully scored zips)
  const distressYoYZips = useMemo(() => {
    if (!distressData?.length || !distressData2023?.length) return null;
    const lookup2023 = {};
    distressData2023.forEach(d => { if (d.zip_code) lookup2023[d.zip_code] = d; });
    const changes = distressData
      .filter(d => d.zip_code && d.exclude === 2 && d.distress_score != null && lookup2023[d.zip_code]?.distress_score != null)
      .map(d => ({ zip: d.zip_code, diff: d.distress_score - lookup2023[d.zip_code].distress_score }));
    const sorted = [...changes].sort((a, b) => a.diff - b.diff);
    // improved = map of zip → rank 1-5 (1 = most improved)
    const improved = {};
    sorted.slice(0, 5).forEach((z, i) => { improved[z.zip] = i + 1; });
    // declined = map of zip → rank 1-5 (1 = most declined)
    const declined = {};
    sorted.slice(-5).reverse().forEach((z, i) => { declined[z.zip] = i + 1; });
    return { improved, declined };
  }, [distressData, distressData2023]);

  // Note: distressLookup only includes exclude===2 zips, so exclude=0/1 get score 0 (no map color).
  // Info box data comes from distressDataLookup which includes all exclude levels.

  // Working poor data lookup: zip_code -> full working poor record (for popup table)
  const workingPoorDataLookup = useMemo(() => {
    const lookup = {};
    if (!workingPoorData) return lookup;
    workingPoorData.forEach((d) => {
      if (d.zip_code) {
        lookup[d.zip_code] = d;
      }
    });
    return lookup;
  }, [workingPoorData]);

  // Working poor data 2023 lookup: zip_code -> full 2023 working poor record (for YoY comparison)
  const workingPoorData2023Lookup = useMemo(() => {
    const lookup = {};
    if (!workingPoorData2023) return lookup;
    workingPoorData2023.forEach((d) => {
      if (d.zip_code) {
        lookup[d.zip_code] = d;
      }
    });
    return lookup;
  }, [workingPoorData2023]);

  // Working poor metro medians computed from working_poor_data (for comparison column)
  const workingPoorMedians = useMemo(() => computeWorkingPoorMedians(workingPoorData), [workingPoorData]);

  // Working poor score lookup for map coloring: zip_code -> working_poor_score (already in workingPoorLookup)
  // (No separate percentile lookup needed — using score directly for map coloring)

  // Evictions lookup: zip_code -> evictions_score (only exclude===2, for map coloring)
  const evictionsLookup = useMemo(() => {
    const lookup = {};
    if (!evictionsData) return lookup;
    evictionsData.forEach((d) => {
      if (d.zip_code && d.exclude === 2 && d.evictions_score != null) {
        lookup[d.zip_code] = Number(d.evictions_score);
      }
    });
    return lookup;
  }, [evictionsData]);

  // Evictions data lookup: zip_code -> full evictions record (for popup table)
  const evictionsDataLookup = useMemo(() => {
    const lookup = {};
    if (!evictionsData) return lookup;
    evictionsData.forEach((d) => {
      if (d.zip_code) {
        lookup[d.zip_code] = d;
      }
    });
    return lookup;
  }, [evictionsData]);

  // Evictions metro medians computed from evictions_data (for comparison column)
  const evictionsMedians = useMemo(() => computeEvictionsMedians(evictionsData), [evictionsData]);

  // Dynamic ranked counts — count of exclude===2 records in each dataset
  const distressRankedCount = useMemo(() => {
    if (!distressData) return 0;
    return distressData.filter(d => d.exclude === 2).length;
  }, [distressData]);

  const workingPoorRankedCount = useMemo(() => {
    if (!workingPoorData) return 0;
    return workingPoorData.filter(d => d.exclude === 2).length;
  }, [workingPoorData]);

  const evictionsRankedCount = useMemo(() => {
    if (!evictionsData) return 0;
    return evictionsData.filter(d => d.exclude === 2).length;
  }, [evictionsData]);

  // Dynamic thresholds for population (25th/75th percentile)
  const metricThresholds = useMemo(() => {
    const popValues = Object.values(populationLookup).filter(v => v > 0).sort((a, b) => a - b);

    const percentile = (arr, p) => {
      if (arr.length === 0) return 0;
      const idx = Math.floor(arr.length * p);
      return arr[Math.min(idx, arr.length - 1)];
    };

    return {
      population: {
        p25: percentile(popValues, 0.25),
        p75: percentile(popValues, 0.75),
      },
    };
  }, [populationLookup]);

  // Is the map in base view (clean metric) vs filter view (overlay + metric)?
  const isBaseView = viewMode !== "filter_view";

  // Which metric to display: in base view use viewMode, in filter view use activeBase
  const displayMetric = isBaseView ? viewMode : activeBase;

  // Memoized unified fill style - recomputed when viewMode, activeBase, thresholds, or YoY mode change
  const isDistressYoYActive = showDistressYoY && (isBaseView ? displayMetric === "distress" : activeBase === "distress");
  const unifiedFillStyle = useMemo(() => {
    return getUnifiedFillStyle(displayMetric, !isBaseView, metricThresholds, !isBaseView, isDistressYoYActive);
  }, [displayMetric, isBaseView, metricThresholds, isDistressYoYActive]);

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
            evictions_score: evictionsLookup[f.properties.ZCTA5CE20] ?? -1,
            yoy_improved_rank: distressYoYZips?.improved[f.properties.ZCTA5CE20] || 0,
            yoy_declined_rank: distressYoYZips?.declined[f.properties.ZCTA5CE20] || 0,
          },
        })),
    };
    return filtered;
  }, [allGeoJsonData, boundaryZips, parentCoverage, distressLookup, workingPoorLookup, populationLookup, evictionsLookup, distressYoYZips]);

  // Zip code -> feature id lookup
  const zipToFeatureId = useMemo(() => {
    if (!geoJsonData) return {};
    const lookup = {};
    geoJsonData.features.forEach((f) => {
      lookup[f.properties.ZCTA5CE20] = f.id;
    });
    return lookup;
  }, [geoJsonData]);

  // Clear child teal highlights
  const clearChildHighlights = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource("zip-boundaries")) return;

    childHighlightedRef.current.forEach((featureId) => {
      map.setFeatureState(
        { source: "zip-boundaries", id: featureId },
        { childHighlighted: false }
      );
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

        if (activeBase === "evictions" && clickedZip && evictionsDataLookup[clickedZip]) {
          setEvictionsTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null);
          setWorkingPoorTableZip(null);
          return;
        } else if (activeBase === "working_poor" && clickedZip && workingPoorDataLookup[clickedZip]) {
          setWorkingPoorTableZip(prev => prev === clickedZip ? null : clickedZip);
          setDistressTableZip(null);
          setEvictionsTableZip(null);
          return;
        } else if (clickedZip && distressDataLookup[clickedZip]) {
          setDistressTableZip(prev => prev === clickedZip ? null : clickedZip);
          setWorkingPoorTableZip(null);
          setEvictionsTableZip(null);
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
    if (zipCode) {
      setBaseHighlight(zipCode);
    }
  }, [clearChildHighlights, zipCode, setBaseHighlight, isBaseView, displayMetric, distressDataLookup, workingPoorDataLookup, evictionsDataLookup, activeBase]);

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

    if (isBaseView) {
      if (displayMetric === "distress" && distressDataLookup[zip]) {
        setDistressTableZip(zip);
      } else if (displayMetric === "working_poor" && workingPoorDataLookup[zip]) {
        setWorkingPoorTableZip(zip);
      } else if (displayMetric === "evictions" && evictionsDataLookup[zip]) {
        setEvictionsTableZip(zip);
      }
    } else {
      // Filter view — use activeBase
      if (activeBase === "evictions" && evictionsDataLookup[zip]) {
        setEvictionsTableZip(zip);
      } else if (activeBase === "working_poor" && workingPoorDataLookup[zip]) {
        setWorkingPoorTableZip(zip);
      } else if (distressDataLookup[zip]) {
        setDistressTableZip(zip);
      }
    }
  }, [zipCodes, isBaseView, displayMetric, activeBase, distressDataLookup, workingPoorDataLookup, evictionsDataLookup]);

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

  // Close distress data table on any view mode change
  useEffect(() => {
    setDistressTableZip(null);
  }, [viewMode]);

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
  const drawDistressTableOnCanvas = (ctx, data, data2023, zipCode, neighborhood, medians, containerEl) => {
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

    // Background (lighter for exclude=1)
    const bgColor = data.exclude === 1 ? "rgba(105, 100, 110, 0.95)" : "rgba(34, 40, 49, 0.95)";
    drawRoundedRect(ctx, x, y, w, h, 8, bgColor);
    ctx.textBaseline = "top";

    let cy = y + 10;

    // Header: "Zip Code XXXXX"
    ctx.font = "600 15px Lexend, sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    // Neighborhood (if present)
    if (neighborhood) {
      ctx.font = "400 10px Lexend, sans-serif";
      ctx.fillStyle = "#8FB6FF";
      ctx.fillText(truncateText(ctx, neighborhood, w - pad * 2), x + pad, cy);
      cy += 14;
    }

    // Banner for exclude=1 (small population)
    if (data.exclude === 1) {
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
      ctx.fillText("Small population — data shown for reference only", x + pad, cy);
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

    // Column headers: 2023 | 2024 | Houston*
    const col2023W = 60;
    const col2024W = 72;
    const colHoustonW = 60;
    const colHoustonX = x + w - pad - colHoustonW;
    const col2024X = colHoustonX - col2024W;
    const col2023X = col2024X - col2023W;

    ctx.font = "600 9px Lexend, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("2023", col2023X + col2023W, cy);
    ctx.fillText("2024", col2024X + col2024W, cy);
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
      // Row with highlight styling for distress score
      const rowPadY = highlight ? 6 : 3;
      cy += rowPadY;

      // Label
      ctx.font = highlight ? "600 12px Lexend, sans-serif" : "400 11px Lexend, sans-serif";
      ctx.fillStyle = highlight ? "#FFC857" : "#CCCCCC";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad, cy);

      // 2023 value
      ctx.textAlign = "right";
      const val2023 = data2023?.[key];
      ctx.font = highlight ? "600 13px Lexend, sans-serif" : "400 11px Lexend, sans-serif";
      ctx.fillStyle = "#999999";
      ctx.fillText(val2023 != null ? format(val2023) : "—", col2023X + col2023W, cy);

      // 2024 value (with distress band circle for highlight row)
      const formattedVal = isRank ? format(data[key], distressRankedCount) : format(data[key]);
      if (highlight) {
        // Draw distress band color circle
        const circleX = col2024X + col2024W - ctx.measureText(formattedVal).width - 18;
        ctx.fillStyle = getDistressBandColor(data.distress_score);
        ctx.beginPath();
        ctx.arc(circleX, cy + 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = highlight ? "700 14px Lexend, sans-serif" : "500 12px Lexend, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(formattedVal, col2024X + col2024W, cy);

      // Trend arrow on every row (direction = number movement, color = good/bad)
      const trend = getTrendArrow(key, data[key], val2023);
      if (trend) {
        ctx.font = "9px Lexend, sans-serif";
        ctx.fillStyle = trend.color;
        ctx.fillText(trend.arrow, col2024X + col2024W + 2, cy);
      }

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
  const drawWorkingPoorTableOnCanvas = (ctx, data, data2023, zipCode, neighborhood, medians, containerEl) => {
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

    // Background
    drawRoundedRect(ctx, x, y, w, h, 8, "rgba(34, 40, 49, 0.95)");
    ctx.textBaseline = "top";

    let cy = y + 10;

    // Header: "Zip Code XXXXX"
    ctx.font = "600 15px Lexend, sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    // Neighborhood (if present)
    if (neighborhood) {
      ctx.font = "400 10px Lexend, sans-serif";
      ctx.fillStyle = "#8FB6FF";
      ctx.fillText(truncateText(ctx, neighborhood, w - pad * 2), x + pad, cy);
      cy += 14;
    }

    // Header divider
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, cy);
    ctx.lineTo(x + w - pad, cy);
    ctx.stroke();
    cy += 8;

    // Column headers: 2023 | 2024 | Houston*
    const col2023W = 60;
    const col2024W = 72;
    const colHoustonW = 60;
    const colHoustonX = x + w - pad - colHoustonW;
    const col2024X = colHoustonX - col2024W;
    const col2023X = col2024X - col2023W;

    ctx.font = "600 9px Lexend, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("2023", col2023X + col2023W, cy);
    ctx.fillText("2024", col2024X + col2024W, cy);
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
      // Row with highlight styling for working poor score
      const rowPadY = highlight ? 6 : 3;
      cy += rowPadY;

      // Label
      ctx.font = highlight ? "600 12px Lexend, sans-serif" : "400 11px Lexend, sans-serif";
      ctx.fillStyle = highlight ? "#FFC857" : "#CCCCCC";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad, cy);

      // 2023 value
      ctx.textAlign = "right";
      const val2023 = data2023?.[key];
      ctx.font = highlight ? "600 13px Lexend, sans-serif" : "400 11px Lexend, sans-serif";
      ctx.fillStyle = "#999999";
      ctx.fillText(val2023 != null ? format(val2023) : "—", col2023X + col2023W, cy);

      // 2024 value (with working poor band circle for highlight row)
      const formattedVal = isRank ? format(data[key], workingPoorRankedCount) : format(data[key]);
      if (highlight) {
        // Draw working poor band color circle
        const circleX = col2024X + col2024W - ctx.measureText(formattedVal).width - 18;
        ctx.fillStyle = getWorkingPoorBandColor(data.working_poor_score);
        ctx.beginPath();
        ctx.arc(circleX, cy + 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = highlight ? "700 14px Lexend, sans-serif" : "500 12px Lexend, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(formattedVal, col2024X + col2024W, cy);

      // Trend arrow on every row (direction = number movement, color = good/bad)
      const trend = getTrendArrow(key, data[key], val2023);
      if (trend) {
        ctx.font = "9px Lexend, sans-serif";
        ctx.fillStyle = trend.color;
        ctx.fillText(trend.arrow, col2024X + col2024W + 2, cy);
      }

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

    const bgColor = data.exclude === 1 ? "rgba(105, 105, 118, 0.95)" : "rgba(34, 40, 49, 0.95)";
    drawRoundedRect(ctx, x, y, w, h, 8, bgColor);
    ctx.textBaseline = "top";

    let cy = y + 10;

    ctx.font = "600 15px Lexend, sans-serif";
    ctx.fillStyle = "#FFC857";
    ctx.fillText(`Zip Code ${zipCode}`, x + pad, cy);
    cy += 20;

    if (neighborhood) {
      ctx.font = "400 10px Lexend, sans-serif";
      ctx.fillStyle = "#8FB6FF";
      ctx.fillText(truncateText(ctx, neighborhood, w - pad * 2), x + pad, cy);
      cy += 14;
    }

    // Exclude=1 amber banner
    if (data.exclude === 1) {
      ctx.fillStyle = "rgba(255, 179, 2, 0.15)";
      ctx.fillRect(x, cy, w, 30);
      ctx.strokeStyle = "rgba(255, 179, 2, 0.25)";
      ctx.beginPath(); ctx.moveTo(x, cy + 30); ctx.lineTo(x + w, cy + 30); ctx.stroke();
      ctx.font = "500 10px Lexend, sans-serif";
      ctx.fillStyle = "#FFB302";
      ctx.textAlign = "left";
      ctx.fillText("Small population — data shown for reference only", x + pad, cy + 6);
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
    ctx.fillText("Zip", valCol1X + valColW, cy);
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

    if (data.exclude === 0) {
      // Exclude=0: no data available
      cy += 12;
      ctx.font = "italic 12px Lexend, sans-serif";
      ctx.fillStyle = "#888888";
      ctx.textAlign = "center";
      ctx.fillText("No data available", x + w / 2, cy);
      ctx.textAlign = "left";
      cy += 20;
    } else {
    EVICTIONS_FIELDS.forEach(({ key, label, format, highlight, showMedian, medianFormat, isRank }) => {
      // Skip score and rank rows for exclude=1
      if (data.exclude === 1 && (highlight || isRank)) return;

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
    } // end else (exclude !== 0)

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

    // Red pin circle + "Organization location"
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(x + pad + 5, cy + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "400 12px Lexend, sans-serif";
    ctx.fillStyle = "#444444";
    ctx.fillText("Organization location", x + pad + 18, cy);
    cy += 20;

    // Green pin circle + "Selected organization"
    ctx.fillStyle = "#00CC44";
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

    // Red pin + "Organization location"
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(x + pad + 5, cy + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "400 12px Lexend, sans-serif";
    ctx.fillStyle = "#444444";
    ctx.fillText("Organization location", x + pad + 18, cy);
    cy += 20;

    // Green pin + "Selected organization"
    ctx.fillStyle = "#00CC44";
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

    // Label
    ctx.font = "500 11px Lexend, sans-serif";
    ctx.fillStyle = "#444444";
    const labels = {
      distress: "Distress Score",
      working_poor: "Working Poor Score",
      evictions: "Evictions Score",
      population: "Population",
    };
    ctx.fillText(labels[mode] || "Distress Score", x + pad, cy);
    cy += 16;

    // Color bars
    const barW = w - pad * 2;
    const barH = 10;
    const colors = {
      distress: { colors: ["rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.40)", "rgba(245, 124, 0, 0.45)", "rgba(220, 50, 50, 0.55)"], weights: [3, 3, 3, 1] },
      working_poor: { colors: ["rgba(255, 205, 210, 0.45)", "rgba(239, 130, 130, 0.45)", "rgba(198, 40, 40, 0.50)", "rgba(100, 0, 0, 0.55)"], weights: [3, 3, 3, 1] },
      evictions: { colors: ["rgba(255, 224, 178, 0.45)", "rgba(245, 166, 35, 0.45)", "rgba(230, 100, 0, 0.50)", "rgba(150, 40, 0, 0.55)"], weights: [3, 3, 3, 1] },
      population: ["rgba(200, 170, 230, 0.45)", "rgba(128, 60, 170, 0.50)", "rgba(75, 0, 130, 0.55)"],
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
    if (mode === "distress" || mode === "working_poor" || mode === "evictions") {
      const scaleValues = ["0", "30", "60", "90", "100"];
      const positions = [0, 0.3, 0.6, 0.9, 1.0];
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
  const drawBaseLegendOnCanvas = (ctx, containerEl, mode) => {
    const { height } = containerEl.getBoundingClientRect();
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
    const labels = { distress: "Distress Score", working_poor: "Working Poor Score", evictions: "Evictions Score", population: "Population" };
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
      distress: { colors: ["rgba(76, 175, 80, 0.40)", "rgba(255, 213, 0, 0.40)", "rgba(245, 124, 0, 0.45)", "rgba(220, 50, 50, 0.55)"], weights: [3, 3, 3, 1] },
      working_poor: { colors: ["rgba(255, 205, 210, 0.45)", "rgba(239, 130, 130, 0.45)", "rgba(198, 40, 40, 0.50)", "rgba(100, 0, 0, 0.55)"], weights: [3, 3, 3, 1] },
      evictions: { colors: ["rgba(255, 224, 178, 0.45)", "rgba(245, 166, 35, 0.45)", "rgba(230, 100, 0, 0.50)", "rgba(150, 40, 0, 0.55)"], weights: [3, 3, 3, 1] },
      population: ["rgba(200, 170, 230, 0.45)", "rgba(128, 60, 170, 0.50)", "rgba(75, 0, 130, 0.55)"],
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
    if (mode === "distress" || mode === "working_poor" || mode === "evictions") {
      const scaleValues = ["0", "30", "60", "90", "100"];
      const positions = [0, 0.3, 0.6, 0.9, 1.0];
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
    const headColor = isActive ? "#00CC44" : "#ff0000";
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
      const baseMapLabels = { distress: "Distress Levels", working_poor: "Working Poor", evictions: "Evictions", population: "Population" };
      const baseMapTitle = `Base Map: ${baseMapLabels[displayMetric] || "Distress Levels"}`;
      ctx.font = "700 16px 'Open Sans', sans-serif";
      ctx.fillStyle = "#2E5A88";
      ctx.textBaseline = "top";
      ctx.fillText(baseMapTitle, 20, 14);

      // Step 4: Draw info box / distress table and legend directly on canvas (avoids dom-to-image border artifacts)
      drawInfoBoxOnCanvas(ctx, infoBoxData, container);
      if (distressTableZip) {
        const distressRecord = distressDataLookup[distressTableZip];
        const distressRecord2023 = distressData2023Lookup[distressTableZip];
        const neighborhood = zipCodes?.find(z => z.zip_code === distressTableZip)?.neighborhood || "";
        drawDistressTableOnCanvas(ctx, distressRecord, distressRecord2023, distressTableZip, neighborhood, houstonMedians, container);
      }
      if (workingPoorTableZip) {
        const wpRecord = workingPoorDataLookup[workingPoorTableZip];
        const wpRecord2023 = workingPoorData2023Lookup[workingPoorTableZip];
        const neighborhood = zipCodes?.find(z => z.zip_code === workingPoorTableZip)?.neighborhood || "";
        drawWorkingPoorTableOnCanvas(ctx, wpRecord, wpRecord2023, workingPoorTableZip, neighborhood, workingPoorMedians, container);
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
  }, [isDownloading, assistanceLabel, hasAssistance, orgPins, selectedOrgKey, showOrgLabels, infoBoxData, isDensityMode, parentCoverage, parentOrg, county, displayMetric, isBaseView, distressTableZip, distressDataLookup, distressData2023Lookup, houstonMedians, workingPoorTableZip, workingPoorDataLookup, workingPoorData2023Lookup, workingPoorMedians, evictionsTableZip, evictionsDataLookup, evictionsMedians, zipCodes]);

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
            {/* Unified fill: child teal > [parent coverage in filter view] > metric colors */}
            <Layer {...unifiedFillStyle} />
            <Layer {...boundaryLineStyle} />
            <Layer {...zipLabelStyle} />
          </Source>
        )}

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
        }}
      >
        {/* Base map title - plain text, no background */}
        <div
          style={{
            fontFamily: "'Open Sans', sans-serif",
            fontSize: "clamp(13px, 1.3vw, 20px)",
            fontWeight: 700,
            color: "#2E5A88",
            letterSpacing: "0.5px",
            userSelect: "none",
          }}
        >
          Base Map: {{ distress: "Distress Levels", working_poor: "Working Poor", evictions: "Evictions", population: "Population" }[displayMetric] || "Distress Levels"}
        </div>

        {/* View Mode dropdown */}
        {onViewModeChange && (
          <select
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value)}
            className="transition-all duration-200 hover:brightness-125"
            style={{
              height: "36px",
              padding: "0 12px",
              borderRadius: "6px",
              fontFamily: "'Open Sans', sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              backgroundColor: "rgba(34, 40, 49, 0.85)",
              color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,0.2)",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            <option value="filter_view">Filter View</option>
            <option value="distress">Distress</option>
            <option value="working_poor">Working Poor</option>
            <option value="evictions">Evictions</option>
            <option value="population">Population</option>
          </select>
        )}

        {/* YoY Change button - only when distress map is active */}
        {(isBaseView ? displayMetric === "distress" : activeBase === "distress") && (
          <button
            onClick={() => setShowDistressYoY(prev => !prev)}
            className="transition-all duration-200 hover:brightness-125"
            style={{
              height: "36px",
              padding: "0 14px",
              borderRadius: "6px",
              fontFamily: "'Open Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              backgroundColor: showDistressYoY ? "#005C72" : "rgba(34, 40, 49, 0.85)",
              color: showDistressYoY ? "#FFC857" : "#FFFFFF",
              border: showDistressYoY ? "1px solid #005C72" : "1px solid rgba(255,255,255,0.2)",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
              userSelect: "none",
            }}
          >
            Year over Year Change
          </button>
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
      {(isBaseView ? displayMetric === "distress" : activeBase === "distress") && distressTableZip && (
        <DraggableDistressTable
          data={distressDataLookup[distressTableZip]}
          data2023={distressData2023Lookup[distressTableZip]}
          zipCode={distressTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === distressTableZip)?.neighborhood || ""}
          houstonMedians={houstonMedians}
          rankedCount={distressRankedCount}
          onClose={() => setDistressTableZip(null)}
        />
      )}

      {/* Draggable distress YoY summary panel */}
      {(isBaseView ? displayMetric === "distress" : activeBase === "distress") && showDistressYoY && (
        <DraggableDistressYoY
          distressData={distressData}
          distressData2023={distressData2023}
          houstonMedians={houstonMedians}
          houstonMedians2023={houstonMedians2023}
          onClose={() => setShowDistressYoY(false)}
        />
      )}

      {/* Draggable working poor data table - in working poor base view or when activeBase is working_poor in filter view */}
      {(isBaseView ? displayMetric === "working_poor" : activeBase === "working_poor") && workingPoorTableZip && (
        <DraggableWorkingPoorTable
          data={workingPoorDataLookup[workingPoorTableZip]}
          data2023={workingPoorData2023Lookup[workingPoorTableZip]}
          zipCode={workingPoorTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === workingPoorTableZip)?.neighborhood || ""}
          houstonMedians={workingPoorMedians}
          rankedCount={workingPoorRankedCount}
          onClose={() => setWorkingPoorTableZip(null)}
        />
      )}

      {/* Draggable evictions data table - in evictions base view or when activeBase is evictions in filter view */}
      {(isBaseView ? displayMetric === "evictions" : activeBase === "evictions") && evictionsTableZip && (
        <DraggableEvictionsTable
          data={evictionsDataLookup[evictionsTableZip]}
          zipCode={evictionsTableZip}
          neighborhood={zipCodes?.find(z => z.zip_code === evictionsTableZip)?.neighborhood || ""}
          houstonMedians={evictionsMedians}
          rankedCount={evictionsRankedCount}
          onClose={() => setEvictionsTableZip(null)}
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
