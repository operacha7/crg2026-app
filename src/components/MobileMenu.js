// src/components/MobileMenu.js
// Mobile-only hamburger menu used in NavBar1 (on ZipCodePage) and in the
// custom headers of SupportPage / LegalPage. Provides Home / Contact Support /
// Privacy Policy navigation. VerticalNavBar is hidden on mobile, so this
// menu is the way to reach those pages and return home.

import { useState, useRef, useEffect } from "react";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MENU_ITEMS = [
  { label: "Home", path: "/" },
  { label: "Contact Support", path: "/support" },
  { label: "Privacy Policy", path: "/privacy" },
];

export default function MobileMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="p-2 hover:brightness-125 transition-all"
        style={{ color: "var(--color-footer-bg)" }}
        aria-label="Menu"
      >
        <Menu size={26} />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute font-opensans"
          style={{
            top: "100%",
            right: 0,
            marginTop: "6px",
            minWidth: "180px",
            backgroundColor: "#FFFFFF",
            borderRadius: "6px",
            boxShadow: "0 6px 18px rgba(0, 0, 0, 0.25)",
            border: "1px solid #E0E0E0",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {MENU_ITEMS.map((item, idx) => (
            <button
              key={item.path}
              onClick={() => {
                setOpen(false);
                navigate(item.path);
              }}
              className="w-full text-left hover:brightness-95 transition-all"
              style={{
                padding: "12px 16px",
                fontSize: "14px",
                color: "#222831",
                backgroundColor: "#FFFFFF",
                borderBottom:
                  idx < MENU_ITEMS.length - 1 ? "1px solid #F0F0F0" : "none",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
