// src/views/GeneralSearchPage.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import PageLayout from "../layout/PageLayout";
import SearchResults from "../components/SearchResults";
import GeneralSearchSidebar from "../components/GeneralSearchSidebar";
import EmailDialog from "../components/EmailDialog";
import { Toaster, toast } from "react-hot-toast";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { supabase } from "../MainApp";
import { logUserAction } from "../Utility/UserAction";
import SwingingSign from "../components/SwingingSign";
import { useTranslate } from "../Utility/Translate";
import { useLanguage } from "../Contexts/LanguageContext";
import useFetchCRGData from "../data/FetchDataSupabase";

export default function GeneralSearchPage({
  records = [],
  neighborhoodData = [],
  assistanceTypes = [],
  loggedInUser,
}) {
  // Language and translation hooks
  const { language } = useLanguage();
  const { translate } = useTranslate();

  // Search criteria states
  const [query, setQuery] = useState("");
  const [requirementsQuery, setRequirementsQuery] = useState("");
  const [excludeRequirements, setExcludeRequirements] = useState(false);
  const [selectedZip, setSelectedZip] = useState("");
  const [selectedAssist, setSelectedAssist] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // UI states
  const [showSidebar, setShowSidebar] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [filteredNeighborhoods, setFilteredNeighborhoods] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);

  // Results states
  const [filtered, setFiltered] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});

  // Get additional data
  const { zips } = useFetchCRGData();

  // Refs
  const rowRefs = useRef({});
  const sidebarRef = useRef(null);
  const wrapperRef = useRef(null);
  const dropdownListRef = useRef(null);

  // Animation values
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  // Add this useEffect to both ZipCodePage and GeneralSearchPage
  useEffect(() => {
    // Clear assistance selections when language changes

    setSelectedAssist(""); // GeneralSearchPage only
  }, [language]);

  // Load neighborhoods from neighborhoodData
  useEffect(() => {
    if (neighborhoodData && neighborhoodData.length > 0) {
      // Check if the field exists in the data
      const hasOrgCityZipField = neighborhoodData[0].hasOwnProperty(
        "org_county_city_zip_neighborhood"
      );

      // Get the field name dynamically
      const fieldName = hasOrgCityZipField
        ? "org_county_city_zip_neighborhood"
        : "org_county_city_zip_neighborhood";

      const uniqueNeighborhoods = [
        ...new Set(
          neighborhoodData.map((item) => item[fieldName]).filter(Boolean)
        ),
      ];
      setNeighborhoods(uniqueNeighborhoods);
    } else {
      // Fallback to using org_county_city_zip_neighborhood from records
      const uniqueNeighborhoods = [
        ...new Set(
          records.map((r) => r.org_county_city_zip_neighborhood).filter(Boolean)
        ),
      ];
      setNeighborhoods(uniqueNeighborhoods);
    }
  }, [neighborhoodData, records]);

  // Manage filtered neighborhoods
  useEffect(() => {
    if (!searchInput) {
      setFilteredNeighborhoods(neighborhoods);
    } else {
      const filtered = neighborhoods.filter((neighborhood) =>
        neighborhood.toLowerCase().includes(searchInput.toLowerCase())
      );
      setFilteredNeighborhoods(filtered);

      // Find and highlight the first match that starts with the input
      const index = filtered.findIndex((neighborhood) =>
        neighborhood.toLowerCase().startsWith(searchInput.toLowerCase())
      );
      setHighlightedIndex(index !== -1 ? index : -1);
    }
  }, [searchInput, neighborhoods]);

  // Handle scrolling to highlighted item
  useEffect(() => {
    if (
      showDropdown &&
      highlightedIndex >= 0 &&
      rowRefs.current[highlightedIndex]
    ) {
      rowRefs.current[highlightedIndex].scrollIntoView({
        behavior: "auto",
        block: "nearest",
      });
    }
  }, [highlightedIndex, showDropdown]);

  // Handle animation for the results counter
  useEffect(() => {
    const anim = animate(count, filtered.length, {
      duration: 0.5,
      ease: "easeOut",
    });
    return () => anim.stop();
  }, [filtered.length, count]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }

    return undefined;
  }, [showDropdown]);

  // Handle click outside to close sidebar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setShowSidebar(false);
      }
    };

    if (showSidebar) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }

    return undefined;
  }, [showSidebar]);

  // Filter records based on search criteria
  useEffect(() => {
    // Check if any search criteria are selected
    const hasSearchCriteria =
      query ||
      selectedZip ||
      selectedAssist ||
      selectedDay ||
      requirementsQuery;

    if (!hasSearchCriteria) {
      // If no search criteria, show no results
      setFiltered([]);
      return;
    }

    let res = records;

    // Filter by organization location
    if (query) {
      res = res.filter((r) =>
        r.org_county_city_zip_neighborhood
          ?.toLowerCase()
          .includes(query.toLowerCase())
      );
    }

    // Filter by zip code
    if (selectedZip) {
      res = res.filter(
        (r) => Array.isArray(r.zip_codes) && r.zip_codes.includes(selectedZip)
      );
    }

    // Filter by assistance type
    if (selectedAssist) {
      res = res.filter((r) => r.assistance === selectedAssist);
    }

    // Filter by day of operation
    if (selectedDay) {
      res = res.filter((r) => r.days_of_operation?.includes(selectedDay));
    }

    // Filter by requirements
    if (requirementsQuery) {
      if (excludeRequirements) {
        res = res.filter(
          (r) =>
            !r.requirements
              ?.toLowerCase()
              .includes(requirementsQuery.toLowerCase())
        );
      } else {
        res = res.filter((r) =>
          r.requirements
            ?.toLowerCase()
            .includes(requirementsQuery.toLowerCase())
        );
      }
    }

    setFiltered(res);
  }, [
    query,
    records,
    selectedZip,
    selectedAssist,
    selectedDay,
    requirementsQuery,
    excludeRequirements,
  ]);

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

  // Logging functions
  const logZipSearch = useCallback(
    (zip_code) => {
      if (!loggedInUser) return;

      logUserAction({
        reg_organization: loggedInUser?.registered_organization,
        language: language,
        nav_item: "General Search",
        search_field: "zip code",
        search_value: zip_code,
        action_type: "select",
      }).catch((err) => console.error("Failed to log zip search:", err));
    },
    [loggedInUser, language]
  );

  // UPDATED: Only log assistance selection, not deselection
  const logAssistanceSearch = useCallback(
    (assistance) => {
      if (!loggedInUser || !assistance) return;

      logUserAction({
        reg_organization: loggedInUser?.registered_organization,
        language: language,
        nav_item: "General Search",
        search_field: "assistance",
        search_value: assistance,
        action_type: "select",
      }).catch((err) => console.error("Failed to log assistance search:", err));
    },
    [loggedInUser, language]
  );

  const logDaySearch = useCallback(
    (day) => {
      if (!loggedInUser) return;

      logUserAction({
        reg_organization: loggedInUser?.registered_organization,
        language: language,
        nav_item: "General Search",
        search_field: "day",
        search_value: day,
        action_type: "select",
      }).catch((err) => console.error("Failed to log day search:", err));
    },
    [loggedInUser, language]
  );

  // Handler functions with logging
  const setAndLogRequirementsQuery = useCallback((value) => {
    setRequirementsQuery(value);
  }, []);

  const setAndLogExcludeRequirements = useCallback(
    (value) => {
      if (loggedInUser) {
        logUserAction({
          reg_organization: loggedInUser?.registered_organization,
          language: language,
          nav_item: "General Search",
          search_field: "requirements",
          search_value: null,
          action_type: value ? "exclude" : "include",
        }).catch((err) =>
          console.error("Failed to log requirements search:", err)
        );
      }
      setExcludeRequirements(value);
    },
    [loggedInUser, language]
  );

  const setAndLogSelectedZip = useCallback(
    (value) => {
      if (value && value !== selectedZip) {
        logZipSearch(value);
      }
      setSelectedZip(value);
    },
    [selectedZip, logZipSearch]
  );

  // UPDATED: Only log when selecting assistance, not when clearing
  const setAndLogSelectedAssist = useCallback(
    (value) => {
      const previousValue = selectedAssist;
      setSelectedAssist(value);

      // Only log if we're selecting a new assistance type (not clearing or deselecting)
      if (value && value !== previousValue) {
        logAssistanceSearch(value);
      }
      // No logging when value is empty (deselection/clearing)
    },
    [selectedAssist, logAssistanceSearch]
  );

  const setAndLogSelectedDay = useCallback(
    (value) => {
      if (value && value !== selectedDay) {
        logDaySearch(value);
      }
      setSelectedDay(value);
    },
    [selectedDay, logDaySearch]
  );

  // Email sending handler with logging
  const handleEmailSent = async () => {
    const selectedData = selectedRows?.map((i) => filtered[i]).filter(Boolean);

    // Close dialog and reset selections
    setShowEmailDialog(false);
    setSelectedRows([]);
    showAnimatedToast("✅ " + translate("tEmailSentSuccessfully"), "success");

    try {
      // Log the main email event
      const { data: mainLogData, error: mainLogError } = await supabase
        .from("app_usage_logs")
        .insert({
          reg_organization: loggedInUser?.registered_organization,
          language,
          nav_item: "General Search",
          search_field: "Send Email",
          search_value: `${selectedData.length} records`,
          action_type: "email",
          date: new Date().toISOString().split("T")[0],
        })
        .select("id")
        .single();

      if (mainLogError) {
        console.error("Error creating main log:", mainLogError);
        return;
      }

      // Log individual referrals if we have selected data
      if (selectedData.length > 0 && mainLogData?.id) {
        const logId = mainLogData.id;

        for (const record of selectedData) {
          const orgName = record?.organization;
          const assistanceType = record?.assistance || "general";

          const { error } = await supabase.from("email_referrals").insert({
            email_log_id: logId,
            organization: orgName,
            assistance_type: assistanceType,
            reg_organization: loggedInUser?.registered_organization,
            language: language,
            delivery_method: "email",
          });

          if (error) {
            console.error("Error inserting referral:", error);
          }
        }
      }
    } catch (err) {
      console.error("Failed to log email sent:", err);
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
      console.log("Starting PDF logging process");

      // Log the main PDF event
      const { data: mainLogData, error: mainLogError } = await supabase
        .from("app_usage_logs")
        .insert({
          reg_organization: loggedInUser?.registered_organization,
          language,
          nav_item: "General Search",
          search_field: "Create Pdf",
          search_value: `${selectedData.length} records`,
          action_type: "pdf",
          date: new Date().toISOString().split("T")[0],
        })
        .select("id")
        .single();

      if (mainLogError) {
        console.error("Error creating main PDF log:", mainLogError);
        return;
      }

      // Log individual referrals if we have selected data
      if (selectedData.length > 0 && mainLogData?.id) {
        const logId = mainLogData.id;

        for (const record of selectedData) {
          const orgName = record?.organization;
          const assistanceType = record?.assistance || "general";

          console.log(
            `Processing PDF referral: ${orgName} with type ${assistanceType} for ${loggedInUser?.registered_organization}`
          );

          // Insert into email_referrals table with delivery_method = 'pdf'
          const { error } = await supabase.from("email_referrals").insert({
            email_log_id: logId,
            organization: orgName,
            assistance_type: assistanceType,
            reg_organization: loggedInUser?.registered_organization,
            language: language,
            delivery_method: "pdf",
          });

          if (error) {
            console.error("Error inserting PDF referral:", error);
          }
        }

        console.log(
          `Completed logging ${selectedData.length} PDF organization referrals`
        );
      } else {
        console.log("No selected data to log or main log ID not available");
      }
    } catch (err) {
      console.error("Failed to log PDF created:", err);
      console.error("Error details:", err.message, err.stack);
    }
  };

  // Input change handler
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    setQuery(value);
    setShowDropdown(true);
  };

  // Neighborhood selection handler
  const handleNeighborhoodSelect = useCallback(
    (n) => {
      if (loggedInUser) {
        logUserAction({
          reg_organization: loggedInUser?.registered_organization,
          language: language,
          nav_item: "General Search",
          search_field: "neighborhood",
          search_value: null,
          action_type: "select",
        }).catch((err) =>
          console.error("Failed to log neighborhood search:", err)
        );
      }
      setQuery(n);
      setSearchInput(n);
      setShowDropdown(false);
    },
    [loggedInUser, language]
  );

  // Clear all filters
  const handleClearAllFilters = () => {
    setSelectedZip("");
    setSelectedAssist("");
    setSelectedDay("");
    setRequirementsQuery("");
    setExcludeRequirements(false);
    setQuery("");
    setSearchInput("");
  };

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e) => {
      if (!showDropdown) {
        if (e.key === "ArrowDown") {
          setShowDropdown(true);
          return;
        }
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredNeighborhoods.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (
            highlightedIndex >= 0 &&
            highlightedIndex < filteredNeighborhoods.length
          ) {
            handleNeighborhoodSelect(filteredNeighborhoods[highlightedIndex]);
          } else {
            setShowDropdown(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowDropdown(false);
          break;
        default:
          break;
      }
    },
    [
      showDropdown,
      filteredNeighborhoods,
      highlightedIndex,
      handleNeighborhoodSelect,
    ]
  );

  // For translated days of week
  const translatedDaysOfWeek = () => {
    return [
      { en: "Monday", es: translate("tMonday") },
      { en: "Tuesday", es: translate("tTuesday") },
      { en: "Wednesday", es: translate("tWednesday") },
      { en: "Thursday", es: translate("tThursday") },
      { en: "Friday", es: translate("tFriday") },
      { en: "Saturday", es: translate("tSaturday") },
      { en: "Sunday", es: translate("tSunday") },
    ];
  };

  // Calculate selected data for display
  const selectedData = selectedRows?.map((i) => filtered[i]).filter(Boolean);

  return (
    <>
      <Toaster position="top-center" />

      {showSidebar && (
        <GeneralSearchSidebar
          sidebarRef={sidebarRef}
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
          zip_codes={zips}
          assistanceTypes={assistanceTypes}
          daysOfWeek={translatedDaysOfWeek()}
          selectedZip={selectedZip}
          setSelectedZip={setAndLogSelectedZip}
          selectedAssist={selectedAssist}
          setSelectedAssist={setAndLogSelectedAssist}
          selectedDay={selectedDay}
          setSelectedDay={setAndLogSelectedDay}
          requirementsQuery={requirementsQuery}
          setRequirementsQuery={setAndLogRequirementsQuery}
          excludeRequirements={excludeRequirements}
          setExcludeRequirements={setAndLogExcludeRequirements}
          clearAllFilters={handleClearAllFilters}
        />
      )}

      <PageLayout
        onSendEmail={() => {
          if (selectedRows.length === 0) {
            showAnimatedToast(
              "\u26A0\uFE0F " + translate("tSelectRecordsForEmail"),
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
        {showEmailDialog && (
          <EmailDialog
            onClose={() => setShowEmailDialog(false)}
            onSuccess={handleEmailSent}
            selectedData={selectedData}
            userDetails={loggedInUser}
            loggedInUser={loggedInUser}
            selectedZip={selectedZip}
            selectedAssist={selectedAssist}
            selectedDay={selectedDay}
            requirementsQuery={requirementsQuery}
            query={query}
          />
        )}

        {showPdfDialog && (
          <EmailDialog
            isPdfMode={true}
            onClose={() => setShowPdfDialog(false)}
            onSuccess={handlePdfCreated}
            selectedData={selectedData}
            userDetails={loggedInUser}
            loggedInUser={loggedInUser}
            selectedZip={selectedZip}
            selectedAssist={selectedAssist}
            selectedDay={selectedDay}
            requirementsQuery={requirementsQuery}
            query={query}
          />
        )}

        {/* Requirements Search Field */}
        <div className="flex flex-col px-10 py-3 gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col w-[50rem] relative">
              <label className="block text-sm font-medium mb-1">
                {translate("tSearchRequirements")}
              </label>
              <input
                value={requirementsQuery}
                onChange={(e) => setAndLogRequirementsQuery(e.target.value)}
                placeholder={translate("tSearchByRquirementsPlaceholder")}
                className={`border-2 px-3 py-2 text-lg rounded w-full ${
                  requirementsQuery
                    ? "bg-[#efedd1] border-[#b5b270] font-medium shadow-md"
                    : "bg-[#efefef] border-gray-300 shadow-sm"
                } outline-none focus:outline-none focus:ring-0 ${
                  requirementsQuery
                    ? "focus:border-[#b5b270]"
                    : "focus:border-gray-300"
                }`}
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={excludeRequirements}
                  onChange={(e) =>
                    setAndLogExcludeRequirements(e.target.checked)
                  }
                />
                <span className="text-sm text-gray-700">
                  {translate("tExcludeMatchingRecords")}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-8">
              {/* Counters moved to the left side */}
              <div className="flex items-center gap-4">
                <motion.div
                  key={filtered.length}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-20 h-20 bg-[#EB6E1F] text-[#002D62] text-[36px] font-comfortaa font-bold rounded-full flex items-center justify-center"
                >
                  <motion.span>{rounded}</motion.span>
                </motion.div>

                {selectedData.length > 0 && (
                  <motion.div
                    key={selectedData.length}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="w-20 h-20 bg-[#002D62] text-[#EB6E1F] text-[36px] font-comfortaa font-bold rounded-full flex items-center justify-center"
                  >
                    <motion.span>{selectedData.length}</motion.span>
                  </motion.div>
                )}
              </div>

              {loggedInUser?.registered_organization && (
                <div className="flex items-center">
                  <SwingingSign
                    organizationName={loggedInUser?.registered_organization}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Organization Location Search Field with Dropdown */}
        <div className="flex flex-col px-10 pb-3 gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col w-[50rem] relative">
              <div ref={wrapperRef} className="w-full">
                <label className="block text-sm font-medium mb-1">
                  {translate("tSearchByOrgLocation")}
                </label>
                <input
                  value={searchInput}
                  onChange={handleInputChange}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={translate("tSearchByOrgLocationPlaceholder")}
                  className={`border-2 px-3 py-2 text-lg rounded w-full ${
                    searchInput
                      ? "bg-[#efedd1] border-[#b5b270] font-medium shadow-md"
                      : "bg-[#efefef] border-gray-300 shadow-sm"
                  } outline-none focus:outline-none focus:ring-0 ${
                    searchInput
                      ? "focus:border-[#b5b270]"
                      : "focus:border-gray-300"
                  }`}
                />
                {showDropdown && filteredNeighborhoods.length > 0 && (
                  <ul
                    ref={dropdownListRef}
                    className="absolute top-full mt-1 z-50 bg-[#efefef] shadow-lg rounded max-h-[50rem] overflow-y-auto w-full border border-gray-300"
                  >
                    {filteredNeighborhoods.map((n, idx) => (
                      <li
                        key={idx}
                        ref={(el) => (rowRefs.current[idx] = el)}
                        onClick={() => handleNeighborhoodSelect(n)}
                        className={`px-4 py-2 hover:bg-[#e0e7ff] cursor-pointer ${
                          idx === highlightedIndex
                            ? "bg-[#d1d8f0] font-medium"
                            : ""
                        } ${
                          n === searchInput ? "bg-[#efedd1] font-medium" : ""
                        }`}
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={() => setShowSidebar(true)}
                className="text-blue-600 underline text-sm text-left mt-0"
              >
                {translate("tMoreOptions")}
              </button>
            </div>
          </div>
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto pb-6">
          {!query &&
          !selectedZip &&
          !selectedAssist &&
          !selectedDay &&
          !requirementsQuery ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="text-xl font-medium text-gray-600 mb-4">
                {translate("tPleaseSelectSearchCriteria")}
              </div>
              <div className="text-gray-500 max-w-md">
                {translate("tResultsWillAppearAfterSelectionGeneral")}
              </div>
            </div>
          ) : (
            <SearchResults
              filtered={filtered}
              expandedRows={expandedRows}
              rowRefs={rowRefs}
              toggleExpand={(i) =>
                setExpandedRows((prev) => ({ ...prev, [i]: !prev[i] }))
              }
              selectedRows={selectedRows}
              setSelectedRows={setSelectedRows}
            />
          )}
        </div>
      </PageLayout>
    </>
  );
}
