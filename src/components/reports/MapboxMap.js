// src/components/reports/MapboxMap.js
// Interactive Mapbox map with three interaction modes:
// 1. No assistance selected → empty map with zip boundaries only
// 2. Assistance selected (no parent) → pins + click for teal zip highlights
// 3. Assistance + parent selected → purple density choropleth + pins + teal overlay on click
// Filters: assistance type, county, parent org, organization (status frozen to Active)

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
    "text-color": "#B8001F",
    "text-halo-color": "#FFFFFF",
    "text-halo-width": 1.5,
    "text-opacity": 0.8,
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

export default function MapboxMap({
  county,
  zipCode,
  parentOrg,
  organization,
  assistanceType,
}) {
  const { directory, assistance, zipCodes } = useAppData();
  const mapRef = useRef(null);

  // GeoJSON data for zip boundaries
  const [allGeoJsonData, setAllGeoJsonData] = useState(null);
  const [geoJsonLoading, setGeoJsonLoading] = useState(true);

  // Selected org for showing served zips (teal overlay)
  const [selectedOrgKey, setSelectedOrgKey] = useState(null);
  const [infoBoxData, setInfoBoxData] = useState(null);

  // Track highlighted zip codes (teal - individual child click)
  const childHighlightedRef = useRef(new Set());

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
  }, [clearChildHighlights]);

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

  // Close info box
  const handleInfoBoxClose = useCallback(() => {
    setInfoBoxData(null);
    setSelectedOrgKey(null);
    clearChildHighlights();
  }, [clearChildHighlights]);

  // Clear selection when any filter changes (density is data-driven, auto-updates)
  useEffect(() => {
    setInfoBoxData(null);
    setSelectedOrgKey(null);
    clearChildHighlights();
  }, [assistanceType, county, zipCode, parentOrg, organization, clearChildHighlights]);

  // Get assistance type label for display
  const assistanceLabel = useMemo(() => {
    if (!assistanceType || !assistance) return "";
    const match = assistance.find((a) => a.assistance === assistanceType);
    return match ? match.assistance : assistanceType;
  }, [assistanceType, assistance]);

  // Determine if we have an assistance type selected (required to show anything)
  const hasAssistance = Boolean(selectedAssistId);

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
    <div className="relative w-full h-full">
      <MapGL
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          ...HOUSTON_CENTER,
          zoom: DEFAULT_ZOOM,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
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
                style={{
                  transform: selectedOrgKey === org.key ? "scale(1.3)" : "scale(1)",
                  transition: "transform 0.15s ease",
                  transformOrigin: "bottom center",
                }}
              >
                <MapPinIcon
                  size={30}
                  active={selectedOrgKey === org.key}
                />
              </div>
            </Marker>
          ))}
      </MapGL>

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
}
