// src/services/emailService.js
// Service for sending emails and creating PDFs
// Extracted from EmailDialog.js for reuse

import { LOGO_URL_Email } from "../data/constants";
import { supabase } from "../MainApp";
import {
  formatAddress,
  formatHoursFromJson,
  formatDistance,
  parseRequirements,
} from "../utils/formatters";

/**
 * Check if organization has PDF credits remaining
 */
export async function checkPdfLimit(orgName) {
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
}

/**
 * Check if organization has email credits remaining
 */
export async function checkEmailLimit(orgName) {
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
}

/**
 * Fetch organization phone number
 */
export async function fetchOrgPhone(orgName) {
  if (!orgName) return "";

  try {
    const { data, error } = await supabase
      .from("registered_organizations")
      .select("org_phone")
      .eq("registered_organization", orgName)
      .single();

    if (error) {
      console.error("Error fetching org_phone:", error);
      return "";
    }
    return data?.org_phone || "";
  } catch (err) {
    console.error("Error in fetchOrgPhone:", err);
    return "";
  }
}

/**
 * Format hours data to HTML for email display
 */
function formatHoursHtml(record) {
  const formattedHours = formatHoursFromJson(record.org_hours);
  if (!formattedHours) return "";

  let html = "";

  if (formattedHours.legacy) {
    return `<div>${formattedHours.legacy}</div>`;
  }

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

/**
 * Sort data by assist_id then distance
 */
function getSortedData(data) {
  return [...data].sort((a, b) => {
    const aAssistId = parseInt(a.assist_id, 10) || 999;
    const bAssistId = parseInt(b.assist_id, 10) || 999;
    if (aAssistId !== bAssistId) {
      return aAssistId - bAssistId;
    }
    const aMiles = a.distance ?? Infinity;
    const bMiles = b.distance ?? Infinity;
    return aMiles - bMiles;
  });
}

/**
 * Format resource data as HTML for email/PDF
 */
export function formatResourcesHtml(selectedData) {
  const sortedData = getSortedData(selectedData);

  // Group by assist_id
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
          const addressLines = formatAddress(e);
          const addressHtml = addressLines.join("<br/>");

          const reqs = parseRequirements(e.requirements);
          const bullets =
            reqs.length > 0
              ? reqs.map((r) => `<li>${r}</li>`).join("\n")
              : "";

          const distanceText = formatDistance(e.distance);
          const hoursHtml = formatHoursHtml(e);
          const hoursNotesHtml = formatHoursNotesHtml(e.hours_notes);

          return `
<div style="font-family: Arial, sans-serif; margin-bottom: 24px; padding-left: 8px;">
  <div style="font-size: 16px; font-weight: bold;">
    ${idx + 1}.&nbsp;&nbsp;<a href="${e.webpage || "#"}" target="_blank" style="color: #0066cc; text-decoration: underline;">${e.organization || "N/A"}</a>
  </div>
  <div style="font-size: 16px; font-weight: bold; margin-top: 4px; padding-left: 24px;">
    ${e.org_telephone || ""}
  </div>
  ${distanceText ? `<div style="font-size: 14px; margin-top: 12px; padding-left: 24px;">${distanceText}</div>` : ""}
  <div style="font-size: 14px; margin-top: 4px; padding-left: 24px;">
    <a href="${e.googlemaps || "#"}" target="_blank" style="color: #0066cc; text-decoration: underline;">
      ${addressHtml}
    </a>
  </div>
  <div style="font-size: 14px; margin-top: 12px; padding-left: 24px;">
    ${hoursHtml}
    ${hoursNotesHtml}
  </div>
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
}

/**
 * Generate header text based on search mode
 * Shows the most specific (lowest level) selection for each mode
 *
 * @param {object} searchContext - Contains searchMode and relevant filter values
 * @returns {string} Header text for email/PDF
 */
function generateSearchHeader(searchContext) {
  const {
    searchMode,
    selectedZip,
    selectedParentOrg,
    selectedChildOrg,
    selectedLocationZip,
    selectedLocationCity,
    selectedLocationCounty,
    llmQuery,
  } = searchContext || {};

  switch (searchMode) {
    case "zipcode":
      return selectedZip ? `Resources for Zip Code: ${selectedZip}` : "Resources";

    case "organization":
      // Show most specific: child > parent
      if (selectedChildOrg) {
        return `Resources for Organization: ${selectedChildOrg}`;
      } else if (selectedParentOrg) {
        return `Resources for Organization: ${selectedParentOrg}`;
      }
      return "Resources for Organization";

    case "location":
      // Show most specific: zip > city > county
      if (selectedLocationZip) {
        return `Resources for Location: ${selectedLocationZip}`;
      } else if (selectedLocationCity) {
        return `Resources for Location: ${selectedLocationCity}`;
      } else if (selectedLocationCounty) {
        return `Resources for Location: ${selectedLocationCounty}`;
      }
      return "Resources for Location";

    case "llm":
      // Show the actual search query if available
      return llmQuery ? `Resources for: ${llmQuery}` : "Search Results";

    default:
      return "Resources";
  }
}

/**
 * Format hours data to HTML for PDF display (right-aligned, compact)
 */
function formatHoursPdfHtml(record) {
  const formattedHours = formatHoursFromJson(record.org_hours);
  if (!formattedHours) return "";

  let html = "";

  if (formattedHours.legacy) {
    return `<div style="text-align: right;">${formattedHours.legacy}</div>`;
  }

  if (formattedHours.rows?.length > 0 || formattedHours.special?.length > 0) {
    const allRows = [...(formattedHours.rows || []), ...(formattedHours.special || [])];
    html += `<table cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; margin-left: auto;">`;
    allRows.forEach((row) => {
      html += `<tr>
        <td style="text-align: right; padding-right: 10px; white-space: nowrap; font-style: italic;">${row.days}</td>
        <td style="text-align: right; white-space: nowrap;">${row.hours}</td>
      </tr>`;
    });
    html += `</table>`;
  }

  if (formattedHours.labeled?.length > 0) {
    formattedHours.labeled.forEach((item) => {
      html += `<div style="text-align: right; margin-top: 4px; font-size: 12px;">
        <strong>${item.label}:</strong> ${item.days} ${item.hours}
      </div>`;
    });
  }

  return html;
}

