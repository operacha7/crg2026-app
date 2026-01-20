// src/services/AnnouncementService.js
// Updated for 2026 redesign - new table structure with audience_code and message_html

import { supabase } from '../MainApp';

const AnnouncementService = {
  /**
   * Get active announcements for a user based on their login status
   *
   * Audience codes (2026):
   * - 1 = All CRG Users (everyone sees, including guests)
   * - 2 = Registered Organizations (only logged-in users, not guests)
   * - 3 = Specific Organization (only the org in reg_organization field)
   *
   * Note: Guest-only code was removed (redundant - only one Guest account)
   *
   * @param {Object} user - The logged in user object
   * @param {boolean} user.isGuest - Whether this is a guest user
   * @param {string} user.reg_organization - The org name (for registered users)
   * @returns {Promise<Array>} - Array of active announcements
   */
  getActiveAnnouncements: async (user) => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      if (user.isGuest) {
        // Guests only see audience_code 1 (All CRG Users)
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .lte('start_date', today)
          .gte('expiration_date', today)
          .eq('audience_code', 1)
          .order('start_date', { ascending: false });

        if (error) throw error;
        return data || [];
      } else {
        // Registered users see: audience_code 1 (All), 2 (Registered), or 3 (their specific org)
        // Use separate query for code 3 to handle org name matching properly
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .lte('start_date', today)
          .gte('expiration_date', today)
          .or(`audience_code.in.(1,2),and(audience_code.eq.3,reg_organization.eq."${user.reg_organization}")`)
          .order('start_date', { ascending: false });

        if (error) throw error;
        return data || [];
      }
    } catch (error) {
      console.error('Error getting active announcements:', error);
      return [];
    }
  },

  /**
   * Get ALL announcements for the MessagesPage history view
   * Shows all announcements the user is allowed to see (active, expired, future)
   *
   * @param {Object} user - The logged in user object
   * @returns {Promise<Array>} - Array of all announcements for this user
   */
  getAllAnnouncements: async (user) => {
    try {
      if (user.isGuest) {
        // Guests only see audience_code 1 (All CRG Users)
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('audience_code', 1)
          .order('start_date', { ascending: false });

        if (error) throw error;
        return data || [];
      } else {
        // Registered users see: audience_code 1 (All), 2 (Registered), or 3 (their specific org)
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .or(`audience_code.in.(1,2),and(audience_code.eq.3,reg_organization.eq."${user.reg_organization}")`)
          .order('start_date', { ascending: false });

        if (error) throw error;
        return data || [];
      }
    } catch (error) {
      console.error('Error getting all announcements:', error);
      return [];
    }
  },

  /**
   * Get the "To:" display text based on audience_code
   * @param {Object} announcement - The announcement object
   * @returns {string} - Display text for the "To:" field
   */
  getAudienceDisplayText: (announcement) => {
    switch (announcement.audience_code) {
      case 1:
        return 'All CRG Users';
      case 2:
        return 'Registered Organizations';
      case 3:
        return announcement.reg_organization || 'Specific Organization';
      default:
        return 'All CRG Users';
    }
  }
};

export default AnnouncementService;
