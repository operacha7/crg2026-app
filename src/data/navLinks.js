// src/data/navLinks.js
// Single source of truth for the menu links shared by BOTH mobile hamburgers:
//   - the in-app menu (MobileMenu's DEFAULT_ITEMS, used on /find and /support)
//   - the public-pages menu (HomeNavBar's mobileItems, used on /, /about, etc.)
//
// These are the destinations that mean the same thing in either zone, so they
// must stay identical. Each shell adds its OWN context-specific items around
// these (Home target differs; in-app also has Help + Logout; public also has
// About) — those intentionally do NOT live here.
//
// Edit this list once and both hamburgers update, so they can't drift apart.

export const SHARED_NAV_LINKS = [
  // News is how mobile reaches the feed — the chyron that carries it on desktop
  // sits above the teal tier, which is hidden on mobile.
  { label: "News", path: "/news" },
  { label: "Training", path: "/training" },
  { label: "Privacy Policy", path: "/privacy" },
  { label: "Terms of Service", path: "/terms" },
  { label: "Contact Support", path: "/support" },
  // Relative path so the login modal opens on the current page rather than
  // navigating away first; LoginModal handles post-login forwarding.
  { label: "Organization Login", path: "?login=1" },
];
