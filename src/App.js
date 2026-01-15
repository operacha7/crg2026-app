// src/App.js
import React, { useState } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LoginPage from "./auth/Login";
import MainApp from "./MainApp";

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
  // In dev mode with bypass enabled, start with mock user
  const [user, setUser] = useState(DEV_BYPASS_LOGIN ? DEV_USER : null);
  const location = useLocation();

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
                <MainApp loggedInUser={user} />
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
