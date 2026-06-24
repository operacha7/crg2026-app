// src/MainApp.js
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearchParams, useNavigate, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Helmet } from "react-helmet-async";
// Import Announcement components
import AnnouncementManager from './components/AnnouncementManager';
import ScheduledReload from './components/ScheduledReload';
import { useTraining } from './Contexts/TrainingContext';
import { TrainingProvider } from './Contexts/TrainingProvider';
import TrainingPopup from './components/TrainingPopup';

import { AppDataProvider, useAppData } from "./Contexts/AppDataContext";
import { supabase } from "./supabaseClient";
import { getAssistanceSeo } from "./seo/assistanceMetadata";
import { logUsage } from "./services/usageService";
// ZipCodePage is the landing route — keep it eagerly imported so mobile users see content immediately.
import ZipCodePage from "./views/ZipCodePage";
// Secondary routes are desktop-only and unreachable from mobile (no hamburger/vertical nav).
// Lazy-loading pulls mapbox-gl (Reports) and other heavy deps out of the initial bundle,
// which measurably reduces mobile cold-start parse/compile time.
const ReportsPage = lazy(() => import("./views/ReportsPage"));
const SupportPage = lazy(() => import("./views/SupportPage"));
const AnnouncementsPage = lazy(() => import("./views/AnnouncementsPage"));

// Training reminders: the /find popup (shown after announcements, once per day)
// + the transforming footer "Training Session" button, both driven by
// TrainingProvider. Set false to fully mute (e.g. another round of testing).
const TRAINING_POPUP_ENABLED = true;

// Pop the training modal once per session, on the first /find landing AFTER
// announcements clear, desktop only (mobile uses the footer bar). Fires ONLY on
// the session's own day — advance notice in the week before is handled by the
// chyron above the footer, not the popup. The 0.8s gap breaks the announcement
// "close-close" rhythm so it isn't reflexively dismissed.
const POPUP_GAP_MS = 800;
const POPUP_SHOWN_KEY = "crg_training_popup_shown";

function TrainingPopupTrigger({ announcementsDone }) {
  const { upcomingSession, isToday, openPopup } = useTraining();
  const location = useLocation();

  useEffect(() => {
    if (!announcementsDone) return undefined;
    if (location.pathname !== "/find") return undefined;
    if (!upcomingSession || !isToday) return undefined; // day-of only
    if (window.matchMedia("(max-width: 1023px)").matches) return undefined; // desktop-only modal

    const id = upcomingSession.id_no;
    let shown;
    try {
      shown = new Set(JSON.parse(localStorage.getItem(POPUP_SHOWN_KEY) || "[]"));
    } catch {
      shown = new Set();
    }
    if (shown.has(id)) return undefined;

    const t = setTimeout(() => {
      try {
        shown.add(id);
        localStorage.setItem(POPUP_SHOWN_KEY, JSON.stringify(Array.from(shown)));
      } catch {
        /* best-effort only */
      }
      openPopup();
    }, POPUP_GAP_MS);
    return () => clearTimeout(t);
  }, [announcementsDone, location.pathname, upcomingSession, openPopup]);

  return null;
}

