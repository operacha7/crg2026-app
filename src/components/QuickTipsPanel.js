// src/components/QuickTipsPanel.js
// Quick Tips sidebar panel with accordion sections
// Slides out from the vertical nav bar with visual how-to guides
// Can be triggered by icon click or auto-opened to specific section

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAppData } from "../Contexts/AppDataContext";
import PanelScrim from "./PanelScrim";
import {
  HomeIcon,
  HelpBubbleIcon,
  ReportsIcon,
  AnnouncementsIcon,
  PrivacyPolicyIcon,
  ContactSupportIcon,
  Car1Icon,
  HomeMarkerIcon,
  TransitIcon,
  ChevronDownIcon,
  QuickTipsIcon,
  MedicalPrimaryCareIcon,
  EducationChildrenIcon,
  ServiceAreaIcon,
} from "../icons";

// Topic definitions with their visual content
const QUICK_TIPS_TOPICS = [
  {
    id: "assistance",
    title: "Assistance Types",
    content: AssistanceTypesTip,
  },
  {
    id: "bus-route",
    title: "Bus Route",
    content: BusRouteTip,
  },
  {
    id: "counters",
    title: "Counters",
    content: CountersTip,
  },
  {
    id: "address",
    title: "Address",
    titleIcon: HomeMarkerIcon,
    content: AddressTip,
  },
  {
    id: "email-pdf",
    title: "Email / PDF / Text",
    content: EmailPdfTip,
  },
  {
    id: "location",
    title: "Location Search",
    content: LocationSearchTip,
  },
  {
    id: "llm",
    title: "Ask a Question",
    content: LlmSearchTip,
  },
  {
    id: "organization",
    title: "Organization Search",
    content: OrganizationSearchTip,
  },
  {
    id: "results",
    title: "Results",
    content: ResultsTip,
  },
  {
    id: "vertical-nav",
    title: "Sidebar Icons",
    content: VerticalNavTip,
  },
  {
    id: "training",
    title: "Training",
    content: TrainingTip,
  },
  {
    id: "zipcode",
    title: "Zip Code Search",
    content: ZipCodeSearchTip,
  },
  {
    id: "troubleshoot",
    title: "Something Not Working?",
    content: TroubleshootingTip,
    variant: "troubleshoot", // red header + gap above; set apart from the topic list
  },
];

// ============================================
// TIP CONTENT COMPONENTS
// ============================================

