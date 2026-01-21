// src/layout/NavBar1.js
// Top navigation bar with logo, title, counters, and action buttons
// Frame 494 from Figma design
// Responsive: Shows hamburger menu on mobile, full layout on desktop

import { useState, useRef, useEffect } from "react";
import { Menu } from "lucide-react";
import Tooltip from "../components/Tooltip";
import EmailPanel from "../components/EmailPanel";

export default function NavBar1({
  filteredCount = 0,
  selectedCount = 0,
  onSendEmail,
  onCreatePdf,
  // Props for email/PDF panels
  selectedData = [],
  loggedInUser,
  selectedZip,
  onEmailSuccess,
  onPdfSuccess,
  // Mobile menu handler
  onOpenMobileMenu,
}) {
  // Panel state
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [showPdfPanel, setShowPdfPanel] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Refs for panels and buttons
  const emailPanelRef = useRef(null);
  const pdfPanelRef = useRef(null);
  const emailButtonRef = useRef(null);
  const pdfButtonRef = useRef(null);

  // Check if any selected records are inactive
  const hasInactiveResources = selectedData.some((item) => {
    const status = item.status?.toUpperCase();
    return status === "INACTIVE" || status === "INACTIVO";
  });

  // Handle click outside to close panels
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Email panel
      if (
        showEmailPanel &&
        emailPanelRef.current &&
        !emailPanelRef.current.contains(event.target) &&
        emailButtonRef.current &&
        !emailButtonRef.current.contains(event.target)
      ) {
        setShowEmailPanel(false);
        setStatusMessage("");
      }
      // PDF panel
      if (
        showPdfPanel &&
        pdfPanelRef.current &&
        !pdfPanelRef.current.contains(event.target) &&
        pdfButtonRef.current &&
        !pdfButtonRef.current.contains(event.target)
      ) {
        setShowPdfPanel(false);
        setStatusMessage("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmailPanel, showPdfPanel]);

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
        setShowEmailPanel(true);
        setShowPdfPanel(false);
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
        setShowPdfPanel(true);
        setShowEmailPanel(false);
        setStatusMessage("");
      }
    }
  };

  // Handle email send
  const handleEmailSend = async (recipient) => {
    if (!recipient) {
      setStatusMessage("Please enter a recipient email");
      return;
    }

    setIsSending(true);
    setStatusMessage("");

    try {
      // Call the email success handler which triggers the actual send
      if (onEmailSuccess) {
        await onEmailSuccess(recipient);
      }
      setShowEmailPanel(false);
    } catch (err) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle PDF create
  const handlePdfCreate = async () => {
    setIsSending(true);
    setStatusMessage("");

    try {
      if (onPdfSuccess) {
        await onPdfSuccess();
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
        className="hidden md:flex items-center justify-between"
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
              <div
                className="bg-navbar1-counter-filtered text-navbar1-counter-text-filtered rounded-full flex items-center justify-center font-opensans"
                style={{
                  width: 'var(--size-navbar1-counter)',
                  height: 'var(--size-navbar1-counter)',
                  fontSize: 'var(--font-size-navbar1-counter)',
                  fontWeight: 'var(--font-weight-navbar1-counter)',
                }}
              >
                {filteredCount}
              </div>
            </Tooltip>

            {/* Selected count */}
            <Tooltip text="Selected records" position="bottom-left">
              <div
                className="bg-navbar1-counter-selected text-navbar1-counter-text-selected rounded-full flex items-center justify-center font-opensans"
                style={{
                  width: 'var(--size-navbar1-counter)',
                  height: 'var(--size-navbar1-counter)',
                  fontSize: 'var(--font-size-navbar1-counter)',
                  fontWeight: 'var(--font-weight-navbar1-counter)',
                }}
              >
                {selectedCount}
              </div>
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
          </div>
        </div>
      </div>

      {/* ========== MOBILE LAYOUT (<md) ========== */}
      <div className="md:hidden flex items-center justify-between py-3">
        {/* Left side - Logo only (title hidden on mobile) */}
        <div className="flex items-center gap-2">
          <img
            src="/images/CRG Logo 2025.webp"
            alt="CRG Logo"
            className="w-8 h-8 object-contain"
          />
          <span className="text-navbar1-title font-comfortaa text-sm font-semibold tracking-wide">
            CRG Houston
          </span>
        </div>

        {/* Right side - Counters, Buttons (smaller), Hamburger */}
        <div className="flex items-center gap-2">
          {/* Counters (smaller on mobile) */}
          <div className="flex items-center gap-1">
            <div
              className="bg-navbar1-counter-filtered text-navbar1-counter-text-filtered rounded-full flex items-center justify-center font-opensans text-xs font-medium"
              style={{ width: '32px', height: '32px' }}
            >
              {filteredCount}
            </div>
            <div
              className="bg-navbar1-counter-selected text-navbar1-counter-text-selected rounded-full flex items-center justify-center font-opensans text-xs font-medium"
              style={{ width: '32px', height: '32px' }}
            >
              {selectedCount}
            </div>
          </div>

          {/* Email/PDF buttons (smaller on mobile) */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                ref={emailButtonRef}
                onClick={handleEmailButtonClick}
                className={`rounded font-opensans text-xs px-2 py-1.5 transition-all ${
                  isGuest
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-navbar1-btn-email-bg text-navbar1-btn-email-text hover:brightness-125"
                }`}
                style={{ opacity: isGuest ? 0.6 : 1 }}
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
              />
            </div>
            <div className="relative">
              <button
                ref={pdfButtonRef}
                onClick={handlePdfButtonClick}
                className={`rounded font-opensans text-xs px-2 py-1.5 transition-all ${
                  isGuest
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-navbar1-btn-pdf-bg text-navbar1-btn-pdf-text hover:brightness-125"
                }`}
                style={{ opacity: isGuest ? 0.6 : 1 }}
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
          </div>

          {/* Hamburger menu button */}
          <button
            onClick={onOpenMobileMenu}
            className="text-white p-2 hover:brightness-125 transition-all"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>
    </nav>
  );
}
