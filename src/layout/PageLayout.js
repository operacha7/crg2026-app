// src/layout/PageLayout.js
import { useState } from "react";
import NavBar1 from "./NavBar1";
import NavBar2 from "./NavBar2";
import NavBar3 from "./NavBar3";
import Footer from "./Footer";
import VerticalNavBar from "./VerticalNavBar";

export default function PageLayout({
  children,
  showNav = true,
  onSendEmail,
  onCreatePdf,
  onSendSms,
  totalCount = 0,
  filteredCount = 0,
  selectedCount = 0,
  // Props for email/PDF/SMS panels
  selectedData = [],
  loggedInUser,
  headerText,
  onEmailSuccess,
  onPdfSuccess,
  smsBody = "",
  onSmsInitiated,
}) {
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);

  return (
    <div className="lg:h-dvh lg:flex lg:flex-row lg:overflow-hidden overflow-auto min-h-dvh bg-gray-50 text-gray-900 font-opensans">
      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:overflow-hidden">
        {/* NavBar 1 - Top header with logo, title, counters, buttons */}
        {showNav && (
          <NavBar1
            totalCount={totalCount}
            filteredCount={filteredCount}
            selectedCount={selectedCount}
            onSendEmail={onSendEmail}
            onCreatePdf={onCreatePdf}
            onSendSms={onSendSms}
            selectedData={selectedData}
            loggedInUser={loggedInUser}
            headerText={headerText}
            onEmailSuccess={onEmailSuccess}
            onPdfSuccess={onPdfSuccess}
            smsBody={smsBody}
            onSmsInitiated={onSmsInitiated}
          />
        )}

        {/* NavBar 2 - Search mode selector + filters */}
        {showNav && <NavBar2 />}

        {/* NavBar 3 - Assistance type filters */}
        {showNav && <NavBar3 />}

        {/* Main Content - ResultsHeader now rendered inside ResultsList */}
        <main className="lg:flex-1 lg:flex lg:flex-col lg:overflow-hidden">{children}</main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Vertical Nav Bar - Right side (hidden on mobile) */}
      {showNav && (
        <div className="hidden lg:block">
          <VerticalNavBar
            externalHelpOpen={helpPanelOpen}
            onHelpOpenChange={setHelpPanelOpen}
          />
        </div>
      )}
    </div>
  );
}
