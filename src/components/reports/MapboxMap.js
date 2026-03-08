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

// Density gradient - purple shades for coverage intensity
// 1 child = lightest, 4+ = deepest
const DENSITY_COLORS = {
  1: "rgba(180, 130, 200, 0.30)", // light purple
  2: "rgba(140, 80, 170, 0.42)",  // medium purple
  3: "rgba(110, 40, 150, 0.54)",  // darker purple
  4: "rgba(80, 10, 130, 0.66)",   // deepest purple
};

function getDensityColor(count) {
  if (count >= 4) return DENSITY_COLORS[4];
  return DENSITY_COLORS[count] || "transparent";
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

// Zip code boundary layer styles - base boundaries (no density)
const boundaryFillStyle = {
  id: "zip-boundaries-fill",
  type: "fill",
  paint: {
    "fill-color": [
      "case",
      ["boolean", ["feature-state", "childHighlighted"], false],
      "#00A8A8",
      ["boolean", ["feature-state", "highlighted"], false],
      "#00A8A8",
      ["boolean", ["feature-state", "hovered"], false],
      "#B8001F",
      "transparent",
    ],
    "fill-opacity": [
      "case",
      ["boolean", ["feature-state", "childHighlighted"], false],
      0.45,
      ["boolean", ["feature-state", "highlighted"], false],
      0.35,
      ["boolean", ["feature-state", "hovered"], false],
      0.15,
      0,
    ],
  },
};

// Density fill layer - reads density from GeoJSON properties (not feature-state)
const densityFillStyle = {
  id: "density-fill",
  type: "fill",
  paint: {
    "fill-color": [
      "case",
      [">=", ["coalesce", ["get", "density"], 0], 4],
      DENSITY_COLORS[4],
      [">=", ["coalesce", ["get", "density"], 0], 3],
      DENSITY_COLORS[3],
      [">=", ["coalesce", ["get", "density"], 0], 2],
      DENSITY_COLORS[2],
      [">=", ["coalesce", ["get", "density"], 0], 1],
      DENSITY_COLORS[1],
      "transparent",
    ],
    "fill-opacity": 1,
  },
};

const boundaryLineStyle = {
  id: "zip-boundaries-line",
  type: "line",
  paint: {
    "line-color": [
      "case",
      ["boolean", ["feature-state", "childHighlighted"], false],
      "#00A8A8",
      ["boolean", ["feature-state", "highlighted"], false],
      "#00A8A8",
      "#B8001F",
    ],
    "line-width": [
      "case",
      ["boolean", ["feature-state", "childHighlighted"], false],
      3,
      ["boolean", ["feature-state", "highlighted"], false],
      3,
      1.5,
    ],
    "line-opacity": 0.7,
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

// Gradient legend component for density mode
function DensityLegend({ maxDensity, parentOrgName, assistanceLabel, orgCount, county, outOfAreaOrgs, onOutOfAreaToggle }) {
  // Build gradient steps based on actual max
  const steps = [];
  const displayMax = Math.min(maxDensity, 4);
  for (let i = 1; i <= displayMax; i++) {
    steps.push({ count: i, color: getDensityColor(i) });
  }

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

      {/* Density gradient bar */}
      <div style={{ marginBottom: "6px", color: "#444", fontWeight: 500, fontSize: "11px" }}>
        Coverage density
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "2px", marginBottom: "4px" }}>
        {steps.map((s) => (
          <div
            key={s.count}
            style={{
              flex: 1,
              height: "14px",
              backgroundColor: s.color,
              borderRadius: s.count === 1 ? "3px 0 0 3px" : s.count === displayMax ? "0 3px 3px 0" : "0",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#666" }}>
        <span>1 org</span>
        <span>{maxDensity >= 4 ? "4+" : maxDensity} orgs</span>
      </div>

      {/* Pin legend */}
      <div style={{ marginTop: "10px", borderTop: "1px solid #E0E0E0", paddingTop: "8px" }}>
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
              opacity: 0.6,
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

      <OutOfAreaSection outOfAreaOrgs={outOfAreaOrgs} onExpandChange={onOutOfAreaToggle} />
    </div>
  );
}

// Simple legend for non-density mode (assistance selected, no parent)
function SimpleLegend({ assistanceLabel, orgCount, county, outOfAreaOrgs, onOutOfAreaToggle }) {
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
}, ref) {
  const { directory, assistance, zipCodes } = useAppData();
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

  // Compute density data: zip -> count of children serving it
  // For 99999 orgs, they count toward every displayed boundary zip
  const densityData = useMemo(() => {
    if (!isDensityMode) return { zipCounts: {}, maxDensity: 0 };

    const zipCounts = {};
    const zipChildSets = {};

    filteredOrgs.forEach((r) => {
      const clientZips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      const isWildcard = clientZips.includes("99999");

      // For wildcard orgs, count them against every boundary zip
      const zipsToCount = isWildcard ? [...boundaryZips] : clientZips;

      zipsToCount.forEach((zip) => {
        if (!zipChildSets[zip]) zipChildSets[zip] = new Set();
        zipChildSets[zip].add(r.organization);
      });
    });

    let maxDensity = 0;
    Object.entries(zipChildSets).forEach(([zip, children]) => {
      const count = children.size;
      zipCounts[zip] = count;
      if (count > maxDensity) maxDensity = count;
    });

    return { zipCounts, maxDensity };
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

  // Filter GeoJSON by county + inject density into feature properties
  const geoJsonData = useMemo(() => {
    if (!allGeoJsonData) return null;
    const { zipCounts } = densityData;
    const filtered = {
      ...allGeoJsonData,
      features: allGeoJsonData.features
        .filter((f) => boundaryZips.has(f.properties.ZCTA5CE20))
        .map((f, i) => ({
          ...f,
          id: i,
          properties: {
            ...f.properties,
            density: zipCounts[f.properties.ZCTA5CE20] || 0,
          },
        })),
    };
    return filtered;
  }, [allGeoJsonData, boundaryZips, densityData]);

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
    [highlightChildZips, boundaryZips]
  );

  // Handle clicking empty map area
  const handleMapClick = useCallback(() => {
    // In density mode, only clear the child highlight, keep density
    clearChildHighlights();
    setInfoBoxData(null);
    setSelectedOrgKey(null);
    // Restore base zip highlight if a zip filter is active
    if (zipCode) {
      setBaseHighlight(zipCode);
    }
  }, [clearChildHighlights, zipCode, setBaseHighlight]);

  // Handle boundary hover
  const handleMouseMove = useCallback((e) => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getLayer("zip-boundaries-fill")) return;

    const features = map.queryRenderedFeatures(e.point, {
      layers: ["zip-boundaries-fill"],
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

  // Close info box - clear pin highlights but restore base zip highlight
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

  // Draw a simple legend directly on canvas
  const drawSimpleLegendOnCanvas = (ctx, label, count, countyName, containerEl) => {
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
  };

  // Draw a density legend directly on canvas
  const drawDensityLegendOnCanvas = (ctx, label, parentName, count, maxDens, countyName, containerEl) => {
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

    // "Coverage density"
    ctx.font = "500 11px Lexend, sans-serif";
    ctx.fillStyle = "#444444";
    ctx.fillText("Coverage density", x + pad, cy);
    cy += 18;

    // Gradient bar
    const barW = w - pad * 2;
    const barH = 14;
    const steps = Math.min(maxDens, 4);
    const stepW = barW / steps;
    for (let i = 1; i <= steps; i++) {
      ctx.fillStyle = getDensityColor(i);
      const bx = x + pad + (i - 1) * stepW;
      const r = i === 1 ? 3 : i === steps ? 3 : 0;
      ctx.fillRect(bx, cy, stepW, barH);
    }
    cy += barH + 4;

    // Bar labels
    ctx.font = "400 10px Lexend, sans-serif";
    ctx.fillStyle = "#666666";
    ctx.fillText("1 org", x + pad, cy);
    const maxLabel = maxDens >= 4 ? "4+ orgs" : `${maxDens} orgs`;
    const maxLabelW = ctx.measureText(maxLabel).width;
    ctx.fillText(maxLabel, x + w - pad - maxLabelW, cy);
    cy += 18;

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
    ctx.fillStyle = "rgba(0, 168, 168, 0.6)";
    ctx.fillRect(x + pad + 1, cy + 2, 10, 10);
    ctx.fillStyle = "#444444";
    ctx.fillText("Selected org's zips", x + pad + 18, cy);
    cy += 22;

    // County
    if (countyName && countyName !== "All Counties") {
      ctx.font = "400 11px Lexend, sans-serif";
      ctx.fillStyle = "#888888";
      ctx.fillText(`${countyName} County`, x + pad, cy);
    }
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

      // Step 3: Draw info box and legend directly on canvas (avoids dom-to-image border artifacts)
      drawInfoBoxOnCanvas(ctx, infoBoxData, container);

      if (isDensityMode && densityData.maxDensity > 0) {
        drawDensityLegendOnCanvas(ctx, assistanceLabel, parentOrg, orgPins.length, densityData.maxDensity, county, container);
      } else if (hasAssistance) {
        drawSimpleLegendOnCanvas(ctx, assistanceLabel, orgPins.length, county, container);
      }

      // Step 4: Download
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
  }, [isDownloading, assistanceLabel, hasAssistance, orgPins, selectedOrgKey, showOrgLabels, infoBoxData, isDensityMode, densityData, parentOrg, county]);

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
            {/* Density fill layer - rendered below the interactive layer */}
            <Layer {...densityFillStyle} />
            {/* Interactive fill (teal for child selection, hover) */}
            <Layer {...boundaryFillStyle} />
            <Layer {...boundaryLineStyle} />
            <Layer {...zipLabelStyle} />
          </Source>
        )}

        {/* Organization pin markers - only when assistance is selected */}
        {hasAssistance &&
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

      {/* Zoom-gated Org Labels toggle button (draggable, starts centered) */}
      {hasAssistance && currentZoom >= ORG_LABEL_ZOOM_THRESHOLD && (
        <button
          data-org-label-btn="true"
          onMouseDown={(e) => {
            e.preventDefault();
            const btn = e.currentTarget;
            const rect = btn.getBoundingClientRect();
            orgLabelBtnDrag.current = {
              isDragging: false,
              moved: false,
              startMouseX: e.clientX,
              startMouseY: e.clientY,
              startBtnX: rect.left,
              startBtnY: rect.top,
            };
            const containerRect = mapContainerRef.current.getBoundingClientRect();

            const onMove = (ev) => {
              const dx = ev.clientX - orgLabelBtnDrag.current.startMouseX;
              const dy = ev.clientY - orgLabelBtnDrag.current.startMouseY;
              if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                orgLabelBtnDrag.current.moved = true;
              }
              if (orgLabelBtnDrag.current.moved) {
                setOrgLabelBtnPos({
                  x: orgLabelBtnDrag.current.startBtnX + dx - containerRect.left,
                  y: orgLabelBtnDrag.current.startBtnY + dy - containerRect.top,
                });
              }
            };
            const onUp = () => {
              if (!orgLabelBtnDrag.current.moved) {
                setShowOrgLabels((prev) => !prev);
              }
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          style={{
            position: "absolute",
            ...(orgLabelBtnPos
              ? { top: `${orgLabelBtnPos.y}px`, left: `${orgLabelBtnPos.x}px` }
              : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
            zIndex: 20,
            backgroundColor: showOrgLabels ? "#005C72" : "#222831",
            color: "#FFFFFF",
            border: showOrgLabels ? "1px solid #005C72" : "1px solid #222831",
            borderRadius: "6px",
            padding: "8px 16px",
            fontSize: "13px",
            fontFamily: "Lexend, sans-serif",
            fontWeight: 500,
            cursor: "grab",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            userSelect: "none",
          }}
        >
          {showOrgLabels ? "Hide Org Labels" : "Show Org Labels"}
        </button>
      )}

      {/* Draggable info box */}
      <DraggableInfoBox info={infoBoxData} onClose={handleInfoBoxClose} />

      {/* Density legend (parent org mode) */}
      {isDensityMode && densityData.maxDensity > 0 && (
        <DensityLegend
          maxDensity={densityData.maxDensity}
          parentOrgName={parentOrg}
          assistanceLabel={assistanceLabel}
          orgCount={orgPins.length}
          county={county}
          outOfAreaOrgs={outOfAreaOrgs}
          onOutOfAreaToggle={handleOutOfAreaToggle}
        />
      )}

      {/* Simple legend (assistance selected, no parent) */}
      {hasAssistance && !isDensityMode && (
        <SimpleLegend
          assistanceLabel={assistanceLabel}
          orgCount={orgPins.length}
          county={county}
          outOfAreaOrgs={outOfAreaOrgs}
          onOutOfAreaToggle={handleOutOfAreaToggle}
        />
      )}

      {/* No assistance selected - empty map, no message */}
    </div>
  );
});

export default MapboxMap;
