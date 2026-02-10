// src/components/DropPanel.js
// Reusable drop panel component with consistent styling
// Used by: Distance panel, Email panel, PDF panel

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
 * @param {boolean} okDisabled - Whether OK button is disabled (default: false)
 * @param {function} onClear - Optional Clear button handler (renders between Cancel and OK)
 * @param {string} clearButtonText - Text for Clear button (default: "Clear")
 * @param {string} clearButtonBgColor - Background color for Clear button (default: "#007ab8")
 * @param {string} clearButtonTextColor - Text color for Clear button (default: "#FFFFFF")
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
  okDisabled = false,
  onClear,
  clearButtonText = "Clear",
  clearButtonBgColor = "#007ab8",
  clearButtonTextColor = "#FFFFFF",
}) {
  if (!isOpen) return null;

  // Check if we're on mobile (< 768px) to apply different positioning
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // On mobile, override top positioning to place panel below NavBar1
  // On desktop, use the passed style (typically top: "100%" for dropdown behavior)
  const computedStyle = isMobile
    ? {
        borderRadius: "var(--radius-panel)",
        minWidth: "min(400px, calc(100vw - 16px))",
        maxWidth: "calc(100vw - 16px)",
        border: "var(--width-panel-border) solid var(--color-panel-border)",
        top: "120px", // Fixed position below NavBar1 on mobile
      }
    : {
        borderRadius: "var(--radius-panel)",
        minWidth: "min(400px, calc(100vw - 16px))",
        maxWidth: "calc(100vw - 16px)",
        marginTop: "25px", // Consistent spacing below trigger element (desktop)
        border: "var(--width-panel-border) solid var(--color-panel-border)",
        ...style,
      };

  return (
    <div
      ref={panelRef}
      // Mobile: fixed positioning centered horizontally
      // Desktop: absolute positioning relative to trigger button
      className="fixed md:absolute shadow-xl z-50 overflow-hidden left-2 right-2 md:left-auto md:right-auto"
      style={computedStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
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
        <div className="flex items-center justify-between">
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

          {/* Optional Clear button in the middle */}
          {onClear && (
            <button
              onClick={onClear}
              className="font-opensans transition-all duration-200 hover:brightness-110"
              style={{
                backgroundColor: clearButtonBgColor,
                color: clearButtonTextColor,
                width: "var(--width-panel-btn)",
                height: "var(--height-panel-btn)",
                borderRadius: "var(--radius-panel-btn)",
                fontSize: "var(--font-size-panel-btn)",
                letterSpacing: "var(--letter-spacing-panel-btn)",
              }}
            >
              {clearButtonText}
            </button>
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