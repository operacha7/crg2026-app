// src/services/dataService.js
// Data service for CRG 2026 - connects to Supabase tables
// Tables: directory, assistance, organizations, zip_codes, registered_organizations

import { supabase } from "../MainApp";

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Calculate distance using Haversine formula
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in miles
};

// Parse coordinates string "lat, lng" to object { lat, lng }
const parseCoordinates = (coordString) => {
  if (!coordString) return null;
  const coords = coordString.split(',').map(c => parseFloat(c.trim()));
  if (coords.length !== 2 || coords.some(isNaN)) return null;
  return { lat: coords[0], lng: coords[1] };
};

// ============================================================
// DATA SERVICE
// ============================================================

export const dataService = {
  // ======= DIRECTORY (main resources table) =======
  // ~836 records, expect ~1000
  async getDirectory() {
    const { data, error } = await supabase
      .from('directory')
      .select('*')
      .order('organization', { ascending: true });

    if (error) {
      console.error("Error fetching directory:", error);
      return [];
    }
    return data;
  },

  // Get directory with calculated distance from a reference point
  async getDirectoryWithDistance(referenceCoordinates) {
    try {
      const directory = await this.getDirectory();

      const refCoords = parseCoordinates(referenceCoordinates);
      if (!refCoords) {
        console.error("Invalid reference coordinates:", referenceCoordinates);
        return directory;
      }

      // Calculate distance for each record
      const directoryWithDistance = directory.map(record => {
        const recordCoords = parseCoordinates(record.org_coordinates);
        if (!recordCoords) {
          return { ...record, distance: 999999 };
        }

        const distance = calculateDistance(
          refCoords.lat, refCoords.lng,
          recordCoords.lat, recordCoords.lng
        );

        return {
          ...record,
          distance: parseFloat(distance.toFixed(1))
        };
      });

      // Sort by status_id (1=Active, 2=Limited, 3=Inactive), then by distance
      directoryWithDistance.sort((a, b) => {
        const statusDiff = (a.status_id || 4) - (b.status_id || 4);
        if (statusDiff !== 0) return statusDiff;
        return (a.distance || 999999) - (b.distance || 999999);
      });

      return directoryWithDistance;
    } catch (error) {
      console.error("Error calculating distances:", error);
      return await this.getDirectory();
    }
  },

  // ======= ASSISTANCE (28 records - static) =======
  async getAssistance() {
    const { data, error } = await supabase
      .from('assistance')
      .select('id_no, assistance, group, icon, assist_id')
      .order('id_no', { ascending: true });

    if (error) {
      console.error("Error fetching assistance:", error);
      return [];
    }
    return data;
  },

  // ======= ORGANIZATIONS (~452 records) =======
  async getOrganizations() {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('organization', { ascending: true });

    if (error) {
      console.error("Error fetching organizations:", error);
      return [];
    }
    return data;
  },

  // ======= ZIP CODES (269 records - static) =======
  async getZipCodes() {
    const { data, error } = await supabase
      .from('zip_codes')
      .select('*')
      .order('zip_code', { ascending: true });

    if (error) {
      console.error("Error fetching zip codes:", error);
      return [];
    }
    return data;
  },

  // Get single zip code by zip
  async getZipCodeByZip(zipCode) {
    const { data, error } = await supabase
      .from('zip_codes')
      .select('*')
      .eq('zip_code', zipCode)
      .single();

    if (error) {
      console.error(`Error fetching zip code ${zipCode}:`, error);
      return null;
    }
    return data;
  },

  // ======= REGISTERED ORGANIZATIONS (auth - implement last) =======
  async getRegisteredOrganizations() {
    const { data, error } = await supabase
      .from('registered_organizations')
      .select('*')
      .order('reg_organization', { ascending: true });

    if (error) {
      console.error("Error fetching registered organizations:", error);
      return [];
    }
    return data;
  },

  async getRegisteredOrgByPasscode(passcode) {
    const { data, error } = await supabase
      .from('registered_organizations')
      .select('*')
      .eq('org_passcode', passcode)
      .single();

    if (error) {
      console.error("Error fetching registered org by passcode:", error);
      return null;
    }
    return data;
  },
};

// Export helper functions for use elsewhere if needed
export { calculateDistance, parseCoordinates };
