// src/components/TrainingMatrix.js
// "Suggest a better time" availability matrix — lives in the /training sidebar,
// below the (display-only) calendar. A 7-day × 3-time-of-day grid of tappable
// vote circles lets anyone tell us when they'd prefer a session, since the
// fixed scheduled times won't work for everyone.
//
// Design (locked with the user):
//   • Tap circles to toggle preferences (green ring = your pick). Multi-select.
//   • Selections are local only until Submit — so deselect is just un-toggling,
//     nothing to delete server-side.
//   • Submit batches the picks to functions/training-request.js, which attributes
//     them to the caller's org (from the session cookie) or "Guest" and inserts
//     one row per pick. Browser writes to the table are blocked by policy.
//   • Each circle shows a live tally = votes in the trailing 30 days for that
//     day/time, shaded as a heatmap so the popular slots pop. Stale votes age out.
//
// ALWAYS OPEN — NO dedupe / lock. Login credentials are shared per organization
// and guests don't log in (30–50/day, possibly same device), so any per-browser
// or per-org lock would wrongly block real votes. The same person re-recording
// (e.g. changed their mind) is acceptable; re-submission is allowed at any time.
//
// We collect day-of-week (not a specific date) on purpose: we're reading trends
// to pick the next session, not satisfying every individual — which is why the
// "which Tuesday?" ambiguity is acceptable.

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { dataService } from "../services/dataService";

