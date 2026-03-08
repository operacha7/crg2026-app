// src/layout/NavBar2Reports.js
// Navigation bar for Reports page
// Default reports: Organization dropdown (left) + Daily/Monthly toggle (right)
// Coverage report: County, Parent Org, Child Org, Assistance Type (chip selector), Status, Reset
// Dropdowns are cross-filtered: each shows only options valid given other selections

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { fetchOrganizations } from "../services/usageService";
import { useAppData } from "../Contexts/AppDataContext";
import { ChevronDownIcon } from "../icons/ChevronDownIcon";
import { DownloadIcon } from "../icons/DownloadIcon";
import { getIconByName } from "../icons/iconMap";

// Group colors for the 6 assistance groups (matches NavBar3)
const GROUP_COLORS = {
  1: "var(--color-assistance-group1)",
  2: "var(--color-assistance-group2)",
  3: "var(--color-assistance-group3)",
  4: "var(--color-assistance-group4)",
  5: "var(--color-assistance-group5)",
  6: "var(--color-assistance-group6)",
};

// Map status name to status_id
function statusNameToId(name) {
  switch (name) {
    case "Active": return 1;
    case "Limited": return 2;
    case "Inactive": return 3;
    default: return 1;
  }
}

// Sliding toggle component
function SlideToggle({ leftLabel, rightLabel, isRight, onToggle }) {
  return (
    <div
      className="relative flex items-center rounded-full cursor-pointer"
      style={{
        backgroundColor: "#222831",
        padding: "4px",
        width: "180px",
        height: "38px",
      }}
      onClick={onToggle}
    >
      <div
        className="absolute rounded-full transition-all duration-300 ease-in-out"
        style={{
          backgroundColor: "var(--color-navbar2-btn-active-bg)",
          width: "calc(50% - 4px)",
          height: "30px",
          left: isRight ? "calc(50% + 2px)" : "4px",
        }}
      />
      <span
        className={`relative z-10 flex-1 text-center font-opensans text-sm transition-colors duration-300 ${
          !isRight ? "text-navbar2-btn-active-text" : "text-white/70"
        }`}
        style={{ fontWeight: 500 }}
      >
        {leftLabel}
      </span>
      <span
        className={`relative z-10 flex-1 text-center font-opensans text-sm transition-colors duration-300 ${
          isRight ? "text-navbar2-btn-active-text" : "text-white/70"
        }`}
        style={{ fontWeight: 500 }}
      >
        {rightLabel}
      </span>
    </div>
  );
}

