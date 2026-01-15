// src/layout/NavBar2.js
// Search mode selector with mode-specific filters
// Frame 496 from Figma design

import { useState, useMemo, useRef, useEffect } from "react";
import { DistanceIcon } from "../icons";
import Tooltip from "../components/Tooltip";
import DistancePanel from "../components/DistancePanel";
import { useAppData } from "../Contexts/AppDataContext";

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

// Dropdown component - supports controlled or uncontrolled usage
// allowReset: if true, placeholder option is selectable to reset the dropdown
// maxChars: truncate options longer than this (default 55 for org dropdowns)
// Has inactive/active states: inactive (transparent bg, no border), active (teal bg, white border)
function FilterDropdown({ placeholder, options = [], value, onChange, allowReset = true, maxChars = 74 }) {
  const hasValue = value && value !== "";

  // Truncate text if longer than maxChars
  const truncateText = (text) => {
    if (!text || text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + "...";
  };

  return (
    <div
      className={`relative transition-all duration-200 rounded-[10px] ${
        hasValue
          ? "hover:brightness-125"
          : "hover:bg-white/10"
      }`}
      style={{
        borderRadius: "var(--radius-navbar2-btn)",
      }}
    >
      <select
        className={`font-opensans appearance-none cursor-pointer ${
          hasValue
            ? "bg-navbar2-dropdown-bg text-navbar2-dropdown-text"
            : "bg-transparent text-navbar2-btn-inactive-text"
        }`}
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "calc(var(--padding-navbar2-btn-x) + 20px)", // Extra space for arrow
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-dropdown)",
          fontWeight: "var(--font-weight-navbar2-dropdown)",
          letterSpacing: "var(--letter-spacing-navbar2-dropdown)",
          border: hasValue ? "1px solid rgba(255,255,255,1)" : "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          backgroundColor: hasValue ? undefined : "transparent",
          maxWidth: "74ch",
        }}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="" disabled={!allowReset}>
          {placeholder}
        </option>
        {options.map((opt, idx) => (
          <option key={idx} value={opt} title={opt}>
            {truncateText(opt)}
          </option>
        ))}
      </select>
    </div>
  );
}

