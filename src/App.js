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
// hitting these get an auto-created guest user. /reports stays auth-gated
// (org-level usage analytics). /announcements is reachable by guests:
// AnnouncementService filters server-side to audience_code=1 (All CRG Users)
// for guest viewers, matching the popup behavior on first load.
const PUBLIC_MAIN_PATH_PREFIXES = ['/assistance/', '/support', '/find', '/announcements'];

const isPublicMainPath = (pathname) =>
  PUBLIC_MAIN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

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

  // Restore user from the session cookie on app load. The cookie is
  // httpOnly so JS can't read it directly — /whoami validates the JWT
  // server-side and returns the user payload. This is what makes refresh
  // (and direct deep-links into auth-gated paths) keep the user signed in
  // until the 2 AM scheduled reload clears the cookie.
  useEffect(() => {
    if (DEV_BYPASS_LOGIN || isDeepLink) return;
    let cancelled = false;
    fetch("/whoami", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success && data.user) {
          setUser(data.user);
        }
      })
      .catch((err) => console.error("App: /whoami failed", err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effective user: real user if logged in; guest if visiting a public MainApp
  // route without an account; otherwise null (route will redirect to home with
  // the login modal open).
  const effectiveUser = user || (isPublicMainPath(location.pathname) ? GUEST_USER : null);

  // Logout coordination flag. The catchall auth gate (which redirects
  // unauthenticated users hitting /reports etc. to /find?login=1) renders
  // its <Navigate> the moment effectiveUser becomes null. From an
  // auth-gated path like /reports, that fires against an intermediate
  // frame where the pathname hasn't yet flipped to "/" — so the redirect
  // beats our own navigate("/") and the user lands on /find instead of /.
  //
  // Setting this flag first tells the catchall to render null (no
  // redirect) for the brief window between user-clear and pathname-/.
  // It's reset by an effect once we've actually arrived at "/", so it
  // can't strand the user in a no-redirect state on an auth-gated path.
  const [logoutInProgress, setLogoutInProgress] = useState(false);

  // Logout: drop everyone (registered users AND guests) back on the
  // marketing homepage. The vertical nav (where the logout icon lives)
  // doesn't render on /, so the icon disappears as soon as it's used.
  // Also fire-and-forget /logout so the server-side session cookie is
  // cleared in lockstep with the React state. We don't await — the user
  // shouldn't wait on a network round-trip to leave the page; if the
  // request fails the cookie just expires at the next 2 AM reset.
  const handleLogout = () => {
    setLogoutInProgress(true);
    setUser(null);
    fetch("/logout", { method: "POST", credentials: "include" }).catch(() => {});
    navigate("/", { replace: true });
  };

  // Clear the logout flag once we've landed on /. Guarded on pathname so a
  // mid-logout pathname change to anywhere other than / wouldn't incorrectly
  // clear the flag and let the catchall fire its redirect.
  useEffect(() => {
    if (logoutInProgress && location.pathname === "/") {
      setLogoutInProgress(false);
    }
  }, [logoutInProgress, location.pathname]);

  // One log row per browser tab when a guest is active — feeds the Sessions
  // Chart in Reports. sessionStorage dedupes so a refresh in the same tab
  // doesn't double-count; closing and reopening the tab = a new session,
  // which is the closest analog to the registered-user case (where the
  // session cookie expires nightly at 2 AM and the next login is logged).
  // Fire-and-forget — a logging failure must never block the user's flow.
  useEffect(() => {
    if (effectiveUser?.isGuest !== true) return;
    if (sessionStorage.getItem("guest_session_logged") === "1") return;
    sessionStorage.setItem("guest_session_logged", "1");
    fetch("/log-usage", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reg_organization: "Guest",
        action_type: "login",
      }),
    }).catch((err) => console.error("App: guest session log failed", err));
  }, [effectiveUser]);

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

  // Renders MainApp for authenticated users; null while a logout is racing
  // pathname toward "/" (so the catchall doesn't fire its login redirect
  // against the intermediate auth-gated frame); otherwise the standard
  // <Navigate> redirect to the login path.
  const renderMainAppOrAuthGate = () => {
    if (effectiveUser) {
      return (
        <Suspense fallback={null}>
          <MainApp loggedInUser={effectiveUser} onLogout={handleLogout} />
        </Suspense>
      );
    }
    if (logoutInProgress) {
      return null;
    }
    return <Navigate to={getLoginRedirectPath()} replace />;
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
          <Route path="/*" element={renderMainAppOrAuthGate()} />
        </Routes>

        {/* Site-wide login modal — opens whenever ?login=1 is present.
            Footer's "Organization Login" link triggers it; logged-in users
            can re-open it to switch organizations. */}
        <LoginModal onLoginSuccess={setUser} />
      </div>
    </HelmetProvider>
  );
}
