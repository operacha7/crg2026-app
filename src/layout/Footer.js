// src/layout/Footer.js
// Two-tier site-wide footer:
//   1. Secondary tier with public links (About, Privacy, Terms, Support, Org Login)
//   2. Red copyright bar (unchanged from prior versions)
// Renders on every page — homepage, public pages, and in-app.

import React from "react";
import { Link } from "react-router-dom";
import { USFlagIcon } from "../icons";

// "Organization Login" deliberately points at /find?login=1 instead of any
// route on the public marketing layer. The site-wide LoginModal in App.js
// listens for ?login=1 and opens — so the click always lands on the working
// ZipCodePage with the modal up, regardless of the page the user clicked
// from. Successful login leaves them right where they can start using the
// app; cancel leaves them on /find as a guest.
const SECONDARY_LINKS = [
  { label: "About", to: "/about" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Service", to: "/terms" },
  { label: "Contact Support", to: "/support" },
  { label: "Organization Login", to: "/find?login=1" },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Teal secondary tier hidden on mobile — its links live in the
          HomeNavBar hamburger / NavBar1 hamburger on small screens. */}
      <div
        className="hidden lg:flex items-center justify-center w-full"
        style={{
          background: "var(--color-footer-secondary-bg)",
          color: "var(--color-footer-secondary-text)",
          height: "var(--height-footer-secondary)",
          fontFamily: "var(--font-family-body)",
          fontSize: "var(--font-size-footer-secondary)",
        }}
      >
        <nav
          className="flex items-center flex-wrap justify-center"
          style={{ gap: "var(--gap-footer-secondary-links)" }}
        >
          {SECONDARY_LINKS.map((link, idx) => (
            <React.Fragment key={link.to}>
              <Link
                to={link.to}
                className="hover:brightness-125"
                style={{ color: "var(--color-footer-secondary-text)" }}
              >
                {link.label}
              </Link>
              {idx < SECONDARY_LINKS.length - 1 && (
                <span aria-hidden="true" style={{ opacity: 0.5 }}>·</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <footer
        className="bg-footer-bg text-footer-text h-footer flex items-center justify-center w-full"
        style={{ fontFamily: "var(--font-family-body)", fontSize: "var(--font-size-footer)" }}
      >
        <div className="flex items-center gap-2">
          <USFlagIcon size={20} />
          <span>
            © {currentYear} O Peracha. All Rights Reserved.
          </span>
        </div>
      </footer>
    </>
  );
}
