// src/layout/Footer.js
// Two-tier site-wide footer:
//   1. Secondary tier with public links (Training, About, Privacy, Terms, Support, Org Login)
//   2. Red copyright bar (unchanged from prior versions)
// Renders on every page — homepage, public pages, and in-app.
//
// The chyron above the teal tier carries the NEWS feed — published Opportunity
// Scan headlines on a continuous loop, click → /news. It previously carried the
// training advance notice; that was handed over deliberately (July 2026). Only
// the chyron changed — every other part of Training is untouched.
//
// Training notice (in-app, where TrainingProvider is mounted):
//   - In the WEEK BEFORE a session: the teal tier's "Training" link becomes the
//     amber pulsing beacon link. NOTE: the teal tier is desktop-only, so since
//     the chyron went to news there is no week-before notice on mobile; mobile
//     still gets the day-of bar below.
//   - On the session's OWN DAY: the "Training" link transforms into the enlarged
//     "Training Session — …" button carrying the live state (gray/yellow/green/
//     orange) that glow-pulses on green/orange. The teal tier auto-grows for it.
// Public pages (no provider) show the plain "Training" link only. On mobile the
// teal tier is hidden, so the day-of button appears as a full-width bar above the
// copyright line.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { USFlagIcon } from "../icons";
import { useTraining } from "../Contexts/TrainingContext";
import { sessionToInstants, formatCountdown } from "../utils/calendar";

