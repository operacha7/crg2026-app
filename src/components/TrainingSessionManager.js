// src/components/TrainingSessionManager.js
// Watches the clock while a user is in the app and, when a training session
// enters its "starting now" window (start → start + 20 min), pops up a modal
// offering to join — wherever the user happens to be. Mounted once in MainApp,
// so it covers all in-app routes (but not the public homepage / Training page,
// which are rendered at the App.js layer and already show the schedule).
//
// Rules (per product decisions):
//   - Trigger at the session START time, NOT 15 min early like the page's Join
//     gate. The 15-min-early gate is for someone deliberately on the page; this
//     interruption should only fire once things are actually underway.
//   - Only during the first 20 min of the session, so nobody is pulled in at
//     the tail end of a ~40-min session.
//   - Once per session per visit: after it shows (whether the user joins or
//     cancels) we record the session id in localStorage so it doesn't re-fire
//     across navigation or a refresh. A logout clears this flag (see
//     handleLogout in src/App.js), so a fresh login during the live window is
//     re-prompted.

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { dataService } from "../services/dataService";
import { sessionToInstants, normalizeMeetUrl } from "../utils/calendar";
import TrainingSessionPopup from "./TrainingSessionPopup";

const POPUP_WINDOW_MS = 20 * 60 * 1000; // popup may fire only in the first 20 min
const CHECK_MS = 30 * 1000; // re-check the clock every 30s
const SHOWN_STORAGE_KEY = "crg_training_popup_shown"; // device-local, once-per-session

function readShownIds() {
  try {
    const raw = localStorage.getItem(SHOWN_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markShown(id) {
  try {
    const set = readShownIds();
    set.add(id);
    localStorage.setItem(SHOWN_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* best-effort only */
  }
}

const TrainingSessionManager = () => {
  const sessionsRef = useRef([]);
  const [activeSession, setActiveSession] = useState(null);
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    let cancelled = false;

    dataService
      .getTrainingSessions()
      .then((rows) => {
        if (!cancelled) sessionsRef.current = rows || [];
      })
      .catch((err) => console.error("TrainingSessionManager load error", err));

    // Find the first not-yet-shown session whose start is within the popup
    // window right now. Returns it (and marks it shown) or null.
    const findSessionToShow = () => {
      if (activeRef.current) return null; // don't stack popups
      const now = Date.now();
      const shown = readShownIds();
      for (const session of sessionsRef.current) {
        if (shown.has(session.id_no)) continue;
        const { start } = sessionToInstants(session);
        if (!start) continue;
        const startMs = start.getTime();
        if (now >= startMs && now <= startMs + POPUP_WINDOW_MS) {
          return session;
        }
      }
      return null;
    };

    const check = () => {
      const session = findSessionToShow();
      if (session) {
        markShown(session.id_no); // once-per-session, before display
        setActiveSession(session);
      }
    };

    // Run shortly after mount (give the fetch a beat) and then on an interval.
    const initial = setTimeout(check, 2000);
    const interval = setInterval(check, CHECK_MS);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const handleJoin = () => {
    const url = normalizeMeetUrl(activeSession?.meet_link);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setActiveSession(null);
  };

  const handleCancel = () => setActiveSession(null);

  return (
    <AnimatePresence>
      {activeSession && (
        <TrainingSessionPopup
          session={activeSession}
          onJoin={handleJoin}
          onCancel={handleCancel}
        />
      )}
    </AnimatePresence>
  );
};

export default TrainingSessionManager;
