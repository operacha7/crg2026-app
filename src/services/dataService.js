// src/services/dataService.js
import { supabase } from "../MainApp"; // Import from MainApp.js

// Helper function to calculate distance using Haversine formula
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

// Helper function to parse coordinates string
const parseCoordinates = (coordString) => {
  if (!coordString) return null;
  // Handle both "lat,lng" and "lat, lng" formats
  const coords = coordString.split(',').map(c => parseFloat(c.trim()));
  if (coords.length !== 2 || coords.some(isNaN)) return null;
  return { lat: coords[0], lng: coords[1] };
};



// Main data service object with functions for all tables
export const dataService = {
  // ======= REGISTERED ORGANIZATIONS (Table6.json) =======
  async getRegisteredOrganizations() {
    const { data, error } = await supabase
      .from('registered_organizations')
      .select('*')
      .order('registered_organization', { ascending: true });
    
    if (error) {
      console.error("Error fetching registered organizations:", error);
      return [];
    }
    return data;
  },
  
  async getOrganizationById(id) {
    const { data, error } = await supabase
      .from('registered_organizations')
      .select('*')
      .eq('id_no', id)
      .single();
    
    if (error) {
      console.error(`Error fetching organization with id ${id}:`, error);
      return null;
    }
    return data;
  },
  
  // ======= ASSISTANCE TYPES (Table3EN.json and Table3ES.json) =======
  async getAssistanceTypesEn() {
    const { data, error } = await supabase
      .from('assistance_types_en')
      .select('*');
    
    if (error) {
      console.error("Error fetching English assistance types:", error);
      return [];
    }
    return data;
  },
  
  async getAssistanceTypesEs() {
    const { data, error } = await supabase
      .from('assistance_types_es')
      .select('*');
    
    if (error) {
      console.error("Error fetching Spanish assistance types:", error);
      return [];
    }
    return data;
  },
  
  // ======= ZIP CODES (Table1.json) =======
  async getZipCodes() {
    const { data, error } = await supabase
      .from('zip_codes')
      .select('*');
    
    if (error) {
      console.error("Error fetching zip codes:", error);
      return [];
    }
    return data;
  },
  
  async getZipCodeByZip(zip_code) {
    const { data, error } = await supabase
      .from('zip_codes')
      .select('*')
      .eq('zip_code', zip_code)
      .single();
    
    if (error) {
      console.error(`Error fetching zip code ${zip_code}:`, error);
      return null;
    }
    return data;
  },
  
  // ======= RESOURCES (Sheet1.json and Sheet2.json) =======
  async getResourcesEn() {
    const { data, error } = await supabase
      .from('resources_en')
      .select('*')
      .order('priority', { ascending: true })
      .order('organization', { ascending: true })
      .order('assistance', { ascending: true });
  
    if (error) {
      console.error("Error fetching English resources:", error);
      return [];
    }
    return data;
  },
  
  async getResourcesEs() {
    const { data, error } = await supabase
      .from('resources_es')
      .select('*')
      .order('priority', { ascending: true })
      .order('organization', { ascending: true })
      .order('assistance', { ascending: true });
    
    if (error) {
      console.error("Error fetching Spanish resources:", error);
      return [];
    }
    return data;
  },

  // ======= NEW: RESOURCES WITH DISTANCE CALCULATION =======
  async getResourcesWithDistanceEn(zipCoordinates) {
    try {
      // Get all resources first
      const resources = await this.getResourcesEn();
      
      // Parse the zip coordinates
      const zipCoords = parseCoordinates(zipCoordinates);
      if (!zipCoords) {
        console.error("Invalid zip coordinates provided:", zipCoordinates);
        return resources; // Return without distance if coordinates are invalid
      }

      // Calculate distance for each resource and add distance property
      const resourcesWithDistance = resources.map(resource => {
        const resourceCoords = parseCoordinates(resource.coordinates);
        if (!resourceCoords) {
          return { ...resource, distance: 999999 }; // Put resources with invalid coordinates at the end
        }

        const distance = calculateDistance(
          zipCoords.lat, zipCoords.lng,
          resourceCoords.lat, resourceCoords.lng
        );

        return {
          ...resource,
          distance: parseFloat(distance.toFixed(1)) // Round to 1 decimal place
        };
      });

      // Sort by status first (Active, Limited, Inactive), then by distance
      resourcesWithDistance.sort((a, b) => {
        // First sort by status priority
        const getStatusPriority = (status) => {
          const upperStatus = status?.toUpperCase() || '';
          if (upperStatus === 'ACTIVE' || upperStatus === 'ACTIVO') return 1;
          if (upperStatus === 'LIMITED' || upperStatus === 'LIMITADO') return 2;
          if (upperStatus === 'INACTIVE' || upperStatus === 'INACTIVO') return 3;
          return 4; // Unknown status goes last
        };

        const statusDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
        if (statusDiff !== 0) return statusDiff;

        // Then sort by distance
        return a.distance - b.distance;
      });

      return resourcesWithDistance;
    } catch (error) {
      console.error("Error calculating distances for English resources:", error);
      return await this.getResourcesEn(); // Fallback to original method
    }
  },

  async getResourcesWithDistanceEs(zipCoordinates) {
    try {
      // Get all resources first
      const resources = await this.getResourcesEs();
      
      // Parse the zip coordinates
      const zipCoords = parseCoordinates(zipCoordinates);
      if (!zipCoords) {
        console.error("Invalid zip coordinates provided:", zipCoordinates);
        return resources; // Return without distance if coordinates are invalid
      }

      // Calculate distance for each resource and add distance property
      const resourcesWithDistance = resources.map(resource => {
        const resourceCoords = parseCoordinates(resource.coordinates);
        if (!resourceCoords) {
          return { ...resource, distance: 999999 }; // Put resources with invalid coordinates at the end
        }

        const distance = calculateDistance(
          zipCoords.lat, zipCoords.lng,
          resourceCoords.lat, resourceCoords.lng
        );

        return {
          ...resource,
          distance: parseFloat(distance.toFixed(1)) // Round to 1 decimal place
        };
      });

      // Sort by status first (Active, Limited, Inactive), then by distance
      resourcesWithDistance.sort((a, b) => {
        // First sort by status priority
        const getStatusPriority = (status) => {
          const upperStatus = status?.toUpperCase() || '';
          if (upperStatus === 'ACTIVE' || upperStatus === 'ACTIVO') return 1;
          if (upperStatus === 'LIMITED' || upperStatus === 'LIMITADO') return 2;
          if (upperStatus === 'INACTIVE' || upperStatus === 'INACTIVO') return 3;
          return 4; // Unknown status goes last
        };

        const statusDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
        if (statusDiff !== 0) return statusDiff;

        // Then sort by distance
        return a.distance - b.distance;
      });

      return resourcesWithDistance;
    } catch (error) {
      console.error("Error calculating distances for Spanish resources:", error);
      return await this.getResourcesEs(); // Fallback to original method
    }
  },
  
  // ======= ORGANIZATIONS (Table2.json) =======
  async getOrganizations() {
    const { data, error } = await supabase
      .from('organizations')
      .select('*');
    
    if (error) {
      console.error("Error fetching organizations:", error);
      return [];
    }
    return data;
  },
  
  // ======= NEIGHBORHOODS (Table5.json) =======
  async getNeighborhoods() {
    const { data, error } = await supabase
      .from('neighborhoods')
      .select('*');
    
    if (error) {
      console.error("Error fetching neighborhoods:", error);
      return [];
    }
    return data;
  },
  
  // Advanced queries
  async getResourcesByZipCode(zip_code) {
    const { data, error } = await supabase
      .from('resources_en')
      .select('*')
      .eq('zip_codes', zip_code);
    
    if (error) {
      console.error(`Error fetching resources for zip code ${zip_code}:`, error);
      return [];
    }
    return data;
  },
  
  async getResourcesByAssistanceType(assistanceType, language = 'en') {
    const table = language.toLowerCase() === 'es' ? 'resources_es' : 'resources_en';
    
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('assistance', assistanceType);
    
    if (error) {
      console.error(`Error fetching resources for assistance type ${assistanceType}:`, error);
      return [];
    }
    return data;
  },
  
  // Function to get resources filtered by multiple criteria
  async getFilteredResources(filters = {}, language = 'en') {
    const table = language.toLowerCase() === 'es' ? 'resources_es' : 'resources_en';
    let query = supabase.from(table).select('*');
    
    // Apply filters if provided
    if (filters.zip_code) {
      query = query.eq('zip_codes', filters.zip_code);
    }
    
    if (filters.assistance) {
      query = query.eq('assistance', filters.assistance);
    }
    
    if (filters.organization) {
      query = query.eq('organization', filters.organization);
    }
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching filtered resources:", error);
      return [];
    }
    return data;
  }
};