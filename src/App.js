// src/App.js
import React, { useState, useEffect, lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import LoginModal from "./auth/LoginModal";
import HomePage from "./views/HomePage";
import AboutPage from "./views/AboutPage";
import PrivacyPage from "./views/PrivacyPage";
import TermsPage from "./views/TermsPage";
// MainApp (and everything it transitively imports — NavBars, ZipCodePage, email service,
// Supabase client) is lazy-loaded so the homepage ships with a much smaller initial
// bundle. Critical on mobile networks.
const MainApp = lazy(() => import("./MainApp"));

// DEV BYPASS: Skip login in development OR when running with wrangler (production build locally)
// Set to false to test login flow, true to skip login during development
const DEV_BYPASS_LOGIN = false; // TEMPORARILY DISABLED - set back to true when done testing login
// Mock user for development
const DEV_USER = {
  id: 'dev-user',
  organization: 'Development Mode',
  canEmail: true,
  canPdf: true,
};

const GUEST_USER = {
  id: 'guest',
  organization: 'Guest',
  isGuest: true,
  canEmail: false,
  canPdf: false,
};

// Paths under MainApp that should be reachable without an account. Visitors
// hitting these get an auto-created guest user. /reports and /announcements
// stay auth-gated.
const PUBLIC_MAIN_PATH_PREFIXES = ['/assistance/', '/support', '/find'];

const isPublicMainPath = (pathname) =>
  PUBLIC_MAIN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Treat a browser reload on /find as a session reset — drop the user back
  // on the homepage instead of letting them resume on a guest ZipCodePage.
  // Only triggers on actual reload (F5 / Cmd-R / browser refresh button); the
  // Navigation Timing API distinguishes that from in-app navigate() calls, so
  // the Organization Login modal flow (which uses navigate()) is unaffected.
  useEffect(() => {
    const entries = performance.getEntriesByType("navigation");
    const isReload = entries.length > 0 && entries[0].type === "reload";
    if (isReload && location.pathname === "/find") {
      navigate("/", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for ?guest=1 deep link (SMS share links auto-login as guest)
  const searchParams = new URLSearchParams(location.search);
  const isDeepLink = searchParams.get("guest") === "1";

  // In dev mode with bypass enabled, start with mock user
  // Deep links with ?guest=1 also auto-login as guest
  const [user, setUser] = useState(() => {
    if (DEV_BYPASS_LOGIN) return DEV_USER;
    if (isDeepLink) return GUEST_USER;
    return null;
  });

  // Effective user: real user if logged in; guest if visiting a public MainApp
  // route without an account; otherwise null (route will redirect to home with
  // the login modal open).
  const effectiveUser = user || (isPublicMainPath(location.pathname) ? GUEST_USER : null);

  // Logout: clear the registered user and drop back on the marketing
  // homepage. The vertical nav (where the logout icon lives) doesn't render
  // on /, so the icon disappears as soon as it's used — no visible
  // post-logout state to worry about.
  const handleLogout = () => {
    setUser(null);
    navigate("/", { replace: true });
  };

  // When an auth-gated MainApp path (e.g. /reports, /announcements) is hit
  // without a user, send them to /find with the login modal open. /find is
  // the public URL for ZipCodePage so the modal stacks over the working app
  // and a successful login lands the user where they can immediately use it.
  // UTMs from the original landing URL are preserved so attribution works.
  const getLoginRedirectPath = () => {
    const params = new URLSearchParams();
    params.set("login", "1");
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith("utm_")) {
        params.append(key, value);
      }
    }
    return `/find?${params.toString()}`;
  };

  return (
    <HelmetProvider>
      <div className="font-opensans">
        <Routes>
          {/* Public homepage */}
          <Route path="/" element={<HomePage />} />

          {/* Public About page */}
          <Route path="/about" element={<AboutPage />} />

          {/* Public legal pages */}
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {/* Backward-compat: any remaining /login links (old bookmarks,
              external referrals) bounce to /find with the modal open. */}
          <Route path="/login" element={<Navigate to="/find?login=1" replace />} />

          {/* Everything else routes through MainApp. Public MainApp paths
              auto-guest; private paths redirect home with the login modal. */}
          <Route
            path="/*"
            element={
              effectiveUser ? (
                <Suspense fallback={null}>
                  <MainApp loggedInUser={effectiveUser} onLogout={handleLogout} />
                </Suspense>
              ) : (
                <Navigate to={getLoginRedirectPath()} replace />
              )
            }
          />
        </Routes>

        {/* Site-wide login modal — opens whenever ?login=1 is present.
            Footer's "Organization Login" link triggers it; logged-in users
            can re-open it to switch organizations. */}
        <LoginModal onLoginSuccess={setUser} />
      </div>
    </HelmetProvider>
  );
}
