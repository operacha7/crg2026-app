// src/App.js
import React, { useState, lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LoginPage from "./auth/Login";
// MainApp (and everything it transitively imports — NavBars, ZipCodePage, email service,
// Supabase client) is lazy-loaded so the login screen ships with a much smaller initial
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

export default function App() {
  const location = useLocation();

  // Check for ?guest=1 deep link (SMS share links auto-login as guest)
  const searchParams = new URLSearchParams(location.search);
  const isDeepLink = searchParams.get("guest") === "1";

  // In dev mode with bypass enabled, start with mock user
  // Deep links with ?guest=1 also auto-login as guest
  const [user, setUser] = useState(() => {
    if (DEV_BYPASS_LOGIN) return DEV_USER;
    if (isDeepLink) return { id: 'guest', organization: 'Guest', isGuest: true, canEmail: false, canPdf: false };
    return null;
  });

  // Preserve UTM parameters during redirect
  const getLoginPath = () => {
    const searchParams = new URLSearchParams(location.search);
    const utmParams = new URLSearchParams();

    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith("utm_")) {
        utmParams.append(key, value);
      }
    }

    const utmString = utmParams.toString();
    return utmString ? `/login?${utmString}` : "/login";
  };

  return (
    <HelmetProvider>
      <div className="font-opensans">
        <Routes>
          {/* Login Route */}
          <Route
            path="/login"
            element={<LoginPage onLoginSuccess={setUser} />}
          />

          {/* Main App Route (requires login) */}
          <Route
            path="/*"
            element={
              user ? (
                <Suspense fallback={null}>
                  <MainApp loggedInUser={user} />
                </Suspense>
              ) : (
                <Navigate to={getLoginPath()} replace />
              )
            }
          />
        </Routes>
      </div>
    </HelmetProvider>
  );
}