// Click dropdown component - opens on click, closes on click outside
function HoverDropdown({ value, options, onChange, placeholder, inactiveValue = "All Registered Organizations", format1 = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const containerRef = useRef(null);

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
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      {(() => {
        const isActive = format1 && value && value !== inactiveValue;
        const btnBg = format1
          ? (isActive ? "var(--color-navbar2-btn-active-bg)" : "var(--color-navbar2-btn-inactive-bg)")
          : "#2E5A88";
        const btnColor = format1
          ? (isActive ? "var(--color-navbar2-btn-active-text)" : "var(--color-navbar2-btn-inactive-text)")
          : "#FFFFFF";
        return (
          <button
            onClick={handleClick}
            className="flex items-center gap-1 font-opensans transition-all duration-200 hover:brightness-125"
            style={{
              height: "var(--height-navbar2-btn)",
              paddingLeft: "var(--padding-navbar2-btn-x)",
              paddingRight: "var(--padding-navbar2-btn-x)",
              borderRadius: "var(--radius-navbar2-btn)",
              fontSize: format1 ? "var(--font-size-navbar2-btn)" : "var(--font-size-navbar2-dropdown)",
              fontWeight: format1 ? "var(--font-weight-navbar2-btn)" : "var(--font-weight-navbar2-dropdown)",
              letterSpacing: format1 ? "var(--letter-spacing-navbar2-btn)" : "var(--letter-spacing-navbar2-dropdown)",
              backgroundColor: btnBg,
              color: btnColor,
              border: "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)",
              whiteSpace: "nowrap",
            }}
          >
            {value || placeholder}
            <ChevronDownIcon size={16} color="currentColor" />
          </button>
        );
      })()}

      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded shadow-lg z-50 max-h-[400px] overflow-y-auto"
          style={{ backgroundColor: "var(--color-dropdown-bg)", minWidth: "380px" }}
        >
          {options.map((option) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHoveredOption(option)}
              onMouseLeave={() => setHoveredOption(null)}
              className="w-full text-left px-4 py-2 font-opensans"
              style={{
                fontSize: "14px",
                color: "var(--color-dropdown-text)",
                backgroundColor: hoveredOption === option ? "var(--color-dropdown-hover-bg)" : (value === option ? "var(--color-dropdown-active-bg)" : "transparent"),
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Searchable dropdown - type to filter options
function SearchableDropdown({ placeholder, options = [], value, onChange, maxChars = 74, format1 = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const hasValue = value && value !== "";

  const truncateText = (text) => {
    if (!text || text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + "...";
  };

  const filteredOptions = useMemo(() => {
    if (!searchText.trim()) return options;
    const search = searchText.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(search));
  }, [options, searchText]);

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

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [isOpen]);

  const handleClick = () => setIsOpen(!isOpen);

  const handleSelect = (option) => {
    onChange?.(option);
    setIsOpen(false);
    setSearchText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchText("");
    } else if (e.key === "Enter" && filteredOptions.length === 1) {
      handleSelect(filteredOptions[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {(() => {
        const isActive = format1 && hasValue;
        const btnBg = format1
          ? (isActive ? "var(--color-navbar2-btn-active-bg)" : "var(--color-navbar2-btn-inactive-bg)")
          : "#2E5A88";
        const btnColor = format1
          ? (isActive ? "var(--color-navbar2-btn-active-text)" : "var(--color-navbar2-btn-inactive-text)")
          : "#FFFFFF";
        return (
          <button
            onClick={handleClick}
            className="flex items-center gap-1 font-opensans transition-all duration-200 hover:brightness-125"
            style={{
              height: "var(--height-navbar2-btn)",
              paddingLeft: "var(--padding-navbar2-btn-x)",
              paddingRight: "var(--padding-navbar2-btn-x)",
              borderRadius: "var(--radius-navbar2-btn)",
              fontSize: format1 ? "var(--font-size-navbar2-btn)" : "var(--font-size-navbar2-dropdown)",
              fontWeight: format1 ? "var(--font-weight-navbar2-btn)" : "var(--font-weight-navbar2-dropdown)",
              letterSpacing: format1 ? "var(--letter-spacing-navbar2-btn)" : "var(--letter-spacing-navbar2-dropdown)",
              backgroundColor: btnBg,
              color: btnColor,
              border: "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)",
              whiteSpace: "nowrap",
            }}
          >
            {hasValue ? truncateText(value) : placeholder}
            <ChevronDownIcon size={16} color="currentColor" />
          </button>
        );
      })()}

      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded shadow-lg z-50"
          style={{ backgroundColor: "var(--color-dropdown-bg)", minWidth: "700px" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-gray-300">
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
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
          <div className="max-h-[350px] overflow-y-auto">
            <button
              onClick={(e) => { e.stopPropagation(); handleSelect(""); }}
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
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-2 text-gray-500 italic font-opensans" style={{ fontSize: "14px" }}>
                No matches found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); handleSelect(opt); }}
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Map 2 Assistance Button - mirrors NavBar3's Choose/Change Assistance pattern
// Three states: default (cream), prompting (amber bounce), active (teal)
function Map2AssistanceButton({ hasSelection, hasAnyFilter, onClick, buttonRef }) {
  let buttonState;
  if (hasSelection) {
    buttonState = "active";
  } else if (hasAnyFilter) {
    buttonState = "prompting";
  } else {
    buttonState = "default";
  }

  const prevStateRef = useRef(buttonState);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (buttonState === "prompting" && prevStateRef.current !== "prompting") {
      setIsAnimating(true);
      const timeout = setTimeout(() => setIsAnimating(false), 1500);
      return () => clearTimeout(timeout);
    }
    prevStateRef.current = buttonState;
  }, [buttonState]);

  const stateStyles = {
    default: {
      backgroundColor: "var(--color-navbar2-btn-inactive-bg)",
      color: "var(--color-navbar2-btn-inactive-text)",
      border: "var(--border-width-btn) solid var(--color-navbar2-btn-inactive-border)",
    },
    prompting: {
      backgroundColor: "var(--color-navbar3-btn-prompting-bg)",
      color: "var(--color-navbar3-btn-prompting-text)",
      border: "var(--border-width-btn) solid var(--color-navbar3-btn-prompting-border)",
    },
    active: {
      backgroundColor: "var(--color-navbar2-btn-active-bg)",
      color: "var(--color-navbar2-btn-active-text)",
      border: "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)",
    },
  };

  const glowColor = "rgba(249, 178, 51, 0.7)";
  const animationStyles = isAnimating
    ? {
        boxShadow: `0 0 0 3px ${glowColor}, 0 0 15px 5px ${glowColor}`,
        animation: "map2AssistanceBounce 0.6s ease-out",
      }
    : { boxShadow: "none" };

  const buttonText = hasSelection ? "Change Assistance" : "Choose Assistance";

  return (
    <>
      <style>{`
        @keyframes map2AssistanceBounce {
          0% { transform: scale(1); }
          20% { transform: scale(1.08) translateY(-3px); }
          40% { transform: scale(0.97) translateY(1px); }
          60% { transform: scale(1.03) translateY(-1px); }
          80% { transform: scale(0.99); }
          100% { transform: scale(1); }
        }
      `}</style>
      <button
        ref={buttonRef}
        onClick={onClick}
        className="font-opensans transition-all duration-200 hover:brightness-125 flex items-center gap-2"
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-btn)",
          fontWeight: "var(--font-weight-navbar2-btn)",
          letterSpacing: "var(--letter-spacing-navbar2-btn)",
          whiteSpace: "nowrap",
          ...stateStyles[buttonState],
          ...animationStyles,
        }}
      >
        {buttonText}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
    </>
  );
}

// Assistance chip dropdown - simple dropdown showing colored chips, click to select
// Used by Map 2 and Coverage Report (single selection, shows only filtered/available types)
function AssistanceChipDropdown({ isOpen, assistanceList, selectedName, onSelect, panelRef }) {
  const [hoveredOption, setHoveredOption] = useState(null);

  const sortedAssistance = useMemo(() => {
    return [...assistanceList].sort((a, b) => parseInt(a.assist_id) - parseInt(b.assist_id));
  }, [assistanceList]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-full mt-2 rounded shadow-lg z-50 p-4"
      style={{ backgroundColor: "var(--color-dropdown-bg)", minWidth: "500px" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap gap-2">
        {sortedAssistance.map((item) => {
          const groupColor = GROUP_COLORS[item.group] || GROUP_COLORS[1];
          const iconResult = item.icon ? getIconByName(item.icon) : null;
          const IconComponents = iconResult
            ? (Array.isArray(iconResult) ? iconResult : [iconResult])
            : [];
          const isSelected = selectedName === item.assistance;

          return (
            <button
              key={item.assist_id}
              onClick={(e) => { e.stopPropagation(); onSelect(item.assistance); }}
              onMouseEnter={() => setHoveredOption(item.assist_id)}
              onMouseLeave={() => setHoveredOption(null)}
              className="font-opensans transition-all duration-200 hover:brightness-110 flex items-center justify-center gap-2"
              style={{
                backgroundColor: isSelected ? "var(--color-assistance-selected-bg)" : groupColor,
                color: "var(--color-assistance-text)",
                padding: "8px 12px",
                borderRadius: "var(--radius-assistance-chip)",
                fontSize: "var(--font-size-assistance-chip)",
                letterSpacing: "var(--letter-spacing-assistance-chip)",
                fontWeight: 500,
                border: isSelected
                  ? "1px solid #000"
                  : (hoveredOption === item.assist_id ? "1px solid #666" : "1px solid transparent"),
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {IconComponents.map((IconComp, idx) => (
                <IconComp key={idx} size={20} />
              ))}
              {item.assistance}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_OPTIONS = ["Active", "Limited", "Inactive"];

export default function NavBar2Reports({
  selectedReport,
  selectedOrg,
  onOrgChange,
  viewMode,
  onViewModeChange,
  // Coverage report filter props
  coverageCounty,
  onCoverageCountyChange,
  coverageZipCode,
  onCoverageZipCodeChange,
  coverageParentOrg,
  onCoverageParentOrgChange,
  coverageChildOrg,
  onCoverageChildOrgChange,
  coverageAssistanceType,
  onCoverageAssistanceTypeChange,
  coverageStatus,
  onCoverageStatusChange,
  onCoverageReset,
  // Zip Code Map (Mapbox) filter props
  map2County,
  onMap2CountyChange,
  map2ZipCode,
  onMap2ZipCodeChange,
  map2ParentOrg,
  onMap2ParentOrgChange,
  map2Organization,
  onMap2OrganizationChange,
  map2AssistanceType,
  onMap2AssistanceTypeChange,
  onMap2Reset,
  onMap2Download,
}) {
  const [registeredOrgs, setRegisteredOrgs] = useState([]);
  const { organizations, assistance, zipCodes, directory } = useAppData();

  // Fetch registered organizations on mount
  useEffect(() => {
    async function loadOrgs() {
      const orgs = await fetchOrganizations();
      setRegisteredOrgs(orgs);
    }
    loadOrgs();
  }, []);

  // Build dropdown options for default reports
  const orgOptions = useMemo(() => [
    "All Registered Organizations",
    ...registeredOrgs
      .filter(o => o.reg_organization !== "Administrator")
      .map(o => o.reg_organization),
  ], [registeredOrgs]);

  // === Shared geographic helpers (used by both Coverage and Map 2) ===

  // All houston-area zips grouped by county
  const houstonZipsByCounty = useMemo(() => {
    const byCounty = {};
    zipCodes.filter(z => z.houston_area === "Y").forEach(z => {
      if (!byCounty[z.county]) byCounty[z.county] = new Set();
      byCounty[z.county].add(z.zip_code);
    });
    return byCounty;
  }, [zipCodes]);

  // All houston-area zip codes as a flat set
  const allHoustonZips = useMemo(() => {
    return new Set(zipCodes.filter(z => z.houston_area === "Y").map(z => z.zip_code));
  }, [zipCodes]);

  // Helper: does this org serve the selected geographic area?
  // Checks client_zip_codes against county zips, specific zip, or all Houston zips
  const orgServesArea = useCallback((r, countyVal, zipVal) => {
    const clientZips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
    // 99999 = serves all Houston-area zips
    if (clientZips.includes("99999")) return true;
    // Specific zip selected
    if (zipVal) return clientZips.includes(zipVal);
    // County selected
    if (countyVal && countyVal !== "All Counties") {
      const countyZipSet = houstonZipsByCounty[countyVal];
      if (!countyZipSet) return false;
      return clientZips.some(z => countyZipSet.has(z));
    }
    // No geographic filter - show all
    return true;
  }, [houstonZipsByCounty]);

  // === Map 2 Assistance dropdown state ===
  const [map2PanelOpen, setMap2PanelOpen] = useState(false);
  const map2PanelRef = useRef(null);
  const map2AssistBtnRef = useRef(null);

  // Get selected assistance info (for chip display)
  const map2SelectedAssistInfo = useMemo(() => {
    if (!map2AssistanceType) return null;
    const match = assistance.find(a => a.assistance === map2AssistanceType);
    if (!match) return null;
    return {
      name: match.assistance,
      icon: match.icon,
      group: match.group,
      assist_id: match.assist_id,
    };
  }, [map2AssistanceType, assistance]);

  // Whether any geographic/org filter is set (for prompting state)
  const map2HasAnyFilter = Boolean(
    (map2County && map2County !== "All Counties") || map2ZipCode || map2ParentOrg || map2Organization
  );

  // Handle selecting a type in the Map 2 dropdown (click = select and close)
  const handleMap2AssistSelect = useCallback((assistanceName) => {
    onMap2AssistanceTypeChange(assistanceName);
    setMap2PanelOpen(false);
  }, [onMap2AssistanceTypeChange]);

  // Close Map 2 dropdown on click outside
  useEffect(() => {
    function handleMap2ClickOutside(event) {
      if (!map2PanelOpen) return;
      const isOutsidePanel = map2PanelRef.current && !map2PanelRef.current.contains(event.target);
      const isOutsideButton = map2AssistBtnRef.current && !map2AssistBtnRef.current.contains(event.target);
      if (isOutsidePanel && isOutsideButton) {
        setMap2PanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMap2ClickOutside);
    return () => document.removeEventListener("mousedown", handleMap2ClickOutside);
  }, [map2PanelOpen]);

  // === Coverage Report Assistance dropdown state ===
  const [coveragePanelOpen, setCoveragePanelOpen] = useState(false);
  const coveragePanelRef = useRef(null);
  const coverageAssistBtnRef = useRef(null);

  // === Cross-filtered coverage report options ===
  // Each dropdown shows only options that exist given ALL other filter selections.

  const statusId = useMemo(() => statusNameToId(coverageStatus), [coverageStatus]);

  const assistId = useMemo(() => {
    if (!coverageAssistanceType) return null;
    const match = assistance.find(a => a.assistance === coverageAssistanceType);
    return match ? match.assist_id : null;
  }, [coverageAssistanceType, assistance]);

  // County options: counties that have zip codes served by orgs matching other filters
  // (Always include "All Counties" at top)
  const countyOptions = useMemo(() => {
    // Filter directory by status + assistance + parent + child
    let filtered = directory.filter(r => r.status_id === statusId);
    if (assistId) filtered = filtered.filter(r => r.assist_id === assistId);
    if (coverageParentOrg) filtered = filtered.filter(r => r.org_parent === coverageParentOrg);
    if (coverageChildOrg) filtered = filtered.filter(r => r.organization === coverageChildOrg);

    // Collect all zip codes served by these orgs
    const servedZips = new Set();
    let hasWildcard = false;
    filtered.forEach(r => {
      (r.client_zip_codes || []).forEach(z => {
        if (z === "99999") { hasWildcard = true; } else { servedZips.add(z); }
      });
    });

    // If any org has 99999, all counties are available
    if (hasWildcard) {
      const allCounties = [...new Set(
        zipCodes.filter(z => z.houston_area === "Y").map(z => z.county).filter(Boolean)
      )];
      return ["All Counties", ...allCounties.sort()];
    }

    // Otherwise, only counties whose zip codes are served
    const counties = [...new Set(
      zipCodes
        .filter(z => z.houston_area === "Y" && servedZips.has(z.zip_code))
        .map(z => z.county)
        .filter(Boolean)
    )];
    return ["All Counties", ...counties.sort()];
  }, [directory, zipCodes, statusId, assistId, coverageParentOrg, coverageChildOrg]);

  // Zip code options for coverage: filtered by county (or all houston-area zips)
  const coverageZipCodeOptions = useMemo(() => {
    if (coverageCounty && coverageCounty !== "All Counties") {
      const countyZipSet = houstonZipsByCounty[coverageCounty];
      return countyZipSet ? [...countyZipSet].sort() : [];
    }
    return [...allHoustonZips].sort();
  }, [coverageCounty, houstonZipsByCounty, allHoustonZips]);

  // Parent org options: filtered by status + assistance + county/zip (via client_zip_codes)
  const parentOrgOptions = useMemo(() => {
    let filtered = directory.filter(r => r.status_id === statusId);
    if (assistId) filtered = filtered.filter(r => r.assist_id === assistId);
    filtered = filtered.filter(r => orgServesArea(r, coverageCounty, coverageZipCode));
    const parents = [...new Set(filtered.map(r => r.org_parent).filter(Boolean))];
    return parents.sort();
  }, [directory, statusId, assistId, coverageCounty, coverageZipCode, orgServesArea]);

  // Child org options: filtered by status + assistance + county/zip + parent
  const childOrgOptions = useMemo(() => {
    let filtered = directory.filter(r => r.status_id === statusId);
    if (assistId) filtered = filtered.filter(r => r.assist_id === assistId);
    filtered = filtered.filter(r => orgServesArea(r, coverageCounty, coverageZipCode));
    if (coverageParentOrg) filtered = filtered.filter(r => r.org_parent === coverageParentOrg);
    const children = [...new Set(filtered.map(r => r.organization).filter(Boolean))];
    return children.sort();
  }, [directory, statusId, assistId, coverageCounty, coverageZipCode, coverageParentOrg, orgServesArea]);

  // Assistance options: filtered by status + county/zip + parent + child
  const availableAssistance = useMemo(() => {
    let filtered = directory.filter(r => r.status_id === statusId);
    filtered = filtered.filter(r => orgServesArea(r, coverageCounty, coverageZipCode));
    if (coverageParentOrg) filtered = filtered.filter(r => r.org_parent === coverageParentOrg);
    if (coverageChildOrg) filtered = filtered.filter(r => r.organization === coverageChildOrg);
    const availableIds = new Set(filtered.map(r => r.assist_id));
    return assistance.filter(a => availableIds.has(a.assist_id));
  }, [directory, assistance, statusId, coverageCounty, coverageZipCode, coverageParentOrg, coverageChildOrg, orgServesArea]);

  // Selected assistance info for chip display (coverage)
  const coverageSelectedAssistInfo = useMemo(() => {
    if (!coverageAssistanceType) return null;
    const match = assistance.find(a => a.assistance === coverageAssistanceType);
    if (!match) return null;
    return {
      name: match.assistance,
      icon: match.icon,
      group: match.group,
      assist_id: match.assist_id,
    };
  }, [coverageAssistanceType, assistance]);

  // Whether any non-assistance filter is set (for prompting state)
  const coverageHasAnyFilter = Boolean(
    (coverageCounty && coverageCounty !== "All Counties") || coverageZipCode || coverageParentOrg || coverageChildOrg
  );

  // Handle selecting a type in the coverage dropdown (click = select and close)
  const handleCoverageAssistSelect = useCallback((assistanceName) => {
    onCoverageAssistanceTypeChange(assistanceName);
    setCoveragePanelOpen(false);
  }, [onCoverageAssistanceTypeChange]);

  // Close coverage dropdown on click outside
  useEffect(() => {
    function handleCoverageClickOutside(event) {
      if (!coveragePanelOpen) return;
      const isOutsidePanel = coveragePanelRef.current && !coveragePanelRef.current.contains(event.target);
      const isOutsideButton = coverageAssistBtnRef.current && !coverageAssistBtnRef.current.contains(event.target);
      if (isOutsidePanel && isOutsideButton) {
        setCoveragePanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleCoverageClickOutside);
    return () => document.removeEventListener("mousedown", handleCoverageClickOutside);
  }, [coveragePanelOpen]);

  // Auto-clear coverage zip code if county changes and zip is no longer in that county
  useEffect(() => {
    if (coverageZipCode && !coverageZipCodeOptions.includes(coverageZipCode)) {
      onCoverageZipCodeChange?.("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverageZipCodeOptions]);

  // When parent changes, reset child if it's no longer valid
  useEffect(() => {
    if (coverageChildOrg && !childOrgOptions.includes(coverageChildOrg)) {
      onCoverageChildOrgChange?.("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverageParentOrg, childOrgOptions]);

  // When filters change, clear assistance if it's no longer available
  useEffect(() => {
    if (coverageAssistanceType && !availableAssistance.find(a => a.assistance === coverageAssistanceType)) {
      onCoverageAssistanceTypeChange?.("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableAssistance]);

  const handleToggle = () => {
    onViewModeChange(viewMode === "daily" ? "monthly" : "daily");
  };

  // === Zip Code Map (Mapbox) cross-filtered options ===
  // Filter order: County → Zip Code → Parent Org → Organization → Assistance → Status (frozen Active)
  // Filtering is based on client_zip_codes (where assistance is provided), NOT org_zip_code.
  // 99999 in client_zip_codes = org serves all Houston-area zips (wildcard).
  // Uses shared helpers: houstonZipsByCounty, allHoustonZips, orgServesArea (defined above)

  // County options - all houston-area counties (always full list)
  const map2CountyOptions = useMemo(() => {
    const counties = [...new Set(
      zipCodes.filter(z => z.houston_area === "Y").map(z => z.county).filter(Boolean)
    )];
    return ["All Counties", ...counties.sort()];
  }, [zipCodes]);

  // Zip code options - filtered by county (or all houston-area zips if All Counties)
  const map2ZipCodeOptions = useMemo(() => {
    if (map2County && map2County !== "All Counties") {
      const countyZipSet = houstonZipsByCounty[map2County];
      return countyZipSet ? [...countyZipSet].sort() : [];
    }
    return [...allHoustonZips].sort();
  }, [map2County, houstonZipsByCounty, allHoustonZips]);

  // Parent org options - filtered by county/zip via client_zip_codes
  const map2ParentOrgOptions = useMemo(() => {
    let filtered = directory.filter(r => r.status_id === 1);
    filtered = filtered.filter(r => orgServesArea(r, map2County, map2ZipCode));
    const parents = [...new Set(filtered.map(r => r.org_parent).filter(Boolean))];
    return parents.sort();
  }, [directory, map2County, map2ZipCode, orgServesArea]);

  // Organization options - filtered by county/zip + parent
  const map2OrgOptions = useMemo(() => {
    let filtered = directory.filter(r => r.status_id === 1);
    filtered = filtered.filter(r => orgServesArea(r, map2County, map2ZipCode));
    if (map2ParentOrg) filtered = filtered.filter(r => r.org_parent === map2ParentOrg);
    const orgs = [...new Set(filtered.map(r => r.organization).filter(Boolean))];
    return orgs.sort();
  }, [directory, map2County, map2ZipCode, map2ParentOrg, orgServesArea]);

  // Assistance options - filtered by county/zip + parent + org
  const map2AvailableAssistance = useMemo(() => {
    let filtered = directory.filter(r => r.status_id === 1);
    filtered = filtered.filter(r => orgServesArea(r, map2County, map2ZipCode));
    if (map2ParentOrg) filtered = filtered.filter(r => r.org_parent === map2ParentOrg);
    if (map2Organization) filtered = filtered.filter(r => r.organization === map2Organization);
    const availableIds = new Set(filtered.map(r => r.assist_id));
    return assistance.filter(a => availableIds.has(a.assist_id));
  }, [directory, assistance, map2County, map2ZipCode, map2ParentOrg, map2Organization, orgServesArea]);

  // Auto-clear zip code if county changes and zip is no longer in that county
  useEffect(() => {
    if (map2ZipCode && !map2ZipCodeOptions.includes(map2ZipCode)) {
      onMap2ZipCodeChange?.("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map2ZipCodeOptions]);

  // Auto-clear parent org if no longer valid
  useEffect(() => {
    if (map2ParentOrg && !map2ParentOrgOptions.includes(map2ParentOrg)) {
      onMap2ParentOrgChange?.("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map2ParentOrgOptions]);

  // Auto-clear organization if no longer valid
  useEffect(() => {
    if (map2Organization && !map2OrgOptions.includes(map2Organization)) {
      onMap2OrganizationChange?.("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map2OrgOptions]);

  // Auto-clear assistance if no longer valid
  useEffect(() => {
    if (map2AssistanceType && !map2AvailableAssistance.find(a => a.assistance === map2AssistanceType)) {
      onMap2AssistanceTypeChange?.("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map2AvailableAssistance]);

  return (
    <nav
      className="bg-navbar2-bg flex items-center"
      style={{
        height: "var(--height-navbar2)",
        paddingLeft: "var(--padding-navbar2-left)",
        paddingRight: "var(--padding-navbar2-right)",
      }}
    >
      {selectedReport === "map2" ? (
        /* Zip Code Map filters: County → Zip → Parent → Organization → Assistance → Status */
        <div
          className="flex items-center justify-between w-full"
        >
        <div
          className="flex items-center"
          style={{ gap: "var(--gap-navbar2-filters)" }}
        >
          {/* County - Format 1 styling */}
          <HoverDropdown
            value={map2County}
            options={map2CountyOptions}
            onChange={(val) => {
              onMap2CountyChange(val);
              onMap2ZipCodeChange("");
            }}
            placeholder="All Counties"
            inactiveValue="All Counties"
            format1={true}
          />
          {/* Zip Code - Format 1 styling (searchable for type-ahead) */}
          <SearchableDropdown
            placeholder="-- Zip Code --"
            options={map2ZipCodeOptions}
            value={map2ZipCode}
            onChange={onMap2ZipCodeChange}
            format1={true}
          />
          {/* Parent Organization - Format 1 styling */}
          <SearchableDropdown
            placeholder="-- Parent Org --"
            options={map2ParentOrgOptions}
            value={map2ParentOrg}
            onChange={onMap2ParentOrgChange}
            format1={true}
          />
          {/* Organization - Format 1 styling */}
          <SearchableDropdown
            placeholder="-- Organization --"
            options={map2OrgOptions}
            value={map2Organization}
            onChange={onMap2OrganizationChange}
            format1={true}
          />
          {/* Choose/Change Assistance + chip */}
          <div className="relative flex items-center gap-2">
            <Map2AssistanceButton
              hasSelection={Boolean(map2AssistanceType)}
              hasAnyFilter={map2HasAnyFilter}
              onClick={() => setMap2PanelOpen(!map2PanelOpen)}
              buttonRef={map2AssistBtnRef}
            />
            {/* Selected assistance chip with group color (no X) */}
            {map2SelectedAssistInfo && (() => {
              const groupColor = GROUP_COLORS[map2SelectedAssistInfo.group] || GROUP_COLORS[1];
              const iconResult = map2SelectedAssistInfo.icon ? getIconByName(map2SelectedAssistInfo.icon) : null;
              const IconComponents = iconResult
                ? (Array.isArray(iconResult) ? iconResult : [iconResult])
                : [];
              return (
                <div
                  className="font-opensans flex items-center gap-2"
                  style={{
                    height: "var(--height-navbar2-btn)",
                    paddingLeft: "12px",
                    paddingRight: "12px",
                    borderRadius: "var(--radius-assistance-chip)",
                    fontSize: "var(--font-size-assistance-chip)",
                    letterSpacing: "var(--letter-spacing-assistance-chip)",
                    fontWeight: 500,
                    backgroundColor: groupColor,
                    color: "var(--color-assistance-text)",
                    border: "1px solid transparent",
                    whiteSpace: "nowrap",
                  }}
                >
                  {IconComponents.map((IconComp, idx) => (
                    <IconComp key={idx} size={20} />
                  ))}
                  {map2SelectedAssistInfo.name}
                </div>
              );
            })()}
            {/* Assistance chip dropdown */}
            <AssistanceChipDropdown
              isOpen={map2PanelOpen}
              assistanceList={map2AvailableAssistance}
              selectedName={map2AssistanceType}
              onSelect={handleMap2AssistSelect}
              panelRef={map2PanelRef}
            />
          </div>
          {/* Frozen Active status - teal bg, white text, 50% opacity */}
          <div
            className="flex items-center font-opensans"
            style={{
              height: "var(--height-navbar2-btn)",
              paddingLeft: "var(--padding-navbar2-btn-x)",
              paddingRight: "var(--padding-navbar2-btn-x)",
              borderRadius: "var(--radius-navbar2-btn)",
              fontSize: "var(--font-size-navbar2-btn)",
              fontWeight: "var(--font-weight-navbar2-btn)",
              letterSpacing: "var(--letter-spacing-navbar2-btn)",
              backgroundColor: "var(--color-navbar2-btn-active-bg)",
              color: "var(--color-navbar2-btn-active-text)",
              border: "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)",
              whiteSpace: "nowrap",
              opacity: 0.5,
            }}
            title="Only active organizations are shown"
          >
            Active
          </div>
          <button
            onClick={onMap2Reset}
            className="font-opensans transition-all duration-200 hover:brightness-125"
            style={{
              fontSize: "13px",
              color: "#FFFFFF",
              background: "none",
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              textDecoration: "underline",
            }}
          >
            Reset Filters
          </button>
        </div>
        {/* Download button - right-aligned, matches Matt Report style */}
        <button
          onClick={onMap2Download}
          className="flex items-center gap-2 transition-all duration-200 hover:brightness-125"
          style={{
            background: "#4285F4",
            border: "none",
            borderRadius: "6px",
            padding: "6px 14px",
            cursor: "pointer",
            color: "#FFFFFF",
            whiteSpace: "nowrap",
          }}
          title="Download map as PNG"
        >
          <DownloadIcon size={20} color="#FFFFFF" />
          <span className="font-opensans" style={{ fontSize: "18px", fontWeight: 400 }}>
            Download
          </span>
        </button>
        </div>
      ) : selectedReport === "coverage" ? (
        /* Coverage report filters - Format 1/2/3 styling (matches Map 2) */
        <div
          className="flex items-center"
          style={{ gap: "var(--gap-navbar2-filters)" }}
        >
          {/* County - Format 1 styling */}
          <HoverDropdown
            value={coverageCounty}
            options={countyOptions}
            onChange={(val) => {
              onCoverageCountyChange(val);
              onCoverageZipCodeChange("");
            }}
            placeholder="All Counties"
            inactiveValue="All Counties"
            format1={true}
          />
          {/* Zip Code - Format 1 styling (searchable for type-ahead) */}
          <SearchableDropdown
            placeholder="-- Zip Code --"
            options={coverageZipCodeOptions}
            value={coverageZipCode}
            onChange={onCoverageZipCodeChange}
            format1={true}
          />
          {/* Parent Organization - Format 1 styling */}
          <SearchableDropdown
            placeholder="-- Parent Org --"
            options={parentOrgOptions}
            value={coverageParentOrg}
            onChange={onCoverageParentOrgChange}
            format1={true}
          />
          {/* Child Organization - Format 1 styling */}
          <SearchableDropdown
            placeholder="-- Child Org --"
            options={childOrgOptions}
            value={coverageChildOrg}
            onChange={onCoverageChildOrgChange}
            format1={true}
          />
          {/* Choose/Change Assistance + chip */}
          <div className="relative flex items-center gap-2">
            <Map2AssistanceButton
              hasSelection={Boolean(coverageAssistanceType)}
              hasAnyFilter={coverageHasAnyFilter}
              onClick={() => setCoveragePanelOpen(!coveragePanelOpen)}
              buttonRef={coverageAssistBtnRef}
            />
            {/* Selected assistance chip with group color (no X) */}
            {coverageSelectedAssistInfo && (() => {
              const groupColor = GROUP_COLORS[coverageSelectedAssistInfo.group] || GROUP_COLORS[1];
              const iconResult = coverageSelectedAssistInfo.icon ? getIconByName(coverageSelectedAssistInfo.icon) : null;
              const IconComponents = iconResult
                ? (Array.isArray(iconResult) ? iconResult : [iconResult])
                : [];
              return (
                <div
                  className="font-opensans flex items-center gap-2"
                  style={{
                    height: "var(--height-navbar2-btn)",
                    paddingLeft: "12px",
                    paddingRight: "12px",
                    borderRadius: "var(--radius-assistance-chip)",
                    fontSize: "var(--font-size-assistance-chip)",
                    letterSpacing: "var(--letter-spacing-assistance-chip)",
                    fontWeight: 500,
                    backgroundColor: groupColor,
                    color: "var(--color-assistance-text)",
                    border: "1px solid transparent",
                    whiteSpace: "nowrap",
                  }}
                >
                  {IconComponents.map((IconComp, idx) => (
                    <IconComp key={idx} size={20} />
                  ))}
                  {coverageSelectedAssistInfo.name}
                </div>
              );
            })()}
            {/* Assistance chip dropdown */}
            <AssistanceChipDropdown
              isOpen={coveragePanelOpen}
              assistanceList={availableAssistance}
              selectedName={coverageAssistanceType}
              onSelect={handleCoverageAssistSelect}
              panelRef={coveragePanelRef}
            />
          </div>
          {/* Status - Format 1 styling (functional filter) */}
          <HoverDropdown
            value={coverageStatus}
            options={STATUS_OPTIONS}
            onChange={onCoverageStatusChange}
            placeholder="Status"
            inactiveValue={null}
            format1={true}
          />
          {/* Reset link */}
          <button
            onClick={onCoverageReset}
            className="font-opensans transition-all duration-200 hover:brightness-125"
            style={{
              fontSize: "13px",
              color: "#FFFFFF",
              background: "none",
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              textDecoration: "underline",
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Default reports: Organization dropdown + Daily/Monthly toggle */
        <div className="flex items-center justify-between w-full">
          <HoverDropdown
            value={selectedOrg}
            options={orgOptions}
            onChange={onOrgChange}
            placeholder="All Registered Organizations"
          />
          <SlideToggle
            leftLabel="Daily"
            rightLabel="Monthly"
            isRight={viewMode === "monthly"}
            onToggle={handleToggle}
          />
        </div>
      )}
    </nav>
  );
}
