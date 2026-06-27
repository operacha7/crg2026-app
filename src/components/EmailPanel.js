// src/components/EmailPanel.js
// Panel for sending emails or creating PDFs
// Uses DropPanel for consistent styling
// Includes email preview before sending

import { useState, useEffect, useMemo } from "react";
import { render } from "@react-email/components";
import DropPanel from "./DropPanel";
import PanelScrim from "./PanelScrim";
import { ResourceEmail } from "../emails";
import { useAppData } from "../Contexts/AppDataContext";
import SenderStatusLine from "./SenderStatusLine";

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
}) {
  // senderFooter must also appear in the live preview so it matches the sent
  // email. The "Sending as / blocked" line itself is rendered by SenderStatusLine.
  const { senderFooter } = useAppData();

  // Track which view to show: "warning" or "input"
  const [currentView, setCurrentView] = useState("input");
  const [recipient, setRecipient] = useState("");
  const [language, setLanguage] = useState("en");
  const [previewHtml, setPreviewHtml] = useState(""); // English preview (base)
  const [displayPreviewHtml, setDisplayPreviewHtml] = useState(""); // What's shown (English or translated)
  const [isTranslatingPreview, setIsTranslatingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const NOTE_MAX = 200;
  const noteCharsRemaining = NOTE_MAX - note.length;

  // Generate email preview HTML when panel opens (email mode only).
  // Also re-renders when `note` changes so the user can see their note in
  // the preview as they type. The render is local and synchronous-ish,
  // not an API call. (Translation of the resulting HTML is debounced
  // separately below to avoid hammering Google Translate.)
  useEffect(() => {
    if (isOpen && !isPdfMode && selectedData.length > 0) {
      const generatePreview = async () => {
        try {
          const html = await render(
            ResourceEmail({
              resources: selectedData,
              headerText: headerText,
              note: note,
              senderFooter: senderFooter,
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
  }, [isOpen, isPdfMode, selectedData, headerText, note, senderFooter]);

  // Translate preview when language changes
  useEffect(() => {
    if (!previewHtml || isPdfMode) return;

    // If English, just show the original
    if (language === "en") {
      setDisplayPreviewHtml(previewHtml);
      setTranslationError("");
      return;
    }

    // Clear previous translation error
    setTranslationError("");

    // Translate the preview HTML. Debounced 500ms so typing a note doesn't
    // fire a translation API call on every keystroke (each call costs $).
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
        } else if (!cancelled && result.code === "QUOTA_EXCEEDED") {
          setDisplayPreviewHtml(previewHtml);
          setTranslationError("Translation quota has been reached. Please contact the administrator. Content will be sent in English.");
        }
      } catch (err) {
        console.error("Preview translation failed:", err);
        // Fall back to English preview
        if (!cancelled) setDisplayPreviewHtml(previewHtml);
      } finally {
        if (!cancelled) setIsTranslatingPreview(false);
      }
    };

    const debounceHandle = setTimeout(translatePreview, 500);
    return () => {
      cancelled = true;
      clearTimeout(debounceHandle);
    };
  }, [language, previewHtml, isPdfMode]);

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setRecipient("");
      setLanguage("en");
      setShowPreview(false);
      setTranslationError("");
      setNote("");
      setShowNoteInput(false);
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

  // Handle OK/Send - pass language and trimmed note along with recipient
  const handleSend = () => {
    onSend(recipient, language, note.trim());
  };

  // Outlined amber action-button style — shared by Add Note + Show Preview.
  // Transparent bg, #D18B3F text + border (--color-panel-action-btn-*).
  // Full-width so the buttons span the panel body — they line up with the
  // Recipient Email input above. Font size matches the input (16px) so all
  // body controls read at the same weight.
  const actionButtonStyle = {
    backgroundColor: "transparent",
    color: "var(--color-panel-action-btn-text)",
    border: "1.5px solid var(--color-panel-action-btn-border)",
    height: "var(--height-panel-btn)",
    width: "100%",
    padding: "0 18px",
    borderRadius: "var(--radius-panel-btn)",
    fontSize: "16px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    cursor: "pointer",
  };

  // Optional personal note. The "Add Note" toggle mirrors the "Show Preview"
  // pattern. Hard-capped at 200 chars — enough for a brief personal message
  // without bloating the email. Note is sent verbatim (not translated), so a
  // Spanish-speaking sender writing a Spanish note keeps their exact wording
  // when language=es.
  const renderNoteSection = () => (
    <>
      <button
        type="button"
        onClick={() => setShowNoteInput(!showNoteInput)}
        disabled={isSending}
        className="font-opensans transition-all duration-200 hover:brightness-110"
        style={{
          ...actionButtonStyle,
          cursor: isSending ? "not-allowed" : "pointer",
          opacity: isSending ? 0.7 : 1,
        }}
      >
        {showNoteInput ? "Hide Note" : "Add Note"}
      </button>

      {showNoteInput && (
        <div className="flex flex-col gap-1">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            disabled={isSending}
            rows={3}
            placeholder="Optional personal note to the recipient"
            className="font-opensans w-full"
            style={{
              backgroundColor: "var(--color-panel-input-bg)",
              color: "#222",
              padding: "10px 12px",
              borderRadius: "var(--radius-panel-btn)",
              fontSize: "14px",
              border: "1px solid var(--color-panel-input-border)",
              outline: "none",
              resize: "vertical",
              opacity: isSending ? 0.7 : 1,
            }}
          />
          <div className="flex items-center justify-between font-opensans" style={{ fontSize: "11px" }}>
            <span style={{ color: "var(--color-panel-label-text)", fontStyle: "italic" }}>
              Note is sent as typed — not translated.
            </span>
            <span style={{ color: noteCharsRemaining <= 20 ? "#cc0000" : "var(--color-panel-label-text)" }}>
              {noteCharsRemaining} chars remaining
            </span>
          </div>
        </div>
      )}
    </>
  );

  // Shared form-label style — uppercase, deep teal, small. Used for Language
  // and Recipient Email above their respective controls.
  const fieldLabelStyle = {
    color: "var(--color-panel-label-text)",
    fontSize: "var(--font-size-panel-label)",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };

  // Custom caret for the Language select (in --color-panel-label-text). Used
  // as a background-image so the native select arrow stays hidden via
  // appearance:none and the visible caret stays on-brand.
  const CARET_TEAL = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2343747D'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`;

  const languageSelectStyle = {
    backgroundColor: "transparent",
    color: "var(--color-panel-select-btn-text)",
    border: "1.5px solid var(--color-panel-select-btn-border)",
    borderRadius: "var(--radius-panel-btn)",
    padding: "8px 36px 8px 14px",
    fontSize: "14px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    cursor: "pointer",
    backgroundImage: CARET_TEAL,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    backgroundSize: "18px 18px",
  };

  if (!isOpen) return null;

  // Check if we're on mobile (< 768px) to apply different positioning
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Warning view for inactive resources
  if (currentView === "warning") {
    return (
      <>
        <PanelScrim isOpen onClose={onCancel} zIndex={49} />
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
                color: "#4A4F56",
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
      </>
    );
  }

  // Input view for email/PDF
  return (
    <>
      <PanelScrim isOpen onClose={handleCancel} zIndex={49} />
    <DropPanel
      title={isPdfMode ? "Create PDF" : "Email Selected Resources"}
      isOpen={true}
      onCancel={handleCancel}
      onSave={handleSend}
      panelRef={panelRef}
      style={{
        top: "100%",
        right: "0",
        minWidth: showPreview ? "750px" : "450px",
      }}
      okButtonText={isPdfMode ? "OK" : "Send"}
      showHelpIcon={false}
      okDisabled={!isPdfMode && !recipient}
    >
      <div className="flex flex-col gap-4">
        {/* Sender-footer status: who this will be "Sent by", with a change/select
            link, or the blocked explanation. Hidden for guests. */}
        <SenderStatusLine />

        {/* Language — uppercase teal label above an outlined select styled
            as a button-with-caret. Same #43747D for label, border, and text. */}
        <div className="flex flex-col gap-1.5 self-start">
          <span className="font-opensans" style={fieldLabelStyle}>
            Language
          </span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="font-opensans hover:brightness-110 transition-all duration-200"
            style={languageSelectStyle}
            aria-label="Language"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>

        {/* Email input - only for email mode */}
        {!isPdfMode && (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email-panel-recipient"
                className="font-opensans"
                style={fieldLabelStyle}
              >
                Recipient Email
              </label>
              <input
                id="email-panel-recipient"
                type="email"
                placeholder="name@example.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={isSending}
                className="font-opensans transition-all duration-200 w-full"
                style={{
                  backgroundColor: "var(--color-panel-input-bg)",
                  color: "#222",
                  padding: "12px 16px",
                  borderRadius: "var(--radius-panel-btn)",
                  fontSize: "16px",
                  border: "1px solid var(--color-panel-input-border)",
                  outline: "none",
                  opacity: isSending ? 0.7 : 1,
                }}
              />
            </div>

            {renderNoteSection()}

            {/* Preview toggle — outlined amber, matches Add Note */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="font-opensans transition-all duration-200 hover:brightness-110"
              style={actionButtonStyle}
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
          <>
            <p
              className="font-opensans text-center"
              style={{
                color: "#4A4F56",
                fontSize: "16px",
              }}
            >
              Click OK to create your PDF.
            </p>
            {renderNoteSection()}
          </>
        )}

        {/* Sending indicator */}
        {isSending && (
          <p
            className="font-opensans text-center"
            style={{
              color: "#4A4F56",
              fontSize: "14px",
            }}
          >
            {isPdfMode ? "Creating PDF..." : "Sending..."}
          </p>
        )}

        {/* Translation quota error */}
        {translationError && (
          <p
            className="font-opensans text-center"
            style={{
              color: "#FF6B6B",
              fontSize: "14px",
              marginBottom: "8px",
            }}
          >
            {translationError}
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
    </>
  );
}
