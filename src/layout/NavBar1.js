// src/layout/NavBar1.js
// Top navigation bar with logo, title, counters, and action buttons
// Frame 494 from Figma design
// Responsive: Simplified action row on mobile (hamburger → Contact Support + Legal), full layout on desktop

import { useState, useRef, useEffect } from "react";
import { useAppData } from "../Contexts/AppDataContext";
import Tooltip from "../components/Tooltip";
import EmailPanel from "../components/EmailPanel";
import SmsPanel from "../components/SmsPanel";
import SmsWarningModal from "../components/SmsWarningModal";
import MobileMenu from "../components/MobileMenu";
import { SendEmailIcon, CreatePdfIcon, SendTextIcon } from "../icons";
import { GUEST_EMAIL_OPEN, GUEST_PDF_OPEN, GUEST_TEXT_OPEN } from "../config/guestAccess";

// sessionStorage key to track whether the SMS warning has been acknowledged this session
const SMS_WARNING_ACK_KEY = "crg_sms_warning_acknowledged";

// One button inside the gold action-group pill (Email / PDF / Text).
// Renders icon + label and an optional count chip. When `isActive` is false
// the icon and label render in the muted gray and the button is truly disabled
// (no click, no hover). When `isActive` is true the icon and label flip to
// white and a hover brighten + active press is applied. The chip is rendered
// only when `chipShown` is true; the parent decides when to flip that.
// Inner radius = group radius (10) − group border (2) = 8px.
// Used to round the first/last buttons' outer corners so the gold hover fill
// follows the group's curve instead of bleeding into the square inner corner.
const OUTER_BTN_RADIUS = "8px";
const POSITION_RADIUS = {
  first: `${OUTER_BTN_RADIUS} 0 0 ${OUTER_BTN_RADIUS}`,
  middle: "0",
  last: `0 ${OUTER_BTN_RADIUS} ${OUTER_BTN_RADIUS} 0`,
};

function ActionButton({
  icon: Icon,
  label,
  chipShown,
  chipValue,
  chipVariant, // 'gold' for Email/PDF, 'teal' for Text
  isActive,
  onClick,
  guestDisabled,
  buttonRef,
  position = "middle", // 'first' | 'middle' | 'last' — for outer corner rounding
  isPanelOpen = false, // sticky-gold while the button's dropdown panel is open
}) {
  const interactive = isActive && !guestDisabled;

  const chipStyle = chipVariant === "teal"
    ? {
        backgroundColor: "transparent",
        color: "var(--color-navbar1-action-chip-text-color)",
        border: `var(--width-navbar1-action-chip-border) solid var(--color-navbar1-action-chip-text-color)`,
      }
    : {
        backgroundColor: "var(--color-navbar1-action-chip-emailpdf-bg)",
        color: "var(--color-navbar1-action-chip-emailpdf-text)",
        border: "none",
      };

  // Color states (icon inherits via currentColor):
  //   default active → white   (--color-navbar1-action-icon-active)
  //   hover          → gold    (--color-navbar1-action-hover-fg)
  //   panel open     → gold, sticky (driven by isPanelOpen; survives mouseout)
  //   press          → gold + scale-96 (Tailwind active: only while held)
  //   disabled       → gray    (--color-navbar1-action-icon-inactive)
  // While the panel is open the button is "locked" gold by swapping the base
  // text-color class — Tailwind's hover: would otherwise revert to white the
  // moment the user moves the cursor away from the trigger.
  const interactiveClasses = isPanelOpen
    ? "cursor-pointer text-[var(--color-navbar1-action-hover-fg)] active:scale-[0.96]"
    : "cursor-pointer text-[var(--color-navbar1-action-icon-active)] hover:text-[var(--color-navbar1-action-hover-fg)] active:text-[var(--color-navbar1-action-hover-fg)] active:scale-[0.96]";

  return (
    <button
      ref={buttonRef}
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      aria-disabled={!interactive}
      className={`font-opensans flex items-center bg-transparent transition-all duration-150 ${
        interactive
          ? interactiveClasses
          : "cursor-not-allowed text-[var(--color-navbar1-action-icon-inactive)]"
      }`}
      style={{
        border: "none",
        height: "100%",
        padding: `0 var(--padding-navbar1-action-x)`,
        gap: "var(--gap-navbar1-action-internal)",
        borderRadius: POSITION_RADIUS[position],
        fontSize: "var(--font-size-navbar1-action-label)",
        fontWeight: "var(--font-weight-navbar1-action-label)",
        letterSpacing: "var(--letter-spacing-navbar1-action-label)",
      }}
    >
      {/* Icon size 18 mirrors --size-navbar1-action-icon (the icon takes a
          numeric prop, so the token value lives here as a literal). The
          icon inherits text color via the default `color="currentColor"`
          so the hover color shift on the button propagates into the SVG. */}
      <Icon size={18} />
      <span>{label}</span>
      {chipShown && (
        <span
          className="inline-flex items-center justify-center font-opensans"
          style={{
            height: "var(--height-navbar1-action-chip)",
            minWidth: "var(--min-width-navbar1-action-chip)",
            padding: `0 var(--padding-navbar1-action-chip-x)`,
            borderRadius: "var(--radius-navbar1-action-chip)",
            fontSize: "var(--font-size-navbar1-action-chip)",
            fontWeight: "var(--font-weight-navbar1-action-chip)",
            lineHeight: 1,
            ...chipStyle,
          }}
        >
          {chipValue}
        </span>
      )}
    </button>
  );
}

