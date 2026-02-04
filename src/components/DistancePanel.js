// src/components/DistancePanel.js
// Panel for entering client address to override zip code centroid for distance calculations
// Uses DropPanel for consistent styling

import { useState, useEffect } from "react";
import DropPanel from "./DropPanel";
import { geocodeAddress } from "../services/geocodeService";

/**
 * Validate coordinates format: "lat, lng" where both are valid numbers
 * Latitude: -90 to 90
 * Longitude: -180 to 180
 */
function validateCoordinates(coordString) {
  if (!coordString || typeof coordString !== "string") return false;
  
  const parts = coordString.split(",").map(s => s.trim());
  if (parts.length !== 2) return false;
  
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  
  return true;
}

/**
 * Format coordinates for DISPLAY only (4 decimal places)
 * Used in the input field for cleaner UI
 */
function formatCoordinatesForDisplay(coordString) {
  if (!coordString) return "";
  
  const parts = coordString.split(",").map(s => s.trim());
  if (parts.length !== 2) return coordString;
  
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  
  if (isNaN(lat) || isNaN(lng)) return coordString;
  
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * Normalize coordinates string (trim whitespace, ensure consistent format)
 * Keeps full precision for calculations
 */
function normalizeCoordinates(coordString) {
  if (!coordString) return "";
  
  const parts = coordString.split(",").map(s => s.trim());
  if (parts.length !== 2) return coordString;
  
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  
  if (isNaN(lat) || isNaN(lng)) return coordString;
  
  // Return with full precision
  return `${lat}, ${lng}`;
}

/**
 * DistancePanel - Panel for entering client location
 * 
 * @param {boolean} isOpen - Whether panel is visible
 * @param {function} onCancel - Cancel handler (reverts to previous state)
 * @param {function} onSave - Save handler (applies new coordinates)
 * @param {React.Ref} panelRef - Ref for click-outside detection
 * @param {string} defaultCoordinates - Zip code centroid coordinates
 * @param {string} currentAddress - Currently saved address (if any)
 * @param {string} currentCoordinates - Currently saved coordinates (if any)
 */
export default function DistancePanel({
  isOpen,
  onCancel,
  onSave,
  panelRef,
  defaultCoordinates = "",
  currentAddress = "",
  currentCoordinates = "",
}) {
  // Temp state while panel is open
  const [tempAddress, setTempAddress] = useState("");
  const [tempCoordinates, setTempCoordinates] = useState("");
  const [coordsError, setCoordsError] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");

  // Track if address has been geocoded (to know if we need to geocode on OK)
  const [addressGeocoded, setAddressGeocoded] = useState(false);
  const [lastGeocodedAddress, setLastGeocodedAddress] = useState("");

  // Reset temp state when panel opens
  useEffect(() => {
    if (isOpen) {
      // If there's a saved address/coordinates, use those; otherwise use default centroid
      setTempAddress(currentAddress || "");
      // Display with 4 decimal places, but store full precision internally
      setTempCoordinates(
        currentCoordinates 
          ? formatCoordinatesForDisplay(currentCoordinates)
          : formatCoordinatesForDisplay(defaultCoordinates) || ""
      );
      setCoordsError(false);
      setGeocodeError("");
      setAddressGeocoded(!!currentAddress);
      setLastGeocodedAddress(currentAddress || "");
    }
  }, [isOpen, currentAddress, currentCoordinates, defaultCoordinates]);

  // Handle address change - clear geocode error and mark as not geocoded
  const handleAddressChange = (value) => {
    setTempAddress(value);
    setGeocodeError("");
    // Mark as not geocoded if address changed
    if (value !== lastGeocodedAddress) {
      setAddressGeocoded(false);
    }
  };

  // Handle coordinates change with validation
  const handleCoordsChange = (value) => {
    setTempCoordinates(value);
    setGeocodeError("");
    // Only show error if field is not empty and invalid
    if (value.trim() !== "") {
      setCoordsError(!validateCoordinates(value));
    } else {
      setCoordsError(false);
    }
  };

  // Handle geocoding when user finishes entering address (on blur or Enter key)
  const handleGeocodeAddress = async () => {
    const address = tempAddress.trim();
    
    // Don't geocode if address is empty or too short
    if (!address || address.length < 5) {
      return;
    }

    // Don't geocode if already geocoded this address
    if (address === lastGeocodedAddress && addressGeocoded) {
      return;
    }

    setIsGeocoding(true);
    setGeocodeError("");
    setCoordsError(false);

    try {
      const result = await geocodeAddress(address);

      if (result.success) {
        // Update coordinates with full precision, display with 4 decimals
        setTempCoordinates(formatCoordinatesForDisplay(result.coordinates));
        setAddressGeocoded(true);
        setLastGeocodedAddress(address);
        // Optionally update address to formatted version
        // setTempAddress(result.formattedAddress);
      } else {
        setGeocodeError(result.message || "Could not find address");
        setAddressGeocoded(false);
      }
    } catch (error) {
      setGeocodeError("Geocoding service unavailable");
      setAddressGeocoded(false);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Handle Enter key in address field
  const handleAddressKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGeocodeAddress();
    }
  };

  // Handle save - geocode if needed, validate, then save and close
  const handleSave = async () => {
    const address = tempAddress.trim();
    
    // If there's an address that hasn't been geocoded yet, geocode it first
    if (address && address.length >= 5 && !addressGeocoded && address !== lastGeocodedAddress) {
      setIsGeocoding(true);
      setGeocodeError("");
      setCoordsError(false);

      try {
        const result = await geocodeAddress(address);

        if (result.success) {
          // Geocoding succeeded - save with new coordinates and close
          onSave({
            address: address,
            coordinates: result.coordinates, // Full precision
          });
          return;
        } else {
          // Geocoding failed - show error, don't close
          setGeocodeError(result.message || "Could not find address");
          setIsGeocoding(false);
          return;
        }
      } catch (error) {
        setGeocodeError("Geocoding service unavailable");
        setIsGeocoding(false);
        return;
      }
    }

    // Validate coordinates
    if (tempCoordinates.trim() !== "" && !validateCoordinates(tempCoordinates)) {
      setCoordsError(true);
      return;
    }
    
    // Pass normalized coordinates (full precision) for calculations
    onSave({
      address: address,
      coordinates: normalizeCoordinates(tempCoordinates),
    });
  };

  // Handle cancel - just close, parent will revert state
  const handleCancel = () => {
    onCancel();
  };

  // Handle clear - reset both fields and save immediately to revert to centroid
  const handleClear = () => {
    // Save empty values to revert to default (zip centroid, Haversine distances)
    onSave({
      address: "",
      coordinates: "",
    });
  };

  return (
    <DropPanel
      title="Enter Start Address"
      isOpen={isOpen}
      onCancel={handleCancel}
      onSave={handleSave}
      onClear={handleClear}
      clearButtonText="Clear"
      panelRef={panelRef}
      style={{
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      <div className="flex flex-col gap-4" style={{ minWidth: "420px" }}>
        {/* Address Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Enter Address"
            value={tempAddress}
            onChange={(e) => handleAddressChange(e.target.value)}
            onBlur={handleGeocodeAddress}
            onKeyDown={handleAddressKeyDown}
            disabled={isGeocoding}
            className="font-opensans transition-all duration-200 w-full"
            style={{
              backgroundColor: "white",
              color: "black",
              padding: "12px 16px",
              paddingRight: isGeocoding ? "40px" : "16px",
              borderRadius: "var(--radius-panel-btn)",
              fontSize: "16px",
              border: geocodeError ? "2px solid #cc0000" : "none",
              outline: "none",
              opacity: isGeocoding ? 0.7 : 1,
            }}
          />
          {/* Loading spinner */}
          {isGeocoding && (
            <div 
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ width: "20px", height: "20px" }}
            >
              <svg 
                className="animate-spin" 
                viewBox="0 0 24 24" 
                fill="none"
                style={{ width: "100%", height: "100%" }}
              >
                <circle 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="#ccc" 
                  strokeWidth="3"
                  fill="none"
                />
                <path 
                  d="M12 2a10 10 0 0 1 10 10" 
                  stroke="#666" 
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Geocode error message */}
        {geocodeError && (
          <p 
            className="font-opensans text-center"
            style={{ 
              color: "#cc0000", 
              fontSize: "12px",
              marginTop: "-8px"
            }}
          >
            {geocodeError}
          </p>
        )}

        {/* Coordinates Field - gray background, no visual cue it's editable */}
        <input
          type="text"
          placeholder="Coordinates"
          value={tempCoordinates}
          onChange={(e) => handleCoordsChange(e.target.value)}
          disabled={isGeocoding}
          className="font-opensans transition-all duration-200"
          style={{
            backgroundColor: coordsError ? "#ffcccc" : "#d1d5db", // Red tint if error, otherwise gray
            color: coordsError ? "#cc0000" : "#374151",
            padding: "12px 16px",
            borderRadius: "var(--radius-panel-btn)",
            fontSize: "16px",
            border: coordsError ? "2px solid #cc0000" : "none",
            outline: "none",
            opacity: isGeocoding ? 0.7 : 1,
          }}
        />
        
        {/* Coordinates error message */}
        {coordsError && (
          <p
            className="font-opensans text-center"
            style={{
              color: "#cc0000",
              fontSize: "12px",
              marginTop: "-8px"
            }}
          >
            Invalid format. Use: latitude, longitude (e.g., 29.7604, -95.3698)
          </p>
        )}

        {/* Footnote about distance calculation */}
        <p
          className="font-opensans text-center italic"
          style={{
            color: "#D7D5D1",
            fontSize: "16px",
            marginTop: "4px"
          }}
        >
          Enter an address to calculate driving distances for filtered results.
        </p>
      </div>
    </DropPanel>
  );
}