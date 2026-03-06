// src/components/reports/ZipCodeMap.js
// Interactive map showing zip code boundaries
// When assistance type selected, shows draggable org info boxes at each zip

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useAppData } from "../../Contexts/AppDataContext";
import { supabase } from "../../MainApp";

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const HOUSTON_CENTER = { lat: 29.76, lng: -95.37 };

const MAP_OPTIONS = {
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  zoomControl: true,
  styles: [
    { featureType: "all", elementType: "geometry", stylers: [{ saturation: -30 }] },
  ],
};

const BOUNDARY_STYLE = {
  fillColor: "#B8001F",
  fillOpacity: 0.25,
  strokeColor: "#B8001F",
  strokeWeight: 2,
  strokeOpacity: 0.8,
};

const BOUNDARY_HOVER_STYLE = {
  fillOpacity: 0.45,
  strokeWeight: 3,
};

function getFeatureCentroid(feature) {
  const geometry = feature.getGeometry();
  if (!geometry) return null;
  let totalLat = 0, totalLng = 0, count = 0;
  geometry.forEachLatLng((latLng) => {
    totalLat += latLng.lat();
    totalLng += latLng.lng();
    count++;
  });
  if (count === 0) return null;
  return { lat: totalLat / count, lng: totalLng / count };
}

// Convert lat/lng to pixel using map's projection
function latLngToPixel(map, latLng) {
  const projection = map.getProjection();
  const bounds = map.getBounds();
  if (!projection || !bounds) return null;

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const topRight = projection.fromLatLngToPoint(ne);
  const bottomLeft = projection.fromLatLngToPoint(sw);

  const point = projection.fromLatLngToPoint(
    new window.google.maps.LatLng(latLng.lat, latLng.lng)
  );

  const div = map.getDiv();
  const w = div.offsetWidth;
  const h = div.offsetHeight;
  const worldW = topRight.x - bottomLeft.x;
  const worldH = bottomLeft.y - topRight.y;

  return {
    x: ((point.x - bottomLeft.x) / worldW) * w,
    y: ((point.y - topRight.y) / worldH) * h,
  };
}

