// src/components/SmsPanel.js
// Panel for composing a text with a deep link to filtered resources.
// CRG does not send the text — clicking "Open in Messages App" hands off to the
// user's native SMS app via an sms: URI. Copy icons on each field let the user
// route through Google Voice, TextNow, etc. via paste. On desktop, a QR code
// encoding the same sms: URI lets the user scan with their phone's camera to
// text from there.

import { useState, useEffect } from "react";
import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import DropPanel from "./DropPanel";

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

  useEffect(() => {
    if (isOpen) {
      setPhoneNumber("");
      setFeedback("");
    }
  }, [isOpen]);

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
    setTimeout(() => setFeedback((current) => (current === msg ? "" : current)), 2000);
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

  const handleOpenMessages = () => {
    if (!isValidPhone) return;
    fireInitiated();
    if (typeof onMessagesHandoff === "function") {
      try { onMessagesHandoff(); } catch { /* toast is best-effort */ }
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
          Enter the client's phone number, then click <strong>Open in Messages App</strong>.
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

        {/* Desktop-only QR code — scan with phone camera to text from there.
            Hidden on mobile where the user is already on the phone. */}
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
              style={{ color: "#222831", fontSize: "12px", margin: 0, lineHeight: "1.4" }}
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
