// src/layout/Footer.js
// Two-tier site-wide footer:
//   1. Secondary tier with public links (Training, About, Privacy, Terms, Support, Org Login)
//   2. Red copyright bar (unchanged from prior versions)
// Renders on every page — homepage, public pages, and in-app.
//
// Training notice splits by timing (in-app, where TrainingProvider is mounted):
//   - In the WEEK BEFORE a session (not its day): a yellow "breaking news"
//     chyron scrolls above the teal tier telling users to click "Training" to
//     schedule. The teal tier keeps its plain "Training" link as the target.
//   - On the session's OWN DAY: the "Training" link transforms into the enlarged
//     "Training Session — …" button carrying the live state (gray/yellow/green/
//     orange) that glow-pulses on green/orange. The teal tier auto-grows for it.
// Public pages (no provider) show the plain "Training" link only. On mobile the
// teal tier is hidden, so the day-of button appears as a full-width bar above the
// copyright line, and the advance chyron still shows full-width.

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { USFlagIcon } from "../icons";
import { useTraining } from "../Contexts/TrainingContext";
import { sessionToInstants, getSessionDisplayParts, formatCountdown } from "../utils/calendar";

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

// Glow ring color (rgb triplet for the .training-pulse keyframe) per state.
const GLOW = { live: "8, 255, 8", late: "255, 123, 25" };

// How many right→left passes the advance chyron makes before it collapses for
// the rest of the visit. Tunable.
const CHYRON_PASSES = 1;

// Amber "emergency beacon" used on the teal-footer Training link whenever a
// session is in the look-ahead window (a slow pulse — deliberately well under the
// 3-flashes/sec photosensitivity limit; disabled entirely by prefers-reduced-
// motion via .training-pulse). #FFB302 as an rgb triplet for the glow keyframe.
const BEACON_AMBER = "#FFB302";
const BEACON_RGB = "255, 179, 2";

// Button fill/text tokens per state (shared with the SessionCard Join button).
function trainingColors(state) {
  const map = {
    future: { bg: "var(--color-training-join-future-bg)", color: "var(--color-training-join-future-text)" },
    soon: { bg: "var(--color-training-join-soon-bg)", color: "var(--color-training-join-soon-text)" },
    live: { bg: "var(--color-training-join-live-bg)", color: "var(--color-training-join-live-text)" },
    late: { bg: "var(--color-training-join-late-bg)", color: "var(--color-training-join-late-text)" },
  };
  return map[state] || map.future;
}

// Suffix after "Training Session — ": the bare countdown for gray/yellow
// ("2h 14m" / "20m"), or the join label for green/orange.
function trainingSuffix(state, startMs, now) {
  if (state === "live") return "Join Now - Live";
  if (state === "late") return "Join Now";
  return formatCountdown(startMs, now).replace(/^Starts\s+/, "");
}

// Day-of "Training Session — …" button. `fullWidth` is the mobile bar variant;
// otherwise it's the inline enlarged button in the teal tier.
function TrainingFooterButton({ session, state, now, fullWidth, buttonRef }) {
  const { start } = sessionToInstants(session);
  const colors = trainingColors(state);
  const pulse = state === "live" || state === "late";
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

// Advance-notice "breaking news" chyron — amber bar (same amber as the Training
// beacon, so the whole "upcoming — plan ahead" story is one color) that scrolls
// the schedule reminder a few times then collapses for the rest of the visit.
// Shown only in the days BEFORE a session (the day-of button replaces it).
// Reduced-motion users get the message statically (no scroll, no auto-hide).
function TrainingChyron({ session }) {
  const [done, setDone] = useState(false);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const parts = getSessionDisplayParts(session);
  if (!parts || done) return null;

  const message = `Next Live Training Session on ${parts.weekdayDate} at ${parts.startTime}  —  Click on “Training” to attend.`;

  return (
    <div
      className="w-full overflow-hidden"
      role="status"
      aria-live="polite"
      style={{
        background: BEACON_AMBER,
        color: "#1A1A1A",
        height: 30,
        display: "flex",
        alignItems: "center",
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: "0.3px",
        borderTop: "1px solid rgba(0,0,0,0.18)",
        borderBottom: "1px solid rgba(0,0,0,0.18)",
      }}
    >
      {reduce ? (
        <span style={{ width: "100%", textAlign: "center", padding: "0 12px" }}>
          {message}
        </span>
      ) : (
        <span
          className="training-chyron-track"
          style={{ animationIterationCount: CHYRON_PASSES }}
          onAnimationEnd={() => setDone(true)}
        >
          {message}
        </span>
      )}
    </div>
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
  // Advance notice (days before the session) → chyron above the teal tier.
  const showChyron = hasUpcomingSession && !isToday;
  // Day-of → the color-changing button. On DESKTOP it only appears once the popup
  // has been closed (minimized) — the panel "whooshes" down into it; until then
  // the teal tier shows the plain "Training" link. Mobile has no popup, so its
  // full-width bar shows the day-of button directly.
  const showDesktopButton = hasUpcomingSession && isToday && minimized;
  const showMobileButton = hasUpcomingSession && isToday;

  return (
    <>
      {/* Advance-notice chyron — sits directly above the teal tier. */}
      {showChyron && <TrainingChyron session={upcomingSession} />}

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
            © {currentYear} O Peracha. All Rights Reserved.
          </span>
        </div>
      </footer>
    </>
  );
}
