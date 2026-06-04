// src/components/TrainingSessionPopup.js
// In-app modal that nudges a user to join a training session that is starting
// now. Shown by TrainingSessionManager to anyone using the app when a session
// enters its "starting now" window. Mirrors the on-screen Training card: title,
// when, optional description, a green "Join Now" button (opens the Meet link),
// and a Cancel button to dismiss.

import React from "react";
import { motion } from "framer-motion";
import { formatSessionDateTime } from "../utils/calendar";

const TrainingSessionPopup = ({ session, onJoin, onCancel }) => {
  const { dateLabel, timeLabel } = formatSessionDateTime(session);

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "var(--color-panel-scrim-bg)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="font-opensans relative flex flex-col"
        style={{
          background: "var(--color-home-panel-bg)",
          borderRadius: 14,
          padding: "26px 28px",
          width: 460,
          maxWidth: "92vw",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.35)",
          color: "#1A1A1A",
        }}
        initial={{ scale: 0.9, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: -20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#B8001F",
            marginBottom: 10,
          }}
        >
          🔴 Starting Now
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, lineHeight: 1.2 }}>
          {session.title || "CRG Houston Training"}
        </h2>

        {dateLabel && (
          <div style={{ fontSize: 15, fontWeight: 600, color: "#2D3D3D" }}>{dateLabel}</div>
        )}
        {timeLabel && (
          <div style={{ fontSize: 14, color: "#4A4A4A", marginTop: 2 }}>{timeLabel}</div>
        )}
        {session.description && (
          <p style={{ fontSize: 14, color: "#4A4A4A", marginTop: 10, lineHeight: 1.5 }}>
            {session.description}
          </p>
        )}

        <p style={{ fontSize: 15, color: "#1A1A1A", marginTop: 16, marginBottom: 20, lineHeight: 1.5 }}>
          This training session is starting now. Would you like to join?
        </p>

        <div className="flex" style={{ gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            className="hover:brightness-110"
            style={{
              background: "#D7D5D1",
              color: "#3A3A3A",
              border: "none",
              borderRadius: 8,
              height: 44,
              padding: "0 22px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onJoin}
            disabled={!session.meet_link}
            className="hover:brightness-110"
            style={{
              background: "#228B22",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 8,
              height: 44,
              padding: "0 24px",
              fontSize: 16,
              fontWeight: 700,
              cursor: session.meet_link ? "pointer" : "not-allowed",
              opacity: session.meet_link ? 1 : 0.6,
            }}
          >
            ▶ Join Now
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TrainingSessionPopup;
