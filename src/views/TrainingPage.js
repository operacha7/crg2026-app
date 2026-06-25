// src/views/TrainingPage.js
// Public /training page — "Live Training". Left sidebar holds a month calendar
// (today + session days highlighted; click a session day to scroll to its
// panel). Main area lists info panels for upcoming sessions; a panel is removed
// from the page once it passes 15 min after its start time.
//
// The session panel itself (title, grid, calendar links, counter, four-state
// Join control) lives in src/components/SessionCard.js — shared with the in-app
// TrainingPopup. The Join-button state machine + countdown live in
// src/utils/calendar.js (getButtonState / formatCountdown), also shared.
//
// Also: universal .ics + Google Calendar links and the anonymous "saved this
// session" counter (no PII; increment via functions/track-calendar-add.js).

import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Toaster } from "react-hot-toast";
import HomeNavBar from "../layout/HomeNavBar";
import Footer from "../layout/Footer";
import { dataService } from "../services/dataService";
import { sessionToInstants, centralYmd, TRAINING_REMOVE_AFTER_MS } from "../utils/calendar";
import SessionCard from "../components/SessionCard";
import TrainingMatrix from "../components/TrainingMatrix";

const TICK_MS = 30 * 1000; // re-evaluate states / countdowns every 30s
const ADDED_STORAGE_KEY = "crg_calendar_added"; // device-local dedupe, never sent

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad2 = (n) => String(n).padStart(2, "0");

// Course accent palette. Each distinct session title gets the next color PAIR,
// shared across all of that course's sessions, so the stack of cards has rhythm
// instead of reading as a wall of beige. `card` paints the card border + title
// (darker, for legibility on the light cream card); `ring` paints that course's
// calendar-day ring (lighter, to pop on the dark navy calendar). Today's date
// is red, so blues/greens are free to use here.
const TRACK_COLORS = [
  { card: "#245AA8", ring: "#6BA1F0" }, // blue
  { card: "#1F7A46", ring: "#4FBE7E" }, // green
  { card: "#C25E12", ring: "#F2792B" }, // orange
  { card: "#7B53C0", ring: "#A07BE0" }, // violet
  { card: "#B58A00", ring: "#F0B429" }, // gold
];

function buildAccentMap(sessions) {
  const map = {};
  let i = 0;
  for (const s of sessions) {
    const key = s.title || "";
    if (!(key in map)) {
      map[key] = TRACK_COLORS[i % TRACK_COLORS.length];
      i++;
    }
  }
  return map;
}

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

