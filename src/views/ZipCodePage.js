// src/views/ZipCodePage.js
import { useState, useMemo, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import PageLayout from "../layout/PageLayout";
import ResultsList from "../components/ResultsList";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { calculateDistance, parseCoordinates } from "../services/dataService";
import { useAppData } from "../Contexts/AppDataContext";
import { sendEmail, createPdf, fetchOrgPhone, generateSearchHeader } from "../services/emailService";
import { getDrivingDistances } from "../services/geocodeService";
import { logUsage } from "../services/usageService";
import { applyLLMFilters } from "../services/llmSearchService";

export default function ZipCodePage({
  loggedInUser,
}) {
  // Get real data and filter state from AppDataContext
  const {
    directory,
    assistance,
    zipCodes,
    orgAssistanceMap,
    loading,
    error,
    activeSearchMode,
    selectedZipCode,
    selectedParentOrg,
    selectedChildOrg,
    selectedLocationZip,
    selectedLocationCounty,
    selectedLocationCity,
    selectedLocationNeighborhood,
    activeAssistanceChips,
    // Client coordinates override for distance calculations
    clientCoordinates,
    // Driving distances (when user enters custom address)
    drivingDistances,
    setDrivingDistances,
    setDrivingDistancesLoading,
    // LLM Search state
    llmSearchFilters,
    llmSearchQuery,
  } = useAppData();

  // State management
  const [selectedRows, setSelectedRows] = useState([]);
  const [orgPhone, setOrgPhone] = useState("");

  // Fetch org phone on mount
  useEffect(() => {
    const loadOrgPhone = async () => {
      if (loggedInUser?.reg_organization) {
        const phone = await fetchOrgPhone(loggedInUser.reg_organization);
        setOrgPhone(phone);
      }
    };
    loadOrgPhone();
  }, [loggedInUser]);

  // Determine if we have an active filter based on search mode
  const hasActiveFilter = useMemo(() => {
    switch (activeSearchMode) {
      case "zipcode":
        return !!selectedZipCode;
      case "organization":
        return !!selectedParentOrg || !!selectedChildOrg;
      case "location":
        return !!selectedLocationZip || !!selectedLocationCity || !!selectedLocationCounty || !!selectedLocationNeighborhood;
      case "llm":
        return !!llmSearchFilters; // LLM mode has filters when search has been performed
      default:
        return false;
    }
  }, [activeSearchMode, selectedZipCode, selectedParentOrg, selectedChildOrg, selectedLocationZip, selectedLocationCity, selectedLocationCounty, selectedLocationNeighborhood, llmSearchFilters]);

  // Get the appropriate prompt message based on search mode
  const getPromptMessage = () => {
    switch (activeSearchMode) {
      case "zipcode":
        return {
          title: "Please Select a Zip Code to Initiate a Search",
          subtitle: "Results will appear here after you select a zip code from the dropdown above."
        };
      case "organization":
        return {
          title: "Please Select an Organization to View Results",
          subtitle: "Choose a parent or child organization from the dropdowns above."
        };
      case "location":
        return {
          title: "Please Select a Location to View Results",
          subtitle: "Choose a county, city, or zip code to see organizations in that area."
        };
      case "llm":
        return {
          title: "Enter a Search Query",
          subtitle: "Type your search in the text box above (e.g., 'food pantry open Thursday')."
        };
      default:
        return {
          title: "Please Make a Selection",
          subtitle: "Use the filters above to search for resources."
        };
    }
  };

  // Filter directory based on active search mode and filters
  const filteredDirectory = useMemo(() => {
    // If no filter is active, return empty array (show prompt)
    if (!hasActiveFilter) {
      return [];
    }

    let filtered = [...directory];
    let refCoords = null;

    // Apply mode-specific filtering
    switch (activeSearchMode) {
      case "zipcode":
        // Filter by client zip codes (orgs that SERVE this zip)
        filtered = filtered.filter(record => {
          const hasZip = record.client_zip_codes?.includes(selectedZipCode);
          const hasAllZips = record.client_zip_codes?.includes("99999");
          return hasZip || hasAllZips;
        });
        
        // Get coordinates for distance calculation
        // Priority: clientCoordinates (user override) > zip centroid
        if (clientCoordinates) {
          refCoords = parseCoordinates(clientCoordinates);
        } else {
          const zipData = zipCodes.find(z => z.zip_code === selectedZipCode);
          refCoords = zipData ? parseCoordinates(zipData.coordinates) : null;
        }
        break;

      case "organization":
        // Filter by organization name
        if (selectedChildOrg) {
          filtered = filtered.filter(record => record.organization === selectedChildOrg);
        } else if (selectedParentOrg) {
          filtered = filtered.filter(record => record.org_parent === selectedParentOrg);
        }
        break;

      case "location":
        // Filter by org's physical location (where org IS LOCATED)
        // Apply most specific filter available: neighborhood > zip > city > county
        // Neighborhood filter is applied AFTER the zip/city/county hierarchy
        if (selectedLocationZip) {
          filtered = filtered.filter(record => record.org_zip_code === selectedLocationZip);
        } else if (selectedLocationCity) {
          filtered = filtered.filter(record => record.org_city === selectedLocationCity);
        } else if (selectedLocationCounty) {
          filtered = filtered.filter(record => record.org_county === selectedLocationCounty);
        }

        // Apply neighborhood filter (can be combined with zip/city/county or used alone)
        if (selectedLocationNeighborhood) {
          filtered = filtered.filter(record => record.org_neighborhood === selectedLocationNeighborhood);
        }

        // Get coordinates for distance calculation
        // Priority: clientCoordinates (user override) > zip centroid (if zip selected)
        if (clientCoordinates) {
          refCoords = parseCoordinates(clientCoordinates);
        } else if (selectedLocationZip) {
          const locZipData = zipCodes.find(z => z.zip_code === selectedLocationZip);
          refCoords = locZipData ? parseCoordinates(locZipData.coordinates) : null;
        }
        break;

      case "llm":
        // Apply LLM-generated filters
        if (llmSearchFilters) {
          // Build assistance lookup map: assistance name -> assist_id
          const assistanceLookup = {};
          assistance.forEach(a => {
            assistanceLookup[a.assistance] = a.assist_id;
          });

          // Apply filters from LLM
          filtered = applyLLMFilters(filtered, llmSearchFilters, assistanceLookup);

          // Get coordinates for distance calculation if client address is set
          // This enables distance column even without max_miles filter
          if (clientCoordinates) {
            refCoords = parseCoordinates(clientCoordinates);
          }
        } else {
          filtered = [];
        }
        break;

      default:
        break;
    }

    // Filter by active assistance chips (if any are selected)
    if (activeAssistanceChips.size > 0) {
      filtered = filtered.filter(record => activeAssistanceChips.has(record.assist_id));
    }

    // Calculate distance for each record (if we have reference coordinates)
    // Uses Haversine (straight-line) distance calculation
    if (refCoords) {
      filtered = filtered.map(record => {
        const recordCoords = parseCoordinates(record.org_coordinates);
        if (!recordCoords) {
          return { ...record, distance: 999999 };
        }

        const distance = calculateDistance(
          refCoords.lat, refCoords.lng,
          recordCoords.lat, recordCoords.lng
        );
        return { ...record, distance: parseFloat(distance.toFixed(1)) };
      });
    }

    // Apply max_miles filter after distance calculation (for LLM search)
    if (llmSearchFilters?.max_miles && refCoords) {
      const maxMiles = llmSearchFilters.max_miles;
      filtered = filtered.filter(record => record.distance && record.distance <= maxMiles);
    }

    // Sorting is handled by ResultsList (status_id, assist_id, miles)
    return filtered;
  }, [directory, zipCodes, assistance, activeSearchMode, selectedZipCode, selectedParentOrg, selectedChildOrg, selectedLocationZip, selectedLocationCity, selectedLocationCounty, selectedLocationNeighborhood, activeAssistanceChips, hasActiveFilter, clientCoordinates, llmSearchFilters]);

  // Fetch driving distances when user enters a custom address
  // This runs after filtering to only fetch for visible results
  useEffect(() => {
    const fetchDistances = async () => {
      // Only fetch if user entered a custom address (clientCoordinates set)
      // and we have filtered results to calculate distances for
      if (!clientCoordinates || filteredDirectory.length === 0) {
        return;
      }

      // Find records that don't have driving distances yet
      const recordsNeedingDistances = filteredDirectory.filter(
        record => record.org_coordinates && !drivingDistances.has(record.id_no)
      );

      // Skip if all records already have driving distances
      if (recordsNeedingDistances.length === 0) {
        return;
      }

      // Prepare destinations from records needing distances
      const destinations = recordsNeedingDistances.map(record => ({
        id: record.id_no,
        coordinates: record.org_coordinates.replace(/\s/g, ""), // Remove spaces for API
      }));

      console.log(`🚗 Fetching driving distances for ${destinations.length} new destinations...`);
      setDrivingDistancesLoading(true);

      try {
        const result = await getDrivingDistances(clientCoordinates, destinations);

        if (result.success && result.distances) {
          // Merge new distances with existing ones
          setDrivingDistances(prev => {
            const merged = new Map(prev);
            result.distances.forEach((value, key) => merged.set(key, value));
            return merged;
          });
          console.log(`🚗 Driving distances loaded: ${result.distances.size} new results (total: ${drivingDistances.size + result.distances.size})`);
        } else {
          console.warn("Failed to fetch driving distances:", result.message);
        }
      } catch (error) {
        console.error("Error fetching driving distances:", error);
      } finally {
        setDrivingDistancesLoading(false);
      }
    };

    fetchDistances();
  }, [clientCoordinates, filteredDirectory, drivingDistances, setDrivingDistances, setDrivingDistancesLoading]);

  // Apply driving distances to filtered results (when available)
  // This creates the final display data with driving distances overriding Haversine
  const displayDirectory = useMemo(() => {
    // If no driving distances or no client coordinates, use filtered as-is
    if (!clientCoordinates || drivingDistances.size === 0) {
      return filteredDirectory;
    }

    // Replace Haversine distances with driving distances where available
    return filteredDirectory.map(record => {
      const drivingDistance = drivingDistances.get(record.id_no);
      if (drivingDistance !== undefined && drivingDistance !== null) {
        return { ...record, distance: drivingDistance };
      }
      // Keep Haversine distance if driving distance not available
      return record;
    });
  }, [filteredDirectory, drivingDistances, clientCoordinates]);

  // Helper function for animated toast
  const showAnimatedToast = (msg, type = "success") => {
    toast.custom(() => (
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 400, opacity: 1 }}
        exit={{ y: 300, opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className={`mx-auto px-6 py-4 rounded-lg shadow-lg text-lg font-semibold text-white w-fit ${
          type === "error" ? "bg-red-500" : "bg-green-600"
        }`}
      >
        {msg}
      </motion.div>
    ));
  };

  // Helper to log email/pdf actions to database (simplified for new schema)
  const logDeliveryAction = async (deliveryMethod) => {
    try {
      await logUsage({
        reg_organization: loggedInUser?.reg_organization || 'Guest',
        action_type: deliveryMethod, // "email" or "pdf"
      });
    } catch (err) {
      console.error(`Failed to log ${deliveryMethod}:`, err);
    }
  };

  // Build search context for email/PDF headers based on current search mode
  const buildSearchContext = () => ({
    searchMode: activeSearchMode,
    selectedZip: selectedZipCode,
    selectedParentOrg,
    selectedChildOrg,
    selectedLocationZip,
    selectedLocationCity,
    selectedLocationCounty,
    llmQuery: llmSearchQuery,
  });

  // Email success handler - called from NavBar1 panel
  const handleEmailSuccess = async (recipient) => {
    const dataToSend = selectedRows?.map((i) => displayDirectory[i]).filter(Boolean);

    // Send the email using the service
    await sendEmail({
      recipient,
      selectedData: dataToSend,
      searchContext: buildSearchContext(),
      loggedInUser,
      orgPhone,
    });

    // Reset selections and show toast
    setSelectedRows([]);
    showAnimatedToast("✅ Email sent successfully.", "success");

    // Log to database
    await logDeliveryAction('email');
  };

  // PDF success handler - called from NavBar1 panel
  const handlePdfSuccess = async () => {
    const dataToSend = selectedRows?.map((i) => displayDirectory[i]).filter(Boolean);

    // Create the PDF using the service
    await createPdf({
      selectedData: dataToSend,
      searchContext: buildSearchContext(),
      loggedInUser,
      orgPhone,
    });

    // Reset selections and show toast
    setSelectedRows([]);
    showAnimatedToast("✅ PDF created successfully in your Download Folder.", "success");

    // Log to database
    await logDeliveryAction('pdf');
  };

  // Validation handlers - return true if valid, false if not
  const validateEmailSelection = () => {
    if (!selectedRows || selectedRows.length === 0) {
      showAnimatedToast(
        "⚠️ Please select at least one record to send email.",
        "error"
      );
      return false;
    }
    return true;
  };

  const validatePdfSelection = () => {
    if (!selectedRows || selectedRows.length === 0) {
      showAnimatedToast(
        "⚠️ Please select at least one record to create a PDF.",
        "error"
      );
      return false;
    }
    return true;
  };

  // Calculate selected data for email/PDF panels
  const selectedData = selectedRows?.map((i) => displayDirectory[i]).filter(Boolean);

  // Generate header text for email/PDF preview based on search mode
  const headerText = generateSearchHeader(buildSearchContext());

  return (
    <PageLayout
      totalCount={directory.length}
      filteredCount={displayDirectory.length}
      selectedCount={selectedRows.length}
      onSendEmail={validateEmailSelection}
      onCreatePdf={validatePdfSelection}
      selectedData={selectedData}
      loggedInUser={loggedInUser}
      headerText={headerText}
      onEmailSuccess={handleEmailSuccess}
      onPdfSuccess={handlePdfSuccess}
    >

   <Helmet>
      <title>Search by Zip Code | Community Resources Guide</title>
      <meta
        name="description"
        content="Find food, housing, legal, and utility assistance by zip code across the Greater Houston Area."
      />
    </Helmet>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Legacy controls removed - now handled by NavBar1 (counters), NavBar2 (zip dropdown), NavBar3 (assistance) */}

        {/* Results list with filtered Supabase data */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading resources...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500">Error loading data: {error}</div>
          </div>
        ) : !hasActiveFilter ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
            <div className="text-xl font-medium text-gray-600 mb-4">
              {getPromptMessage().title}
            </div>
            <div className="text-gray-500 max-w-md">
              {getPromptMessage().subtitle}
            </div>
          </div>
        ) : (
          <ResultsList
            records={displayDirectory}
            assistanceData={assistance}
            orgAssistanceMap={orgAssistanceMap}
            selectedIds={new Set(selectedRows.map(i => displayDirectory[i]?.id).filter(Boolean))}
            onSelectionChange={(newSelectedIds) => {
              // Convert Set of IDs back to array of indices for compatibility
              const newSelectedRows = displayDirectory
                .map((r, i) => newSelectedIds.has(r.id) ? i : -1)
                .filter(i => i >= 0);
              setSelectedRows(newSelectedRows);
            }}
          />
        )}
      </div>
    </PageLayout>
  );
}