// Chip toggle content - extracted for reuse in normal and highlighted states
function ChipToggleContent() {
  return (
    <>
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)", fontWeight: "600", marginBottom: "8px" }}>
        Step 3: Toggle Chips to Filter
      </p>
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)", marginBottom: "12px" }}>
        Your selections appear as chips in the tan bar. Click chips to toggle filtering on/off.
      </p>

      {/* Active chip example */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className="px-3 py-1.5 rounded-full"
          style={{
            backgroundColor: "var(--color-navbar3-chip-active-bg)",
            color: "var(--color-navbar3-chip-active-text)",
            border: "1px solid var(--color-navbar3-chip-active-border)",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          Food
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          ← Active (filtering results)
        </span>
      </div>

      {/* Inactive chip example */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className="px-3 py-1.5 rounded-full"
          style={{
            backgroundColor: "var(--color-navbar3-chip-inactive-bg)",
            color: "var(--color-navbar3-chip-inactive-text)",
            border: "1px solid var(--color-navbar3-chip-inactive-border)",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          Rent
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          ← Inactive (not filtering)
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)", fontStyle: "italic" }}>
        Click any chip to toggle it on or off.
      </p>
    </>
  );
}

// Mini panel visual - simplified representation of the assistance panel
function MiniAssistancePanel() {
  const groupColors = [
    "var(--color-assistance-group1)", // yellow
    "var(--color-assistance-group2)", // purple
    "var(--color-assistance-group3)", // pink
    "var(--color-assistance-group4)", // green
    "var(--color-assistance-group5)", // cyan
    "var(--color-assistance-group6)", // orange
  ];

  return (
    <div
      className="rounded overflow-hidden"
      style={{
        border: "2px solid var(--color-panel-border)",
        maxWidth: "280px",
      }}
    >
      {/* Mini header */}
      <div
        className="flex items-center justify-center py-2"
        style={{ backgroundColor: "var(--color-panel-header-bg)" }}
      >
        <span style={{ color: "var(--color-panel-title)", fontSize: "10px", fontWeight: "600" }}>
          Assistance Types
        </span>
      </div>
      {/* Mini body with colored blocks representing groups */}
      <div
        className="p-2 flex gap-1 flex-wrap justify-center"
        style={{ backgroundColor: "var(--color-panel-body-bg)" }}
      >
        {groupColors.map((color, i) => (
          <div
            key={i}
            className="flex flex-col gap-0.5"
          >
            <div
              style={{
                backgroundColor: color,
                width: "36px",
                height: "12px",
                borderRadius: "3px",
                fontSize: "7px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "600",
              }}
            >
              Group {i + 1}
            </div>
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                style={{
                  backgroundColor: color,
                  width: "36px",
                  height: "8px",
                  borderRadius: "2px",
                  opacity: j === 2 && i === 0 ? 1 : 0.7,
                  border: j === 2 && i === 0 ? "1px solid #000" : "none",
                  // Simulate one selected chip (white bg)
                  backgroundColor: j === 2 && i === 0 ? "var(--color-assistance-selected-bg)" : color,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Mini footer */}
      <div
        className="flex justify-center gap-2 py-1"
        style={{ backgroundColor: "var(--color-panel-body-bg)" }}
      >
        <div
          style={{
            backgroundColor: "var(--color-panel-btn-cancel-bg)",
            width: "28px",
            height: "10px",
            borderRadius: "2px",
            fontSize: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Clear
        </div>
        <div
          style={{
            backgroundColor: "var(--color-panel-btn-ok-bg)",
            width: "28px",
            height: "10px",
            borderRadius: "2px",
            fontSize: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          OK
        </div>
      </div>
    </div>
  );
}

function AssistanceTypesTip({ highlightChipToggle }) {
  return (
    <div className="space-y-4">
      {/* SECTION 1: Opening the panel */}
      <div>
        <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)", fontWeight: "600", marginBottom: "8px" }}>
          Step 1: Open the Panel
        </p>
        <div className="flex items-center gap-3 mb-2">
          <span
            className="px-3 py-1.5 rounded"
            style={{
              backgroundColor: "transparent",
              color: "var(--color-navbar2-btn-inactive-text)",
              border: "none",
              fontSize: "13px",
              fontWeight: "500",
              backgroundColor: "var(--color-navbar3-bg)",
            }}
          >
            Choose Assistance
          </span>
          <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
            ← Click or hover to open panel
          </span>
        </div>

        {/* Mini panel visual */}
        <div className="flex items-start gap-3 mt-3">
          <MiniAssistancePanel />
          <div style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
            <p className="mb-2">The assistance panel lets you filter by type.</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: Making selections */}
      <div style={{ borderTop: "1px solid var(--color-quicktips-section-border)", paddingTop: "12px" }}>
        <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)", fontWeight: "600", marginBottom: "8px" }}>
          Step 2: Make Selections
        </p>
        <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
          Select <strong>up to 3 individual types</strong> from any groups, OR select <strong>one entire group</strong>.
        </p>
        <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)", marginTop: "8px" }}>
          Click <strong>OK</strong> to save, or move away from the panel if you opened it by hovering.
        </p>
      </div>

      {/* SECTION 3: Using chips in the tan bar - HIGHLIGHTED and SLIDES OUT when auto-opened */}
      <div style={{ borderTop: "1px solid var(--color-quicktips-section-border)", paddingTop: "12px", marginTop: "12px" }}>
        {/* When not highlighted, show inline */}
        {!highlightChipToggle && (
          <ChipToggleContent />
        )}

        {/* When highlighted, show as slide-out panel */}
        <AnimatePresence>
          {highlightChipToggle && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300, delay: 0.3 }}
              style={{
                backgroundColor: "var(--color-quicktips-highlight-bg)",
                marginLeft: "-16px",
                marginRight: "-16px",
                paddingLeft: "16px",
                paddingRight: "16px",
                paddingTop: "12px",
                paddingBottom: "12px",
                borderLeft: "4px solid var(--color-quicktips-highlight-border)",
              }}
            >
              <ChipToggleContent />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CountersTip() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        The counters in the top bar show how many records match your search and how many you've selected.
      </p>

      {/* Orange counter - filtered results (orange bg, blue text) */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: "30px",
            height: "30px",
            minWidth: "30px",
            backgroundColor: "var(--color-navbar1-counter-filtered)",
            color: "var(--color-navbar1-counter-text-filtered)",
            fontSize: "13px",
            fontWeight: "600",
          }}
        >
          42
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          <strong>Filtered</strong> — Number of records matching your search criteria
        </span>
      </div>

      {/* Blue counter - selected results (blue bg, orange text) */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: "30px",
            height: "30px",
            minWidth: "30px",
            backgroundColor: "var(--color-navbar1-counter-selected)",
            color: "var(--color-navbar1-counter-text-selected)",
            fontSize: "13px",
            fontWeight: "600",
          }}
        >
          5
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          <strong>Selected</strong> — Number of records selected for email or PDF
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Use the checkboxes in the results to select records for sending.
      </p>
    </div>
  );
}

function AddressTip() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        By default, distances are measured from the center of the selected zip code.
      </p>

      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center rounded-full"
          style={{
            gap: "6px",
            padding: "4px 8px",
            border: "2px solid var(--color-results-transit-icon)",
            color: "var(--color-results-transit-icon)",
            backgroundColor: "transparent",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.02em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          <HomeMarkerIcon size={18} />
          <span>Address</span>
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Click to enter a specific address to use as the origin
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Distances recalculate from that address and results are sorted by distance.
        The address is used only inside the app — it is never embedded in emails,
        PDFs, or text messages sent to clients. CRG also clears the address
        automatically after each successful send so the next lookup starts fresh.
      </p>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        The chip becomes available once you've made a selection in the search filter <em>and</em> picked one assistance type. (In <strong>Ask a Question</strong> mode,
        submitting a question is enough — no assistance type required.)
      </p>
    </div>
  );
}

function BusRouteTip() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Each result row has a <strong>Bus Route</strong> link below the address that opens
        Google Maps with public-transit directions to the organization.
      </p>

      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center rounded-full"
          style={{
            gap: "6px",
            padding: "4px 8px",
            border: "2px solid var(--color-results-transit-icon)",
            color: "var(--color-results-transit-icon)",
            backgroundColor: "transparent",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.02em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          <TransitIcon size={18} />
          <span>Bus Route</span>
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Opens transit directions in Google Maps
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Google Maps prompts the rider for an origin (or uses location services
        on their phone). The Bus Route link only appears inside the app — it is
        intentionally not included in emails or PDFs. Recipients of those open
        Google Maps by tapping the address link instead.
      </p>
    </div>
  );
}

function EmailPdfTip() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Share resources with clients three ways.
      </p>

      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center rounded text-sm font-medium flex-shrink-0"
          style={{
            backgroundColor: "var(--color-navbar1-btn-email-bg)",
            color: "var(--color-navbar1-btn-email-text)",
            width: "110px",
            height: "32px",
            whiteSpace: "nowrap",
          }}
        >
          Send Email
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Email selected resources
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center rounded text-sm font-medium flex-shrink-0"
          style={{
            backgroundColor: "var(--color-navbar1-btn-pdf-bg)",
            color: "var(--color-navbar1-btn-pdf-text)",
            width: "110px",
            height: "32px",
            whiteSpace: "nowrap",
          }}
        >
          Create PDF
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          PDF of selected resources
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center rounded text-sm font-medium flex-shrink-0"
          style={{
            backgroundColor: "var(--color-navbar1-btn-sms-bg)",
            color: "var(--color-navbar1-btn-sms-text)",
            width: "110px",
            height: "32px",
            whiteSpace: "nowrap",
          }}
        >
          Send Text
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Text a link to the filtered list
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        For <strong>Email</strong> and <strong>PDF</strong>, first select resources using the checkboxes.
      </p>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        <strong>Send Text</strong> works differently — it shares a link to the filtered list
        (by zip code and assistance), not individual selected rows. The panel walks you through
        the send options.
      </p>
    </div>
  );
}

function LocationSearchTip() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Find resources by their physical location (where they are located).
      </p>

      <div className="flex items-center gap-3">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: "var(--color-navbar2-btn-active-bg)", color: "var(--color-navbar2-btn-active-text)" }}
        >
          Location
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Click to switch to Location mode
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Filter by County → City → Zip Code. Each selection narrows the next dropdown.
      </p>
    </div>
  );
}

