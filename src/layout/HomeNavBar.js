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

export default function HomeNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";

  const handleHomeClick = () => {
    if (location.key === "default") {
      navigate("/");
    } else {
      navigate(-1);
    }
  };

  // Hamburger contents: same five items as the teal secondary footer, plus
  // an explicit "Home" link when not already on /. Mirrors the desktop
  // contextual link so mobile users still have a one-tap way back home.
  const mobileItems = [
    ...(isHome ? [] : [{ label: "Home", path: "/" }]),
    { label: "About", path: "/about" },
    { label: "Privacy Policy", path: "/privacy" },
    { label: "Terms of Service", path: "/terms" },
    { label: "Contact Support", path: "/support" },
    // Relative path so the modal opens on the current page; LoginModal
    // forwards to /find after a successful login from the homepage.
    { label: "Organization Login", path: "?login=1" },
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

      {/* Desktop: contextual About / Home text link */}
      <div className="hidden lg:block">
        {isHome ? (
          <Link
            to="/about"
            className="hover:brightness-125 font-opensans"
            style={rightLinkStyle}
          >
            About
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleHomeClick}
            className="hover:brightness-125 font-opensans"
            style={{ ...rightLinkStyle, background: "none", border: "none", cursor: "pointer" }}
          >
            Home
          </button>
        )}
      </div>

      {/* Mobile: hamburger menu with full public-nav set */}
      <div className="lg:hidden">
        <MobileMenu
          items={mobileItems}
          iconColor="var(--color-home-navbar-about)"
        />
      </div>
    </nav>
  );
}
