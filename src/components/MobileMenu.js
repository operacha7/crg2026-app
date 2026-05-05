// src/components/MobileMenu.js
// Mobile-only hamburger menu used in NavBar1 (on ZipCodePage) and on public
// pages via HomeNavBar. VerticalNavBar is hidden on mobile, so this menu is
// the way to reach auxiliary pages and return home.
//
// Default items are the in-app set (Home / Support / Privacy). Public pages
// pass their own `items` prop and an `iconColor` matching the surrounding
// header so the hamburger reads correctly against different backgrounds.

import { useState, useRef, useEffect } from "react";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

// In-app default — matches the homepage hamburger except Home replaces About
// (in-app users need a way back; the homepage IS home so it offers About
// instead). NavBar1 and SupportPage both pick this up by calling
// `<MobileMenu />` with no args.
const DEFAULT_ITEMS = [
  { label: "Home", path: "/" },
  { label: "Privacy Policy", path: "/privacy" },
  { label: "Terms of Service", path: "/terms" },
  { label: "Contact Support", path: "/support" },
  { label: "Organization Login", path: "/find?login=1" },
];

export default function MobileMenu({
  items = DEFAULT_ITEMS,
  iconColor = "var(--color-footer-bg)",
}) {
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
        style={{ color: iconColor }}
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
          {items.map((item, idx) => (
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
                  idx < items.length - 1 ? "1px solid #F0F0F0" : "none",
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
