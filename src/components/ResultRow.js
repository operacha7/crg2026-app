// src/components/ResultRow.js
// Individual result row component for displaying resource data
// Handles expand/collapse for Requirements and Zip columns

import React, { useState, useRef, useEffect, useMemo } from "react";
import { getIconByName, getIconNames } from "../icons/iconMap";
import { HomeMarkerIcon, TransitIcon } from "../icons";
import {
  formatHoursFromJson,
  formatAddress,
  formatIconName,
  parsePhoneNumbers,
} from "../utils/formatters";
import { buildTransitDirectionsUrl } from "../utils/transitUrl";

// Max height for collapsed content area (enforces uniform row height)
// Approximately 6 lines at ~20px each = 120px
const COLLAPSED_MAX_HEIGHT = 120;

// Format date to MM-DD-YYYY from various input formats
function formatStatusDate(dateStr) {
  if (!dateStr) return "";

  // If already MM/DD/YYYY, just replace slashes with dashes
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr.replace(/\//g, "-");
  }

  // If YYYY-MM-DD (ISO format), rearrange to MM-DD-YYYY
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-");
    return `${month}-${day.substring(0, 2)}-${year}`;
  }

  // Fallback: return as-is with slashes replaced
  return dateStr.replace(/\//g, "-");
}

// Grid column definitions - must match ResultsHeader
// Using percentages for responsive scaling (like legacy SearchResults.js)
// Select(4%) + Miles(3%) + Org(20%) + Assistance(8%) + Hours(17%) + Status(6%) + Phone(6%) + Requirements(33%) + Zip(3%)
// Note: Address column removed (combined with Organization), old Address 12% redistributed: 8% to Assistance, 4% to Requirements
// Gaps: 20px before Org, 30px before Hours, 40px before Status, 20px before Phone (applied as paddingLeft)
const GRID_COLUMNS = "4% 3% 25% 6% 17% 7% 7% 31%";

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

// Gold star shown next to the organization name for priority (featured) records.
// Priority is an editorial flag in the directory table; priority === 1 = featured.
function PriorityStar({ size = 16 }) {
  return (
    <span
      className="inline-flex shrink-0"
      style={{ color: "#FFC857" }}
      aria-label="Featured organization"
      title="Featured organization"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="#B8860B"
        strokeWidth="1"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </span>
  );
}

