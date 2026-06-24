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
import { SHARED_NAV_LINKS } from "../data/navLinks";

// In-app default — Home points to /find (the working search app), not /
// (the marketing homepage), since in-app users want a way back to the app
// they were just using, then the links shared with the public menu. Help +
// Logout are injected at render time. NavBar1 and SupportPage both pick this
// up by calling `<MobileMenu />` with no args.
const DEFAULT_ITEMS = [
  { label: "Home", path: "/find" },
  ...SHARED_NAV_LINKS,
];

export default function MobileMenu({
  items = DEFAULT_ITEMS,
  iconColor = "var(--color-footer-bg)",
  onLogout,
  onOpenHelp,
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Help is an action (opens the Help panel), not a route. Injected right after
  // Home when the caller provides onOpenHelp — this is how the mobile app reaches
  // Help, since the desktop VerticalNavBar (which normally hosts it) is hidden on
  // small screens. Callers without onOpenHelp (e.g. public pages) don't get it.
  const withHelp = onOpenHelp
    ? [items[0], { label: "Help", action: "help" }, ...items.slice(1)]
    : items;

  // Append Logout when the caller provides an onLogout handler. Kept here
  // (rather than in the items list) so callers don't have to assemble it
  // themselves, and so HomeNavBar (which passes its own items but has no
  // logged-in session to drop) is naturally opted out by not providing it.
  const allItems = onLogout
    ? [...withHelp, { label: "Logout", action: "logout" }]
    : withHelp;

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
          {allItems.map((item, idx) => (
            <button
              key={item.path || item.action || item.label}
              onClick={() => {
                setOpen(false);
                if (item.action === "logout") {
                  onLogout?.();
                } else if (item.action === "help") {
                  onOpenHelp?.();
                } else {
                  navigate(item.path);
                }
              }}
              className="w-full text-left hover:brightness-95 transition-all"
              style={{
                padding: "12px 16px",
                fontSize: "14px",
                color: "#222831",
                backgroundColor: "#FFFFFF",
                borderBottom:
                  idx < allItems.length - 1 ? "1px solid #F0F0F0" : "none",
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