function LlmSearchTip() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Search using natural language - just describe what you're looking for.
      </p>

      <div className="flex items-center gap-3">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: "var(--color-navbar2-btn-active-bg)", color: "var(--color-navbar2-btn-active-text)" }}
        >
          Ask a Question
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Click to switch to Ask a Question mode
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)", fontStyle: "italic" }}>
        Example: "food pantry within 5 miles open Thursday morning"
      </p>
    </div>
  );
}

function OrganizationSearchTip() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="inline-block shrink-0"
          style={{
            color: "var(--color-accent-gold)",
            fontWeight: 600,
            fontSize: "var(--font-size-quicktips-body)",
            borderBottom: "2px solid var(--color-accent-gold)",
            paddingBottom: "2px",
          }}
        >
          Organization
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)", fontWeight: 700 }}>
          Search by Organization
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Switch to Organization mode. Select an organization directly, or choose a
        parent organization to filter its branches.
      </p>

      {/* Service Area audit toggle — active version of the real NavBar2 chip */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center shrink-0"
          style={{
            gap: "6px",
            padding: "3px 10px",
            borderRadius: "var(--radius-assistance-chip)",
            border: "var(--border-width-btn) solid var(--color-service-area-chip-border)",
            backgroundColor: "var(--color-service-area-chip-active-bg)",
            color: "var(--color-service-area-chip-active-text)",
            fontSize: "var(--font-size-quicktips-body)",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          <ServiceAreaIcon size={16} />
          Service Area
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)", fontWeight: 700 }}>
          Explore Service Area
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        With a child organization selected, click <strong>Service Area</strong> to
        view all resources matching its zip codes. From the zip code bar that
        appears, you can verify coverage or click <strong>Download</strong> to save
        a printable PDF. Toggle <strong>Service Area</strong> again to exit.
      </p>
    </div>
  );
}

