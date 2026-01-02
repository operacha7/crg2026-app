// src/services/AnnouncementService.js
import { supabase } from '../MainApp';
import { dataService } from '../services/dataService';

const AnnouncementService = {
  /**
   * Get active announcements for a specific organization by org_no
   * @param {string} orgNo - The organization number
   * @returns {Promise<Array>} - Array of active announcements
   */
  getActiveAnnouncementsByOrgNo: async (orgNo) => {
    try {
      const now = new Date().toISOString();
      
      // Get announcements where:
      // 1. They are active
      // 2. Current date is between start and expiration dates
      // 3. Either org_no is null (universal) OR org_no contains this org's number
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('expiration_date', now)
        .or(`org_no.is.null,org_no.cs.{${orgNo}}`)
        .order('priority', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error getting active announcements:', error);
      return [];
    }
  },
  
  /**
   * Get ALL announcements for a specific organization (active, expired, scheduled)
   * @param {string} organizationName - The organization name
   * @returns {Promise<Array>} - Array of all announcements
   */
  getAllAnnouncements: async (organizationName) => {
    try {
      // First, get the org_no for this organization
      const registeredOrgs = await dataService.getRegisteredOrganizations();
      const userOrg = registeredOrgs.find(
        org => org.registered_organization === organizationName
      );
      
      if (!userOrg || !userOrg.org_no) {
        console.error('Organization not found or no org_no available');
        return [];
      }
      
      // Get ALL announcements for this organization (including expired, scheduled)
      // Either universal (org_no is null) OR targeted to this org
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .or(`org_no.is.null,org_no.cs.{${userOrg.org_no}}`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error getting all announcements:', error);
      return [];
    }
  },
  
  /**
   * Legacy method - kept for backward compatibility
   * @param {string} organizationName - The organization name
   * @returns {Promise<Array>} - Array of active announcements
   */
  getActiveAnnouncements: async (organizationName) => {
    console.warn('getActiveAnnouncements by name is deprecated, use getActiveAnnouncementsByOrgNo instead');
    try {
      // This is a fallback method that will work but is less efficient
      // First get all organizations to find the org_no
      const { data: orgs, error: orgsError } = await supabase
        .from('registered_organizations')
        .select('*')
        .eq('registered_organization', organizationName);
      
      if (orgsError || !orgs || orgs.length === 0) {
        console.error('Organization not found:', organizationName);
        return [];
      }
      
      const orgNo = orgs[0].org_no;
      
      // Use the new method
      return AnnouncementService.getActiveAnnouncementsByOrgNo(orgNo);
    } catch (error) {
      console.error('Error in legacy getActiveAnnouncements:', error);
      return [];
    }
  }
};

export default AnnouncementService;