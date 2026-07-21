// src/App.js
import React, { useState, useEffect, lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import LoginModal from "./auth/LoginModal";
import { resetAnnouncementsShown } from "./components/AnnouncementManager";
import { recordHomeOrigin } from "./utils/homeOrigin";
import HomePage from "./views/HomePage";
import AboutPage from "./views/AboutPage";
import PrivacyPage from "./views/PrivacyPage";
import TermsPage from "./views/TermsPage";
import TrainingPage from "./views/TrainingPage";
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
  // As of 2026-07-21 guests have the same Email/PDF/Text access as registered
  // orgs (see src/config/guestAccess.js). These flags are not read anywhere;
  // the actual gating lives in guestAccess.js + the server functions.
  canEmail: true,
  canPdf: true,
};

// Paths under MainApp that should be reachable without an account. Visitors
// hitting these get an auto-created guest user. /reports is reachable by guests
// (as of 2026-07-21 guests have the same access as registered orgs, Reports
// included). /announcements is reachable by guests: AnnouncementService filters
// by audience — guests see audience_code 1 plus any code-3 announcement that
// targets "Guest" — matching the popup behavior on load. /news is public by
// design: it's the Opportunity Scan news feed, readable by anyone (and a
// fresh-content SEO surface). Its data comes from /news-feed, which only ever
// returns published, unexpired items.
const PUBLIC_MAIN_PATH_PREFIXES = ['/assistance/', '/support', '/find', '/announcements', '/news', '/reports'];

const isPublicMainPath = (pathname) =>
  PUBLIC_MAIN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Remember the last primary page (so the "Home" buttons on the secondary
  // pages — About/Privacy/Terms/Training/Support/Reports/Announcements — return
  // the user to where they came from, not just one history step back).
  useEffect(() => {
    recordHomeOrigin(location.pathname, location.search);
  }, [location]);

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

  // True once the cookie-based auth check has settled, so we know whether a
  // null `user` means "really a guest" vs. "registered user we haven't
  // restored yet". Dev-bypass and ?guest=1 deep links set `user` synchronously
  // above (no /whoami call), so auth is already resolved for them. Without this
  // gate, a registered org refreshing a public path would briefly fall back to
  // GUEST_USER and log a spurious guest session before /whoami restored them.
  const [authResolved, setAuthResolved] = useState(DEV_BYPASS_LOGIN || isDeepLink);

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
      .catch((err) => console.error("App: /whoami failed", err))
      .finally(() => {
        // Resolved regardless of outcome: a failed/empty /whoami means we
        // treat the visitor as unauthenticated (guest), which is the correct
        // fallback. Guarded so we don't set state after unmount.
        if (!cancelled) setAuthResolved(true);
      });
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
    // Re-arm announcements so a fresh login in the same tab (no page reload)
    // shows them again, matching the "on log-on or refresh" rule.
    resetAnnouncementsShown();
    // Reset the training popup dedupe so a fresh login the same day is
    // re-prompted. Key must match POPUP_SHOWN_KEY in src/MainApp.js. Within a
    // single visit (refresh / navigation, no logout) the flag persists, so the
    // popup still shows only once.
    try {
      localStorage.removeItem("crg_training_popup_shown");
      localStorage.removeItem("crg_training_minimized");
      // Reset the guest-session dedupe so that if this browser re-enters the
      // app as a guest after logging out, it counts as a new session. Without
      // this the flag persists for the tab's lifetime and a post-logout
      // re-entry wouldn't be re-counted in the Sessions Chart.
      sessionStorage.removeItem("guest_session_logged");
    } catch {
      /* best-effort only */
    }
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
    // Wait for the cookie-based auth check to settle. Logging before this
    // would attribute a registered org's page refresh to "Guest" during the
    // brief window before /whoami restores them.
    if (!authResolved) return;
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
  }, [authResolved, effectiveUser]);

  // When an auth-gated MainApp path (one not in PUBLIC_MAIN_PATH_PREFIXES) is
  // hit without a user, send them to /find with the login modal open. /find is
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

          {/* Public training schedule — reachable by everyone, incl. guests */}
          <Route path="/training" element={<TrainingPage />} />

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
