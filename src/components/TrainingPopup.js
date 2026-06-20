// src/components/TrainingPopup.js
// In-app modal nudging the user to a training session scheduled today. Opened by
// the trigger in MainApp on the first /find landing of the day, AFTER any
// announcements. Body is the shared SessionCard (same panel as /training).
//
// Anti-reflexive-dismiss design (users speed-close week-old announcements and
// would carry that into closing this unread):
//   - it slides UP into view (announcements scale in from above — different
//     motion + place, so the brain registers "this is new")
//   - the X fades in ~0.5s AFTER the panel settles, so an early reflexive click
//     where the announcement's close button was finds nothing clickable
//   - there is NO close-on-backdrop-click — only the X dismisses it
// On close it "shooshes" — shrinks and flies down into the teal-footer Training
// Session button (functional motion teaching where it parked).

import { useEffect, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import SessionCard from "./SessionCard";
import { useTraining } from "../Contexts/TrainingContext";

const X_READY_MS = 550; // X becomes visible/clickable this long after open

export default function TrainingPopup() {
  const {
    upcomingSession,
    now,
    popupOpen,
    closePopup,
    minimize,
    footerButtonRef,
    getCount,
    isAdded,
    trackCalendarAdd,
  } = useTraining();

  const panelRef = useRef(null);
  const panelControls = useAnimation();
  const scrimControls = useAnimation();
  const [xReady, setXReady] = useState(false);
  const [closing, setClosing] = useState(false);

  // Entrance: scrim fades in, panel slides up + scales in. X arms after a beat.
  useEffect(() => {
    if (!popupOpen) return;
    setXReady(false);
    setClosing(false);
    scrimControls.start({ opacity: 1, transition: { duration: 0.25 } });
    panelControls.start({
      y: 0,
      scale: 1,
      opacity: 1,
      transition: { type: "spring", damping: 26, stiffness: 320 },
    });
    const t = setTimeout(() => setXReady(true), X_READY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupOpen]);

  if (!popupOpen || !upcomingSession) return null;

  const handleClose = async () => {
    if (closing) return;
    setClosing(true);
    // Reveal + persist the footer indicator FIRST so the panel has something to
    // fly into (before this, the footer shows the plain "Training" link).
    minimize();

    // Respect reduced-motion: skip the whoosh, just fade out quickly.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      scrimControls.start({ opacity: 0, transition: { duration: 0.2 } });
      await panelControls.start({ opacity: 0, transition: { duration: 0.2 } });
      closePopup();
      return;
    }

    // Wait for the footer button to mount, then measure its position.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    const panel = panelRef.current;
    const target = footerButtonRef?.current;
    scrimControls.start({ opacity: 0, transition: { duration: 0.4 } });

    if (panel && target) {
      const p = panel.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const dx = t.left + t.width / 2 - (p.left + p.width / 2);
      const dy = t.top + t.height / 2 - (p.top + p.height / 2);

      // 1) Anticipation wind-up — a quick breath before the leap.
      await panelControls.start({ scale: 1.05, transition: { duration: 0.09, ease: "easeOut" } });
      // 2) Accelerating "gravity" dive into the footer button (ease-in bezier:
      //    slow start, fast finish, so it gets yanked down).
      await panelControls.start({
        x: dx,
        y: dy,
        scale: 0.08,
        opacity: 0,
        transition: { duration: 0.42, ease: [0.4, 0, 1, 1] },
      });
      // 3) The footer button "catches" it — squash-and-stretch + a glow flash.
      //    Web Animations API so it composes with the CSS pulse (different
      //    props) and needs no React plumbing across components.
      if (target.animate) {
        target.animate(
          [
            { transform: "scale(1)", filter: "brightness(1)" },
            {
              transform: "scale(1.2)",
              filter: "brightness(1.45) drop-shadow(0 0 10px rgba(255,255,255,0.85))",
              offset: 0.45,
            },
            { transform: "scale(0.95)", offset: 0.72 },
            { transform: "scale(1)", filter: "brightness(1)" },
          ],
          { duration: 400, easing: "ease-out" }
        );
      }
    } else {
      // No target located — just shrink + fade in place.
      await panelControls.start({ opacity: 0, scale: 0.85, transition: { duration: 0.3, ease: "easeInOut" } });
    }

    closePopup();
  };

  const id = upcomingSession.id_no;

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: "var(--color-panel-scrim-bg)", zIndex: 60 }}
      initial={{ opacity: 0 }}
      animate={scrimControls}
    >
      <motion.div
        ref={panelRef}
        className="relative"
        style={{ width: 600, maxWidth: "92vw" }}
        initial={{ y: 34, scale: 0.96, opacity: 0 }}
        animate={panelControls}
      >
        <SessionCard
          session={upcomingSession}
          now={now}
          count={getCount(id)}
          alreadyAdded={isAdded(id)}
          onCalendarAdd={() => trackCalendarAdd(upcomingSession)}
          singleRowGrid
        />

        {/* Close (X) — fades in after the panel settles; not clickable until then */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="hover:brightness-110"
          style={{
            position: "absolute",
            top: -14,
            right: -14,
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "2px solid #FFFFFF",
            background: "#222831",
            color: "#FFFFFF",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
            opacity: xReady ? 1 : 0,
            pointerEvents: xReady ? "auto" : "none",
            transition: "opacity 0.3s ease",
          }}
        >
          ×
        </button>
      </motion.div>
    </motion.div>
  );
}
