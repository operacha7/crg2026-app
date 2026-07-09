// src/services/emailService.js
// Service for sending emails and creating PDFs
// Extracted from EmailDialog.js for reuse

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render } from "@react-email/components";
import { getIconByName } from "../icons/iconMap";
import { LOGO_URL_Email, BUS_ICON_URL } from "../data/constants";
import {
  formatAddress,
  formatHoursFromJson,
  parseRequirements,
  parsePhoneNumbers,
} from "../utils/formatters";
import { buildTransitDirectionsUrl } from "../utils/transitUrl";
import { ResourceEmail } from "../emails";

/**
 * Sort data by assist_id then priority then distance.
 * priority is an editorial rank: lower number = surface higher (1 = featured).
 * Most records have no priority (null/blank) and sort last within their group.
 */
function getSortedData(data) {
  return [...data].sort((a, b) => {
    const aAssistId = parseInt(a.assist_id, 10) || 999;
    const bAssistId = parseInt(b.assist_id, 10) || 999;
    if (aAssistId !== bAssistId) {
      return aAssistId - bAssistId;
    }
    const aPriority = parseInt(a.priority, 10) || Infinity;
    const bPriority = parseInt(b.priority, 10) || Infinity;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
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
  const hasNonActive = selectedData.some((r) => (r.status_id ?? 1) !== 1);

  if (hasNonActive) {
    // Group by status_id then assistance
    const byStatus = selectedData.reduce((acc, item) => {
      const sid = item.status_id ?? 999;
      if (!acc[sid]) {
        acc[sid] = { statusId: sid, statusLabel: item.status || "Unknown", items: [] };
      }
      acc[sid].items.push(item);
      return acc;
    }, {});

    let runningIndex = 0;
    return Object.values(byStatus)
      .sort((a, b) => a.statusId - b.statusId)
      .map((statusGroup) => {
        const inner = renderAssistanceGroupsHtml(
          statusGroup.items,
          includeAssistanceHeaders,
          () => ++runningIndex
        );
        return `
<h2 style="font-family: Arial, sans-serif; font-size: 16px; color: #B8001F; margin-top: 24px; margin-bottom: 10px; border-bottom: 1px solid #B8001F; padding-bottom: 4px;">Status:&nbsp;&nbsp;${statusGroup.statusLabel}</h2>
${inner}`;
      })
      .join("\n");
  }

  let runningIndex = 0;
  return renderAssistanceGroupsHtml(selectedData, includeAssistanceHeaders, () => ++runningIndex);
}

// Bus Route pill is rendered without clientCoordinates so the sender's
// local address is never embedded in outgoing PDFs — Google Maps prompts
// the recipient for their own origin.
function renderAssistanceGroupsHtml(items, includeAssistanceHeaders, nextIndex) {
  const sortedData = getSortedData(items);

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
        .map((e) => {
          const runningIndex = nextIndex();
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
          const transitUrl = buildTransitDirectionsUrl(e);
          const busRouteHtml = `<div style="padding-left: 20px; margin-top: 6px;"><a href="${transitUrl}" target="_blank" style="display: inline-block; border: 2px solid #B8001F; border-radius: 999px; padding: 3px 10px; color: #B8001F; font-size: 12px; font-weight: bold; letter-spacing: 0.02em; text-decoration: none; line-height: 1; white-space: nowrap;"><img src="${BUS_ICON_URL}" alt="" width="16" height="16" style="vertical-align: middle; margin-right: 5px; border: 0;" /><span>Bus Route</span></a></div>`;

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
        ${busRouteHtml}
      </td>
      <!-- Right column: Phone, hours, hours notes -->
      <td style="vertical-align: top; width: 45%; text-align: right;">
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px;">
          ${parsePhoneNumbers(e.org_telephone).join("<br>")}
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
 * Translate HTML content to target language via Google Cloud Translation API
 * Falls back to original content if translation fails
 *
 * @param {string} htmlBody - HTML content to translate
 * @param {string} subject - Email subject line (plain text)
 * @param {string} language - Target language code ("en", "es", etc.)
 * @returns {Promise<{htmlBody: string, subject: string}>}
 */
async function translateHtml(htmlBody, subject, language) {
  if (!language || language === "en") {
    return { htmlBody, subject };
  }

  // Relative URL → same-origin from the browser. In dev, Vite proxies it to
  // Wrangler on :8788; in prod, Cloudflare Pages serves both the app and the
  // function from the same origin. Matters for cookie-based auth: an absolute
  // localhost:8788 URL is cross-origin and the session cookie wouldn't be
  // attached.
  const res = await fetch("/translate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      htmlBody,
      subject,
      targetLanguage: language,
    }),
  });

  const result = await res.json();
  if (!result.success) {
    const error = new Error(result.message || "Translation failed");
    error.code = result.code || "TRANSLATION_ERROR";
    throw error;
  }

  return { htmlBody: result.htmlBody, subject: result.subject };
}

/**
 * Send email with selected resources
 * Uses React Email for template rendering
 * Supports translation to other languages (e.g., Spanish)
 */
export async function sendEmail({
  recipient,
  selectedData,
  searchContext,
  loggedInUser,
  language = "en",
  note = "",
  // Sending org { name, phone } for the footer sign-off. null = no sender line
  // (blocked / guest / unselected). See EMAIL_SENDER_FOOTER_PLAN.md.
  senderFooter = null,
  // Legacy prop - still supported for backwards compatibility
  selectedZip,
}) {
  // Use searchContext if provided, otherwise fall back to legacy selectedZip
  const headerText = searchContext
    ? generateSearchHeader(searchContext)
    : (selectedZip ? `Resources for Zip Code: ${selectedZip}` : "Resources");

  // Render React Email template to HTML string. Note: clientCoordinates is
  // intentionally not passed through — the email template no longer renders
  // a Bus Route pill, so the org's local address can never leak into
  // outgoing content. The address is purely an in-app convenience.
  const emailHtml = await render(
    ResourceEmail({
      resources: selectedData,
      headerText: headerText,
      note: note,
      senderFooter: senderFooter,
    })
  );

  // Translate if language is not English (falls back to English on error)
  let finalHtml = emailHtml;
  let finalSubject = "Resources & Support Information";
  if (language && language !== "en") {
    try {
      const translated = await translateHtml(emailHtml, finalSubject, language);
      finalHtml = translated.htmlBody;
      finalSubject = translated.subject;
    } catch (err) {
      if (err.code === "QUOTA_EXCEEDED") {
        throw err; // Surface quota errors to the user
      }
      console.error("Translation failed, sending in English:", err);
    }
  }

  const payload = {
    recipient,
    subject: finalSubject,
    htmlBody: finalHtml,
    organization: loggedInUser?.reg_organization,
    headers: {
      "X-Entity-Ref-ID": "logo-signature",
      "Content-Type": "text/html; charset=UTF-8",
    },
  };

  // Relative URL → same-origin from the browser. In dev, Vite proxies it to
  // Wrangler on :8788; in prod, Cloudflare Pages serves both. credentials:
  // "include" attaches the auth cookie so /sendEmail's session check passes.
  const res = await fetch("/sendEmail", {
    method: "POST",
    credentials: "include",
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
  language = "en",
  note = "",
  // Sending org { name, phone } for the footer sign-off (same as email). null =
  // no sender line (blocked / guest / unselected).
  senderFooter = null,
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
  const htmlContent = formatPdfResourcesHtml(selectedData, true);

  // Build optional user-note pull-quote. `translate="no"` keeps the sender's
  // exact wording when the rest of the PDF is translated to Spanish.
  const trimmedNote = (note || "").trim();
  const noteHtml = trimmedNote
    ? `<p translate="no" class="notranslate" style="color: #283593; font-style: italic; font-size: 13px; line-height: 1.5; border-left: 4px solid #283593; padding-left: 12px; margin: 0 0 20px 0;"><strong>Note:</strong> ${trimmedNote
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\n", "<br/>")}</p>`
    : "";

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

  // Sender sign-off line (child org name + phone). Omitted entirely when there's
  // no sender footer (blocked / guest / unselected) — no "By: —" placeholder.
  // Name + phone are translate="no" so they stay verbatim under Spanish
  // translation; only the "Prepared by:" label translates. PDF uses "Prepared
  // by" (a printed handout) vs. email/text "Sent by" (transmitted) — each fits
  // its medium; a recipient only ever sees one.
  const senderPhonePart = senderFooter?.phone ? ` &middot; ${senderFooter.phone}` : "";
  const senderEmailPart = senderFooter?.email
    ? ` &middot; <a href="mailto:${senderFooter.email}" style="color: #0066cc; text-decoration: underline;">${senderFooter.email}</a>`
    : "";
  const senderLineHtml = senderFooter?.name
    ? `<div style="font-size: 12px;">Prepared by: <span class="notranslate" translate="no"><strong>${senderFooter.name}</strong>${senderPhonePart}${senderEmailPart}</span></div>`
    : "";

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
${senderLineHtml}
</div>
<p style="font-size: 12px; line-height: 1.6; margin: 0 0 16px 0;">
We strive for accuracy, but funding and eligibility requirements can change without notice. Please contact the organization directly for their latest requirements. For the most up-to-date listings or to explore more resources, visit <a href="https://crghouston.org" style="color: #0066cc; text-decoration: underline;">crghouston.org</a>.
</p>
<p style="font-size: 12px; line-height: 1.6; margin: 0 0 24px 0;">
Click the organization's name to visit their website. Click the address to view it in Google Maps.
</p>
${noteHtml}
<div>
${htmlContent}
</div>
</body>
</html>`;

  const filename = `CRG - ${selectionText} - ${getCurrentDate()}.pdf`;

  // Translate PDF HTML if language is not English (falls back to English on error)
  let finalPdfHtml = pdfHtml;
  if (language && language !== "en") {
    try {
      const translated = await translateHtml(pdfHtml, "", language);
      finalPdfHtml = translated.htmlBody;
    } catch (err) {
      if (err.code === "QUOTA_EXCEEDED") {
        throw err; // Surface quota errors to the user
      }
      console.error("PDF translation failed, creating in English:", err);
    }
  }

  // PDF footer (repeats on every page) - must start with "<" (PDFShift requirement)
  // Note: Header is only on page 1 (in body HTML) - PDFShift repeating headers don't render Base64 images correctly
  const pdfFooter = `<div style="width: 100%; padding: 10px 0.75in 0 0.75in; font-family: Arial, sans-serif; box-sizing: border-box;"><div style="text-align: right; font-size: 11px; font-style: italic; color: #666;">Page {{page}} of {{total}}</div></div>`;

  const pdfPayload = {
    htmlBody: finalPdfHtml,
    filename,
    organization: loggedInUser?.reg_organization,
    footer: {
      source: pdfFooter,
      spacing: "10px",
    },
  };

  // Relative URL → same-origin from the browser. In dev, Vite proxies it to
  // Wrangler on :8788; in prod, Cloudflare Pages serves both. credentials:
  // "include" attaches the auth cookie so /createPdf's session check passes.
  const res = await fetch("/createPdf", {
    method: "POST",
    credentials: "include",
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

/**
 * Compact hours renderer for the Service Area audit table (one cell per row).
 * Reuses the shared formatter; flattens to small text + red hours notes.
 */
function formatHoursAuditHtml(record) {
  const fh = formatHoursFromJson(record.org_hours);
  if (!fh) return "";
  if (fh.legacy) return fh.legacy;
  const parts = [];
  [...(fh.rows || []), ...(fh.special || [])].forEach((r) => parts.push(`${r.days}&nbsp;${r.hours}`));
  (fh.labeled || []).forEach((i) => parts.push(`<strong>${i.label}:</strong>&nbsp;${i.days} ${i.hours}`));
  let html = parts.join("<br/>");
  if (record.hours_notes) {
    html += `<div style="color:#e74c3c;font-style:italic;margin-top:2px;">${record.hours_notes}</div>`;
  }
  return html;
}

/**
 * Build + download the Service Area Audit PDF (internal audit tool).
 *
 * Audit-specific dense table layout (distinct from the client-facing createPdf):
 * a header with the audited child org, date, and the full service-area zip list,
 * then one row per displayed resource with Organization (+address +assistance),
 * Phone, Hours, Status, and Requirements. Status IS shown — validating it is the
 * point of the audit. Captures the records as passed in (already filtered by
 * mode + assistance), sorted in the established order. Posts to the same
 * /createPdf Cloudflare Function used by the email/PDF system.
 *
 * @param {object} args
 * @param {Array}  args.records           - Records to include (the displayed service-area results)
 * @param {string} args.childOrgName      - Audited child org name (header + filename)
 * @param {string[]} args.serviceAreaZips - The child's service-area zips (page-1 body block)
 * @param {string[]} args.selectedAssistance - Names of the assistance types currently filtered (repeating header)
 * @returns {Promise<{success:boolean, filename?:string, count?:number, message?:string}>}
 */
export async function createAuditPdf({ records = [], childOrgName = "", serviceAreaZips = [], selectedAssistance = [], assistIconMap = {} }) {
  if (!records.length) {
    return { success: false, message: "No resources to download." };
  }

  // Match the on-screen Organization-mode sort exactly (defaultSortByOrg in
  // ResultsList): org_parent → organization → assist_id → status_id.
  const sorted = [...records].sort((a, b) => {
    const parentCmp = (a.org_parent || a.organization || "").localeCompare(b.org_parent || b.organization || "");
    if (parentCmp !== 0) return parentCmp;
    const orgCmp = (a.organization || "").localeCompare(b.organization || "");
    if (orgCmp !== 0) return orgCmp;
    const aAssistId = parseInt(a.assist_id, 10) || 999;
    const bAssistId = parseInt(b.assist_id, 10) || 999;
    if (aAssistId !== bAssistId) return aAssistId - bAssistId;
    return (a.status_id || 999) - (b.status_id || 999);
  });
  const dateStr = new Date().toISOString().slice(0, 10);

  // Render each assistance icon to a static SVG string once (cached by icon
  // name), colored olive to match the on-screen Assistance column.
  const iconCache = {};
  const renderAssistIcon = (assistId) => {
    const iconName = assistIconMap[assistId];
    if (!iconName) return "";
    if (iconCache[iconName] !== undefined) return iconCache[iconName];
    let Comp = getIconByName(iconName);
    if (Array.isArray(Comp)) Comp = Comp[0];
    let svg = "";
    if (Comp) {
      try {
        svg = renderToStaticMarkup(createElement(Comp, { size: 12 }));
      } catch {
        svg = "";
      }
    }
    iconCache[iconName] = svg;
    return svg;
  };

  const cell = "padding:4px 6px;font-size:10px;border:1px solid #ccc;vertical-align:top;word-wrap:break-word;";
  // print-color-adjust:exact forces PDFShift/Chromium to render the maroon
  // background in the repeating header region (backgrounds there are otherwise
  // dropped, unlike in the body).
  const th = "background:#660000;color:#fff;padding:5px 6px;font-size:10px;border:1px solid #660000;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact;";

  // Shared fixed column widths — used by BOTH the repeating header's column row
  // and the body table so the columns line up across the page boundary.
  const colgroup = `<colgroup>`
    + `<col style="width:3%"><col style="width:23%"><col style="width:10%">`
    + `<col style="width:16%"><col style="width:8%"><col style="width:40%">`
    + `</colgroup>`;

  const bodyRows = sorted.map((e, i) => {
    const addressHtml = formatAddress(e).join("<br/>");
    const reqs = parseRequirements(e.requirements);
    const reqHtml = reqs.length
      ? `<ul style="margin:0;padding-left:14px;">${reqs.map((r) => `<li>${r}</li>`).join("")}</ul>`
      : "";
    const phones = parsePhoneNumbers(e.org_telephone).join("<br/>");
    const iconSvg = renderAssistIcon(e.assist_id);
    const assistLine = e.assistance
      ? `<br/><span style="display:inline-block;color:#808000;vertical-align:middle;">${iconSvg}</span>`
        + `<span style="color:#888;font-style:italic;vertical-align:middle;margin-left:4px;">${e.assistance}</span>`
      : "";
    const orgCell = `<strong>${e.organization || "N/A"}</strong>`
      + (addressHtml ? `<br/><span style="color:#555;">${addressHtml}</span>` : "")
      + assistLine;
    return `<tr>
      <td style="${cell}text-align:right;">${i + 1}</td>
      <td style="${cell}">${orgCell}</td>
      <td style="${cell}">${phones}</td>
      <td style="${cell}">${formatHoursAuditHtml(e)}</td>
      <td style="${cell}">${e.status || ""}</td>
      <td style="${cell}">${reqHtml}</td>
    </tr>`;
  }).join("");

  const zipList = serviceAreaZips.length ? serviceAreaZips.join(", ") : "—";
  const assistanceList = selectedAssistance.length ? selectedAssistance.join(", ") : "All assistance types";

  // Repeating page masthead — title, generated/count, assistance types, service
  // area, and the table column-header row, all in the PDFShift header so the
  // FULL block repeats on every page (the table's own <thead> does not repeat
  // reliably under PDFShift). Same colgroup + table-layout:fixed as the body so
  // the column labels stay aligned with the data columns below.
  const pdfHeader = `<div style="font-family:Arial,sans-serif;padding:0 0.3in;width:100%;box-sizing:border-box;">
    <div style="font-weight:bold;color:#222831;font-size:14px;">CRG Service Area Audit${childOrgName ? ` — ${childOrgName}` : ""}</div>
    <div style="color:#555;font-size:11px;">Generated ${dateStr}&nbsp;&nbsp;|&nbsp;&nbsp;${sorted.length} resource${sorted.length === 1 ? "" : "s"}</div>
    <div style="color:#2E5A88;font-size:11px;"><strong>Assistance Types:</strong> ${assistanceList}</div>
    <div style="color:#2E5A88;font-size:11px;margin-bottom:12px;"><strong>Service Area (${serviceAreaZips.length} zip${serviceAreaZips.length === 1 ? "" : "s"}):</strong> ${zipList}</div>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;">${colgroup}
      <tr><th style="${th}">#</th><th style="${th}">Organization</th><th style="${th}">Telephone</th><th style="${th}">Hours</th><th style="${th}">Status</th><th style="${th}">Requirements</th></tr>
    </table>
  </div>`;

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    /* Keep each resource row whole — push it to the next page rather than
       splitting it across the page break. (A row taller than a full page
       still has to split; nothing can prevent that.) */
    tr { break-inside: avoid; page-break-inside: avoid; }
  </style></head><body>
    <table>${colgroup}<tbody>${bodyRows}</tbody></table>
  </body></html>`;

  const filename = `CRG - Service Area Audit - ${childOrgName || "Org"} - ${dateStr}.pdf`;
  const pdfFooter = `<div style="width:100%;padding:10px 0.5in 0 0.5in;font-family:Arial,sans-serif;"><div style="text-align:right;font-size:10px;font-style:italic;color:#666;">Page {{page}} of {{total}}</div></div>`;

  const res = await fetch("/createPdf", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      htmlBody,
      filename,
      landscape: true,
      header: { source: pdfHeader, spacing: "0px" },
      footer: { source: pdfFooter, spacing: "10px" },
      margin: { top: "1.12in", bottom: "0.3in", left: "0.3in", right: "0.3in" },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create audit PDF: ${res.status} - ${errorText}`);
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

  return { success: true, filename, count: sorted.length };
}

/**
 * Build a shareable deep link URL that opens CRG in guest mode with filters pre-applied
 * Used for SMS texting — the recipient clicks the link and sees filtered results immediately
 *
 * @param {object} searchContext - Contains searchMode and relevant filter values
 * @param {Set} activeAssistanceChips - Set of active assist_id strings
 * @returns {string} Full URL with query parameters
 */
export function buildShareUrl(searchContext, activeAssistanceChips) {
  // ALWAYS the production domain — this URL is texted to external recipients,
  // who must open it on the live site. A "http://localhost:3000" link (from dev
  // testing) is both useless to them AND a strong SMS-spam signal: carriers bounce
  // link-bearing texts, and a localhost link is rejected almost every time with a
  // misleading "Invalid Number… valid 10 digit mobile number or short code" error.
  const baseUrl = "https://crghouston.org";

  const params = new URLSearchParams();
  params.set("guest", "1");

  const { searchMode, selectedZip, selectedParentOrg, selectedChildOrg,
          selectedLocationZip, selectedLocationCity, selectedLocationCounty,
          selectedLocationNeighborhood, llmQuery } = searchContext || {};

  if (searchMode) params.set("mode", searchMode);

  switch (searchMode) {
    case "zipcode":
      if (selectedZip) params.set("zip", selectedZip);
      break;
    case "organization":
      if (selectedParentOrg) params.set("parent", selectedParentOrg);
      if (selectedChildOrg) params.set("child", selectedChildOrg);
      break;
    case "location":
      if (selectedLocationCounty) params.set("county", selectedLocationCounty);
      if (selectedLocationCity) params.set("city", selectedLocationCity);
      if (selectedLocationZip) params.set("loczip", selectedLocationZip);
      if (selectedLocationNeighborhood) params.set("neighborhood", selectedLocationNeighborhood);
      break;
    case "llm":
      if (llmQuery) params.set("q", llmQuery);
      break;
    default:
      break;
  }

  // Add active assistance chips
  if (activeAssistanceChips && activeAssistanceChips.size > 0) {
    params.set("assist", [...activeAssistanceChips].join(","));
  }

  return `${baseUrl}/find?${params.toString()}`;
}

/**
 * Build the SMS message body that will be sent to a client.
 * The sender copies or forwards this into their SMS tool of choice
 * (native Messages, Google Voice, etc.) — CRG does not transmit it.
 */
export function buildSmsBody({ searchContext, activeAssistanceChips, senderFooter }) {
  const shareUrl = buildShareUrl(searchContext, activeAssistanceChips);
  const headerText = generateSearchHeader(searchContext);

  // Sending child org sign-off, mirroring the email/PDF "Sent by:" footer.
  // Omitted entirely when there's no sender footer (blocked / guest / unselected)
  // — no name is ever shown as a fallback. See EMAIL_SENDER_FOOTER_PLAN.md.
  //
  // IMPORTANT: keep this a SINGLE LINE — no newlines. Newlines in an sms: URI
  // body break QR/sms: parsing (recipients saw "not a valid 10-digit number")
  // and can make Google Voice send the message early (Enter = send). The sign-off
  // leads so the share URL stays last (best for tap-to-open + link preview).
  let senderPrefix = "";
  if (senderFooter?.name) {
    // Plain ASCII only (comma, not "·") — SMS bodies and the GV extension's
    // auto-fill are fragile with special characters. The email is left as a
    // bare address (no mailto:) — phones auto-link it, and mailto: would leak
    // into the GV auto-fill.
    const phonePart = senderFooter.phone ? `, ${senderFooter.phone}` : "";
    const emailPart = senderFooter.email ? `, ${senderFooter.email}` : "";
    senderPrefix = `Sent by: ${senderFooter.name}${phonePart}${emailPart}. `;
  }

  // If SMS length ever becomes a problem, drop the header line ("Resources for
  // Zip Code: …") — the sign-off and link are the essential payload.
  return `${senderPrefix}${headerText}: ${shareUrl}`;
}
