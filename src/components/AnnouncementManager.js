// src/components/AnnouncementManager.js
// 2026 Redesign - Updated to use new AnnouncementService API

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import AnnouncementService from '../services/AnnouncementService';
import AnnouncementPopup from './AnnouncementPopup';

/**
 * Component to manage and display announcements after login
 *
 * 2026 Changes:
 * - Simplified: passes user object directly to service (no org_no lookup needed)
 * - Service handles audience_code filtering based on user.isGuest
 * - Supports guest users seeing audience_code 1 and 3
 */
const AnnouncementManager = ({ loggedInUser }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load active announcements on component mount
  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!loggedInUser) return;

      try {
        // Get active announcements for this user
        // Service handles filtering based on user type (guest vs registered)
        const activeAnnouncements = await AnnouncementService.getActiveAnnouncements(loggedInUser);

        setAnnouncements(activeAnnouncements);

        // Show the first announcement if there are any
        if (activeAnnouncements.length > 0) {
          setShowPopup(true);
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
    }
  };

  // Current announcement to display
  const currentAnnouncement = announcements[currentAnnouncementIndex];

  return (
    <AnimatePresence>
      {showPopup && currentAnnouncement && (
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
