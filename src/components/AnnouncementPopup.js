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

  // Get the "To:" display text from the service
  const toText = AnnouncementService.getAudienceDisplayText(announcement);

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--color-memo-overlay-bg)' }}
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
            fontFamily: 'var(--font-family-body)',
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

            {/* "memo" title - large, blue */}
            <h1
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
            </h1>

            {/* Memo fields: Date, To, Subject */}
            <div
              style={{
                fontSize: 'var(--font-size-memo-label)',
                color: 'var(--color-memo-text)',
                marginBottom: '30px',
                lineHeight: 1.4,
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
                <span style={{ fontWeight: 'var(--font-weight-memo-body)' }}>
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
              <div className="flex">
                <span
                  style={{
                    fontWeight: 'var(--font-weight-memo-label)',
                    width: '80px',
                  }}
                >
                  Subject:
                </span>
                <span style={{ fontWeight: 'var(--font-weight-memo-body)' }}>
                  {announcement.title}
                </span>
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
              lineHeight: 1.4,
              padding: '0 var(--padding-memo) var(--padding-memo) var(--padding-memo)',
              minHeight: '100px',
            }}
            dangerouslySetInnerHTML={{ __html: announcement.message_html }}
          />
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
