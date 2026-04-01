// src/components/SmsPanel.js
// Panel for sending SMS with a deep link to filtered resources
// Uses DropPanel for consistent styling
// Simpler than EmailPanel — just needs a phone number input

import { useState, useEffect } from "react";
import DropPanel from "./DropPanel";

/**
 * SmsPanel - Panel for SMS sending
 *
 * @param {boolean} isOpen - Whether panel is visible
 * @param {function} onCancel - Cancel handler (closes panel)
 * @param {function} onSend - Send handler (receives phone number)
 * @param {React.Ref} panelRef - Ref for click-outside detection
 * @param {boolean} isSending - Whether send is in progress
 * @param {string} statusMessage - Error or status message to display
 */
export default function SmsPanel({
  isOpen,
  onCancel,
  onSend,
  panelRef,
  isSending = false,
  statusMessage = "",
}) {
  const [phoneNumber, setPhoneNumber] = useState("");

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setPhoneNumber("");
    }
  }, [isOpen]);

  const handleCancel = () => {
    onCancel();
  };

  const handleSend = () => {
    onSend(phoneNumber);
  };

  // Format phone number as user types: (XXX) XXX-XXXX
  const handlePhoneChange = (e) => {
    // Strip to digits only
    const digits = e.target.value.replace(/\D/g, "");
    // Limit to 10 digits
    const limited = digits.slice(0, 10);

    // Format as (XXX) XXX-XXXX
    let formatted = "";
    if (limited.length > 0) {
      formatted = "(" + limited.slice(0, 3);
    }
    if (limited.length >= 3) {
      formatted += ") " + limited.slice(3, 6);
    }
    if (limited.length >= 6) {
      formatted += "-" + limited.slice(6, 10);
    }

    setPhoneNumber(formatted);
  };

  if (!isOpen) return null;

  return (
    <DropPanel
      title="Text Resources Link"
      isOpen={true}
      onCancel={handleCancel}
      onSave={handleSend}
      panelRef={panelRef}
      style={{
        top: "100%",
        right: "0",
        minWidth: "400px",
      }}
      okButtonText="Send"
      showHelpIcon={false}
      okDisabled={phoneNumber.replace(/\D/g, "").length !== 10}
    >
      <div className="flex flex-col gap-4">
        {/* Info text */}
        <p
          className="font-opensans"
          style={{
            color: "#FFFFFF",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          Enter a phone number to text a link to the currently filtered resources.
          The recipient will be able to view and browse the results.
        </p>

        {/* Phone number input */}
        <input
          type="tel"
          placeholder="(713) 555-1234"
          value={phoneNumber}
          onChange={handlePhoneChange}
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

        {/* Sending indicator */}
        {isSending && (
          <p
            className="font-opensans text-center"
            style={{
              color: "#FFFFFF",
              fontSize: "14px",
            }}
          >
            Sending...
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
