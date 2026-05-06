// src/MainApp.js
import React, { lazy, Suspense, useEffect } from "react";
import { useLocation, useParams, useSearchParams, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Helmet } from "react-helmet-async";
// Import Announcement components
import AnnouncementManager from './components/AnnouncementManager';
import ScheduledReload from './components/ScheduledReload';

import { AppDataProvider, useAppData } from "./Contexts/AppDataContext";
import { supabase } from "./supabaseClient";
import { getAssistanceSeo } from "./seo/assistanceMetadata";
// ZipCodePage is the landing route — keep it eagerly imported so mobile users see content immediately.
import ZipCodePage from "./views/ZipCodePage";
// Secondary routes are desktop-only and unreachable from mobile (no hamburger/vertical nav).
// Lazy-loading pulls mapbox-gl (Reports) and other heavy deps out of the initial bundle,
// which measurably reduces mobile cold-start parse/compile time.
const ReportsPage = lazy(() => import("./views/ReportsPage"));
const SupportPage = lazy(() => import("./views/SupportPage"));
const AnnouncementsPage = lazy(() => import("./views/AnnouncementsPage"));

export default function MainApp({ loggedInUser, onLogout }) {
  const location = useLocation();

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
      {/* Add ScheduledReload component */}
      <ScheduledReload />
      {/* Add AnnouncementManager */}
      {loggedInUser && <AnnouncementManager loggedInUser={loggedInUser} />}
      <AppContent loggedInUser={loggedInUser} />
    </AppDataProvider>
  );
}

// Separate component for the app content
function AppContent({ loggedInUser }) {
  const { directory, assistance, zipCodes, loading, error } = useAppData();

  // While Phase 1 data (directory, assistance, zipCodes) is still in flight, show a loading
  // screen instead of rendering the app shell with empty data. Without this, users see the
  // Zip Code dropdown and try to click it before the data has arrived — their click appears
  // to stall for several seconds on a slow connection.
  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-50">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-600">Loading data...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
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
  const {
    assistance,
    setActiveAssistanceChips,
    setSelectedZipCode,
    setActiveSearchMode,
  } = useAppData();

  useEffect(() => {
    if (!assistance || assistance.length === 0) return;
    const match = assistance.find((a) => a.url_slug === slug);
    if (match?.assist_id) {
      setActiveAssistanceChips(new Set([String(match.assist_id)]));
    }
    const zip = searchParams.get("zip");
    if (zip) {
      setSelectedZipCode(zip);
      setActiveSearchMode("zipcode");
    }
    // We only want to apply the slug/zip on entry. Re-running when the user
    // toggles chips inside the app would clobber their selections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, assistance.length]);

  // Canonical drops the ?zip= param so Google consolidates all zip variants
  // (29 slugs × 269 zips = ~7,800 potential URLs) into the bare slug URL.
  const seo = getAssistanceSeo(slug);
  const canonical = `https://crghouston.org/assistance/${slug}`;

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
      <ZipCodePage loggedInUser={loggedInUser} />
    </>
  );
}
