// src/Contexts/AppDataContext.js
// Central data context for CRG 2026
// Loads all data once on app start for client-side filtering

import { createContext, useContext, useState, useEffect } from 'react';
import { dataService } from '../services/dataService';

const AppDataContext = createContext();

// Parse JSON field - handles both already-parsed arrays and JSON strings
function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Map Supabase directory record to format expected by ResultRow
// This ensures consistent field names throughout the app
function mapDirectoryRecord(record) {
  // Parse client_zip_codes - stored as jsonb array of strings in Supabase
  const clientZipCodes = parseJsonArray(record.client_zip_codes);

  // assist_id in directory table is TEXT, matches assistance.assist_id
  const assistId = record.assist_id || null;

  return {
    ...record,
    // Map id_no to id for checkbox selection
    id: record.id_no,
    // Map org_hours to hours for hours display
    hours: record.org_hours,
    // Map org_telephone to telephone for phone display
    telephone: record.org_telephone,
    // Ensure client_zip_codes is always an array of strings
    client_zip_codes: clientZipCodes,
    // assist_id (text) - matches assistance.assist_id for filtering
    assist_id: assistId,
    // Distance will be calculated at runtime, default to null
    distance: null,
  };
}

// Build lookup map: organization name → array of unique assist_ids
// Computed once from directory data for O(1) lookups in ResultRow
// Excludes Inactive records (status_id === 3) - only Active and Limited
function buildOrgAssistanceMap(directoryData) {
  const map = {};
  directoryData.forEach(record => {
    const orgName = record.organization;
    const assistId = record.assist_id;
    const statusId = record.status_id;
    if (orgName && assistId && statusId !== 3) {
      if (!map[orgName]) {
        map[orgName] = new Set();
      }
      map[orgName].add(assistId);
    }
  });
  // Convert Sets to sorted arrays for consistent display order
  const result = {};
  Object.keys(map).forEach(orgName => {
    result[orgName] = [...map[orgName]].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  });
  return result;
}

// Build organizations list from directory data for NavBar2 dropdowns
// Returns array of { organization, org_parent } for parent/child dropdown population
function buildOrganizationsList(directoryData) {
  const orgMap = new Map(); // Use Map to dedupe by organization name
  directoryData.forEach(record => {
    if (record.organization && !orgMap.has(record.organization)) {
      orgMap.set(record.organization, {
        organization: record.organization,
        org_parent: record.org_parent || record.organization,
      });
    }
  });
  return [...orgMap.values()].sort((a, b) => a.organization.localeCompare(b.organization));
}

