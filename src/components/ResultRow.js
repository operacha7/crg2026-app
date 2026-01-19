// src/components/ResultRow.js
// Individual result row component for displaying resource data
// Handles expand/collapse for Requirements and Zip columns

import React, { useState } from "react";
import { getIconByName } from "../icons/iconMap";
import {
  formatHoursFromJson,
  formatAddress,
  formatIconName,
} from "../utils/formatters";

// Maximum visible lines before showing expand chevron
const MAX_VISIBLE_LINES = 5;
// Line reserved for chevron when content exceeds max
const LINES_FOR_CHEVRON = 1;

// Grid column definitions - must match ResultsHeader
// Using percentages for responsive scaling (like legacy SearchResults.js)
// Select(4%) + Miles(3%) + Org(20%) + Assistance(8%) + Hours(17%) + Status(6%) + Phone(6%) + Requirements(33%) + Zip(3%)
// Note: Address column removed (combined with Organization), old Address 12% redistributed: 8% to Assistance, 4% to Requirements
// Gaps: 20px before Org, 30px before Hours, 40px before Status, 20px before Phone (applied as paddingLeft)
const GRID_COLUMNS = "4% 3% 25% 6% 15% 7% 7% 30% 3%";

// Double chevron icon for expand/collapse - uses token color
function DoubleChevronIcon({ expanded }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-results-expand-chevron)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
    >
      <polyline points="6 7 12 13 18 7" />
      <polyline points="6 13 12 19 18 13" />
    </svg>
  );
}

// Status pill component
function StatusPill({ statusId, status }) {
  const bgColorClass = {
    1: "bg-results-status-active-bg",
    2: "bg-results-status-limited-bg",
    3: "bg-results-status-inactive-bg",
  }[statusId] || "bg-gray-300";

  return (
    <span
      className={`${bgColorClass} px-2 py-1 text-black font-opensans text-xs text-center`}
      style={{
        borderRadius: "var(--radius-results-status-pill)",
        minWidth: "60px",
        display: "inline-block",
      }}
    >
      {status}
    </span>
  );
}

// Icon wrapper component with instant CSS tooltip
// Uses CSS color property which icons inherit via fill="currentColor"
// position: "top" (default), "bottom", or "bottom-right" for icons near left edge
function IconWithTooltip({ IconComponent, size, iconName, color, className, position = "top" }) {
  if (!IconComponent) return null;

  const tooltipText = formatIconName(iconName);

  // Position classes for different tooltip placements
  const positionClassesMap = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    "bottom-right": "top-full mt-2 left-0", // For icons near left edge - aligns tooltip to left of icon
  };
  const positionClasses = positionClassesMap[position] || positionClassesMap.top;

  return (
    <span
      className={`inline-flex cursor-default group ${className || ""}`}
      style={{ position: 'relative', color: color || 'inherit' }}
      aria-label={tooltipText}
    >
      <IconComponent size={size} className="pointer-events-none" />
      {/* Instant CSS tooltip */}
      {tooltipText && (
        <span
          className={`absolute ${positionClasses} px-2 py-1 rounded whitespace-nowrap
                     opacity-0 group-hover:opacity-100 transition-opacity duration-100
                     pointer-events-none`}
          style={{
            backgroundColor: "var(--color-tooltip-bg)",
            color: "var(--color-tooltip-text)",
            fontSize: "var(--font-size-tooltip)",
            zIndex: 9999,
          }}
        >
          {tooltipText}
        </span>
      )}
    </span>
  );
}

