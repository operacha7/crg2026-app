// src/components/EmailDialog.js
import React, { useState, useEffect } from "react";
import { LOGO_URL_Email } from "../data/constants";
import { supabase } from "../MainApp";
import {
  formatAddress,
  formatHoursFromJson,
  formatDistance,
  parseRequirements,
} from "../utils/formatters";

// Fixed usage tracking utility functions - NO AUTO-RESET
const checkPdfLimit = async (orgName) => {
  // Skip check if no organization (dev mode / login bypass)
  if (!orgName) {
    console.warn("No organization provided - skipping PDF limit check (dev mode)");
    return { allowed: true, remaining: 999 };
  }

  try {
    const { data: org, error } = await supabase
      .from("registered_organizations")
      .select("pdf_mo_limit, pdf_mo_actual")
      .eq("registered_organization", orgName)
      .single();

    if (error) {
      console.error("Error checking PDF limit:", error);
      return { allowed: false, error: "Database error" };
    }

    const limit = org.pdf_mo_limit || 0;
    const currentActual = org.pdf_mo_actual || 0;

    if (limit === 0) {
      return {
        allowed: false,
        message: "Authorization required to create a PDF. Please contact Support.",
      };
    }

    if (currentActual >= limit) {
      return {
        allowed: false,
        message: "Monthly PDF limits reached. Please contact Support.",
      };
    }

    return {
      allowed: true,
      remaining: limit - currentActual,
    };
  } catch (err) {
    console.error("Error in checkPdfLimit:", err);
    return { allowed: false, error: err.message };
  }
};

const checkEmailLimit = async (orgName) => {
  // Skip check if no organization (dev mode / login bypass)
  if (!orgName) {
    console.warn("No organization provided - skipping email limit check (dev mode)");
    return { allowed: true, remaining: 999 };
  }

  try {
    const { data: org, error } = await supabase
      .from("registered_organizations")
      .select("email_mo_limit, email_mo_actual")
      .eq("registered_organization", orgName)
      .single();

    if (error) {
      console.error("Error checking email limit:", error);
      return { allowed: false, error: "Database error" };
    }

    const limit = org.email_mo_limit || 0;
    const currentActual = org.email_mo_actual || 0;

    if (limit === 0) {
      return {
        allowed: false,
        message: "Authorization required to send an email. Please contact Support.",
      };
    }

    if (currentActual >= limit) {
      return {
        allowed: false,
        message: "Monthly email limits reached. Please contact Support.",
      };
    }

    return {
      allowed: true,
      remaining: limit - currentActual,
    };
  } catch (err) {
    console.error("Error in checkEmailLimit:", err);
    return { allowed: false, error: err.message };
  }
};

/**
 * Format hours data to HTML for email display
 * Uses the shared formatHoursFromJson utility
 */
function formatHoursHtml(record) {
  const formattedHours = formatHoursFromJson(record.org_hours);
  if (!formattedHours) return "";

  let html = "";

  // Legacy format (non-JSON string)
  if (formattedHours.legacy) {
    return `<div>${formattedHours.legacy}</div>`;
  }

  // Regular and special hours in two-column layout
  if (formattedHours.rows?.length > 0 || formattedHours.special?.length > 0) {
    const allRows = [...(formattedHours.rows || []), ...(formattedHours.special || [])];
    html += `<table cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">`;
    allRows.forEach((row) => {
      html += `<tr>
        <td style="text-align: right; padding-right: 15px; white-space: nowrap;">${row.days}</td>
        <td style="text-align: right; white-space: nowrap;">${row.hours}</td>
      </tr>`;
    });
    html += `</table>`;
  }

  // Labeled hours (Office, Shelter, etc.)
  if (formattedHours.labeled?.length > 0) {
    formattedHours.labeled.forEach((item) => {
      html += `<div style="margin-top: 4px;">
        <strong>${item.label}:</strong>
        <span style="margin-left: 8px;">${item.days} ${item.hours}</span>
      </div>`;
    });
  }

  return html;
}

/**
 * Format hours notes in red italics
 */
