// src/components/AnnouncementPopup.js
// 2026 Redesign - Typewriter/Memo style announcement popup

import React from 'react';
import { motion } from 'framer-motion';
import AnnouncementService from '../services/AnnouncementService';

const AnnouncementPopup = ({ announcement, onClose, currentIndex, totalCount }) => {
  // Format the date to display like "January 8, 2026"
  // Parse as UTC to avoid timezone shift (dates come as YYYY-MM-DD from Supabase)
  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Recency highlight: the Date value gets a bright pink background that fades
  // by how many days the announcement has been live (from start_date):
  //   day 1 → 100%, day 2 → 50%, day 3 → 20%, day 4 and after → 0% (no highlight).
  // Purely date-driven (no per-user "seen" state), so guests and shared
  // computers behave identically — a fresh announcement always glows brightest.
  const freshnessAlpha = (startDateString) => {
    const [year, month, day] = startDateString.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysLive = Math.floor((today - start) / 86400000); // 0 on the start date
    if (daysLive <= 0) return 1;    // first day (or future-dated safety) → full
    if (daysLive === 1) return 0.5; // second day
    if (daysLive === 2) return 0.2; // third day
    return 0;                       // fourth day onward → no highlight
  };
  const dateHighlight = `rgba(var(--color-memo-date-fresh-rgb), ${freshnessAlpha(announcement.start_date)})`;

  // Get the "To:" display text from the service
  const toText = AnnouncementService.getAudienceDisplayText(announcement);

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--color-panel-scrim-bg)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Container for paper + button (button is outside paper) */}
      <div
        className="flex flex-col items-center"
        style={{
          maxHeight: '90vh',
          padding: '20px',
        }}
      >
        {/* The memo "paper" */}
        <motion.div
          className="relative flex flex-col"
          style={{
            backgroundColor: 'var(--color-memo-bg)',
            maxWidth: 'var(--width-memo-max)',
            width: '90vw',
            maxHeight: 'calc(90vh - 80px)', // Leave room for button below
            boxShadow: '10px 10px 30px var(--color-memo-shadow)',
            fontFamily: 'var(--font-family-memo)',
          }}
          initial={{ scale: 0.9, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Fixed header section (doesn't scroll) */}
          <div
            style={{
              padding: 'var(--padding-memo)',
              paddingBottom: '0',
              flexShrink: 0,
            }}
          >
            {/* CRG Logo - top right */}
            <img
              src="/images/CRG Logo 2025.webp"
              alt="CRG Logo"
              style={{
                position: 'absolute',
                top: 'var(--top-memo-logo)',
                right: 'var(--padding-memo)',
                width: 'var(--size-memo-logo)',
                height: 'var(--size-memo-logo)',
              }}
            />

            {/* "memo" title - large, blue. Decorative; not a heading
                (the page-level h1 lives elsewhere). aria-hidden so screen
                readers skip the visual flourish and announce the actual
                memo subject from the Subject row below. */}
            <div
              aria-hidden="true"
              style={{
                fontSize: 'var(--font-size-memo-title)',
                fontWeight: 'var(--font-weight-memo-title)',
                color: 'var(--color-memo-title)',
                letterSpacing: '0.15em',
                marginBottom: '40px',
                lineHeight: 1,
              }}
            >
              memo
            </div>

            {/* Memo fields: Date, To, Subject */}
            <div
              style={{
                fontSize: 'var(--font-size-memo-label)',
                color: 'var(--color-memo-text)',
                marginBottom: '30px',
                lineHeight: 'var(--line-height-memo)',
              }}
            >
              {/* Date row */}
              <div className="flex mb-1">
                <span
                  style={{
                    fontWeight: 'var(--font-weight-memo-label)',
                    width: '80px',
                  }}
                >
                  Date:
                </span>
                <span
                  style={{
                    fontWeight: 'var(--font-weight-memo-body)',
                    backgroundColor: dateHighlight,
                    padding: '1px 8px',
                    borderRadius: '3px',
                  }}
                >
                  {formatDate(announcement.start_date)}
                </span>
              </div>

              {/* To row */}
              <div className="flex mb-1">
                <span
                  style={{
                    fontWeight: 'var(--font-weight-memo-label)',
                    width: '80px',
                  }}
                >
                  To:
                </span>
                <span style={{ fontWeight: 'var(--font-weight-memo-body)' }}>
                  {toText}
                </span>
              </div>

              {/* Subject row */}
              <div className="flex flex-1">
                <span
                  style={{
                    fontWeight: 'var(--font-weight-memo-label)',
                    width: '80px',
                    flexShrink: 0,
                  }}
                >
                  Subject:
                </span>
                {announcement.title_html ? (
                  <span
                    style={{ fontWeight: 'var(--font-weight-memo-body)', flex: 1 }}
                    dangerouslySetInnerHTML={{ __html: announcement.title_html }}
                  />
                ) : (
                  <span style={{ fontWeight: 'var(--font-weight-memo-body)' }}>
                    {announcement.title}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable body section */}
          <div
            className="memo-body overflow-y-auto"
            style={{
              fontSize: 'var(--font-size-memo-body)',
              fontWeight: 'var(--font-weight-memo-body)',
              color: 'var(--color-memo-text)',
              lineHeight: 'var(--line-height-memo)',
              padding: '0 var(--padding-memo) var(--padding-memo) var(--padding-memo)',
              minHeight: '100px',
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: announcement.message_html }} />
            {announcement.expiration_date && (
              <div
                style={{
                  marginTop: '32px',
                  textAlign: 'right',
                  fontSize: 'var(--font-size-memo-expires)',
                  color: 'var(--color-memo-title)',
                  fontWeight: 'var(--font-weight-memo-body)',
                }}
              >
                Expires: {formatDate(announcement.expiration_date)}
              </div>
            )}
          </div>
        </motion.div>

        {/* Button - outside the paper, uses standard panel button tokens */}
        {/* Shows "Next (1/3)" for intermediate memos, "Close (3/3)" for the last one */}
        <button
          onClick={onClose}
          className="font-opensans transition-all duration-200 hover:brightness-110"
          style={{
            marginTop: 'var(--gap-memo-btn-paper)',
            backgroundColor: currentIndex < totalCount - 1
              ? 'var(--color-panel-btn-ok-bg)'
              : 'var(--color-panel-btn-cancel-bg)',
            color: 'var(--color-panel-btn-text)',
            minWidth: 'var(--width-panel-btn)',
            paddingLeft: '20px',
            paddingRight: '20px',
            height: 'var(--height-panel-btn)',
            borderRadius: 'var(--radius-panel-btn)',
            fontSize: 'var(--font-size-panel-btn)',
            letterSpacing: 'var(--letter-spacing-panel-btn)',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {currentIndex < totalCount - 1 ? 'Next' : 'Close'} ({currentIndex + 1}/{totalCount})
        </button>
      </div>
    </motion.div>
  );
};

export default AnnouncementPopup;
