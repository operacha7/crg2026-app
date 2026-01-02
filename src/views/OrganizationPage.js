// src/views/OrganizationPage.js
import React, { useState, useRef, useEffect, useMemo } from "react";
import PageLayout from "../layout/PageLayout";
import OrganizationSearch from "../components/OrganizationSearch";
import SearchResults from "../components/SearchResults";
import useFetchCRGData from "../data/FetchDataSupabase";
import EmailDialog from "../components/EmailDialog";
import SwingingSign from "../components/SwingingSign";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import { supabase } from "../MainApp";
import { logUserAction } from "../Utility/UserAction";
import { useTranslate } from "../Utility/Translate"; // Add this import
import { useLanguage } from "../Contexts/LanguageContext"; // Add this import

export default function OrganizationPage({ loggedInUser }) {
  // Add these hooks
  const { language } = useLanguage();
  const { translate } = useTranslate();

  const { records, organizations, expandedRows, setExpandedRows } =
    useFetchCRGData(); // Remove loggedInUser?.language as it now comes from context

  const [filtered, setFiltered] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // NEW PDF STATES
  const [showPdfDialog, setShowPdfDialog] = useState(false);

  const rowRefs = useRef({});
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    if (!selectedOrg) {
      // If no organization selected, show no results
      setFiltered([]);
    } else {
      const newFiltered = records.filter(
        (r) => (r?.parent_organization || "").trim() === selectedOrg
      );
      setFiltered(newFiltered);
    }
    setExpandedRows({});
  }, [records, selectedOrg, setExpandedRows]);

  useEffect(() => {
    const anim = animate(count, filtered.length, {
      duration: 0.5,
      ease: "easeOut",
    });
    return () => anim.stop();
  }, [filtered.length, count]);

  const toggleExpand = (i) =>
    setExpandedRows((prev) => ({ ...prev, [i]: !prev[i] }));

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

  // Logging function for organization selection
  const logAndSetSelectedOrg = (org) => {
    setSelectedOrg(org);

    logUserAction({
      reg_organization: loggedInUser?.registered_organization,
      language,
      nav_item: "Organization",
      search_field: "organization",
      search_value: org,
      action_type: "select",
    }).catch((err) => console.error("Failed to log org selection:", err));
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
      console.log("Starting email logging process");

      // Log the main email event
      const { data: mainLogData, error: mainLogError } = await supabase
        .from("app_usage_logs")
        .insert({
          reg_organization: loggedInUser?.registered_organization,
          language,
          nav_item: "Organization",
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

          // Keep one log point that includes the crucial data
          console.log(
            `Processing: ${orgName} with type ${assistanceType} for ${loggedInUser?.registered_organization}`
          );

          // Use the direct insertion approach
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

        console.log(
          `Completed logging ${selectedData.length} organization referrals`
        );
      } else {
        console.log("No selected data to log or main log ID not available");
      }
    } catch (err) {
      console.error("Failed to log email sent:", err);
      console.error("Error details:", err.message, err.stack);
    }
  };

  // NEW PDF CREATION HANDLER with logging
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
          nav_item: "Organization",
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

  // Calculate selected data for display
  const selectedData = selectedRows?.map((i) => filtered[i]).filter(Boolean);

  const processedOrganizations = useMemo(() => {
    const parents = new Set();
    for (const o of organizations || []) {
      if ((o?.id_no ?? 0) < 8000) {
        const parent = (o?.parent_organization || o?.organization || "").trim();
        if (parent) parents.add(parent);
      }
    }
    return Array.from(parents)
      .map((name) => ({ organization: name })) // keep shape for OrganizationSearch
      .sort((a, b) => a.organization.localeCompare(b.organization));
  }, [organizations]);

  return (
    <>
      <Toaster position="top-center" />
      <PageLayout
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
        {showEmailDialog && (
          <EmailDialog
            onClose={() => setShowEmailDialog(false)}
            onSuccess={handleEmailSent}
            selectedData={selectedData}
            userDetails={loggedInUser}
            selectedZip={selectedOrg} // Using selectedOrg instead of selectedZip
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
            selectedZip={selectedOrg} // Using selectedOrg instead of selectedZip
            loggedInUser={loggedInUser}
          />
        )}

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-none bg-gray-50 p-4 z-10">
            <div className="flex justify-between items-start">
              {/* Left side - Organization dropdown */}
              <OrganizationSearch
                organizations={processedOrganizations}
                selectedOrg={selectedOrg}
                setSelectedOrg={logAndSetSelectedOrg}
              />

              {/* Middle - Counter(s) */}
              <div className="flex justify-center items-center">
                <div className="flex flex-row items-center gap-4">
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
              </div>

              <div className="flex items-center">
                <SwingingSign
                  organizationName={loggedInUser?.registered_organization}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-6">
            {!selectedOrg ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="text-xl font-medium text-gray-600 mb-4">
                  {translate("tPleaseSelectOrganization")}
                </div>
                <div className="text-gray-500 max-w-md">
                  {translate("tResultsWillAppearAfterSelectionOrg")}
                </div>
              </div>
            ) : (
              <SearchResults
                filtered={filtered}
                expandedRows={expandedRows}
                rowRefs={rowRefs}
                toggleExpand={toggleExpand}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
              />
            )}
          </div>
        </div>
      </PageLayout>
    </>
  );
}
