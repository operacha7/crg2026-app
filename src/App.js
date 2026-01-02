// src/App.js
import React, { useState } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LoginPage from "./auth/Login";
import MainApp from "./MainApp";
import { LanguageProvider } from "./Contexts/LanguageContext";

export default function App() {
  const [user, setUser] = useState(null);
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
            element={
              <LanguageProvider loggedInUser={null}>
                <LoginPage onLoginSuccess={setUser} />
              </LanguageProvider>
            }
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