export const AppDataProvider = ({ children, loggedInUser }) => {
  // Data state - loaded once on mount
  const [directory, setDirectory] = useState([]);
  const [assistance, setAssistance] = useState([]);
  const [zipCodes, setZipCodes] = useState([]);
  const [organizations, setOrganizations] = useState([]); // Derived from directory for NavBar2 dropdowns
  const [orgAssistanceMap, setOrgAssistanceMap] = useState({}); // org name → assist_ids array

  // Loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search mode state - shared between NavBar2 and results pages
  const [activeSearchMode, setActiveSearchMode] = useState("zipcode"); // "zipcode", "organization", "location", "llm"

  // Filter state - shared between NavBar2 and results pages
  const [selectedZipCode, setSelectedZipCode] = useState("");
  const [selectedParentOrg, setSelectedParentOrg] = useState("");
  const [selectedChildOrg, setSelectedChildOrg] = useState("");
  // Location mode filters (county/city/zip/neighborhood hierarchy)
  const [selectedLocationCounty, setSelectedLocationCounty] = useState("");
  const [selectedLocationCity, setSelectedLocationCity] = useState("");
  const [selectedLocationZip, setSelectedLocationZip] = useState("");
  const [selectedLocationNeighborhood, setSelectedLocationNeighborhood] = useState("");
  const [activeAssistanceChips, setActiveAssistanceChips] = useState(new Set());

  // Client location override - for distance calculations
  // When set, overrides zip centroid for distance calculations
  // Cleared when zip code changes
  const [clientAddress, setClientAddress] = useState("");
  const [clientCoordinates, setClientCoordinates] = useState("");

  // Driving distances from client address to organizations
  // Map of record id_no → driving distance in miles (null if not calculated)
  const [drivingDistances, setDrivingDistances] = useState(new Map());
  const [drivingDistancesLoading, setDrivingDistancesLoading] = useState(false);

  // LLM Search state
  const [llmSearchQuery, setLlmSearchQuery] = useState("");
  const [llmSearchFilters, setLlmSearchFilters] = useState(null); // Filters returned from LLM
  const [llmSearchInterpretation, setLlmSearchInterpretation] = useState(""); // Human-readable interpretation
  const [llmSearchLoading, setLlmSearchLoading] = useState(false);
  const [llmSearchError, setLlmSearchError] = useState("");
  const [llmRelatedSearches, setLlmRelatedSearches] = useState([]); // Related search suggestions

  // Quick Tips panel state
  const [quickTipsOpen, setQuickTipsOpen] = useState(false);
  const [quickTipsExpandedSection, setQuickTipsExpandedSection] = useState(null); // Which accordion section is expanded
  const [quickTipsShownThisSession, setQuickTipsShownThisSession] = useState(false); // Track if auto-shown already
  const [quickTipsHighlightChipToggle, setQuickTipsHighlightChipToggle] = useState(false); // Highlight chip toggle section on auto-open

  // Clear client coordinates and driving distances when zip code changes
  useEffect(() => {
    setClientAddress("");
    setClientCoordinates("");
    setDrivingDistances(new Map());
  }, [selectedZipCode, selectedLocationZip]);

  // Clear driving distances when client coordinates change (new lookup needed)
  useEffect(() => {
    setDrivingDistances(new Map());
  }, [clientCoordinates]);

  // Load all data on mount
  useEffect(() => {
    let mounted = true;

    const loadAllData = async () => {
      console.log('📦 AppDataContext: Loading all data...');
      const startTime = performance.now();

      try {
        // Fetch all tables in parallel for speed
        // Note: organizations table no longer needed - we compute org assistance from directory
        const [
          directoryData,
          assistanceData,
          zipCodesData,
        ] = await Promise.all([
          dataService.getDirectory(),
          dataService.getAssistance(),
          dataService.getZipCodes(),
        ]);

        if (!mounted) return;

        // Map directory records to format expected by ResultRow
        const mappedDirectory = directoryData.map(mapDirectoryRecord);

        // Build org → assist_ids lookup map (computed from directory)
        const assistanceMap = buildOrgAssistanceMap(directoryData);

        // Build organizations list from directory for NavBar2 dropdowns
        const orgsList = buildOrganizationsList(directoryData);

        setDirectory(mappedDirectory);
        setAssistance(assistanceData);
        setZipCodes(zipCodesData);
        setOrganizations(orgsList);
        setOrgAssistanceMap(assistanceMap);
        setLoading(false);

        const loadTime = Math.round(performance.now() - startTime);
        console.log(`✅ AppDataContext: Data loaded in ${loadTime}ms`);
        console.log(`   directory: ${directoryData.length}, assistance: ${assistanceData.length}, zipCodes: ${zipCodesData.length}, organizations: ${orgsList.length}, orgAssistanceMap: ${Object.keys(assistanceMap).length} orgs`);

        // Debug: Log sample data to verify field formats
        if (mappedDirectory.length > 0) {
          const sample = mappedDirectory[0];
          console.log('📋 Sample directory record after mapping:', {
            id: sample.id,
            organization: sample.organization,
            client_zip_codes: sample.client_zip_codes?.slice(0, 3),
            client_zip_codes_isArray: Array.isArray(sample.client_zip_codes),
            assist_id: sample.assist_id,
            assist_id_type: typeof sample.assist_id,
            hours: sample.hours,
            hours_type: typeof sample.hours,
          });
        }
        if (assistanceData.length > 0) {
          const sampleAssist = assistanceData[0];
          console.log('📋 Sample assistance record:', {
            id_no: sampleAssist.id_no,
            assist_id: sampleAssist.assist_id,
            assist_id_type: typeof sampleAssist.assist_id,
            assistance: sampleAssist.assistance,
          });
        }
      } catch (err) {
        console.error('❌ AppDataContext: Error loading data:', err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadAllData();

    return () => {
      mounted = false;
    };
  }, []);

  // Derived: whether any search filter is active (for NavBar3 button state)
  const hasActiveSearchFilter = Boolean(
    selectedZipCode ||
    selectedParentOrg ||
    selectedChildOrg ||
    selectedLocationCounty ||
    selectedLocationCity ||
    selectedLocationZip ||
    llmSearchFilters
  );

  const value = {
    // Data
    directory,
    assistance,
    zipCodes,
    organizations, // Derived from directory for NavBar2 dropdowns
    orgAssistanceMap, // org name → array of assist_ids (for Assistance column icons)

    // Auth
    loggedInUser, // Passed from App level for logging

    // Status
    loading,
    error,

    // Search mode (shared between NavBar2 and results pages)
    activeSearchMode,
    setActiveSearchMode,

    // Derived filter state
    hasActiveSearchFilter, // true when any search filter is active (for NavBar3 button state)

    // Filter state (shared between NavBar2/NavBar3 and results pages)
    selectedZipCode,
    setSelectedZipCode,
    selectedParentOrg,
    setSelectedParentOrg,
    selectedChildOrg,
    setSelectedChildOrg,
    // Location mode filters (county/city/zip/neighborhood hierarchy)
    selectedLocationCounty,
    setSelectedLocationCounty,
    selectedLocationCity,
    setSelectedLocationCity,
    selectedLocationZip,
    setSelectedLocationZip,
    selectedLocationNeighborhood,
    setSelectedLocationNeighborhood,
    activeAssistanceChips,
    setActiveAssistanceChips,

    // Client location override (for distance calculations)
    clientAddress,
    setClientAddress,
    clientCoordinates,
    setClientCoordinates,

    // Driving distances (Map of record id → miles)
    drivingDistances,
    setDrivingDistances,
    drivingDistancesLoading,
    setDrivingDistancesLoading,

    // LLM Search state
    llmSearchQuery,
    setLlmSearchQuery,
    llmSearchFilters,
    setLlmSearchFilters,
    llmSearchInterpretation,
    setLlmSearchInterpretation,
    llmSearchLoading,
    setLlmSearchLoading,
    llmSearchError,
    setLlmSearchError,
    llmRelatedSearches,
    setLlmRelatedSearches,

    // Quick Tips panel state
    quickTipsOpen,
    setQuickTipsOpen,
    quickTipsExpandedSection,
    setQuickTipsExpandedSection,
    quickTipsShownThisSession,
    setQuickTipsShownThisSession,
    quickTipsHighlightChipToggle,
    setQuickTipsHighlightChipToggle,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
};

// Custom hook for consuming the context
export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};