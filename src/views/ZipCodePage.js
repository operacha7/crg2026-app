// src/views/ZipCodePage.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import PageLayout from "../layout/PageLayout";
import ZipCodeSearch from "../components/ZipCodeSearch";
import AssistanceSidebar from "../components/AssistanceSidebar";
import SearchResults from "../components/SearchResults";
import EmailDialog from "../components/EmailDialog";
import SwingingSign from "../components/SwingingSign";
import { logUserAction } from '../Utility/UserAction';
import { useTranslate } from "../Utility/Translate";
import { useLanguage } from "../Contexts/LanguageContext";
import { useTour } from "../Contexts/TourProvider";
import TourStep from "../Contexts/TourStep";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { toast } from "react-hot-toast";
import { supabase } from "../MainApp";
import { dataService } from "../services/dataService"; // Add this import

export default function ZipCodePage({
  records = [],
  zips = [],
  assistanceTypes = [],
  loggedInUser,
}) {
  // Get language from context
  const { language } = useLanguage();
  // Use translation utility without passing language
  const { translate } = useTranslate();
  // Get tour functions
  const { registerRef } = useTour();

  // Register refs for tour targets
  const zipCodeRef = registerRef("zipCode");
  const assistanceRef = registerRef("assistance");
  const resultsRef = registerRef("results");
  const statusRef = registerRef("status");
  const languageToggleRef = registerRef("languageToggle");
  const footerLinksRef = registerRef("footerLinks");

  // Get main assistance types dynamically
  const mainAssistance = assistanceTypes
    .filter(type => type.main === true)
    .map(type => type.assistance);

  // State management
  const [selectedZip, setSelectedZip] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [selectedMain, setSelectedMain] = useState([]);
  const [selectedMore, setSelectedMore] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedRows, setSelectedRows] = useState([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  
  // PDF STATES
  const [showPdfDialog, setShowPdfDialog] = useState(false);

  // NEW: Coordinate override states
  const [overrideCoordinates, setOverrideCoordinates] = useState("");
  const [zipDefaultCoordinates, setZipDefaultCoordinates] = useState("");

  // Refs
  const sidebarRef = useRef(null);
  const rowRefs = useRef({});

  // Animation values
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  // UPDATED: Consolidated assistance logging function
  const logAssistanceSearch = useCallback(() => {
    const allSelected = [...selectedMain, ...selectedMore];
    if (allSelected.length > 0) {
      logUserAction({
        reg_organization: loggedInUser?.registered_organization,
        language,
        nav_item: 'Zip Code',
        search_field: 'assistance',
        search_value: allSelected.join(', '), // "Food, Housing, Utilities"
        action_type: 'search',
      }).catch(err => console.error('Failed to log assistance search:', err));
    }
  }, [selectedMain, selectedMore, loggedInUser, language]);

// Add this useEffect to both ZipCodePage and GeneralSearchPage
useEffect(() => {
  // Clear assistance selections when language changes
  setSelectedMain([]);        // ZipCodePage only
  setSelectedMore([]);        // ZipCodePage only  
}, [language]);

// NEW: Function to get zip coordinates (default or override)
const getEffectiveCoordinates = useCallback(async () => {
  if (overrideCoordinates) {
    return overrideCoordinates;
  }
  
  if (zipDefaultCoordinates) {
    return zipDefaultCoordinates;
  }
  
  if (selectedZip) {
    try {
      const zipData = await dataService.getZipCodeByZip(selectedZip);
      if (zipData && zipData.coordinates) {
        setZipDefaultCoordinates(zipData.coordinates);
        return zipData.coordinates;
      }
    } catch (error) {
      console.error("Error fetching zip coordinates:", error);
    }
  }
  
  return null;
}, [selectedZip, overrideCoordinates, zipDefaultCoordinates]);

// UPDATED: Filter records with distance calculation
useEffect(() => {
  const picks = [...selectedMain, ...selectedMore];
  
  // Only show results if a zip code is selected
  if (!selectedZip) {
    setFiltered([]);
    return;
  }

  const filterWithDistance = async () => {
    try {
      const coordinates = await getEffectiveCoordinates();
      if (!coordinates) {
        console.error("No coordinates available for distance calculation");
        setFiltered([]);
        return;
      }

      // Get resources with distance calculation
      const resourcesWithDistance = language === "Español" 
        ? await dataService.getResourcesWithDistanceEs(coordinates)
        : await dataService.getResourcesWithDistanceEn(coordinates);

      // Apply zip code and assistance filters
      const newFiltered = resourcesWithDistance.filter((r) => {
        const zipMatch = r.zip_codes?.includes(selectedZip) || r.zip_codes?.includes("99999");
        const assistMatch = picks.length ? picks.includes(r.assistance) : true;
        return zipMatch && assistMatch;
      });

      setFiltered(newFiltered);
        
      // Log assistance search when results are filtered
      if (selectedZip && picks.length > 0) {
        logAssistanceSearch();
      }
    } catch (error) {
      console.error("Error filtering resources with distance:", error);
      // Fallback to original filtering without distance
      const newFiltered = records.filter((r) => {
        const zipMatch = r.zip_codes?.includes(selectedZip) || r.zip_codes?.includes("99999");
        const assistMatch = picks.length ? picks.includes(r.assistance) : true;
        return zipMatch && assistMatch;
      });
      setFiltered(newFiltered);
    }
  };

  filterWithDistance();
  setExpandedRows({});
}, [records, selectedZip, selectedMain, selectedMore, language, overrideCoordinates, getEffectiveCoordinates, logAssistanceSearch]);

  // Handle animation for the results counter
  useEffect(() => {
    const anim = animate(count, filtered.length, {
      duration: 0.5,
      ease: "easeOut",
    });
    return () => anim.stop();
  }, [filtered.length, count]);

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

  // UPDATED: Logging function for zip code selection with coordinate management
  const logAndSetSelectedZip = async (zip) => {
    setSelectedZip(zip);
    
    // Reset override coordinates when zip code changes
    setOverrideCoordinates("");
    setZipDefaultCoordinates("");

    // Fetch and store default coordinates for the new zip code
    if (zip) {
      try {
        const zipData = await dataService.getZipCodeByZip(zip);
        if (zipData && zipData.coordinates) {
          setZipDefaultCoordinates(zipData.coordinates);
        }
      } catch (error) {
        console.error("Error fetching zip coordinates:", error);
      }
    }

    logUserAction({
      reg_organization: loggedInUser?.registered_organization,
      language,
      nav_item: 'Zip Code',
      search_field: 'zip code',
      search_value: zip,
      action_type: 'select',
    }).catch(err => console.error('Failed to log zip selection:', err));
  };

  // NEW: Function to handle coordinate override
  const handleCoordinateOverride = (newCoordinates) => {
    // Validate coordinates format (basic check)
    if (newCoordinates) {
      const coords = newCoordinates.split(',').map(c => parseFloat(c.trim()));
      if (coords.length === 2 && !coords.some(isNaN)) {
        // Normalize format with space after comma
        const normalized = `${coords[0]}, ${coords[1]}`;
        setOverrideCoordinates(normalized);
      } else {
        // Invalid coordinates, reset to default
        setOverrideCoordinates("");
      }
    } else {
      // Empty input, clear override
      setOverrideCoordinates("");
    }
  };

  // UPDATED: Remove individual logging from main assistance selection
  const logAndToggleMain = (a) => {
    setSelectedMain((prev) =>
      prev.includes(a) ? prev.filter((v) => v !== a) : [...prev, a]
    );
    // Individual assistance logging removed - now handled in useEffect
  };

  // UPDATED: Remove individual logging from more assistance selection
  const logAndToggleMore = (a) => {
    setSelectedMore((prev) =>
      prev.includes(a) ? prev.filter((v) => v !== a) : [...prev, a]
    );
    // Individual assistance logging removed - now handled in useEffect
  };

  // Email sending handler with logging
  const handleEmailSent = async () => {
    const selectedData = selectedRows?.map((i) => filtered[i]).filter(Boolean);

    // Close dialog and reset selections
    setShowEmailDialog(false);
    setSelectedRows([]);
    showAnimatedToast("✅ " + translate("tEmailSentSuccessfully"), "success");

    try {
      // Only keep essential logs
      console.log('Starting email logging process');

    
      // Log the main email event
      const { data: mainLogData, error: mainLogError } = await supabase
        .from('app_usage_logs')
        .insert({
          reg_organization: loggedInUser?.registered_organization,
          language,
          nav_item: 'Zip Code',
          search_field: 'Send Email',
          search_value: `${selectedData.length} records`,
          action_type: 'email',
          date: new Date().toISOString().split('T')[0]
        })
        .select('id')
        .single();
    
      if (mainLogError) {
        console.error('Error creating main log:', mainLogError);
        return;
      }
    
      // Log individual referrals if we have selected data
      if (selectedData.length > 0 && mainLogData?.id) {
        const logId = mainLogData.id;
    
        for (const record of selectedData) {
          const orgName = record?.organization;
          const assistanceType = record?.assistance || 'general';
    
          // This delay might be helping with async timing
          // Keep one log point that includes the crucial data
          console.log(`Processing: ${orgName} with type ${assistanceType} for ${loggedInUser?.registered_organization}`);
          
          // Use the direct insertion approach
          const { error } = await supabase
            .from('email_referrals')
            .insert({
              email_log_id: logId,
              organization: orgName,
              assistance_type: assistanceType,
              reg_organization: loggedInUser?.registered_organization,
              language: language,
              delivery_method: 'email'
            });
        
          if (error) {
            console.error('Error inserting referral:', error);
          }
        }
    
        console.log(`Completed logging ${selectedData.length} organization referrals`);
      } else {
        console.log('No selected data to log or main log ID not available');
      }
    } catch (err) {
      console.error('Failed to log email sent:', err);
      console.error('Error details:', err.message, err.stack);
    }
  };

  // PDF CREATION HANDLER with logging
  const handlePdfCreated = async () => {
    const selectedData = selectedRows?.map((i) => filtered[i]).filter(Boolean);

    // Close dialog and reset selections
    setShowPdfDialog(false);
    setSelectedRows([]);
    showAnimatedToast("✅ " + translate("tPdfCreatedSuccessfully"), "success");

    try {
      console.log('Starting PDF logging process');

      // Log the main PDF event
      const { data: mainLogData, error: mainLogError } = await supabase
        .from('app_usage_logs')
        .insert({
          reg_organization: loggedInUser?.registered_organization,
          language,
          nav_item: 'Zip Code',
          search_field: 'Create Pdf',
          search_value: `${selectedData.length} records`,
          action_type: 'pdf',
          date: new Date().toISOString().split('T')[0]
        })
        .select('id')
        .single();
    
      if (mainLogError) {
        console.error('Error creating main PDF log:', mainLogError);
        return;
      }
    
      // Log individual referrals if we have selected data
      if (selectedData.length > 0 && mainLogData?.id) {
        const logId = mainLogData.id;
    
        for (const record of selectedData) {
          const orgName = record?.organization;
          const assistanceType = record?.assistance || 'general';
    
          console.log(`Processing PDF referral: ${orgName} with type ${assistanceType} for ${loggedInUser?.registered_organization}`);
          
          // Insert into email_referrals table with delivery_method = 'pdf'
          const { error } = await supabase
            .from('email_referrals')
            .insert({
              email_log_id: logId,
              organization: orgName,
              assistance_type: assistanceType,
              reg_organization: loggedInUser?.registered_organization,
              language: language,
              delivery_method: 'pdf'
            });
        
          if (error) {
            console.error('Error inserting PDF referral:', error);
          }
        }
    
        console.log(`Completed logging ${selectedData.length} PDF organization referrals`);
      } else {
        console.log('No selected data to log or main log ID not available');
      }
    } catch (err) {
      console.error('Failed to log PDF created:', err);
      console.error('Error details:', err.message, err.stack);
    }
  };

  // Calculate selected data for display
  const selectedData = selectedRows?.map((i) => filtered[i]).filter(Boolean);

  return (
    <PageLayout
      languageToggleRef={languageToggleRef}
      footerLinksRef={footerLinksRef} 
      onSendEmail={() => {
        if (!selectedRows || selectedRows.length === 0) {
          showAnimatedToast(
            `\u26A0\uFE0F ${translate("tSelectRecordsForEmail")}`,
            "error"
          );
        } else {
          setShowEmailDialog(true);
        }
      }}
      onCreatePdf={() => {
        if (!selectedRows || selectedRows.length === 0) {
          showAnimatedToast(
            `\u26A0\uFE0F ${translate("tSelectRecordsForPdf")}`,
            "error"
          );
        } else {
          setShowPdfDialog(true);
        }
      }}
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

      {showEmailDialog && (
        <EmailDialog
          onClose={() => setShowEmailDialog(false)}
          onSuccess={handleEmailSent}
          selectedData={selectedData}
          userDetails={loggedInUser}
          selectedZip={selectedZip}
          loggedInUser={loggedInUser}
        />
      )}

      {showPdfDialog && (
        <EmailDialog
          isPdfMode={true}
          onClose={() => setShowPdfDialog(false)}
          onSuccess={handlePdfCreated}
          selectedData={selectedData}
          userDetails={loggedInUser}
          selectedZip={selectedZip}
          loggedInUser={loggedInUser}
        />
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-none bg-gray-50 p-2 md:p-4 z-10">
          {/* Modified grid layout for responsiveness */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6 items-start">
            {/* UPDATED: Zip Code Search with coordinate override */}
            <div className="zip-search-container mb-3 md:mb-0" ref={zipCodeRef}>
              <ZipCodeSearch
                zips={Array.isArray(zips) ? zips : []}
                selectedZip={selectedZip}
                setSelectedZip={logAndSetSelectedZip}
                zipDefaultCoordinates={zipDefaultCoordinates}
                overrideCoordinates={overrideCoordinates}
                onCoordinateOverride={handleCoordinateOverride}
              />
            </div>

            {/* Assistance Selection with ref */}
            <div className="assistance-selection mb-3 md:mb-0" ref={assistanceRef}>
              <label className="block mb-0 mt-1 font-label">{translate("tAssistance")}</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {mainAssistance.map((a) => {
                  // No need for translation since the data is already in the correct language
                  return (
                    <button
                      key={a}
                      onClick={() => logAndToggleMain(a)}
                      className={`border-2 px-2 py-1 rounded text-[0.9rem] md:text-[1.2rem] ${
                        (selectedMain || []).includes(a)
                          ? "bg-[#FFF5DC] border-[#FFC857] font-medium text-[#4A4E69] shadow-md"
                          : "bg-[#ffffff] border-gray-300 shadow-sm"
                      }`}
                    >
                      {a} {(selectedMain || []).includes(a) && "\u2713"}
                    </button>
                  );
                })}
                <button
                  onClick={() => setShowSidebar(true)}
                  className="col-span-2 md:col-span-3 mt-1 text-xs underline text-blue-600 text-left"
                >
                  {translate("tMoreOptions")}
                </button>
              </div>
            </div>

            {/* Results Counter with ref - now in a flex row on mobile */}
            <div className="flex justify-center items-center results-counter mb-3 md:mb-0" ref={resultsRef}>
              <div className="flex flex-row items-center gap-4">
                <motion.div
                  key={filtered.length}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-16 h-16 md:w-20 md:h-20 bg-[#EB6E1F] text-[#002D62] text-[28px] md:text-[36px] font-comfortaa font-bold rounded-full flex items-center justify-center"
                >
                  <motion.span>{rounded}</motion.span>
                </motion.div>

                {selectedData.length > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-700">
                    </div>
                    <motion.div
                      key={selectedData.length}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="w-16 h-16 md:w-20 md:h-20 bg-[#002D62] text-[#EB6E1F] text-[28px] md:text-[36px] font-comfortaa font-bold rounded-full flex items-center justify-center"
                    >
                      <motion.span>{selectedData.length}</motion.span>
                    </motion.div>
                  </div>
                )}
              </div>
            </div>
            
            {/* SwingingSign - centered on mobile */}
            <div className="flex justify-center items-center mb-2 md:mb-0" >
              <SwingingSign organizationName={loggedInUser?.registered_organization} />
            </div>
          </div>
        </div>



        <div className="flex-1 overflow-y-auto pb-6">
  {!selectedZip ? (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="text-xl font-medium text-gray-600 mb-4">
        {translate("tPleaseSelectZipCode")}
      </div>
      <div className="text-gray-500 max-w-md">
        {translate("tResultsWillAppearAfterSelection")}
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
      statusRef={statusRef}
    />
  )}
</div>
      </div>

      {/* Tour Steps - now properly separated from components */}
      <TourStep tourName="zipCodeTour" targetRef="zipCode" content="tourDescriptionZipCode" placement="bottom"/>
      <TourStep tourName="zipCodeTour" targetRef="assistance" content="tourDescriptionAssistance" placement="bottom"/>
      <TourStep tourName="zipCodeTour" targetRef="results" content="tourDescriptionResults" placement="bottom"/>

      <TourStep tourName="zipCodeTour" targetRef="record" content="tourDescriptionRecord" placement="right"/>
      <TourStep tourName="zipCodeTour" targetRef="status" content="tourDescriptionStatus" placement="bottom"/>
      <TourStep tourName="zipCodeTour" targetRef="requirements" content="tourDescriptionRequirements" placement="bottom"/>

      <TourStep tourName="zipCodeTour" targetRef="languageToggle" content="tourDescriptionLanguageToggle" placement="top-high1"/>
      <TourStep tourName="zipCodeTour" targetRef="footerLinks" content="tourDescriptionFooterLinks" placement="top-high"/>

    </PageLayout>
  );
}