function ResultsTip() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Results show matching resources. Columns from left to right:
      </p>

      {/* Select/Checkbox */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded border-2"
          style={{ borderColor: "var(--color-results-checkbox-checked)", backgroundColor: "var(--color-results-checkbox-checked)" }}
        >
          <span className="text-white text-xs">✓</span>
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          <strong>Select</strong> — Check to include in email or PDF
        </span>
      </div>

      {/* Miles */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center rounded px-2 py-1"
          style={{ backgroundColor: "#F3F4F6", fontSize: "14px", fontWeight: "600" }}
        >
          2.4
          <span style={{ fontSize: "10px", marginLeft: "2px", color: "#666" }}>mi</span>
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          <strong>Miles</strong> — Distance from zip center or address
          <span
            className="inline-flex items-center justify-center ml-1 rounded"
            style={{ backgroundColor: "var(--color-navbar2-bg)", padding: "2px 4px" }}
          >
            <Car1Icon size={14} />
          </span>
        </span>
      </div>

      {/* Assistance */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1 px-2 py-1 rounded"
          style={{ backgroundColor: "#F3F4F6", color: "var(--color-results-assistance-icon)" }}
        >
          <MedicalPrimaryCareIcon size={18} />
          <EducationChildrenIcon size={18} />
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          <strong>Assistance</strong> — Types of help this org provides
        </span>
      </div>

      {/* Status pills with explanations */}
      <div className="space-y-2">
        <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)", fontWeight: "600" }}>
          Status:
        </p>
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "var(--color-results-status-active-bg)" }}>Active</span>
          <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
            Assistance is available
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "var(--color-results-status-limited-bg)" }}>Limited</span>
          <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
            Limited to certain people (see requirements)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: "var(--color-results-status-inactive-bg)" }}>Inactive</span>
          <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
            Currently not available
          </span>
        </div>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Click "More Info" to expand long requirement lists.
      </p>
    </div>
  );
}

