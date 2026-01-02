// src/components/ZipCodeSearch.js
import React, { useEffect, useMemo, useState } from "react";
import { useTranslate } from "../Utility/Translate";
import { supabase } from "../MainApp";
import { ArrowRight } from "lucide-react";

export default function ZipCodeSearch({ 
  zips = [], 
  selectedZip = "", 
  setSelectedZip,
  zipDefaultCoordinates = "",
  overrideCoordinates = "",
  onCoordinateOverride
}) {
  const { translate } = useTranslate();

  const [neighborhood, setNeighborhood] = useState("");
  const [neighborhoodLink, setNeighborhoodLink] = useState("");
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [coordinateInput, setCoordinateInput] = useState("");
  const [autoCloseTimeout, setAutoCloseTimeout] = useState(null);

  const zipArray = useMemo(() => {
    if (!Array.isArray(zips)) return [];

    return zips
      .map(zip => {
        const zipCode = typeof zip === "object" ? zip.zip_code : zip;
        return { zip_code: zipCode.trim() };
      })
      .sort((a, b) => a.zip_code.localeCompare(b.zip_code));
  }, [zips]);

  // Update coordinate input when override coordinates change
  useEffect(() => {
    setCoordinateInput(overrideCoordinates || zipDefaultCoordinates);
  }, [overrideCoordinates, zipDefaultCoordinates]);

  // Auto-close coordinates field after inactivity
  useEffect(() => {
    if (showCoordinates) {
      // Clear any existing timeout
      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
      }
      
      // Set new timeout to auto-close after 5 seconds of inactivity
      const timeout = setTimeout(() => {
        setShowCoordinates(false);
      }, 5000);
      
      setAutoCloseTimeout(timeout);
    }
    
    // Cleanup timeout on component unmount or when coordinates are hidden
    return () => {
      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
      }
    };
  }, [showCoordinates, autoCloseTimeout]);

  const handleChange = async (e) => {
    const zip = e.target.value;
    setSelectedZip(zip);

    // Fetch neighborhood data
    const { data, error } = await supabase
      .from("zip_codes")
      .select("org_county_city_neighborhood, neighborhood_link")
      .eq("zip_code", zip)
      .single();

    if (error) {
      console.error("Failed to fetch neighborhood info:", error);
      setNeighborhood("");
      setNeighborhoodLink("");
    } else {
      setNeighborhood(data.org_county_city_neighborhood);
      setNeighborhoodLink(data.neighborhood_link);
    }
  };

  const handleCoordinateClick = () => {
    setShowCoordinates(!showCoordinates);
    
    // If opening the coordinates field, clear any auto-close timeout
    if (!showCoordinates && autoCloseTimeout) {
      clearTimeout(autoCloseTimeout);
      setAutoCloseTimeout(null);
    }
  };

  const handleCoordinateInputChange = (e) => {
    const value = e.target.value;
    setCoordinateInput(value);
    
    // Reset auto-close timer when user is typing
    if (autoCloseTimeout) {
      clearTimeout(autoCloseTimeout);
      setAutoCloseTimeout(null);
    }
  };

  const handleCoordinateSubmit = (e) => {
    if (e.key === 'Enter') {
      // Clear the input field and trigger the override
      setCoordinateInput('');
      onCoordinateOverride(coordinateInput);
      
      // Wait a beat, then close the coordinates field
      setTimeout(() => {
        setShowCoordinates(false);
      }, 100);
    }
  };

  const handleCoordinateBlur = () => {
    // Apply coordinates when field loses focus (if not empty)
    if (coordinateInput.trim()) {
      onCoordinateOverride(coordinateInput);
    }
    
    // Close after a short delay
    setTimeout(() => {
      setShowCoordinates(false);
    }, 200);
  };

  useEffect(() => {
    console.log(`ZipCodeSearch: Loaded ${zipArray.length} zip codes`);
  }, [zipArray]);

  return (
    <div className="relative w-full md:w-[16rem]">
      <label className="block mb-0 mt-1 font-medium text-[0.9rem] md:text-base">
        {translate("tZipCode")}
      </label>
      
      <div className="flex items-center gap-2">
        {/* Zip Code Dropdown */}
        <select
          value={selectedZip}
          onChange={handleChange}
          className={`border-2 px-2 py-2 md:py-1 rounded shadow-md w-full text-center text-[1.1rem] md:text-[1.3rem] tracking-widest ${
            selectedZip
              ? "bg-[#FFF5DC] border-[#FFC857] font-medium text-[#4A4E69] shadow-md"
              : "bg-[#ffffff] border-gray-300 shadow-sm"
          }`}
        >
          <option value="">{translate("tSelectZipCode")}</option>
          {zipArray.map((zipObj, idx) => (
            <option key={idx} value={zipObj.zip_code}>
              {zipObj.zip_code}
            </option>
          ))}
        </select>

        {/* Coordinate Override Button - outside the zip code box */}
        {selectedZip && (
          <button
            onClick={handleCoordinateClick}
            className="flex-shrink-0 w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
            title="Override coordinates"
          >
            {showCoordinates ? (
              <ArrowRight className="w-4 h-4 text-gray-600 transform rotate-180 transition-transform duration-200" />
            ) : (
              <ArrowRight className="w-4 h-4 text-gray-600 transition-transform duration-200" />
            )}
          </button>
        )}
      </div>

      {/* Sliding Coordinate Override Field - slides right from behind zip code */}
      <div
        className={`absolute top-0 left-0 transition-all duration-300 ease-in-out ${
          showCoordinates 
            ? 'transform translate-x-full opacity-100 z-10' 
            : 'transform translate-x-0 opacity-0 z-0 pointer-events-none'
        }`}
        style={{ width: '100%' }}
      >
        <div className="relative">
          <input
            type="text"
            value={coordinateInput}
            onChange={handleCoordinateInputChange}
            onKeyDown={handleCoordinateSubmit}
            onBlur={handleCoordinateBlur}
            placeholder="29.7307,-95.4573"
            className="w-full px-3 py-2 md:py-1 text-sm border-2 border-gray-300 rounded bg-gray-50 text-gray-700 focus:bg-white focus:border-blue-400 focus:outline-none"
            style={{ fontSize: '0.9rem' }}
            autoFocus={showCoordinates}
          />
          <button
            onClick={() => setShowCoordinates(false)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-all duration-200"
            title="Close coordinates"
          >
            <ArrowRight className="w-3 h-3 text-gray-500 transform rotate-180" />
          </button>
        </div>
      </div>

      {/* Neighborhood hyperlink */}
      {neighborhood && neighborhoodLink && (
        <a
          href={neighborhoodLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-sm underline text-blue-600 hover:text-blue-800 max-w-full relative z-0"
          style={{ lineHeight: "1.2", padding: "0 2px" }}
        >
          {neighborhood}
        </a>
      )}

    
    </div>
  );
}