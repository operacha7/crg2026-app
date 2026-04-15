// src/components/SmsPanel.js
// Panel for composing a text with a deep link to filtered resources.
// CRG does not send the text — we open the sender's own SMS tool
// (native Messages via sms: URI, Google Voice, or any tool via clipboard).

import { useState, useEffect } from "react";
import DropPanel from "./DropPanel";

/**
 * SmsPanel - Panel for composing an SMS handoff
 *
 * @param {boolean} isOpen
 * @param {function} onCancel
 * @param {React.Ref} panelRef
 * @param {string} composedBody - Pre-rendered message body (org + header + share URL)
 */
export default function SmsPanel({
  isOpen,
  onCancel,
  panelRef,
  composedBody = "",
  onInitiated,
}) {
  const fireInitiated = () => {
    if (typeof onInitiated === "function") {
      try { onInitiated(); } catch { /* logging is best-effort */ }
    }
  };
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

  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    let formatted = "";
    if (raw.length > 0) formatted = "(" + raw.slice(0, 3);
    if (raw.length >= 3) formatted += ") " + raw.slice(3, 6);
    if (raw.length >= 6) formatted += "-" + raw.slice(6, 10);
    setPhoneNumber(formatted);
  };

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback((current) => (current === msg ? "" : current)), 2500);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleOpenMessages = () => {
    if (!isValidPhone) return;
    fireInitiated();
    const smsHref = `sms:+1${digits}?body=${encodeURIComponent(composedBody)}`;
    window.location.href = smsHref;
  };

  const handleOpenGoogleVoice = async () => {
    if (!isValidPhone) return;
    fireInitiated();
    const copied = await copyToClipboard(composedBody);
    const gvUrl = `https://voice.google.com/u/0/messages?itemId=t.%2B1${digits}`;
    window.open(gvUrl, "_blank", "noopener,noreferrer");
    showFeedback(copied ? "Message copied — paste into Google Voice" : "Opened Google Voice (copy message manually)");
  };

  const handleCopyMessage = async () => {
    fireInitiated();
    const copied = await copyToClipboard(composedBody);
    showFeedback(copied ? "Message copied to clipboard" : "Unable to copy — select and copy manually");
  };

  if (!isOpen) return null;

  const actionBtnStyle = {
    height: "var(--height-panel-btn)",
    borderRadius: "var(--radius-panel-btn)",
    fontSize: "var(--font-size-panel-btn)",
    letterSpacing: "var(--letter-spacing-panel-btn)",
    color: "var(--color-panel-btn-text)",
    padding: "0 16px",
  };

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
    >
      <div className="flex flex-col gap-4">
        <p
          className="font-opensans"
          style={{ color: "#FFFFFF", fontSize: "14px", lineHeight: "1.5" }}
        >
          Enter the client's phone number, then choose how to send the text. The
          message is sent from your own phone, Google Voice, or any texting tool
          you prefer — CRG doesn't transmit it for you.
        </p>

        <div className="flex flex-col gap-2">
          <label
            className="font-opensans"
            style={{ color: "#FFFFFF", fontSize: "13px", fontWeight: 600 }}
          >
            Client phone number
          </label>
          <input
            type="tel"
            placeholder="(713) 555-1234"
            value={phoneNumber}
            onChange={handlePhoneChange}
            className="font-opensans w-full"
            style={{
              backgroundColor: "white",
              color: "black",
              padding: "12px 16px",
              borderRadius: "var(--radius-panel-btn)",
              fontSize: "16px",
              border: "none",
              outline: "none",
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="font-opensans"
            style={{ color: "#FFFFFF", fontSize: "13px", fontWeight: 600 }}
          >
            Message preview
          </label>
          <div
            className="font-opensans"
            style={{
              backgroundColor: "#FFFFFF",
              color: "#222831",
              padding: "10px 12px",
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
        </div>

        <div className="flex flex-wrap gap-2 justify-between">
          <button
            onClick={handleOpenMessages}
            disabled={!isValidPhone}
            className="font-opensans transition-all duration-200 hover:brightness-110 flex-1"
            style={{
              ...actionBtnStyle,
              backgroundColor: "var(--color-panel-btn-ok-bg)",
              opacity: isValidPhone ? 1 : 0.5,
              minWidth: "130px",
            }}
          >
            Open Messages
          </button>
          <button
            onClick={handleOpenGoogleVoice}
            disabled={!isValidPhone}
            className="font-opensans transition-all duration-200 hover:brightness-110 flex-1"
            style={{
              ...actionBtnStyle,
              backgroundColor: "#005C72",
              opacity: isValidPhone ? 1 : 0.5,
              minWidth: "150px",
            }}
          >
            Open in Google Voice
          </button>
          <button
            onClick={handleCopyMessage}
            className="font-opensans transition-all duration-200 hover:brightness-110 flex-1"
            style={{
              ...actionBtnStyle,
              backgroundColor: "#4A4F56",
              minWidth: "130px",
            }}
          >
            Copy Message
          </button>
        </div>

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