function VerticalNavTip() {
  const iconItems = [
    { Icon: HomeIcon, label: "Home - Reset to start" },
    { Icon: QuickTipsIcon, label: "Quick Tips - This guide" },
    { Icon: HelpBubbleIcon, label: "Help - Chat assistant" },
    { Icon: ReportsIcon, label: "Reports - Usage statistics" },
    { Icon: AnnouncementsIcon, label: "Announcements - News & updates" },
    { Icon: PrivacyPolicyIcon, label: "Legal - Privacy policy" },
    { Icon: ContactSupportIcon, label: "Contact Support" },
  ];

  return (
    <div className="space-y-3">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        The sidebar on the right provides quick access to app features.
      </p>

      {iconItems.map(({ Icon, label }, index) => (
        <div key={index} className="flex items-center gap-3">
          <Icon size={24} active={index === 0} />
          <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ZipCodeSearchTip() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        The default search mode - find resources that serve a specific zip code.
      </p>

      <div className="flex items-center gap-3">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: "var(--color-navbar2-dropdown-bg)", color: "var(--color-navbar2-dropdown-text)" }}
        >
          77002 ▾
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Select a zip code from the dropdown
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Results show organizations that provide services to clients in that zip code.
      </p>
    </div>
  );
}

// Training tip — orientation, not a how-to (the /training page covers mechanics).
// Surfaces the three things a user in /find can't see: that live training exists
// (and where to find it), the Join-button color states that change over time, and
// the fact that a session drops off the page ~15 min after it starts.
function TrainingTip() {
  const bodyText = {
    fontSize: "var(--font-size-quicktips-body)",
    color: "var(--color-quicktips-section-body-text)",
  };

  // The four Join-button states, in the order a user encounters them as start
  // time approaches. Colors/labels mirror SessionCard's JoinButton exactly.
  const joinStates = [
    {
      bg: "var(--color-training-join-future-bg)",
      color: "var(--color-training-join-future-text)",
      label: "Starts 2h 14m",
      when: "More than 20 minutes out — a countdown, not clickable yet.",
    },
    {
      bg: "var(--color-training-join-soon-bg)",
      color: "var(--color-training-join-soon-text)",
      label: "Starts 18m",
      when: "About 20 minutes before — almost time; still counting down.",
    },
    {
      bg: "var(--color-training-join-live-bg)",
      color: "var(--color-training-join-live-text)",
      label: "Join Now - Live",
      when: "From 5 minutes before the start — click it to join.",
    },
    {
      bg: "var(--color-training-join-late-bg)",
      color: "var(--color-training-join-late-text)",
      label: "Join Now",
      when: "Up to 15 minutes after the start — last chance to join.",
    },
  ];

  return (
    <div className="space-y-3">
      <p style={bodyText}>
        We run <strong>live virtual training</strong> sessions on Google Meet —
        free, no registration, no setup, open to everyone (clients included).
      </p>
      <p style={bodyText}>
        Find them on the <strong>Training</strong> link in the footer. Pick a
        session and add it to your calendar (Google or Apple/Outlook) so you get
        a reminder with the join link.
      </p>

      <p style={{ ...bodyText, fontWeight: 600, marginTop: 12 }}>
        The green <strong>Join</strong> button changes color as start time nears:
      </p>
      <div className="space-y-2">
        {joinStates.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span
              className="flex-shrink-0 rounded-full text-center"
              style={{
                backgroundColor: s.bg,
                color: s.color,
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 12px",
                minWidth: 108,
              }}
            >
              {s.label}
            </span>
            <span style={{ ...bodyText, fontSize: 13 }}>{s.when}</span>
          </div>
        ))}
      </div>

      <p style={{ ...bodyText, fontStyle: "italic", marginTop: 10 }}>
        A session drops off the page about 15 minutes after it starts, so join on
        time — or grab the next one.
      </p>
    </div>
  );
}

