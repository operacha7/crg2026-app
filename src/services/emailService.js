// src/services/emailService.js
// Service for sending emails and creating PDFs
// Extracted from EmailDialog.js for reuse

import { render } from "@react-email/components";
import { LOGO_URL_Email } from "../data/constants";
import { supabase } from "../MainApp";
import {
  formatAddress,
  formatHoursFromJson,
  formatDistance,
  parseRequirements,
} from "../utils/formatters";
import { ResourceEmail } from "../emails";

// Default callback phone number if org doesn't have one configured
const DEFAULT_ORG_PHONE = "713-664-5350";

/**
 * Fetch organization phone number from registered_organizations table
 * Returns the default phone number if org_phone is null/empty
 */
export async function fetchOrgPhone(orgName) {
  if (!orgName) return DEFAULT_ORG_PHONE;

  try {
    const { data, error } = await supabase
      .from("registered_organizations")
      .select("org_phone")
      .eq("reg_organization", orgName)
      .single();

    if (error) {
      console.error("Error fetching org_phone:", error);
      return DEFAULT_ORG_PHONE;
    }
    return data?.org_phone || DEFAULT_ORG_PHONE;
  } catch (err) {
    console.error("Error in fetchOrgPhone:", err);
    return DEFAULT_ORG_PHONE;
  }
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
 * Generate header text based on search mode
 * Shows the most specific (lowest level) selection for each mode
 *
 * @param {object} searchContext - Contains searchMode and relevant filter values
 * @returns {string} Header text for email/PDF
 */
export function generateSearchHeader(searchContext) {
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
 * Uses React Email for template rendering
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
  // Use searchContext if provided, otherwise fall back to legacy selectedZip
  const headerText = searchContext
    ? generateSearchHeader(searchContext)
    : (selectedZip ? `Resources for Zip Code: ${selectedZip}` : "Resources");

  // Render React Email template to HTML string
  const emailHtml = await render(
    ResourceEmail({
      resources: selectedData,
      headerText: headerText,
      orgPhone: orgPhone || DEFAULT_ORG_PHONE,
    })
  );

  const payload = {
    recipient,
    subject: "Resources & Support Information",
    htmlBody: emailHtml,
    organization: loggedInUser?.reg_organization,
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
  // Legacy prop - still supported for backwards compatibility
  selectedZip,
}) {

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
  const registeredOrgName = loggedInUser?.reg_organization || "";

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
    organization: loggedInUser?.reg_organization,
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
