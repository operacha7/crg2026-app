// src/views/TrainingPage.js
// Public /training page — "Live Training". Left sidebar holds a month calendar
// (today + session days highlighted; click a session day to scroll to its
// panel). Main area lists info panels for present/future sessions only (past
// sessions, now > end, are hidden).
//
// Join button has four time-based states (all Central, DST-correct):
//   future  (gray)   now < start − 15m   → countdown ("Starts 2h 14m" / "Join in 2 days")
//   soon    (green)  start − 15m → start  → "Join Now"
//   live    (green)  start → start + 15m  → "Join Now - Live" + pulsing dot
//   late    (amber)  start + 15m → end    → "Join Now"
// Status tag (top-left): "LIVE NOW" (pulsing green dot) only while live;
// "UPCOMING" (steady amber dot) for every other state.
//
// Also: universal .ics + Google Calendar links and the anonymous "saved this
// session" counter (no PII; increment via functions/track-calendar-add.js).

import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import HomeNavBar from "../layout/HomeNavBar";
import Footer from "../layout/Footer";
import { dataService } from "../services/dataService";
import {
  sessionToInstants,
  getSessionDisplayParts,
  centralYmd,
  buildIcsDataUri,
  buildIcsFilename,
  buildGoogleCalendarUrl,
} from "../utils/calendar";

const JOIN_OPENS_BEFORE_MS = 15 * 60 * 1000; // green "Join Now" starts 15 min early
const LIVE_DOT_WINDOW_MS = 15 * 60 * 1000; // "Join Now - Live" lasts first 15 min
const TICK_MS = 30 * 1000; // re-evaluate states / countdowns every 30s
const ADDED_STORAGE_KEY = "crg_calendar_added"; // device-local dedupe, never sent

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad2 = (n) => String(n).padStart(2, "0");

