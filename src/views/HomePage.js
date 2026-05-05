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
        <title>CRG Houston — Free help across Greater Houston</title>
        <meta
          name="description"
          content="Free online directory of 1,000+ community resources from 526 organizations across the Greater Houston Area. Find rent, utilities, food, clothing, and more."
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
              borderRadius: 14,
              padding: "24px 26px",
              width: 580,
              maxWidth: "100%",
              boxShadow: "0 6px 24px rgba(0, 0, 0, 0.18)",
            }}
          >
            <h1
              className="font-opensans"
              style={{
                color: "var(--color-home-h1)",
                fontSize: "clamp(22px, 2.4vw, 36px)",
                fontWeight: 700,
                marginBottom: 10,
                lineHeight: 1.2,
              }}
            >
              Free help across<br />Greater Houston
            </h1>
            <p
              className="font-opensans"
              style={{
                color: "var(--color-home-h1)",
                fontSize: 18,
                lineHeight: 1.5,
                marginBottom: 18,
              }}
            >
              Quickly search through 1000+ resources to find help in your area.
              Select a <em>zip code</em> and an <em>assistance type</em> from below.
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
                className="font-opensans"
                style={{
                  background: "var(--color-home-zip-dropdown-bg)",
                  color: "var(--color-home-zip-dropdown-text)",
                  border: "none",
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontSize: 18,
                  fontWeight: 600,
                  minWidth: 200,
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