function formatHoursNotesHtml(hoursNotes) {
  if (!hoursNotes) return "";
  return `<div style="color: #e74c3c; font-style: italic; margin-top: 8px;">${hoursNotes}</div>`;
}

export default function EmailDialog({
  onClose,
  onSuccess,
  selectedData,
  userDetails,
  selectedZip,
  loggedInUser,
  isPdfMode = false,
}) {
  console.log("EmailDialog props:", { isPdfMode, selectedData, selectedZip });
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [orgPhone, setOrgPhone] = useState("");
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(true);

  useEffect(() => {
    const fetchOrgPhone = async () => {
      if (loggedInUser?.registered_organization) {
        const { data, error } = await supabase
          .from("registered_organizations")
          .select("org_phone")
          .eq("registered_organization", loggedInUser.registered_organization)
          .single();

        if (error) {
          console.error("Error fetching org_phone:", error);
        } else {
          setOrgPhone(data?.org_phone || "");
        }
      }
    };

    fetchOrgPhone();
  }, [loggedInUser]);

  // Check if any selected records have Inactive status
  useEffect(() => {
    const hasInactive = selectedData.some((item) => {
      const status = item.status?.toUpperCase();
      return status === "INACTIVE" || status === "INACTIVO";
    });

    if (hasInactive) {
      setShowWarningDialog(true);
      setShowEmailForm(false);
    }
  }, [selectedData]);

  const handleWarningContinue = () => {
    setShowWarningDialog(false);
    setShowEmailForm(true);
  };

  const handleWarningReturn = () => {
    setShowWarningDialog(false);
    onClose();
  };

  /**
   * Sort selected data by assist_id then distance
   */
  const getSortedData = () => {
    return [...selectedData].sort((a, b) => {
      // Sort by assist_id first
      const aAssistId = parseInt(a.assist_id, 10) || 999;
      const bAssistId = parseInt(b.assist_id, 10) || 999;
      if (aAssistId !== bAssistId) {
        return aAssistId - bAssistId;
      }
      // Then by distance (nearest first)
      const aMiles = a.distance ?? Infinity;
      const bMiles = b.distance ?? Infinity;
      return aMiles - bMiles;
    });
  };

  /**
   * Format resource data as HTML for email/PDF
   * Single column layout for mobile-friendly display
   * Groups by assist_id, displays assistance label as header
   */
  const formatHtml = () => {
    const sortedData = getSortedData();

    // Group by assist_id (but display assistance label)
    const grouped = sortedData.reduce((acc, item) => {
      const assistId = item.assist_id || "999";
      if (!acc[assistId]) {
        acc[assistId] = {
          label: item.assistance || "Other",
          items: [],
        };
      }
      acc[assistId].items.push(item);
      return acc;
    }, {});

    return Object.values(grouped)
      .map((group) => {
        const sectionRows = group.items
          .map((e, idx) => {
            // Format address using shared utility
            const addressLines = formatAddress(e);
            const addressHtml = addressLines.join("<br/>");

            // Format requirements using shared utility
            const reqs = parseRequirements(e.requirements);
            const bullets =
              reqs.length > 0
                ? reqs.map((r) => `<li>${r}</li>`).join("\n")
                : "";

            // Format distance
            const distanceText = formatDistance(e.distance);

            // Format hours
            const hoursHtml = formatHoursHtml(e);
            const hoursNotesHtml = formatHoursNotesHtml(e.hours_notes);

            return `
<div style="font-family: Arial, sans-serif; margin-bottom: 24px; padding-left: 8px;">
  <!-- Number and Org Name -->
  <div style="font-size: 16px; font-weight: bold;">
    ${idx + 1}.&nbsp;&nbsp;<a href="${e.webpage || "#"}" target="_blank" style="color: #0066cc; text-decoration: underline;">${e.organization || "N/A"}</a>
  </div>

  <!-- Phone -->
  <div style="font-size: 16px; font-weight: bold; margin-top: 4px; padding-left: 24px;">
    ${e.org_telephone || ""}
  </div>

  <!-- Distance -->
  ${distanceText ? `<div style="font-size: 14px; margin-top: 12px; padding-left: 24px;">${distanceText}</div>` : ""}

  <!-- Address -->
  <div style="font-size: 14px; margin-top: 4px; padding-left: 24px;">
    <a href="${e.googlemaps || "#"}" target="_blank" style="color: #0066cc; text-decoration: underline;">
      ${addressHtml}
    </a>
  </div>

  <!-- Hours -->
  <div style="font-size: 14px; margin-top: 12px; padding-left: 24px;">
    ${hoursHtml}
    ${hoursNotesHtml}
  </div>

  <!-- Important Details -->
  ${bullets ? `
  <div style="margin-top: 12px; padding-left: 24px;">
    <u style="font-size: 14px;">Important Details:</u>
    <ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 14px;">${bullets}</ul>
  </div>
  ` : ""}
</div>`;
          })
          .join("\n");

        return `
<h3 style="font-family: Arial, sans-serif; text-decoration: underline; margin-top: 24px; margin-bottom: 16px;">Assistance:&nbsp;&nbsp;${group.label}</h3>
${sectionRows}`;
      })
      .join("\n");
  };

  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const handleCreatePdf = async () => {
    console.log("=== PDF CREATION STARTED ===");

    const limitCheck = await checkPdfLimit(loggedInUser?.registered_organization);
    if (!limitCheck.allowed) {
      setStatus(limitCheck.message || limitCheck.error);
      return;
    }

    setSending(true);
    try {
      const htmlContent = formatHtml();
      console.log("formatHtml() result:", htmlContent);
      console.log("HTML length:", htmlContent.length);

      const pdfHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              margin: 0.5in 0.75in 1in 0.75in;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              padding-bottom: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
            }
            .title {
              font-family: 'Comfortaa', cursive;
              font-size: 24px;
              color: #4A4E69;
              font-weight: bold;
              margin: 10px 0;
            }
            .subtitle {
              font-size: 14px;
              color: #000;
              margin: 5px 0;
            }
            .content {
              margin-bottom: 40px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${LOGO_URL_Email}" alt="CRG Logo" style="height:40px; vertical-align:middle; margin-right:12px;" />
            <span class="title">Community Resources Guide Houston</span>
            <div style="margin-top: 0px;">
              <div class="subtitle">Selection:  ${selectedZip}</div>
              <div class="subtitle">Generated:  ${new Date().toLocaleDateString()}</div>
              <div class="subtitle">By:  ${loggedInUser?.registered_organization || "Unknown Organization"}</div>
              <div class="subtitle">Telephone:  ${orgPhone}</div>
            </div>
          </div>

          <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
            <strong style="color: #856404; font-size: 14px;">IMPORTANT: This information was current as of the generated date listed above. For the most up-to-date resources, hours, and contact information, please visit the online Community Resources Guide website.</strong>
          </div>

          <div class="content">
            ${htmlContent}
          </div>
        </body>
        </html>`;

      const pdfPayload = {
        htmlBody: pdfHtml,
        filename: `CRG - ${selectedZip} - ${getCurrentDate()}.pdf`,
        organization: loggedInUser?.registered_organization,
        footer: {
          source: `<div style="width: 100%; padding: 8px 0.75in; font-size: 8px; color: #666; font-family: Arial, sans-serif; box-sizing: border-box;"><div style="border-top: 1px solid #000; padding-top: 8px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align: left; width: 50%; font-size: 8px;">© 2025 O Peracha. All Rights Reserved. crghouston.operacha.org</td><td style="text-align: right; width: 50%; font-size: 8px;">Page {{page}} of {{total}}</td></tr></table></div></div>`,
          spacing: "10px",
        },
      };

      const pdfServiceUrl =
        window.location.hostname === "localhost"
          ? "http://localhost:8788/createPdf"
          : "/createPdf";

      const res = await fetch(pdfServiceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdfPayload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("PDF Error response:", errorText);
        throw new Error(`Failed to create PDF: ${res.status} - ${errorText}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = pdfPayload.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onSuccess(`PDF created: ${pdfPayload.filename}`, selectedData.length);
    } catch (err) {
      setStatus(`Error creating PDF: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (isPdfMode) {
      await handleCreatePdf();
      return;
    }

    const limitCheck = await checkEmailLimit(loggedInUser?.registered_organization);
    if (!limitCheck.allowed) {
      setStatus(limitCheck.message || limitCheck.error);
      return;
    }

    setSending(true);
    try {
      const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin-left: 20px;">
  <p style="font-size: 16px; margin-bottom: 20px;">
    <strong>Resources for Zip Code:&nbsp;&nbsp;${selectedZip || ""}</strong>
  </p>

  <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
    Thank you for reaching out to us. Here is the information that you requested. Please note while we strive to ensure that our information is current and accurate, funding levels and eligibility requirements can change at any time. This is an automated message and is unmonitored, please <span style="color: red; font-style: italic;">do not reply</span>.
  </p>

  <p style="font-size: 14px; margin-bottom: 24px;">
    You can also access the same information at <a href="https://crghouston.operacha.org?utm_source=email&utm_medium=email&utm_campaign=resource_list" target="_blank">crghouston.operacha.org</a>.
  </p>

  ${formatHtml()}

  <p style="font-size: 14px; margin-top: 30px; line-height: 1.6;">
    We hope this information helps you secure the assistance you need. Please call us back at ${orgPhone || "[phone number]"} if we can provide any other resources.
  </p>

  <div style="margin-top: 40px; text-align: center; border-top: 1px solid #ccc; padding-top: 20px;">
    <a href="https://crghouston.operacha.org?utm_source=email&utm_medium=email&utm_campaign=resource_list" target="_blank" style="text-decoration: none; color: inherit;">
      <img src="${LOGO_URL_Email}" alt="CRG Logo" style="height: 25px; vertical-align: middle; margin-right: 8px;" />
      <span style="font-size: 14px; font-family: Verdana, sans-serif; font-weight: 500; color: #4A4E69; vertical-align: middle;">Community Resources Guide Houston</span>
    </a>
  </div>
</div>`;

      const payload = {
        recipient,
        subject: "Resources & Support Information",
        htmlBody: emailHtml,
        organization: loggedInUser?.registered_organization,
        headers: {
          "X-Entity-Ref-ID": "logo-signature",
          "Content-Type": "text/html; charset=UTF-8",
        },
      };

      const emailServiceUrl =
        window.location.hostname === "localhost"
          ? "http://localhost:8788/sendEmail"
          : "/sendEmail";

      const res = await fetch(emailServiceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        onSuccess(recipient, selectedData.length);
      } else {
        setStatus("Email failed to send.");
      }
    } catch (err) {
      setStatus(`Error sending email: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // Warning Dialog Component
  if (showWarningDialog) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto p-6">
          <h3 className="text-lg font-bold mb-4 text-left text-red-600">
            Inactive Resources
          </h3>
          <p className="text-left mb-6 text-gray-700">
            You have selected an organization listed as Inactive. Please Return and correct.
          </p>
          <div className="flex justify-between gap-4">
            <button
              onClick={handleWarningContinue}
              className="flex-1 px-4 py-2 bg-gray-300 rounded"
            >
              Continue
            </button>
            <button
              onClick={handleWarningReturn}
              className="flex-1 px-4 py-2 bg-[#4A4E69] text-white rounded"
            >
              Return
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Email Form Component
  if (showEmailForm) {
    console.log("Rendering email form, isPdfMode:", isPdfMode);
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto p-5">
          <h3 className="text-lg font-bold mb-3">
            {isPdfMode ? "Create PDF" : "Send Selected Resources"}
          </h3>

          {!isPdfMode && (
            <input
              type="email"
              placeholder="Recipient Email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full p-2 border rounded mb-3"
            />
          )}

          <div className="flex justify-between">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 bg-gray-300 rounded text-sm md:text-base"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || (!isPdfMode && !recipient)}
              className="px-4 py-2 bg-[#4A4E69] text-white rounded text-sm md:text-base"
            >
              {sending
                ? isPdfMode
                  ? "Creating ..."
                  : "Sending ..."
                : isPdfMode
                ? "Create"
                : "Send"}
            </button>
          </div>
          {status && <p className="mt-3 text-sm text-red-600">{status}</p>}
        </div>
      </div>
    );
  }

  return null;
}
