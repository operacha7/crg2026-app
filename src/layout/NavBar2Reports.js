// src/layout/NavBar2Reports.js
// Navigation bar for Reports page
// Default reports: Organization dropdown (left) + Daily/Monthly toggle (right)
// Coverage report: County, Parent Org, Child Org, Assistance Type (chip selector), Status, Reset
// Dropdowns are cross-filtered: each shows only options valid given other selections

import { useState, useEffect, useRef, useMemo } from "react";
import { fetchOrganizations } from "../services/usageService";
import { useAppData } from "../Contexts/AppDataContext";
import { ChevronDownIcon } from "../icons/ChevronDownIcon";
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
function HoverDropdown({ value, options, onChange, placeholder, inactiveValue = "All Registered Organizations" }) {
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
      <button
        onClick={handleClick}
        className="flex items-center gap-1 font-opensans transition-all duration-200 hover:brightness-125"
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-dropdown)",
          fontWeight: "var(--font-weight-navbar2-dropdown)",
          letterSpacing: "var(--letter-spacing-navbar2-dropdown)",
          backgroundColor: "#2E5A88",
          color: "#FFFFFF",
          border: "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)",
          whiteSpace: "nowrap",
        }}
      >
        {value || placeholder}
        <ChevronDownIcon size={16} color="currentColor" />
      </button>

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
function SearchableDropdown({ placeholder, options = [], value, onChange, maxChars = 74 }) {
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
      <button
        onClick={handleClick}
        className="flex items-center gap-1 font-opensans transition-all duration-200 hover:brightness-125"
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-dropdown)",
          fontWeight: "var(--font-weight-navbar2-dropdown)",
          letterSpacing: "var(--letter-spacing-navbar2-dropdown)",
          backgroundColor: "#2E5A88",
          color: "#FFFFFF",
          border: "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)",
          whiteSpace: "nowrap",
        }}
      >
        {hasValue ? truncateText(value) : placeholder}
        <ChevronDownIcon size={16} color="currentColor" />
      </button>

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

