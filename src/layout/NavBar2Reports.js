// src/layout/NavBar2Reports.js
// Navigation bar for Reports page
// Left: Organization dropdown (hover to open), Right: Daily/Monthly sliding toggle

import { useState, useEffect, useRef, useMemo } from "react";
import { fetchOrganizations } from "../services/usageService";

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
      {/* Sliding pill */}
      <div
        className="absolute rounded-full transition-all duration-300 ease-in-out"
        style={{
          backgroundColor: "var(--color-navbar2-btn-active-bg)",
          width: "calc(50% - 4px)",
          height: "30px",
          left: isRight ? "calc(50% + 2px)" : "4px",
        }}
      />

      {/* Labels */}
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

// Hover dropdown component - opens on hover, click locks it open
// Width auto-adjusts to longest option without wrapping
function HoverDropdown({ value, options, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const containerRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  // "All Organizations" is the inactive/default state
  const isActive = value && value !== "All Organizations";

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
    if (!isLocked) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isLocked) {
      // Small delay before closing to allow moving to dropdown
      closeTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 150);
    }
  };

  const handleClick = () => {
    setIsLocked(!isLocked);
    setIsOpen(true);
  };

  const handleSelect = (option) => {
    onChange(option);
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
      {/* Trigger button - matches NavBar2 Zip Code dropdown styling */}
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
          backgroundColor: isActive
            ? "var(--color-navbar2-btn-active-bg)"
            : "var(--color-navbar2-btn-inactive-bg)",
          color: isActive
            ? "var(--color-navbar2-btn-active-text)"
            : "var(--color-navbar2-btn-inactive-text)",
          border: isActive
            ? "var(--border-width-btn) solid var(--color-navbar2-btn-active-border)"
            : "var(--border-width-btn) solid var(--color-navbar2-btn-inactive-border)",
          whiteSpace: "nowrap",
        }}
      >
        {value || placeholder}
      </button>

      {/* Dropdown panel - matches NavBar2 dropdown styling */}
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

export default function NavBar2Reports({
  selectedOrg,
  onOrgChange,
  viewMode, // "daily" or "monthly"
  onViewModeChange,
}) {
  const [organizations, setOrganizations] = useState([]);

  // Fetch organizations on mount
  useEffect(() => {
    async function loadOrgs() {
      const orgs = await fetchOrganizations();
      setOrganizations(orgs);
    }
    loadOrgs();
  }, []);

  // Build dropdown options: All Organizations + orgs (Guest is in registered_organizations)
  // Exclude "Administrator" - used for testing only
  const orgOptions = useMemo(() => [
    "All Organizations",
    ...organizations
      .filter(o => o.reg_organization !== "Administrator")
      .map(o => o.reg_organization),
  ], [organizations]);

  const handleToggle = () => {
    onViewModeChange(viewMode === "daily" ? "monthly" : "daily");
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
      {/* Left side - Organization dropdown (hover to open) */}
      <HoverDropdown
        value={selectedOrg}
        options={orgOptions}
        onChange={onOrgChange}
        placeholder="All Organizations"
      />

      {/* Right side - Daily/Monthly sliding toggle */}
      <SlideToggle
        leftLabel="Daily"
        rightLabel="Monthly"
        isRight={viewMode === "monthly"}
        onToggle={handleToggle}
      />
    </nav>
  );
}