// Troubleshooting steps — the visually set-apart "Something Not Working?" item.
// Plain-language, ordered so most people are fixed by step 1. onContactSupport
// closes the panel and routes to the Contact Support form.
function TroubleshootingTip({ onContactSupport }) {
  const bodyText = {
    fontSize: "var(--font-size-quicktips-body)",
    color: "var(--color-quicktips-section-body-text)",
  };
  const stepNum = {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: "50%",
    backgroundColor: "var(--color-quicktips-troubleshoot-header-bg)", // blue, matches the troubleshoot header
    color: "#FFFFFF",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
  };

  return (
    <div className="space-y-4">
      <p style={bodyText}>
        If a page looks wrong or won&rsquo;t load, try these in order — most problems
        are fixed by the first step.
      </p>

      {/* Step 1 — hard refresh */}
      <div className="flex gap-3">
        <span style={stepNum}>1</span>
        <div style={bodyText}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Refresh the page (hard refresh)</p>
          <p><strong>Windows:</strong> hold <strong>Ctrl</strong> and press <strong>F5</strong></p>
          <p><strong>Mac:</strong> hold <strong>&#8984; Cmd + Shift + R</strong></p>
          <p style={{ fontStyle: "italic", marginTop: 4 }}>
            Or, on any computer, hold <strong>Shift</strong> and click the reload (&#8635;) button.
          </p>
        </div>
      </div>

      {/* Step 2 — update browser */}
      <div className="flex gap-3">
        <span style={stepNum}>2</span>
        <div style={bodyText}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Make sure your browser is up to date</p>
          <p>An out-of-date browser can stop parts of the app from working — older versions of Safari especially.</p>
        </div>
      </div>

      {/* Step 3 — try a different browser */}
      <div className="flex gap-3">
        <span style={stepNum}>3</span>
        <div style={bodyText}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Try a different browser</p>
          <p>We recommend <strong>Google Chrome</strong>.</p>
        </div>
      </div>

      {/* Step 4 — routes to /support which offers both email and text */}
      <div className="flex gap-3">
        <span style={stepNum}>4</span>
        <div style={bodyText} className="flex-1">
          <p style={{ fontWeight: 600, marginBottom: 10 }}>Still stuck?</p>
          <div className="flex justify-center">
            <button
              onClick={onContactSupport}
              className="hover:brightness-110"
              style={{
                backgroundColor: "var(--color-quicktips-troubleshoot-header-bg)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                fontSize: "var(--font-size-quicktips-body)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Email or Text Me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ACCORDION SECTION COMPONENT
// ============================================

function AccordionSection({ topic, isExpanded, onToggle, highlightChipToggle, onContactSupport }) {
  const ContentComponent = topic.content;
  const TitleIcon = topic.titleIcon;
  const contentRef = useRef(null);

  // Pass the prop each special content component expects.
  let contentProps = {};
  if (topic.id === "assistance") contentProps = { highlightChipToggle };
  else if (topic.variant === "troubleshoot") contentProps = { onContactSupport };

  // The troubleshooting item gets a red header to set it apart from the
  // charcoal topic headers above it.
  const isTroubleshoot = topic.variant === "troubleshoot";

  return (
    <div style={{ borderBottom: "1px solid var(--color-quicktips-section-border)" }}>
      {/* Header - clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between transition-colors hover:brightness-110"
        style={{
          backgroundColor: isTroubleshoot
            ? "var(--color-quicktips-troubleshoot-header-bg)"
            : "var(--color-quicktips-section-header-bg)",
          color: isTroubleshoot
            ? "var(--color-quicktips-troubleshoot-header-text)"
            : "var(--color-quicktips-section-header-text)",
          padding: "var(--padding-quicktips-section-y) var(--padding-quicktips-section-x)",
          fontSize: "var(--font-size-quicktips-section-header)",
          fontWeight: "var(--font-weight-quicktips-section-header)",
        }}
      >
        <span className="flex items-center gap-2">
          {topic.title}
          {TitleIcon && <TitleIcon size={18} />}
        </span>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon size={20} />
        </motion.span>
      </button>

      {/* Body - collapsible */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div
              ref={contentRef}
              style={{
                backgroundColor: "var(--color-quicktips-section-body-bg)",
                padding: "var(--padding-quicktips-section-y) var(--padding-quicktips-section-x)",
              }}
            >
              <ContentComponent {...contentProps} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// MAIN PANEL COMPONENT
// ============================================

export default function QuickTipsPanel() {
  const {
    quickTipsOpen,
    setQuickTipsOpen,
    quickTipsExpandedSection,
    setQuickTipsExpandedSection,
    quickTipsHighlightChipToggle,
    setQuickTipsHighlightChipToggle,
  } = useAppData();

  const panelRef = useRef(null);
  const navigate = useNavigate();

  // Close the panel and route to the Contact Support form (troubleshooting step 4).
  const handleContactSupport = () => {
    setQuickTipsOpen(false);
    navigate("/support");
  };

  // Clear highlight when panel closes
  useEffect(() => {
    if (!quickTipsOpen && quickTipsHighlightChipToggle) {
      setQuickTipsHighlightChipToggle(false);
    }
  }, [quickTipsOpen, quickTipsHighlightChipToggle, setQuickTipsHighlightChipToggle]);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        // Check if click is on the QuickTips icon button (don't close if clicking the trigger)
        const isQuickTipsButton = event.target.closest('[aria-label="Quick Tips"]');
        if (!isQuickTipsButton) {
          setQuickTipsOpen(false);
        }
      }
    }

    if (quickTipsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [quickTipsOpen, setQuickTipsOpen]);

  // Scroll to expanded section when it changes
  useEffect(() => {
    if (quickTipsExpandedSection && panelRef.current) {
      const sectionIndex = QUICK_TIPS_TOPICS.findIndex(t => t.id === quickTipsExpandedSection);
      if (sectionIndex !== -1) {
        // Small delay to allow animation to start
        setTimeout(() => {
          const sectionElement = panelRef.current?.querySelector(`[data-section="${quickTipsExpandedSection}"]`);
          sectionElement?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [quickTipsExpandedSection]);

  const handleToggleSection = (sectionId) => {
    setQuickTipsExpandedSection(
      quickTipsExpandedSection === sectionId ? null : sectionId
    );
  };

  return (
    <AnimatePresence>
      {quickTipsOpen && (
        <>
        <PanelScrim isOpen onClose={() => setQuickTipsOpen(false)} zIndex={39} />
        <motion.div
          ref={panelRef}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-0 right-0 h-full z-40 shadow-xl flex flex-col font-opensans"
          style={{
            width: "var(--width-quicktips-panel)",
            // Position to the left of the vertical nav bar
            right: "calc(var(--width-vertical-nav-accent) + var(--width-vertical-nav-main))",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between flex-shrink-0"
            style={{
              backgroundColor: "var(--color-quicktips-header-bg)",
              height: "var(--height-quicktips-header)",
              padding: "0 var(--padding-quicktips-header-x)",
            }}
          >
            <h2
              style={{
                color: "var(--color-quicktips-header-text)",
                fontSize: "var(--font-size-quicktips-title)",
                fontWeight: "var(--font-weight-quicktips-title)",
              }}
            >
              💡 Quick Tips
            </h2>
            <button
              onClick={() => setQuickTipsOpen(false)}
              className="hover:opacity-80 transition-opacity"
              style={{ color: "var(--color-quicktips-header-text)", fontSize: "24px" }}
            >
              ×
            </button>
          </div>

          {/* Accordion sections - scrollable */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ backgroundColor: "var(--color-quicktips-body-bg)" }}
          >
            {QUICK_TIPS_TOPICS.map((topic) => (
              <div key={topic.id} data-section={topic.id}>
                <AccordionSection
                  topic={topic}
                  isExpanded={quickTipsExpandedSection === topic.id}
                  onToggle={() => handleToggleSection(topic.id)}
                  highlightChipToggle={topic.id === "assistance" && quickTipsHighlightChipToggle}
                  onContactSupport={handleContactSupport}
                />
              </div>
            ))}
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
