// src/Contexts/AppDataContext.js
// Central data context for CRG 2026
// Loads all data once on app start for client-side filtering

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { dataService } from '../services/dataService';
import { readPhase1Cache, writePhase1Cache } from '../services/dataCache';

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
// Returns array of { organization, org_parent, subgroup } for parent/child dropdown population
function buildOrganizationsList(directoryData) {
  const orgMap = new Map(); // Use Map to dedupe by organization name
  directoryData.forEach(record => {
    if (record.organization && !orgMap.has(record.organization)) {
      orgMap.set(record.organization, {
        organization: record.organization,
        org_parent: record.org_parent || record.organization,
        subgroup: record.subgroup || null,
      });
    }
  });
  return [...orgMap.values()].sort((a, b) => a.organization.localeCompare(b.organization));
}

export const AppDataProvider = ({ children, loggedInUser, onLogout }) => {
  // Data state - loaded once on mount
  const [directory, setDirectory] = useState([]);
  const [assistance, setAssistance] = useState([]);
  const [zipCodes, setZipCodes] = useState([]);
  const [organizations, setOrganizations] = useState([]); // Derived from directory for NavBar2 dropdowns
  const [orgAssistanceMap, setOrgAssistanceMap] = useState({}); // org name → assist_ids array
  const [zipCodeData, setZipCodeData] = useState([]); // Combined scores by zip (single source of truth for reports)
  const [headerConfig, setHeaderConfig] = useState([]); // Column display configuration

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
  // Set from a deep link (?mode=llm&q=...) so NavBar2 can auto-run the search once
  // assistance/zipCodes are loaded. Cleared by the consumer after it runs.
  const [pendingLlmAutoSearch, setPendingLlmAutoSearch] = useState(false);

  // Quick Tips panel state
  const [quickTipsOpen, setQuickTipsOpen] = useState(false);
  const [quickTipsExpandedSection, setQuickTipsExpandedSection] = useState(null); // Which accordion section is expanded
  const [quickTipsShownThisSession, setQuickTipsShownThisSession] = useState(false); // Track if auto-shown already
  const [quickTipsHighlightChipToggle, setQuickTipsHighlightChipToggle] = useState(false); // Highlight chip toggle section on auto-open

  // Clear client coordinates and driving distances when zip code changes.
  // Guard the Map reset: only replace if non-empty. `new Map()` always creates a new
  // reference, which would otherwise force every consumer of `drivingDistances` to
  // re-render on every zip change even though nothing changed.
  useEffect(() => {
    setClientAddress("");
    setClientCoordinates("");
    setDrivingDistances(prev => (prev.size === 0 ? prev : new Map()));
  }, [selectedZipCode, selectedLocationZip]);

  // Clear driving distances when client coordinates change (new lookup needed)
  useEffect(() => {
    setDrivingDistances(prev => (prev.size === 0 ? prev : new Map()));
  }, [clientCoordinates]);

  // Load data in two phases:
  //   Phase 1 (blocking):  directory, assistance, zipCodes — required for the main search UI.
  //                        As soon as these land, setLoading(false) so the user can interact.
  //   Phase 2 (background): distress, working poor, evictions, zip code data, header config —
  //                        only consumed by the Reports page. Mobile never reaches Reports,
  //                        and desktop Reports only pays a cost if opened before Phase 2 finishes.
  // This split fixes the multi-second cold-start stall where a zip click would block on the
  // slowest Reports-only Supabase query (~6s on mobile networks).
  useEffect(() => {
    let mounted = true;

    // Stale-while-revalidate: if there's a cached Phase 1 payload from a
    // previous session, render the app from it immediately while the fresh
    // fetch runs below. Eliminates the ~2s "Loading data..." screen on the
    // second and subsequent visits. The user briefly sees yesterday's data
    // until the fresh fetch lands and React swaps in updated rows — fine for
    // a directory that mutates slowly via the daily Sheets→Supabase sync.
    const cached = readPhase1Cache();
    if (cached) {
      const cachedMappedDirectory = cached.directory.map(mapDirectoryRecord);
      const cachedAssistanceMap = buildOrgAssistanceMap(cached.directory);
      const cachedOrgsList = buildOrganizationsList(cached.directory);

      setDirectory(cachedMappedDirectory);
      setAssistance(cached.assistance);
      setZipCodes(cached.zipCodes);
      setOrganizations(cachedOrgsList);
      setOrgAssistanceMap(cachedAssistanceMap);
      setLoading(false);

      console.log(`💾 AppDataContext: rendered from cache (${cached.directory.length} directory rows), revalidating in background`);
    }

    const loadAllData = async () => {
      console.log('📦 AppDataContext: Phase 1 (core)...');
      const startTime = performance.now();

      try {
        // Phase 1 — fetch the tables the main search UI needs.
        const [directoryData, assistanceData, zipCodesData] = await Promise.all([
          dataService.getDirectory(),
          dataService.getAssistance(),
          dataService.getZipCodes(),
        ]);

        if (!mounted) return;

        const mappedDirectory = directoryData.map(mapDirectoryRecord);
        const assistanceMap = buildOrgAssistanceMap(directoryData);
        const orgsList = buildOrganizationsList(directoryData);

        setDirectory(mappedDirectory);
        setAssistance(assistanceData);
        setZipCodes(zipCodesData);
        setOrganizations(orgsList);
        setOrgAssistanceMap(assistanceMap);
        setLoading(false);

        // Persist for the next visit. Fire-and-forget; the cache module
        // swallows quota / disabled-storage errors internally.
        writePhase1Cache({
          directory: directoryData,
          assistance: assistanceData,
          zipCodes: zipCodesData,
        });

        const phase1Time = Math.round(performance.now() - startTime);
        console.log(`✅ AppDataContext: Phase 1 done in ${phase1Time}ms (${directoryData.length} directory, ${assistanceData.length} assistance, ${zipCodesData.length} zipCodes)`);

        // Phase 2 — fetch Reports-only data in the background. No await in the main path.
        (async () => {
          const phase2Start = performance.now();
          try {
            const [zipCodeDataResult, headerConfigResult] = await Promise.all([
              dataService.getZipCodeData(),
              dataService.getHeaderConfig(),
            ]);

            if (!mounted) return;

            setZipCodeData(zipCodeDataResult);
            setHeaderConfig(headerConfigResult);

            const phase2Time = Math.round(performance.now() - phase2Start);
            console.log(`✅ AppDataContext: Phase 2 done in ${phase2Time}ms (Reports data loaded in background)`);
          } catch (err) {
            // Reports-only data failing shouldn't break the main app.
            console.error('⚠️ AppDataContext: Phase 2 load failed (Reports will be unavailable):', err);
          }
        })();

        // Apply deep link URL params (from SMS share links)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('guest') === '1') {
          const mode = urlParams.get('mode');
          if (mode) setActiveSearchMode(mode);

          // Apply mode-specific filters
          switch (mode) {
            case 'zipcode':
              if (urlParams.get('zip')) setSelectedZipCode(urlParams.get('zip'));
              break;
            case 'organization':
              if (urlParams.get('parent')) setSelectedParentOrg(urlParams.get('parent'));
              if (urlParams.get('child')) setSelectedChildOrg(urlParams.get('child'));
              break;
            case 'location':
              if (urlParams.get('county')) setSelectedLocationCounty(urlParams.get('county'));
              if (urlParams.get('city')) setSelectedLocationCity(urlParams.get('city'));
              if (urlParams.get('loczip')) setSelectedLocationZip(urlParams.get('loczip'));
              break;
            case 'llm': {
              const q = urlParams.get('q');
              if (q) {
                setLlmSearchQuery(q);
                setPendingLlmAutoSearch(true);
              }
              break;
            }
            default:
              break;
          }

          // Apply assistance chip filters
          const assistParam = urlParams.get('assist');
          if (assistParam) {
            setActiveAssistanceChips(new Set(assistParam.split(',')));
          }

          console.log('🔗 Deep link params applied:', { mode, zip: urlParams.get('zip'), assist: assistParam });
        }

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
        // If we already rendered from cache, keep the cached state visible
        // and don't surface an error overlay — the user has a usable app.
        // Only fail loudly when there's no cache to fall back on.
        if (mounted && !cached) {
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

  // Memoize the context value so consumers don't re-render on every parent render.
  // Without this, every state change in AppDataProvider re-renders all consumers
  // (NavBars, ResultsList, every ResultRow), which is the root cause of the cold-start stall
  // when the user clicks the zip dropdown or selects an assistance type.
  const value = useMemo(() => ({
    // Data
    directory,
    assistance,
    zipCodes,
    organizations,
    orgAssistanceMap,
    zipCodeData,
    headerConfig,

    // Auth
    loggedInUser,
    onLogout,

    // Status
    loading,
    error,

    // Search mode
    activeSearchMode,
    setActiveSearchMode,

    // Derived filter state
    hasActiveSearchFilter,

    // Filter state
    selectedZipCode,
    setSelectedZipCode,
    selectedParentOrg,
    setSelectedParentOrg,
    selectedChildOrg,
    setSelectedChildOrg,
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

    // Client location override
    clientAddress,
    setClientAddress,
    clientCoordinates,
    setClientCoordinates,

    // Driving distances
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
    pendingLlmAutoSearch,
    setPendingLlmAutoSearch,

    // Quick Tips panel state
    quickTipsOpen,
    setQuickTipsOpen,
    quickTipsExpandedSection,
    setQuickTipsExpandedSection,
    quickTipsShownThisSession,
    setQuickTipsShownThisSession,
    quickTipsHighlightChipToggle,
    setQuickTipsHighlightChipToggle,
  }), [
    directory, assistance, zipCodes, organizations, orgAssistanceMap,
    zipCodeData, headerConfig,
    loggedInUser, onLogout, loading, error,
    activeSearchMode, hasActiveSearchFilter,
    selectedZipCode, selectedParentOrg, selectedChildOrg,
    selectedLocationCounty, selectedLocationCity, selectedLocationZip, selectedLocationNeighborhood,
    activeAssistanceChips,
    clientAddress, clientCoordinates,
    drivingDistances, drivingDistancesLoading,
    llmSearchQuery, llmSearchFilters, llmSearchInterpretation,
    llmSearchLoading, llmSearchError, llmRelatedSearches, pendingLlmAutoSearch,
    quickTipsOpen, quickTipsExpandedSection, quickTipsShownThisSession, quickTipsHighlightChipToggle,
  ]);

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