// Status pill component
function StatusPill({ statusId, status }) {
  const bgColorClass = {
    1: "bg-results-status-active-bg",
    2: "bg-results-status-limited-bg",
    3: "bg-results-status-inactive-bg",
    4: "bg-results-status-closed-bg",
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

function ResultRow({
  record,
  isSelected,
  onSelect,
  assistanceIcon,
  allAssistanceTypes = [],
  orgAssistanceMap = {},
  rowIndex = 0,
  isDrivingDistance = false,
  clientCoordinates = null,
}) {
  const [requirementsExpanded, setRequirementsExpanded] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Refs for measuring content overflow
  const requirementsRef = useRef(null);
  const [requirementsOverflows, setRequirementsOverflows] = useState(false);

  // Detect if content overflows the max height
  useEffect(() => {
    if (requirementsRef.current) {
      setRequirementsOverflows(requirementsRef.current.scrollHeight > COLLAPSED_MAX_HEIGHT);
    }
  }, [record.requirements]);

  // Get the icon component(s) for the primary assistance type
  // Can be a single component or array of components for comma-separated icons
  const assistanceIconResult = assistanceIcon ? getIconByName(assistanceIcon) : null;
  const assistanceIconNames = assistanceIcon ? getIconNames(assistanceIcon) : [];
  // Normalize to array for consistent handling
  const AssistanceIconComponents = assistanceIconResult
    ? (Array.isArray(assistanceIconResult) ? assistanceIconResult : [assistanceIconResult])
    : [];

  // Parse requirements into array (newline separated from Google Sheets Alt+Enter)
  const requirements = useMemo(() => (
    record.requirements
      ? record.requirements.split(/[\n]/).map((r) => r.trim()).filter(Boolean)
      : []
  ), [record.requirements]);

  // Get all assistance types this org provides (from lookup map, for Assistance column icons)
  // orgAssistanceMap[orgName] = array of assist_ids (e.g., ["11", "12", "65"])
  const orgAssistanceTypes = useMemo(() => {
    const orgAssistIds = orgAssistanceMap[record.organization] || [];
    return allAssistanceTypes.filter((at) => orgAssistIds.includes(at.assist_id));
  }, [allAssistanceTypes, orgAssistanceMap, record.organization]);

  // Priority (featured) records get a gold star next to the org name.
  const isPriority = parseInt(record.priority, 10) === 1;

  // Format address
  const addressLines = useMemo(() => formatAddress(record), [record]);

  // Format hours from JSON - use org_hours field.
  // formatHoursFromJson does a JSON.parse on the raw string; with ~1000 rows this
  // dominates render cost on cold start, so memoize it on the raw input.
  const formattedHours = useMemo(() => formatHoursFromJson(record.org_hours), [record.org_hours]);

  // Some orgs list multiple phone numbers, comma-separated. Show each on its
  // own line (the comma itself is not displayed).
  const phoneNumbers = useMemo(
    () => parsePhoneNumbers(record.telephone),
    [record.telephone]
  );

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

  // Status colors for mobile card
  const statusBgColor = {
    1: "var(--color-results-status-active-bg)",
    2: "var(--color-results-status-limited-bg)",
    3: "var(--color-results-status-inactive-bg)",
    4: "var(--color-results-status-closed-bg)",
  }[record.status_id] || "#ccc";

  return (
    <>
      {/* ========== MOBILE CARD LAYOUT (<md) ========== */}
      <div
        className="lg:hidden border-b border-results-row-border font-opensans p-3"
        style={getBgStyle()}
      >
        {/* Top row: Checkbox + Org name + Distance */}
        <div className="flex items-start gap-2 mb-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(record.id, e.target.checked)}
            className="cursor-pointer mt-1 flex-shrink-0"
            style={{
              width: "20px",
              height: "20px",
              accentColor: "var(--color-results-checkbox-checked)",
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {isPriority && <PriorityStar size={15} />}
              {record.webpage ? (
                <a
                  href={record.webpage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-base leading-tight hover:underline"
                  style={{ color: "#0066cc", textDecoration: "none" }}
                >
                  {record.organization}
                </a>
              ) : (
                <div className="font-semibold text-base leading-tight">{record.organization}</div>
              )}
            </div>
            {addressLines.length > 0 && (
              record.googlemaps ? (
                <a
                  href={record.googlemaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm mt-1 block hover:underline"
                  style={{ color: "#0066cc", textDecoration: "none" }}
                >
                  {addressLines.join(", ")}
                </a>
              ) : (
                <div className="text-sm text-gray-600 mt-1">
                  {addressLines.join(", ")}
                </div>
              )
            )}
            {/* Bus Route pill — same deep link as desktop, sized slightly
                smaller for mobile. Placed under the address since they're
                logically grouped ("how do I get to this address?"). No
                marginRight (unlike desktop) because there's no Assistance
                icons column to clear on this layout. */}
            <a
              href={buildTransitDirectionsUrl(record, clientCoordinates)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center rounded-full shrink-0 mt-2 hover:brightness-125"
              style={{
                gap: "5px",
                padding: "3px 8px",
                border: "2px solid var(--color-results-transit-icon)",
                color: "var(--color-results-transit-icon)",
                backgroundColor: "transparent",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.02em",
                textDecoration: "none",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              <TransitIcon size={16} />
              <span>Bus Route</span>
            </a>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            {record.distance != null && (
              <div className="flex items-center gap-1">
                {isDrivingDistance && (
                  <div
                    className="flex items-center justify-center"
                    style={{ color: "var(--color-results-transit-icon)" }}
                  >
                    <HomeMarkerIcon size={14} />
                  </div>
                )}
                <span className="text-sm font-medium">{record.distance.toFixed(1)} mi</span>
              </div>
            )}
            <span
              className="text-xs px-2 py-0.5 rounded-full mt-1"
              
            >
              {record.status}
            </span>
            {(record.status_date || record.status_text) && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatusExpanded(!statusExpanded);
                  }}
                  className="flex items-center mt-0.5"
                >
                  <DoubleChevronIcon expanded={statusExpanded} />
                </button>
                {statusExpanded && (
                  <div
                    className="absolute z-10 shadow-lg rounded right-0 mt-1"
                    style={{
                      minWidth: "150px",
                      maxWidth: "250px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #CCCCCC",
                      padding: "6px 10px",
                    }}
                  >
                    {record.status_date && (
                      <div className="text-xs text-gray-700 italic">{formatStatusDate(record.status_date)}</div>
                    )}
                    {record.status_text && (
                      <div className="text-xs text-gray-700 italic">{record.status_text}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Primary assistance icon + phone — secondary org-wide icons omitted on mobile */}
        <div className="flex items-center justify-between text-sm mb-2">
          <div className="flex items-center gap-1">
            {AssistanceIconComponents.map((IconComp, idx) => (
              <span key={idx} style={{ color: "var(--color-results-assistance-icon)" }}>
                <IconComp size={18} />
              </span>
            ))}
          </div>
          {phoneNumbers.length > 0 && (
            <div className="flex flex-col items-end">
              {phoneNumbers.map((phone) => (
                <a key={phone} href={`tel:${phone.replace(/\D/g, "")}`} className="text-blue-600">
                  {phone}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Expand/collapse for more details */}
        <button
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="text-xs flex items-center gap-1 hover:opacity-80"
          style={{ color: "var(--color-results-expand-chevron)" }}
        >
          {mobileExpanded ? "Less details" : "More details"}
          <DoubleChevronIcon expanded={mobileExpanded} />
        </button>

        {/* Expanded details */}
        {mobileExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-sm space-y-3">
            {/* Hours */}
            {formattedHours && (formattedHours.legacy || formattedHours.rows?.length > 0) && (
              <div>
                <div className="font-semibold text-xs text-gray-500 mb-1">HOURS</div>
                {formattedHours.legacy && <div>{formattedHours.legacy}</div>}
                {formattedHours.rows?.map((row, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{row.days}</span>
                    <span>{row.hours}</span>
                  </div>
                ))}
                {record.hours_notes && (
                  <div
                    className="mt-1 px-2 py-1 text-center text-xs rounded"
                    style={{ backgroundColor: "var(--color-results-hours-notes-bg)" }}
                  >
                    {record.hours_notes}
                  </div>
                )}
              </div>
            )}

            {/* Requirements */}
            {requirements.length > 0 && (
              <div>
                <div className="font-semibold text-xs text-gray-500 mb-1">REQUIREMENTS</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {requirements.map((req, idx) => (
                    <li
                      key={idx}
                      style={idx === 0 ? {
                        fontWeight: record.is_first_bold ? "bold" : undefined,
                        color: record.is_first_red ? "#B8001F" : undefined,
                      } : undefined}
                    >
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ========== DESKTOP GRID LAYOUT (md+) ========== */}
      <div
        className="hidden lg:grid border-b border-results-row-border font-opensans transition-colors duration-150 results-row-hover"
        style={{
          gridTemplateColumns: GRID_COLUMNS,
          padding: "12px 0",
          minHeight: "100px",
          borderBottomWidth: "0.5px",
          ...getBgStyle(),
        }}
      >
      {/* Select Column - Icons stacked vertically with checkbox next to first icon */}
      <div
        className="flex justify-center"
        style={{ alignSelf: "start", gap: "var(--gap-results-select-items)" }}
      >
        {/* Icons column - all icons stacked vertically */}
        {AssistanceIconComponents.length > 0 && (
          <div className="flex flex-col" style={{ gap: "4px" }}>
            {AssistanceIconComponents.map((IconComp, idx) => (
              <IconWithTooltip
                key={idx}
                IconComponent={IconComp}
                size={25}
                iconName={assistanceIconNames[idx]}
                color="var(--color-results-assistance-icon)"
                position="bottom-right"
              />
            ))}
          </div>
        )}
        {/* Checkbox - aligned with bottom of first icon (25px height) */}
        <div
          className="flex items-end"
          style={{ height: AssistanceIconComponents.length > 0 ? "25px" : "auto" }}
        >
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
      </div>

      {/* Miles Column - red address-marker shown when distances come from a custom origin address (driving distances), "mi" underneath */}
      <div
        className="flex flex-col items-center justify-start"
        style={{
          fontSize: "var(--font-size-results-default)",
          letterSpacing: "var(--letter-spacing-results-default)",
        }}
      >
        {isDrivingDistance && record.distance != null && (
          <div
            className="flex items-center justify-center mb-1"
            style={{ color: "var(--color-results-transit-icon)" }}
          >
            <HomeMarkerIcon size={18} />
          </div>
        )}
        <span>{record.distance != null ? record.distance.toFixed(1) : ""}</span>
        {record.distance != null && (
          <span style={{
            fontSize: "var(--font-size-results-more-info)",
            color: "var(--color-results-distance-label)"
          }}>
            mi
          </span>
        )}
      </div>

      {/* Organization Column - org name spans the full column width on its own row.
          Below it, a flex row with align-items: flex-end places the address on the
          left and the Bus Route pill on the right; the pill's bottom edge aligns
          with the bottom of the last address line (no matter how many lines the
          address wraps to). For virtual orgs with no address the address column is
          empty, so the pill ends up where the first address line would have been. */}
      <div style={{ paddingLeft: "20px" }}>
        {/* Organization name - hyperlink to webpage if available.
            Priority (featured) records show a gold star to the right of the name. */}
        <span className="inline-flex items-center gap-1.5">
          {isPriority && <PriorityStar size={16} />}
          {record.webpage ? (
            <a
              href={record.webpage}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{
                fontSize: "var(--font-size-results-org)",
                fontWeight: "var(--font-weight-results-org)",
                letterSpacing: "var(--letter-spacing-results-org)",
                color: "#0066cc",
                textDecoration: "none",
              }}
            >
              {record.organization}
            </a>
          ) : (
            <span
              style={{
                fontSize: "var(--font-size-results-org)",
                fontWeight: "var(--font-weight-results-org)",
                letterSpacing: "var(--letter-spacing-results-org)",
              }}
            >
              {record.organization}
            </span>
          )}
        </span>
        <div
          className="flex"
          style={{
            alignItems: "flex-end",
            marginTop: "10px",
            gap: "16px",
          }}
        >
          {/* Address column (flex:1 pushes the pill to the right edge of the
              column even when there's no address, and minWidth:0 lets long
              addresses wrap rather than expand the column). */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {addressLines.length > 0 && (
              record.googlemaps ? (
                <a
                  href={record.googlemaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col hover:underline"
                  style={{
                    fontSize: "var(--font-size-results-default)",
                    fontWeight: "var(--font-weight-results-default)",
                    letterSpacing: "var(--letter-spacing-results-default)",
                    color: "#0066cc",
                    textDecoration: "none",
                  }}
                >
                  {addressLines.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </a>
              ) : (
                <div
                  className="flex flex-col"
                  style={{
                    fontSize: "var(--font-size-results-default)",
                    fontWeight: "var(--font-weight-results-default)",
                    letterSpacing: "var(--letter-spacing-results-default)",
                  }}
                >
                  {addressLines.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              )
            )}
          </div>
          {/* Transit directions: outlined pill deep-linking to Google Maps with
              travelmode=transit. 100px right margin keeps it inside the
              Organization column rather than crowding the Assistance icons. */}
          <a
            href={buildTransitDirectionsUrl(record, clientCoordinates)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center rounded-full shrink-0 hover:brightness-125"
            style={{
              gap: "6px",
              padding: "2px 8px",
              border: `1px solid var(--color-results-transit-icon)`,
              color: "var(--color-results-transit-icon)",
              backgroundColor: "transparent",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              textDecoration: "none",
              lineHeight: 1,
              whiteSpace: "nowrap",
              marginRight: "100px",
            }}
          >
            <TransitIcon size={17} />
            <span>Bus Route</span>
          </a>
        </div>
      </div>

      {/* Assistance Column - icons for all assistance types this org provides */}
      <div className="flex flex-wrap gap-1" style={{ alignSelf: "start" }}>
        {orgAssistanceTypes.map((at) => {
          const IconResult = getIconByName(at.icon);
          const iconNames = getIconNames(at.icon);
          // Handle array result for comma-separated icons
          const IconComponents = Array.isArray(IconResult) ? IconResult : (IconResult ? [IconResult] : []);
          return IconComponents.map((IconComp, idx) => (
            <IconWithTooltip
              key={`${at.id_no}-${idx}`}
              IconComponent={IconComp}
              size={20}
              iconName={iconNames[idx]}
              color="var(--color-results-assistance-icon-secondary)"
              position={rowIndex === 0 ? "bottom" : "top"}
            />
          ));
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
            {/* Hours display - consistent two-frame layout (legacy shorthands like "24/7" render in the right/hours frame) */}
            {(formattedHours.rows?.length > 0 || formattedHours.special?.length > 0 || formattedHours.legacy) && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 10px 1fr",
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
                  {formattedHours.legacy && (
                    <div className="whitespace-pre-line">{formattedHours.legacy}</div>
                  )}
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
                        gridTemplateColumns: "auto 10px 1fr",
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
      <div className="flex flex-col items-center" style={{ paddingLeft: "40px" }}>
        <StatusPill statusId={record.status_id} status={record.status} />
        {/* Expandable status details - chevron below pill */}
        {(record.status_date || record.status_text) && (
          <div className="relative">
            {/* Chevron toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStatusExpanded(!statusExpanded);
              }}
              className="flex items-center justify-center hover:opacity-80 transition-opacity mt-1"
            >
              <DoubleChevronIcon expanded={statusExpanded} />
            </button>
            {/* Expanded content - positioned box directly under chevron, left-aligned */}
            {statusExpanded && (
              <div
                className="absolute z-10 shadow-lg rounded"
                style={{
                  top: "100%",
                  left: "0",
                  marginTop: "2px",
                  minWidth: "200px",
                  maxWidth: "300px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #CCCCCC",
                  padding: "8px 12px",
                }}
              >
                {record.status_date && (
                  <div
                    className="italic"
                    style={{
                      fontSize: "var(--font-size-results-zip)",
                      color: "#333333",
                    }}
                  >
                    {formatStatusDate(record.status_date)}
                  </div>
                )}
                {record.status_text && (
                  <div
                    className="italic"
                    style={{
                      fontSize: "var(--font-size-results-zip)",
                      color: "#333333",
                    }}
                  >
                    {record.status_text}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Telephone Column - gap before (20px) */}
      <div
        className="flex flex-col"
        style={{
          fontSize: "var(--font-size-results-default)",
          letterSpacing: "var(--letter-spacing-results-default)",
          paddingLeft: "20px",
        }}
      >
        {phoneNumbers.map((phone) => (
          <a
            key={phone}
            href={`tel:${phone.replace(/\D/g, "")}`}
            className="hover:underline"
            style={{ color: "#0066cc", textDecoration: "none" }}
          >
            {phone}
          </a>
        ))}
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
            {/* Content area - constrained height when collapsed for uniform rows */}
            <div
              ref={requirementsRef}
              className="flex-1"
              style={requirementsExpanded ? {} : {
                maxHeight: `${COLLAPSED_MAX_HEIGHT}px`,
                overflow: "hidden",
              }}
            >
              {requirements.map((req, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2"
                  style={idx === 0 ? {
                    fontWeight: record.is_first_bold ? "bold" : undefined,
                    color: record.is_first_red ? "#ed0060" : undefined,
                  } : undefined}
                >
                  <span>•</span>
                  <span>{req}</span>
                </div>
              ))}
            </div>
            {/* Chevron - only show when content overflows */}
            {(requirementsOverflows || requirementsExpanded) && (
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

      </div>
    </>
  );
}

// Memoized export — prevents every row from re-rendering when only a few props change
// (e.g., when one row's selection toggles, or when filters change but most rows persist).
export default React.memo(ResultRow);

// Export grid columns for use in ResultsHeader
export { GRID_COLUMNS };