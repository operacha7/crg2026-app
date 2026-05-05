// src/views/TermsPage.js
// Public /terms page — same shell as AboutPage and PrivacyPage. Renders shared
// TERMS_OF_SERVICE_HTML through the global `.legal-content` styles in
// src/index.css.

import React from "react";
import { Helmet } from "react-helmet-async";
import HomeNavBar from "../layout/HomeNavBar";
import Footer from "../layout/Footer";
import { TERMS_OF_SERVICE_HTML } from "./legalContent";

export default function TermsPage() {
  return (
    <div className="min-h-dvh lg:h-dvh flex flex-col lg:overflow-hidden">
      <Helmet>
        <title>Terms of Service | CRG Houston</title>
        <meta
          name="description"
          content="Terms governing use of the Community Resources Guide directory."
        />
        <link rel="canonical" href="https://crghouston.org/terms" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crghouston.org/terms" />
        <meta property="og:title" content="Terms of Service | CRG Houston" />
        <meta
          property="og:description"
          content="Terms governing use of the Community Resources Guide directory."
        />
      </Helmet>

      <HomeNavBar />

      <main
        className="flex-1 flex flex-col items-center lg:overflow-y-auto"
        style={{
          backgroundColor: "var(--color-home-right-area-bg)",
          paddingTop: 40,
          paddingBottom: 40,
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <article
          className="legal-content"
          style={{
            background: "var(--color-home-panel-bg)",
            borderRadius: 14,
            padding: "32px 36px",
            width: 800,
            maxWidth: "100%",
            boxShadow: "0 6px 24px rgba(0, 0, 0, 0.18)",
            fontFamily: "var(--font-family-body)",
          }}
          dangerouslySetInnerHTML={{ __html: TERMS_OF_SERVICE_HTML }}
        />
      </main>

      <Footer />
    </div>
  );
}