/**
 * Format resource data as HTML for PDF (3-column layout)
 * - Left column: Org name, distance, address
 * - Right column: Phone, hours, hours notes
 * - Full-width bottom: Requirements
 */
export function formatPdfResourcesHtml(selectedData, includeAssistanceHeaders = true) {
  const sortedData = getSortedData(selectedData);

  // Group by assist_id
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

  // Track running index across all groups
  let runningIndex = 0;

  return Object.values(grouped)
    .map((group) => {
      const sectionRows = group.items
        .map((e) => {
          runningIndex++;
          const addressLines = formatAddress(e);
          const addressHtml = addressLines.join("<br/>");

          const reqs = parseRequirements(e.requirements);
          const bullets =
            reqs.length > 0
              ? reqs.map((r) => `<li style="margin-bottom: 2px;">${r}</li>`).join("\n")
              : "";

          const distanceText = e.distance ? `${e.distance} miles` : "";
          const hoursHtml = formatHoursPdfHtml(e);
          const hoursNotesHtml = e.hours_notes
            ? `<div style="color: #e74c3c; font-style: italic; text-align: right; margin-top: 6px; font-size: 12px;">${e.hours_notes}</div>`
            : "";

          return `
<div style="font-family: Arial, sans-serif; margin-bottom: 20px; page-break-inside: avoid;">
  <!-- Top row: 2 columns -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <!-- Left column: Org name, distance + address -->
      <td style="vertical-align: top; width: 55%; padding-right: 20px;">
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px;">
          ${runningIndex}.&nbsp;&nbsp;<a href="${e.webpage || "#"}" target="_blank" style="color: #0066cc; text-decoration: underline;">${e.organization || "N/A"}</a>
        </div>
        <div style="font-size: 12px; padding-left: 20px;">
          <a href="${e.googlemaps || "#"}" target="_blank" style="color: #0066cc; text-decoration: underline;">${addressHtml}</a>${distanceText ? `<span style="font-style: italic; color: #666; padding-left: 10px;">${distanceText}</span>` : ""}
        </div>
      </td>
      <!-- Right column: Phone, hours, hours notes -->
      <td style="vertical-align: top; width: 45%; text-align: right;">
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px;">
          ${e.org_telephone || ""}
        </div>
        ${hoursHtml}
        ${hoursNotesHtml}
      </td>
    </tr>
  </table>
  <!-- Bottom row: Full-width requirements (no border) -->
  ${bullets ? `
  <div style="padding-left: 20px; margin-top: 8px;">
    <u style="font-size: 12px;">Important Details:</u>
    <ul style="margin: 4px 0 0 0; padding-left: 18px; font-size: 12px;">${bullets}</ul>
  </div>
  ` : ""}
</div>`;
        })
        .join("\n");

      if (includeAssistanceHeaders) {
        return `
<div>
  <h3 style="font-family: Arial, sans-serif; font-size: 14px; margin-top: 20px; margin-bottom: 12px;">Assistance:&nbsp;&nbsp;${group.label}</h3>
  ${sectionRows}
</div>`;
      } else {
        return sectionRows;
      }
    })
    .join("\n");
}

/**
 * Send email with selected resources
 */