export default function MainApp({ loggedInUser, onLogout }) {
  const location = useLocation();
  const [announcementsDone, setAnnouncementsDone] = useState(false);

  useEffect(() => {
    if (window.gtag) {
      window.gtag("event", "page_view", {
        page_path: location.pathname + location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [location]);

// Health check: run once after login
useEffect(() => {
  let mounted = true;
  (async () => {
    const t0 = performance.now();
    const { error } = await supabase
      .from('zip_codes')
      .select('zip_code')
      .limit(1);
    if (!mounted) return;
    console.log('[health] zip_codes 1-row', {
      ms: Math.round(performance.now() - t0),
      error: error?.message ?? 'none'
    });
  })();
  return () => { mounted = false; };
}, []);

  return (
    <AppDataProvider loggedInUser={loggedInUser} onLogout={onLogout}>
      <TrainingProvider>
        {/* Add ScheduledReload component */}
        <ScheduledReload />
        {/* Announcements show first; onComplete unblocks the training popup */}
        {loggedInUser && (
          <AnnouncementManager
            loggedInUser={loggedInUser}
            onComplete={() => setAnnouncementsDone(true)}
          />
        )}
        {/* Training reminder popup — pops once on the first /find landing of the
            day, AFTER announcements. The transforming footer "Training Session"
            button (Footer.js) is the persistent reminder. Flag-gated above. */}
        {TRAINING_POPUP_ENABLED && (
          <>
            <TrainingPopupTrigger announcementsDone={announcementsDone} />
            <TrainingPopup />
          </>
        )}
        <AppContent loggedInUser={loggedInUser} />
      </TrainingProvider>
    </AppDataProvider>
  );
}

// Separate component for the app content
function AppContent({ loggedInUser }) {
  const { directory, assistance, zipCodes, loading, error } = useAppData();
  const location = useLocation();

  // Pages that don't read directory data shouldn't sit behind the "Loading data..."
  // gate. /support is reached from the standalone About/Privacy/Terms pages (which
  // live outside MainApp); entering MainApp there would otherwise remount the data
  // provider and flash "Loading data..." even though Contact Support never uses that
  // data. Let those pages render immediately while the fetch happens in the background.
  const isDataIndependentPage = location.pathname === "/support";

  // While Phase 1 data (directory, assistance, zipCodes) is still in flight, show a loading
  // screen instead of rendering the app shell with empty data. Without this, users see the
  // Zip Code dropdown and try to click it before the data has arrived — their click appears
  // to stall for several seconds on a slow connection.
  if (loading && !isDataIndependentPage) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-50">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-600">Loading data...</div>
        </div>
      </div>
    );
  }

  // Show error state (but not for data-independent pages like /support, which
  // work fine even if the directory fetch failed).
  if (error && !isDataIndependentPage) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center text-red-600">
          <div className="text-xl font-semibold">Error loading data</div>
          <div className="text-sm mt-2">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <Suspense fallback={null}>
        <Routes>
          <Route
            path="/"
            element={
              <ZipCodePage
                loggedInUser={loggedInUser}
              />
            }
          />
          {/* /find is the public URL for the working ZipCode search page —
              distinct from / (which renders the marketing-style HomePage at
              the App.js layer). Footer's "Organization Login" link points
              here so the modal opens over the actual app. */}
          <Route
            path="/find"
            element={
              <>
                <Helmet>
                  <title>Search Free Houston Resources by Zip Code | Community Resources Guide</title>
                  <meta
                    name="description"
                    content="Free directory of 1,000+ community resources from 526 Houston-area organizations. Search by zip code for food, rent, utilities, medical, legal, and job assistance."
                  />
                  <link rel="canonical" href="https://crghouston.org/find" />
                  <meta property="og:title" content="Search Free Houston Resources by Zip Code | Community Resources Guide" />
                  <meta
                    property="og:description"
                    content="Free directory of 1,000+ community resources from 526 Houston-area organizations. Search by zip code for food, rent, utilities, medical, legal, and job assistance."
                  />
                  <meta property="og:url" content="https://crghouston.org/find" />
                </Helmet>
                <ZipCodePage loggedInUser={loggedInUser} />
              </>
            }
          />
          <Route
            path="/assistance/:slug"
            element={<AssistanceSlugPage loggedInUser={loggedInUser} />}
          />
          <Route
            path="/announcements"
            element={<AnnouncementsPage loggedInUser={loggedInUser} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route
            path="/reports"
            element={<ReportsPage />}
          />
          <Route path="/support" element={<SupportPage loggedInUser={loggedInUser} />} />
        </Routes>
      </Suspense>
    </>
  );
}

// /assistance/:slug — applies the slug → assist_id filter and an optional ?zip=
// param, then renders ZipCodePage. Matches the deep-link plumbing the homepage
// chip links rely on for SEO-friendly URLs.
function AssistanceSlugPage({ loggedInUser }) {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    assistance,
    activeAssistanceChips,
    setActiveAssistanceChips,
    setSelectedZipCode,
    setActiveSearchMode,
  } = useAppData();

  // Tracks whether the entry effect has run at least once. The chip→URL
  // sync effect skips until this flips true so it doesn't navigate based
  // on stale-from-previous-route chip state during the brief window before
  // the entry effect populates chips from the slug.
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!assistance || assistance.length === 0) return;
    // True only on the genuine first landing of this mount (homepage chip,
    // SMS ?guest=1 deep link, or a direct /assistance/<slug> URL). Captured
    // before hasInitialized flips so we can log exactly one search per entry.
    const isFirstLanding = !hasInitialized.current;
    const match = assistance.find((a) => a.url_slug === slug);
    if (match?.assist_id) {
      setActiveAssistanceChips(new Set([String(match.assist_id)]));
    }
    const zip = searchParams.get("zip");
    if (zip) {
      setSelectedZipCode(zip);
      setActiveSearchMode("zipcode");
    }
    // A chip landing is a zip + assistance selection that bypasses the NavBar
    // handlers (we set context directly above), so it would otherwise never be
    // counted in the Search chart. Log one search per landing. Guarded to the
    // first run of this mount: in-app chip toggles change `slug` and re-run
    // this effect, but those are already logged by NavBar3's own handler, so
    // re-logging here would double-count.
    if (isFirstLanding) {
      logUsage({
        reg_organization: loggedInUser?.reg_organization || "Guest",
        action_type: "search",
        search_mode: zip ? "Zip Code" : null,
        assistance_type: match?.assistance || null,
        search_value: zip || null,
      });
    }
    hasInitialized.current = true;
    // We only want to apply the slug/zip on entry. Re-running when the user
    // toggles chips inside the app would clobber their selections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, assistance.length]);

  // Sync URL ↔ chip selection (Option A from the SEO discussion):
  //   - 1 chip with a slug → navigate to /assistance/<that-slug>
  //   - 0 chips, multi-select, or a chip with no slug → navigate to /find
  // Uses replace:true so rapid chip toggling doesn't pollute browser history.
  // Preserves any ?zip= query when staying on /assistance/* routes.
  useEffect(() => {
    if (!hasInitialized.current) return;
    if (!assistance || assistance.length === 0) return;
    if (!activeAssistanceChips) return;

    const chipIds = Array.from(activeAssistanceChips);
    let targetPath;
    if (chipIds.length === 1) {
      const matchingType = assistance.find((a) => String(a.assist_id) === chipIds[0]);
      targetPath = matchingType?.url_slug
        ? `/assistance/${matchingType.url_slug}`
        : "/find";
    } else {
      targetPath = "/find";
    }

    if (targetPath === location.pathname) return;

    const target = targetPath.startsWith("/assistance/")
      ? targetPath + location.search
      : targetPath;
    navigate(target, { replace: true });
  }, [activeAssistanceChips, assistance, location.pathname, location.search, navigate]);

  // Canonical drops the ?zip= param so Google consolidates all zip variants
  // (29 slugs × 269 zips = ~7,800 potential URLs) into the bare slug URL.
  const seo = getAssistanceSeo(slug);
  const canonical = `https://crghouston.org/assistance/${slug}`;

  // Visible page heading. seo.title is "<Topic> | Community Resources Guide";
  // we strip the suffix so the on-page H1 reads as a clean topic heading
  // ("Free Rent Assistance in Houston") rather than echoing the site name.
  const pageH1 = seo.title.split(" | ")[0];

  return (
    <>
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content={canonical} />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
      </Helmet>
      <ZipCodePage loggedInUser={loggedInUser} pageH1={pageH1} />
    </>
  );
}
