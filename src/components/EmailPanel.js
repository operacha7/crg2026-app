// src/components/EmailPanel.js
// Panel for sending emails or creating PDFs
// Uses DropPanel for consistent styling
// Includes email preview before sending

import { useState, useEffect, useMemo } from "react";
import { render } from "@react-email/components";
import DropPanel from "./DropPanel";
import { ResourceEmail } from "../emails";

/**
 * EmailPanel - Panel for email/PDF with inactive resource warning and preview
 *
 * Flow:
 * 1. If inactive resources selected → Show warning panel first
 * 2. User clicks Continue → Show preview + email entry panel
 * 3. For email: see preview, enter recipient, click Send
 * 4. For PDF: no preview, click OK to create
 *
 * @param {boolean} isOpen - Whether panel is visible
 * @param {function} onCancel - Cancel handler (closes panel)
 * @param {function} onSend - Send/Create handler
 * @param {React.Ref} panelRef - Ref for click-outside detection
 * @param {boolean} isPdfMode - True for PDF, false for email
 * @param {boolean} hasInactiveResources - Whether any selected resources are inactive
 * @param {boolean} isSending - Whether send/create is in progress
 * @param {string} statusMessage - Error or status message to display
 * @param {Array} selectedData - Resources to include in email (for preview)
 * @param {string} headerText - Header text for email (e.g., "Resources for Zip Code: 77025")
 * @param {string} orgPhone - Callback phone number for email
 */
export default function EmailPanel({
  isOpen,
  onCancel,
  onSend,
  panelRef,
  isPdfMode = false,
  hasInactiveResources = false,
  isSending = false,
  statusMessage = "",
  selectedData = [],
  headerText = "Resources",
  orgPhone = "713-664-5350",
}) {
  // Track which view to show: "warning" or "input"
  const [currentView, setCurrentView] = useState("input");
  const [recipient, setRecipient] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Generate email preview HTML when panel opens (email mode only)
  useEffect(() => {
    if (isOpen && !isPdfMode && selectedData.length > 0) {
      const generatePreview = async () => {
        try {
          const html = await render(
            ResourceEmail({
              resources: selectedData,
              headerText: headerText,
              orgPhone: orgPhone,
            })
          );
          setPreviewHtml(html);
        } catch (err) {
          console.error("Error generating email preview:", err);
          setPreviewHtml("");
        }
      };
      generatePreview();
    }
  }, [isOpen, isPdfMode, selectedData, headerText, orgPhone]);

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setRecipient("");
      setShowPreview(false);
      // Show warning first if there are inactive resources
      setCurrentView(hasInactiveResources ? "warning" : "input");
    }
  }, [isOpen, hasInactiveResources]);

  // Handle Continue from warning view
  const handleWarningContinue = () => {
    setCurrentView("input");
  };

  // Handle Cancel - closes panel completely
  const handleCancel = () => {
    onCancel();
  };

  // Handle OK/Send
  const handleSend = () => {
    onSend(recipient);
  };

  if (!isOpen) return null;

  // Check if we're on mobile (< 768px) to apply different positioning
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Warning view for inactive resources
  if (currentView === "warning") {
    return (
      <div
        ref={panelRef}
        className="fixed md:absolute shadow-xl z-50 overflow-hidden left-2 right-2 md:left-auto md:right-auto"
        style={{
          borderRadius: "var(--radius-panel)",
          minWidth: isMobile ? "min(400px, calc(100vw - 16px))" : "400px",
          maxWidth: isMobile ? "calc(100vw - 16px)" : undefined,
          marginTop: isMobile ? undefined : "25px",
          top: isMobile ? "120px" : "100%",
          right: isMobile ? undefined : "0",
          border: "var(--width-panel-border) solid var(--color-panel-border)",
        }}
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
            Inactive Resources
          </h3>
        </div>

        {/* Body */}
        <div
          style={{
            backgroundColor: "var(--color-panel-body-bg)",
            padding: "20px",
          }}
        >
          {/* Warning message */}
          <div className="mb-8" style={{ minWidth: "350px" }}>
            <p
              className="font-opensans italic"
              style={{
                color: "#FFFFFF",
                fontSize: "16px",
                lineHeight: "1.6",
              }}
            >
              You have selected an organization listed as inactive. Please{" "}
              <span style={{ color: "#FF0000" }}>Cancel</span> and correct.
              However, if you have personal knowledge that the organization is
              active, you may continue. Please let us know by contacting support
              from the vertical menu on the right.
            </p>
          </div>

          {/* Footer with buttons */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleCancel}
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

            <button
              onClick={handleWarningContinue}
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
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Input view for email/PDF
  return (
    <DropPanel
      title={isPdfMode ? "Create PDF" : "Email Selected Resources"}
      isOpen={true}
      onCancel={handleCancel}
      onSave={handleSend}
      panelRef={panelRef}
      style={{
        top: "100%",
        right: "0",
        minWidth: showPreview ? "700px" : "400px",
      }}
      okButtonText={isPdfMode ? "OK" : "Send"}
      showHelpIcon={false}
      okDisabled={!isPdfMode && !recipient}
    >
      <div className="flex flex-col gap-4">
        {/* Email input - only for email mode */}
        {!isPdfMode && (
          <>
            <input
              type="email"
              placeholder="Recipient Email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={isSending}
              className="font-opensans transition-all duration-200 w-full"
              style={{
                backgroundColor: "white",
                color: "black",
                padding: "12px 16px",
                borderRadius: "var(--radius-panel-btn)",
                fontSize: "16px",
                border: "none",
                outline: "none",
                opacity: isSending ? 0.7 : 1,
              }}
            />

            {/* Preview toggle button */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="font-opensans transition-all duration-200 hover:brightness-110"
              style={{
                backgroundColor: showPreview ? "#666" : "#007ab8",
                color: "#F3EED9",
                height: "var(--height-panel-btn)",
                borderRadius: "var(--radius-panel-btn)",
                fontSize: "var(--font-size-panel-btn)",
                letterSpacing: "var(--letter-spacing-panel-btn)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>

            {/* Email preview iframe */}
            {showPreview && previewHtml && (
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "var(--radius-panel-btn)",
                  overflow: "hidden",
                  maxHeight: "400px",
                }}
              >
                <iframe
                  srcDoc={previewHtml}
                  title="Email Preview"
                  style={{
                    width: "100%",
                    height: "400px",
                    border: "none",
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* PDF mode - just confirmation text */}
        {isPdfMode && (
          <p
            className="font-opensans text-center"
            style={{
              color: "#FFFFFF",
              fontSize: "16px",
            }}
          >
            Click OK to create your PDF.
          </p>
        )}

        {/* Sending indicator */}
        {isSending && (
          <p
            className="font-opensans text-center"
            style={{
              color: "#FFFFFF",
              fontSize: "14px",
            }}
          >
            {isPdfMode ? "Creating PDF..." : "Sending..."}
          </p>
        )}

        {/* Status/error message */}
        {statusMessage && (
          <p
            className="font-opensans text-center"
            style={{
              color: "#FF6B6B",
              fontSize: "14px",
            }}
          >
            {statusMessage}
          </p>
        )}
      </div>
    </DropPanel>
  );
}