const SECONDARY_LINKS = [
  { label: "Training", to: "/training" },
  { label: "About", to: "/about" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Service", to: "/terms" },
  { label: "Contact Support", to: "/support" },
  // "Organization Login" uses a relative `?login=1` link so the modal opens on
  // the current page rather than navigating to /find first. App.js's LoginModal
  // listens for ?login=1.
  { label: "Organization Login", to: "?login=1" },
];

// Glow ring color (rgb triplet for the .training-pulse keyframe) for the live state.
const GLOW = { live: "8, 255, 8" };

// Amber "emergency beacon" used on the teal-footer Training link whenever a
// session is in the look-ahead window (a slow pulse — deliberately well under the
// 3-flashes/sec photosensitivity limit; disabled entirely by prefers-reduced-
// motion via .training-pulse). #FFB302 as an rgb triplet for the glow keyframe.
const BEACON_AMBER = "#FFB302";
const BEACON_RGB = "255, 179, 2";

// Button fill/text tokens per state (shared with the SessionCard Join button).
// `future` uses the same blue as the panel's "Add to Calendar" button (gray is
// no longer used anywhere in the Training UI).
function trainingColors(state) {
  const map = {
    future: { bg: "var(--color-training-join-add-bg)", color: "var(--color-training-join-add-text)" },
    live: { bg: "var(--color-training-join-live-bg)", color: "var(--color-training-join-live-text)" },
  };
  return map[state] || map.future;
}

// Suffix after "Training Session — ": the bare countdown for the gray future
// state ("2h 14m" / "20m"), or the join label once the green window opens.
function trainingSuffix(state, startMs, now) {
  if (state === "live") return "Join Now";
  return formatCountdown(startMs, now).replace(/^Starts\s+/, "");
}

// Day-of "Training Session — …" button. `fullWidth` is the mobile bar variant;
// otherwise it's the inline enlarged button in the teal tier.
function TrainingFooterButton({ session, state, now, fullWidth, buttonRef }) {
  const { start } = sessionToInstants(session);
  const colors = trainingColors(state);
  const pulse = state === "live";
  return (
    <Link
      to="/training"
      ref={buttonRef}
      className={`hover:brightness-110 ${pulse ? "training-pulse" : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: fullWidth ? 44 : 40,
        padding: "0 18px",
        borderRadius: fullWidth ? 0 : 8,
        fontWeight: 700,
        fontSize: 14,
        background: colors.bg,
        color: colors.color,
        textDecoration: "none",
        whiteSpace: "nowrap",
        ...(fullWidth ? { width: "100%" } : {}),
        ...(pulse
          ? { "--training-glow-rgb": GLOW[state] }
          : { boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }),
      }}
    >
      Training Session — {trainingSuffix(state, start?.getTime(), now)}
    </Link>
  );
}

// Chyron scroll speed. THE readability dial: raise to scroll faster, lower to
// linger. 60px/s reads comfortably; much past ~90 the headlines start to blur.
// A full loop therefore takes longer on busy weeks — correct for a ticker, which
// repeats anyway.
const CHYRON_SPEED_PX_PER_SEC = 60;

// Published news headlines are fetched ONCE per page load and shared — Footer is
// mounted per page, so without this cache every navigation would refetch.
let newsHeadlinesPromise = null;
function fetchNewsHeadlines() {
  newsHeadlinesPromise ||= fetch("/news-feed")
    .then((res) => res.json())
    .then((data) => (data.ok ? data.items || [] : []))
    // The chyron is decorative-adjacent: a feed failure must never break the
    // footer on every page. Fall back to rendering nothing.
    .catch(() => []);
  return newsHeadlinesPromise;
}

// News chyron — the ticker above the teal tier. Scrolls the current published
// headlines on a continuous loop; the whole bar links to /news. Charcoal (not
// the Training amber) so it can't be mistaken for the training beacon, with a
// gold "NEWS" badge pinned at the left as a stable identifier.
// Renders nothing when there's no published news. Reduced-motion users get a
// static label instead of a scroll (the full headline reel would overflow).
function NewsChyron() {
  const [items, setItems] = useState([]);
  const trackRef = useRef(null);
  const [duration, setDuration] = useState(null);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    let cancelled = false;
    fetchNewsHeadlines().then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hold the scroll SPEED constant instead of the duration. The keyframe travels
  // 100vw + the track's own width, so a fixed duration silently turns "how many
  // stories are published" into "how fast they scroll" — a busy week becomes
  // unreadable. Measure the track and derive the duration from it.
  // ResizeObserver (not just a resize listener) because the track also changes
  // width when webfonts finish loading, after the first measurement.
  useLayoutEffect(() => {
    if (reduce || items.length === 0) return undefined;
    const el = trackRef.current;
    if (!el) return undefined;

    const measure = () => {
      const distance = window.innerWidth + el.scrollWidth;
      setDuration(distance / CHYRON_SPEED_PX_PER_SEC);
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [items, reduce]);

  if (items.length === 0) return null;

  return (
    <Link
      to="/news"
      aria-label={`Weekly Briefing — ${items.length} stories. Open the news page.`}
      className="w-full overflow-hidden flex items-stretch hover:brightness-125"
      style={{
        background: "#222831",
        color: "#FFFFFF",
        height: 30,
        fontWeight: 500,
        fontSize: 14,
        letterSpacing: "0.3px",
        textDecoration: "none",
        borderTop: "1px solid rgba(0,0,0,0.18)",
        borderBottom: "1px solid rgba(0,0,0,0.18)",
      }}
    >
      <span
        className="flex items-center"
        style={{
          flexShrink: 0,
          background: "#FFC857",
          color: "#222831",
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: "0.09em",
          padding: "0 12px",
        }}
      >
        NEWS
      </span>
      <span className="flex items-center" style={{ flex: 1, overflow: "hidden" }}>
        {reduce ? (
          <span style={{ padding: "0 12px" }}>
            {items.length} {items.length === 1 ? "story" : "stories"} in this week's briefing — click to read
          </span>
        ) : (
          // Real elements, not a joined string: HTML collapses runs of
          // whitespace, so a padded separator in a plain string renders as a
          // single space and the headlines read as one long line. The gold
          // bullet (matching the NEWS badge) carries the gap.
          <span
            className="news-chyron-track"
            ref={trackRef}
            style={duration ? { animationDuration: `${duration}s` } : undefined}
          >
            {items.map((item, i) => (
              <React.Fragment key={item.id}>
                {i > 0 && (
                  <span aria-hidden="true" style={{ color: "#FFC857", margin: "0 26px" }}>
                    •
                  </span>
                )}
                <span>{item.title}</span>
              </React.Fragment>
            ))}
          </span>
        )}
      </span>
    </Link>
  );
}

// The teal-tier "Training" link in its advance state: an amber emergency-beacon
// LED + amber label, so it stands out from the white sibling links whenever a
// session is coming up (and the day-of color button isn't showing yet).
function TrainingBeaconLink() {
  return (
    <Link
      to="/training"
      className="hover:brightness-110"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        color: BEACON_AMBER,
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      <span
        className="training-pulse"
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: BEACON_AMBER,
          "--training-glow-rgb": BEACON_RGB,
        }}
      />
      Training
    </Link>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { upcomingSession, isToday, buttonState, now, minimized, footerButtonRef } = useTraining();

  // There's a surface-able session within the look-ahead window (not past its cutoff).
  const hasUpcomingSession =
    !!upcomingSession && buttonState !== "gone" && buttonState !== "unavailable";
  // Day-of → the color-changing button. On DESKTOP it only appears once the popup
  // has been closed (minimized) — the panel "whooshes" down into it; until then
  // the teal tier shows the plain "Training" link. Mobile has no popup, so its
  // full-width bar shows the day-of button directly.
  const showDesktopButton = hasUpcomingSession && isToday && minimized;
  const showMobileButton = hasUpcomingSession && isToday;

  return (
    <>
      {/* News chyron — sits directly above the teal tier. Self-hides when there
          is no published news, so pages just lose the bar rather than break. */}
      <NewsChyron />

      {/* Teal secondary tier — hidden on mobile (links live in the hamburger).
          minHeight (not fixed height) so it auto-grows for the taller training
          button on the session's day; extra vertical padding only when shown. */}
      <div
        className="hidden lg:flex items-center justify-center w-full"
        style={{
          background: "var(--color-footer-secondary-bg)",
          color: "var(--color-footer-secondary-text)",
          minHeight: "var(--height-footer-secondary)",
          padding: showDesktopButton ? "8px 0" : 0,
          fontFamily: "'Open Sans', sans-serif",
          fontSize: "var(--font-size-footer-secondary)",
        }}
      >
        <nav
          className="flex items-center flex-wrap justify-center"
          style={{ gap: "var(--gap-footer-secondary-links)" }}
        >
          {SECONDARY_LINKS.map((link, idx) => (
            <React.Fragment key={link.to}>
              {link.to === "/training" && showDesktopButton ? (
                <TrainingFooterButton
                  session={upcomingSession}
                  state={buttonState}
                  now={now}
                  buttonRef={footerButtonRef}
                />
              ) : link.to === "/training" && hasUpcomingSession ? (
                <TrainingBeaconLink />
              ) : (
                <Link
                  to={link.to}
                  className="hover:brightness-125"
                  style={{ color: "var(--color-footer-secondary-text)" }}
                >
                  {link.label}
                </Link>
              )}
              {idx < SECONDARY_LINKS.length - 1 && (
                <span aria-hidden="true" style={{ opacity: 0.5 }}>·</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Mobile training bar — the teal tier is hidden on mobile, so on the
          session's day surface the button as a full-width bar above copyright. */}
      {showMobileButton && (
        <div className="lg:hidden w-full">
          <TrainingFooterButton
            session={upcomingSession}
            state={buttonState}
            now={now}
            fullWidth
          />
        </div>
      )}

      <footer
        className="bg-footer-bg text-footer-text h-footer flex items-center justify-center w-full"
        style={{ fontFamily: "var(--font-family-body)", fontSize: "var(--font-size-footer)" }}
      >
        <div className="flex items-center gap-2">
          <USFlagIcon size={20} />
          <span>
            © {currentYear} Flecha Amarilla, Inc.. All Rights Reserved.
          </span>
        </div>
      </footer>
    </>
  );
}
