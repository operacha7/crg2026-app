// src/components/AnnouncementManager.js
import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import AnnouncementService from '../services/AnnouncementService';
import AnnouncementPopup from './AnnouncementPopup';
import { dataService } from '../services/dataService'; // Add this import

/**
 * Component to manage and display announcements after login
 */
const AnnouncementManager = ({ loggedInUser }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load active announcements on component mount
  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!loggedInUser || !loggedInUser.registered_organization) return;

      try {
        // First, get the org_no for this organization
        const registeredOrgs = await dataService.getRegisteredOrganizations();
        const userOrg = registeredOrgs.find(
          org => org.registered_organization === loggedInUser.registered_organization
        );
        
        if (!userOrg || !userOrg.org_no) {
          console.error('Organization not found or no org_no available');
          setInitialized(true);
          return;
        }
        
        // Get active announcements for this organization using org_no
        const activeAnnouncements = await AnnouncementService.getActiveAnnouncementsByOrgNo(
          userOrg.org_no
        );

        // Use all active announcements instead of filtering seen ones
        // This ensures they show on every login until expiration
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
        />
      )}
    </AnimatePresence>
  );
};

export default AnnouncementManager;