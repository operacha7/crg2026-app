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
  const [language, setLanguage] = useState("en");
  const [previewHtml, setPreviewHtml] = useState(""); // English preview (base)
  const [displayPreviewHtml, setDisplayPreviewHtml] = useState(""); // What's shown (English or translated)
  const [isTranslatingPreview, setIsTranslatingPreview] = useState(false);
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
          setDisplayPreviewHtml(html);
        } catch (err) {
          console.error("Error generating email preview:", err);
          setPreviewHtml("");
        }
      };
      generatePreview();
    }
  }, [isOpen, isPdfMode, selectedData, headerText, orgPhone]);

  // Translate preview when language changes
  useEffect(() => {
    if (!previewHtml || isPdfMode) return;

    // If English, just show the original
    if (language === "en") {
      setDisplayPreviewHtml(previewHtml);
      return;
    }

    // Translate the preview HTML
    let cancelled = false;
    const translatePreview = async () => {
      setIsTranslatingPreview(true);
      try {
        const translateUrl =
          window.location.hostname === "localhost"
            ? "http://localhost:8788/translate"
            : "/translate";

        const res = await fetch(translateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            htmlBody: previewHtml,
            subject: "",
            targetLanguage: language,
          }),
        });

        const result = await res.json();
        if (!cancelled && result.success) {
          setDisplayPreviewHtml(result.htmlBody);
        }
      } catch (err) {
        console.error("Preview translation failed:", err);
        // Fall back to English preview
        if (!cancelled) setDisplayPreviewHtml(previewHtml);
      } finally {
        if (!cancelled) setIsTranslatingPreview(false);
      }
    };

    translatePreview();
    return () => { cancelled = true; };
  }, [language, previewHtml, isPdfMode]);

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setRecipient("");
      setLanguage("en");
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

  // Handle OK/Send - pass language along with recipient
  const handleSend = () => {
    onSend(recipient, language);
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
            Inactive / Closed Resources
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
              You have selected an organization listed as inactive or closed. Please{" "}
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
        {/* Language selector - visible in both email and PDF modes */}
        <div className="flex items-center gap-3">
          <label
            className="font-opensans"
            style={{
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Language:
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="font-opensans"
            style={{
              backgroundColor: "#005C72",
              color: "#FFFFFF",
              padding: "8px 12px",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "500",
              border: "none",
              cursor: "pointer",
            }}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>

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
                color: "#FFFFFF",
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
                  position: "relative",
                }}
              >
                {isTranslatingPreview && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(255,255,255,0.8)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 10,
                    }}
                  >
                    <span className="font-opensans" style={{ fontSize: "14px", color: "#333" }}>
                      Translating...
                    </span>
                  </div>
                )}
                <iframe
                  srcDoc={displayPreviewHtml}
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
