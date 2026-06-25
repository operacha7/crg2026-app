// src/components/SessionCard.js
// The training "info panel" — used both on the public /training page (one card
// per upcoming session) and as the body of the in-app TrainingPopup. Shows the
// title, optional description, a DATE/STARTS/DURATION/WHERE grid, calendar-add
// links, the "saved this session" counter, and the four-state Join control.
//
// Join states (all relative to start S; see getButtonState in utils/calendar):
//   future (gray)   "Starts …"            not clickable
//   soon   (yellow) "Starts …"            not clickable
//   live   (green)  "Join Now - Live" + glow pulse   clickable
//   late   (orange) "Join Now" + glow pulse           clickable
// The green/orange buttons get the whole-button glow (.training-pulse) — the
// pulse is tied to "joinable now," not to the approaching countdown.

import { useState, useRef, useEffect } from "react";
import {
  sessionToInstants,
  getSessionDisplayParts,
  getButtonState,
  formatCountdown,
  buildIcsDataUri,
  buildIcsFilename,
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  normalizeMeetUrl,
} from "../utils/calendar";

export default function SessionCard({ session, now, count, alreadyAdded, onCalendarAdd, cardRef, singleRowGrid, accentColor, gradientColor, cardBg }) {
  const { start } = sessionToInstants(session);
  const parts = getSessionDisplayParts(session);
  const state = getButtonState(start, now);

  // Card background, layered top→bottom: the solid 8px accent stripe on the
  // left, then the course wash (~15%→0% over the left half), then the cream
  // base. Painting the stripe as a BACKGROUND layer (not a border) lets the
  // card's border-radius clip it, so its top/bottom ends curve with the corners
  // and read as part of the card — instead of the flat diagonal wedge a thick
  // border-left makes against the rounded corners. Tune wash start via the alpha
  // hex (`26` ≈ 15%) and its spread via the 50% stop; stripe width via the 8px.
  const baseBg = cardBg || "var(--color-training-panel-bg)";
  const layers = [];
  if (accentColor) layers.push(`linear-gradient(to right, ${accentColor} 0, ${accentColor} 10px, transparent 10px)`);
  if (gradientColor) layers.push(`linear-gradient(to right, ${gradientColor}26 0%, ${gradientColor}00 50%)`);
  const background = layers.length ? `${layers.join(", ")}, ${baseBg}` : baseBg;

  return (
    <article
      ref={cardRef}
      className="font-opensans"
      style={{
        background,
        borderRadius: 20,
        padding: "20px 24px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        color: "var(--color-training-body-text)",
      }}
    >
      {/* Top row: status tag (left) + join button (right) */}
      <div className="flex items-start justify-between" style={{ gap: 12, marginBottom: 8 }}>
        <div><StatusTag state={state} /></div>
        <JoinButton state={state} startMs={start?.getTime()} now={now} meetLink={session.meet_link} />
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, lineHeight: 1.2, color: accentColor || undefined }}>
        {session.title || "CRG Houston Training"}
      </h2>
      {session.description && (
        <p style={{ fontSize: 14.5, color: "var(--color-training-muted-text)", marginBottom: 16, lineHeight: 1.5 }}>
          {session.description}
        </p>
      )}

      {/* DATE / STARTS / DURATION / WHERE grid */}
      {parts && (
        <div
          style={{
            display: "grid",
            // Popup forces one non-wrapping row (singleRowGrid); the /training
            // page stays responsive (wraps on narrow screens).
            gridTemplateColumns: singleRowGrid ? "repeat(4, 1fr)" : "repeat(auto-fit, minmax(130px, 1fr))",
            // 1px gaps over a gray container background render as hairlines
            // between every cell — vertical AND horizontal — so the dividers
            // adapt automatically when the grid wraps (e.g. STARTS above WHERE on
            // narrow/mobile widths). Replaces the per-cell left borders.
            gap: "1px",
            background: "var(--color-training-cell-border)",
            border: "1px solid var(--color-training-cell-border)",
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: 16,
            // Subtle nested lift: the cream card already casts a shadow; this
            // smaller one makes the white grid appear to float off the card.
            boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
          }}
        >
          <GridCell label="DATE" value={parts.weekdayDate} sub={parts.year} />
          <GridCell label="STARTS" value={parts.startTime} sub="Central (CT)" />
          <GridCell
            label="DURATION"
            value={`${parts.durationMin} min`}
            sub={`ends ${parts.endTime}`}
            highlight
          />
          <GridCell label="WHERE" value="Google Meet" sub="in your browser" />
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--color-training-cell-border)", paddingTop: 14 }}>
        <div className="flex flex-wrap items-center justify-between" style={{ gap: 12 }}>
          <CalendarMenu session={session} onCalendarAdd={onCalendarAdd} accentColor={accentColor} />

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#FFFFFF",
              border: "1px solid var(--color-training-cell-border)",
              borderRadius: 999,
              padding: "5px 12px",
              fontSize: 13,
              color: "var(--color-training-muted-text)",
            }}
          >
            👥 <strong style={{ color: "var(--color-training-body-text)" }}>{count}</strong>
            <span>saved this session</span>
            {alreadyAdded && <span style={{ color: "#2F8F3E", fontWeight: 700 }}>✓</span>}
          </div>
        </div>
      </div>
    </article>
  );
}

