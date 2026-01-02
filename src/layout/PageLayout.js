// src/layout/PageLayout.js
import React from "react";
import NavBar from "./NavBar";
import { useTranslate } from "../Utility/Translate";
import { useLanguage } from "../Contexts/LanguageContext";
import { Link, useLocation } from 'react-router-dom';
import { HelpCircle } from "lucide-react";
import { useTour } from "../Contexts/TourProvider";

export default function PageLayout({
  children,
  showNav = true,
  onSendEmail,
  onCreatePdf, // NEW: Added PDF prop
  languageToggleRef,
  footerLinksRef,
  openTour = null 
}) {
  // Use language context - FIXED: Use toggleLanguage instead of setLanguage
  const { language, toggleLanguage } = useLanguage();
  // Use translation utility
  const { translate } = useTranslate();
  
  // Get location for tour names
  const location = useLocation();
  
  // Defensive approach to prevent errors
  const tourContext = useTour();
  const startTour = tourContext?.startTour || (() => {});

  // Function to determine tour name based on path
  const getTourNameForPath = () => {
    switch(location.pathname) {
      case '/':
        return 'zipCodeTour';
      case '/organization':
        return 'organizationTour';
      case '/search':
        return 'searchTour';
      default:
        return null;
    }
  };

  const FooterLink = ({ to, translateKey, external = false }) => {
    const location = useLocation();
    const { translate } = useTranslate();

    if (external) {
      return (
        <a
          href={to}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          onClick={(e) => {
            console.log(`Clicked external link to: ${to}`);
          }}
        >
          {translate(translateKey)}
        </a>
      );
    }

    return (
      <Link
        to={to}
        className={`hover:underline ${
          location.pathname === to
            ? 'font-medium bg-[#b7ae38] px-2 rounded text-[#fff]'
            : ''
        }`}
      >
        {translate(translateKey)}
      </Link>
    );
  };

  return (
    <div className="md:h-screen md:flex md:flex-col md:overflow-hidden overflow-auto min-h-screen bg-gray-50 text-gray-900 font-lexend">
      {/* Top Title Bar */}
      <header className="bg-gray text-[#4A4E69] mb-2 mt-4">
        <div className="flex items-center justify-start gap-4 px-6 m-0">
          <img
            src="/images/CRG Logo NEW 2025.png"
            alt="CRG Logo"
            className="w-10 h-10 rounded-sm object-cover"
          />
          <h1 className="text-[1.6rem] font-bold font-comfortaa tracking-widest">
            {translate("tTitle")}
          </h1>
        </div>
      </header>

      {/* NavBar - UPDATED: Pass both props */}
      {showNav && (
        <div className="navbar">
          <NavBar onSendEmail={onSendEmail} onCreatePdf={onCreatePdf} />
        </div>
      )}

      {/* Main Content */}
      <main className="md:flex-1 md:flex md:flex-col md:overflow-hidden">{children}</main>

      {/* Footer sections */}
      <footer className="bg-[#4A4E69] text-[#FFC857] text-xs text-center py-[.3rem]">
        © 2025 O Peracha. {translate("tRightsReserved")}
      </footer>

      <footer className="text-[10px] text-center py-2 bg-transparent">
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-6">
          {/* Language toggle button - FIXED: Use toggleLanguage from context */}
          <button
            ref={languageToggleRef} 
            onClick={toggleLanguage}
            className={`language-toggle text-[0.8rem] hover:scale-150 transition-transform duration-200 font-medium text-black px-2 py-0.5 rounded ${
              language === "English"
                ? "bg-mexico-gradient"
                : "bg-usa-gradient"
            }`}
          >
            {language === "English" ? "Español" : "English"}
          </button>

          {/* Navigation items */}
          <div ref={footerLinksRef} className="flex flex-wrap md:flex-nowrap justify-center gap-3 md:gap-6">
            <FooterLink to="/reports" translateKey="tReports" />
            <FooterLink to="/privacy" translateKey="tPrivacyPolicy" />
            <FooterLink to="/terms" translateKey="tTermsOfService" />
            <FooterLink to="/docs/manual.pdf" translateKey="tManual" external={true} />
            <FooterLink to="/support" translateKey="tSupport" />
            <FooterLink to="/messages" translateKey="tMessages" />
          </div>
          
          {/* Help button to start the tour */}
          <button
            onClick={() => {
              const tourName = getTourNameForPath();
              if (tourName) {
                startTour(tourName);
              }
            }}
            className="inline-flex items-center justify-center p-1 rounded-full text-blue-600 hover:text-blue-800 hover:bg-blue-100 transition-colors"
            title={translate("tHelp")}
          >
            <HelpCircle className="h-5 w-5 hover:scale-150 transition-transform duration-200" />
          </button>
        </div>
      </footer>
    </div>
  );
}