// Format dollar amount
function formatImpact(amount) {
  if (!amount) return null;
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return null;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

// External link icon (matches NavBar2)
function ExternalLinkIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// Draggable org info box component
function DraggableOrgBox({ zip, orgEntries, neighborhoods, zipLink, x, y, onDrag }) {
  const boxRef = useRef(null);
  const dragState = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: x,
      origY: y,
    };

    const handleMouseMove = (ev) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      onDrag(zip, dragState.current.origX + dx, dragState.current.origY + dy);
    };

    const handleMouseUp = () => {
      dragState.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const neighborhoodShort = neighborhoods && neighborhoods.length > 35
    ? neighborhoods.substring(0, 35) + "..."
    : neighborhoods || "";

  return (
    <div
      ref={boxRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        zIndex: 20,
        cursor: "grab",
        fontFamily: "Lexend, sans-serif",
        background: "rgba(34,40,49,0.93)",
        color: "white",
        padding: "7px 10px",
        borderRadius: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 400, marginBottom: 2, display: "flex", alignItems: "center", gap: 5 }}>
        {zip}
        {zipLink && (
          <a
            href={zipLink}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ color: "#8FB6FF", flexShrink: 0, lineHeight: 0 }}
          >
            <ExternalLinkIcon size={12} color="#8FB6FF" />
          </a>
        )}
      </div>
      {neighborhoodShort && (
        <div style={{ fontSize: 9, color: "#D7D5D1", marginBottom: 4 }}>{neighborhoodShort}</div>
      )}
      {orgEntries.map((entry, i) => (
        <div key={i} style={{ fontSize: 10, color: "#E8E8E8", padding: "1px 0", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>{entry.name}</span>
          {entry.impact && (
            <span style={{ color: "#FFC857", fontSize: 9 }}>{entry.impact}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ZipCodeMap({ povertyLevel, zipCode, assistanceType }) {
  const { directory, zipCodes, assistance } = useAppData();
  const [allGeoJson, setAllGeoJson] = useState(null);
  const mapRef = useRef(null);
  const dataLayerRef = useRef(null);
  const tooltipRef = useRef(null);
  const labelsRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Box positions: { [zip]: { x, y, dragged } }
  const [boxPositions, setBoxPositions] = useState({});
  const centroidsRef = useRef({});

  // Organizations impact lookup: parent_org_name -> impact amount
  const [impactLookup, setImpactLookup] = useState({});

  // Fetch organizations table for impact data
  // The organizations table has one row per child org, with impact from the parent's 990
  useEffect(() => {
    async function fetchImpact() {
      const { data, error } = await supabase
        .from("organizations")
        .select("organization, org_parent, impact");
      if (error) {
        console.error("Error fetching organizations impact:", error);
        return;
      }
      // Build lookup by org_parent -> impact (deduplicated)
      const lookup = {};
      (data || []).forEach((row) => {
        const parent = row.org_parent || row.organization;
        if (parent && row.impact && !lookup[parent]) {
          lookup[parent] = row.impact;
        }
      });
      setImpactLookup(lookup);
    }
    fetchImpact();
  }, []);

  const zipLookup = useMemo(() => {
    const map = {};
    zipCodes.forEach((z) => {
      if (z.houston_area === "Y") {
        map[z.zip_code] = { neighborhood: z.neighborhood, poverty_level: z.poverty_level, zip_link: z.zip_link };
      }
    });
    return map;
  }, [zipCodes]);

  const houstonZips = useMemo(() => new Set(Object.keys(zipLookup)), [zipLookup]);
  const povertyNum = povertyLevel ? Number.parseInt(povertyLevel.replace("Level ", ""), 10) : null;

  const activeZips = useMemo(() => {
    if (zipCode) return houstonZips.has(zipCode) ? new Set([zipCode]) : new Set();
    if (povertyNum != null) {
      return new Set(
        zipCodes.filter((z) => z.houston_area === "Y" && z.poverty_level === povertyNum).map((z) => z.zip_code)
      );
    }
    return new Set();
  }, [zipCode, povertyNum, zipCodes, houstonZips]);

  // Compute orgs for each active zip with impact from parent org (deduplicated)
  const orgsByZip = useMemo(() => {
    if (!assistanceType || activeZips.size === 0) return {};
    const assistMatch = assistance.find((a) => a.assistance === assistanceType);
    if (!assistMatch) return {};
    const assistId = assistMatch.assist_id;

    const result = {};
    activeZips.forEach((zip) => {
      const records = directory.filter((r) => r.status_id === 1 && r.assist_id === assistId && (r.client_zip_codes || []).includes(zip));
      records.sort((a, b) => (a.organization || "").localeCompare(b.organization || ""));
      if (records.length > 0) {
        // Track which parent orgs we've already shown impact for
        const seenParents = new Set();
        result[zip] = records.map((r) => {
          const parent = r.org_parent || r.organization;
          const rawImpact = impactLookup[parent];
          let impact = null;
          if (rawImpact && !seenParents.has(parent)) {
            seenParents.add(parent);
            impact = formatImpact(rawImpact);
          } else if (rawImpact) {
            // Already shown for this parent, skip duplicate
            seenParents.add(parent);
          }
          return { name: r.organization, impact };
        });
      }
    });
    return result;
  }, [assistanceType, activeZips, directory, assistance, impactLookup]);

  const zipsWithOrgs = useMemo(() => Object.keys(orgsByZip).sort((a, b) => a.localeCompare(b)), [orgsByZip]);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    fetch("/data/houston-zips.geojson").then((r) => r.json()).then(setAllGeoJson).catch(console.error);
  }, []);

  const onMapLoad = useCallback((map) => { mapRef.current = map; setMapLoaded(true); }, []);

  // Recompute non-dragged box positions from centroids
  const recomputePositions = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const newPositions = {};
    const div = map.getDiv();
    const centerX = div.offsetWidth / 2;
    const centerY = div.offsetHeight / 2;
    const SPREAD = 200; // pixels to push outward from center

    Object.entries(centroidsRef.current).forEach(([zip, centroid]) => {
      const px = latLngToPixel(map, centroid);
      if (px) {
        // Calculate direction from map center to this point
        const dx = px.x - centerX;
        const dy = px.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        // Offset outward from center
        const offsetX = (dx / dist) * SPREAD;
        const offsetY = (dy / dist) * SPREAD;
        newPositions[zip] = { x: px.x + offsetX, y: px.y + offsetY - 10, dragged: false };
      }
    });
    setBoxPositions((prev) => {
      const merged = { ...newPositions };
      // Preserve dragged positions
      Object.entries(prev).forEach(([zip, pos]) => {
        if (pos.dragged && merged[zip]) {
          merged[zip] = pos;
        }
      });
      return merged;
    });
  }, []);

  // Data layer effect
  useEffect(() => {
    if (!mapRef.current || !allGeoJson || !mapLoaded) return;
    const map = mapRef.current;

    if (dataLayerRef.current) dataLayerRef.current.setMap(null);
    if (tooltipRef.current) { tooltipRef.current.remove(); tooltipRef.current = null; }
    labelsRef.current.forEach((m) => m.setMap(null));
    labelsRef.current = [];

    if (activeZips.size === 0) {
      dataLayerRef.current = null;
      centroidsRef.current = {};
      setBoxPositions({});
      return;
    }

    const filteredGeoJson = {
      type: "FeatureCollection",
      features: allGeoJson.features.filter((f) =>
        activeZips.has(f.properties.ZCTA5CE20) && houstonZips.has(f.properties.ZCTA5CE20)
      ),
    };

    if (filteredGeoJson.features.length === 0) {
      dataLayerRef.current = null;
      centroidsRef.current = {};
      setBoxPositions({});
      return;
    }

    const dataLayer = new window.google.maps.Data({ map });
    dataLayer.addGeoJson(filteredGeoJson);
    dataLayer.setStyle(BOUNDARY_STYLE);

    // Compute centroids and add red zip code labels
    const centroids = {};
    dataLayer.forEach((feature) => {
      const zip = feature.getProperty("ZCTA5CE20");
      const c = getFeatureCentroid(feature);
      if (c) {
        centroids[zip] = c;

        const marker = new window.google.maps.Marker({
          position: c,
          map,
          label: {
            text: zip,
            fontSize: "11px",
            fontWeight: "700",
            color: "#B8001F",
            fontFamily: "Lexend, sans-serif",
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 0,
          },
          zIndex: 10,
        });
        labelsRef.current.push(marker);
      }
    });
    centroidsRef.current = centroids;

    // Fit bounds
    const bounds = new window.google.maps.LatLngBounds();
    dataLayer.forEach((feature) => {
      feature.getGeometry().forEachLatLng((ll) => bounds.extend(ll));
    });
    map.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });

    // Hover tooltip for neighborhoods
    const tooltipDiv = document.createElement("div");
    tooltipDiv.style.cssText = `
      position: absolute; display: none; pointer-events: none; z-index: 100;
      font-family: Lexend, sans-serif; background: rgba(34,40,49,0.95);
      color: white; padding: 8px 12px; border-radius: 6px; max-width: 280px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    map.getDiv().appendChild(tooltipDiv);
    tooltipRef.current = tooltipDiv;

    dataLayer.addListener("mouseover", (event) => {
      dataLayer.overrideStyle(event.feature, BOUNDARY_HOVER_STYLE);
      const zip = event.feature.getProperty("ZCTA5CE20");
      const info = zipLookup[zip];
      const neighborhoods = info?.neighborhood || "";
      tooltipDiv.innerHTML = `
        <div style="font-size:14px;font-weight:600;">${zip}</div>
        ${neighborhoods ? `<div style="font-size:11px;color:#D7D5D1;margin-top:3px;">${neighborhoods}</div>` : ""}
      `;
      tooltipDiv.style.display = "block";
    });

    dataLayer.addListener("mousemove", (event) => {
      if (!tooltipDiv || tooltipDiv.style.display === "none") return;
      const rect = map.getDiv().getBoundingClientRect();
      const de = event.domEvent || event.va || event;
      if (de?.clientX != null) {
        tooltipDiv.style.left = `${de.clientX - rect.left + 15}px`;
        tooltipDiv.style.top = `${de.clientY - rect.top - 10}px`;
      }
    });

    dataLayer.addListener("mouseout", (event) => {
      dataLayer.revertStyle(event.feature);
      tooltipDiv.style.display = "none";
    });

    dataLayerRef.current = dataLayer;

    // Compute initial positions after map settles
    const idleListener = map.addListener("idle", () => {
      recomputePositions();
    });

    return () => {
      dataLayer.setMap(null);
      labelsRef.current.forEach((m) => m.setMap(null));
      labelsRef.current = [];
      if (tooltipDiv.parentNode) tooltipDiv.remove();
      window.google.maps.event.removeListener(idleListener);
    };
  }, [allGeoJson, activeZips, mapLoaded, zipLookup, houstonZips, recomputePositions]);

  // Recompute positions on map pan/zoom (for non-dragged boxes)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const listener = mapRef.current.addListener("idle", recomputePositions);
    return () => window.google.maps.event.removeListener(listener);
  }, [mapLoaded, recomputePositions]);

  // Reset dragged state when orgsByZip changes (new assistance type)
  const prevOrgsByZipRef = useRef(orgsByZip);
  useEffect(() => {
    if (prevOrgsByZipRef.current !== orgsByZip) {
      prevOrgsByZipRef.current = orgsByZip;
      setBoxPositions((prev) => {
        const reset = {};
        Object.entries(prev).forEach(([zip, pos]) => {
          reset[zip] = { ...pos, dragged: false };
        });
        return reset;
      });
      recomputePositions();
    }
  }, [orgsByZip, recomputePositions]);

  const handleDrag = useCallback((zip, x, y) => {
    setBoxPositions((prev) => ({ ...prev, [zip]: { x, y, dragged: true } }));
  }, []);

  if (loadError) return <div className="p-8 text-red-600">Error loading Google Maps</div>;
  if (!isLoaded) return <div className="p-8 text-gray-600">Loading map...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={HOUSTON_CENTER}
          zoom={10}
          options={MAP_OPTIONS}
          onLoad={onMapLoad}
        />

        {/* Draggable org info boxes */}
        {zipsWithOrgs.map((zip) => {
          const pos = boxPositions[zip];
          if (!pos) return null;
          const entries = orgsByZip[zip];
          const info = zipLookup[zip];
          return (
            <DraggableOrgBox
              key={zip}
              zip={zip}
              orgEntries={entries}
              neighborhoods={info?.neighborhood || ""}
              zipLink={info?.zip_link || ""}
              x={pos.x}
              y={pos.y}
              onDrag={handleDrag}
            />
          );
        })}

        {/* Legend */}
        {activeZips.size > 0 && (
          <div
            className="absolute bottom-4 left-4 rounded shadow-lg"
            style={{
              backgroundColor: "rgba(255,255,255,0.95)",
              padding: "10px 14px",
              fontSize: "12px",
              fontFamily: "Lexend, sans-serif",
              zIndex: 10,
            }}
          >
            <div className="font-semibold mb-1" style={{ color: "#222831" }}>
              {povertyLevel ? `Poverty ${povertyLevel}` : `Zip Code: ${zipCode}`}
            </div>
            <div className="flex items-center gap-2">
              <div style={{ width: 18, height: 12, backgroundColor: "#B8001F", opacity: 0.4, border: "2px solid #B8001F", borderRadius: 2 }} />
              <span style={{ color: "#666" }}>
                {activeZips.size} zip code{activeZips.size !== 1 ? "s" : ""}
              </span>
            </div>
            {assistanceType && (
              <div className="mt-1" style={{ color: "#005C72", fontWeight: 500 }}>
                {assistanceType} &middot; drag boxes to reposition
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {activeZips.size === 0 && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 rounded shadow-lg"
            style={{
              backgroundColor: "rgba(255,255,255,0.95)",
              padding: "12px 20px",
              fontSize: "14px",
              fontFamily: "Lexend, sans-serif",
              color: "#666",
              zIndex: 10,
            }}
          >
            Select a Poverty Level or Zip Code to view boundaries
          </div>
        )}
      </div>
    </div>
  );
}
