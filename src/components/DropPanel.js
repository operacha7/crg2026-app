// src/components/DropPanel.js
// Reusable drop panel component with consistent styling
// Used by: Distance panel, Assistance panel, Email panel, PDF panel

import { HelpIcon } from "../icons";
import Tooltip from "./Tooltip";

/**
 * DropPanel - Reusable dropdown panel with header, body, and footer
 *
 * @param {string} title - Panel header title
 * @param {boolean} isOpen - Whether panel is visible
 * @param {function} onCancel - Cancel button handler
 * @param {function} onSave - OK button handler
 * @param {React.Ref} panelRef - Ref for click-outside detection
 * @param {React.ReactNode} children - Panel body content
 * @param {object} style - Additional styles for positioning (top, left, right, etc.)
 * @param {string} okButtonText - Text for OK button (default: "OK")
 * @param {boolean} showHelpIcon - Whether to show help icon (default: true)
 * @param {boolean} okDisabled - Whether OK button is disabled (default: false)
 */
export default function DropPanel({
  title,
  isOpen,
  onCancel,
  onSave,
  panelRef,
  children,
  style = {},
  okButtonText = "OK",
  showHelpIcon = true,
  okDisabled = false,
}) {
  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute shadow-xl z-50 overflow-hidden"
      style={{
        borderRadius: "var(--radius-panel)",
        minWidth: "400px",
        marginTop: "25px", // Consistent spacing below trigger element
        border: "var(--width-panel-border) solid var(--color-panel-border)",
        ...style,
      }}
    >
      {/* Header */}
      <div
        className="flex flex-col items-center justify-center"
        style={{
          backgroundColor: "var(--color-panel-header-bg)",
          height: "var(--height-panel-header)",
          padding: "0 20px",
        }}
      >
        <h3
          className="font-opensans"
          style={{
            color: "var(--color-panel-title)",
            fontSize: "var(--font-size-panel-title)",
            fontWeight: "var(--font-weight-panel-title)",
            letterSpacing: "var(--letter-spacing-panel-title)",
          }}
        >
          {title}
        </h3>
      </div>

      {/* Body */}
      <div
        style={{
          backgroundColor: "var(--color-panel-body-bg)",
          padding: "20px",
        }}
      >
        {/* Content area */}
        <div className="mb-8">
          {children}
        </div>

        {/* Footer with buttons */}
        <div className={`flex items-center ${showHelpIcon ? 'justify-center gap-36' : 'justify-between'}`}>
          <button
            onClick={onCancel}
            className="font-opensans transition-all duration-200 hover:brightness-110"
            style={{
              backgroundColor: "var(--color-panel-btn-cancel-bg)",
              color: "var(--color-panel-btn-text)",
              width: "var(--width-panel-btn)",
              height: "var(--height-panel-btn)",
              borderRadius: "var(--radius-panel-btn)",
              fontSize: "var(--font-size-panel-btn)",
              letterSpacing: "var(--letter-spacing-panel-btn)",
            }}
          >
            Cancel
          </button>

          {showHelpIcon && (
            <Tooltip text="Help">
              <HelpIcon
                size={40}
                className="cursor-pointer hover:brightness-110 transition-all duration-200"
              />
            </Tooltip>
          )}

          <button
            onClick={onSave}
            disabled={okDisabled}
            className="font-opensans transition-all duration-200 hover:brightness-110"
            style={{
              backgroundColor: "var(--color-panel-btn-ok-bg)",
              color: "var(--color-panel-btn-text)",
              width: "var(--width-panel-btn)",
              height: "var(--height-panel-btn)",
              borderRadius: "var(--radius-panel-btn)",
              fontSize: "var(--font-size-panel-btn)",
              letterSpacing: "var(--letter-spacing-panel-btn)",
            }}
          >
            {okButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}