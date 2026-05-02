// src/components/SmsPanel.js
// Panel for sending resource links via text message.
// Four send methods presented as cards:
//   1. Google Voice (auto) — Chrome extension auto-fills phone + message + sends
//   2. Google Voice (manual) — Copies message to clipboard, opens GV compose
//   3. Messaging App (auto) — Native sms: URI, auto-fills phone + message
//   4. Text From Phone (auto) — QR code for scanning from phone
// Extension detection adapts the GV auto card (installed vs required vs Chrome required).

import { useState, useEffect } from "react";
import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import DropPanel from "./DropPanel";
import {
  isGvExtensionInstalled,
  sendToGvExtension,
  GV_EXTENSION_STORE_URL,
} from "../utils/gvExtension";

// Detect Chrome or Edge (both support Chrome extensions)
function isChromeBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Edge also runs Chrome extensions, so include it
  return /Chrome\//.test(ua) || /Edg\//.test(ua);
}

/**
 * SmsPanel - Card-based panel for sending resource links via text
 */
export default function SmsPanel({
  isOpen,
  onCancel,
  panelRef,
  composedBody = "",
  onInitiated,
  onMessagesHandoff,
  onGvAutoSent,
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [feedback, setFeedback] = useState("");
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [sendingViaExtension, setSendingViaExtension] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showExtensionPrompt, setShowExtensionPrompt] = useState(false);

  const isChrome = isChromeBrowser();

  // Reset state when panel opens; check for extension
  useEffect(() => {
    if (isOpen) {
      setPhoneNumber("");
      setFeedback("");
      setSendingViaExtension(false);
      setShowQrCode(false);
      setShowExtensionPrompt(false);
      if (isChrome) {
        isGvExtensionInstalled().then(setExtensionInstalled);
      }
    }
  }, [isOpen, isChrome]);

  const digits = phoneNumber.replace(/\D/g, "");
  const isValidPhone = digits.length === 10;
  const e164 = isValidPhone ? `+1${digits}` : "";
  const smsHref = isValidPhone
    ? `sms:${e164}?body=${encodeURIComponent(composedBody)}`
    : "";

  const fireInitiated = () => {
    if (typeof onInitiated === "function") {
      try { onInitiated(); } catch { /* logging is best-effort */ }
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
    showFeedback(ok ? "Phone number copied!" : "Unable to copy");
  };

  // --- Card 1: Google Voice (auto) via extension ---
  const handleGvAuto = async () => {
    if (!isValidPhone) return;

    // If extension not installed, show install prompt
    if (!extensionInstalled) {
      setShowExtensionPrompt(true);
      return;
    }

    fireInitiated();
    setSendingViaExtension(true);
    try {
      await sendToGvExtension(phoneNumber, composedBody);
      showFeedback("Sent to Google Voice — phone and message will auto-fill.");

      // Fire onGvAutoSent the next time the user returns to this tab. Optimistic:
      // we trust that the extension's auto-click landed (same fidelity model as
      // email/PDF success — Resend/PDFShift 200 doesn't guarantee delivery either).
      if (typeof onGvAutoSent === "function") {
        const handleVisible = () => {
          if (!document.hidden) {
            document.removeEventListener("visibilitychange", handleVisible);
            try { onGvAutoSent(); } catch { /* best-effort */ }
          }
        };
        document.addEventListener("visibilitychange", handleVisible);
      }
    } catch {
      // Extension failed — fall back to manual method
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

  // --- Card 2: Google Voice (manual) — copy message + open GV ---
  const handleGvManual = async () => {
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

  // --- Card 3: Messaging App (auto) via sms: URI ---
  const handleMessagingApp = () => {
    if (!isValidPhone) return;
    fireInitiated();
    if (typeof onMessagesHandoff === "function") {
      try { onMessagesHandoff(); } catch { /* best-effort */ }
    }
    window.location.href = smsHref;
  };

  // --- Card 4: Text From Phone — show QR code ---
  const handleTextFromPhone = () => {
    if (!isValidPhone) return;
    fireInitiated();
    setShowQrCode(!showQrCode);
  };

  // Extension install prompt: continue to store
  const handleExtensionInstallContinue = () => {
    setShowExtensionPrompt(false);
    window.open(GV_EXTENSION_STORE_URL, "_blank");
  };

  if (!isOpen) return null;

  // Card style constants
  const CARD_BLUE = "#4285F4";
  const CARD_GREEN = "#60935D";
  const CARD_RADIUS = "8px";

  // Determine GV auto badge state
  let gvAutoBadge;
  if (!isChrome) {
    gvAutoBadge = { text: "CHROME REQUIRED", bg: "#FFFFFF", color: "#DC3545" };
  } else if (extensionInstalled) {
    gvAutoBadge = { text: "EXTENSION READY", bg: "#FFFFFF", color: "#28A745" };
  } else {
    gvAutoBadge = { text: "EXTENSION REQUIRED", bg: "#FFFFFF", color: "#DC3545" };
  }

  return (
    <DropPanel
      title="Text Resources Link"
      isOpen={true}
      onCancel={onCancel}
      panelRef={panelRef}
      style={{
        top: "100%",
        right: "0",
        minWidth: "440px",
      }}
      hideOkButton={true}
      cancelButtonText="Close"
    >
      <div className="flex flex-col gap-4">
        {/* Subtitle */}
        <p
          className="font-opensans text-center"
          style={{ color: "#FFFFFF", fontSize: "13px", margin: 0, lineHeight: "1.3" }}
        >
          Sent from your phone number. CRG does not send.
        </p>

        {/* Phone input */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="sms-phone-input"
            className="font-opensans"
            style={{ color: "#FFFFFF", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            To
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

        {/* Section label — negative margin to tighten gap with first card */}
        {isValidPhone && (
          <p
            className="font-opensans"
            style={{ color: "#FFFFFF", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, marginBottom: "-12px" }}
          >
            How do you want to send the text?
          </p>
        )}

        {/* Extension install prompt overlay */}
        {showExtensionPrompt && (
          <div
            className="font-opensans"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: CARD_RADIUS,
              padding: "16px",
              border: "2px solid #DC3545",
            }}
          >
            <p style={{ fontSize: "14px", color: "#222831", margin: "0 0 12px 0", lineHeight: "1.5" }}>
              This feature requires the <strong>CRG Google Voice Helper</strong> Chrome extension.
              Click OK to open the Chrome Web Store, then install it by clicking
              <strong> "Add to Chrome"</strong>, then <strong>"Continue to install"</strong>, and finally
              <strong> "Add extension"</strong>.
            </p>
            <p style={{ fontSize: "13px", color: "#4A4F56", margin: "0 0 12px 0", lineHeight: "1.5" }}>
              During install, Chrome will warn the extension "can read and change your data on
              voice.google.com." This is boilerplate Google shows for any site-specific extension.
              It does not change settings, access your contacts, or send data outside Google Voice.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowExtensionPrompt(false)}
                className="font-opensans transition-all duration-200 hover:brightness-110"
                style={{
                  backgroundColor: "var(--color-panel-btn-cancel-bg)",
                  color: "#FFFFFF",
                  padding: "8px 20px",
                  borderRadius: "var(--radius-panel-btn)",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExtensionInstallContinue}
                className="font-opensans transition-all duration-200 hover:brightness-110"
                style={{
                  backgroundColor: "var(--color-panel-btn-ok-bg)",
                  color: "#FFFFFF",
                  padding: "8px 20px",
                  borderRadius: "var(--radius-panel-btn)",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* ---- CARD 1: Google Voice (auto) ---- */}
        {isValidPhone && !showExtensionPrompt && (
          <button
            onClick={handleGvAuto}
            disabled={sendingViaExtension || (!isChrome && !extensionInstalled)}
            className="font-opensans text-left transition-all duration-200 hover:brightness-110 w-full"
            style={{
              backgroundColor: CARD_BLUE,
              borderRadius: CARD_RADIUS,
              padding: "14px 16px",
              border: "none",
              cursor: !isChrome ? "not-allowed" : "pointer",
              opacity: !isChrome ? 0.6 : 1,
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: "6px" }}>
              <span style={{ color: "#FFFFFF", fontSize: "18px", fontWeight: 600 }}>
                {sendingViaExtension ? "Opening Google Voice..." : "Google Voice (auto)"}
              </span>
              <span
                style={{
                  backgroundColor: gvAutoBadge.bg,
                  color: gvAutoBadge.color,
                  fontSize: "10px",
                  fontWeight: 400,
                  padding: "3px 8px",
                  borderRadius: "10px",
                  letterSpacing: "0.03em",
                }}
              >
                {gvAutoBadge.text}
              </span>
            </div>
            <p style={{ color: "#FFFFFF", fontSize: "12px", margin: 0, lineHeight: "1.4" }}>
              Requires a Google Voice Account and a Chrome Extension. Phone number and message
              filled-in and message sent automatically.
            </p>
          </button>
        )}

        {/* ---- CARD 2: Google Voice (manual) ---- */}
        {isValidPhone && !showExtensionPrompt && (
          <button
            onClick={handleGvManual}
            className="font-opensans text-left transition-all duration-200 hover:brightness-110 w-full"
            style={{
              backgroundColor: CARD_GREEN,
              borderRadius: CARD_RADIUS,
              padding: "14px 16px",
              border: "none",
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: "6px" }}>
              <span style={{ color: "#FFFFFF", fontSize: "18px", fontWeight: 600 }}>
                Google Voice (manual)
              </span>
              <span
                style={{
                  backgroundColor: "#FFFFFF",
                  color: CARD_BLUE,
                  fontSize: "10px",
                  fontWeight: 400,
                  padding: "3px 8px",
                  borderRadius: "10px",
                  letterSpacing: "0.03em",
                }}
              >
                COPY MESSAGE
              </span>
            </div>
            <p style={{ color: "#FFFFFF", fontSize: "12px", margin: 0, lineHeight: "1.4" }}>
              Requires a Google Voice Account. No Chrome extension required but phone number
              has to be entered manually. Copy message and paste into the message field.
            </p>
          </button>
        )}

        {/* ---- CARD 3: Messaging App (auto) ---- */}
        {isValidPhone && !showExtensionPrompt && (
          <button
            onClick={handleMessagingApp}
            className="font-opensans text-left transition-all duration-200 hover:brightness-110 w-full"
            style={{
              backgroundColor: CARD_GREEN,
              borderRadius: CARD_RADIUS,
              padding: "14px 16px",
              border: "none",
            }}
          >
            <span style={{ color: "#FFFFFF", fontSize: "18px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
              Messaging App (auto)
            </span>
            <p style={{ color: "#FFFFFF", fontSize: "12px", margin: 0, lineHeight: "1.4" }}>
              Sent from your device's default texting application. If using your personal computer, it
              will more than likely be sent from your personal number. Info auto-filled.
            </p>
          </button>
        )}

        {/* ---- CARD 4: Text From Phone (auto) ---- */}
        {isValidPhone && !showExtensionPrompt && (
          <div>
            <button
              onClick={handleTextFromPhone}
              className="font-opensans text-left transition-all duration-200 hover:brightness-110 w-full"
              style={{
                backgroundColor: CARD_GREEN,
                borderRadius: showQrCode ? `${CARD_RADIUS} ${CARD_RADIUS} 0 0` : CARD_RADIUS,
                padding: "14px 16px",
                border: "none",
              }}
            >
              <span style={{ color: "#FFFFFF", fontSize: "18px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Text From Phone (auto)
              </span>
              <p style={{ color: "#FFFFFF", fontSize: "12px", margin: 0, lineHeight: "1.4" }}>
                If you are accessing CRG on your computer but want to text from your phone, use the
                following QR code to transfer the message to your phone. Info auto-filled.
              </p>
            </button>

            {/* QR code - revealed when card is clicked */}
            {showQrCode && (
              <div
                className="flex flex-col items-center gap-2"
                style={{
                  backgroundColor: "#FFFFFF",
                  padding: "16px",
                  borderRadius: `0 0 ${CARD_RADIUS} ${CARD_RADIUS}`,
                }}
              >
                <QRCodeSVG value={smsHref} size={160} level="M" />
                <p
                  className="font-opensans text-center"
                  style={{ color: "#222831", fontSize: "12px", margin: 0, lineHeight: "1.4" }}
                >
                  Scan with your phone's camera to text from there.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Feedback message */}
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