// Success toast — mirrors showAnimatedToast() in ZipCodePage.js (the email-sent /
// pdf-created toast) so confirmations look identical app-wide. Requires a
// <Toaster> mounted on the page (TrainingPage adds one).
const showSuccessToast = (msg) => {
  toast.custom(() => (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 400, opacity: 1 }}
      exit={{ y: 300, opacity: 0 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      className="mx-auto px-6 py-4 rounded-lg shadow-lg text-lg font-semibold text-white w-fit bg-green-600"
    >
      {msg}
    </motion.div>
  ));
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIME_COLS = [
  { key: "Morning", label: "Morning", sub: "8a - 12p", header: "var(--color-training-matrix-col-morning)" },
  { key: "Afternoon", label: "Afternoon", sub: "12p - 4p", header: "var(--color-training-matrix-col-afternoon)" },
  { key: "Evening", label: "Evening", sub: "4pm - 8p", header: "var(--color-training-matrix-col-evening)" },
];

const CIRCLE = 40; // vote-circle diameter (px)
const CREAM = "#FBF5E0"; // empty-circle base (count 0)
const HEAT_MAX = "#4D3D1A"; // circles darken cream → this as votes rise (monochrome, NOT the column colors)

const cellKey = (day, time) => `${day}|${time}`;

// Heatmap: keep the cream base at 0 votes and darken it progressively toward
// HEAT_MAX as `t` (count / maxCount, 0..1) rises. Plain hex lerp — deliberately
// NOT tied to the time-of-day column colors.
function heatColor(t) {
  if (t <= 0) return CREAM;
  const a = CREAM.replace("#", "");
  const b = HEAT_MAX.replace("#", "");
  const mix = (i) => {
    const av = parseInt(a.slice(i, i + 2), 16);
    const bv = parseInt(b.slice(i, i + 2), 16);
    return Math.round(av + (bv - av) * t);
  };
  const [r, g, bl] = [mix(0), mix(2), mix(4)];
  return `rgb(${r}, ${g}, ${bl})`;
}

export default function TrainingMatrix() {
  const [counts, setCounts] = useState({}); // "day|time" → vote count (30d)
  const [selected, setSelected] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dataService
      .getTrainingRequests()
      .then((rows) => {
        if (cancelled) return;
        const map = {};
        for (const r of rows || []) {
          const k = cellKey(r.day, r.time);
          map[k] = (map[k] || 0) + 1;
        }
        setCounts(map);
      })
      .catch((err) => console.error("TrainingMatrix load error", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const maxCount = useMemo(() => {
    const vals = Object.values(counts);
    return vals.length ? Math.max(...vals) : 0;
  }, [counts]);

  const toggle = (day, time) => {
    const k = cellKey(day, time);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const handleSubmit = () => {
    if (submitting || selected.size === 0) return;
    setSubmitting(true);

    const selections = Array.from(selected).map((k) => {
      const [day, time] = k.split("|");
      return { day, time };
    });

    // Optimistically bump the tally so the user sees their own votes land.
    setCounts((prev) => {
      const next = { ...prev };
      for (const k of selected) next[k] = (next[k] || 0) + 1;
      return next;
    });
    setSelected(new Set());
    showSuccessToast("✅ Thanks! We’ve recorded your preferred times.");

    // Fire-and-forget — never block the UI on the network. The grid stays open
    // for more votes immediately.
    fetch("/training-request", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections }),
    })
      .catch((err) => console.error("training-request failed", err))
      .finally(() => setSubmitting(false));
  };

  return (
    // marginTop is the (doubled) gap below the calendar.
    <div className="font-opensans w-full" style={{ marginTop: 56, maxWidth: 300 }}>
      {/* Prompt box — green border + green question line, and an arrow that
          nudges toward the call to action as if tapping it. */}
      <div
        style={{
          background: "var(--color-training-matrix-question-fill)",
          border: "1px solid var(--color-training-matrix-question)",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            color: "var(--color-training-matrix-question)",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          None of these dates &amp; times work?
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            className="training-arrow-nudge"
            aria-hidden="true"
            style={{ display: "inline-flex", flexShrink: 0, color: "var(--color-training-cal-text)" }}
          >
            <svg width="38" height="18" viewBox="0 0 38 18" fill="none" aria-hidden="true">
              <path
                d="M2 9 H30 M24 3 L33 9 L24 15"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span style={{ color: "var(--color-training-cal-text)", fontSize: 15, fontWeight: 500, lineHeight: 1.25 }}>
            Tap your preferences
          </span>
        </div>
      </div>


      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60px repeat(3, 1fr)",
          gap: 8,
          alignItems: "end",
          marginBottom: 10,
        }}
      >
        <div />
        {TIME_COLS.map((col) => (
          <div
            key={col.key}
            style={{
              background: col.header,
              color: "var(--color-training-matrix-col-text)",
              borderRadius: 16,
              padding: "6px 4px",
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500 }}>{col.label}</div>
            <div style={{ fontSize: 10, fontWeight: 500 }}>{col.sub}</div>
          </div>
        ))}
      </div>

      {/* Day rows */}
      {DAYS.map((day) => (
        <div
          key={day}
          style={{
            display: "grid",
            gridTemplateColumns: "60px repeat(3, 1fr)",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              background: "var(--color-training-matrix-day-bg)",
              color: "var(--color-training-matrix-day-text)",
              borderRadius: 20,
              padding: "13px 0",
              textAlign: "center",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {day}
          </div>

          {TIME_COLS.map((col) => {
            const k = cellKey(day, col.key);
            const count = counts[k] || 0;
            const isSelected = selected.has(k);
            const intensity = maxCount > 0 ? count / maxCount : 0;
            const bg = heatColor(intensity);
            const lightText = intensity > 0.5;
            return (
              <div key={k} style={{ display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  className="training-matrix-circle"
                  onClick={() => toggle(day, col.key)}
                  aria-pressed={isSelected}
                  aria-label={`${day} ${col.label}: ${count} votes${isSelected ? ", selected" : ""}`}
                  style={{
                    width: CIRCLE,
                    height: CIRCLE,
                    borderRadius: "50%",
                    background: bg,
                    color: lightText ? "#FFFFFF" : "var(--color-training-matrix-circle-text)",
                    border: isSelected
                      ? "3px solid var(--color-training-matrix-selected-border)"
                      : "3px solid transparent",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {count}
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {/* Submit — appears only once at least one circle is tapped (the prompt
          already tells them to tap, so no idle "tap your times" label). */}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="hover:brightness-110"
          style={{
            marginTop: 16,
            width: "100%",
            height: 42,
            borderRadius: 8,
            border: "none",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--color-training-matrix-submit-text)",
            background: "var(--color-training-matrix-question)",
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting
            ? "Submitting…"
            : `Submit ${selected.size} ${selected.size === 1 ? "preference" : "preferences"}`}
        </button>
      )}
    </div>
  );
}
