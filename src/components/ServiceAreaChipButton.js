// src/components/ServiceAreaChipButton.js
// Toggle chip shown in NavBar2's Organization-mode left frame (next to the
// Parent/Child dropdowns). When active, the results switch to the "Service Area
// audit" view — all resources serving any zip in the selected CHILD org's
// service area — and the Parent dropdown locks (handled by NavBar2).
//
// Styling mirrors the Address chip (see AddressChipButton.js) but uses NavBar2's
// blue palette:
//   inactive → white bg, #2E5A88 text/icon, 2px #2E5A88 border
//   active   → reversed: #2E5A88 bg, white text/icon
//
// Internal audit tool — not part of the neighbor lookup flow.

import Tooltip from "./Tooltip";

// Placeholder icon — REPLACE with the icon the user supplies. Kept as a simple
// inline SVG (overlapping pins / "area") so the chip reads correctly until the
// real asset lands. Inherits color via `currentColor`.
function ServiceAreaPlaceholderIcon({ size = 20 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" />
      <path d="M9 4v13M15 7v13" />
    </svg>
  );
}

export default function ServiceAreaChipButton({
  isActive = false,
  onToggle,
  disabled = false,
  tooltipText = "Show all resources serving this organization's service area (audit)",
}) {
  const handleClick = () => {
    if (disabled) return;
    onToggle?.(!isActive);
  };

  return (
    <Tooltip text={tooltipText}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center shrink-0 font-opensans transition-all duration-200 ${
          disabled ? "" : "hover:brightness-125"
        }`}
        style={{
          // Pill chip matching the Address chip (same font + icon size); height
          // aligned to the NavBar2 dropdown row.
          height: "var(--height-navbar2-btn)",
          paddingLeft: "12px",
          paddingRight: "12px",
          gap: "8px",
          borderRadius: "var(--radius-assistance-chip)",
          fontSize: "var(--font-size-assistance-chip)",
          fontWeight: 500,
          letterSpacing: "var(--letter-spacing-assistance-chip)",
          lineHeight: 1,
          whiteSpace: "nowrap",
          border: "var(--border-width-btn) solid var(--color-service-area-chip-border)",
          backgroundColor: isActive
            ? "var(--color-service-area-chip-active-bg)"
            : "var(--color-service-area-chip-inactive-bg)",
          color: isActive
            ? "var(--color-service-area-chip-active-text)"
            : "var(--color-service-area-chip-inactive-text)",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <ServiceAreaPlaceholderIcon size={22} />
        <span>Service Area</span>
      </button>
    </Tooltip>
  );
}
