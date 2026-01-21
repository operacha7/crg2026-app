// src/MainApp.js
import { createClient } from "@supabase/supabase-js";
import React from "react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, Routes } from "react-router-dom";
// Import Announcement components
import AnnouncementManager from './components/AnnouncementManager';
import ScheduledReload from './components/ScheduledReload';

import { AppDataProvider, useAppData } from "./Contexts/AppDataContext";
import ZipCodePage from "./views/ZipCodePage";
import ReportsPage from "./views/ReportsPage";
import LegalPage from "./views/LegalPage";
import SupportPage from "./views/SupportPage";
import AnnouncementsPage from "./views/AnnouncementsPage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;


export const supabase = createClient(supabaseUrl, supabaseKey);

// Prewarm Supabase on app start
supabase
  .from('zip_codes')
  .select('zip_code')
  .limit(1)
  .then(() => console.log('Supabase prewarm complete'))
  .catch(err => console.error('Prewarm error:', err));

// Test the connection when the file loads
console.log("Testing Supabase connection on load...");
supabase
  .from("app_usage_logs")
  .select("count", { count: "exact", head: true })
  .then((response) => {
    console.log("Connection test response:", response);
  })
  .catch((error) => {
    console.error("Connection test error:", error);
  });

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
  // Use the new AppDataContext (replaces legacy useFetchCRGData)
  const { directory, assistance, zipCodes, loading, error } = useAppData();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
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
    </>
  );
}