export default function ResultRow({
  record,
  isSelected,
  onSelect,
  assistanceIcon,
  allAssistanceTypes = [],
  orgAssistanceMap = {},
  rowIndex = 0,
}) {
  const [requirementsExpanded, setRequirementsExpanded] = useState(false);
  const [zipExpanded, setZipExpanded] = useState(false);

  // Get the icon component for the primary assistance type
  const AssistanceIconComponent = assistanceIcon ? getIconByName(assistanceIcon) : null;

  // Parse requirements into array (assuming comma or newline separated)
  const requirements = record.requirements
    ? record.requirements.split(/[,\n]/).map((r) => r.trim()).filter(Boolean)
    : [];

  // Parse zip codes into array
  const zipCodes = record.client_zip_codes
    ? (Array.isArray(record.client_zip_codes)
        ? record.client_zip_codes
        : record.client_zip_codes.split(/[,\n]/).map((z) => z.trim()).filter(Boolean))
    : [];

  // Get all assistance types this org provides (from lookup map, for Assistance column icons)
  // orgAssistanceMap[orgName] = array of assist_ids (e.g., ["11", "12", "65"])
  const orgAssistIds = orgAssistanceMap[record.organization] || [];
  const orgAssistanceTypes = allAssistanceTypes.filter((at) =>
    orgAssistIds.includes(at.assist_id)
  );

  // Format address
  const addressLines = formatAddress(record);

  // Format hours from JSON - use org_hours field
  const formattedHours = formatHoursFromJson(record.org_hours);

  // Determine background based on selection state or alternating row colors
  const getBgStyle = () => {
    if (isSelected) {
      return { backgroundColor: "var(--color-results-row-selected-bg)" };
    }
    // Alternating row colors: even rows (0, 2, 4...) get F0F8FF, odd rows (1, 3, 5...) get F0FFF0
    const bgColor = rowIndex % 2 === 0
      ? "var(--color-results-row-even-bg)"
      : "var(--color-results-row-odd-bg)";
    return { backgroundColor: bgColor };
  };

  // Calculate if we need expansion for either column
  const requirementsNeedsExpansion = requirements.length > MAX_VISIBLE_LINES;
  const zipNeedsExpansion = zipCodes.length > MAX_VISIBLE_LINES;

  return (
    <div
      className="border-b border-results-row-border font-opensans transition-colors duration-150 results-row-hover"
      style={{
        display: "grid",
        gridTemplateColumns: GRID_COLUMNS,
        padding: "12px 0 12px 10px",
        minHeight: "100px",
        borderBottomWidth: "0.5px",
        ...getBgStyle(),
      }}
    >
      {/* Select Column - Icon + Checkbox side by side at top, bottoms aligned */}
      <div
        className="flex items-end justify-center"
        style={{ gap: "var(--gap-results-select-items)", alignSelf: "start" }}
      >
        <IconWithTooltip
          IconComponent={AssistanceIconComponent}
          size={25}
          iconName={assistanceIcon}
          color="var(--color-results-assistance-icon)"
          position="bottom-right"
        />
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(record.id, e.target.checked)}
          className="cursor-pointer"
          style={{
            width: "var(--size-results-checkbox)",
            height: "var(--size-results-checkbox)",
            position: "relative",
            top: "-1.5px",
            accentColor: "var(--color-results-checkbox-checked)",
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Miles Column - with "mi" underneath */}
      <div
        className="flex flex-col items-center justify-start"
        style={{
          fontSize: "var(--font-size-results-default)",
          letterSpacing: "var(--letter-spacing-results-default)",
        }}
      >
        <span>{record.distance != null ? record.distance.toFixed(1) : ""}</span>
        {record.distance != null && (
          <span style={{ fontSize: "var(--font-size-results-more-info)", color: "var(--color-results-distance-label)" }}>mi</span>
        )}
      </div>

      {/* Organization Column - org name + address below, gap before (20px) */}
      <div className="flex flex-col" style={{ paddingLeft: "20px" }}>
        {/* Organization name (no favicon) */}
        <span
          style={{
            fontSize: "var(--font-size-results-org)",
            fontWeight: "var(--font-weight-results-org)",
            letterSpacing: "var(--letter-spacing-results-org)",
          }}
        >
          {record.organization}
        </span>
        {/* Address below org name with 10px gap */}
        {addressLines.length > 0 && (
          <div
            className="flex flex-col"
            style={{
              marginTop: "10px",
              fontSize: "var(--font-size-results-default)",
              fontWeight: "var(--font-weight-results-default)",
              letterSpacing: "var(--letter-spacing-results-default)",
            }}
          >
            {addressLines.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        )}
      </div>

      {/* Assistance Column - icons for all assistance types this org provides */}
      <div className="flex flex-wrap gap-1" style={{ alignSelf: "start" }}>
        {orgAssistanceTypes.map((at) => {
          const IconComp = getIconByName(at.icon);
          return (
            <IconWithTooltip
              key={at.id_no}
              IconComponent={IconComp}
              size={20}
              iconName={at.icon}
              color="var(--color-results-assistance-icon-secondary)"
              position={rowIndex === 0 ? "bottom" : "top"}
            />
          );
        })}
      </div>

      {/* Hours Column - two-frame layout: days (right-aligned), times (right-aligned), 15px gap */}
      <div
        className="flex flex-col"
        style={{
          fontSize: "var(--font-size-results-default)",
          letterSpacing: "var(--letter-spacing-results-default)",
          paddingLeft: "10px",
        }}
      >
        {formattedHours ? (
          <>
            {/* Legacy format (non-JSON) */}
            {formattedHours.legacy && (
              <div className="whitespace-pre-line">{formattedHours.legacy}</div>
            )}
            
            {/* Hours display - consistent two-frame layout */}
            {(formattedHours.rows?.length > 0 || formattedHours.special?.length > 0) && (
              <div 
                style={{ 
                  display: "grid",
                  gridTemplateColumns: "1fr 15px 1fr",
                  alignItems: "start"
                }}
              >
                {/* Left frame - days, right-aligned */}
                <div className="flex flex-col" style={{ textAlign: "right" }}>
                  {formattedHours.rows?.map((row, idx) => (
                    <div key={`reg-day-${idx}`}>{row.days}</div>
                  ))}
                  {formattedHours.special?.map((row, idx) => (
                    <div key={`spec-day-${idx}`}>{row.days}</div>
                  ))}
                </div>
                
                {/* Gap - 15px spacer column */}
                <div></div>
                
                {/* Right frame - times, right-aligned */}
                <div className="flex flex-col" style={{ textAlign: "right" }}>
                  {formattedHours.rows?.map((row, idx) => (
                    <div key={`reg-time-${idx}`}>{row.hours}</div>
                  ))}
                  {formattedHours.special?.map((row, idx) => (
                    <div key={`spec-time-${idx}`}>{row.hours}</div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Labeled hours (Office, Shelter, etc.) - with label header */}
            {formattedHours.labeled?.length > 0 && (
              <div style={{ marginTop: formattedHours.rows?.length > 0 || formattedHours.special?.length > 0 ? "8px" : "0" }}>
                {formattedHours.labeled.map((item, idx) => (
                  <div key={idx} style={{ marginTop: idx > 0 ? "4px" : "0" }}>
                    <div className="font-semibold">{item.label}:</div>
                    <div 
                      style={{ 
                        display: "grid",
                        gridTemplateColumns: "1fr 10px 1fr",
                        alignItems: "start"
                      }}
                    >
                      <div style={{ textAlign: "right" }}>{item.days}</div>
                      <div></div>
                      <div style={{ textAlign: "right" }}>{item.hours}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          ""
        )}
        {/* Hours notes - bottom frame */}
        {record.hours_notes && (
          <div
            className="px-2 py-1 text-center"
            style={{
              backgroundColor: "var(--color-results-hours-notes-bg)",
              fontSize: "15px",
              fontWeight: "var(--font-weight-results-org)",
              marginTop: "10px",
              borderRadius: "5px",
            }}
          >
            {record.hours_notes}
          </div>
        )}
      </div>

      {/* Status Column - gap before (40px) */}
      <div className="flex items-start justify-center" style={{ paddingLeft: "40px" }}>
        <StatusPill statusId={record.status_id} status={record.status} />
      </div>

      {/* Telephone Column - gap before (20px) */}
      <div
        className="flex items-start"
        style={{
          fontSize: "var(--font-size-results-default)",
          letterSpacing: "var(--letter-spacing-results-default)",
          paddingLeft: "20px",
        }}
      >
        {record.telephone || ""}
      </div>

      {/* Requirements Column - flexible, bullet list, gap before (20px) */}
      <div
        className="flex flex-col"
        style={{
          fontSize: "var(--font-size-results-default)",
          letterSpacing: "var(--letter-spacing-results-default)",
          paddingLeft: "20px",
        }}
      >
        {requirements.length > 0 ? (
          <>
            {/* Content area */}
            <div className="flex-1">
              {(requirementsExpanded || !requirementsNeedsExpansion
                ? requirements
                : requirements.slice(0, MAX_VISIBLE_LINES - LINES_FOR_CHEVRON)
              ).map((req, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span>•</span>
                  <span>{req}</span>
                </div>
              ))}
            </div>
            {/* Chevron - centered with label */}
            {requirementsNeedsExpansion && (
              <div className="flex justify-center mt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRequirementsExpanded(!requirementsExpanded);
                  }}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                  style={{ fontSize: "var(--font-size-results-more-info)" }}
                >
                  <span style={{ color: "var(--color-results-expand-chevron)" }}>
                    {requirementsExpanded ? "Less Info" : "More Info"}
                  </span>
                  <DoubleChevronIcon expanded={requirementsExpanded} />
                </button>
              </div>
            )}
          </>
        ) : (
          ""
        )}
      </div>

      {/* Zip Column - centered chevron, align height with requirements */}
      <div
        className="flex flex-col items-center"
        style={{
          fontSize: "var(--font-size-results-zip)",
          letterSpacing: "var(--letter-spacing-results-default)",
        }}
      >
        {zipCodes.length > 0 ? (
          <>
            {/* Content area - flex-1 to fill available space */}
            <div className="flex-1 flex flex-col">
              {(zipExpanded || !zipNeedsExpansion
                ? zipCodes
                : zipCodes.slice(0, MAX_VISIBLE_LINES - LINES_FOR_CHEVRON)
              ).map((zip, idx) => (
                <div key={idx}>{zip}</div>
              ))}
            </div>
            {/* Chevron - centered, no label */}
            {zipNeedsExpansion && (
              <div className="flex justify-center mt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setZipExpanded(!zipExpanded);
                  }}
                  className="flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  <DoubleChevronIcon expanded={zipExpanded} />
                </button>
              </div>
            )}
          </>
        ) : (
          ""
        )}
      </div>
    </div>
  );
}

// Export grid columns for use in ResultsHeader
export { GRID_COLUMNS };