// src/layout/PageLayout.js
import { useState } from "react";
import NavBar1 from "./NavBar1";
import NavBar2 from "./NavBar2";
import NavBar3 from "./NavBar3";
import ResultsHeader from "./ResultsHeader";
import Footer from "./Footer";
import VerticalNavBar from "./VerticalNavBar";
import MobileMenu from "./MobileMenu";

export default function PageLayout({
  children,
  showNav = true,
  onSendEmail,
  onCreatePdf,
  totalCount = 0,
  filteredCount = 0,
  selectedCount = 0,
  // Props for email/PDF panels
  selectedData = [],
  loggedInUser,
  headerText,
  onEmailSuccess,
  onPdfSuccess,
}) {
  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);

  const handleOpenMobileMenu = () => setMobileMenuOpen(true);
  const handleCloseMobileMenu = () => setMobileMenuOpen(false);
  const handleOpenHelp = () => setHelpPanelOpen(true);


  return (
    <div className="md:h-screen md:flex md:flex-row md:overflow-hidden overflow-auto min-h-screen bg-gray-50 text-gray-900 font-opensans">
      {/* Main content area */}
      <div className="flex-1 flex flex-col md:overflow-hidden">
        {/* NavBar 1 - Top header with logo, title, counters, buttons */}
        {showNav && (
          <NavBar1
            totalCount={totalCount}
            filteredCount={filteredCount}
            selectedCount={selectedCount}
            onSendEmail={onSendEmail}
            onCreatePdf={onCreatePdf}
            selectedData={selectedData}
            loggedInUser={loggedInUser}
            headerText={headerText}
            onEmailSuccess={onEmailSuccess}
            onPdfSuccess={onPdfSuccess}
            onOpenMobileMenu={handleOpenMobileMenu}
          />
        )}

        {/* NavBar 2 - Search mode selector + filters */}
        {showNav && <NavBar2 />}

        {/* NavBar 3 - Assistance type filters */}
        {showNav && <NavBar3 />}

        {/* Results Header - Column labels (hidden on mobile) */}
        {showNav && <ResultsHeader />}

        {/* Main Content */}
        <main className="md:flex-1 md:flex md:flex-col md:overflow-hidden">{children}</main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Vertical Nav Bar - Right side (hidden on mobile) */}
      {showNav && (
        <div className="hidden md:block">
          <VerticalNavBar
            externalHelpOpen={helpPanelOpen}
            onHelpOpenChange={setHelpPanelOpen}
          />
        </div>
      )}

      {/* Mobile Menu (only visible on mobile) */}
      {showNav && (
        <MobileMenu
          isOpen={mobileMenuOpen}
          onClose={handleCloseMobileMenu}
          onOpenHelp={handleOpenHelp}
        />
      )}
    </div>
  );
}
