// src/layout/NavBar.js
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslate } from "../Utility/Translate";
import { Menu, X } from "lucide-react";

function NavItem({ label, to, isMobile }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`px-3 py-1 rounded ${isMobile ? "text-[1.1rem] w-full text-center mb-2" : "text-[1.4rem]"} ${
        isActive
          ? "bg-[#9A8C98] text-[#FFC857]"
          : "text-white hover:bg-[#9A8C98]"
      }`}
    >
      {label}
    </Link>
  );
}

export default function NavBar({ onSendEmail, onCreatePdf }) {
  // Use the translation utility
  const { translate } = useTranslate();
  // State for mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [infoOpen, setInfoOpen] = useState(false);
  const infoBtnRef = useRef(null);
  const infoDialogRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (!infoOpen) return;
      const btn = infoBtnRef.current;
      const dlg = infoDialogRef.current;
      if (dlg && !dlg.contains(e.target) && btn && !btn.contains(e.target)) {
        setInfoOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [infoOpen]);
  
  // Define navItems using translation
  const navItems = [
    { label: translate("tZipCode"), to: "/" },
    { label: translate("tOrganization"), to: "/organization" },
    { label: translate("tSearch"), to: "/search" },
  ];
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  return (
    <nav className="bg-[#4A4E69] text-white py-3 px-6">
      {/* Desktop Navigation */}
      <div className="hidden md:flex md:items-center md:justify-between">
        {/* Left side – new alert button */}
        <div className="relative">
          <button
            ref={infoBtnRef}
            onClick={() => setInfoOpen(true)}
            aria-expanded={infoOpen}
            className={`text-[1.2rem] px-3 py-1 rounded border-2 border-[#FC004C] bg-[#4C5270] active:translate-y-px transition-colors 
    ${infoOpen ? "text-white" : "text-[#FC004C] hover:text-white"} 
    ${infoOpen ? "" : "hover:bg-[#4C5270]"}`}
          >
            Suicide Prevention: 988
          </button>
        </div>

        {/* Right side – existing navigation */}
        <div className="flex gap-6 justify-end items-center flex-1">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          
          {/* Email and PDF buttons grouped together */}
          <div className="flex gap-3 ml-6">
            <button
              onClick={onSendEmail}
              className="bg-[#FFC857] text-[#4A4E69] px-4 py-1 rounded text-[1.4rem] hover:brightness-105"
            >
              {translate("tMenuSendEmail")}
            </button>
            <button
              onClick={onCreatePdf}
              className="bg-[#35969A] text-[#FFFDE7] px-4 py-1 rounded text-[1.4rem] hover:brightness-75"
            >
              {translate("tCreatePdf")}
            </button> 
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      <div className="md:hidden flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            ref={infoBtnRef}
            onClick={() => setInfoOpen(true)}
            aria-expanded={infoOpen}
            className={`text-[0.9rem] px-2 py-1 rounded border-2 border-[#FC004C] bg-[#4C5270] active:translate-y-px transition-colors whitespace-nowrap 
    ${infoOpen ? "text-white" : "text-white hover:text-white hover:bg-[#4C5270]"}`}
          >
            988
          </button>
          <button 
            onClick={toggleMobileMenu}
            className="text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? 
              <X size={28} /> : 
              <Menu size={28} />
            }
          </button>
        </div>
        
        {/* Email and PDF buttons on right - stacked vertically on very small screens */}
        <div className="flex flex-col xs:flex-row gap-1 xs:gap-2">
          <button
            onClick={onSendEmail}
            className="bg-[#FFC857] text-[#4A4E69] px-2 xs:px-3 py-1 rounded text-[0.8rem] xs:text-[1rem] hover:brightness-105 whitespace-nowrap"
          >
            {translate("tMenuSendEmail")}
          </button>
          <button
            onClick={onCreatePdf}
            className="bg-[#35969A] text-[#FFFDE7] px-2 xs:px-3 py-1 rounded text-[0.8rem] xs:text-[1rem] hover:brightness-105 whitespace-nowrap"
          >
            {translate("tCreatePdf")}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 flex flex-col items-center">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} isMobile={true} />
          ))}
        </div>
      )}
      {infoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
          onClick={() => setInfoOpen(false)}
        >
          {/* Optional subtle backdrop without dimming too much */}
          <div className="absolute inset-0" />

          {/* Card */}
          <div
            ref={infoDialogRef}
            className="relative z-10 max-w-[900px] w-[92%] bg-white rounded-[4px] shadow-2xl p-6 md:p-8 border-[15px] border-[#FC004C]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <h2 className="text-[24px] font-semibold text-[#381D2A] text-center mb-6">
              Suicide Prevention
            </h2>

            {/* Two-column layout (stacks on small screens) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
              {/* LEFT COLUMN */}
              <div>
                <p className="text-[16px] font-medium text-[#381D2A] leading-relaxed mb-4">
                  These are escalating options to handle calls from a person threatening to harm themselves. Your assessment of the situation should determine what action or actions to take.
                </p>
                <ol className="list-decimal pl-6 space-y-3 text-[16px] font-medium text-[#381D2A]">
                  <li>
                    Have the person call <span className="text-[#FC004C] text-[20px] font-medium">988</span>.
                  </li>
                  <li>
                    You can call 988 or the local Crisis Line
                    {" "}
                    <span className="text-[#FC004C] text-[20px] font-medium">713-970-8210</span>.
                    <br />
                    Give them as much information as you have but at minimum name and phone number.
                  </li>
                  <li>
                    Call the appropriate
                    {" "}
                    <span className="bg-[#F9F871]/30 px-1">non-emergency police phone number</span>
                    {" "}
                    for a wellness check. They will need name, phone number and location.
                  </li>
                  <li>
                    Call <span className="text-[#FC004C] text-[20px] font-medium">911</span>. They will need name, phone number and location.
                  </li>
                </ol>
              </div>

              {/* RIGHT COLUMN */}
              <div className="md:w-[380px]">
                <div className="flex justify-center mb-3">
                  <div className="inline-block rounded-full bg-[#F9F871]/30 px-4 py-1 text-[14px] font-medium text-[#381D2A] text-center">
                    Non-Emergency Phone Numbers
                  </div>
                </div>

                <div className="space-y-2 text-[#381D2A]">
                  {[
                    { name: 'Houston Police Department', phone: '713-884-3131' },
                    { name: "Harris County Sheriff's Office", phone: '713-221-6000', extraGap: true },
                    { name: "Austin County Sheriff's Office", phone: '979-865-5911' },
                    { name: "Brazoria County Sheriff's Office", phone: '979-864-2200' },
                    { name: "Chambers County Sheriff's Office", phone: '409-296-8242' },
                    { name: "Ft Bend County Sheriff's Office", phone: '281-341-4665' },
                    { name: "Galveston County Sheriff's Office", phone: '409-763-7585' },
                    { name: "Liberty County Sheriff's Office", phone: '936-336-4500' },
                    { name: "Montgomery County Sheriff's Office", phone: '936-539-7800' },
                    { name: "Waller County Sheriff's Office", phone: '979-826-8282' },
                  ].map((row, idx) => (
                    <div
                      key={row.name}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-[14px] font-medium ${idx % 2 === 0 ? 'bg-[#E9F0F7]' : 'bg-[#F3ECF6]'} ${row.extraGap ? 'mt-4' : ''}`}
                    >
                      <span className="whitespace-nowrap">{row.name}</span>
                      <a href={`tel:${row.phone.replace(/[^0-9]/g, '')}`} className="hover:underline whitespace-nowrap">
                        {row.phone}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer guidance block (full width) */}
            <div className="mt-10 italic text-[16px] font-semibold text-[#381D2A] leading-relaxed w-full">
              Stay calm. Do not panic. Be non-judgmental. Listen actively. Ask direct and open questions.
              It is ok to ask if they are considering harming themselves. If so, how? Attempted suicide before?
              You are only trying to assess the situation in order to determine which of the four steps, above, you are going to take. Do not attempt to counsel unless you are a trained professional.
              Encourage them to seek help by calling 988.
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}