// src/services/AnnouncementService.js
// Updated for 2026 redesign - new table structure with audience_code and message_html

import { supabase } from '../supabaseClient';

// The audience token for the current viewer: registered orgs use their org name,
// guests use the literal "Guest" (a valid code-3 target — the guest object has no
// reg_organization, just organization: 'Guest').
function viewerIdentity(user) {
  if (user?.isGuest) return 'Guest';
  return (user?.reg_organization || '').trim();
}

// Split a code-3 target field into a normalized list. The field may hold MULTIPLE
// comma-separated targets ("Org A, Guest, Org B"). Null/empty → [] which callers
// treat as "everyone" (the documented default when a code-3 row has no target).
function parseTargets(regOrg) {
  if (!regOrg) return [];
  return String(regOrg)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Whether `user` may see `announcement`, by audience_code:
//   1 → everyone (guests + registered)
//   2 → registered organizations only (not guests)
//   3 → specific targets in reg_organization (Guest is a valid target); a
//       null/empty target list defaults to everyone
//   anything else → everyone (safe default, matches getAudienceDisplayText)
// Applied client-side (not in the query) so multi-value targets and the
// null→everyone rule are handled precisely, and org names with quotes/commas
// can't break a PostgREST filter string.
function canViewAnnouncement(announcement, user) {
  const code = Number(announcement.audience_code);
  const isGuest = !!user?.isGuest;

  if (code === 2) return !isGuest;
  if (code === 3) {
    const targets = parseTargets(announcement.reg_organization);
    if (targets.length === 0) return true; // no target → everyone
    return targets.includes(viewerIdentity(user).toLowerCase());
  }
  return true; // code 1 (or unexpected) → everyone
}

const AnnouncementService = {
  canViewAnnouncement,

  /**
   * Get active announcements for a user based on their login status.
   *
   * Audience codes (2026):
   * - 1 = All CRG Users (everyone, including guests)
   * - 2 = Registered Organizations (logged-in users only, not guests)
   * - 3 = Specific target(s) in reg_organization — one or more comma-separated
   *       registered orgs and/or "Guest"; null/empty target defaults to everyone
   *
   * Fetches the active date window, then filters by audience client-side
   * (see canViewAnnouncement) so multi-value targets, Guest targeting, and the
   * null→everyone default all work.
   *
   * @param {Object} user - The logged in user object
   * @param {boolean} user.isGuest - Whether this is a guest user
   * @param {string} user.reg_organization - The org name (for registered users)
   * @returns {Promise<Array>} - Array of active announcements
   */
  getActiveAnnouncements: async (user) => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .lte('start_date', today)
        .gte('expiration_date', today)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return (data || []).filter((a) => canViewAnnouncement(a, user));
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
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      return (data || []).filter((a) => canViewAnnouncement(a, user));
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
