// src/layout/NavBar1Reports.js
// Top navigation bar for Reports page
// Logo + title on left, Reports dropdown on right (hover to open)

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppData } from "../Contexts/AppDataContext";
import { logUsage } from "../services/usageService";

const REPORT_OPTIONS = [
  { id: 'zip-code', label: 'Zip Code Chart' },
  { id: 'emails-sent', label: 'Emails Chart' },
  { id: 'pdfs-created', label: 'PDFs Chart' },
  { id: 'reports-chart', label: 'Reports Chart' },
  { id: 'usage-tables', label: 'Usage Data Tables' },
  { id: 'coverage', label: 'The Matt Report', color: '#f79184' },
  { id: 'map2', label: 'Zip Code Map', color: '#9df784' },
];

const BASE_MAP_LABELS = {
  distress: "Distress Levels",
  working_poor: "Working Poor",
  population: "Population",
  filter_view: "Filter View",
};

export default function NavBar1Reports({ selectedReport, onReportChange, map2ViewMode }) {
  const { loggedInUser } = useAppData();
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);
  const containerRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const hasLoggedInitialRef = useRef(false);

  // Log usage for a report view (skip Administrator to avoid skewing data)
  const logReportUsage = useCallback((reportId) => {
    const regOrg = loggedInUser?.reg_organization || 'Guest';
    if (regOrg === 'Administrator') return;
    const option = REPORT_OPTIONS.find(r => r.id === reportId);
    if (!option) return;
    logUsage({
      reg_organization: regOrg,
      action_type: 'reports',
      search_mode: option.label,
    });
  }, [loggedInUser]);

  // Log the initial default report view on mount
  useEffect(() => {
    if (!hasLoggedInitialRef.current) {
      hasLoggedInitialRef.current = true;
      logReportUsage('zip-code');
    }
  }, [logReportUsage]);

  // Handle click outside to close dropdown
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

  const handleReportSelect = (reportId) => {
    onReportChange(reportId);
    logReportUsage(reportId);
    setIsOpen(false);
    setIsLocked(false);
  };

  // Get current report label for button
  const currentReport = REPORT_OPTIONS.find(r => r.id === selectedReport);
  const buttonLabel = currentReport ? currentReport.label : 'Reports';

  return (
    <nav
      className="bg-navbar1-bg flex items-center justify-between"
      style={{
        height: 'var(--height-navbar1)',
        paddingLeft: 'var(--padding-navbar1-left)',
        paddingRight: 'var(--padding-navbar1-right)',
      }}
    >
      {/* Left side - Logo and Title */}
      <div
        className="flex items-center"
        style={{ gap: 'var(--gap-navbar1-logo-title)' }}
      >
        <img
          src="/images/CRG Logo 2025.webp"
          alt="CRG Logo"
          style={{
            width: 'var(--size-navbar1-logo)',
            height: 'var(--size-navbar1-logo)',
          }}
          className="object-contain"
        />
        <h1
          className="text-navbar1-title font-comfortaa"
          style={{
            fontSize: 'var(--font-size-navbar1-title)',
            fontWeight: 'var(--font-weight-navbar1-title)',
            letterSpacing: 'var(--letter-spacing-navbar1-title)',
          }}
        >
          Community Resources Guide Houston
        </h1>
      </div>

      {/* Right side - Reports dropdown (hover to open) */}
      <div
        ref={containerRef}
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={handleClick}
          className="font-opensans transition-all hover:brightness-125"
          style={{
            backgroundColor: 'transparent',
            color: currentReport?.color || (currentReport ? '#FDF6E3' : '#FFFFFF'),
            fontSize: 'var(--font-size-navbar1-btn)',
            fontWeight: 'var(--font-weight-navbar1-btn)',
            letterSpacing: 'var(--letter-spacing-navbar1-btn)',
            padding: '8px 16px',
            border: currentReport
              ? `2px solid ${currentReport.color || '#FDF6E3'}`
              : 'none',
            borderRadius: currentReport ? '10px' : '0',
          }}
        >
          {buttonLabel}
        </button>

        {/* Dropdown panel */}
        {isOpen && (
          <div
            className="absolute right-0 mt-2 rounded shadow-lg z-50"
            style={{
              backgroundColor: '#FDF6E3',
              minWidth: '180px',
            }}
          >
            {REPORT_OPTIONS.map((option) => {
              const fontColor = option.color || '#222831';
              return (
                <button
                  key={option.id}
                  onClick={() => handleReportSelect(option.id)}
                  onMouseEnter={() => setHoveredOption(option.id)}
                  onMouseLeave={() => setHoveredOption(null)}
                  className="w-full text-left px-4 py-3 font-opensans"
                  style={{
                    fontSize: '16px',
                    color: fontColor,
                    backgroundColor: hoveredOption === option.id ? '#d4d0c7' : (selectedReport === option.id ? '#e0ddd4' : 'transparent'),
                    borderBottom: '1px solid #999999',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
