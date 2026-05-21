// src/views/HomePage.js
// Public homepage. Replaces the login-as-homepage with a chips-based search entry:
// background artwork on the left, white hero panel on the right with H1, zip
// dropdown, and category-grouped assistance-type chips that link to
// /assistance/[slug]. Site-wide footer (secondary tier + red copyright) renders here too.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { dataService } from "../services/dataService";
import HomeNavBar from "../layout/HomeNavBar";
import Footer from "../layout/Footer";
import AnimatedCounter from "../components/AnimatedCounter";

// Category-to-border-color mapping. Indexed by the order categories first appear
// in the assistance table (sorted by id_no). Skips the cyan group5 token per the
// approved 5-color homepage palette: yellow → purple → pink → green → orange.
const CATEGORY_COLORS = [
  "var(--color-assistance-group1)",
  "var(--color-assistance-group2)",
  "var(--color-assistance-group3)",
  "var(--color-assistance-group4)",
  "var(--color-assistance-group6)",
];

export default function HomePage() {
  const [assistance, setAssistance] = useState([]);
  const [zipCodes, setZipCodes] = useState([]);
  const [selectedZip, setSelectedZip] = useState("");
  // Block the panel from rendering until BOTH Supabase queries return — without
  // this gate the panel mounts immediately with empty data and then "flashes"
  // when chips and zip options pop in once the queries complete. We still
  // render the page chrome (navbar, artwork, maroon bg, footer) so the user
  // sees the layout instantly.
  const [loading, setLoading] = useState(true);
  // Live directory row count for the H2 chip. Null until the count query
  // resolves, at which point we swap the static "1,000+" fallback for the
  // animated counter. Kept separate from the assistance/zips load gate so a
  // slow count query can't block the panel from rendering.
  const [directoryCount, setDirectoryCount] = useState(null);

  useEffect(() => {
    Promise.all([dataService.getAssistance(), dataService.getZipCodes()])
      .then(([a, z]) => {
        setAssistance(a || []);
        setZipCodes(z || []);
      })
      .catch((err) => {
        console.error("HomePage data load error", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    dataService
      .getDirectoryCount()
      .then((c) => {
        if (typeof c === "number") setDirectoryCount(c);
      })
      .catch((err) => console.error("HomePage count load error", err));
  }, []);

  // Prefetch the MainApp chunk in parallel with the homepage's own data
  // fetch. Almost every homepage visitor either clicks an assistance chip
  // (→ /assistance/[slug] inside MainApp) or logs in (→ /find inside
  // MainApp), so we pay the chunk-download cost now while the user reads
  // the page rather than after they click. The lazy() in App.js shares the
  // browser's chunk cache, so the second import resolves instantly.
  // .catch() swallows the rejection — a failed prefetch is recoverable
  // (lazy() will just re-fetch on demand) and shouldn't surface as an
  // unhandled promise rejection.
  useEffect(() => {
    import("../MainApp").catch(() => {});
  }, []);

  // Group assistance rows by `category`, preserving the order each category
  // first appears in (assistance table is ordered by id_no).
  const categories = useMemo(() => {
    const cats = [];
    const indexByName = new Map();
    for (const item of assistance) {
      if (!item.category || !item.url_slug) continue;
      if (!indexByName.has(item.category)) {
        indexByName.set(item.category, cats.length);
        cats.push({ name: item.category, items: [] });
      }
      cats[indexByName.get(item.category)].items.push(item);
    }
    return cats;
  }, [assistance]);

  const buildChipHref = (slug) =>
    selectedZip ? `/assistance/${slug}?zip=${selectedZip}` : `/assistance/${slug}`;

  return (
    <div className="min-h-dvh lg:h-dvh flex flex-col lg:overflow-hidden">
      <Helmet>
        <title>CRG Houston — Free help &amp; community resources across the Houston region</title>
        <meta
          name="description"
          content="Free directory of 1,000+ verified community assistance programs across 14 Southeast Texas counties — Harris, Fort Bend, Galveston, Montgomery, and more. Search by zip code and assistance type."
        />
        <link rel="canonical" href="https://crghouston.org/" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crghouston.org/" />
        <meta property="og:title" content="CRG Houston — Free help &amp; community resources across the Houston region" />
        <meta
          property="og:description"
          content="Free directory of 1,000+ verified community assistance programs across 14 Southeast Texas counties — Harris, Fort Bend, Galveston, Montgomery, and more. Search by zip code and assistance type."
        />
      </Helmet>

      <HomeNavBar />

      <main
        className="flex-1 relative flex flex-col lg:flex-row lg:justify-end lg:items-start lg:overflow-y-auto"
        style={{
          backgroundColor: "var(--color-home-right-area-bg)",
        }}
      >
        {/* Background artwork on desktop: bg-contain (NOT cover) so the
            painting keeps its natural display size. As the viewport widens
            the painting stays put and maroon page-bg fills the empty space
            on the right (panel ends up sitting ON the maroon, off the
            painting). As the viewport narrows the painting scales down and
            the panel slides over it. Hidden on mobile. */}
        <div
          className="hidden lg:block absolute inset-0 bg-no-repeat"
          style={{
            backgroundImage: "url('/images/CRG Background NEW 2025.webp')",
            backgroundSize: "contain",
            backgroundPosition: "left center",
          }}
        />

        {/* Panel container — sits on top of main's bg-image+maroon-bg layer.
            Anchored to the top-right edge of main on desktop via the parent's
            flex justify-end items-start. On mobile, fills the available width
            and stacks below the (hidden) artwork area.

            Hidden while Supabase queries are in flight to prevent the
            "first zip section, then chips flash in" layout shift. */}
        {!loading && (
        <div
          className="relative w-full lg:w-auto flex flex-col items-center"
          style={{
            paddingTop: 30,
            paddingBottom: 30,
            paddingLeft: 16,
            paddingRight: 50,
          }}
        >
          <div
            style={{
              background: "var(--color-home-panel-bg)",
              border: "6px solid #4A4F56",
              borderRadius: 14,
              padding: "24px 26px",
              width: 620,
              maxWidth: "100%",
            }}
          >
            <h1
              className="font-opensans"
              style={{
                color: "#1A1A1A",
                fontSize: 28,
                fontWeight: 700,
                marginBottom: 30,
                lineHeight: 1.2,
              }}
            >
              Free help &amp; Community Resources Across the Houston Region
            </h1>

            {/* H2: live directory-row count inside an orange chip.
                Until the count query resolves we render a static "1,000+"
                span so crawlers always see a concrete number in the rendered
                HTML and there's no blank chip on first paint. */}
            <h2
              className="font-opensans"
              style={{
                color: "#4A4A4A",
                fontSize: 20,
                fontWeight: 600,
                marginBottom: 18,
                lineHeight: 1.3,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>Connecting You to</span>
              {typeof directoryCount === "number" ? (
                <AnimatedCounter
                  className="font-opensans"
                  value={directoryCount}
                  duration={1200}
                  glowColor="rgba(235, 110, 31, 0.6)"
                  style={{
                    background: "#EB6E1F",
                    color: "#FFFFFF",
                    fontSize: 20,
                    fontWeight: 500,
                    padding: "2px 12px",
                    borderRadius: 999,
                    lineHeight: 1.3,
                    minWidth: 60,
                    textAlign: "center",
                    letterSpacing: "0.07em",
                  }}
                />
              ) : (
                <span
                  style={{
                    background: "#EB6E1F",
                    color: "#FFFFFF",
                    fontSize: 20,
                    fontWeight: 600,
                    padding: "2px 12px",
                    borderRadius: 999,
                    lineHeight: 1.3,
                    letterSpacing: "0.07em",
                  }}
                >
                  1,000+
                </span>
              )}
              <span>Verified Assistance Programs</span>
            </h2>

            <p
              className="font-opensans"
              style={{
                color: "#2D3D3D",
                fontSize: 16,
                lineHeight: 1.65,
                marginBottom: 10,
              }}
            >
              <strong>Serving 14 Southeast Texas Counties:</strong>{" "}
              Austin, Brazoria, Chambers, Fort Bend, Galveston, Grimes, Harris,
              Liberty, Matagorda, Montgomery, Walker, Waller and Wharton
            </p>

            <p
              className="font-opensans"
              style={{
                color: "#B8001F",
                fontSize: 16,
                fontStyle: "italic",
                lineHeight: 1.5,
                marginBottom: 10,
              }}
            >
              Start by selecting a zip code and assistance from below:
            </p>

            {/* Zip code panel */}
            <div
              className="mb-3"
              style={{
                background: "var(--color-home-panel-inner-bg)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <label
                htmlFor="home-zip"
                className="font-opensans block"
                style={{
                  color: "var(--color-home-label)",
                  fontSize: 15,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Select Your Zip Code
              </label>
              <select
                id="home-zip"
                value={selectedZip}
                onChange={(e) => setSelectedZip(e.target.value)}
                className="font-opensans w-full lg:w-auto lg:min-w-[200px] box-border"
                style={{
                  background: "var(--color-home-zip-dropdown-bg)",
                  color: "var(--color-home-zip-dropdown-text)",
                  border: "none",
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontSize: 18,
                  fontWeight: 600,
                  maxWidth: "100%",
                }}
              >
                <option value="">— Select —</option>
                {zipCodes
                  .filter((z) => z.houston_area === "Y")
                  .map((z) => (
                    <option key={z.id_no} value={z.zip_code}>
                      {z.zip_code}
                      {z.city ? ` — ${z.city}` : ""}
                    </option>
                  ))}
              </select>
            </div>

            {/* Assistance-type panel */}
            <div
              style={{
                background: "var(--color-home-panel-inner-bg)",
                borderRadius: 8,
                padding: "14px",
              }}
            >
              <h2
                className="font-opensans"
                style={{
                  color: "var(--color-home-label)",
                  fontSize: 15,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                Choose an Assistance Type
              </h2>

              <div className="flex flex-col" style={{ gap: 14 }}>
                {categories.map((cat, idx) => {
                  const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                  const isBasicNeeds = cat.name === "Basic Needs";
                  return (
                    <CategoryGroup
                      key={cat.name}
                      name={cat.name}
                      color={color}
                      panelBg="var(--color-home-panel-inner-bg)"
                    >
                      <div className="flex flex-wrap" style={{ gap: 6 }}>
                        {cat.items.map((item) => (
                          <Link
                            key={item.assist_id}
                            to={buildChipHref(item.url_slug)}
                            className="hover:brightness-95 inline-flex items-center justify-center"
                            style={{
                              background: "var(--color-home-chip-bg)",
                              color: "var(--color-home-chip-text)",
                              border: "1px solid #000",
                              borderRadius: 999,
                              padding: isBasicNeeds ? "7px 16px" : "4px 11px",
                              fontFamily: "var(--font-family-body)",
                              fontSize: isBasicNeeds ? 15 : 12,
                              fontWeight: isBasicNeeds ? 600 : 500,
                              textDecoration: "none",
                              lineHeight: 1.2,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.assistance}
                          </Link>
                        ))}
                      </div>
                    </CategoryGroup>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

// Group container with a colored border that "breaks" around the label.
// Implementation: the label is absolutely positioned over the top border with
// a background matching the surrounding panel, masking the part of the border
// behind it. Cleaner than fieldset/legend (Tailwind preflight resets those).
function CategoryGroup({ name, color, panelBg, children }) {
  return (
    <div style={{ position: "relative", marginTop: 6 }}>
      <div
        style={{
          border: `2px solid ${color}`,
          borderRadius: 8,
          padding: "16px 12px 12px",
        }}
      >
        {children}
      </div>
      <span
        style={{
          position: "absolute",
          top: -8,
          left: 14,
          padding: "0 6px",
          background: panelBg,
          color,
          fontFamily: "var(--font-family-body)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        {name}
      </span>
    </div>
  );
}
