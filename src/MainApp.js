// src/MainApp.js
import React, { lazy, Suspense, useEffect } from "react";
import { useLocation, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
// Import Announcement components
import AnnouncementManager from './components/AnnouncementManager';
import ScheduledReload from './components/ScheduledReload';

import { AppDataProvider, useAppData } from "./Contexts/AppDataContext";
import { supabase } from "./supabaseClient";
// ZipCodePage is the landing route — keep it eagerly imported so mobile users see content immediately.
import ZipCodePage from "./views/ZipCodePage";
// Secondary routes are desktop-only and unreachable from mobile (no hamburger/vertical nav).
// Lazy-loading pulls mapbox-gl (Reports) and other heavy deps out of the initial bundle,
// which measurably reduces mobile cold-start parse/compile time.
const ReportsPage = lazy(() => import("./views/ReportsPage"));
const LegalPage = lazy(() => import("./views/LegalPage"));
const SupportPage = lazy(() => import("./views/SupportPage"));
const AnnouncementsPage = lazy(() => import("./views/AnnouncementsPage"));

export default function MainApp({ loggedInUser }) {
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
    <AppDataProvider loggedInUser={loggedInUser}>
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
          <Route
            path="/announcements"
            element={<AnnouncementsPage loggedInUser={loggedInUser} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route
            path="/reports"
            element={<ReportsPage />}
          />
          <Route path="/privacy" element={<LegalPage loggedInUser={loggedInUser} />} />
          <Route path="/support" element={<SupportPage loggedInUser={loggedInUser} />} />
        </Routes>
      </Suspense>
    </>
  );
}
