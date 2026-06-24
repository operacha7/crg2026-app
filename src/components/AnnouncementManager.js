// src/components/AnnouncementManager.js
// 2026 Redesign - Updated to use new AnnouncementService API

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import AnnouncementService from '../services/AnnouncementService';
import AnnouncementPopup from './AnnouncementPopup';

// Module-level flag: have announcements already been presented during THIS page
// load? It survives client-side route changes (which can unmount/remount this
// component — e.g. arriving at /support from a top-level App.js page like /about
// or /privacy mounts MainApp, and AnnouncementManager with it) but resets on a
// genuine page reload. That's precisely the "only on first log-on or refresh"
// boundary: component state (`initialized`) can't do this because it's wiped on
// every remount. Reset on logout so a fresh login the same session re-shows.
let announcementsShownThisLoad = false;
export function resetAnnouncementsShown() {
  announcementsShownThisLoad = false;
}

/**
 * Component to manage and display announcements after login
 *
 * 2026 Changes:
 * - Simplified: passes user object directly to service (no org_no lookup needed)
 * - Service handles audience_code filtering based on user.isGuest
 * - Supports guest users seeing audience_code 1 and 3
 */
const AnnouncementManager = ({ loggedInUser, onComplete }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fire onComplete exactly once — when the last announcement is dismissed, or
  // immediately if there are none / they're suppressed (mobile). The training
  // popup waits on this so it never stacks on top of an announcement.
  const completedRef = useRef(false);
  const fireComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }, [onComplete]);

  // Defer the popup while the login modal is up — otherwise the announcement
  // stacks behind the modal where it can't be read or dismissed. Once the user
  // logs in or cancels, ?login=1 is stripped and the popup renders normally.
  const [searchParams] = useSearchParams();
  const isLoginModalOpen = searchParams.get('login') === '1';

  // Load active announcements on component mount
  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!loggedInUser) return;

      // Already shown earlier this page load (e.g. on first /find landing).
      // A remount from cross-layer navigation (App.js page → /support) must NOT
      // re-show them — only a real refresh/login should. Unblock training and bail.
      if (announcementsShownThisLoad) {
        setInitialized(true);
        fireComplete();
        return;
      }

      // Suppress announcement popups on mobile (< lg breakpoint).
      // Desktop users still see them; announcements remain accessible via the Announcements page.
      if (window.matchMedia("(max-width: 1023px)").matches) {
        setInitialized(true);
        fireComplete(); // no announcements shown on mobile → unblock the training popup
        return;
      }

      try {
        // Get active announcements for this user
        // Service handles filtering based on user type (guest vs registered)
        const activeAnnouncements = await AnnouncementService.getActiveAnnouncements(loggedInUser);

        setAnnouncements(activeAnnouncements);

        // Show the first announcement if there are any. Mark them shown for the
        // rest of this page load so a later remount doesn't replay them.
        if (activeAnnouncements.length > 0) {
          announcementsShownThisLoad = true;
          setShowPopup(true);
        } else {
          fireComplete(); // nothing to show → unblock the training popup now
        }

        setInitialized(true);
      } catch (error) {
        console.error('Error loading announcements:', error);
        setInitialized(true);
      }
    };

    if (loggedInUser && !initialized) {
      fetchAnnouncements();
    }
  }, [loggedInUser, initialized]);

  // Handle closing the current announcement
  const handleCloseAnnouncement = () => {
    // Check if there are more announcements to show
    if (currentAnnouncementIndex < announcements.length - 1) {
      // Show the next announcement
      setCurrentAnnouncementIndex(currentAnnouncementIndex + 1);
    } else {
      // No more announcements, close the popup
      setShowPopup(false);
      fireComplete(); // last one dismissed → the training popup may now appear
    }
  };

  // Current announcement to display
  const currentAnnouncement = announcements[currentAnnouncementIndex];

  return (
    <AnimatePresence>
      {showPopup && currentAnnouncement && !isLoginModalOpen && (
        <AnnouncementPopup
          announcement={currentAnnouncement}
          onClose={handleCloseAnnouncement}
          currentIndex={currentAnnouncementIndex}
          totalCount={announcements.length}
        />
      )}
    </AnimatePresence>
  );
};

export default AnnouncementManager;