function readAddedIds() {
  try {
    const raw = localStorage.getItem(ADDED_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function persistAddedIds(set) {
  try {
    localStorage.setItem(ADDED_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* best-effort only */
  }
}

// Which of the four button states applies right now, or "past"/"unavailable".
function getButtonState(start, end, now) {
  if (!start || !end) return "unavailable";
  const s = start.getTime();
  const e = end.getTime();
  if (now > e) return "past";
  if (now < s - JOIN_OPENS_BEFORE_MS) return "future";
  if (now < s) return "soon";
  if (now < s + LIVE_DOT_WINDOW_MS) return "live";
  return "late";
}

// Humanized time-until-start for the gray future button.
function formatCountdown(startMs, now) {
  const ms = startMs - now;
  if (ms <= 0) return "Starting now";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  if (days >= 1) return `Join in ${days} day${days > 1 ? "s" : ""}`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours >= 1) return `Starts ${hours}h ${mins}m`;
  return `Starts ${mins}m`;
}

export default function TrainingPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({});
  const [addedIds, setAddedIds] = useState(() => readAddedIds());
  const [showPast, setShowPast] = useState(false); // sidebar toggle: view past sessions
  const [, setTick] = useState(0);
  const tickRef = useRef();
  const cardRefs = useRef({}); // session id → card DOM node (for calendar click → scroll)

  useEffect(() => {
    dataService
      .getTrainingSessions()
      .then((rows) => {
        const list = rows || [];
        setSessions(list);
        const seeded = {};
        for (const s of list) seeded[s.id_no] = s.calendar_adds || 0;
        setCounts(seeded);
      })
      .catch((err) => console.error("TrainingPage load error", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(tickRef.current);
  }, []);

  const trackCalendarAdd = (session) => {
    const id = session.id_no;
    if (addedIds.has(id)) return;
    const nextAdded = new Set(addedIds).add(id);
    setAddedIds(nextAdded);
    persistAddedIds(nextAdded);
    setCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    fetch("/track-calendar-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: id }),
    }).catch((err) => console.error("track-calendar-add failed", err));
  };

  // Only present/future sessions (hide anything past its end time). Recomputed
  // each render so the 30s tick drops a session the moment it ends.
  const now = Date.now();
  const visibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      const { end } = sessionToInstants(s);
      return !end || now <= end.getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, now]);

  // Past sessions (ended), most-recent first, capped at 6 — shown only when the
  // sidebar toggle is on, rendered grayed-out and non-interactive.
  const pastSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        const { end } = sessionToInstants(s);
        return end && now > end.getTime();
      })
      .sort((a, b) => sessionToInstants(b).start - sessionToInstants(a).start)
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, now]);

  const scrollToSession = (id) => {
    const node = cardRefs.current[id];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-dvh lg:h-dvh flex flex-col lg:overflow-hidden">
      <Helmet>
        <title>Live Training | CRG Houston</title>
        <meta
          name="description"
          content="Free, no-registration virtual training sessions for the Community Resources Guide Houston application."
        />
        <link rel="canonical" href="https://crghouston.org/training" />
      </Helmet>

      <HomeNavBar />

      <div className="flex flex-col lg:flex-row flex-1 lg:min-h-0">
        {/* Left sidebar — calendar. Fixed width on desktop (keeps its width
            even with no sessions); full width stacked on top on mobile. */}
        <aside
          className="w-full lg:w-[340px] flex-shrink-0 flex flex-col items-center lg:items-start"
          style={{
            background: "var(--color-training-sidebar-bg)",
            padding: "24px 20px",
          }}
        >
          <div className="w-full lg:w-auto flex justify-center lg:block">
            <SessionCalendar sessions={visibleSessions} onSelectSession={scrollToSession} />
          </div>
          <div className="w-full lg:w-auto flex justify-center lg:block" style={{ marginTop: 16 }}>
            <label
              className="font-opensans flex items-center"
              style={{ gap: 8, color: "#FFFFFF", fontSize: 14, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={showPast}
                onChange={(e) => setShowPast(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              Show past sessions
            </label>
          </div>
        </aside>

        {/* Main content — maroon */}
        <main
          className="flex-1 lg:overflow-y-auto"
          style={{
            background: "var(--color-training-main-bg)",
            padding: "36px 32px 48px 56px",
          }}
        >
          <div style={{ maxWidth: 900 }}>
            {loading ? (
              <div className="font-opensans" style={{ color: "#FFFFFF", opacity: 0.9, padding: "24px 0" }}>
                Loading sessions…
              </div>
            ) : visibleSessions.length === 0 ? (
              <header className="font-opensans" style={{ color: "var(--color-training-heading)" }}>
                <h1 style={{ fontSize: 34, fontWeight: 700, marginBottom: 12 }}>
                  No Training Sessions Scheduled
                </h1>
                <p style={{ fontSize: 17, opacity: 0.9 }}>
                  Please check back soon for upcoming sessions.
                </p>
              </header>
            ) : (
              <>
                <header style={{ marginBottom: 22, color: "var(--color-training-heading)" }}>
                  <h1 className="font-opensans" style={{ fontSize: 34, fontWeight: 700, marginBottom: 12 }}>
                    Live Training
                  </h1>
                  <p className="font-opensans" style={{ fontSize: 17, marginBottom: 4 }}>
                    Free. &nbsp;No registration. &nbsp;Virtual sessions.
                  </p>
                  <p className="font-opensans" style={{ fontSize: 17, lineHeight: 1.5, maxWidth: 720 }}>
                    Find a session, add it to your calendar, and join at the scheduled time by
                    clicking the link in your calendar or the green <strong>Join</strong> button here.
                  </p>
                </header>
                <div className="flex flex-col" style={{ gap: 18 }}>
                  {visibleSessions.map((session) => (
                    <SessionCard
                      key={session.id_no}
                      session={session}
                      now={now}
                      count={counts[session.id_no] || 0}
                      alreadyAdded={addedIds.has(session.id_no)}
                      onCalendarAdd={() => trackCalendarAdd(session)}
                      cardRef={(node) => {
                        cardRefs.current[session.id_no] = node;
                      }}
                    />
                  ))}
                </div>
                <p
                  className="font-opensans"
                  style={{ marginTop: 14, fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "center" }}
                >
                  The Join button turns green 15 minutes before the start time and stays open
                  for the duration of the session.
                </p>
              </>
            )}

            {!loading && showPast && (
              <section style={{ marginTop: 32 }}>
                <h2
                  className="font-opensans"
                  style={{ color: "var(--color-training-heading)", fontSize: 20, fontWeight: 700, marginBottom: 14 }}
                >
                  Past Sessions
                </h2>
                {pastSessions.length === 0 ? (
                  <p className="font-opensans" style={{ color: "#FFFFFF", opacity: 0.8, fontSize: 15 }}>
                    No past sessions to show.
                  </p>
                ) : (
                  <div className="flex flex-col" style={{ gap: 18 }}>
                    {pastSessions.map((session) => (
                      <SessionCard
                        key={`past-${session.id_no}`}
                        session={session}
                        now={now}
                        count={counts[session.id_no] || 0}
                        alreadyAdded={addedIds.has(session.id_no)}
                        onCalendarAdd={() => {}}
                        cardRef={() => {}}
                        past
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}

// ---- Sidebar month calendar -------------------------------------------------

function SessionCalendar({ sessions, onSelectSession }) {
  // Map each session day (Central) → first session id that day, for click→scroll.
  const sessionDayMap = useMemo(() => {
    const m = {};
    for (const s of sessions) {
      const { start } = sessionToInstants(s);
      if (!start) continue;
      const key = centralYmd(start);
      if (!(key in m)) m[key] = s.id_no;
    }
    return m;
  }, [sessions]);

  const todayKey = centralYmd(new Date());
  const [ty, tm] = todayKey.split("-").map(Number); // today year, month(1-12)
  const [view, setView] = useState({ year: ty, month: tm - 1 }); // month 0-indexed

  const goPrev = () =>
    setView((v) => {
      const d = new Date(v.year, v.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const goNext = () =>
    setView((v) => {
      const d = new Date(v.year, v.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const arrowStyle = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    color: "var(--color-training-cal-text)",
    padding: "2px 8px",
  };

  return (
    <div
      className="font-opensans"
      style={{
        background: "var(--color-training-cal-bg)",
        color: "var(--color-training-cal-text)",
        borderRadius: 12,
        padding: "16px 18px",
        width: 300,
        maxWidth: "100%",
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
      }}
    >
      {/* Header: ‹ Month Year › */}
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <button onClick={goPrev} style={arrowStyle} aria-label="Previous month" className="hover:brightness-90">
          ‹
        </button>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{monthLabel}</div>
        <button onClick={goNext} style={arrowStyle} aria-label="Next month" className="hover:brightness-90">
          ›
        </button>
      </div>

      {/* Weekday header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          textAlign: "center",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-training-cal-muted)",
          marginBottom: 4,
        }}
      >
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const key = `${view.year}-${pad2(view.month + 1)}-${pad2(d)}`;
          const isToday = key === todayKey;
          const hasSession = key in sessionDayMap;

          const cellStyle = {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            margin: "0 auto",
            borderRadius: "50%",
            fontSize: 13,
            cursor: hasSession ? "pointer" : "default",
            background: isToday ? "var(--color-training-cal-today-bg)" : "transparent",
            color: isToday ? "var(--color-training-cal-today-text)" : "var(--color-training-cal-text)",
            border: hasSession ? "2px solid var(--color-training-cal-session-ring)" : "2px solid transparent",
            fontWeight: hasSession || isToday ? 700 : 400,
          };

          return (
            <button
              key={key}
              type="button"
              onClick={hasSession ? () => onSelectSession(sessionDayMap[key]) : undefined}
              disabled={!hasSession}
              className={hasSession ? "hover:brightness-95" : ""}
              style={{ ...cellStyle, padding: 0 }}
              title={hasSession ? "View this session" : undefined}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Session info panel -----------------------------------------------------

function SessionCard({ session, now, count, alreadyAdded, onCalendarAdd, cardRef, past }) {
  const { start, end } = sessionToInstants(session);
  const parts = getSessionDisplayParts(session);
  const state = getButtonState(start, end, now);

  const icsUri = buildIcsDataUri(session);
  const googleUrl = buildGoogleCalendarUrl(session);

  return (
    <article
      ref={cardRef}
      className="font-opensans"
      style={{
        background: "var(--color-training-panel-bg)",
        borderRadius: 14,
        padding: "20px 24px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        color: "var(--color-training-body-text)",
        // Past sessions: grayed out and fully non-interactive.
        ...(past ? { opacity: 0.55, pointerEvents: "none" } : null),
      }}
    >
      {/* Top row: status tag (left) + join button (right) */}
      <div className="flex items-start justify-between" style={{ gap: 12, marginBottom: 8 }}>
        <div>{!past && <StatusTag state={state} />}</div>
        {past ? (
          <EndedPill />
        ) : (
          <JoinButton state={state} startMs={start?.getTime()} now={now} meetLink={session.meet_link} />
        )}
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, lineHeight: 1.2 }}>
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
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 0,
            border: "1px solid var(--color-training-cell-border)",
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <GridCell label="DATE" value={parts.weekdayDate} sub={parts.year} />
          <GridCell label="STARTS" value={parts.startTime} sub="Central (CT)" bordered />
          <GridCell
            label="DURATION"
            value={`${parts.durationMin} min`}
            sub={`ends ${parts.endTime}`}
            bordered
            highlight
          />
          <GridCell label="WHERE" value="Google Meet" sub="in your browser" bordered />
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--color-training-cell-border)", paddingTop: 14 }}>
        <div className="flex flex-wrap items-center justify-between" style={{ gap: 12 }}>
          <div className="flex flex-wrap items-center" style={{ gap: 18 }}>
            {icsUri && (
              <a
                href={icsUri}
                download={buildIcsFilename(session)}
                onClick={onCalendarAdd}
                className="hover:brightness-110"
                style={calendarLinkStyle}
              >
                🗓️ Add to Calendar
              </a>
            )}
            {googleUrl && (
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onCalendarAdd}
                className="hover:brightness-110"
                style={calendarLinkStyle}
              >
                Google Calendar
              </a>
            )}
          </div>

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

function GridCell({ label, value, sub, bordered, highlight }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderLeft: bordered ? "1px solid var(--color-training-cell-border)" : "none",
        background: highlight ? "var(--color-training-cell-highlight-bg)" : "transparent",
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
//   live (start → +15m)         → "LIVE NOW" (pulsing green dot)
//   soon (15m before → start)   → "STARTING SOON" (steady green dot)
//   future (more than 15m out)  → "UPCOMING" (steady amber dot)
//   late / past / other         → no tag
function StatusTag({ state }) {
  const dotBase = { width: 9, height: 9, borderRadius: "50%", display: "inline-block" };
  const labelBase = { gap: 7, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em" };
  if (state === "live") {
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

const calendarLinkStyle = {
  color: "var(--color-training-link)",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "underline",
  cursor: "pointer",
};

// Shared button geometry — fixed width so the control doesn't resize as its
// label changes between states.
const JOIN_BASE = {
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
};

// Gray "Session Ended" pill shown in place of the Join button on past panels.
function EndedPill() {
  return (
    <span
      style={{
        ...JOIN_BASE,
        background: "var(--color-training-join-future-bg)",
        color: "#FFFFFF",
        fontSize: 14,
      }}
    >
      Session Ended
    </span>
  );
}

// Four-state join control. Clickable (link) for soon/live/late; informational
// pill for future (countdown). Falls back to a disabled pill if a clickable
// state has no meet link.
function JoinButton({ state, startMs, now, meetLink }) {
  if (state === "future") {
    return (
      <span
        style={{
          ...JOIN_BASE,
          background: "var(--color-training-join-future-bg)",
          color: "var(--color-training-join-future-text)",
        }}
      >
        {formatCountdown(startMs, now)}
      </span>
    );
  }

  const clickable = state === "soon" || state === "live" || state === "late";
  if (clickable && !meetLink) {
    return (
      <span style={{ ...JOIN_BASE, background: "var(--color-training-join-future-bg)", color: "#FFFFFF", fontSize: 14 }}>
        Join link unavailable
      </span>
    );
  }

  if (state === "live") {
    return (
      <a
        href={meetLink}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:brightness-110"
        style={{
          ...JOIN_BASE,
          gap: 16, // doubled spacing between the pulsing dot and the label
          background: "var(--color-training-join-live-bg)",
          color: "var(--color-training-join-live-text)",
        }}
      >
        <span
          className="animate-pulse"
          style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--color-training-join-live-dot)" }}
        />
        Join Now - Live
      </a>
    );
  }

  if (state === "soon") {
    const mins = Math.max(1, Math.ceil((startMs - now) / 60000));
    return (
      <a
        href={meetLink}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:brightness-110"
        style={{ ...JOIN_BASE, background: "var(--color-training-join-soon-bg)", color: "var(--color-training-join-soon-text)" }}
      >
        Join - Starts in {mins}m
      </a>
    );
  }

  if (state === "late") {
    return (
      <a
        href={meetLink}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:brightness-110"
        style={{ ...JOIN_BASE, background: "var(--color-training-join-late-bg)", color: "var(--color-training-join-late-text)" }}
      >
        Join Now
      </a>
    );
  }

  // unavailable / past (past sessions render <EndedPill/> instead)
  return null;
}
