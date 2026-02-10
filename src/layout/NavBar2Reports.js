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
      {/* Trigger button */}
      <button
        onClick={handleClick}
        className={`font-opensans transition-all duration-200 text-left ${
          isActive
            ? "bg-navbar2-dropdown-bg text-navbar2-dropdown-text hover:brightness-125"
            : "bg-transparent text-navbar2-btn-inactive-text hover:bg-white/10"
        }`}
        style={{
          height: "var(--height-navbar2-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "18px",
          fontWeight: "var(--font-weight-navbar2-btn)",
          letterSpacing: "var(--letter-spacing-navbar2-btn)",
          border: isActive ? "1px solid rgba(255,255,255,1)" : "none",
          whiteSpace: "nowrap",
        }}
      >
        {value || placeholder}
      </button>

      {/* Dropdown panel - scrollable for many options */}
      {isOpen && (
        <div
          className="absolute left-0 mt-2 rounded shadow-lg z-50 max-h-[400px] overflow-y-auto"
          style={{
            backgroundColor: "#FDF6E3",
            width: "380px",
          }}
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
                color: "#222831",
                backgroundColor: hoveredOption === option ? "#d4d0c7" : (value === option ? "#e0ddd4" : "transparent"),
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
