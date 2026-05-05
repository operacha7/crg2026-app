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
  onMessagesHandoff,
  onGvAutoSent,
}) {
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);

  return (
    <div className="h-dvh flex flex-col lg:flex-row overflow-hidden bg-gray-50 text-gray-900 font-opensans">
      {/* Main content area — flex-col on both mobile and desktop so the
          NavBars stay pinned at the top and the results area scrolls within
          a bounded height. This bounded height is what lets ResultsList's
          react-virtuoso virtualize correctly; without it the results list
          tries to grow to fit all 1000+ rows and the page becomes unresponsive
          on mobile. min-h-0 is required for flex children to shrink below
          their content height. */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* NavBar 1 - Top header with logo, title, counters, buttons */}
        {showNav && (
          <NavBar1
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
            onMessagesHandoff={onMessagesHandoff}
            onGvAutoSent={onGvAutoSent}
          />
        )}

        {/* NavBar 2 - Search mode selector + filters */}
        {showNav && <NavBar2 />}

        {/* NavBar 3 - Assistance type filters */}
        {showNav && <NavBar3 />}

        {/* Main Content - ResultsHeader now rendered inside ResultsList.
            flex-col flex-1 overflow-hidden on both breakpoints so the bounded
            height propagates down to ResultsList → react-virtuoso. min-h-0
            allows the flex child to shrink under content size. */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">{children}</main>

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
