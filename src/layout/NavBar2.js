// src/layout/NavBar2.js
// Search mode selector with mode-specific filters
// Frame 496 from Figma design

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Tooltip from "../components/Tooltip";
import { useAppData } from "../Contexts/AppDataContext";
import { logUsage } from "../services/usageService";
import { searchWithLLM } from "../services/llmSearchService";
import { geocodeAddress } from "../services/geocodeService";
import { LOADING_MESSAGES } from "../constants/loadingMessages";
import { buildParentDropdownOptions, matchesParentOrSubgroup } from "../utils/orgFilters";

// Search mode definitions
const SEARCH_MODES = {
  ZIPCODE: "zipcode",
  ORGANIZATION: "organization",
  LOCATION: "location",
  LLM: "llm",
};

// Mode button — borderless text label with hover/click → gold and a gold
// underline when active. Mirrors NavBar1's action-group color states so the
// two navbars feel like one system. Active = the selected search mode; the
// underline disambiguates "selected mode" from "I'm just hovering."
function ModeButton({ label, isActive, onClick }) {
  // Color states:
  //   inactive default → D8D9DB (near-white gray)
  //   inactive hover   → accent gold
  //   active           → accent gold + gold border-bottom (sticky)
  // The underline is always rendered; its color flips between transparent and
  // gold to avoid layout shift when toggling modes.
  const colorClass = isActive
    ? "text-[var(--color-accent-gold)]"
    : "text-[var(--color-navbar2-mode-inactive-text)] hover:text-[var(--color-accent-gold)]";

  return (
    <button
      onClick={onClick}
      className={`font-opensans transition-all duration-150 bg-transparent active:text-[var(--color-accent-gold)] active:scale-[0.97] ${colorClass}`}
      style={{
        height: "var(--height-navbar2-btn)",
        paddingLeft: "var(--padding-navbar2-btn-x)",
        paddingRight: "var(--padding-navbar2-btn-x)",
        fontSize: "var(--font-size-navbar2-btn)",
        fontWeight: "var(--font-weight-navbar2-btn)",
        letterSpacing: "var(--letter-spacing-navbar2-btn)",
        border: "none",
        borderBottom: `var(--width-navbar2-mode-underline) solid ${
          isActive ? "var(--color-accent-gold)" : "transparent"
        }`,
        borderRadius: 0,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// HoverDropdown component - click to open, click to close
// Replaces native select for better control
function HoverDropdown({ placeholder, options = [], value, onChange, allowReset = true, maxChars = 74 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const containerRef = useRef(null);
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
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleSelect = (option) => {
    onChange?.(option);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        onClick={handleClick}
        className="font-opensans transition-all duration-200 hover:brightness-125"
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-dropdown)",
          fontWeight: "var(--font-weight-navbar2-dropdown)",
          letterSpacing: "var(--letter-spacing-navbar2-dropdown)",
          backgroundColor: hasValue
            ? "var(--color-navbar2-btn-active-bg)"
            : "var(--color-navbar2-btn-inactive-bg)",
          color: hasValue
            ? "var(--color-navbar2-btn-active-text)"
            : "var(--color-navbar2-btn-inactive-text)",
          border: hasValue
            ? "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)"
            : "var(--border-width-btn) solid var(--color-navbar2-btn-inactive-border)",
          whiteSpace: "nowrap",
        }}
      >
        {hasValue ? truncateText(value) : placeholder}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded shadow-lg z-50 max-h-[400px] overflow-y-auto"
          style={{ backgroundColor: "var(--color-dropdown-bg)", minWidth: "200px" }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {allowReset && (
            <button
              onClick={(e) => { e.stopPropagation(); handleSelect(""); }}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handleSelect(""); }}
              onMouseEnter={() => setHoveredOption("__reset__")}
              onMouseLeave={() => setHoveredOption(null)}
              className="w-full text-left px-4 py-2 font-opensans text-gray-500 italic"
              style={{
                fontSize: "14px",
                backgroundColor: hoveredOption === "__reset__" ? "var(--color-dropdown-hover-bg)" : "transparent",
              }}
            >
              {placeholder}
            </button>
          )}
          {options.map((opt, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); handleSelect(opt); }}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handleSelect(opt); }}
              onMouseEnter={() => setHoveredOption(opt)}
              onMouseLeave={() => setHoveredOption(null)}
              className="w-full text-left px-4 py-2 font-opensans"
              style={{
                fontSize: "14px",
                color: "var(--color-dropdown-text)",
                backgroundColor: hoveredOption === opt ? "var(--color-dropdown-hover-bg)" : (value === opt ? "var(--color-dropdown-active-bg)" : "transparent"),
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
// Click to open, click to close
//
// Options accept either bare strings (label === value) or {value, label} objects.
// This lets the parent dropdown render subgroups indented (e.g., "— District 4")
// while the underlying filter value stays clean (e.g., "District 4").
function SearchableDropdown({ placeholder, options = [], value, onChange, allowReset = true, maxChars = 74 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const hasValue = value && value !== "";

  // Normalize options to {value, label} so the rest of the component is uniform.
  const normalizedOptions = useMemo(
    () => options.map((opt) => (typeof opt === "string" ? { value: opt, label: opt } : opt)),
    [options]
  );

  // Truncate text if longer than maxChars
  const truncateText = (text) => {
    if (!text || text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + "...";
  };

  // Label to show in the closed button: prefer the matching option's label so
  // selected values (e.g., "District 4") aren't shown with the "— " indent prefix.
  const selectedLabel = useMemo(() => {
    if (!hasValue) return "";
    const match = normalizedOptions.find((o) => o.value === value);
    return match ? match.label.replace(/^— /, "") : value;
  }, [hasValue, normalizedOptions, value]);

  // Filter options by search text (case-insensitive, matches anywhere on the label).
  // A subgroup option (one with `parent` set) is included if its parent's value
  // matched directly — so typing "Society" surfaces "Society of St Vincent de Paul"
  // along with all of its districts even though the district labels don't contain "Society".
  const filteredOptions = useMemo(() => {
    if (!searchText.trim()) return normalizedOptions;
    const search = searchText.toLowerCase();
    const directMatches = new Set(
      normalizedOptions.filter((opt) => opt.label.toLowerCase().includes(search)).map((opt) => opt.value)
    );
    return normalizedOptions.filter(
      (opt) => directMatches.has(opt.value) || (opt.parent && directMatches.has(opt.parent))
    );
  }, [normalizedOptions, searchText]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchText("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [isOpen]);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleSelect = (option) => {
    onChange?.(option);
    setIsOpen(false);
    setSearchText("");
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchText("");
    } else if (e.key === "Enter" && filteredOptions.length === 1) {
      // Auto-select if only one match
      handleSelect(filteredOptions[0].value);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        onClick={handleClick}
        className="font-opensans transition-all duration-200 hover:brightness-125"
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-dropdown)",
          fontWeight: "var(--font-weight-navbar2-dropdown)",
          letterSpacing: "var(--letter-spacing-navbar2-dropdown)",
          backgroundColor: hasValue
            ? "var(--color-navbar2-btn-active-bg)"
            : "var(--color-navbar2-btn-inactive-bg)",
          color: hasValue
            ? "var(--color-navbar2-btn-active-text)"
            : "var(--color-navbar2-btn-inactive-text)",
          border: hasValue
            ? "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)"
            : "var(--border-width-btn) solid var(--color-navbar2-btn-inactive-border)",
          whiteSpace: "nowrap",
        }}
      >
        {hasValue ? truncateText(selectedLabel) : placeholder}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded shadow-lg z-50"
          style={{ backgroundColor: "var(--color-dropdown-bg)", minWidth: "700px" }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
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
                color: "var(--color-dropdown-text)",
                backgroundColor: "#FFFFFF",
                border: "1px solid #ccc",
              }}
            />
          </div>

          {/* Options list */}
          <div className="max-h-[350px] overflow-y-auto">
            {allowReset && (
              <button
                onClick={(e) => { e.stopPropagation(); handleSelect(""); }}
                onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handleSelect(""); }}
                onMouseEnter={() => setHoveredOption("__reset__")}
                onMouseLeave={() => setHoveredOption(null)}
                className="w-full text-left px-4 py-2 font-opensans text-gray-500 italic"
                style={{
                  fontSize: "14px",
                  backgroundColor: hoveredOption === "__reset__" ? "var(--color-dropdown-hover-bg)" : "transparent",
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
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={(e) => { e.stopPropagation(); handleSelect(opt.value); }}
                  onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handleSelect(opt.value); }}
                  onMouseEnter={() => setHoveredOption(opt.value)}
                  onMouseLeave={() => setHoveredOption(null)}
                  className="w-full text-left px-4 py-2 font-opensans"
                  style={{
                    fontSize: "var(--font-size-navbar2-dropdown-option)",
                    color: "var(--color-dropdown-text)",
                    backgroundColor: hoveredOption === opt.value ? "var(--color-dropdown-hover-bg)" : (value === opt.value ? "var(--color-dropdown-active-bg)" : "transparent"),
                  }}
                  title={opt.label}
                >
                  {truncateText(opt.label)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Zip Code dropdown - click to open with type-to-search
function ZipCodeDropdown({ value, onChange, options = [], placeholder = "Select Zip Code", useDropdownStyle = false, usePromptingStyle = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const hasValue = value && value !== "";

  // Normalize options so a caller can pass either a list of zip strings or
  // {value, label} objects (label is "zip — city"). Search/match still happens
  // against the zip value, but the rendered text uses the label.
  const normalizedOptions = useMemo(
    () => options.map((opt) => (typeof opt === "string" ? { value: opt, label: opt } : opt)),
    [options]
  );

  // Type-ahead filter against the zip value (the user types digits, not city).
  const filteredOptions = useMemo(() => {
    if (!searchText.trim()) return normalizedOptions;
    return normalizedOptions.filter((opt) => opt.value.startsWith(searchText));
  }, [normalizedOptions, searchText]);

  // Closed-state button shows the city alongside the selected zip.
  const selectedLabel = useMemo(() => {
    if (!hasValue) return placeholder;
    const match = normalizedOptions.find((opt) => opt.value === value);
    return match ? match.label : value;
  }, [hasValue, value, normalizedOptions, placeholder]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchText("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [isOpen]);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleSelect = (option) => {
    onChange?.(option);
    setIsOpen(false);
    setSearchText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && filteredOptions.length > 0) {
      // Select first matching option on Enter
      handleSelect(filteredOptions[0].value);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearchText("");
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        onClick={handleClick}
        className="font-opensans transition-all duration-200 hover:brightness-125 flex items-center gap-1"
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: useDropdownStyle ? "var(--font-size-navbar2-dropdown)" : "var(--font-size-navbar2-btn)",
          fontWeight: useDropdownStyle ? "var(--font-weight-navbar2-dropdown)" : "var(--font-weight-navbar2-btn)",
          letterSpacing: useDropdownStyle ? "var(--letter-spacing-navbar2-dropdown)" : "var(--letter-spacing-navbar2-btn)",
          whiteSpace: "nowrap",
          ...(usePromptingStyle
            ? {
                // Single visual state — hasValue and !hasValue render
                // identically (white text, transparent bg, blue border) so
                // selecting a zip doesn't reshape the trigger. Only min-width
                // varies: forced when empty so "Choose Zip Code" fits, free to
                // shrink once a shorter "77002 — Houston" replaces it.
                minWidth: hasValue ? undefined : "var(--min-width-choose-btn)",
                backgroundColor: "var(--color-navbar2-dropdown-prompting-bg)",
                color: "var(--color-navbar2-dropdown-prompting-text)",
                border: "var(--border-width-btn) solid var(--color-navbar2-dropdown-prompting-border)",
              }
            : {
                backgroundColor: hasValue
                  ? "var(--color-navbar2-btn-active-bg)"
                  : "var(--color-navbar2-btn-inactive-bg)",
                color: hasValue
                  ? "var(--color-navbar2-btn-active-text)"
                  : "var(--color-navbar2-btn-inactive-text)",
                border: hasValue
                  ? "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)"
                  : "var(--border-width-btn) solid var(--color-navbar2-btn-inactive-border)",
              }
          ),
        }}
      >
        {selectedLabel}
        {usePromptingStyle && (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, marginLeft: "4px" }}>
            <path d="M7 10l5 5 5-5z" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded shadow-lg z-50"
          style={{ backgroundColor: "var(--color-dropdown-bg)", minWidth: "150px" }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="p-2" style={{ borderBottom: "2px solid var(--color-dropdown-divider)" }}>
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
                color: "var(--color-dropdown-text)",
                backgroundColor: "#FFFFFF",
                border: "2px solid var(--color-navbar2-dropdown-bg)",
                outline: "none",
              }}
            />
          </div>
          {/* Options list */}
          <div className="max-h-[350px] overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(opt.value);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleSelect(opt.value);
                  }}
                  onMouseEnter={() => setHoveredOption(opt.value)}
                  onMouseLeave={() => setHoveredOption(null)}
                  className="w-full text-left px-4 py-2 font-opensans"
                  style={{
                    fontSize: "var(--font-size-navbar2-dropdown-option)",
                    color: "var(--color-dropdown-text)",
                    backgroundColor: hoveredOption === opt.value ? "var(--color-dropdown-hover-bg)" : (value === opt.value ? "var(--color-dropdown-active-bg)" : "transparent"),
                    // Keep "ZIP — Cityname" labels on a single line; the panel
                    // (only minWidth-constrained, no maxWidth) auto-expands to
                    // fit the widest option.
                    whiteSpace: "nowrap",
                  }}
                >
                  {opt.label}
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


// LLM Search dropdown with panel - click to open
function LLMSearchDropdown({
  value,
  onChange,
  onSearch,
  onClear,
  isLoading,
  interpretation,
  error,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
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

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
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
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, localValue, value, onChange, onSearch]);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleSearchClick = () => {
    if (!localValue.trim()) return;
    onChange(localValue);
    onSearch(localValue);
    setIsOpen(false);
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
      e.preventDefault();
      handleSearchClick();
    } else if (e.key === "Escape") {
      setIsOpen(false);
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
    >
      {/* Trigger button */}
      <button
        onClick={handleClick}
        className="font-opensans transition-all duration-200 hover:brightness-125"
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-btn)",
          fontWeight: "var(--font-weight-navbar2-btn)",
          letterSpacing: "var(--letter-spacing-navbar2-btn)",
          backgroundColor: hasValue
            ? "var(--color-navbar2-btn-active-bg)"
            : "var(--color-navbar2-btn-inactive-bg)",
          color: hasValue
            ? "var(--color-navbar2-btn-active-text)"
            : "var(--color-navbar2-btn-inactive-text)",
          border: hasValue
            ? "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)"
            : "var(--border-width-btn) solid var(--color-navbar2-btn-inactive-border)",
          whiteSpace: "nowrap",
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
        <div className="ml-3 flex items-center">
          <span className="text-white/80 text-sm font-opensans italic">
            {interpretation}
          </span>
        </div>
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
              onClick={() => setIsOpen(false)}
              className="absolute right-4 text-white hover:text-gray-300 transition-colors"
              style={{ fontSize: "20px" }}
            >
              ×
            </button>
          </div>

          {/* Panel body */}
          <div className="p-4">
            {/* Input label — matches the uppercase teal label pattern used
                by Email/PDF/SMS panels. */}
            <p
              className="font-opensans"
              style={{
                color: "var(--color-panel-label-text)",
                fontSize: "var(--font-size-panel-label)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                margin: "0 0 8px 0",
              }}
            >
              Describe what you're looking for in plain language
            </p>

            {/* Search input - 50% taller (80px -> 120px) */}
            <textarea
              ref={inputRef}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., food pantry open on Monday near 123 Main St, 77002"
              className="w-full p-3 rounded resize-none"
              style={{
                height: "120px",
                fontSize: "16px",
                color: "var(--color-text-primary)",
                backgroundColor: "var(--color-panel-input-bg)",
                border: "1px solid var(--color-panel-input-border)",
                fontFamily: "'Open Sans', sans-serif",
              }}
              disabled={isLoading}
            />

            {/* Action row: Cancel on the left, Clear + Ask grouped on the right. */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setLocalValue(value || "");
                }}
                className="transition-all duration-200 hover:brightness-110 font-opensans"
                style={{
                  backgroundColor: "var(--color-panel-btn-cancel-bg)",
                  color: "var(--color-panel-btn-text)",
                  width: "var(--width-panel-btn)",
                  height: "var(--height-panel-btn)",
                  borderRadius: "var(--radius-panel-btn)",
                  fontSize: "var(--font-size-panel-btn)",
                  letterSpacing: "var(--letter-spacing-panel-btn)",
                }}
              >
                Cancel
              </button>

              <div className="flex items-center" style={{ gap: "20px" }}>
                <button
                  onClick={handleClearClick}
                  className="transition-all duration-200 hover:brightness-110 font-opensans"
                  style={{
                    backgroundColor: "transparent",
                    color: "var(--color-panel-btn-clear-text)",
                    border: "1.5px solid var(--color-panel-btn-clear-border)",
                    width: "var(--width-panel-btn)",
                    height: "var(--height-panel-btn)",
                    borderRadius: "var(--radius-panel-btn)",
                    fontSize: "var(--font-size-panel-btn)",
                    letterSpacing: "var(--letter-spacing-panel-btn)",
                  }}
                >
                  Clear
                </button>

                <button
                  onClick={handleSearchClick}
                  disabled={isLoading || !localValue.trim()}
                  className="transition-all duration-200 hover:brightness-110 font-opensans"
                  style={{
                    backgroundColor: "var(--color-panel-btn-ok-bg)",
                    color: "var(--color-panel-btn-text)",
                    width: "var(--width-panel-btn)",
                    height: "var(--height-panel-btn)",
                    borderRadius: "var(--radius-panel-btn)",
                    fontSize: "var(--font-size-panel-btn)",
                    letterSpacing: "var(--letter-spacing-panel-btn)",
                  }}
                >
                  {isLoading ? "Asking..." : "Ask"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// External link icon for zip code map
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

// Neighborhood display with optional zip link icon
function NeighborhoodLink({ text = "Braeswood Place, Knollwood Village", zipLink }) {
  return (
    <span className="flex items-center gap-2">
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
      {/* Hidden per user request — leave intact for easy reinstatement */}
      {false && zipLink && (
        <Tooltip text="Zip code map and demographics">
          <a
            href={zipLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center transition-all duration-200 hover:brightness-150"
            style={{
              color: "#8FB6FF",
              flexShrink: 0,
              padding: "2px",
            }}
          >
            <ExternalLinkIcon size={18} color="#8FB6FF" />
          </a>
        </Tooltip>
      )}
    </span>
  );
}

// Filter content for each search mode
function ZipCodeFilters({
  selectedZip,
  onZipChange,
  zipCodeOptions,
  selectedZipData,
}) {
  // Get neighborhood text for selected zip
  const neighborhoodText = selectedZipData?.neighborhood || "";

  return (
    // Right-positioned tooltip with a wider cap so the neighborhood list
    // wraps to ~2–3 lines and stays within NavBar2's 70px height instead of
    // dropping below the trigger and obscuring the open zip dropdown.
    <Tooltip
      text={selectedZip && neighborhoodText ? `Neighborhoods: ${neighborhoodText}` : ""}
      position="right"
      multiline
      maxWidth="600px"
    >
      <ZipCodeDropdown
        value={selectedZip}
        onChange={onZipChange}
        options={zipCodeOptions}
        placeholder="Choose Zip Code"
        useDropdownStyle={true}
        usePromptingStyle={true}
      />
    </Tooltip>
  );
}

function OrganizationFilters({
  mobile = false,
  parentOrgOptions = [],
  organizations = [],
  selectedParent,
  setSelectedParent,
  selectedChild,
  setSelectedChild,
}) {
  // Filter child orgs based on selected parent
  const childOrgOptions = useMemo(() => {
    if (!selectedParent) {
      // Show all organizations if no parent selected
      return organizations.map(o => o.organization).sort();
    }
    // Filter to children of selected parent (or selected subgroup, e.g. "District 4")
    return organizations
      .filter(o => matchesParentOrSubgroup(o, selectedParent))
      .map(o => o.organization)
      .sort();
  }, [selectedParent, organizations]);

  // Mobile: two squeezed native selects sharing one row (short field labels so
  // you can tell Parent from Child even when narrow).
  if (mobile) {
    return (
      <>
        <MobileSelect
          placeholder="Parent Org"
          options={parentOrgOptions}
          value={selectedParent}
          onChange={setSelectedParent}
        />
        <MobileSelect
          placeholder="Organization"
          options={childOrgOptions}
          value={selectedChild}
          onChange={setSelectedChild}
        />
      </>
    );
  }

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
    </>
  );
}

function LocationFilters({
  mobile = false,
  directory = [],
  selectedLocationZip,
  setSelectedLocationZip,
  selectedCounty,
  setSelectedCounty,
  selectedCity,
  setSelectedCity,
  selectedNeighborhood,
  setSelectedNeighborhood,
}) {

  // Location dropdowns are sourced from the directory itself (org_county /
  // org_city / org_zip_code), not from the canonical zip_codes table. This
  // hides counties/cities/zips that have no organizations physically located
  // in them — so users can't pick a Location that's guaranteed to return zero
  // results.
  const countyOptions = useMemo(() => {
    const counties = [...new Set(directory.map(d => d.org_county).filter(Boolean))];
    return counties.sort();
  }, [directory]);

  // Cities scoped to directory orgs in the selected county
  const cityOptions = useMemo(() => {
    let filtered = directory;
    if (selectedCounty) {
      filtered = filtered.filter(d => d.org_county === selectedCounty);
    }
    const cities = [...new Set(filtered.map(d => d.org_city).filter(Boolean))];
    return cities.sort();
  }, [directory, selectedCounty]);

  // Zips scoped to directory orgs in the selected county and city. Label
  // carries the city ("77002 — Houston") so both closed and open dropdown
  // show context; the stored value is the bare zip code.
  const zipOptions = useMemo(() => {
    let filtered = directory;
    if (selectedCounty) {
      filtered = filtered.filter(d => d.org_county === selectedCounty);
    }
    if (selectedCity) {
      filtered = filtered.filter(d => d.org_city === selectedCity);
    }
    // De-dupe (zip, city) pairs so each zip appears once even when multiple
    // orgs share it.
    const seen = new Map();
    for (const d of filtered) {
      if (!d.org_zip_code) continue;
      if (!seen.has(d.org_zip_code)) {
        seen.set(d.org_zip_code, d.org_city || "");
      }
    }
    return Array.from(seen.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([zip, city]) => ({
        value: zip,
        label: city ? `${zip} — ${city}` : zip,
      }));
  }, [directory, selectedCounty, selectedCity]);

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

  // Mobile: three squeezed native selects (County · City · Zip) in one row —
  // neighborhood is dropped on mobile. Each onChange mirrors the desktop cascade
  // resets so picking a broader level clears the narrower ones. Any-level entry
  // is preserved (all three are always tappable).
  if (mobile) {
    return (
      <>
        <MobileSelect
          placeholder="County"
          options={countyOptions}
          value={selectedCounty}
          onChange={(val) => {
            setSelectedCounty(val);
            setSelectedCity("");
            setSelectedLocationZip("");
            setSelectedNeighborhood("");
          }}
        />
        <MobileSelect
          placeholder="City"
          options={cityOptions}
          value={selectedCity}
          onChange={(val) => {
            setSelectedCity(val);
            setSelectedLocationZip("");
            setSelectedNeighborhood("");
          }}
        />
        <MobileSelect
          placeholder="Zip"
          options={zipOptions}
          value={selectedLocationZip}
          onChange={(val) => {
            setSelectedLocationZip(val);
            setSelectedNeighborhood("");
          }}
        />
      </>
    );
  }

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
      <ZipCodeDropdown
        value={selectedLocationZip}
        onChange={(val) => {
          setSelectedLocationZip(val);
          setSelectedNeighborhood("");
        }}
        options={zipOptions}
        placeholder="Select Zip"
        useDropdownStyle={true}
      />
      <SearchableDropdown
        placeholder="-- Select Neighborhood --"
        options={neighborhoodOptions}
        value={selectedNeighborhood}
        onChange={setSelectedNeighborhood}
        allowReset={true}
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
}) {
  return (
    <>
      <LLMSearchDropdown
        value={query}
        onChange={setQuery}
        onSearch={onSearch}
        onClear={onClear}
        isLoading={isLoading}
        interpretation={interpretation}
        error={error}
      />
    </>
  );
}

// Native <select> styled for the squeezed mobile filter row. On a phone the
// native picker opens full-screen regardless of the field's on-screen width, so
// several can share one row; the filled background/border signals "something is
// chosen here" even when the value is too narrow to read (tap to re-open and
// see it). Default flex-1 makes each box share the row evenly.
function MobileSelect({ value, onChange, placeholder, options = [] }) {
  const normalized = useMemo(
    () => options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)),
    [options]
  );
  const hasValue = Boolean(value);
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="font-opensans flex-1 min-w-0"
      style={{
        height: "var(--height-navbar2-btn)",
        paddingLeft: "10px",
        paddingRight: "30px",
        borderRadius: "var(--radius-navbar2-btn)",
        fontSize: "var(--font-size-navbar2-dropdown)",
        fontWeight: "var(--font-weight-navbar2-dropdown)",
        letterSpacing: "var(--letter-spacing-navbar2-dropdown)",
        backgroundColor: hasValue
          ? "var(--color-navbar2-dropdown-bg)"
          : "var(--color-navbar2-dropdown-prompting-bg)",
        color: hasValue
          ? "var(--color-navbar2-dropdown-text)"
          : "var(--color-navbar2-dropdown-prompting-text)",
        border: hasValue
          ? "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)"
          : "var(--border-width-btn) solid var(--color-navbar2-dropdown-prompting-border)",
        WebkitAppearance: "none",
        appearance: "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='28' height='28' viewBox='0 0 24 24' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 6px center",
        backgroundSize: "20px",
      }}
    >
      <option value="">{placeholder}</option>
      {normalized.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// Ask-a-Question input for mobile — a lightweight native text field + Go button
// (the desktop LLMSearchDropdown is too heavy for the squeezed bar). Enter or Go
// runs the same handleLLMSearch the desktop uses.
function MobileLLMInput({ query, setQuery, onSearch, isLoading }) {
  const submit = () => {
    if (query.trim() && !isLoading) onSearch(query);
  };
  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="What are you looking for today?"
        className="font-opensans flex-1 min-w-0"
        style={{
          height: "var(--height-navbar2-btn)",
          padding: "0 12px",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-dropdown)",
          backgroundColor: "var(--color-navbar2-dropdown-bg)",
          color: "var(--color-navbar2-dropdown-text)",
          border: "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)",
        }}
      />
      <button
        onClick={submit}
        disabled={isLoading || !query.trim()}
        className="font-opensans flex-shrink-0 transition-all hover:brightness-110"
        style={{
          height: "var(--height-navbar2-btn)",
          padding: "0 16px",
          borderRadius: "var(--radius-navbar2-btn)",
          backgroundColor: "var(--color-navbar2-dropdown-bg)",
          color: "#FFFFFF",
          border: "none",
          fontWeight: 600,
          fontSize: "14px",
          opacity: isLoading || !query.trim() ? 0.6 : 1,
        }}
      >
        {isLoading ? "…" : "Go"}
      </button>
    </>
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
    // Client coordinates from context — Address chip lives in NavBar3 now, but
    // we still clear these here when the search mode changes.
    setClientAddress,
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
    llmRelatedSearches,
    setLlmRelatedSearches,
    pendingLlmAutoSearch,
    setPendingLlmAutoSearch,
  } = useAppData();

  // Get organization name for logging
  const regOrgName = loggedInUser?.reg_organization || 'Guest';

  // Mobile now supports all four modes via the NavBar2 mode toggle (below), so we
  // no longer force Zip on small screens. Default mode still comes from context
  // (Zip), and SMS deep links set their own mode — both work without forcing.

  // Handler for LLM search declared later via useCallback; ref so the auto-search
  // effect can call it without adding a forward-reference dependency.
  const handleLLMSearchRef = useRef(null);

  // Deep-link auto-search for Ask-a-Question shares. When a recipient opens a
  // ?mode=llm&q=... URL, AppDataContext sets pendingLlmAutoSearch=true and
  // prefills llmSearchQuery. We wait for assistance + zipCodes to be loaded
  // (searchWithLLM needs them) and then run the search exactly once.
  useEffect(() => {
    if (!pendingLlmAutoSearch) return;
    if (!assistance?.length || !zipCodes?.length) return;
    if (!llmSearchQuery?.trim()) {
      setPendingLlmAutoSearch(false);
      return;
    }
    setPendingLlmAutoSearch(false);
    handleLLMSearchRef.current?.(llmSearchQuery);
  }, [pendingLlmAutoSearch, assistance, zipCodes, llmSearchQuery, setPendingLlmAutoSearch]);

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
      // Clear LLM search state (both input boxes in the Search for Resources panel)
      setLlmSearchQuery("");
      setLlmSearchFilters(null);
      setLlmSearchInterpretation("");
      setLlmSearchError("");
      setLlmRelatedSearches([]);
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
        setLlmRelatedSearches(result.related_searches || []);

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
          search_mode: 'Ask a Question',
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
    setLlmRelatedSearches,
    setClientAddress,
    setClientCoordinates,
  ]);

  // Keep the ref in sync so the deep-link auto-search effect can call the latest handler.
  useEffect(() => {
    handleLLMSearchRef.current = handleLLMSearch;
  }, [handleLLMSearch]);

  // Memoize zip code options as {value, label} objects so the dropdown can
  // show the city alongside the zip ("77002 — Houston") while still using the
  // bare zip as the selected value. Filter by houston_area flag from database.
  const zipCodeOptions = useMemo(() => {
    return zipCodes
      .filter(z => z.zip_code && z.houston_area === "Y")
      .sort((a, b) => a.zip_code.localeCompare(b.zip_code))
      .map(z => ({
        value: z.zip_code,
        label: z.city ? `${z.zip_code} — ${z.city}` : z.zip_code,
      }));
  }, [zipCodes]);

  // Get the full zip data for the selected zip (for neighborhood display)
  const selectedZipData = useMemo(() => {
    if (!selectedZipCode) return null;
    return zipCodes.find(z => z.zip_code === selectedZipCode);
  }, [selectedZipCode, zipCodes]);

  // Memoize organization options for Organization mode.
  // Returns [{value, label}] entries; subgroups (e.g., SVdP districts) appear
  // nested under their parent with a "— " indent prefix on the label.
  const parentOrgOptions = useMemo(
    () => buildParentDropdownOptions(organizations),
    [organizations]
  );

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
          />
        );
      case SEARCH_MODES.LOCATION:
        return (
          <LocationFilters
            directory={directory}
            selectedLocationZip={selectedLocationZip}
            setSelectedLocationZip={handleLocationZipChange}
            selectedCounty={selectedLocationCounty}
            setSelectedCounty={handleCountyChange}
            selectedCity={selectedLocationCity}
            setSelectedCity={handleCityChange}
            selectedNeighborhood={selectedLocationNeighborhood}
            setSelectedNeighborhood={handleNeighborhoodChange}
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
              setLlmRelatedSearches([]);
            }}
            isLoading={llmSearchLoading}
            interpretation={llmSearchInterpretation}
            error={llmSearchError}
          />
        );
      default:
        return <ZipCodeFilters zipCodeOptions={zipCodeOptions} />;
    }
  };

  // Short labels for the mobile mode toggle (kept terse so all four fit one row).
  const getModeLabel = (mode) => {
    switch (mode) {
      case SEARCH_MODES.ZIPCODE: return "Zip";
      case SEARCH_MODES.ORGANIZATION: return "Org";
      case SEARCH_MODES.LOCATION: return "Loc";
      case SEARCH_MODES.LLM: return "Ask";
      default: return "Zip";
    }
  };

  // Mobile filter row for the active mode — squeezed native selects (Zip/Org/Loc)
  // or the lightweight Ask input. Reuses the same handlers/options as desktop.
  const renderMobileFilters = () => {
    switch (activeSearchMode) {
      case SEARCH_MODES.ZIPCODE:
        return (
          <MobileSelect
            placeholder="Choose Zip Code"
            options={zipCodeOptions}
            value={selectedZipCode}
            onChange={handleZipCodeChange}
          />
        );
      case SEARCH_MODES.ORGANIZATION:
        return (
          <OrganizationFilters
            mobile
            parentOrgOptions={parentOrgOptions}
            organizations={organizations}
            selectedParent={selectedParentOrg}
            setSelectedParent={handleParentOrgChange}
            selectedChild={selectedChildOrg}
            setSelectedChild={handleChildOrgChange}
          />
        );
      case SEARCH_MODES.LOCATION:
        return (
          <LocationFilters
            mobile
            directory={directory}
            selectedLocationZip={selectedLocationZip}
            setSelectedLocationZip={handleLocationZipChange}
            selectedCounty={selectedLocationCounty}
            setSelectedCounty={handleCountyChange}
            selectedCity={selectedLocationCity}
            setSelectedCity={handleCityChange}
            selectedNeighborhood={selectedLocationNeighborhood}
            setSelectedNeighborhood={handleNeighborhoodChange}
          />
        );
      case SEARCH_MODES.LLM:
        return (
          <MobileLLMInput
            query={llmSearchQuery}
            setQuery={setLlmSearchQuery}
            onSearch={handleLLMSearch}
            isLoading={llmSearchLoading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <nav className="bg-navbar2-bg">
      {/* ========== DESKTOP LAYOUT (md+) ========== */}
      <div
        className="hidden lg:flex items-center justify-between"
        style={{
          height: "var(--height-navbar2)",
          paddingLeft: "var(--padding-navbar2-left)",
          paddingRight: "var(--padding-navbar2-right)",
        }}
      >
        {/* Left side - Mode-specific filters */}
        <div
          className="flex items-center min-w-0 flex-shrink"
          style={{ gap: "var(--gap-navbar2-filters)" }}
        >
          {renderFilters()}
        </div>

        {/* Right side - Search mode buttons */}
        <div
          className="flex items-center flex-shrink-0"
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
            label="Ask a Question"
            isActive={activeSearchMode === SEARCH_MODES.LLM}
            onClick={() => handleModeChange(SEARCH_MODES.LLM)}
          />
        </div>
      </div>

      {/* ========== RELATED-SEARCH CHIP STRIP (LLM mode only) ==========
          Renders below the main NavBar2 row — only when Ask-a-Question is
          active and the LLM returned suggestions. Doesn't grow the NavBar2
          row itself. */}
      {activeSearchMode === SEARCH_MODES.LLM &&
        llmRelatedSearches?.length > 0 &&
        !llmSearchLoading && (
          <div
            className="hidden lg:flex items-center flex-wrap gap-2"
            style={{
              backgroundColor: "var(--color-navbar2-bg)",
              paddingLeft: "var(--padding-navbar2-left)",
              paddingRight: "var(--padding-navbar2-right)",
              paddingTop: "8px",
              paddingBottom: "10px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className="text-white/60 text-xs font-opensans uppercase tracking-wider">
              Try:
            </span>
            {llmRelatedSearches.slice(0, 5).map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleLLMSearch(suggestion)}
                className="font-opensans transition-all hover:brightness-110"
                style={{
                  fontSize: "13px",
                  padding: "5px 12px",
                  borderRadius: "999px",
                  backgroundColor: "#FFFFFF",
                  color: "#222831",
                  border: "1px solid rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

      {/* ========== MOBILE LAYOUT (<lg) ========== */}
      {/* Row 1: mode toggle (Zip · Org · Loc · Ask). Row 2: the active mode's
          filters as squeezed native selects (or the Ask input). Distance and
          neighborhood are intentionally omitted on mobile. */}
      <div className="lg:hidden">
        <div className="flex items-stretch px-3 pt-2" style={{ gap: 4 }}>
          {[SEARCH_MODES.ZIPCODE, SEARCH_MODES.ORGANIZATION, SEARCH_MODES.LOCATION, SEARCH_MODES.LLM].map((mode) => {
            const isActive = activeSearchMode === mode;
            return (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className="font-opensans flex-1 text-center transition-all duration-150"
                style={{
                  padding: "6px 4px",
                  background: "transparent",
                  color: isActive ? "var(--color-accent-gold)" : "var(--color-navbar2-mode-inactive-text)",
                  fontSize: "15px",
                  fontWeight: isActive ? 600 : 500,
                  borderBottom: `2px solid ${isActive ? "var(--color-accent-gold)" : "transparent"}`,
                  whiteSpace: "nowrap",
                }}
              >
                {getModeLabel(mode)}
              </button>
            );
          })}
        </div>
        <div className="flex items-center px-3 py-2" style={{ gap: 6 }}>
          {renderMobileFilters()}
        </div>
      </div>
    </nav>
  );
}