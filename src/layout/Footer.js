// src/layout/Footer.js
// Two-tier site-wide footer:
//   1. Secondary tier with public links (Training, About, Privacy, Terms, Support, Org Login)
//   2. Red copyright bar (unchanged from prior versions)
// Renders on every page — homepage, public pages, and in-app.
//
// On training days (in-app, where TrainingProvider is mounted) the "Training"
// link transforms into the enlarged "Training Session — …" button that carries
// the session's state (gray/yellow/green/orange) and glow-pulses on green/orange.
// The teal tier auto-grows to fit it. Public pages (no provider) show the plain
// "Training" link. On mobile the teal tier is hidden, so the training button
// appears instead as a full-width bar above the copyright line.

import React from "react";
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

// Glow ring color (rgb triplet for the .training-pulse keyframe) per state.
const GLOW = { live: "8, 255, 8", late: "255, 123, 25" };

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

// The transforming Training Session button. `fullWidth` is the mobile bar
// variant; otherwise it's the inline enlarged button in the teal tier.
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

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { todaySession, buttonState, now, minimized, footerButtonRef } = useTraining();

  // There's a surface-able session today (not past its cutoff).
  const hasTodaySession =
    !!todaySession && buttonState !== "gone" && buttonState !== "unavailable";
  // The DESKTOP teal-tier button only appears once the popup has been closed
  // (minimized) — the panel "whooshes" down into it. Until then the teal tier
  // shows the plain "Training" link. The mobile bar (there is no popup on
  // mobile) shows the indicator directly.
  const showDesktopButton = hasTodaySession && minimized;

  return (
    <>
      {/* Teal secondary tier — hidden on mobile (links live in the hamburger).
          minHeight (not fixed height) so it auto-grows for the taller training
          button on training days; extra vertical padding only when it's shown. */}
      <div
        className="hidden lg:flex items-center justify-center w-full"
        style={{
          background: "var(--color-footer-secondary-bg)",
          color: "var(--color-footer-secondary-text)",
          minHeight: "var(--height-footer-secondary)",
          padding: showDesktopButton ? "8px 0" : 0,
          fontFamily: "var(--font-family-body)",
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
                  session={todaySession}
                  state={buttonState}
                  now={now}
                  buttonRef={footerButtonRef}
                />
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

      {/* Mobile training bar — the teal tier is hidden on mobile, so on training
          days surface the button as a full-width bar above the copyright line. */}
      {hasTodaySession && (
        <div className="lg:hidden w-full">
          <TrainingFooterButton
            session={todaySession}
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