// Zip Code dropdown - matches Assistance button styling
// Inactive: no bg, no border, white text, "Select Zip Code"
// Active: teal bg with border, shows selected zip code
// Typography matches AssistanceButton: 20px, medium (500), 5% letter-spacing
// Uses wrapper div for reliable hover effects since select elements have limited CSS support
function ZipCodeDropdown({ value, onChange, options = [] }) {
  const hasValue = value && value !== "";

  return (
    <div
      className={`relative transition-all duration-200 rounded-[10px] ${
        hasValue
          ? "hover:brightness-125"
          : "hover:bg-white/10"
      }`}
      style={{
        borderRadius: "var(--radius-navbar2-btn)",
      }}
    >
      <select
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        className={`font-opensans appearance-none cursor-pointer ${
          hasValue
            ? "bg-navbar2-dropdown-bg text-navbar2-dropdown-text"
            : "bg-transparent text-navbar2-btn-inactive-text"
        }`}
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "calc(var(--padding-navbar2-btn-x) + 20px)", // Extra space for arrow
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-btn)", // 20px - matches AssistanceButton
          fontWeight: "var(--font-weight-navbar2-btn)", // 500 Medium - matches AssistanceButton
          letterSpacing: "var(--letter-spacing-navbar2-btn)", // 5% - matches AssistanceButton
          textAlign: "center",
          textAlignLast: "center", // Centers the selected option text
          border: hasValue ? "1px solid rgba(255,255,255,1)" : "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          backgroundColor: hasValue ? undefined : "transparent",
        }}
      >
        <option value="" disabled>
          Select Zip Code
        </option>
        {options.map((opt, idx) => (
          <option key={idx} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// Text input for LLM search
function LLMSearchInput() {
  return (
    <input
      type="text"
      placeholder="-- Enter Search Text --"
      className="bg-navbar2-dropdown-bg text-navbar2-dropdown-text font-opensans placeholder-white/60 hover:brightness-125 transition-all"
      style={{
        height: "var(--height-navbar2-btn)",
        paddingLeft: "var(--padding-navbar2-btn-x)",
        paddingRight: "var(--padding-navbar2-btn-x)",
        borderRadius: "var(--radius-navbar2-btn)",
        fontSize: "var(--font-size-navbar2-dropdown)",
        fontWeight: "var(--font-weight-navbar2-dropdown)",
        letterSpacing: "var(--letter-spacing-navbar2-dropdown)",
        border: "1px solid rgba(255,255,255,0.3)",
        minWidth: "400px",
      }}
    />
  );
}

// Neighborhood link component - wraps at 80 characters
function NeighborhoodLink({ text = "Braeswood Place, Knollwood Village" }) {
  return (
    <a
      href="#"
      className="text-navbar2-link hover:underline hover:brightness-125 transition-all"
      style={{
        fontSize: "var(--font-size-navbar2-link)",
        fontWeight: "var(--font-weight-navbar2-link)",
        maxWidth: "60ch",
        whiteSpace: "normal",
        lineHeight: "1.3",
      }}
    >
      {text}
    </a>
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

  // Handle parent change - reset child when parent changes
  const handleParentChange = (value) => {
    setSelectedParent(value);
    setSelectedChild(""); // Reset child when parent changes
  };

  return (
    <>
      <FilterDropdown
        placeholder="-- Select Parent Organization --"
        options={parentOrgOptions}
        value={selectedParent}
        onChange={handleParentChange}
        allowReset={true}
      />
      <FilterDropdown
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
  selectedLocationZip,
  setSelectedLocationZip,
  selectedCounty,
  setSelectedCounty,
  selectedCity,
  setSelectedCity,
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

  // Get data for selected zip (for coordinates and neighborhood)
  const selectedZipData = zipCodes.find(z => z.zip_code === selectedLocationZip);
  const neighborhoodText = selectedZipData?.neighborhood || "";
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
        }}
        allowReset={true}
      />
      <FilterDropdown
        placeholder="-- Select Zip --"
        options={zipOptions}
        value={selectedLocationZip}
        onChange={setSelectedLocationZip}
        allowReset={true}
      />
      {selectedLocationZip && neighborhoodText && <NeighborhoodLink text={neighborhoodText} />}
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

function LLMFilters() {
  return <LLMSearchInput />;
}

export default function NavBar2() {
  // Get data and filter state from context
  const {
    zipCodes,
    organizations,
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
    setActiveAssistanceChips,
    // Client coordinates from context (shared with ZipCodePage for distance calc)
    clientAddress,
    setClientAddress,
    clientCoordinates,
    setClientCoordinates,
  } = useAppData();

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
      setActiveAssistanceChips(new Set());
      // Clear client coordinates
      setClientAddress("");
      setClientCoordinates("");
      setActiveSearchMode(newMode);
    }
  };

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
            onZipChange={setSelectedZipCode}
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
            setSelectedParent={setSelectedParentOrg}
            selectedChild={selectedChildOrg}
            setSelectedChild={setSelectedChildOrg}
            clientAddress={clientAddress}
            clientCoordinates={clientCoordinates}
            onCoordinatesChange={handleCoordinatesChange}
          />
        );
      case SEARCH_MODES.LOCATION:
        return (
          <LocationFilters
            zipCodes={zipCodes}
            selectedLocationZip={selectedLocationZip}
            setSelectedLocationZip={setSelectedLocationZip}
            selectedCounty={selectedLocationCounty}
            setSelectedCounty={setSelectedLocationCounty}
            selectedCity={selectedLocationCity}
            setSelectedCity={setSelectedLocationCity}
            clientAddress={clientAddress}
            clientCoordinates={clientCoordinates}
            onCoordinatesChange={handleCoordinatesChange}
          />
        );
      case SEARCH_MODES.LLM:
        return <LLMFilters />;
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