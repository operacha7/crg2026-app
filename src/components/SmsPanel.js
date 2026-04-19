// src/components/SmsPanel.js
// Panel for composing a text with a deep link to filtered resources.
// Three send methods:
//   1. Google Voice + Extension (seamless auto-fill of phone + message)
//   2. Google Voice manual (clipboard fallback — copies message, user types phone)
//   3. Messages App (native sms: URI)
// The panel detects whether the CRG Google Voice Helper extension is installed
// and adapts the UI accordingly.

import { useState, useEffect } from "react";
import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import DropPanel from "./DropPanel";
import {
  isGvExtensionInstalled,
  sendToGvExtension,
  GV_EXTENSION_STORE_URL,
} from "../utils/gvExtension";

/**
 * SmsPanel - Panel for composing an SMS handoff
 *
 * @param {boolean} isOpen
 * @param {function} onCancel
 * @param {React.Ref} panelRef
 * @param {string} composedBody - Pre-rendered message body (org + header + share URL)
 * @param {function} onInitiated - Fires on any handoff action (used for usage logging)
 * @param {function} onMessagesHandoff - Fires only when the Messages button is clicked
 */
export default function SmsPanel({
  isOpen,
  onCancel,
  panelRef,
  composedBody = "",
  onInitiated,
  onMessagesHandoff,
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [feedback, setFeedback] = useState("");
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [sendingViaExtension, setSendingViaExtension] = useState(false);

  // Reset state when panel opens; check for extension
  useEffect(() => {
    if (isOpen) {
      setPhoneNumber("");
      setFeedback("");
      setSendingViaExtension(false);
      isGvExtensionInstalled().then(setExtensionInstalled);
    }
  }, [isOpen]);

  const digits = phoneNumber.replace(/\D/g, "");
  const isValidPhone = digits.length === 10;
  const e164 = isValidPhone ? `+1${digits}` : "";
  const smsHref = isValidPhone
    ? `sms:${e164}?body=${encodeURIComponent(composedBody)}`
    : "";

  // Check if we're on desktop (extension UI is desktop-only)
  const isDesktop =
    typeof window !== "undefined" && window.innerWidth >= 1024;

  const fireInitiated = () => {
    if (typeof onInitiated === "function") {
      try {
        onInitiated();
      } catch {
        /* logging is best-effort */
      }
    }
  };

  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    let formatted = "";
    if (raw.length > 0) formatted = "(" + raw.slice(0, 3);
    if (raw.length >= 3) formatted += ") " + raw.slice(3, 6);
    if (raw.length >= 6) formatted += "-" + raw.slice(6, 10);
    setPhoneNumber(formatted);
    setFeedback("");
  };

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(
      () => setFeedback((current) => (current === msg ? "" : current)),
      3000
    );
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopyPhone = async () => {
    if (!isValidPhone) return;
    fireInitiated();
    const ok = await copyToClipboard(e164);
    showFeedback(ok ? "Copied!" : "Unable to copy");
  };

  const handleCopyMessage = async () => {
    fireInitiated();
    const ok = await copyToClipboard(composedBody);
    showFeedback(ok ? "Copied!" : "Unable to copy");
  };

  // --- Send method 1: Google Voice + Extension (auto-fill) ---
  const handleSendViaExtension = async () => {
    if (!isValidPhone) return;
    fireInitiated();
    setSendingViaExtension(true);
    try {
      await sendToGvExtension(phoneNumber, composedBody);
      showFeedback("Sent to Google Voice — phone and message will auto-fill.");
    } catch {
      // Extension failed — fall back to clipboard method
      const ok = await copyToClipboard(composedBody);
      showFeedback(
        ok
          ? `Extension unavailable. Message copied — enter ${phoneNumber} in Google Voice.`
          : "Unable to reach extension or copy message."
      );
      window.open(
        "https://voice.google.com/u/0/messages?itemId=draft",
        "_blank"
      );
    } finally {
      setSendingViaExtension(false);
    }
  };

  // --- Send method 2: Google Voice manual (clipboard fallback) ---
  const handleOpenGoogleVoice = async () => {
    if (!isValidPhone) return;
    fireInitiated();
    const ok = await copyToClipboard(composedBody);
    showFeedback(
      ok
        ? `Message copied! Enter ${phoneNumber} in the To field, then paste.`
        : "Unable to copy message"
    );
    window.open(
      "https://voice.google.com/u/0/messages?itemId=draft",
      "_blank"
    );
  };

  // --- Send method 3: Messages App (native sms: URI) ---
  const handleOpenMessages = () => {
    if (!isValidPhone) return;
    fireInitiated();
    if (typeof onMessagesHandoff === "function") {
      try {
        onMessagesHandoff();
      } catch {
        /* toast is best-effort */
      }
    }
    window.location.href = smsHref;
  };

  if (!isOpen) return null;

  return (
    <DropPanel
      title="Text Resources Link"
      isOpen={true}
      onCancel={onCancel}
      onSave={handleOpenMessages}
      panelRef={panelRef}
      style={{
        top: "100%",
        right: "0",
        minWidth: "440px",
      }}
      okButtonText="Open in Messages App"
      okDisabled={!isValidPhone}
      cancelButtonText="Close"
    >
      <div className="flex flex-col gap-4">
        <p
          className="font-opensans"
          style={{ color: "#FFFFFF", fontSize: "14px", lineHeight: "1.5" }}
        >
          Enter the client's phone number, then choose how to send.
          The message is composed on your device — CRG doesn't send it for you.
        </p>

        {/* Phone input with inline copy icon */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="sms-phone-input"
            className="font-opensans"
            style={{ color: "#FFFFFF", fontSize: "13px", fontWeight: 600 }}
          >
            Send Text To
          </label>
          <div className="relative">
            <input
              id="sms-phone-input"
              type="tel"
              placeholder="(713) 555-1234"
              value={phoneNumber}
              onChange={handlePhoneChange}
              className="font-opensans w-full"
              style={{
                backgroundColor: "white",
                color: "black",
                padding: "12px 48px 12px 16px",
                borderRadius: "var(--radius-panel-btn)",
                fontSize: "16px",
                border: "none",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={handleCopyPhone}
              disabled={!isValidPhone}
              aria-label="Copy phone number"
              className="absolute top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
              style={{
                right: "12px",
                color: "#4A4F56",
                opacity: isValidPhone ? 1 : 0.3,
                cursor: isValidPhone ? "pointer" : "not-allowed",
              }}
            >
              <Copy size={18} />
            </button>
          </div>
        </div>

        {/* Message preview with inline copy icon */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="sms-message-preview"
            className="font-opensans"
            style={{ color: "#FFFFFF", fontSize: "13px", fontWeight: 600 }}
          >
            Message preview
          </label>
          <div className="relative">
            <div
              id="sms-message-preview"
              className="font-opensans"
              style={{
                backgroundColor: "#FFFFFF",
                color: "#222831",
                padding: "10px 44px 10px 12px",
                borderRadius: "var(--radius-panel-btn)",
                fontSize: "13px",
                lineHeight: "1.45",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                userSelect: "text",
                maxHeight: "120px",
                overflowY: "auto",
              }}
            >
              {composedBody || "No message available — apply filters first."}
            </div>
            <button
              type="button"
              onClick={handleCopyMessage}
              aria-label="Copy message"
              className="absolute transition-opacity hover:opacity-70"
              style={{
                top: "8px",
                right: "10px",
                color: "#4A4F56",
              }}
            >
              <Copy size={18} />
            </button>
          </div>
        </div>

        {/* ---- Google Voice send options (desktop only) ---- */}
        {isValidPhone && isDesktop && (
          <div className="flex flex-col gap-3">
            {/* Option 1: Extension auto-fill (only when extension detected) */}
            {extensionInstalled && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleSendViaExtension}
                  disabled={sendingViaExtension}
                  className="font-opensans transition-all duration-200 hover:brightness-110 w-full"
                  style={{
                    backgroundColor: "#1a73e8",
                    color: "#FFFFFF",
                    height: "var(--height-panel-btn)",
                    borderRadius: "var(--radius-panel-btn)",
                    fontSize: "var(--font-size-panel-btn)",
                    letterSpacing: "var(--letter-spacing-panel-btn)",
                    fontWeight: 600,
                    opacity: sendingViaExtension ? 0.7 : 1,
                  }}
                >
                  {sendingViaExtension
                    ? "Opening Google Voice..."
                    : "Send via Google Voice"}
                </button>
                <p
                  className="font-opensans text-center"
                  style={{
                    color: "#D7D5D1",
                    fontSize: "11px",
                    margin: 0,
                    lineHeight: "1.3",
                  }}
                >
                  Auto-fills phone number and message
                </p>
              </div>
            )}

            {/* Option 2: Clipboard fallback (always visible) */}
            <div className="flex flex-col gap-1">
              <button
                onClick={handleOpenGoogleVoice}
                className="font-opensans transition-all duration-200 hover:brightness-110 w-full"
                style={{
                  height: "var(--height-panel-btn)",
                  borderRadius: "var(--radius-panel-btn)",
                  fontSize: "var(--font-size-panel-btn)",
                  letterSpacing: "var(--letter-spacing-panel-btn)",
                  fontWeight: 600,
                  // Primary style when no extension, secondary when extension is present
                  ...(extensionInstalled
                    ? {
                        backgroundColor: "transparent",
                        color: "#FFFFFF",
                        border: "1px solid #FFFFFF",
                      }
                    : {
                        backgroundColor: "#1a73e8",
                        color: "#FFFFFF",
                      }),
                }}
              >
                {extensionInstalled
                  ? "Open Google Voice (manual paste)"
                  : "Open in Google Voice"}
              </button>
              <p
                className="font-opensans text-center"
                style={{
                  color: "#D7D5D1",
                  fontSize: "11px",
                  margin: 0,
                  lineHeight: "1.3",
                }}
              >
                {extensionInstalled
                  ? "Use if auto-fill didn't work"
                  : "Message copied to clipboard — type the phone number, then paste"}
              </p>
            </div>

            {/* Install extension link (only when extension NOT detected) */}
            {!extensionInstalled && (
              <p
                className="font-opensans text-center"
                style={{
                  fontSize: "12px",
                  margin: 0,
                  lineHeight: "1.4",
                }}
              >
                <span style={{ color: "#D7D5D1" }}>
                  Want auto-fill?{" "}
                </span>
                <a
                  href={GV_EXTENSION_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#8FB6FF",
                    textDecoration: "underline",
                  }}
                >
                  Install the CRG Google Voice Helper
                </a>
              </p>
            )}
          </div>
        )}

        {/* Google Voice clipboard option for mobile (no extension support) */}
        {isValidPhone && !isDesktop && (
          <div className="flex flex-col gap-1">
            <button
              onClick={handleOpenGoogleVoice}
              className="font-opensans transition-all duration-200 hover:brightness-110 w-full"
              style={{
                backgroundColor: "#1a73e8",
                color: "#FFFFFF",
                height: "var(--height-panel-btn)",
                borderRadius: "var(--radius-panel-btn)",
                fontSize: "var(--font-size-panel-btn)",
                letterSpacing: "var(--letter-spacing-panel-btn)",
                fontWeight: 600,
              }}
            >
              Open in Google Voice
            </button>
            <p
              className="font-opensans text-center"
              style={{
                color: "#D7D5D1",
                fontSize: "11px",
                margin: 0,
                lineHeight: "1.3",
              }}
            >
              Message copied to clipboard — type the phone number, then paste
            </p>
          </div>
        )}

        {/* Desktop-only QR code — scan with phone camera to text from there */}
        {isValidPhone && (
          <div
            className="hidden lg:flex flex-col items-center gap-2"
            style={{
              backgroundColor: "#FFFFFF",
              padding: "12px",
              borderRadius: "var(--radius-panel-btn)",
            }}
          >
            <QRCodeSVG value={smsHref} size={160} level="M" />
            <p
              className="font-opensans text-center"
              style={{
                color: "#222831",
                fontSize: "12px",
                margin: 0,
                lineHeight: "1.4",
              }}
            >
              If you don't have Messages app on your desktop,
              <br />
              scan with your phone's camera to text from there.
            </p>
          </div>
        )}

        {feedback && (
          <p
            className="font-opensans text-center"
            style={{ color: "#FFC857", fontSize: "13px", margin: 0 }}
          >
            {feedback}
          </p>
        )}
      </div>
    </DropPanel>
  );
}
