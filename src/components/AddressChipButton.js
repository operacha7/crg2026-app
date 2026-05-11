// src/components/AddressChipButton.js
// Pill-shaped "Address" chip that opens the DistancePanel to let the user
// set a custom origin address. Used purely for in-app distance calculations
// and result sorting — the address never leaves the org's session (it's
// intentionally not embedded in outgoing email/PDF/SMS content).
//
// Visual states (all in --color-results-transit-icon red):
//   disabled            → outlined, 30% opacity
//   enabled, inactive   → outlined, full opacity
//   enabled, active     → filled, white label/icon (clientCoordinates is set)

import { useState, useRef, useEffect } from "react";
import Tooltip from "./Tooltip";
import DistancePanel from "./DistancePanel";
import { HomeMarkerIcon } from "../icons";

export default function AddressChipButton({
  isActive = false,
  defaultCoordinates = "",
  onCoordinatesChange,
  clientAddress = "",
  clientCoordinates = "",
  disabled = false,
  tooltipText = "Enter Address for driving distances",
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPanelOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsPanelOpen(!isPanelOpen);
  };

  const handleCancel = () => setIsPanelOpen(false);

  const handleSave = ({ address, coordinates }) => {
    onCoordinatesChange?.(address, coordinates);
    setIsPanelOpen(false);
  };

  return (
    <div className="relative">
      <Tooltip text={tooltipText}>
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className={`inline-flex items-center rounded-full shrink-0 transition-all duration-200 ${
            disabled ? "" : "hover:brightness-125"
          }`}
          style={{
            gap: "6px",
            padding: "4px 8px",
            border: "2px solid var(--color-results-transit-icon)",
            backgroundColor: isActive
              ? "var(--color-results-transit-icon)"
              : "#FFFFFF",
            color: isActive
              ? "#FFFFFF"
              : "var(--color-results-transit-icon)",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.02em",
            lineHeight: 1,
            whiteSpace: "nowrap",
            cursor: disabled ? "not-allowed" : "pointer",
            // Three visual states: disabled (faded), enabled-inactive (full
            // opacity outlined), enabled-active (filled). 0.6 keeps the chip
            // legible against the tan NavBar3 background while still reading
            // as "not yet available" — softer than the original 0.3.
            opacity: disabled ? 0.70 : 1,
          }}
        >
          <HomeMarkerIcon size={18} />
          <span>Address</span>
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
