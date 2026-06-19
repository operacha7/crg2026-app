// src/Contexts/TrainingProvider.js
// The data-bearing half of the training context. Imports the Supabase data
// layer, so it is mounted ONLY inside MainApp (a lazy chunk) — never on the
// public homepage. See TrainingContext.js for the light hook/context that
// homepage components (Footer) read.
//
// Fetches the sessions once, ticks every 30s, and provides:
//   - todaySession  : the one session to surface (live now, else next today) or null
//   - buttonState   : its getButtonState() value (future/soon/live/late/gone/unavailable)
//   - popupOpen + openPopup()/closePopup()
//   - footerButtonRef : the footer button's DOM node, so the popup can "shoosh" into it
//   - getCount()/isAdded()/trackCalendarAdd() : the anonymous "saved" counter

import { useEffect, useMemo, useRef, useState } from "react";
import { dataService } from "../services/dataService";
import { getRelevantTodaySession, getButtonState, sessionToInstants } from "../utils/calendar";
import { TrainingContext } from "./TrainingContext";

const TICK_MS = 30 * 1000;
const ADDED_STORAGE_KEY = "crg_calendar_added"; // device-local dedupe, never sent
// Session ids whose footer indicator has been "deposited" (popup closed). Lets
// the indicator survive reloads within the day after the first whoosh-to-footer.
const MINIMIZED_KEY = "crg_training_minimized";

function readIdSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function persistIdSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* best-effort only */
  }
}

export function TrainingProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [counts, setCounts] = useState({});
  const [addedIds, setAddedIds] = useState(() => readIdSet(ADDED_STORAGE_KEY));
  const [minimizedIds, setMinimizedIds] = useState(() => readIdSet(MINIMIZED_KEY));
  const [now, setNow] = useState(() => Date.now());
  const [popupOpen, setPopupOpen] = useState(false);
  const footerButtonRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    dataService
      .getTrainingSessions()
      .then((rows) => {
        if (cancelled) return;
        const list = rows || [];
        setSessions(list);
        const seeded = {};
        for (const s of list) seeded[s.id_no] = s.calendar_adds || 0;
        setCounts(seeded);
      })
      .catch((err) => console.error("TrainingProvider load error", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const todaySession = useMemo(() => getRelevantTodaySession(sessions, now), [sessions, now]);

  const buttonState = useMemo(() => {
    if (!todaySession) return "unavailable";
    const { start } = sessionToInstants(todaySession);
    return getButtonState(start, now);
  }, [todaySession, now]);

  const value = useMemo(() => {
    const trackCalendarAdd = (session) => {
      const id = session?.id_no;
      if (id == null || addedIds.has(id)) return;
      const nextAdded = new Set(addedIds).add(id);
      setAddedIds(nextAdded);
      persistIdSet(ADDED_STORAGE_KEY, nextAdded);
      setCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
      fetch("/track-calendar-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: id }),
      }).catch((err) => console.error("track-calendar-add failed", err));
    };

    // "Deposit" the footer indicator for the current session — called when the
    // popup is closed (the panel whooshes down into the footer button). Persisted
    // so the indicator stays after a reload that day.
    const minimize = () => {
      const id = todaySession?.id_no;
      if (id == null) return;
      setMinimizedIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        persistIdSet(MINIMIZED_KEY, next);
        return next;
      });
    };

    return {
      todaySession,
      buttonState,
      now,
      popupOpen,
      openPopup: () => setPopupOpen(true),
      closePopup: () => setPopupOpen(false),
      minimized: todaySession ? minimizedIds.has(todaySession.id_no) : false,
      minimize,
      footerButtonRef,
      getCount: (id) => counts[id] || 0,
      isAdded: (id) => addedIds.has(id),
      trackCalendarAdd,
    };
  }, [todaySession, buttonState, now, popupOpen, counts, addedIds, minimizedIds]);

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}