export default function TrainingPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({});
  const [addedIds, setAddedIds] = useState(() => readAddedIds());
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

  // Show a session until 15 min after its start, then drop it (the panel
  // disappears at the +15m cutoff). Recomputed each render so the 30s tick
  // removes a session the moment it passes the cutoff.
  const now = Date.now();
  const visibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      const { start } = sessionToInstants(s);
      return !start || now < start.getTime() + TRAINING_REMOVE_AFTER_MS;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, now]);

  // One accent color per distinct course title, stable across its sessions.
  const accentMap = useMemo(() => buildAccentMap(visibleSessions), [visibleSessions]);

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

      {/* Public route (outside MainApp), so it needs its own Toaster for the
          availability-matrix success toast. Matches MainApp's position. */}
      <Toaster position="top-center" />

      <HomeNavBar />

      <div className="flex flex-col lg:flex-row flex-1 lg:min-h-0">
        {/* Left sidebar — calendar. Fixed width on desktop (keeps its width
            even with no sessions); full width stacked on top on mobile. */}
        <aside
          className="w-full lg:w-[340px] flex-shrink-0 flex flex-col items-center lg:items-start"
          style={{
            background: "var(--color-training-sidebar-bg)",
            // Top padding matches the main area's (36px) so the calendar's top
            // edge lines up with the "Live Training" title.
            padding: "36px 20px 24px",
          }}
        >
          <div className="w-full lg:w-auto flex justify-center lg:block">
            <SessionCalendar sessions={visibleSessions} onSelectSession={scrollToSession} accentMap={accentMap} />
          </div>
          {/* "Suggest a better time" availability matrix — self-contained
              (own fetch + submit). Desktop only: sits below the calendar in the
              sidebar. On mobile it renders below the sessions instead (the
              lg:hidden copy after <main>), so the scheduled sessions come before
              this "if none of these work" fallback. */}
          <div className="hidden lg:block">
            <TrainingMatrix />
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
                <header style={{ marginBottom: 27, color: "var(--color-training-heading)" }}>
                  <h1 className="font-opensans" style={{ fontSize: 34, fontWeight: 700, marginBottom: 12 }}>
                    Live Training
                  </h1>
                  <p className="font-opensans" style={{ fontSize: 17, marginBottom: 4 }}>
                    Free. &nbsp;No Registration. &nbsp;No Setup. &nbsp;Virtual Sessions. &nbsp;Open to Everyone.
                  </p>
                  <p className="font-opensans" style={{ fontSize: 17, lineHeight: 1.5, maxWidth: 720 }}>
                    Find a session and add it to your calendar.
                    </p>
                    <p>
                    At the scheduled time click the link in your calendar or the green <strong>Join Now</strong> button below
                    which will appear five minutes before the start of the session.
                    </p>
                </header>
                {/* Footnote sits directly above the panels (closer to them than
                    to the header paragraph) so it reads as a caption for the
                    sessions, not a continuation of the intro. */}
                <p
                  className="font-opensans"
                  style={{ marginBottom: 14, fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "center" }}
                >
                   
                </p>
                <div className="flex flex-col" style={{ gap: 30 }}>
                  {visibleSessions.map((session) => (
                    <SessionCard
                      key={session.id_no}
                      session={session}
                      now={now}
                      count={counts[session.id_no] || 0}
                      alreadyAdded={addedIds.has(session.id_no)}
                      onCalendarAdd={() => trackCalendarAdd(session)}
                      accentColor={accentMap[session.title || ""]?.card}
                      gradientColor={accentMap[session.title || ""]?.ring}
                      cardRef={(node) => {
                        cardRefs.current[session.id_no] = node;
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </main>

        {/* Mobile-only: the availability matrix lives BELOW the sessions here
            (on desktop it's in the sidebar above). Keeps the scheduled sessions
            as the first thing after the calendar; this "suggest other times"
            fallback comes last. Tan sidebar background so it reads as the same
            kind of control as the calendar. */}
        <div
          className="lg:hidden w-full flex justify-center"
          style={{
            background: "var(--color-training-sidebar-bg)",
            padding: "24px 20px 28px",
          }}
        >
          <TrainingMatrix />
        </div>
      </div>

      <Footer />
    </div>
  );
}

// ---- Sidebar month calendar -------------------------------------------------

function SessionCalendar({ sessions, onSelectSession, accentMap = {} }) {
  // Map each session day (Central) → { id, color } for the first session that
  // day: id drives click→scroll, color paints the day ring to match the course
  // accent on its card.
  const sessionDayMap = useMemo(() => {
    const m = {};
    for (const s of sessions) {
      const { start } = sessionToInstants(s);
      if (!start) continue;
      const key = centralYmd(start);
      if (!(key in m)) m[key] = { id: s.id_no, color: accentMap[s.title || ""]?.ring };
    }
    return m;
  }, [sessions, accentMap]);

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
          const ringColor = hasSession
            ? sessionDayMap[key].color || "var(--color-training-cal-session-ring)"
            : null;

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
            border: hasSession ? `2px solid ${ringColor}` : "2px solid transparent",
            fontWeight: hasSession || isToday ? 700 : 400,
          };

          return (
            <button
              key={key}
              type="button"
              onClick={hasSession ? () => onSelectSession(sessionDayMap[key].id) : undefined}
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
