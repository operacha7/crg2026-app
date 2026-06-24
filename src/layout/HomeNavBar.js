// src/layout/HomeNavBar.js
// Public-page variant of NavBar1: same dark band + logo + wordmark.
//
// Desktop right side is a single contextual link — "About" when the user is on
// the homepage, "Home" everywhere else (e.g., /about, /privacy, /terms).
//
// Mobile right side is a hamburger that opens the full set of public
// navigation (Home / About / Privacy / Terms / Support / Org Login). The teal
// secondary footer is hidden on mobile, so the hamburger is the way to reach
// those pages on phones.
//
// Why a contextual desktop link: the logo + wordmark are already a Link to
// "/", but that convention isn't always discovered by users who are new to the
// web or arrive in a moment of stress. The contextual link gives them an
// explicit, always-visible affordance that points to wherever they aren't.

import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import MobileMenu from "../components/MobileMenu";
import { HomeIcon } from "../icons";
import { getHomeOrigin } from "../utils/homeOrigin";
import { SHARED_NAV_LINKS } from "../data/navLinks";

// Page titles shown at the right of the header (desktop), mirroring how
// Contact Support displays its page name in NavBar1. Keyed by pathname; the
// homepage has no entry (it shows the "About" link instead).
const PAGE_TITLES = {
  "/about": "About",
  "/privacy": "Privacy Policy",
  "/terms": "Terms of Service",
  "/training": "Training",
};

export default function HomeNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const pageTitle = PAGE_TITLES[location.pathname];

  // Return to the primary page the user came from (tracked in homeOrigin),
  // regardless of how many secondary pages they hopped through. Falls back to
  // the marketing home when nothing was recorded (cold landing).
  const handleHomeClick = () => {
    navigate(getHomeOrigin("/"));
  };

  // Hamburger contents: an explicit "Home" link when not already on / (mirrors
  // the desktop contextual link), the public-only "About", then the links shared
  // with the in-app menu (SHARED_NAV_LINKS — kept in one place so the two
  // hamburgers can't drift apart).
  const mobileItems = [
    // Home is an action so it returns to where the user entered the menu
    // cluster from (getHomeOrigin), matching the desktop nav. Hidden on / since
    // you're already home.
    ...(isHome ? [] : [{ label: "Home", action: "home" }]),
    { label: "About", path: "/about" },
    ...SHARED_NAV_LINKS,
  ];

  const rightLinkStyle = {
    color: "var(--color-home-navbar-about)",
    fontSize: "clamp(14px, 1.2vw, 18px)",
    letterSpacing: "0.05em",
  };

  return (
    <nav
      className="bg-navbar1-bg flex items-center justify-between"
      style={{
        height: "var(--height-navbar1)",
        paddingLeft: "var(--padding-navbar1-left)",
        paddingRight: "var(--padding-navbar1-right)",
      }}
    >
      <Link
        to="/"
        className="flex items-center hover:brightness-125"
        style={{ gap: "var(--gap-navbar1-logo-title)" }}
      >
        <img
          src="/images/CRG Logo 2025.webp"
          alt="CRG Logo"
          style={{
            width: "var(--size-navbar1-logo)",
            height: "var(--size-navbar1-logo)",
          }}
          className="object-contain"
        />
        <h1
          className="text-navbar1-title font-comfortaa"
          style={{
            fontSize: "var(--font-size-navbar1-title)",
            fontWeight: "var(--font-weight-navbar1-title)",
            letterSpacing: "var(--letter-spacing-navbar1-title)",
          }}
        >
          Community Resources Guide Houston
        </h1>
      </Link>

      {/* Desktop right side:
          - Homepage: the contextual "About" text link (unchanged).
          - Other pages: the page title (static, mirrors Contact Support's
            NavBar1 title) followed by the Home icon as the back-home affordance
            — the same icon used in the in-app vertical nav. */}
      <div className="hidden lg:flex items-center" style={{ gap: 20 }}>
        {isHome ? (
          <Link
            to="/about"
            className="hover:brightness-125 font-opensans"
            style={rightLinkStyle}
          >
            About
          </Link>
        ) : (
          <>
            {pageTitle && (
              <span
                className="font-opensans"
                style={{
                  color: "var(--color-navbar1-title)",
                  fontSize: "var(--font-size-navbar1-btn)",
                  fontWeight: "var(--font-weight-navbar1-btn)",
                  letterSpacing: "var(--letter-spacing-navbar1-btn)",
                }}
              >
                {pageTitle}
              </span>
            )}
            <button
              type="button"
              onClick={handleHomeClick}
              className="hover:brightness-125 focus:outline-none"
              aria-label="Home"
            >
              <HomeIcon size={35} />
            </button>
          </>
        )}
      </div>

      {/* Mobile: hamburger menu with full public-nav set */}
      <div className="lg:hidden">
        <MobileMenu
          items={mobileItems}
          iconColor="var(--color-home-navbar-about)"
          homeFallback="/"
        />
      </div>
    </nav>
  );
}
