// src/layout/NavBar2.js
// Search mode selector with mode-specific filters
// Frame 496 from Figma design

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { DistanceIcon } from "../icons";
import Tooltip from "../components/Tooltip";
import DistancePanel from "../components/DistancePanel";
import { useAppData } from "../Contexts/AppDataContext";
import { logUsage } from "../services/usageService";
import { searchWithLLM } from "../services/llmSearchService";
import { geocodeAddress } from "../services/geocodeService";
import { LOADING_MESSAGES } from "../constants/loadingMessages";

// Search mode definitions
const SEARCH_MODES = {
  ZIPCODE: "zipcode",
  ORGANIZATION: "organization",
  LOCATION: "location",
  LLM: "llm",
};

// Mode button component
function ModeButton({ label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        font-opensans transition-all duration-200
        ${isActive
          ? "bg-navbar2-btn-active-bg text-navbar2-btn-active-text hover:brightness-125"
          : "bg-transparent text-navbar2-btn-inactive-text hover:bg-white/10"
        }
      `}
      style={{
        height: "var(--height-navbar2-btn)",
        paddingLeft: "var(--padding-navbar2-btn-x)",
        paddingRight: "var(--padding-navbar2-btn-x)",
        borderRadius: "var(--radius-navbar2-btn)",
        fontSize: "var(--font-size-navbar2-btn)",
        fontWeight: "var(--font-weight-navbar2-btn)",
        letterSpacing: "var(--letter-spacing-navbar2-btn)",
      }}
    >
      {label}
    </button>
  );
}

// HoverDropdown component - opens on hover, click locks it open
// Replaces native select for better hover control
// Has slight delay before closing to allow time to move to dropdown
function HoverDropdown({ placeholder, options = [], value, onChange, allowReset = true, maxChars = 74 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const containerRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const hasValue = value && value !== "";

  // Truncate text if longer than maxChars
  const truncateText = (text) => {
    if (!text || text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + "...";
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsLocked(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (!isLocked) setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (!isLocked) {
      // Delay before closing to allow user to return if they accidentally move off
      closeTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 300);
    }
  };

  const handleClick = () => {
    setIsLocked(!isLocked);
    setIsOpen(true);
  };

  const handleSelect = (option) => {
    onChange?.(option);
    setIsOpen(false);
    setIsLocked(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleClick}
        className={`font-opensans transition-all duration-200 ${
          hasValue
            ? "bg-navbar2-dropdown-bg text-navbar2-dropdown-text hover:brightness-125"
            : "bg-transparent text-navbar2-btn-inactive-text hover:bg-white/10"
        }`}
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-dropdown)",
          fontWeight: "var(--font-weight-navbar2-dropdown)",
          letterSpacing: "var(--letter-spacing-navbar2-dropdown)",
          border: hasValue ? "1px solid rgba(255,255,255,1)" : "none",
        }}
      >
        {hasValue ? truncateText(value) : placeholder}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded shadow-lg z-50 max-h-[400px] overflow-y-auto"
          style={{ backgroundColor: "#F3EED9", minWidth: "200px" }}
        >
          {allowReset && (
            <button
              onClick={() => handleSelect("")}
              onMouseEnter={() => setHoveredOption("__reset__")}
              onMouseLeave={() => setHoveredOption(null)}
              className="w-full text-left px-4 py-2 font-opensans text-gray-500 italic"
              style={{
                fontSize: "14px",
                backgroundColor: hoveredOption === "__reset__" ? "#d4d0c7" : "transparent",
              }}
            >
              {placeholder}
            </button>
          )}
          {options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHoveredOption(opt)}
              onMouseLeave={() => setHoveredOption(null)}
              className="w-full text-left px-4 py-2 font-opensans"
              style={{
                fontSize: "14px",
                color: "#222831",
                backgroundColor: hoveredOption === opt ? "#d4d0c7" : (value === opt ? "#e0ddd4" : "transparent"),
              }}
              title={opt}
            >
              {truncateText(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Alias for backwards compatibility
const FilterDropdown = HoverDropdown;

// SearchableDropdown - allows typing to filter options (searches anywhere in name)
// Used for organization dropdowns where user wants to find "Health" anywhere in org name
function SearchableDropdown({ placeholder, options = [], value, onChange, allowReset = true, maxChars = 74 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const hasValue = value && value !== "";

  // Truncate text if longer than maxChars
  const truncateText = (text) => {
    if (!text || text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + "...";
  };

  // Filter options by search text (case-insensitive, matches anywhere)
  const filteredOptions = useMemo(() => {
    if (!searchText.trim()) return options;
    const search = searchText.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(search));
  }, [options, searchText]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsLocked(false);
        setSearchText("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (!isLocked) setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (!isLocked) {
      // Delay before closing to allow user to return if they accidentally move off
      closeTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
        setSearchText("");
      }, 300);
    }
  };

  const handleClick = () => {
    setIsLocked(!isLocked);
    setIsOpen(true);
  };

  const handleSelect = (option) => {
    onChange?.(option);
    setIsOpen(false);
    setIsLocked(false);
    setSearchText("");
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setIsLocked(false);
      setSearchText("");
    } else if (e.key === "Enter" && filteredOptions.length === 1) {
      // Auto-select if only one match
      handleSelect(filteredOptions[0]);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleClick}
        className={`font-opensans transition-all duration-200 ${
          hasValue
            ? "bg-navbar2-dropdown-bg text-navbar2-dropdown-text hover:brightness-125"
            : "bg-transparent text-navbar2-btn-inactive-text hover:bg-white/10"
        }`}
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-dropdown)",
          fontWeight: "var(--font-weight-navbar2-dropdown)",
          letterSpacing: "var(--letter-spacing-navbar2-dropdown)",
          border: hasValue ? "1px solid rgba(255,255,255,1)" : "none",
        }}
      >
        {hasValue ? truncateText(value) : placeholder}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded shadow-lg z-50"
          style={{ backgroundColor: "#F3EED9", minWidth: "300px" }}
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-300">
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="Type to search..."
              className="w-full px-3 py-2 rounded font-opensans"
              style={{
                fontSize: "14px",
                color: "#222831",
                backgroundColor: "#FFFFFF",
                border: "1px solid #ccc",
              }}
            />
          </div>

          {/* Options list */}
          <div className="max-h-[350px] overflow-y-auto">
            {allowReset && (
              <button
                onClick={() => handleSelect("")}
                onMouseEnter={() => setHoveredOption("__reset__")}
                onMouseLeave={() => setHoveredOption(null)}
                className="w-full text-left px-4 py-2 font-opensans text-gray-500 italic"
                style={{
                  fontSize: "14px",
                  backgroundColor: hoveredOption === "__reset__" ? "#d4d0c7" : "transparent",
                }}
              >
                {placeholder}
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-2 text-gray-500 italic font-opensans" style={{ fontSize: "14px" }}>
                No matches found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHoveredOption(opt)}
                  onMouseLeave={() => setHoveredOption(null)}
                  className="w-full text-left px-4 py-2 font-opensans"
                  style={{
                    fontSize: "14px",
                    color: "#222831",
                    backgroundColor: hoveredOption === opt ? "#d4d0c7" : (value === opt ? "#e0ddd4" : "transparent"),
                  }}
                  title={opt}
                >
                  {truncateText(opt)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Zip Code dropdown - hover to open version with type-to-search
// Has slight delay before closing to allow time to move to dropdown
function ZipCodeDropdown({ value, onChange, options = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const hasValue = value && value !== "";

  // Filter options by search text
  const filteredOptions = useMemo(() => {
    if (!searchText.trim()) return options;
    return options.filter(opt => opt.startsWith(searchText));
  }, [options, searchText]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsLocked(false);
        setSearchText("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (!isLocked) setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (!isLocked) {
      // Delay before closing to allow user to return if they accidentally move off
      closeTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
        setSearchText("");
      }, 300);
    }
  };

  const handleClick = () => {
    setIsLocked(!isLocked);
    setIsOpen(true);
  };

  const handleSelect = (option) => {
    onChange?.(option);
    setIsOpen(false);
    setIsLocked(false);
    setSearchText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && filteredOptions.length > 0) {
      // Select first matching option on Enter
      handleSelect(filteredOptions[0]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsLocked(false);
      setSearchText("");
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleClick}
        className={`font-opensans transition-all duration-200 ${
          hasValue
            ? "bg-navbar2-dropdown-bg text-navbar2-dropdown-text hover:brightness-125"
            : "bg-transparent text-navbar2-btn-inactive-text hover:bg-white/10"
        }`}
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-btn)",
          fontWeight: "var(--font-weight-navbar2-btn)",
          letterSpacing: "var(--letter-spacing-navbar2-btn)",
          border: hasValue ? "1px solid rgba(255,255,255,1)" : "none",
        }}
      >
        {hasValue ? value : "Select Zip Code"}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded shadow-lg z-50"
          style={{ backgroundColor: "#F3EED9", minWidth: "150px" }}
        >
          {/* Search input */}
          <div className="p-2" style={{ borderBottom: "2px solid #d4d0c7" }}>
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type zip code..."
              className="w-full px-3 py-2 rounded font-opensans"
              style={{
                fontSize: "14px",
                color: "#222831",
                backgroundColor: "#FFFFFF",
                border: "2px solid #005C72",
                outline: "none",
              }}
            />
          </div>
          {/* Options list */}
          <div className="max-h-[350px] overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHoveredOption(opt)}
                  onMouseLeave={() => setHoveredOption(null)}
                  className="w-full text-left px-4 py-2 font-opensans"
                  style={{
                    fontSize: "14px",
                    color: "#222831",
                    backgroundColor: hoveredOption === opt ? "#d4d0c7" : (value === opt ? "#e0ddd4" : "transparent"),
                  }}
                >
                  {opt}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 font-opensans text-gray-500" style={{ fontSize: "14px" }}>
                No matches found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// LLM Search dropdown with panel - matches ZipCodeDropdown pattern
function LLMSearchDropdown({
  value,
  onChange,
  onSearch,
  onClear,
  isLoading,
  interpretation,
  error,
  clientAddress,
  onAddressChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");
  const [localAddress, setLocalAddress] = useState(clientAddress || "");
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const hasValue = value && value.trim() !== "";

  // Rotate loading phrases while loading
  useEffect(() => {
    if (!isLoading) {
      setLoadingPhraseIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingPhraseIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1500); // Change phrase every 1.5 seconds
    return () => clearInterval(interval);
  }, [isLoading]);

  // Sync local value with prop
  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  // Sync local address with prop
  useEffect(() => {
    setLocalAddress(clientAddress || "");
  }, [clientAddress]);

  // Handle clearing the address
  const handleClearAddress = () => {
    setLocalAddress("");
    onAddressChange?.("", "");
    setGeocodeError("");
  };

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle click outside - if there's text, trigger search
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        if (isOpen && localValue.trim() && localValue !== value) {
          // User clicked outside with unsaved text - trigger search
          onChange(localValue);
          // Pass the localValue directly to avoid stale state issues
          onSearch(localValue);
        }
        setIsOpen(false);
        setIsLocked(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, localValue, value, onChange, onSearch]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (!isLocked) setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (!isLocked) {
      closeTimeoutRef.current = setTimeout(() => {
        // Don't auto-close if user has entered text
        if (!localValue.trim()) {
          setIsOpen(false);
        }
      }, 300);
    }
  };

  const handleClick = () => {
    setIsLocked(!isLocked);
    setIsOpen(true);
  };

  const handleSearchClick = async () => {
    if (!localValue.trim()) return;

    // If there's a new address that needs geocoding, do it first
    if (localAddress.trim() && localAddress !== clientAddress) {
      setIsGeocoding(true);
      setGeocodeError("");
      try {
        const result = await geocodeAddress(localAddress.trim());
        if (result.success) {
          onAddressChange?.(localAddress.trim(), result.coordinates);
        } else {
          setGeocodeError(result.message || "Could not find address");
          setIsGeocoding(false);
          return; // Don't proceed with search if geocoding failed
        }
      } catch (error) {
        setGeocodeError("Geocoding service unavailable");
        setIsGeocoding(false);
        return; // Don't proceed with search if geocoding failed
      }
      setIsGeocoding(false);
    }

    // Now proceed with search
    onChange(localValue);
    onSearch(localValue);
    setIsOpen(false);
    setIsLocked(false);
  };

  const handleClearClick = () => {
    setLocalValue("");
    onChange("");
    onClear?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Enter (without Shift) triggers search
    if (e.key === "Enter" && !e.shiftKey && !isLoading && localValue.trim()) {
      e.preventDefault(); // Prevent newline in textarea
      handleSearchClick();
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsLocked(false);
    }
  };

  // Truncate display text
  const truncateText = (text, maxChars = 30) => {
    if (!text || text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + "...";
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger button */}
      <button
        onClick={handleClick}
        className={`font-opensans transition-all duration-200 ${
          hasValue
            ? "bg-navbar2-dropdown-bg text-navbar2-dropdown-text hover:brightness-125"
            : "bg-transparent text-navbar2-btn-inactive-text hover:bg-white/10"
        }`}
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-btn)",
          fontWeight: "var(--font-weight-navbar2-btn)",
          letterSpacing: "var(--letter-spacing-navbar2-btn)",
          border: hasValue ? "1px solid rgba(255,255,255,1)" : "none",
        }}
      >
        {hasValue ? truncateText(value) : "What are you looking for today?"}
      </button>

      {/* Show loading phrase, interpretation, or error next to button */}
      {isLoading && (
        <span className="ml-3 text-yellow-300 text-sm font-opensans italic animate-pulse">
          {LOADING_MESSAGES[loadingPhraseIndex]}
        </span>
      )}
      {!isLoading && hasValue && interpretation && !error && (
        <span className="ml-3 text-white/80 text-sm font-opensans italic">
          {interpretation}
        </span>
      )}
      {!isLoading && error && (
        <span className="ml-3 text-red-400 text-sm font-opensans">
          {error}
        </span>
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute mt-2 rounded shadow-lg z-50"
          style={{
            width: "var(--width-llm-panel)",
            height: "auto",
            minHeight: "var(--min-height-llm-panel)",
            marginLeft: "var(--margin-llm-panel-left)",
            backgroundColor: "var(--color-panel-body-bg)",
            border: "2px solid var(--color-panel-border)",
            borderRadius: "var(--radius-panel)",
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-center relative px-4"
            style={{
              height: "var(--height-panel-header)",
              backgroundColor: "var(--color-panel-header-bg)",
              borderTopLeftRadius: "calc(var(--radius-panel) - 2px)",
              borderTopRightRadius: "calc(var(--radius-panel) - 2px)",
            }}
          >
            <span
              style={{
                color: "var(--color-panel-title)",
                fontSize: "var(--font-size-panel-title)",
                fontWeight: "var(--font-weight-panel-title)",
                letterSpacing: "var(--letter-spacing-panel-title)",
                fontFamily: "'Open Sans', sans-serif",
              }}
            >
              Search for Resources
            </span>
            <button
              onClick={() => {
                setIsOpen(false);
                setIsLocked(false);
              }}
              className="absolute right-4 text-white hover:text-gray-300 transition-colors"
              style={{ fontSize: "20px" }}
            >
              ×
            </button>
          </div>

          {/* Panel body */}
          <div className="p-4">
            {/* Search input label with clear button */}
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm" style={{ color: "#FFFFFF", fontFamily: "'Open Sans', sans-serif" }}>
                Describe what you're looking for in plain language:
              </p>
              {localValue && (
                <button
                  onClick={handleClearClick}
                  className="text-xs hover:underline"
                  style={{ color: "#0000FF", fontFamily: "'Open Sans', sans-serif" }}
                >
                  Clear Search
                </button>
              )}
            </div>

            {/* Search input */}
            <textarea
              ref={inputRef}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., food pantry open Monday morning in 77027"
              className="w-full p-3 rounded resize-none"
              style={{
                height: "80px",
                fontSize: "14px",
                color: "#222831",
                backgroundColor: "#FFFFFF",
                border: "1px solid #ccc",
                fontFamily: "'Open Sans', sans-serif",
              }}
              disabled={isLoading || isGeocoding}
            />

            {/* Address input section */}
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm" style={{ color: "#FFFFFF", fontFamily: "'Open Sans', sans-serif" }}>
                  Optional: Enter client address for distance calculation:
                </p>
                {/* Clear address button - only show when address is set */}
                {(localAddress || clientAddress) && (
                  <button
                    onClick={handleClearAddress}
                    className="text-xs hover:underline"
                    style={{ color: "#0000FF", fontFamily: "'Open Sans', sans-serif" }}
                    disabled={isGeocoding}
                  >
                    Clear Address
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={localAddress}
                  onChange={(e) => {
                    setLocalAddress(e.target.value);
                    setGeocodeError("");
                  }}
                  onKeyDown={(e) => {
                    // Enter in address field triggers search (which handles geocoding)
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (localValue.trim()) {
                        handleSearchClick();
                      }
                    }
                  }}
                  placeholder="e.g., 1234 Main St, Houston, TX 77002"
                  className="w-full p-3 rounded"
                  style={{
                    fontSize: "14px",
                    color: "#222831",
                    backgroundColor: "#FFFFFF",
                    border: geocodeError ? "2px solid #cc0000" : "1px solid #ccc",
                    paddingRight: isGeocoding ? "40px" : "12px",
                    fontFamily: "'Open Sans', sans-serif",
                  }}
                  disabled={isLoading || isGeocoding}
                />
                {/* Loading spinner for geocoding */}
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
              {/* Geocode error message - only show errors */}
              {geocodeError && (
                <p className="text-xs mt-1" style={{ color: "#cc0000", fontFamily: "'Open Sans', sans-serif" }}>
                  {geocodeError}
                </p>
              )}
              {/* Static helper text */}
              <p className="text-xs mt-1 italic" style={{ color: "#FFFFFF", fontFamily: "'Open Sans', sans-serif" }}>
                Distances will be calculated from this location
              </p>
            </div>

            {/* Action buttons - Cancel on left, Search on right */}
            <div className="flex justify-between items-center mt-6">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsLocked(false);
                  setLocalValue(value || "");
                  setLocalAddress(clientAddress || "");
                }}
                className="transition-all duration-200 hover:brightness-110"
                style={{
                  backgroundColor: "var(--color-panel-btn-cancel-bg)",
                  color: "var(--color-panel-btn-text)",
                  width: "var(--width-panel-btn)",
                  height: "var(--height-panel-btn)",
                  borderRadius: "var(--radius-panel-btn)",
                  fontSize: "var(--font-size-panel-btn)",
                  letterSpacing: "var(--letter-spacing-panel-btn)",
                  fontFamily: "'Open Sans', sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSearchClick}
                disabled={isLoading || isGeocoding || !localValue.trim()}
                className="transition-all duration-200 hover:brightness-110"
                style={{
                  backgroundColor: "var(--color-panel-btn-ok-bg)",
                  color: "var(--color-panel-btn-text)",
                  width: "var(--width-panel-btn)",
                  height: "var(--height-panel-btn)",
                  borderRadius: "var(--radius-panel-btn)",
                  fontSize: "var(--font-size-panel-btn)",
                  letterSpacing: "var(--letter-spacing-panel-btn)",
                  fontFamily: "'Open Sans', sans-serif",
                }}
              >
                {isLoading ? "Searching..." : "Search"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Neighborhood link component - wraps at 80 characters
// Note: This is display-only text, not a clickable link, so we use a span
function NeighborhoodLink({ text = "Braeswood Place, Knollwood Village" }) {
  return (
    <span
      className="text-navbar2-link"
      style={{
        fontSize: "var(--font-size-navbar2-link)",
        fontWeight: "var(--font-weight-navbar2-link)",
        maxWidth: "60ch",
        whiteSpace: "normal",
        lineHeight: "1.3",
      }}
    >
      {text}
    </span>
  );
}

// Distance icon button with panel
function DistanceButtonWithPanel({ 
  isActive = false, 
  defaultCoordinates = "",
  onCoordinatesChange,
  clientAddress = "",
  clientCoordinates = "",
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  // Handle click outside to close panel
  useEffect(() => {
    function handleClickOutside(event) {
      if (!isPanelOpen) return;

      const isOutsidePanel = panelRef.current && !panelRef.current.contains(event.target);
      const isOutsideButton = buttonRef.current && !buttonRef.current.contains(event.target);

      if (isOutsidePanel && isOutsideButton) {
        setIsPanelOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPanelOpen]);

  const handleToggle = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  const handleCancel = () => {
    setIsPanelOpen(false);
  };

  const handleSave = ({ address, coordinates }) => {
    onCoordinatesChange?.(address, coordinates);
    setIsPanelOpen(false);
  };

  return (
    <div className="relative">
      <Tooltip text="Distance from client location">
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className={`
            flex items-center justify-center transition-all duration-200
            ${isActive
              ? "bg-navbar2-btn-active-bg hover:brightness-125"
              : "bg-transparent hover:bg-white/10"
            }
          `}
          style={{
            height: "var(--height-navbar2-btn)",
            width: "var(--height-navbar2-btn)", // Square button
            borderRadius: "var(--radius-navbar2-btn)",
          }}
        >
          <DistanceIcon size={24} active={isActive} />
        </button>
      </Tooltip>

      <DistancePanel
        isOpen={isPanelOpen}
        onCancel={handleCancel}
        onSave={handleSave}
        panelRef={panelRef}
        defaultCoordinates={defaultCoordinates}
        currentAddress={clientAddress}
        currentCoordinates={clientCoordinates}
      />
    </div>
  );
}

// Filter content for each search mode
function ZipCodeFilters({ 
  selectedZip, 
  onZipChange, 
  zipCodeOptions, 
  selectedZipData,
  clientAddress,
  clientCoordinates,
  onCoordinatesChange,
}) {
  // Get neighborhood text for selected zip
  const neighborhoodText = selectedZipData?.neighborhood || "";
  // Get default coordinates (zip centroid)
  const defaultCoordinates = selectedZipData?.coordinates || "";

  return (
    <>
      <ZipCodeDropdown
        value={selectedZip}
        onChange={onZipChange}
        options={zipCodeOptions}
      />
      {selectedZip && neighborhoodText && <NeighborhoodLink text={neighborhoodText} />}
      <DistanceButtonWithPanel
        isActive={!!clientCoordinates}
        defaultCoordinates={defaultCoordinates}
        clientAddress={clientAddress}
        clientCoordinates={clientCoordinates}
        onCoordinatesChange={onCoordinatesChange}
      />
    </>
  );
}

function OrganizationFilters({
  parentOrgOptions = [],
  organizations = [],
  selectedParent,
  setSelectedParent,
  selectedChild,
  setSelectedChild,
  clientAddress,
  clientCoordinates,
  onCoordinatesChange,
}) {
  // Filter child orgs based on selected parent
  const childOrgOptions = useMemo(() => {
    if (!selectedParent) {
      // Show all organizations if no parent selected
      return organizations.map(o => o.organization).sort();
    }
    // Filter to children of selected parent
    return organizations
      .filter(o => o.org_parent === selectedParent)
      .map(o => o.organization)
      .sort();
  }, [selectedParent, organizations]);

  return (
    <>
      <SearchableDropdown
        placeholder="-- Select Parent Organization --"
        options={parentOrgOptions}
        value={selectedParent}
        onChange={setSelectedParent}
        allowReset={true}
      />
      <SearchableDropdown
        placeholder="-- Select Child Organization --"
        options={childOrgOptions}
        value={selectedChild}
        onChange={setSelectedChild}
        allowReset={true}
      />
      <DistanceButtonWithPanel
        isActive={!!clientCoordinates}
        clientAddress={clientAddress}
        clientCoordinates={clientCoordinates}
        onCoordinatesChange={onCoordinatesChange}
      />
    </>
  );
}

function LocationFilters({
  zipCodes = [],
  directory = [],
  selectedLocationZip,
  setSelectedLocationZip,
  selectedCounty,
  setSelectedCounty,
  selectedCity,
  setSelectedCity,
  selectedNeighborhood,
  setSelectedNeighborhood,
  clientAddress,
  clientCoordinates,
  onCoordinatesChange,
}) {

  // Get unique counties
  const countyOptions = useMemo(() => {
    const counties = [...new Set(zipCodes.map(z => z.county).filter(Boolean))];
    return counties.sort();
  }, [zipCodes]);

  // Get cities filtered by county
  const cityOptions = useMemo(() => {
    let filtered = zipCodes;
    if (selectedCounty) {
      filtered = filtered.filter(z => z.county === selectedCounty);
    }
    const cities = [...new Set(filtered.map(z => z.city).filter(Boolean))];
    return cities.sort();
  }, [zipCodes, selectedCounty]);

  // Get zips filtered by county and city
  const zipOptions = useMemo(() => {
    let filtered = zipCodes;
    if (selectedCounty) {
      filtered = filtered.filter(z => z.county === selectedCounty);
    }
    if (selectedCity) {
      filtered = filtered.filter(z => z.city === selectedCity);
    }
    return filtered
      .map(z => z.zip_code)
      .filter(Boolean)
      .sort();
  }, [zipCodes, selectedCounty, selectedCity]);

  // Get neighborhoods from directory.org_neighborhood, filtered by selected zip
  // If no zip selected, show all neighborhoods
  const neighborhoodOptions = useMemo(() => {
    let filtered = directory;
    if (selectedLocationZip) {
      filtered = filtered.filter(d => d.org_zip_code === selectedLocationZip);
    } else if (selectedCity) {
      filtered = filtered.filter(d => d.org_city === selectedCity);
    } else if (selectedCounty) {
      filtered = filtered.filter(d => d.org_county === selectedCounty);
    }
    const neighborhoods = [...new Set(filtered.map(d => d.org_neighborhood).filter(Boolean))];
    return neighborhoods.sort();
  }, [directory, selectedLocationZip, selectedCity, selectedCounty]);

  // Get data for selected zip (for coordinates)
  const selectedZipData = zipCodes.find(z => z.zip_code === selectedLocationZip);
  const defaultCoordinates = selectedZipData?.coordinates || "";

  return (
    <>
      <FilterDropdown
        placeholder="-- Select County --"
        options={countyOptions}
        value={selectedCounty}
        onChange={(val) => {
          setSelectedCounty(val);
          setSelectedCity("");
          setSelectedLocationZip("");
          setSelectedNeighborhood("");
        }}
        allowReset={true}
      />
      <FilterDropdown
        placeholder="-- Select City --"
        options={cityOptions}
        value={selectedCity}
        onChange={(val) => {
          setSelectedCity(val);
          setSelectedLocationZip("");
          setSelectedNeighborhood("");
        }}
        allowReset={true}
      />
      <FilterDropdown
        placeholder="-- Select Zip --"
        options={zipOptions}
        value={selectedLocationZip}
        onChange={(val) => {
          setSelectedLocationZip(val);
          setSelectedNeighborhood("");
        }}
        allowReset={true}
      />
      <SearchableDropdown
        placeholder="-- Select Neighborhood --"
        options={neighborhoodOptions}
        value={selectedNeighborhood}
        onChange={setSelectedNeighborhood}
        allowReset={true}
      />
      <DistanceButtonWithPanel
        isActive={!!clientCoordinates}
        defaultCoordinates={defaultCoordinates}
        clientAddress={clientAddress}
        clientCoordinates={clientCoordinates}
        onCoordinatesChange={onCoordinatesChange}
      />
    </>
  );
}

function LLMFilters({
  query,
  setQuery,
  onSearch,
  onClear,
  isLoading,
  interpretation,
  error,
  clientAddress,
  onAddressChange,
}) {
  return (
    <LLMSearchDropdown
      value={query}
      onChange={setQuery}
      onSearch={onSearch}
      onClear={onClear}
      isLoading={isLoading}
      interpretation={interpretation}
      error={error}
      clientAddress={clientAddress}
      onAddressChange={onAddressChange}
    />
  );
}

export default function NavBar2() {
  // Get data and filter state from context
  const {
    zipCodes,
    organizations,
    loggedInUser,
    activeSearchMode,
    setActiveSearchMode,
    selectedZipCode,
    setSelectedZipCode,
    selectedParentOrg,
    setSelectedParentOrg,
    selectedChildOrg,
    setSelectedChildOrg,
    selectedLocationZip,
    setSelectedLocationZip,
    selectedLocationCounty,
    setSelectedLocationCounty,
    selectedLocationCity,
    setSelectedLocationCity,
    selectedLocationNeighborhood,
    setSelectedLocationNeighborhood,
    setActiveAssistanceChips,
    directory,
    // Client coordinates from context (shared with ZipCodePage for distance calc)
    clientAddress,
    setClientAddress,
    clientCoordinates,
    setClientCoordinates,
    // LLM Search state
    assistance,
    llmSearchQuery,
    setLlmSearchQuery,
    setLlmSearchFilters,
    llmSearchInterpretation,
    setLlmSearchInterpretation,
    llmSearchLoading,
    setLlmSearchLoading,
    llmSearchError,
    setLlmSearchError,
  } = useAppData();

  // Get organization name for logging
  const regOrgName = loggedInUser?.reg_organization || 'Guest';

  // Handler for coordinates change from Distance panel
  const handleCoordinatesChange = (address, coordinates) => {
    setClientAddress(address);
    setClientCoordinates(coordinates);
  };

  // Handler to switch modes - clears all filter state including client coordinates
  const handleModeChange = (newMode) => {
    if (newMode !== activeSearchMode) {
      // Clear all filter state when switching modes
      setSelectedZipCode("");
      setSelectedParentOrg("");
      setSelectedChildOrg("");
      setSelectedLocationZip("");
      setSelectedLocationCounty("");
      setSelectedLocationCity("");
      setSelectedLocationNeighborhood("");
      setActiveAssistanceChips(new Set());
      // Clear client coordinates
      setClientAddress("");
      setClientCoordinates("");
      setActiveSearchMode(newMode);
    }
  };

  // Wrapper to log zip code selection
  const handleZipCodeChange = (zipCode) => {
    setSelectedZipCode(zipCode);
    if (zipCode) {
      logUsage({
        reg_organization: regOrgName, // Will be overridden by loggedInUser in context if available
        action_type: 'search',
        search_mode: 'Zip Code',
        search_value: zipCode,
      });
    }
  };

  // Wrapper to log parent org selection
  const handleParentOrgChange = (value) => {
    setSelectedParentOrg(value);
    setSelectedChildOrg(''); // Reset child when parent changes
    if (value) {
      logUsage({
        reg_organization: regOrgName,
        action_type: 'search',
        search_mode: 'Organization',
      });
    }
  };

  // Wrapper to log child org selection
  const handleChildOrgChange = (value) => {
    setSelectedChildOrg(value);
    if (value) {
      logUsage({
        reg_organization: regOrgName,
        action_type: 'search',
        search_mode: 'Organization',
      });
    }
  };

  // Wrapper to log county selection
  const handleCountyChange = (value) => {
    setSelectedLocationCounty(value);
    setSelectedLocationCity('');
    setSelectedLocationZip('');
    if (value) {
      logUsage({
        reg_organization: regOrgName,
        action_type: 'search',
        search_mode: 'Location',
      });
    }
  };

  // Wrapper to log city selection
  const handleCityChange = (value) => {
    setSelectedLocationCity(value);
    setSelectedLocationZip('');
    if (value) {
      logUsage({
        reg_organization: regOrgName,
        action_type: 'search',
        search_mode: 'Location',
      });
    }
  };

  // Wrapper to log location zip selection
  const handleLocationZipChange = (value) => {
    setSelectedLocationZip(value);
    setSelectedLocationNeighborhood(""); // Clear neighborhood when zip changes
    if (value) {
      logUsage({
        reg_organization: regOrgName,
        action_type: 'search',
        search_mode: 'Location',
      });
    }
  };

  // Wrapper to log neighborhood selection
  const handleNeighborhoodChange = (value) => {
    setSelectedLocationNeighborhood(value);
    if (value) {
      logUsage({
        reg_organization: regOrgName,
        action_type: 'search',
        search_mode: 'Location',
      });
    }
  };

  // Handler for LLM search - accepts optional query param to avoid stale state
  const handleLLMSearch = useCallback(async (queryOverride) => {
    const queryToUse = queryOverride || llmSearchQuery;
    if (!queryToUse.trim()) return;

    // Update the query in state if an override was provided
    if (queryOverride && queryOverride !== llmSearchQuery) {
      setLlmSearchQuery(queryOverride);
    }

    setLlmSearchLoading(true);
    setLlmSearchError("");
    setLlmSearchInterpretation("");

    try {
      const result = await searchWithLLM(queryToUse, assistance, zipCodes);

      if (result.success) {
        setLlmSearchFilters(result.filters);
        setLlmSearchInterpretation(result.interpretation || "");

        // If LLM detected an address in the query, geocode it
        if (result.geocode_address) {
          const geocodeResult = await geocodeAddress(result.geocode_address);
          if (geocodeResult.success) {
            setClientAddress(result.geocode_address);
            setClientCoordinates(geocodeResult.coordinates);
          }
          // Don't show error if geocoding fails - address from query might not be precise
        }

        // Log the search
        logUsage({
          reg_organization: regOrgName,
          action_type: 'search',
          search_mode: 'LLM Search',
          search_value: queryToUse,
        });
      } else {
        setLlmSearchError(result.message || "Search failed");
        setLlmSearchFilters(null);
      }
    } catch (err) {
      setLlmSearchError("An unexpected error occurred");
      setLlmSearchFilters(null);
    } finally {
      setLlmSearchLoading(false);
    }
  }, [
    llmSearchQuery,
    assistance,
    zipCodes,
    regOrgName,
    setLlmSearchQuery,
    setLlmSearchLoading,
    setLlmSearchError,
    setLlmSearchInterpretation,
    setLlmSearchFilters,
    setClientAddress,
    setClientCoordinates,
  ]);

  // Memoize zip code options (just the zip_code strings, sorted)
  // Filter by houston_area flag from database
  const zipCodeOptions = useMemo(() => {
    return zipCodes
      .filter(z => z.zip_code && z.houston_area === "Y")
      .map(z => z.zip_code)
      .sort();
  }, [zipCodes]);

  // Get the full zip data for the selected zip (for neighborhood display)
  const selectedZipData = useMemo(() => {
    if (!selectedZipCode) return null;
    return zipCodes.find(z => z.zip_code === selectedZipCode);
  }, [selectedZipCode, zipCodes]);

  // Memoize organization options for Organization mode
  const parentOrgOptions = useMemo(() => {
    const parents = [...new Set(organizations.map(o => o.org_parent).filter(Boolean))];
    return parents.sort();
  }, [organizations]);

  // Render the appropriate filters based on active mode
  const renderFilters = () => {
    switch (activeSearchMode) {
      case SEARCH_MODES.ZIPCODE:
        return (
          <ZipCodeFilters
            selectedZip={selectedZipCode}
            onZipChange={handleZipCodeChange}
            zipCodeOptions={zipCodeOptions}
            selectedZipData={selectedZipData}
            clientAddress={clientAddress}
            clientCoordinates={clientCoordinates}
            onCoordinatesChange={handleCoordinatesChange}
          />
        );
      case SEARCH_MODES.ORGANIZATION:
        return (
          <OrganizationFilters
            parentOrgOptions={parentOrgOptions}
            organizations={organizations}
            selectedParent={selectedParentOrg}
            setSelectedParent={handleParentOrgChange}
            selectedChild={selectedChildOrg}
            setSelectedChild={handleChildOrgChange}
            clientAddress={clientAddress}
            clientCoordinates={clientCoordinates}
            onCoordinatesChange={handleCoordinatesChange}
          />
        );
      case SEARCH_MODES.LOCATION:
        return (
          <LocationFilters
            zipCodes={zipCodes}
            directory={directory}
            selectedLocationZip={selectedLocationZip}
            setSelectedLocationZip={handleLocationZipChange}
            selectedCounty={selectedLocationCounty}
            setSelectedCounty={handleCountyChange}
            selectedCity={selectedLocationCity}
            setSelectedCity={handleCityChange}
            selectedNeighborhood={selectedLocationNeighborhood}
            setSelectedNeighborhood={handleNeighborhoodChange}
            clientAddress={clientAddress}
            clientCoordinates={clientCoordinates}
            onCoordinatesChange={handleCoordinatesChange}
          />
        );
      case SEARCH_MODES.LLM:
        return (
          <LLMFilters
            query={llmSearchQuery}
            setQuery={setLlmSearchQuery}
            onSearch={handleLLMSearch}
            onClear={() => {
              setLlmSearchQuery("");
              setLlmSearchFilters(null);
              setLlmSearchInterpretation("");
              setLlmSearchError("");
            }}
            isLoading={llmSearchLoading}
            interpretation={llmSearchInterpretation}
            error={llmSearchError}
            clientAddress={clientAddress}
            onAddressChange={(address, coordinates) => {
              setClientAddress(address);
              setClientCoordinates(coordinates);
            }}
          />
        );
      default:
        return <ZipCodeFilters zipCodeOptions={zipCodeOptions} />;
    }
  };

  return (
    <nav
      className="bg-navbar2-bg flex items-center justify-between"
      style={{
        height: "var(--height-navbar2)",
        paddingLeft: "var(--padding-navbar2-left)",
        paddingRight: "var(--padding-navbar2-right)",
      }}
    >
      {/* Left side - Mode-specific filters */}
      <div
        className="flex items-center"
        style={{ gap: "var(--gap-navbar2-filters)" }}
      >
        {renderFilters()}
      </div>

      {/* Right side - Search mode buttons */}
      <div
        className="flex items-center"
        style={{ gap: "var(--gap-navbar2-mode-buttons)" }}
      >
        <ModeButton
          label="Zip Code"
          isActive={activeSearchMode === SEARCH_MODES.ZIPCODE}
          onClick={() => handleModeChange(SEARCH_MODES.ZIPCODE)}
        />
        <ModeButton
          label="Organization"
          isActive={activeSearchMode === SEARCH_MODES.ORGANIZATION}
          onClick={() => handleModeChange(SEARCH_MODES.ORGANIZATION)}
        />
        <ModeButton
          label="Location"
          isActive={activeSearchMode === SEARCH_MODES.LOCATION}
          onClick={() => handleModeChange(SEARCH_MODES.LOCATION)}
        />
        <ModeButton
          label="LLM Search"
          isActive={activeSearchMode === SEARCH_MODES.LLM}
          onClick={() => handleModeChange(SEARCH_MODES.LLM)}
        />
      </div>
    </nav>
  );
}