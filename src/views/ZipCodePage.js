// src/views/ZipCodePage.js
import { useState, useRef, useMemo, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import PageLayout from "../layout/PageLayout";
import AssistanceSidebar from "../components/AssistanceSidebar";
import ResultsList from "../components/ResultsList";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { supabase } from "../MainApp";
import { calculateDistance, parseCoordinates } from "../services/dataService";
import { useAppData } from "../Contexts/AppDataContext";
import { sendEmail, createPdf, fetchOrgPhone } from "../services/emailService";

export default function ZipCodePage({
  assistanceTypes = [], // Legacy prop - used by AssistanceSidebar
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
    activeAssistanceChips,
    // Client coordinates override for distance calculations
    clientCoordinates,
  } = useAppData();

  // State management
  const [selectedRows, setSelectedRows] = useState([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [orgPhone, setOrgPhone] = useState("");

  // Legacy state - kept for sidebar compatibility, will be removed
  const [selectedMore, setSelectedMore] = useState([]);

  // Fetch org phone on mount
  useEffect(() => {
    const loadOrgPhone = async () => {
      if (loggedInUser?.registered_organization) {
        const phone = await fetchOrgPhone(loggedInUser.registered_organization);
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
        return !!selectedLocationZip || !!selectedLocationCity || !!selectedLocationCounty;
      case "llm":
        return false; // LLM mode not yet implemented
      default:
        return false;
    }
  }, [activeSearchMode, selectedZipCode, selectedParentOrg, selectedChildOrg, selectedLocationZip, selectedLocationCity, selectedLocationCounty]);

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
        // Apply most specific filter available: zip > city > county
        if (selectedLocationZip) {
          filtered = filtered.filter(record => record.org_zip_code === selectedLocationZip);
        } else if (selectedLocationCity) {
          filtered = filtered.filter(record => record.org_city === selectedLocationCity);
        } else if (selectedLocationCounty) {
          filtered = filtered.filter(record => record.org_county === selectedLocationCounty);
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
        // LLM mode not yet implemented
        filtered = [];
        break;

      default:
        break;
    }

    // Filter by active assistance chips (if any are selected)
    if (activeAssistanceChips.size > 0) {
      // Debug: Log what we're filtering with
      const chipsArray = [...activeAssistanceChips];
      console.log('🎯 Assistance filter:', {
        activeChips: chipsArray,
        activeChipsFirstValue: chipsArray[0],
        activeChipsFirstValueType: typeof chipsArray[0],
        sampleRecordAssistId: filtered[0]?.assist_id,
        sampleRecordAssistIdType: typeof filtered[0]?.assist_id,
        wouldMatch: chipsArray[0] === filtered[0]?.assist_id,
      });

      filtered = filtered.filter(record => {
        const matches = activeAssistanceChips.has(record.assist_id);
        return matches;
      });

      console.log(`🎯 After assistance filter: ${filtered.length} records`);
    }

    // Calculate distance for each record (if we have reference coordinates)
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

    // Sorting is handled by ResultsList (status_id, assist_id, miles)
    return filtered;
  }, [directory, zipCodes, activeSearchMode, selectedZipCode, selectedParentOrg, selectedChildOrg, selectedLocationZip, selectedLocationCity, selectedLocationCounty, activeAssistanceChips, hasActiveFilter, clientCoordinates]);

  // Refs
  const sidebarRef = useRef(null);

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

  // Legacy logging functions removed - zip code selection now handled by NavBar2
  // Assistance selection now handled by NavBar3

  // UPDATED: Remove individual logging from more assistance selection
  const logAndToggleMore = (a) => {
    setSelectedMore((prev) =>
      prev.includes(a) ? prev.filter((v) => v !== a) : [...prev, a]
    );
  };

  // Helper to log referrals to database
  const logReferrals = async (selectedDataToLog, deliveryMethod) => {
    try {
      console.log(`Starting ${deliveryMethod} logging process`);

      // Log the main event
      const { data: mainLogData, error: mainLogError } = await supabase
        .from('app_usage_logs')
        .insert({
          reg_organization: loggedInUser?.registered_organization,
          language: 'English',
          nav_item: 'Zip Code',
          search_field: deliveryMethod === 'email' ? 'Send Email' : 'Create Pdf',
          search_value: `${selectedDataToLog.length} records`,
          action_type: deliveryMethod,
          date: new Date().toISOString().split('T')[0]
        })
        .select('id')
        .single();

      if (mainLogError) {
        console.error(`Error creating main ${deliveryMethod} log:`, mainLogError);
        return;
      }

      // Log individual referrals
      if (selectedDataToLog.length > 0 && mainLogData?.id) {
        const logId = mainLogData.id;

        for (const record of selectedDataToLog) {
          const orgName = record?.organization;
          const assistanceType = record?.assistance || 'general';

          console.log(`Processing ${deliveryMethod} referral: ${orgName} with type ${assistanceType}`);

          const { error } = await supabase
            .from('email_referrals')
            .insert({
              email_log_id: logId,
              organization: orgName,
              assistance_type: assistanceType,
              reg_organization: loggedInUser?.registered_organization,
              language: 'English',
              delivery_method: deliveryMethod
            });

          if (error) {
            console.error(`Error inserting ${deliveryMethod} referral:`, error);
          }
        }

        console.log(`Completed logging ${selectedDataToLog.length} ${deliveryMethod} referrals`);
      }
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
    // Future: add llmQuery when LLM search is implemented
  });

  // Email success handler - called from NavBar1 panel
  const handleEmailSuccess = async (recipient) => {
    const dataToSend = selectedRows?.map((i) => filteredDirectory[i]).filter(Boolean);

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
    await logReferrals(dataToSend, 'email');
  };

  // PDF success handler - called from NavBar1 panel
  const handlePdfSuccess = async () => {
    const dataToSend = selectedRows?.map((i) => filteredDirectory[i]).filter(Boolean);

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
    await logReferrals(dataToSend, 'pdf');
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
  const selectedData = selectedRows?.map((i) => filteredDirectory[i]).filter(Boolean);

  return (
    <PageLayout
      filteredCount={filteredDirectory.length}
      selectedCount={selectedRows.length}
      onSendEmail={validateEmailSelection}
      onCreatePdf={validatePdfSelection}
      selectedData={selectedData}
      loggedInUser={loggedInUser}
      selectedZip={selectedZipCode}
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

      {showSidebar && (
        <AssistanceSidebar
          sidebarRef={sidebarRef}
          selectedMore={selectedMore || []}
          toggleMore={logAndToggleMore}
          clearMore={() => setSelectedMore([])}
          assistanceTypes={assistanceTypes || []}
          onClose={() => setShowSidebar(false)}
        />
      )}

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
            records={filteredDirectory}
            assistanceData={assistance}
            orgAssistanceMap={orgAssistanceMap}
            selectedIds={new Set(selectedRows.map(i => filteredDirectory[i]?.id).filter(Boolean))}
            onSelectionChange={(newSelectedIds) => {
              // Convert Set of IDs back to array of indices for compatibility
              const newSelectedRows = filteredDirectory
                .map((r, i) => newSelectedIds.has(r.id) ? i : -1)
                .filter(i => i >= 0);
              setSelectedRows(newSelectedRows);
            }}
          />
        )}

        {/* LEGACY: Original SearchResults - hidden for now
        <div className="flex-1 overflow-y-auto pb-6">
          {!selectedZip ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="text-xl font-medium text-gray-600 mb-4">
                Please Select a Zip Code to Initiate a Search
              </div>
              <div className="text-gray-500 max-w-md">
                Results will appear here after you select a zip code.
              </div>
            </div>
          ) : (
            <SearchResults
              filtered={filtered || []}
              expandedRows={expandedRows || {}}
              rowRefs={rowRefs}
              toggleExpand={(i) =>
                setExpandedRows((prev) => ({ ...prev, [i]: !prev[i] }))
              }
              selectedRows={selectedRows || []}
              setSelectedRows={setSelectedRows}
            />
          )}
        </div>
        */}
      </div>

    </PageLayout>
  );
}