export async function sendEmail({
  recipient,
  selectedData,
  searchContext,
  loggedInUser,
  orgPhone,
  // Legacy prop - still supported for backwards compatibility
  selectedZip,
}) {
  const limitCheck = await checkEmailLimit(loggedInUser?.registered_organization);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message || limitCheck.error);
  }

  // Use searchContext if provided, otherwise fall back to legacy selectedZip
  const headerText = searchContext
    ? generateSearchHeader(searchContext)
    : (selectedZip ? `Resources for Zip Code: ${selectedZip}` : "Resources");

  const htmlContent = formatResourcesHtml(selectedData);

  const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin-left: 20px;">
  <p style="font-size: 16px; margin-bottom: 20px;">
    <strong>${headerText}</strong>
  </p>

  <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
    Thank you for reaching out to us. Here is the information that you requested. Please note while we strive to ensure that our information is current and accurate, funding levels and eligibility requirements can change at any time. This is an automated message and is unmonitored, please <span style="color: red; font-style: italic;">do not reply</span>.
  </p>

  <p style="font-size: 14px; margin-bottom: 24px;">
    You can also access the same information at <a href="https://crghouston.operacha.org?utm_source=email&utm_medium=email&utm_campaign=resource_list" target="_blank">crghouston.operacha.org</a>.
  </p>

  ${htmlContent}

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
  if (!result.success) {
    throw new Error("Email failed to send.");
  }

  return { success: true, recipient, count: selectedData.length };
}

/**
 * Create PDF with selected resources
 * Uses 3-column layout: left (org/address), right (phone/hours), bottom (requirements)
 */
export async function createPdf({
  selectedData,
  searchContext,
  loggedInUser,
  orgPhone,
  // Legacy prop - still supported for backwards compatibility
  selectedZip,
}) {
  const limitCheck = await checkPdfLimit(loggedInUser?.registered_organization);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message || limitCheck.error);
  }

  // Use searchContext if provided, otherwise fall back to legacy selectedZip
  const headerText = searchContext
    ? generateSearchHeader(searchContext)
    : (selectedZip ? `Resources for Zip Code: ${selectedZip}` : "Resources");

  // Extract just the selection value for filename (e.g., "Zip Code: 77025" or "Organization: Catholic Charities")
  const selectionText = headerText.replace("Resources for ", "").replace("Resources", "All");

  // Use PDF-specific formatting (3-column layout)
  const htmlContent = formatPdfResourcesHtml(selectedData);

  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const formatDisplayDate = () => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric"
    });
  };

  // Registered org name for "By:" line (blank/dummy for now since not wired)
  const registeredOrgName = loggedInUser?.registered_organization || "";

  const pdfHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page { margin: 0.5in 0.75in 0.75in 0.75in; }
body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 0; }
</style>
</head>
<body>
<div style="text-align: center; margin-bottom: 20px;">
<div style="margin-bottom: 8px;">
<img src="${LOGO_URL_Email}" alt="CRG Logo" style="height: 30px; vertical-align: middle; margin-right: 10px;" />
<span style="font-family: Comfortaa, cursive; font-size: 22px; font-weight: 600; color: #333; vertical-align: middle;">Community Resources Guide Houston</span>
</div>
<div style="font-size: 13px; margin-bottom: 3px;"><strong>${headerText}</strong></div>
<div style="font-size: 12px; margin-bottom: 2px;">Generated: ${formatDisplayDate()}</div>
<div style="font-size: 12px;">By: ${registeredOrgName || "—"}</div>
</div>
<p style="font-size: 12px; line-height: 1.5; margin: 0 0 20px 0;">
We strive to ensure that our information is current and accurate but funding levels and eligibility requirements can change at any time. For the most current information contact the organization directly. You may also access the same information at <a href="https://crghouston.operacha.org" style="color: #0066cc;">crghouston.operacha.org</a>.
</p>
<div>
${htmlContent}
</div>
</body>
</html>`;

  const filename = `CRG - ${selectionText} - ${getCurrentDate()}.pdf`;

  // PDF footer (repeats on every page) - must start with "<" (PDFShift requirement)
  // Note: Header is only on page 1 (in body HTML) - PDFShift repeating headers don't render Base64 images correctly
  const pdfFooter = `<div style="width: 100%; padding: 10px 0.75in 0 0.75in; font-family: Arial, sans-serif; box-sizing: border-box;"><div style="text-align: right; font-size: 11px; font-style: italic; color: #666;">Page {{page}} of {{total}}</div></div>`;

  const pdfPayload = {
    htmlBody: pdfHtml,
    filename,
    organization: loggedInUser?.registered_organization,
    footer: {
      source: pdfFooter,
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
    throw new Error(`Failed to create PDF: ${res.status} - ${errorText}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);

  return { success: true, filename, count: selectedData.length };
}
