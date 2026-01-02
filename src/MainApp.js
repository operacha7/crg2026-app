// src/MainApp.js
import { createClient } from "@supabase/supabase-js";
import React from "react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, Routes } from "react-router-dom";
import { LanguageProvider } from './Contexts/LanguageContext';
import { TourProvider } from './Contexts/TourProvider';
import TourOverlay from './Contexts/TourOverlay';

// Import Announcement components
import AnnouncementManager from './components/AnnouncementManager';
import ScheduledReload from './Utility/ScheduledReload';

import useFetchCRGData from "./data/FetchDataSupabase";
import GeneralSearchPage from "./views/GeneralSearchPage";
import OrganizationPage from "./views/OrganizationPage";
import ZipCodePage from "./views/ZipCodePage";
import StatisticsPage from "./views/StatisticsPage.js";
import PrivacyPolicy from "./views/PrivacyPolicy";
import TermsOfService from "./views/TermsOfService";
import SupportPage from "./views/SupportPage";
import MessagesPage from "./views/MessagesPage"; // Import the new MessagesPage

const supabaseUrl = "https://ycxepglcrqhwwlfufyhk.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljeGVwZ2xjcnFod3dsZnVmeWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3Njg1OTQsImV4cCI6MjA2MTM0NDU5NH0.ZmLjfJ-biPSs8E5OYYJD8Fv9Cme2Njuug04b2N--fyM";


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
    <TourProvider>
      <LanguageProvider loggedInUser={loggedInUser}>
        {/* Add ScheduledReload component */}
        <ScheduledReload />
        {/* Add AnnouncementManager */}
        {loggedInUser && <AnnouncementManager loggedInUser={loggedInUser} />}
        <AppContent loggedInUser={loggedInUser} />
        <TourOverlay />
      </LanguageProvider>
    </TourProvider>
  );
}

// Separate component for the app content
function AppContent({ loggedInUser }) {
  // Use the data fetching hook
  const { records, zips, assistanceTypes, neighborhoodData } = useFetchCRGData();
  
  // Debug log
  React.useEffect(() => {
    console.log("MainApp received neighborhoodData:", neighborhoodData);
  }, [neighborhoodData]);
  
  return (
    <>
      <Toaster position="top-center" />
      <Routes>
        <Route
          path="/"
          element={
            <ZipCodePage
              records={records}
              zips={zips}
              assistanceTypes={assistanceTypes}
              loggedInUser={loggedInUser}
            />
          }
        />
        <Route
          path="/organization"
          element={<OrganizationPage loggedInUser={loggedInUser} />}
        />
        <Route
          path="/search"
          element={
            <GeneralSearchPage
              records={records}
              neighborhoodData={neighborhoodData}
              assistanceTypes={assistanceTypes}
              loggedInUser={loggedInUser}
            />
          }
        />
        <Route
          path="/messages" // Add new route for Messages page
          element={<MessagesPage loggedInUser={loggedInUser} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route
          path="/reports"
          element={<StatisticsPage loggedInUser={loggedInUser} />}
        />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/support" element={<SupportPage loggedInUser={loggedInUser} />} />
      </Routes>
    </>
  );
}