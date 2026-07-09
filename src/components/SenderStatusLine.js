// src/components/SenderStatusLine.js
// The "Sending as / blocked" line shown at the top of the Email, PDF, and SMS
// panels. Single source for the three states so email/PDF/text stay consistent:
//   blocked        → "Sending as: <name>" + red note it won't appear on sent
//                     items + (change) when multi-child
//   has a name     → "Sending as: <name> · <phone>" + (change) when multi-child
//   needsSelection → "Select your location…" + (select) for unpicked multi-child
// Renders nothing for guests / dev users (senderStatus.applicable === false).
// See EMAIL_SENDER_FOOTER_PLAN.md.

import { useAppData } from "../Contexts/AppDataContext";

export default function SenderStatusLine() {
  const { senderStatus, setSenderPickerOpen } = useAppData();

  if (!senderStatus?.applicable) return null;

  const noteStyle = {
    color: "#4A4F56",
    fontSize: "13px",
    lineHeight: 1.45,
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: "var(--radius-panel-btn)",
    padding: "8px 12px",
    margin: 0,
  };
  const linkStyle = {
    background: "none",
    border: "none",
    padding: 0,
    marginLeft: "6px",
    color: "var(--color-panel-action-btn-text)",
    fontWeight: 600,
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: "13px",
  };

  const changeLink = senderStatus.canChange && (
    <button
      type="button"
      onClick={() => setSenderPickerOpen(true)}
      style={linkStyle}
      className="hover:brightness-110"
    >
      change
    </button>
  );

  // Blocked: still show the selection (so the user can see/change it) plus a red
  // note explaining it won't appear on sent items. Block only governs display.
  if (senderStatus.blocked) {
    return (
      <div className="font-opensans" style={noteStyle}>
        {senderStatus.name && (
          <div>
            Sending as: <strong>{senderStatus.name}</strong>
            {senderStatus.phone ? ` · ${senderStatus.phone}` : ""}
            {senderStatus.email ? ` · ${senderStatus.email}` : ""}
            {changeLink}
          </div>
        )}
        <div style={{ color: "#B8001F", marginTop: senderStatus.name ? "4px" : 0 }}>
          Your organization&rsquo;s name, phone and email won&rsquo;t appear on
          sent items (set by your organization).
        </div>
      </div>
    );
  }

  if (senderStatus.name) {
    return (
      <p className="font-opensans" style={noteStyle}>
        Sending as: <strong>{senderStatus.name}</strong>
        {senderStatus.phone ? ` · ${senderStatus.phone}` : ""}
        {senderStatus.email ? ` · ${senderStatus.email}` : ""}
        {changeLink}
      </p>
    );
  }

  if (senderStatus.needsSelection) {
    return (
      <p className="font-opensans" style={noteStyle}>
        Select your location to include your name on this.
        <button
          type="button"
          onClick={() => setSenderPickerOpen(true)}
          style={linkStyle}
          className="hover:brightness-110"
        >
          select
        </button>
      </p>
    );
  }

  return null;
}
