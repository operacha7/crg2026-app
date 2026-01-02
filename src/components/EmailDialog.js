// src/components/EmailDialog.js
import React, { useState, useEffect } from "react";
import { LOGO_URL_Email } from "../data/constants";
import { useTranslate } from "../Utility/Translate";
import { supabase } from "../MainApp";

// Fixed usage tracking utility functions - NO AUTO-RESET
const checkPdfLimit = async (orgName, translate) => {
  try {
    // Get current organization data
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

    // Check if limit allows PDF creation
    if (limit === 0) {
      return {
        allowed: false,
        message:
          translate("tPdfNotAuthorized") ||
          "PDF creation not authorized. Please contact support.",
      };
    }

    if (currentActual >= limit) {
      return {
        allowed: false,
        message:
          translate("tPdfLimitReached") ||
          `Monthly PDF limit of ${limit} reached. Please contact support.`,
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

const checkEmailLimit = async (orgName, translate) => {
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
        message:
          translate("tEmailNotAuthorized") ||
          "Email sending not authorized. Please contact support.",
      };
    }

    if (currentActual >= limit) {
      return {
        allowed: false,
        message:
          translate("tEmailLimitReached") ||
          `Monthly email limit of ${limit} reached. Please contact support.`,
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

export default function EmailDialog({
  onClose,
  onSuccess,
  selectedData,
  userDetails,
  selectedZip,
  loggedInUser,
  isPdfMode = false,
}) {
  const { translate } = useTranslate();
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

  // Check if any selected records have Limited or Inactive status
  useEffect(() => {
    const hasLimitedOrInactive = selectedData.some((item) => {
      const status = item.status?.toUpperCase();
      return status === "INACTIVE" || status === "INACTIVO";
    });

    if (hasLimitedOrInactive) {
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

  // Format distance for email display
  const formatEmailDistance = (distance) => {
    if (distance === null || distance === undefined) return "";
    return `${distance} mi`;
  };

  const formatHtml = () => {
    // Group by the lowercase `assistance` field
    const grouped = selectedData.reduce((acc, item) => {
      const type = item.assistance;
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([type, entries]) => {
        // Build each section's HTML
        const sectionRows = entries
          .map((e, idx) => {
            // Split requirements into bullet items
            const reqs =
              e.requirements?.split("\n").filter(Boolean).slice(0, 4) || [];
            const bullets =
              reqs.length > 0
                ? reqs.map((r) => `<li>${r}</li>`).join("\n")
                : "<li>N/A</li>";

            // Format distance for display
            const distanceText = formatEmailDistance(e.distance);

            return `
              <table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="
    table-layout: fixed;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
  "
>
  <colgroup>
    <col style="width: 4ch;" />
    <col style="width: 70ch;" />
    <col style="width: auto;" />
  </colgroup>

  <tr valign="top">
    <td style="padding-left:5px; white-space:nowrap;">
      ${idx + 1}.
    </td>

    <td style="vertical-align:top; padding:0;">
      <strong>
        <a href="${e.webpage || "#"}" target="_blank">${
              e.organization || "N/A"
            }</a>
      </strong><br/>
      ${e.hours || "N/A"}<br/>
      ${
        e.hours_notes
          ? `<div style="font-style:italic; color:#e74c3c; margin-top:2px;">${e.hours_notes}</div>`
          : ""
      }
      <a href="${e.google_maps || "#"}" target="_blank">
        ${e.address || "N/A"}
      </a><br/>
      <br/>
      <strong>${translate("tNote")}:</strong>
      <ul style="margin:0; padding-left:16px;">${bullets}</ul>
      <br>
    </td>

    <td style="padding-left:8px; vertical-align:top; font-weight:bold; white-space:nowrap;">
      ${e.status ? `${translate("tStatus")}: ${e.status}<br/>` : ""}
      ${e.telephone || "N/A"}
      ${distanceText ? `<br/>${distanceText}` : ""}
    </td>
  </tr>
</table>
            `;
          })
          .join("\n");

        return `
          <h3 style="font-family:Arial,sans-serif; text-decoration:underline;">${type}</h3>
          ${sectionRows}
        `;
      })
      .join("\n");
  };

  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const handleCreatePdf = async () => {
    console.log("=== PDF CREATION STARTED ===");

    // Check PDF limit before creating
    const limitCheck = await checkPdfLimit(
      loggedInUser?.registered_organization,
      translate
    );
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
              <div class="subtitle">${translate(
                "tSearchCriteria"
              )}:  ${selectedZip}</div>
              <div class="subtitle">${translate(
                "tGenerated"
              )}:  ${new Date().toLocaleDateString()}</div>
              <div class="subtitle">${translate("tBy")}:  ${
        loggedInUser?.registered_organization || "Unknown Organization"
      }</div>
              <div class="subtitle">${translate(
                "tTelephone"
              )}:  ${orgPhone}</div>
            </div>
          </div>
          
          <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
            <strong style="color: #856404; font-size: 14px;">${translate(
              "tPdfWarning"
            )}</strong>
          </div>

          <div class="content">
            ${htmlContent}
          </div>
        </body>
        </html>`;

      const rightsReservedText = translate("tRightsReservedPdf");
      const pageText = translate("tPage");

      const pdfPayload = {
        htmlBody: pdfHtml,
        filename: `CRG - ${selectedZip} - ${getCurrentDate()}.pdf`,
        organization: loggedInUser?.registered_organization,
        footer: {
          source: `<div style="width: 100%; padding: 8px 0.75in; font-size: 8px; color: #666; font-family: Arial, sans-serif; box-sizing: border-box;"><div style="border-top: 1px solid #000; padding-top: 8px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align: left; width: 50%; font-size: 8px;">© 2025 O Peracha. ${rightsReservedText}</td><td style="text-align: right; width: 50%; font-size: 8px;">${pageText} {{page}} of {{total}}</td></tr></table></div></div>`,
          spacing: "10px",
        },
      };

      // Route to Wrangler dev server on localhost:8788 during dev, otherwise use relative path
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

      // Handle PDF download
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
    // Handle PDF creation
    if (isPdfMode) {
      await handleCreatePdf();
      return;
    }

    // Check email limit before sending
    const limitCheck = await checkEmailLimit(
      loggedInUser?.registered_organization,
      translate
    );
    if (!limitCheck.allowed) {
      setStatus(limitCheck.message || limitCheck.error);
      return;
    }

    setSending(true);
    try {
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;">
          <p style="color:red;font-weight:bold;">
            ***   ${translate("tDoNotReply")}   ***<br>
          </p>
          <p><strong>${translate("tZipCode")}: ${selectedZip || ""}</strong></p>
          <p><br>
            ${translate("tGreetings")},<br/><br/>
            ${translate("tEmailIntroduction")}
          </p>
          ${formatHtml()}
          <p>${translate("tHopeThisHelps")}</p>
          <p>${loggedInUser?.registered_organization}</p>
          ${orgPhone ? `<p>${orgPhone}</p>` : ""}
        <div style="margin-top: 30px; text-align: center;">
<hr style="border: none; border-top: 1px solid #ccc; margin-bottom: 10px; width: 60%;" />
<a href="https://crghouston.operacha.org?utm_source=email&utm_medium=email&utm_campaign=resource_list" target="_blank" style="text-decoration: none; color: inherit;">
<img src="${LOGO_URL_Email}" alt="CRG Logo" style="height:25px; vertical-align:middle; margin-right:8px;" />
<span style="font-size: 12px; font-family: 'Verdana'; font-weight: 500; color: #4A4E69; vertical-align: middle;">Community Resources Guide Houston</span>
</a>
        </div>`;

      const payload = {
        recipient,
        subject: translate("tCommunityResources"),
        htmlBody: emailHtml,
        organization: loggedInUser?.registered_organization,
        headers: {
          "X-Entity-Ref-ID": "logo-signature",
          "Content-Type": "text/html; charset=UTF-8",
        },
      };

      // Route to Wrangler dev server on localhost:8788 during dev, otherwise use relative path
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
        setStatus(translate("tEmailFailedToSend"));
      }
    } catch (err) {
      setStatus(`${translate("tErrorSendingEmail")}: ${err.message}`);
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
            {translate("tLimitedInactiveResources")}
          </h3>
          <p className="text-left mb-6 text-gray-700">
            {translate("tLimitedInactiveWarning")}
          </p>
          <div className="flex justify-between gap-4">
            <button
              onClick={handleWarningContinue}
              className="flex-1 px-4 py-2 bg-gray-300 rounded"
            >
              {translate("tContinue")}
            </button>
            <button
              onClick={handleWarningReturn}
              className="flex-1 px-4 py-2 bg-[#4A4E69] text-white rounded"
            >
              {translate("tReturn")}
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
            {isPdfMode
              ? translate("tCreatePdf")
              : translate("tSendSelectedResources")}
          </h3>

          {!isPdfMode && (
            <input
              type="email"
              placeholder={translate("tRecipientEmail")}
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
              {translate("tCancel")}
            </button>
            <button
              onClick={handleSend}
              disabled={sending || (!isPdfMode && !recipient)}
              className="px-4 py-2 bg-[#4A4E69] text-white rounded text-sm md:text-base"
            >
              {sending
                ? isPdfMode
                  ? translate("tCreatingPdf")
                  : translate("tSending")
                : isPdfMode
                ? translate("tCreate")
                : translate("tSend")}
            </button>
          </div>
          {status && <p className="mt-3 text-sm text-red-600">{status}</p>}
        </div>
      </div>
    );
  }

  return null;
}
