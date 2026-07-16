// src/views/NewsPage.js
// Public "Weekly Briefing" — the news feed of published Opportunity Scan
// findings. Aggregator pattern (Google/Yahoo News style): CRG's OWN headline and
// summary, with the SOURCE as the outbound link. We never republish article text
// or imagery — see the copyright rules in the plan.
//
// Data comes from the /news-feed Cloudflare Function (server-side read) — the
// scan_findings table is never exposed to the browser. (The function is named
// /news-feed, not /news, so it doesn't shadow this page's /news route, and it
// must stay listed in vite.config.mjs's dev proxy.)
//
// Layout: maroon page (the public-page color, matching Home/Training) with a
// white panel per category. Inside a panel, each story is headline-LEFT /
// detail-RIGHT — a pure headline scan column for caseworkers triaging — which
// collapses to stacked on mobile (this page is public + an SEO surface, so it
// does get phone traffic, unlike the desktop-only secondary routes).
//
// The "View this resource in CRG" link is the SAME mechanism announcements use:
// an internal /find?ids=N anchor intercepted by useResourceLinkHandler, which
// runs the equivalent "Show me id_no N" Ask-a-Question search.

import React, { useEffect, useState } from "react";
import VerticalNavBar from "../layout/VerticalNavBar";
import Footer from "../layout/Footer";
import useResourceLinkHandler from "../hooks/useResourceLinkHandler";
import { groupByCategory } from "../data/newsCategories";
import { getIconByName } from "../icons/iconMap";

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function NewsStory({ item }) {
  const meta = [
    item.county && `${item.county} County`,
    item.org_name,
    formatDate(item.created_at),
  ].filter(Boolean);

  return (
    <div className="grid gap-x-7 gap-y-2 md:grid-cols-[38%_1fr] px-6 py-5 transition-colors hover:bg-gray-50">
      {/* LEFT — the scan column: nothing but the headline. */}
      <h3
        style={{
          fontSize: "19px",
          fontWeight: 600,
          lineHeight: 1.3,
          color: "var(--color-text-primary)",
        }}
      >
        {item.title}
      </h3>

      {/* RIGHT — source link, our summary, then the supporting detail. */}
      <div>
        <div className="flex flex-wrap items-center" style={{ gap: "8px", marginBottom: "4px" }}>
          {item.source_url ? (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:brightness-125"
              style={{ fontSize: "13px", fontWeight: 700, color: "#0066cc", textDecoration: "none" }}
            >
              {item.source || "Read the story"}
            </a>
          ) : (
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-secondary)" }}>
              {item.source}
            </span>
          )}
          {item.paywalled && (
            <span style={{ fontSize: "11px", color: "#B8001F" }}>🔒 behind paywall</span>
          )}
        </div>

        <p style={{ fontSize: "14.5px", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
          {item.summary}
        </p>

        {item.deadline && (
          <div style={{ marginTop: "8px" }}>
            <span
              style={{
                display: "inline-block",
                backgroundColor: "#B8001F",
                color: "#FFFFFF",
                fontSize: "11.5px",
                fontWeight: 700,
                letterSpacing: "0.02em",
                padding: "3px 10px",
                borderRadius: "999px",
              }}
            >
              {item.deadline}
            </span>
          </div>
        )}

        {/* Omar's editorial note. Highlighted rather than plain italics — a note
            is only ever added to flag something important, so it must not blend
            into the summary. Reuses the gold treatment ResultRow already gives
            hours_notes (same "read this bit" vocabulary). */}
        {item.notes && (
          <p
            style={{
              display: "inline-block",
              fontSize: "13.5px",
              fontStyle: "italic",
              fontWeight: 600,
              color: "#222831",
              backgroundColor: "var(--color-results-hours-notes-bg)",
              padding: "4px 10px",
              borderRadius: "5px",
              marginTop: "8px",
            }}
          >
            {item.notes}
          </p>
        )}

        {meta.length > 0 && (
          <p style={{ fontSize: "12.5px", color: "var(--color-text-secondary)", marginTop: "8px" }}>
            {meta.join(" · ")}
          </p>
        )}

        {/* Internal — intercepted by useResourceLinkHandler on the container. */}
        {item.directory_id_no && (
          <a
            href={`/find?ids=${item.directory_id_no}`}
            className="hover:brightness-125"
            style={{
              display: "inline-block",
              marginTop: "8px",
              fontSize: "13.5px",
              fontWeight: 700,
              color: "#228B22",
              textDecoration: "none",
            }}
          >
            View this resource in CRG →
          </a>
        )}
      </div>
    </div>
  );
}

function CategoryPanel({ section }) {
  const Icon = getIconByName(section.icon);
  const count = section.items.length;

  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "22px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
      }}
    >
      {/* Panel header — category accent + its assistance icon. */}
      <header
        className="flex items-center justify-between"
        style={{ backgroundColor: section.accent, padding: "10px 20px" }}
      >
        <div className="flex items-center" style={{ gap: "10px" }}>
          {Icon && <Icon size={24} color="#222831" />}
          <h2
            className="font-opensans"
            style={{
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "#222831",
            }}
          >
            {section.label}
          </h2>
        </div>
        <span className="font-opensans" style={{ fontSize: "12.5px", color: "#222831", opacity: 0.75 }}>
          {count} {count === 1 ? "story" : "stories"}
        </span>
      </header>

      {/* Stories, separated by thin lines. */}
      <div className="font-opensans">
        {section.items.map((item, i) => (
          <div key={item.id} style={i > 0 ? { borderTop: "1px solid #E8E6E1" } : undefined}>
            <NewsStory item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

const NewsPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // One handler on the container catches the internal /find?ids= anchors.
  const handleResourceLinkClick = useResourceLinkHandler();

  useEffect(() => {
    let cancelled = false;
    fetch("/news-feed")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) throw new Error(data.error || "Failed to load news");
        setItems(data.items || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = groupByCategory(items);

  // "Updated" = the newest item's date. Honest: a single scan date would
  // misrepresent pinned/continuous items that outlive their run.
  const updatedAt = items.length
    ? formatDate(
        items.reduce((max, i) => (i.created_at > max ? i.created_at : max), items[0].created_at)
      )
    : "";

  return (
    <div className="h-screen flex flex-row overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* NavBar1 — header */}
        <nav
          className="bg-navbar1-bg flex items-center justify-between"
          style={{
            height: "var(--height-navbar1)",
            paddingLeft: "var(--padding-navbar1-left)",
            paddingRight: "var(--padding-navbar1-right)",
          }}
        >
          <div className="flex items-center" style={{ gap: "var(--gap-navbar1-logo-title)" }}>
            <img
              src="/images/CRG Logo 2025.webp"
              alt="CRG Logo"
              style={{ width: "var(--size-navbar1-logo)", height: "var(--size-navbar1-logo)" }}
              className="object-contain"
            />
            <h1
              className="text-navbar1-title font-comfortaa"
              style={{
                fontSize: "var(--font-size-navbar1-title)",
                fontWeight: "var(--font-weight-navbar1-title)",
                letterSpacing: "var(--letter-spacing-navbar1-title)",
              }}
            >
              Community Resources Guide Houston
            </h1>
          </div>

          <span
            className="font-opensans"
            style={{
              color: "var(--color-navbar1-section-title)",
              fontSize: "var(--font-size-navbar1-btn)",
              fontWeight: "var(--font-weight-navbar1-btn)",
              letterSpacing: "var(--letter-spacing-navbar1-btn)",
            }}
          >
            News
          </span>
        </nav>

        {/* Feed — maroon page, matching the other public pages (Home/Training). */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: "var(--color-training-main-bg)", padding: "30px 24px 40px" }}
          onClick={handleResourceLinkClick}
        >
          <div style={{ maxWidth: "980px", margin: "0 auto" }}>
            <header style={{ marginBottom: "22px" }}>
              <h2
                className="font-opensans"
                style={{ fontSize: "30px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.01em" }}
              >
                Weekly Briefing
              </h2>
              <p
                className="font-opensans"
                style={{ fontSize: "13px", color: "#E8D9D9", marginTop: "5px", maxWidth: "760px" }}
              >
                {updatedAt && <>Updated {updatedAt}. </>}
                Assistance news from across the 15-county Houston region. Headlines and summaries are
                written by CRG; each source link opens the original story on the publisher's site.
              </p>
            </header>

            {loading && (
              <div className="font-opensans" style={{ color: "#E8D9D9" }}>
                Loading news…
              </div>
            )}

            {error && (
              <div className="font-opensans" style={{ color: "#FFC857" }}>
                Could not load news: {error}
              </div>
            )}

            {!loading && !error && sections.length === 0 && (
              <div className="font-opensans" style={{ color: "#E8D9D9" }}>
                No news items right now. Check back after the next weekly briefing.
              </div>
            )}

            {sections.map((section) => (
              <CategoryPanel key={section.key} section={section} />
            ))}
          </div>
        </main>

        <Footer />
      </div>

      <VerticalNavBar />
    </div>
  );
};

export default NewsPage;
