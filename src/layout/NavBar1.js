// src/layout/NavBar1.js
// Top navigation bar with logo, title, counters, and action buttons
// Frame 494 from Figma design
// Responsive: Simplified action row on mobile (no hamburger), full layout on desktop

import { useState, useRef, useEffect } from "react";
import { Mail } from "lucide-react";
import Tooltip from "../components/Tooltip";
import EmailPanel from "../components/EmailPanel";
import SmsPanel from "../components/SmsPanel";
import AnimatedCounter from "../components/AnimatedCounter";

export default function NavBar1({
  totalCount = 0,
  filteredCount = 0,
  selectedCount = 0,
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
}) {
  // Orange counter shows totalCount initially (before any filter applied),
  // then shows filteredCount once user starts filtering
  const displayFilteredCount = filteredCount > 0 ? filteredCount : totalCount;
  // Panel state
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [showPdfPanel, setShowPdfPanel] = useState(false);
  const [showSmsPanel, setShowSmsPanel] = useState(false);
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
  }, [showEmailPanel, showPdfPanel, showSmsPanel]);

  // Check if user is a guest (browsing without account)
  const isGuest = loggedInUser?.isGuest === true;

  // Handle Send Email button click
  const handleEmailButtonClick = () => {
    if (isGuest) {
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
    if (isGuest) {
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

  // Handle Send Text button click
  const handleSmsButtonClick = () => {
    if (isGuest) {
      alert("You need an account. Contact Support.");
      return;
    }
    if (onSendSms) {
      const canProceed = onSendSms();
      if (canProceed === false) return;
    }
    smsOpenTimeRef.current = Date.now();
    setShowSmsPanel(true);
    setShowEmailPanel(false);
    setShowPdfPanel(false);
    setStatusMessage("");
  };

  // Handle email send (language passed from EmailPanel)
  const handleEmailSend = async (recipient, language) => {
    if (!recipient) {
      setStatusMessage("Please enter a recipient email");
      return;
    }

    setIsSending(true);
    setStatusMessage("");

    try {
      // Call the email success handler which triggers the actual send
      if (onEmailSuccess) {
        await onEmailSuccess(recipient, language);
      }
      setShowEmailPanel(false);
    } catch (err) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle PDF create (language passed from EmailPanel)
  const handlePdfCreate = async (recipient, language) => {
    setIsSending(true);
    setStatusMessage("");

    try {
      if (onPdfSuccess) {
        await onPdfSuccess(language);
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

        {/* Right side - Counters and Buttons */}
        <div
          className="flex items-center"
          style={{ gap: 'var(--gap-navbar1-counters-buttons)' }}
        >
          {/* Counters */}
          <div
            className="flex items-center"
            style={{ gap: 'var(--gap-navbar1-counters)' }}
          >
            {/* Filtered count */}
            <Tooltip text="Filtered records" position="bottom-left">
              <AnimatedCounter
                value={displayFilteredCount}
                duration={1000}
                glowColor="rgba(229, 186, 102, 0.85)"
                className="bg-navbar1-counter-filtered text-navbar1-counter-text-filtered rounded-full flex items-center justify-center font-opensans"
                style={{
                  width: 'var(--size-navbar1-counter)',
                  height: 'var(--size-navbar1-counter)',
                  fontSize: 'var(--font-size-navbar1-counter)',
                  fontWeight: 'var(--font-weight-navbar1-counter)',
                }}
              />
            </Tooltip>

            {/* Selected count */}
            <Tooltip text="Selected records" position="bottom-left">
              <AnimatedCounter
                value={selectedCount}
                duration={600}
                glowColor="rgba(229, 186, 102, 0.85)"
                className="bg-navbar1-counter-selected text-navbar1-counter-text-selected rounded-full flex items-center justify-center font-opensans"
                style={{
                  width: 'var(--size-navbar1-counter)',
                  height: 'var(--size-navbar1-counter)',
                  fontSize: 'var(--font-size-navbar1-counter)',
                  fontWeight: 'var(--font-weight-navbar1-counter)',
                }}
              />
            </Tooltip>
          </div>

          {/* Buttons */}
          <div
            className="flex items-center"
            style={{ gap: 'var(--gap-navbar1-buttons)' }}
          >
            {/* Send Email button with dropdown panel */}
            <div className="relative">
              <Tooltip text={isGuest ? "You need an account. Contact Support." : ""} position="bottom">
                <button
                  ref={emailButtonRef}
                  onClick={handleEmailButtonClick}
                  className={`rounded font-opensans transition-all ${
                    isGuest
                      ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                      : "bg-navbar1-btn-email-bg text-navbar1-btn-email-text hover:brightness-125"
                  }`}
                  style={{
                    width: 'var(--width-navbar1-btn)',
                    height: 'var(--height-navbar1-btn)',
                    fontSize: 'var(--font-size-navbar1-btn)',
                    fontWeight: 'var(--font-weight-navbar1-btn)',
                    letterSpacing: 'var(--letter-spacing-navbar1-btn)',
                    opacity: isGuest ? 0.6 : 1,
                  }}
                >
                  Send Email
                </button>
              </Tooltip>

              {/* Email Panel */}
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

            {/* Create PDF button with dropdown panel */}
            <div className="relative">
              <Tooltip text={isGuest ? "You need an account. Contact Support." : ""} position="bottom">
                <button
                  ref={pdfButtonRef}
                  onClick={handlePdfButtonClick}
                  className={`rounded font-opensans transition-all ${
                    isGuest
                      ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                      : "bg-navbar1-btn-pdf-bg text-navbar1-btn-pdf-text hover:brightness-125"
                  }`}
                  style={{
                    width: 'var(--width-navbar1-btn)',
                    height: 'var(--height-navbar1-btn)',
                    fontSize: 'var(--font-size-navbar1-btn)',
                    fontWeight: 'var(--font-weight-navbar1-btn)',
                    letterSpacing: 'var(--letter-spacing-navbar1-btn)',
                    opacity: isGuest ? 0.6 : 1,
                  }}
                >
                  Create Pdf
                </button>
              </Tooltip>

              {/* PDF Panel */}
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

            {/* Send Text button with dropdown panel */}
            <div className="relative">
              <Tooltip text={isGuest ? "You need an account. Contact Support." : ""} position="bottom">
                <button
                  ref={smsButtonRef}
                  onClick={handleSmsButtonClick}
                  className={`rounded font-opensans transition-all ${
                    isGuest
                      ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                      : "bg-navbar1-btn-sms-bg text-navbar1-btn-sms-text hover:brightness-125"
                  }`}
                  style={{
                    width: 'var(--width-navbar1-btn)',
                    height: 'var(--height-navbar1-btn)',
                    fontSize: 'var(--font-size-navbar1-btn)',
                    fontWeight: 'var(--font-weight-navbar1-btn)',
                    letterSpacing: 'var(--letter-spacing-navbar1-btn)',
                    opacity: isGuest ? 0.6 : 1,
                  }}
                >
                  Send Text
                </button>
              </Tooltip>

              <SmsPanel
                isOpen={showSmsPanel}
                onCancel={handleSmsCancel}
                panelRef={smsPanelRef}
                composedBody={smsBody}
                onInitiated={onSmsInitiated}
                onMessagesHandoff={onMessagesHandoff}
              />
            </div>
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

        {/* Right side - Counters, Buttons, Hamburger */}
        <div className="flex items-center gap-3">
          {/* Counters */}
          <div className="flex items-center gap-1">
            <AnimatedCounter
              value={displayFilteredCount}
              duration={1000}
              glowColor="rgba(229, 186, 102, 0.85)"
              className="bg-navbar1-counter-filtered text-navbar1-counter-text-filtered rounded-full flex items-center justify-center font-opensans text-xs font-medium"
              style={{ width: '28px', height: '28px' }}
            />
            <AnimatedCounter
              value={selectedCount}
              duration={600}
              glowColor="rgba(229, 186, 102, 0.85)"
              className="bg-navbar1-counter-selected text-navbar1-counter-text-selected rounded-full flex items-center justify-center font-opensans text-xs font-medium"
              style={{ width: '28px', height: '28px' }}
            />
          </div>

          {/* Email/PDF buttons - sized for touch (40px min height) with good spacing */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                ref={emailButtonRef}
                onClick={handleEmailButtonClick}
                className={`rounded font-opensans text-sm px-4 py-2 transition-all ${
                  isGuest
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-navbar1-btn-email-bg text-navbar1-btn-email-text hover:brightness-125"
                }`}
                style={{ opacity: isGuest ? 0.6 : 1, minHeight: '40px' }}
              >
                Email
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
                ref={pdfButtonRef}
                onClick={handlePdfButtonClick}
                className={`rounded font-opensans text-sm px-4 py-2 transition-all ${
                  isGuest
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-navbar1-btn-pdf-bg text-navbar1-btn-pdf-text hover:brightness-125"
                }`}
                style={{ opacity: isGuest ? 0.6 : 1, minHeight: '40px' }}
              >
                PDF
              </button>
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
            <div className="relative">
              <button
                ref={smsButtonRef}
                onClick={handleSmsButtonClick}
                className={`rounded font-opensans text-sm px-4 py-2 transition-all ${
                  isGuest
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-navbar1-btn-sms-bg text-navbar1-btn-sms-text hover:brightness-125"
                }`}
                style={{ opacity: isGuest ? 0.6 : 1, minHeight: '40px' }}
              >
                Text
              </button>
              <SmsPanel
                isOpen={showSmsPanel}
                onCancel={handleSmsCancel}
                panelRef={smsPanelRef}
                composedBody={smsBody}
                onInitiated={onSmsInitiated}
                onMessagesHandoff={onMessagesHandoff}
              />
            </div>
          </div>

          {/* Contact Support — opens user's mail app */}
          <a
            href="mailto:developer@operacha.org"
            className="p-2 hover:brightness-125 transition-all"
            style={{ color: "var(--color-footer-bg)" }}
            aria-label="Contact Support"
          >
            <Mail size={26} />
          </a>
        </div>
      </div>
    </nav>
  );
}
