// src/components/QuickTipsPanel.js
// Quick Tips sidebar panel with accordion sections
// Slides out from the vertical nav bar with visual how-to guides
// Can be triggered by icon click or auto-opened to specific section

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppData } from "../Contexts/AppDataContext";
import {
  HomeIcon,
  HelpBubbleIcon,
  ReportsIcon,
  AnnouncementsIcon,
  PrivacyPolicyIcon,
  ContactSupportIcon,
  DistanceIcon,
  ChevronDownIcon,
  QuickTipsIcon,
  MedicalPrimaryCareIcon,
  EducationChildrenIcon,
} from "../icons";

// Topic definitions with their visual content
const QUICK_TIPS_TOPICS = [
  {
    id: "assistance",
    title: "Assistance Types",
    content: AssistanceTypesTip,
  },
  {
    id: "counters",
    title: "Counters",
    content: CountersTip,
  },
  {
    id: "distance",
    title: "Distance",
    titleIcon: DistanceIcon,
    content: DistanceTip,
  },
  {
    id: "email-pdf",
    title: "Email / PDF",
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
    id: "zipcode",
    title: "Zip Code Search",
    content: ZipCodeSearchTip,
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

function DistanceTip() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        By default, distances are calculated from the zip code center.
      </p>

      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center rounded p-1"
          style={{ backgroundColor: "var(--color-navbar2-bg)" }}
        >
          <DistanceIcon size={24} />
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Click to enter a client address for more accurate distances
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Results will be sorted by distance from that address.
      </p>
    </div>
  );
}

function EmailPdfTip() {
  return (
    <div className="space-y-4">
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Send selected resources to clients via email or PDF.
      </p>

      <div className="flex items-center gap-3">
        <span
          className="inline-block px-3 py-1 rounded text-sm font-medium"
          style={{ backgroundColor: "var(--color-navbar1-btn-email-bg)", color: "var(--color-navbar1-btn-email-text)" }}
        >
          Send Email
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Email resources directly
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className="inline-block px-3 py-1 rounded text-sm font-medium"
          style={{ backgroundColor: "var(--color-navbar1-btn-pdf-bg)", color: "var(--color-navbar1-btn-pdf-text)" }}
        >
          Create PDF
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Generate a printable document
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        First select resources using the checkboxes, then click a button.
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
      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Search for a specific organization by name.
      </p>

      <div className="flex items-center gap-3">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: "var(--color-navbar2-btn-active-bg)", color: "var(--color-navbar2-btn-active-text)" }}
        >
          Organization
        </span>
        <span style={{ color: "var(--color-quicktips-section-body-text)", fontSize: "var(--font-size-quicktips-body)" }}>
          Click to switch to Organization mode
        </span>
      </div>

      <p style={{ fontSize: "var(--font-size-quicktips-body)", color: "var(--color-quicktips-section-body-text)" }}>
        Select a parent organization, then a child below it.
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
            <DistanceIcon size={14} />
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

// ============================================
// ACCORDION SECTION COMPONENT
// ============================================

function AccordionSection({ topic, isExpanded, onToggle, highlightChipToggle }) {
  const ContentComponent = topic.content;
  const TitleIcon = topic.titleIcon;
  const contentRef = useRef(null);

  // Check if this topic's content component accepts highlightChipToggle prop
  const contentProps = topic.id === "assistance" ? { highlightChipToggle } : {};

  return (
    <div style={{ borderBottom: "1px solid var(--color-quicktips-section-border)" }}>
      {/* Header - clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between transition-colors hover:brightness-110"
        style={{
          backgroundColor: "var(--color-quicktips-section-header-bg)",
          color: "var(--color-quicktips-section-header-text)",
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
                />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