// Assistance type chip selector - dropdown shows chips with icons and group colors
function AssistanceChipSelector({ assistance, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const containerRef = useRef(null);

  const sortedAssistance = useMemo(() => {
    return [...assistance].sort((a, b) => parseInt(a.assist_id) - parseInt(b.assist_id));
  }, [assistance]);

  const selectedInfo = useMemo(() => {
    if (!value) return null;
    return assistance.find(a => a.assistance === value);
  }, [value, assistance]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (assistanceName) => {
    onChange(assistanceName);
    setIsOpen(false);
  };

  const renderChip = (item, isInDropdown = false) => {
    const groupColor = GROUP_COLORS[item.group] || GROUP_COLORS[1];
    const iconResult = item.icon ? getIconByName(item.icon) : null;
    const IconComponents = iconResult
      ? (Array.isArray(iconResult) ? iconResult : [iconResult])
      : [];

    return (
      <button
        key={item.assist_id}
        onClick={(e) => {
          e.stopPropagation();
          if (isInDropdown) handleSelect(item.assistance);
        }}
        onMouseEnter={isInDropdown ? () => setHoveredOption(item.assist_id) : undefined}
        onMouseLeave={isInDropdown ? () => setHoveredOption(null) : undefined}
        className="font-opensans transition-all duration-200 hover:brightness-110 flex items-center justify-center gap-2"
        style={{
          backgroundColor: isInDropdown && value === item.assistance
            ? "var(--color-assistance-selected-bg)"
            : groupColor,
          color: "var(--color-assistance-text)",
          padding: "8px 12px",
          borderRadius: "var(--radius-assistance-chip)",
          fontSize: "var(--font-size-assistance-chip)",
          letterSpacing: "var(--letter-spacing-assistance-chip)",
          fontWeight: 500,
          border: isInDropdown && value === item.assistance
            ? "1px solid #000"
            : (isInDropdown && hoveredOption === item.assist_id ? "1px solid #666" : "1px solid transparent"),
          whiteSpace: "nowrap",
          cursor: isInDropdown ? "pointer" : "default",
        }}
      >
        {IconComponents.map((IconComp, idx) => (
          <IconComp key={idx} size={20} />
        ))}
        {item.assistance}
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      {selectedInfo ? (
        <div className="flex items-center gap-2">
          {renderChip(selectedInfo, false)}
          <button
            onClick={() => onChange("")}
            className="text-white hover:brightness-125 transition-all"
            style={{ fontSize: "14px", lineHeight: 1 }}
            title="Clear selection"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 font-opensans transition-all duration-200 hover:brightness-125"
          style={{
            height: "var(--height-navbar2-btn)",
            paddingLeft: "var(--padding-navbar2-btn-x)",
            paddingRight: "var(--padding-navbar2-btn-x)",
            borderRadius: "var(--radius-navbar2-btn)",
            fontSize: "var(--font-size-navbar2-dropdown)",
            fontWeight: "var(--font-weight-navbar2-dropdown)",
            letterSpacing: "var(--letter-spacing-navbar2-dropdown)",
            backgroundColor: "#2E5A88",
            color: "#FFFFFF",
            border: "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)",
            whiteSpace: "nowrap",
          }}
        >
          Select Assistance Type
          <ChevronDownIcon size={16} color="currentColor" />
        </button>
      )}

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-2 rounded shadow-lg z-50 p-4"
          style={{ backgroundColor: "var(--color-dropdown-bg)", minWidth: "500px" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap gap-2">
            {sortedAssistance.map(item => renderChip(item, true))}
          </div>
        </div>
      )}
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
  coverageParentOrg,
  onCoverageParentOrgChange,
  coverageChildOrg,
  onCoverageChildOrgChange,
  coverageAssistanceType,
  onCoverageAssistanceTypeChange,
  coverageStatus,
  onCoverageStatusChange,
  onCoverageReset,
  // Map report filter props
  mapPovertyLevel,
  onMapPovertyLevelChange,
  mapZipCode,
  onMapZipCodeChange,
  mapAssistanceType,
  onMapAssistanceTypeChange,
  onMapReset,
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

  // Parent org options: filtered by status + assistance (not by child)
  const parentOrgOptions = useMemo(() => {
    let filtered = directory.filter(r => r.status_id === statusId);
    if (assistId) filtered = filtered.filter(r => r.assist_id === assistId);
    const parents = [...new Set(filtered.map(r => r.org_parent).filter(Boolean))];
    return parents.sort();
  }, [directory, statusId, assistId]);

  // Child org options: filtered by status + assistance + parent
  const childOrgOptions = useMemo(() => {
    let filtered = directory.filter(r => r.status_id === statusId);
    if (assistId) filtered = filtered.filter(r => r.assist_id === assistId);
    if (coverageParentOrg) filtered = filtered.filter(r => r.org_parent === coverageParentOrg);
    const children = [...new Set(filtered.map(r => r.organization).filter(Boolean))];
    return children.sort();
  }, [directory, statusId, assistId, coverageParentOrg]);

  // Assistance options: filtered by status + parent + child
  const availableAssistance = useMemo(() => {
    let filtered = directory.filter(r => r.status_id === statusId);
    if (coverageParentOrg) filtered = filtered.filter(r => r.org_parent === coverageParentOrg);
    if (coverageChildOrg) filtered = filtered.filter(r => r.organization === coverageChildOrg);
    const availableIds = new Set(filtered.map(r => r.assist_id));
    return assistance.filter(a => availableIds.has(a.assist_id));
  }, [directory, assistance, statusId, coverageParentOrg, coverageChildOrg]);

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

  // === Map report options ===
  // Poverty level options from zip_codes data
  const povertyLevelOptions = useMemo(() => {
    const levels = [...new Set(
      zipCodes.filter(z => z.houston_area === "Y" && z.poverty_level != null).map(z => String(z.poverty_level))
    )].sort((a, b) => parseInt(a) - parseInt(b));
    return levels.map(l => `Level ${l}`);
  }, [zipCodes]);

  // Zip code options for map (houston_area only)
  const mapZipOptions = useMemo(() => {
    return zipCodes.filter(z => z.houston_area === "Y").map(z => z.zip_code).sort();
  }, [zipCodes]);

  return (
    <nav
      className="bg-navbar2-bg flex items-center"
      style={{
        height: "var(--height-navbar2)",
        paddingLeft: "var(--padding-navbar2-left)",
        paddingRight: "var(--padding-navbar2-right)",
      }}
    >
      {selectedReport === "map" ? (
        /* Map report filters */
        <div
          className="flex items-center"
          style={{ gap: "var(--gap-navbar2-filters)" }}
        >
          <HoverDropdown
            value={mapPovertyLevel || ""}
            options={povertyLevelOptions}
            onChange={(val) => {
              onMapPovertyLevelChange(val);
              onMapZipCodeChange(""); // Clear zip when poverty level selected
            }}
            placeholder="-- Poverty Level --"
            inactiveValue=""
          />
          <span className="font-opensans text-white/50" style={{ fontSize: "14px" }}>or</span>
          <HoverDropdown
            value={mapZipCode || ""}
            options={mapZipOptions}
            onChange={(val) => {
              onMapZipCodeChange(val);
              onMapPovertyLevelChange(""); // Clear poverty level when zip selected
            }}
            placeholder="-- Zip Code --"
            inactiveValue=""
          />
          <AssistanceChipSelector
            assistance={assistance}
            value={mapAssistanceType}
            onChange={onMapAssistanceTypeChange}
          />
          <button
            onClick={onMapReset}
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
      ) : selectedReport === "coverage" ? (
        /* Coverage report filters - all inline with same gap */
        <div
          className="flex items-center"
          style={{ gap: "var(--gap-navbar2-filters)" }}
        >
          <HoverDropdown
            value={coverageCounty}
            options={countyOptions}
            onChange={onCoverageCountyChange}
            placeholder="All Counties"
            inactiveValue="All Counties"
          />
          <SearchableDropdown
            placeholder="-- Select Parent Organization --"
            options={parentOrgOptions}
            value={coverageParentOrg}
            onChange={onCoverageParentOrgChange}
          />
          <SearchableDropdown
            placeholder="-- Select Child Organization --"
            options={childOrgOptions}
            value={coverageChildOrg}
            onChange={onCoverageChildOrgChange}
          />
          <AssistanceChipSelector
            assistance={availableAssistance}
            value={coverageAssistanceType}
            onChange={onCoverageAssistanceTypeChange}
          />
          <HoverDropdown
            value={coverageStatus}
            options={STATUS_OPTIONS}
            onChange={onCoverageStatusChange}
            placeholder="Status"
            inactiveValue={null}
          />
          {/* Reset link - inline with filters */}
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