export default function NavBar1({
  filteredCount = 0,
  selectedCount = 0,
  isAnyFilterActive = false,
  canSendText = false,
  onSendEmail,
  onCreatePdf,
  onSendSms,
  // Props for email/PDF panels
  selectedData = [],
  loggedInUser,
  headerText = "Resources",
  onEmailSuccess,
  onPdfSuccess,
  smsBody = "",
  onSmsInitiated,
  onMessagesHandoff,
  onGvAutoSent,
  onOpenHelp,
}) {
  // Logout handler comes from the top-level App via AppDataContext —
  // forwarded into the mobile hamburger so users can sign out from the
  // mobile layout (the desktop logout lives in VerticalNavBar, which is
  // hidden on mobile).
  const { onLogout, senderPickerOpen } = useAppData();
  // Orange counter always reflects the current filtered count. With the
  // show-all-by-default UX, this is the full directory count when nothing
  // is selected and the narrowed count once filters are applied. (Pre-2026
  // there was a `filteredCount > 0 ? filteredCount : totalCount` fallback
  // because "no filter" meant filteredCount=0; that's no longer the case.)
  const displayFilteredCount = filteredCount;

  // Action-button states. Email + PDF share a single signal: the chip shows
  // and the label activates together based on selectedCount. Send Text splits
  // them by design — the chip is allowed to appear as soon as ANY filter is
  // engaged (early feedback so the user can see the dataset shrinking) but
  // the label/icon only activate (and the button only becomes clickable)
  // once the per-mode SMS rule is met. Counts of 0 hide their chip entirely.
  const emailPdfActive = selectedCount > 0;
  const textChipShown = isAnyFilterActive && filteredCount > 0;
  const textLabelActive = canSendText && filteredCount > 0;

  // Panel state
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [showPdfPanel, setShowPdfPanel] = useState(false);
  const [showSmsPanel, setShowSmsPanel] = useState(false);
  const [showSmsWarning, setShowSmsWarning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Refs for panels and buttons
  const emailPanelRef = useRef(null);
  const pdfPanelRef = useRef(null);
  const smsPanelRef = useRef(null);
  const emailButtonRef = useRef(null);
  const pdfButtonRef = useRef(null);
  const smsButtonRef = useRef(null);

  // Check if any selected records are inactive or closed
  const hasInactiveResources = selectedData.some((item) => {
    const status = item.status?.toUpperCase();
    return status === "INACTIVE" || status === "INACTIVO" || status === "CLOSED";
  });

  // Track when panels were opened to prevent immediate close on mobile
  const emailOpenTimeRef = useRef(0);
  const pdfOpenTimeRef = useRef(0);
  const smsOpenTimeRef = useRef(0);

  // Handle click outside to close panels
  useEffect(() => {
    const handleClickOutside = (event) => {
      const now = Date.now();

      // Keep the panel open while the sender-org picker is up: the user opened
      // it via the "(change)" link inside this panel, so their clicks in the
      // picker modal (rows, OK/Cancel) are "outside" the panel but must NOT
      // close it — otherwise changing the child org drops them back to /find
      // instead of the Email/PDF/Text panel they started from.
      if (senderPickerOpen) return;

      // Email panel - ignore clicks within 300ms of opening (prevents mobile touch issues)
      if (
        showEmailPanel &&
        now - emailOpenTimeRef.current > 300 &&
        emailPanelRef.current &&
        !emailPanelRef.current.contains(event.target) &&
        emailButtonRef.current &&
        !emailButtonRef.current.contains(event.target)
      ) {
        setShowEmailPanel(false);
        setStatusMessage("");
      }
      // PDF panel - ignore clicks within 300ms of opening (prevents mobile touch issues)
      if (
        showPdfPanel &&
        now - pdfOpenTimeRef.current > 300 &&
        pdfPanelRef.current &&
        !pdfPanelRef.current.contains(event.target) &&
        pdfButtonRef.current &&
        !pdfButtonRef.current.contains(event.target)
      ) {
        setShowPdfPanel(false);
        setStatusMessage("");
      }
      // SMS panel - ignore clicks within 300ms of opening (prevents mobile touch issues)
      if (
        showSmsPanel &&
        now - smsOpenTimeRef.current > 300 &&
        smsPanelRef.current &&
        !smsPanelRef.current.contains(event.target) &&
        smsButtonRef.current &&
        !smsButtonRef.current.contains(event.target)
      ) {
        setShowSmsPanel(false);
        setStatusMessage("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showEmailPanel, showPdfPanel, showSmsPanel, senderPickerOpen]);

  // Check if user is a guest (browsing without account)
  const isGuest = loggedInUser?.isGuest === true;

  // Whether to block guest access to each action button. Flags live in
  // src/config/guestAccess.js (single source of truth; also gates the row
  // checkbox). Email/PDF must stay in sync with their server gates — see that
  // file. Each action is independent so any one can be reopened to guests.
  const guestEmailBlocked = isGuest && !GUEST_EMAIL_OPEN;
  const guestPdfBlocked = isGuest && !GUEST_PDF_OPEN;
  const guestTextBlocked = isGuest && !GUEST_TEXT_OPEN;

  // Handle Send Email button click
  const handleEmailButtonClick = () => {
    if (guestEmailBlocked) {
      alert("You need an account. Contact Support.");
      return;
    }
    if (onSendEmail) {
      // Check if selection validation passes (shows toast if no selection)
      const canProceed = onSendEmail();
      if (canProceed !== false) {
        emailOpenTimeRef.current = Date.now();
        setShowEmailPanel(true);
        setShowPdfPanel(false);
        setShowSmsPanel(false);
        setStatusMessage("");
      }
    }
  };

  // Handle Create PDF button click
  const handlePdfButtonClick = () => {
    if (guestPdfBlocked) {
      alert("You need an account. Contact Support.");
      return;
    }
    if (onCreatePdf) {
      // Check if selection validation passes (shows toast if no selection)
      const canProceed = onCreatePdf();
      if (canProceed !== false) {
        pdfOpenTimeRef.current = Date.now();
        setShowPdfPanel(true);
        setShowEmailPanel(false);
        setShowSmsPanel(false);
        setStatusMessage("");
      }
    }
  };

  // Open the SmsPanel (runs after warning is acknowledged or skipped)
  const openSmsPanel = () => {
    smsOpenTimeRef.current = Date.now();
    setShowSmsPanel(true);
    setShowEmailPanel(false);
    setShowPdfPanel(false);
    setStatusMessage("");
  };

  // Handle Send Text button click
  const handleSmsButtonClick = () => {
    if (guestTextBlocked) {
      alert("You need an account. Contact Support.");
      return;
    }
    if (onSendSms) {
      const canProceed = onSendSms();
      if (canProceed === false) return;
    }

    // Show warning modal once per session before opening the SmsPanel
    const acknowledged = sessionStorage.getItem(SMS_WARNING_ACK_KEY) === "true";
    if (!acknowledged) {
      setShowSmsWarning(true);
      return;
    }

    openSmsPanel();
  };

  const handleSmsWarningProceed = () => {
    sessionStorage.setItem(SMS_WARNING_ACK_KEY, "true");
    setShowSmsWarning(false);
    openSmsPanel();
  };

  const handleSmsWarningCancel = () => {
    setShowSmsWarning(false);
  };

  // Handle email send (language and optional note passed from EmailPanel)
  const handleEmailSend = async (recipient, language, note = "") => {
    if (!recipient) {
      setStatusMessage("Please enter a recipient email");
      return;
    }

    setIsSending(true);
    setStatusMessage("");

    try {
      // Call the email success handler which triggers the actual send
      if (onEmailSuccess) {
        await onEmailSuccess(recipient, language, note);
      }
      setShowEmailPanel(false);
    } catch (err) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle PDF create (language and optional note passed from EmailPanel)
  const handlePdfCreate = async (recipient, language, note = "") => {
    setIsSending(true);
    setStatusMessage("");

    try {
      if (onPdfSuccess) {
        await onPdfSuccess(language, note);
      }
      setShowPdfPanel(false);
    } catch (err) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle panel cancel
  const handleEmailCancel = () => {
    setShowEmailPanel(false);
    setStatusMessage("");
  };

  const handlePdfCancel = () => {
    setShowPdfPanel(false);
    setStatusMessage("");
  };

  // Handle SMS cancel
  const handleSmsCancel = () => {
    setShowSmsPanel(false);
  };
  return (
    <nav
      className="bg-navbar1-bg"
      style={{
        paddingLeft: 'var(--padding-navbar1-left)',
        paddingRight: 'var(--padding-navbar1-right)',
      }}
    >
      {/* ========== DESKTOP LAYOUT (md+) ========== */}
      <div
        className="hidden lg:flex items-center justify-between"
        style={{ height: 'var(--height-navbar1)' }}
      >
        {/* Left side - Logo and Title */}
        <div
          className="flex items-center"
          style={{ gap: 'var(--gap-navbar1-logo-title)' }}
        >
          <img
            src="/images/CRG Logo 2025.webp"
            alt="CRG Logo"
            style={{
              width: 'var(--size-navbar1-logo)',
              height: 'var(--size-navbar1-logo)',
            }}
            className="object-contain"
          />
          <h1
            className="text-navbar1-title font-comfortaa"
            style={{
              fontSize: 'var(--font-size-navbar1-title)',
              fontWeight: 'var(--font-weight-navbar1-title)',
              letterSpacing: 'var(--letter-spacing-navbar1-title)',
            }}
          >
            Community Resources Guide Houston
          </h1>
        </div>

        {/* Right side — three action buttons grouped inside one gold pill.
            The pre-2026 orange/blue counters are gone; their counts are now
            surfaced as conditional chips on the relevant buttons (selected →
            Email/PDF, filtered → Text). Each button's relative wrapper still
            anchors its dropdown panel below. */}
        <div
          role="group"
          aria-label="Send Email, Create PDF, Send Text"
          className="flex items-stretch"
          style={{
            height: 'var(--height-navbar1-action-group)',
            border: 'var(--width-navbar1-action-border) solid var(--color-navbar1-action-border)',
            borderRadius: 'var(--radius-navbar1-action-group)',
            backgroundColor: 'var(--color-navbar1-action-bg)',
          }}
        >
          {/* Send Email */}
          <div className="relative flex">
            <Tooltip text={guestEmailBlocked ? "You need an account. Contact Support." : ""} position="bottom">
              <ActionButton
                icon={SendEmailIcon}
                label="Send Email"
                chipShown={selectedCount > 0}
                chipValue={selectedCount}
                chipVariant="gold"
                isActive={emailPdfActive}
                onClick={handleEmailButtonClick}
                guestDisabled={guestEmailBlocked}
                buttonRef={emailButtonRef}
                position="first"
                isPanelOpen={showEmailPanel}
              />
            </Tooltip>
            <EmailPanel
              isOpen={showEmailPanel}
              onCancel={handleEmailCancel}
              onSend={handleEmailSend}
              panelRef={emailPanelRef}
              isPdfMode={false}
              hasInactiveResources={hasInactiveResources}
              isSending={isSending}
              statusMessage={statusMessage}
              selectedData={selectedData}
              headerText={headerText}
            />
          </div>

          {/* Create PDF */}
          <div className="relative flex">
            <Tooltip text={guestPdfBlocked ? "You need an account. Contact Support." : ""} position="bottom">
              <ActionButton
                icon={CreatePdfIcon}
                label="Create PDF"
                chipShown={selectedCount > 0}
                chipValue={selectedCount}
                chipVariant="gold"
                isActive={emailPdfActive}
                onClick={handlePdfButtonClick}
                guestDisabled={guestPdfBlocked}
                buttonRef={pdfButtonRef}
                position="middle"
                isPanelOpen={showPdfPanel}
              />
            </Tooltip>
            <EmailPanel
              isOpen={showPdfPanel}
              onCancel={handlePdfCancel}
              onSend={handlePdfCreate}
              panelRef={pdfPanelRef}
              isPdfMode={true}
              hasInactiveResources={hasInactiveResources}
              isSending={isSending}
              statusMessage={statusMessage}
            />
          </div>

          {/* Send Text */}
          <div className="relative flex">
            <Tooltip text={guestTextBlocked ? "You need an account. Contact Support." : ""} position="bottom">
              <ActionButton
                icon={SendTextIcon}
                label="Send Text"
                chipShown={textChipShown}
                chipValue={displayFilteredCount}
                chipVariant="teal"
                isActive={textLabelActive}
                onClick={handleSmsButtonClick}
                guestDisabled={guestTextBlocked}
                buttonRef={smsButtonRef}
                position="last"
                isPanelOpen={showSmsPanel}
              />
            </Tooltip>
            <SmsPanel
              isOpen={showSmsPanel}
              onCancel={handleSmsCancel}
              panelRef={smsPanelRef}
              composedBody={smsBody}
              onInitiated={onSmsInitiated}
              onMessagesHandoff={onMessagesHandoff}
              onGvAutoSent={onGvAutoSent}
            />
          </div>
        </div>
      </div>

      {/* ========== MOBILE LAYOUT (<md) ========== */}
      <div className="lg:hidden flex items-center justify-between py-2 px-2">
        {/* Left side - Logo only (no title on mobile) */}
        <img
          src="/images/CRG Logo 2025.webp"
          alt="CRG Logo"
          className="w-8 h-8 object-contain"
        />

        {/* Right side - Send buttons + Hamburger. The old orange/blue counter
            circles are gone on mobile; the send count now rides on each button
            like desktop (selected rows → Email; filtered list → Text). */}
        <div className="flex items-center gap-3">
          {/* Send buttons - sized for touch (40px min height). PDF is desktop-only. */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                ref={emailButtonRef}
                onClick={handleEmailButtonClick}
                className={`inline-flex items-center rounded font-opensans text-sm px-4 py-2 transition-all ${
                  guestEmailBlocked
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-navbar1-btn-email-bg text-navbar1-btn-email-text hover:brightness-125"
                }`}
                style={{ opacity: guestEmailBlocked ? 0.6 : 1, minHeight: '40px' }}
              >
                Email
                {selectedCount > 0 && (
                  <span
                    className="ml-1.5 inline-flex items-center justify-center rounded-full font-semibold"
                    style={{ minWidth: '18px', height: '18px', padding: '0 5px', fontSize: '11px', backgroundColor: '#FFFFFF', color: '#222831' }}
                  >
                    {selectedCount}
                  </span>
                )}
              </button>
              <EmailPanel
                isOpen={showEmailPanel}
                onCancel={handleEmailCancel}
                onSend={handleEmailSend}
                panelRef={emailPanelRef}
                isPdfMode={false}
                hasInactiveResources={hasInactiveResources}
                isSending={isSending}
                statusMessage={statusMessage}
                selectedData={selectedData}
                headerText={headerText}
              />
            </div>
            <div className="relative">
              <button
                ref={smsButtonRef}
                onClick={handleSmsButtonClick}
                className={`inline-flex items-center rounded font-opensans text-sm px-4 py-2 transition-all ${
                  guestTextBlocked
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-navbar1-btn-sms-bg text-navbar1-btn-sms-text hover:brightness-125"
                }`}
                style={{ opacity: guestTextBlocked ? 0.6 : 1, minHeight: '40px' }}
              >
                Text
                {textChipShown && (
                  <span
                    className="ml-1.5 inline-flex items-center justify-center rounded-full font-semibold"
                    style={{ minWidth: '18px', height: '18px', padding: '0 5px', fontSize: '11px', backgroundColor: '#FFFFFF', color: '#222831' }}
                  >
                    {displayFilteredCount}
                  </span>
                )}
              </button>
              <SmsPanel
                isOpen={showSmsPanel}
                onCancel={handleSmsCancel}
                panelRef={smsPanelRef}
                composedBody={smsBody}
                onInitiated={onSmsInitiated}
                onMessagesHandoff={onMessagesHandoff}
                onGvAutoSent={onGvAutoSent}
              />
            </div>
          </div>

          {/* Hamburger menu — Home / Contact Support / Privacy Policy / Logout */}
          <MobileMenu onLogout={onLogout} onOpenHelp={onOpenHelp} />
        </div>
      </div>

      {/* SMS warning modal — shown once per session before SmsPanel opens */}
      <SmsWarningModal
        isOpen={showSmsWarning}
        onProceed={handleSmsWarningProceed}
        onCancel={handleSmsWarningCancel}
      />
    </nav>
  );
}
