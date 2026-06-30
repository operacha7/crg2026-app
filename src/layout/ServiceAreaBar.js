// src/layout/ServiceAreaBar.js
// Horizontal bar that opens below NavBar3 while the Service Area audit toggle
// (NavBar2, Organization mode) is active. Lists every zip in the selected child
// org's service area at a small font — this is the completeness check (if CRG
// shows fewer zips than the org expects, they catch it here) — plus a Download
// button that exports the on-screen results as an audit PDF.
//
// Internal audit tool — not part of the neighbor lookup flow.

import { useState } from "react";
import { toast } from "react-hot-toast";
import { createAuditPdf } from "../services/emailService";

// Double chevron — same shape as ResultRow's expand/collapse affordance.
function DoubleChevronIcon({ expanded }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
    >
      <polyline points="6 7 12 13 18 7" />
      <polyline points="6 13 12 19 18 13" />
    </svg>
  );
}

export default function ServiceAreaBar({ active = false, zips = [], childOrgName = "", records = [], selectedAssistance = [], assistIconMap = {} }) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!active) return null;

  const hasChild = !!childOrgName;
  const hasZips = zips.length > 0;

  const handleDownload = async () => {
    if (downloading) return;
    if (!records.length) {
      toast.error("No resources to download.");
      return;
    }
    setDownloading(true);
    try {
      const result = await createAuditPdf({ records, childOrgName, serviceAreaZips: zips, selectedAssistance, assistIconMap });
      if (!result.success) {
        toast.error(result.message || "Could not create the audit PDF.");
      }
    } catch (err) {
      console.error("Audit PDF download error:", err);
      toast.error("Could not create the audit PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-1 shrink-0 border-b border-black/10"
      style={{
        backgroundColor: "var(--color-service-area-bar-bg)",
        color: "var(--color-service-area-bar-text)",
        minHeight: "var(--height-service-area-bar)",
      }}
    >
      {/* Expand/collapse chevron (only meaningful when there are zips) */}
      {hasZips && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center shrink-0 hover:brightness-125"
          style={{ color: "var(--color-service-area-bar-text)" }}
          aria-label={expanded ? "Collapse service area zips" : "Expand service area zips"}
          title={expanded ? "Collapse" : "Expand"}
        >
          <DoubleChevronIcon expanded={expanded} />
        </button>
      )}

      {/* Zip list (small font). Collapsed = single-line ellipsis; expanded = wraps. */}
      <div
        className="flex-1 min-w-0"
        style={{
          fontSize: "var(--font-size-service-area-zips)",
          lineHeight: 1.5,
          whiteSpace: expanded ? "normal" : "nowrap",
          overflowX: "hidden",
          overflowY: expanded ? "auto" : "hidden",
          textOverflow: expanded ? "clip" : "ellipsis",
          maxHeight: expanded ? "30vh" : undefined,
          paddingTop: expanded ? "6px" : undefined,
          paddingBottom: expanded ? "6px" : undefined,
        }}
      >
        {hasChild ? (
          <>
            <strong>
              Service Area{hasZips ? ` (${zips.length} zip${zips.length === 1 ? "" : "s"})` : ""}:
            </strong>{" "}
            {hasZips ? zips.join(", ") : "No zip codes found for this organization."}
          </>
        ) : (
          <span style={{ fontStyle: "italic" }}>
            Select a child organization to view its service area.
          </span>
        )}
      </div>

      {/* Download (audit PDF) */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading || !records.length}
        className="shrink-0 inline-flex items-center justify-center font-opensans transition-all duration-200 hover:brightness-125"
        style={{
          backgroundColor: "var(--color-service-area-download-bg)",
          color: "var(--color-service-area-download-text)",
          fontSize: "14px",
          fontWeight: 500,
          letterSpacing: "0.07em",
          lineHeight: 1,
          marginTop: "4px",
          padding: "5px 20px",
          borderRadius: "5px",
          whiteSpace: "nowrap",
          opacity: downloading || !records.length ? 0.5 : 1,
          cursor: downloading || !records.length ? "not-allowed" : "pointer",
        }}
      >
        {downloading ? "Preparing…" : "Download"}
      </button>
    </div>
  );
}
