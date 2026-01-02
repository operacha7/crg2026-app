// src/contexts/StatisticsContext.js
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../MainApp';

const StatisticsContext = createContext();

// Fallback colors for organizations without database colors
const FALLBACK_COLORS = [
  '#b7b7b7', '#6C5CE7', '#00B894', '#0984E3', '#E17055',
  '#D63031', '#E84393', '#00CEC9', '#2D3436', '#74B9FF',
  '#55EFC4', '#FFEAA7', '#FAB1A0', '#81ECEC', '#636E72'
];

// Helper function to get Central Time date string
const getCentralTimeDate = (date = new Date()) => {
  return date.toLocaleDateString('en-CA', { 
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export const StatisticsProvider = ({ children }) => {
  // Global shared state
  const [orgColors, setOrgColors] = useState({});
  const [organizations, setOrganizations] = useState(['All']);
  const [selectedDate, setSelectedDate] = useState(getCentralTimeDate());
  const [activeOrgId, setActiveOrgId] = useState(null);

  // Fetch organization colors once
  const fetchOrganizationColors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('registered_organizations')
        .select('registered_organization, org_color')
        .not('org_color', 'is', null);
      
      if (error) {
        console.error('Error fetching organization colors:', error);
        return;
      }
      
      const colorMap = {};
      data.forEach(org => {
        colorMap[org.registered_organization] = org.org_color;
      });
      
      setOrgColors(colorMap);
    } catch (error) {
      console.error('Error loading organization colors:', error);
    }
  }, []);

  // Fetch organizations list once
  const fetchOrganizations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_usage_logs')
        .select('reg_organization')
        .not('reg_organization', 'is', null)
        .neq('reg_organization', '');
      
      if (error) {
        console.error('Error fetching organizations:', error);
        return;
      }
      
      if (data && data.length > 0) {
        const uniqueOrgs = [...new Set(data
          .filter(item => item.reg_organization)
          .map(item => item.reg_organization)
        )];
        setOrganizations(['All', ...uniqueOrgs.sort()]);
      }
    } catch (error) {
      console.error('Error processing organizations:', error);
    }
  }, []);

  // Get color for organization
  const getOrganizationColor = useCallback((orgName) => {
    // Guard against undefined/null or non-string values
    if (!orgName || typeof orgName !== 'string') {
      return FALLBACK_COLORS[0];
    }

    // First try database color
    if (orgColors[orgName]) {
      return orgColors[orgName];
    }
    
    // Fallback to hash-based color selection (stable per name)
    let hash = 0;
    for (let i = 0; i < orgName.length; i++) {
      const char = orgName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const colorIndex = Math.abs(hash) % FALLBACK_COLORS.length;
    return FALLBACK_COLORS[colorIndex];
  }, [orgColors]);

  // Load data on mount
  useEffect(() => {
    fetchOrganizationColors();
    fetchOrganizations();
  }, [fetchOrganizationColors, fetchOrganizations]);

  const value = {
    // State
    orgColors,
    organizations,
    selectedDate,
    activeOrgId,
    
    // Setters
    setSelectedDate,
    setActiveOrgId,
    
    // Functions
    getOrganizationColor,
    getCentralTimeDate,
  };

  return (
    <StatisticsContext.Provider value={value}>
      {children}
    </StatisticsContext.Provider>
  );
};

export const useStatistics = () => {
  const context = useContext(StatisticsContext);
  if (!context) {
    throw new Error('useStatistics must be used within a StatisticsProvider');
  }
  return context;
};