function GridCell({ label, value, sub, highlight }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        // Dividers now come from the grid's 1px gap (see the grid container);
        // each cell just paints its own background over that gray backdrop.
        background: highlight ? "var(--color-training-cell-highlight-bg)" : "#FFFFFF",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: highlight ? "var(--color-training-tag-upcoming)" : "var(--color-training-muted-text)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--color-training-muted-text)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// Status tag by button state:
//   live + late (S−5m → S+15m)   → "LIVE NOW" (pulsing green dot)
//   soon (S−20m → S−5m)          → "STARTING SOON" (steady green dot)
//   future (more than 20m out)   → "UPCOMING" (steady amber dot)
//   gone / unavailable           → no tag
function StatusTag({ state }) {
  const dotBase = { width: 9, height: 9, borderRadius: "50%", display: "inline-block" };
  const labelBase = { gap: 7, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em" };
  if (state === "live" || state === "late") {
    return (
      <div className="flex items-center" style={{ ...labelBase, color: "var(--color-training-tag-live)" }}>
        <span className="animate-pulse" style={{ ...dotBase, background: "var(--color-training-tag-live)" }} />
        LIVE NOW
      </div>
    );
  }
  if (state === "soon") {
    return (
      <div className="flex items-center" style={{ ...labelBase, color: "var(--color-training-tag-soon)" }}>
        <span style={{ ...dotBase, background: "var(--color-training-tag-soon)" }} />
        STARTING SOON
      </div>
    );
  }
  if (state === "future") {
    return (
      <div className="flex items-center" style={{ ...labelBase, color: "var(--color-training-tag-upcoming)" }}>
        <span style={{ ...dotBase, background: "var(--color-training-tag-upcoming-dot)" }} />
        UPCOMING
      </div>
    );
  }
  return null;
}

// Standard "Add to Calendar ▾" control. One button reveals the per-provider
// options so we keep the one-click Google/Outlook paths (and a universal .ics
// for Apple/everything else) without three links cluttering every card. Each
// pick fires onCalendarAdd so the anonymous "saved this session" counter still
// increments. Closes on outside-click or Escape.
function CalendarMenu({ session, onCalendarAdd, accentColor }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const icsUri = buildIcsDataUri(session);
  const googleUrl = buildGoogleCalendarUrl(session);
  const outlookUrl = buildOutlookCalendarUrl(session);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!icsUri && !googleUrl && !outlookUrl) return <div />;

  // download anchors (.ics) fire onCalendarAdd; web links open in a new tab.
  const handlePick = () => {
    onCalendarAdd?.();
    setOpen(false);
  };

  const accent = accentColor || "var(--color-training-link)";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hover:brightness-110"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#FFFFFF",
          border: `1.5px solid ${accent}`,
          color: accent,
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        🗓️ Add to Calendar
        <span style={{ fontSize: 11, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 20,
            minWidth: 200,
            background: "#FFFFFF",
            border: "1px solid var(--color-training-cell-border)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
            overflow: "hidden",
          }}
        >
          {googleUrl && (
            <a href={googleUrl} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={handlePick} style={calendarMenuItemStyle}>
              Google Calendar
            </a>
          )}
          {outlookUrl && (
            <a href={outlookUrl} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={handlePick} style={calendarMenuItemStyle}>
              Outlook.com
            </a>
          )}
          {icsUri && (
            <a href={icsUri} download={buildIcsFilename(session)} role="menuitem" onClick={handlePick} style={calendarMenuItemStyle}>
              Apple Calendar
            </a>
          )}
          {icsUri && (
            <a href={icsUri} download={buildIcsFilename(session)} role="menuitem" onClick={handlePick} style={{ ...calendarMenuItemStyle, borderTop: "1px solid var(--color-training-cell-border)" }}>
              Other (download .ics)
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const calendarMenuItemStyle = {
  display: "block",
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--color-training-body-text)",
  textDecoration: "none",
  cursor: "pointer",
  background: "#FFFFFF",
};

// Shared button geometry — fixed width so the control doesn't resize as its
// label changes between states.
export const JOIN_BASE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 44,
  width: 220,
  padding: "0 14px",
  borderRadius: 8,
  fontSize: 16,
  fontWeight: 700,
  textDecoration: "none",
  textAlign: "center",
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  boxShadow: "0 2px 6px rgba(0,0,0,0.25)", // lift the button off the cream card
};

// Glow color (rgb triplet for the .training-pulse keyframe) by joinable state.
export const TRAINING_GLOW_RGB = { live: "8, 255, 8", late: "255, 123, 25" };

// Join control. Non-clickable "Starts …" countdown for future (gray) and soon
// (yellow); clickable link for live (green) and late (orange), each with the
// whole-button glow pulse. Falls back to a disabled pill if a clickable state
// has no meet link.
function JoinButton({ state, startMs, now, meetLink }) {
  // Gray + yellow: identical non-clickable countdown, differing only in color.
  if (state === "future" || state === "soon") {
    const bg =
      state === "future"
        ? "var(--color-training-join-future-bg)"
        : "var(--color-training-join-soon-bg)";
    const color =
      state === "future"
        ? "var(--color-training-join-future-text)"
        : "var(--color-training-join-soon-text)";
    return (
      <span style={{ ...JOIN_BASE, background: bg, color }}>
        {formatCountdown(startMs, now)}
      </span>
    );
  }

  // Normalize so a scheme-less DB value (e.g. "meet.google.com/...") opens Meet
  // instead of being treated as a relative SPA path (→ catch-all → /find).
  const href = normalizeMeetUrl(meetLink);
  const clickable = state === "live" || state === "late";
  if (clickable && !href) {
    return (
      <span style={{ ...JOIN_BASE, background: "var(--color-training-join-future-bg)", color: "var(--color-training-join-future-text)", fontSize: 14 }}>
        Join link unavailable
      </span>
    );
  }

  if (state === "live") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:brightness-110 training-pulse"
        style={{
          ...JOIN_BASE,
          gap: 16, // doubled spacing between the dot and the label
          background: "var(--color-training-join-live-bg)",
          color: "var(--color-training-join-live-text)",
          "--training-glow-rgb": TRAINING_GLOW_RGB.live,
        }}
      >
        <span
          style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--color-training-join-live-dot)" }}
        />
        Join Now - Live
      </a>
    );
  }

  if (state === "late") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:brightness-110 training-pulse"
        style={{
          ...JOIN_BASE,
          background: "var(--color-training-join-late-bg)",
          color: "var(--color-training-join-late-text)",
          "--training-glow-rgb": TRAINING_GLOW_RGB.late,
        }}
      >
        Join Now
      </a>
    );
  }

  // gone / unavailable
  return null;
}
