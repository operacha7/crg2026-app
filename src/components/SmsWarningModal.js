// src/components/SmsWarningModal.js
// One-time-per-session warning shown before the SmsPanel opens.
// Explains that texts are sent from the user's phone number / messaging account,
// not from CRG, and preempts Chrome's standard extension permission warning.

/**
 * SmsWarningModal - Modal overlay warning users about how texting works
 *
 * @param {boolean} isOpen
 * @param {function} onProceed - Called when user clicks "I Understand & Proceed"
 * @param {function} onCancel - Called when user clicks Cancel
 */
export default function SmsWarningModal({ isOpen, onProceed, onCancel }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl overflow-hidden"
        style={{
          width: "min(600px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-center"
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
            Before You Send a Text . . .
          </h3>
        </div>

        {/* Body — scrollable if needed */}
        <div
          className="font-opensans"
          style={{
            padding: "24px",
            overflowY: "auto",
            color: "#222831",
            fontSize: "16px",
            lineHeight: "1.6",
          }}
        >
          <p style={{ margin: "0 0 14px 0", fontWeight: 600 }}>
            Texts come from you, not CRG.
          </p>

          <p style={{ margin: "0 0 14px 0" }}>
            CRG only hands off the message — the phone number and app are whichever
            you pick. On your own device, that's your personal number. On a shared
            computer, it's whatever app is set up there.
          </p>

          <p
            style={{
              margin: "0 0 14px 0",
              fontWeight: 600,
              color: "#4285F4",
            }}
          >
            CRG recommends Google Voice with the Chrome Extension.
          </p>

          <p
            style={{
              margin: 0,
              padding: "12px 14px",
              backgroundColor: "#FFF4D6",
              borderLeft: "4px solid #FFB302",
              borderRadius: "4px",
            }}
          >
            <strong>The key takeaway — </strong>
            Be aware which phone number your text is coming from.
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #E0E0E0",
            gap: "12px",
          }}
        >
          <button
            onClick={onCancel}
            className="font-opensans transition-all duration-200 hover:brightness-110"
            style={{
              backgroundColor: "var(--color-panel-btn-cancel-bg)",
              color: "#FFFFFF",
              padding: "10px 20px",
              borderRadius: "var(--radius-panel-btn)",
              fontSize: "14px",
              fontWeight: 600,
              minWidth: "100px",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            className="font-opensans transition-all duration-200 hover:brightness-110"
            style={{
              backgroundColor: "var(--color-panel-btn-ok-bg)",
              color: "#FFFFFF",
              padding: "10px 20px",
              borderRadius: "var(--radius-panel-btn)",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            I Understand &amp; Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
