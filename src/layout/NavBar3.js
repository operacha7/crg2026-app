// src/layout/NavBar3.js
// Assistance type filter bar
// Shows Assistance button + selected assistance type chips + dropdown panel
// Fetches assistance types from Supabase for dynamic/evergreen groups

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { dataService } from "../services/dataService";
import { getIconByName } from "../icons/iconMap";
import { useAppData } from "../Contexts/AppDataContext";
import { logUsage } from "../services/usageService";
import AddressChipButton from "../components/AddressChipButton";
import PanelScrim from "../components/PanelScrim";

// Search-mode constants — must match the values used in AppDataContext / NavBar2
const SEARCH_MODES = {
  ZIPCODE: "zipcode",
  ORGANIZATION: "organization",
  LOCATION: "location",
  LLM: "llm",
};

const MAX_INDIVIDUAL_SELECTIONS = 3;

// Panel columns are grouped by the `category` field on each assistance row —
// the same field HomePage uses — so the panel mirrors the homepage layout.
// Column order matches the homepage (left-to-right): Basic Needs → Housing →
// Medical → Family & Education → Life & Community.
//
// Color reuses the existing --color-assistance-group* tokens so we don't
// fork the palette. Life & Community reuses Group 6's orange (per user) and
// is the only double-width column because it has the most assistance types.
const CATEGORY_ORDER = [
  "Basic Needs",
  "Housing",
  "Medical",
  "Family & Education",
  "Life & Community",
];

const CATEGORY_COLORS = {
  "Basic Needs":        "var(--color-assistance-group1)",
  "Housing":            "var(--color-assistance-group2)",
  "Medical":            "var(--color-assistance-group3)",
  "Family & Education": "var(--color-assistance-group4)",
  "Life & Community":   "var(--color-assistance-group6)",
};

// Assistance button - changes text based on whether chips exist
// No chevron - panel opens on hover
// Two states: prompting (no chips selected, gold + clickable — same as the
// Zip Code dropdown's empty state, so users can pick zip and assistance in
// either order), active (chips selected, dark blue). The "disabled" state
// from the pre-2026 design — which gated assistance behind picking a zip
// first — has been removed in favor of the show-all-by-default UX.
function AssistanceButton({ hasSelections, onClick, buttonRef }) {
  const buttonState = hasSelections ? "active" : "prompting";

  // Track previous state to detect transition to prompting (for animation).
  // The animation now only fires when chips are cleared back to empty —
  // not on initial mount, since prompting is the default state.
  const prevStateRef = useRef(buttonState);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (buttonState === "prompting" && prevStateRef.current !== "prompting") {
      setIsAnimating(true);
      const timeout = setTimeout(() => setIsAnimating(false), 1500);
      return () => clearTimeout(timeout);
    }
    prevStateRef.current = buttonState;
  }, [buttonState]);

  const stateStyles = {
    prompting: {
      backgroundColor: "var(--color-navbar3-btn-prompting-bg)",
      color: "var(--color-navbar3-btn-prompting-text)",
      border: "var(--border-width-btn) solid var(--color-navbar3-btn-prompting-border)",
      opacity: 1,
    },
    active: {
      backgroundColor: "var(--color-navbar3-btn-active-bg)",
      color: "var(--color-navbar3-btn-active-text)",
      border: "var(--border-width-btn) solid var(--color-navbar3-btn-active-border)",
      opacity: 1,
    },
  };

  // Glow + bounce animation when entering prompting state
  const glowColor = "rgba(249, 178, 51, 0.7)";
  const animationStyles = isAnimating
    ? {
        boxShadow: `0 0 0 3px ${glowColor}, 0 0 15px 5px ${glowColor}`,
        animation: "assistanceBounce 0.6s ease-out",
      }
    : {
        boxShadow: "none",
      };

  const buttonText = hasSelections ? "Change Assistance" : "Choose Assistance";

  return (
    <>
      <style>{`
        @keyframes assistanceBounce {
          0% { transform: scale(1); }
          20% { transform: scale(1.08) translateY(-3px); }
          40% { transform: scale(0.97) translateY(1px); }
          60% { transform: scale(1.03) translateY(-1px); }
          80% { transform: scale(0.99); }
          100% { transform: scale(1); }
        }
      `}</style>
      <button
        ref={buttonRef}
        onClick={onClick}
        className="font-opensans transition-all duration-200 flex items-center gap-2 hover:brightness-125 cursor-pointer flex-shrink-0"
        style={{
          height: "var(--height-navbar3-btn)",
          paddingLeft: "var(--padding-navbar2-btn-x)",
          paddingRight: "var(--padding-navbar2-btn-x)",
          borderRadius: "var(--radius-navbar2-btn)",
          fontSize: "var(--font-size-navbar2-btn)",
          fontWeight: "var(--font-weight-navbar2-btn)",
          letterSpacing: "var(--letter-spacing-navbar2-btn)",
          whiteSpace: "nowrap",
          ...stateStyles[buttonState],
          ...animationStyles,
        }}
      >
        {buttonText}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
    </>
  );
}

// Chip component for NavBar3
// States: inactive (white bg, black text, black border) or active (teal bg, white text, white border)
function AssistanceChip({ name, icon, isActive, onClick, fontSize, iconSize }) {
  const iconResult = icon ? getIconByName(icon) : null;
  // Normalize to array for consistent handling (supports comma-separated icons)
  const IconComponents = iconResult
    ? (Array.isArray(iconResult) ? iconResult : [iconResult])
    : [];

  return (
    <button
      onClick={onClick}
      className="font-opensans transition-all duration-200 hover:brightness-110 flex items-center justify-center gap-2"
      style={{
        height: "var(--height-navbar3-btn)",
        paddingLeft: "12px",
        paddingRight: "12px",
        borderRadius: "var(--radius-assistance-chip)",
        fontSize: fontSize || "var(--font-size-assistance-chip)",
        letterSpacing: "var(--letter-spacing-assistance-chip)",
        fontWeight: "500",
        backgroundColor: isActive
          ? "var(--color-navbar3-chip-active-bg)"
          : "var(--color-navbar3-chip-inactive-bg)",
        color: isActive
          ? "var(--color-navbar3-chip-active-text)"
          : "var(--color-navbar3-chip-inactive-text)",
        border: `var(--border-width-btn) solid ${isActive
          ? "var(--color-navbar3-chip-active-border)"
          : "var(--color-navbar3-chip-inactive-border)"}`,
        whiteSpace: "nowrap",
      }}
    >
      {IconComponents.map((IconComp, idx) => (
        <IconComp key={idx} size={iconSize || 25} />
      ))}
      {name}
    </button>
  );
}

// Panel type button - shows in dropdown panel
// States: unselected (group color) or selected (white bg, black border)
function PanelTypeButton({ name, icon, groupColor, isSelected, onClick, disabled }) {
  const iconResult = icon ? getIconByName(icon) : null;
  // Normalize to array for consistent handling (supports comma-separated icons)
  const IconComponents = iconResult
    ? (Array.isArray(iconResult) ? iconResult : [iconResult])
    : [];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        font-opensans transition-all duration-200 flex items-center justify-center gap-2
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:brightness-110 cursor-pointer"}
      `}
      style={{
        backgroundColor: isSelected ? "var(--color-assistance-selected-bg)" : groupColor,
        color: "var(--color-assistance-text)",
        padding: "8px 12px",
        borderRadius: "var(--radius-assistance-chip)",
        fontSize: "var(--font-size-assistance-chip)",
        letterSpacing: "var(--letter-spacing-assistance-chip)",
        fontWeight: "500",
        border: isSelected ? "1px solid var(--color-assistance-selected-border)" : "1px solid transparent",
        width: "100%",
        // min-width:0 lets the flex item shrink to its declared 100% width;
        // without it, intrinsic content width (long names like
        // "Medical - Program Enrollment") would push the chip past the
        // column edge and into the next column. The ellipsis span below
        // then truncates the visible text cleanly.
        minWidth: 0,
        textAlign: "center",
      }}
    >
      {IconComponents.map((IconComp, idx) => (
        <IconComp key={idx} size={25} />
      ))}
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
    </button>
  );
}

// Helper: Group assistance data by `category` (mirrors HomePage). Categories
// are returned in CATEGORY_ORDER; unknown categories (defensive — shouldn't
// happen with current data) are appended at the end so types never disappear
// if the data introduces a new category before the code is updated.
function groupAssistanceData(assistanceList) {
  const byCategory = new Map();

  assistanceList.forEach((item) => {
    const category = item.category;
    if (!category) return; // Skip rows missing a category — they can't be placed.
    if (!byCategory.has(category)) {
      byCategory.set(category, {
        id: category,
        name: category,
        color: CATEGORY_COLORS[category] || "var(--color-assistance-group1)",
        types: [],
      });
    }
    byCategory.get(category).types.push({
      id: item.assist_id, // Text field, matches directory.assist_id
      name: item.assistance,
      icon: item.icon,
    });
  });

  // Emit known categories first in the homepage order, then any unknown ones.
  const ordered = [];
  CATEGORY_ORDER.forEach((cat) => {
    if (byCategory.has(cat)) {
      ordered.push(byCategory.get(cat));
      byCategory.delete(cat);
    }
  });
  byCategory.forEach((group) => ordered.push(group));
  return ordered;
}

// Dropdown Panel Component
function AssistancePanel({
  isOpen,
  groups,
  selectedIds,
  onTypeToggle,
  onSave,
  onClear,
  panelRef,
}) {
  // Scroll-hint state. canScrollUp/Down track whether there's hidden content
  // above or below the visible scroll area; `bouncing` triggers a one-time
  // pulse on the bottom chip when the panel first opens with overflow —
  // that's the cue users were missing ("am I supposed to do something else?").
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [bouncing, setBouncing] = useState(false);

  // Local ref for scroll tracking. The parent (NavBar3) renders AssistancePanel
  // TWICE — once in the desktop branch, once in the mobile branch — both
  // attached to the same `panelRef`. Whichever mounts second wins, so the
  // external panelRef can point at the hidden (display:none) variant. We use
  // a local ref here so each instance tracks scroll on its *own* div, then
  // forward to panelRef via callback ref so click-outside detection still works.
  const localScrollRef = useRef(null);
  const setRefs = useCallback(
    (el) => {
      localScrollRef.current = el;
      if (typeof panelRef === "function") panelRef(el);
      else if (panelRef) panelRef.current = el;
    },
    [panelRef]
  );

  useEffect(() => {
    if (!isOpen) return;
    const el = localScrollRef.current;
    if (!el) return;
    // Note: we don't filter the hidden variant here. `offsetParent` is null
    // for any `position: fixed` element regardless of visibility, so it isn't
    // a reliable "am I rendered?" check. Instead we rely on the math —
    // the hidden variant has clientHeight=0/scrollHeight=0, so canScrollDown
    // computes to false and its indicator never renders.

    let bounceTimeout;
    const checkScroll = () => {
      setCanScrollUp(el.scrollTop > 8);
      setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    };

    // Defer first check until after content has laid out, so scrollHeight is accurate.
    const raf = requestAnimationFrame(() => {
      checkScroll();
      if (el.scrollHeight - el.clientHeight > 8) {
        setBouncing(true);
        bounceTimeout = setTimeout(() => setBouncing(false), 2400);
      }
    });

    el.addEventListener("scroll", checkScroll, { passive: true });
    // ResizeObserver covers viewport resizes and dynamic content height changes
    // (e.g., chip wrap reflow when the user resizes the window mid-session).
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      if (bounceTimeout) clearTimeout(bounceTimeout);
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const selectionCount = selectedIds.length;
  const atLimit = selectionCount >= MAX_INDIVIDUAL_SELECTIONS;

  // Click handlers for the scroll-hint chips — clicking nudges the panel
  // ~280px (roughly one chip-row's worth) in the indicated direction.
  // Uses localScrollRef so each instance scrolls its own div (panelRef can
  // point at the inactive variant — see ref-wiring comment above).
  const scrollDown = () => localScrollRef.current?.scrollBy({ top: 280, behavior: "smooth" });
  const scrollUp = () => localScrollRef.current?.scrollBy({ top: -280, behavior: "smooth" });

  const scrollHintPillStyle = {
    backgroundColor: "var(--color-panel-header-bg)",
    color: "var(--color-panel-title)",
    padding: "8px 18px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.02em",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    cursor: "pointer",
    pointerEvents: "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    whiteSpace: "nowrap",
    fontFamily: "'Open Sans', sans-serif",
  };

  return (
    <div
      ref={setRefs}
      className="fixed mt-2 shadow-xl z-50 overflow-auto"
      style={{
        borderRadius: "var(--radius-panel)",
        width: "min(1200px, calc(100vw - 32px))", // Responsive: max 1200px or screen width - 32px
        maxHeight: "calc(100dvh - 230px)", // Leave room for navbars (dvh handles mobile URL bar)
        left: "16px",
        right: "16px",
        top: "210px", // Below NavBar1 (80px) + NavBar2 (70px) + NavBar3 (60px)
        border: "var(--width-panel-border) solid var(--color-panel-border)",
      }}
      // Prevent click-outside handler from closing panel when clicking inside
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes scrollHintBounce {
          0%, 100% { transform: translate(-50%, 0); }
          50%      { transform: translate(-50%, -7px); }
        }
      `}</style>

      {/* Top scroll hint — appears once the user has scrolled past the top.
          Rendered inside a zero-height sticky wrapper so toggling visibility
          doesn't shift content. The pill is absolute-positioned at the top
          of the visible scroll area. pointer-events: none on the wrapper
          lets clicks fall through; the pill itself re-enables pointer-events
          so the click-to-scroll button still works. */}
      {canScrollUp && (
        <div
          style={{
            position: "sticky",
            top: 0,
            height: 0,
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <button
            type="button"
            onClick={scrollUp}
            style={{
              ...scrollHintPillStyle,
              position: "absolute",
              top: "12px",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>↑</span>
            Scroll up
          </button>
        </div>
      )}

      {/* Header */}
      <div
        className="flex flex-col items-center justify-center"
        style={{
          backgroundColor: "var(--color-panel-header-bg)",
          height: "var(--height-panel-header)",
          padding: "0 20px",
        }}
      >
        <h3
          className="font-opensans"
          style={{
            color: "var(--color-panel-title)",
            fontSize: "var(--font-size-panel-title)",
            fontWeight: "var(--font-weight-panel-title)",
            letterSpacing: "var(--letter-spacing-panel-title)",
          }}
        >
          Assistance Types
        </h3>
        <p
          className="font-opensans"
          style={{
            color: "var(--color-panel-subtitle)",
            fontSize: "var(--font-size-panel-subtitle)",
            fontWeight: "var(--font-weight-panel-subtitle)",
            letterSpacing: "var(--letter-spacing-panel-subtitle)",
          }}
        >
          (Select up to 3 assistance types)
        </p>
      </div>

      {/* Body — chip columns. Uniform cream background (--color-panel-body-bg).
          Group labels are plain teal uppercase text (no pill), not chip-colored,
          so the columns read as a clean grid against the cream backdrop. */}
      <div
        style={{
          backgroundColor: "var(--color-panel-body-bg)",
          padding: "28px 20px 32px 20px",
        }}
      >
        <div
          className="flex flex-wrap justify-center"
          style={{ gap: "20px" }}
        >
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex flex-col items-stretch"
              style={{ width: "max-content" }}
            >
              <div
                className="font-opensans"
                style={{
                  color: "var(--color-panel-label-text)",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  paddingLeft: "16px",
                  marginBottom: "16px",
                }}
              >
                {group.name}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: "20px",
                }}
              >
                {group.types.map((type) => {
                  const isSelected = selectedIds.includes(type.id);
                  const isDisabled = !isSelected && atLimit;
                  return (
                    <PanelTypeButton
                      key={type.id}
                      name={type.name}
                      icon={type.icon}
                      groupColor={group.color}
                      isSelected={isSelected}
                      onClick={() => onTypeToggle(type.id, group.id)}
                      disabled={isDisabled}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer — distinct band with its own bg + hairline top border so the
          action row reads as separate from the body even when the body is short.
          Clear is outlined (transparent bg, deep-green text + border); OK is the
          standard green filled button. No Cancel button — closing the panel
          via click-outside auto-saves the current selections. */}
      <div
        style={{
          backgroundColor: "var(--color-panel-footer-bg)",
          borderTop: "1px solid var(--color-panel-footer-border-top)",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "64px",
        }}
      >
        <button
          onClick={onClear}
          className="font-opensans transition-all duration-200 hover:brightness-110"
          style={{
            backgroundColor: "transparent",
            color: "var(--color-panel-btn-clear-text)",
            border: "1.5px solid var(--color-panel-btn-clear-border)",
            width: "var(--width-panel-btn)",
            height: "var(--height-panel-btn)",
            borderRadius: "var(--radius-panel-btn)",
            fontSize: "var(--font-size-panel-btn)",
            letterSpacing: "var(--letter-spacing-panel-btn)",
          }}
        >
          Clear
        </button>

        <button
          onClick={onSave}
          className="font-opensans transition-all duration-200 hover:brightness-110"
          style={{
            backgroundColor: "var(--color-panel-btn-ok-bg)",
            color: "var(--color-panel-btn-text)",
            width: "var(--width-panel-btn)",
            height: "var(--height-panel-btn)",
            borderRadius: "var(--radius-panel-btn)",
            fontSize: "var(--font-size-panel-btn)",
            letterSpacing: "var(--letter-spacing-panel-btn)",
          }}
        >
          OK
        </button>
      </div>

      {/* Bottom scroll hint — visible whenever content extends below the
          fold. Bounces 3× when the panel first opens with overflow, then
          stays static. Same zero-height sticky pattern as the top hint. */}
      {canScrollDown && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            height: 0,
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <button
            type="button"
            onClick={scrollDown}
            style={{
              ...scrollHintPillStyle,
              position: "absolute",
              bottom: "12px",
              left: "50%",
              transform: "translate(-50%, 0)",
              animation: bouncing ? "scrollHintBounce 0.7s ease-in-out 3" : "none",
            }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>↓</span>
            Scroll for more
          </button>
        </div>
      )}
    </div>
  );
}

export default function NavBar3() {
  // Get shared state from context
  const {
    activeAssistanceChips,
    setActiveAssistanceChips,
    loggedInUser,
    activeSearchMode,
    // Filter state from each search mode — used to gate the Address chip
    selectedZipCode,
    selectedParentOrg,
    selectedChildOrg,
    selectedLocationCounty,
    selectedLocationCity,
    selectedLocationZip,
    selectedLocationNeighborhood,
    llmSearchFilters,
    // Custom-address state — Address chip reads/writes these
    clientAddress,
    clientCoordinates,
    setClientAddress,
    setClientCoordinates,
    // Zip data — used to pre-fill the centroid in the Distance panel for Zip mode
    zipCodes,
  } = useAppData();

  // ---- Address chip gating ----
  // Enabled when (a) the active search mode has a filter selection AND (b) exactly 1 assistance chip is active.
  // LLM mode is the exception: a submitted question is enough (no assistance type required).
  // Reason: prevents triggering a large geocoding + Distance Matrix lookup against unfiltered results.
  const hasFilterSelection = useMemo(() => {
    switch (activeSearchMode) {
      case SEARCH_MODES.ZIPCODE:
        return !!selectedZipCode;
      case SEARCH_MODES.ORGANIZATION:
        return !!selectedParentOrg || !!selectedChildOrg;
      case SEARCH_MODES.LOCATION:
        return !!selectedLocationCounty || !!selectedLocationCity
          || !!selectedLocationZip || !!selectedLocationNeighborhood;
      case SEARCH_MODES.LLM:
        return llmSearchFilters != null;
      default:
        return false;
    }
  }, [
    activeSearchMode,
    selectedZipCode,
    selectedParentOrg,
    selectedChildOrg,
    selectedLocationCounty,
    selectedLocationCity,
    selectedLocationZip,
    selectedLocationNeighborhood,
    llmSearchFilters,
  ]);

  const hasOneAssistance = activeAssistanceChips.size === 1;

  const addressDisabled = activeSearchMode === SEARCH_MODES.LLM
    ? !hasFilterSelection
    : !(hasFilterSelection && hasOneAssistance);

  let addressTooltip;
  if (!addressDisabled) {
    addressTooltip = "Enter Address for driving distances";
  } else if (activeSearchMode === SEARCH_MODES.LLM) {
    addressTooltip = "Ask a question to enable address entry";
  } else if (!hasFilterSelection && !hasOneAssistance) {
    addressTooltip = "Make a search filter selection and select one assistance type";
  } else if (!hasFilterSelection) {
    addressTooltip = "Make a selection from the search filter to enable address entry";
  } else {
    addressTooltip = "Select one assistance type to enable address entry";
  }

  // Centroid pre-fill for the Distance panel — only meaningful in Zip / Location modes
  const addressDefaultCoordinates = useMemo(() => {
    const zip = selectedZipCode || selectedLocationZip;
    if (!zip || !zipCodes) return "";
    const match = zipCodes.find((z) => z.zip_code === zip);
    return match?.coordinates || "";
  }, [selectedZipCode, selectedLocationZip, zipCodes]);

  const handleAddressChange = (address, coordinates) => {
    setClientAddress(address);
    setClientCoordinates(coordinates);
  };

  // Get organization name for logging
  const regOrgName = loggedInUser?.reg_organization || 'Guest';

  // Map search mode to display name for logging
  const getSearchModeDisplay = () => {
    switch (activeSearchMode) {
      case 'zipcode': return 'Zip Code';
      case 'organization': return 'Organization';
      case 'location': return 'Location';
      case 'llm': return 'Ask a Question';
      default: return 'Zip Code';
    }
  };

  // Log assistance type selections to app_usage_logs
  const logAssistanceSelections = useCallback((selections, assistData) => {
    selections.forEach((typeId) => {
      const item = assistData.find((a) => a.assist_id === typeId);
      if (item) {
        logUsage({
          reg_organization: regOrgName,
          action_type: 'search',
          search_mode: getSearchModeDisplay(),
          assistance_type: item.assistance,
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regOrgName, activeSearchMode]);

  // Assistance data from Supabase
  const [assistanceData, setAssistanceData] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Saved selections (what's shown in NavBar3 chips)
  const [savedSelections, setSavedSelections] = useState([]);
  // Panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // Temporary selections while panel is open
  const [tempSelections, setTempSelections] = useState([]);

  // Keep saved chips in sync with externally-set active chips (e.g. when an SMS
  // deep link arrives and AppDataContext populates activeAssistanceChips before
  // NavBar3 mounts). Additive only — never removes chips the user added locally.
  useEffect(() => {
    setSavedSelections((prev) => {
      const missing = [...activeAssistanceChips].filter((id) => !prev.includes(id));
      return missing.length === 0 ? prev : [...prev, ...missing];
    });
  }, [activeAssistanceChips]);

  // Ref for the panel to detect outside clicks
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch assistance data on mount
  useEffect(() => {
    async function fetchAssistance() {
      try {
        const data = await dataService.getAssistance();
        setAssistanceData(data);
        setGroups(groupAssistanceData(data));
      } catch (error) {
        console.error("Error fetching assistance data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAssistance();
  }, []);

  // Handle click outside to close panel (acts as Save)
  useEffect(() => {
    function handleClickOutside(event) {
      if (!isPanelOpen) return;

      // Check if click is outside both the panel and the button
      const isOutsidePanel = panelRef.current && !panelRef.current.contains(event.target);
      const isOutsideButton = buttonRef.current && !buttonRef.current.contains(event.target);

      if (isOutsidePanel && isOutsideButton) {
        // Auto-save and activate all selections
        setSavedSelections(tempSelections);
        setActiveAssistanceChips(new Set(tempSelections));
        setIsPanelOpen(false);

        // Log each selected assistance type
        logAssistanceSelections(tempSelections, assistanceData);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isPanelOpen, tempSelections, setActiveAssistanceChips, logAssistanceSelections, assistanceData]);

  // Get type info by assist_id (text field that matches directory.assist_id)
  const getTypeInfo = (typeId) => {
    const item = assistanceData.find((a) => a.assist_id === typeId);
    if (item) {
      return {
        id: item.assist_id,
        name: item.assistance,
        icon: item.icon,
        group: item.group,
      };
    }
    return null;
  };

  // Click handler toggles the panel
  const handleOpenPanel = () => {
    if (isPanelOpen) {
      // Closing - auto-save selections
      setSavedSelections(tempSelections);
      setActiveAssistanceChips(new Set(tempSelections));
      setIsPanelOpen(false);

      // Log each selected assistance type
      logAssistanceSelections(tempSelections, assistanceData);
    } else {
      // Opening - load saved selections into temp
      setTempSelections([...savedSelections]);
      setIsPanelOpen(true);
    }
  };

  // Handle type toggle in panel. Already-selected types can always be deselected;
  // otherwise the user can add up to MAX_INDIVIDUAL_SELECTIONS individual types.
  const handleTypeToggle = (typeId) => {
    setTempSelections((prev) => {
      if (prev.includes(typeId)) {
        return prev.filter((id) => id !== typeId);
      }
      if (prev.length >= MAX_INDIVIDUAL_SELECTIONS) {
        return prev;
      }
      return [...prev, typeId];
    });
  };

  // Handle save
  const handleSave = () => {
    setSavedSelections(tempSelections);
    // Auto-activate all selections (update shared context)
    // assist_id is already text, use directly
    setActiveAssistanceChips(new Set(tempSelections));
    setIsPanelOpen(false);

    // Log each selected assistance type
    logAssistanceSelections(tempSelections, assistanceData);
  };

  // Handle clear - clears all selections but keeps panel open
  const handleClear = () => {
    setTempSelections([]);
    // Panel stays open - selections will be saved when user leaves panel
  };

  // Handle chip click in NavBar3 - updates shared context state and logs usage
  const handleChipClick = (typeId) => {
    const typeInfo = getTypeInfo(typeId);
    const isActivating = !activeAssistanceChips.has(typeId);

    setActiveAssistanceChips((prev) => {
      const newSet = new Set(prev);
      // assist_id is already text, use directly
      if (newSet.has(typeId)) {
        newSet.delete(typeId);
      } else {
        newSet.add(typeId);
      }
      return newSet;
    });

    // Log when activating an assistance chip (not when deactivating)
    if (isActivating && typeInfo) {
      logUsage({
        reg_organization: regOrgName,
        action_type: 'search',
        search_mode: getSearchModeDisplay(),
        assistance_type: typeInfo.name,
      });
    }
  };

  if (loading) {
    return (
      <nav
        className="bg-navbar3-bg flex items-center"
        style={{
          height: "var(--height-navbar3)",
          paddingLeft: "var(--padding-navbar3-left)",
        }}
      >
        <span className="font-opensans" style={{ color: "var(--color-navbar3-user-text)" }}>Loading...</span>
      </nav>
    );
  }

  // Display name for logged-in user
  const displayName = loggedInUser?.isGuest
    ? 'Guest'
    : loggedInUser?.reg_organization || 'Guest';

  return (
    <nav className="bg-navbar3-bg relative">
      {/* Scrim painted whenever the Assistance picker is open. Rendered via
          portal at body level so it covers the whole viewport. Click on the
          scrim closes the panel — the existing click-outside listener
          (mousedown) fires first and auto-saves current selections, matching
          the existing "click anywhere outside = save" behavior. */}
      <PanelScrim isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} zIndex={49} />
      {/* ========== DESKTOP LAYOUT (md+) ========== */}
      <div
        className="hidden lg:flex items-center justify-between"
        style={{
          height: "var(--height-navbar3)",
          paddingLeft: "var(--padding-navbar3-left)",
          paddingRight: "var(--padding-navbar1-right)",
        }}
      >
        {/* Left side: Assistance button → chips → Address chip.
            The Address chip sits after the last assistance chip with the
            same gap as the button→first-chip gap so the whole row reads as
            one cluster. */}
        <div className="flex items-center min-w-0">
          {/* Assistance button container */}
          <div
            ref={containerRef}
            className="relative flex-shrink-0"
          >
            <AssistanceButton
              hasSelections={savedSelections.length > 0}
              onClick={handleOpenPanel}
              buttonRef={buttonRef}
            />
            {/* Dropdown Panel - inside hover container */}
            <AssistancePanel
              isOpen={isPanelOpen}
              groups={groups}
              selectedIds={tempSelections}
              onTypeToggle={handleTypeToggle}
              onSave={handleSave}
              onClear={handleClear}
              panelRef={panelRef}
            />
          </div>

          {/* Chips - use smaller font/icons when 6+ selections to prevent wrapping */}
          {savedSelections.length > 0 && (
            <div
              className="flex items-center flex-shrink-0"
              style={{
                marginLeft: "var(--gap-navbar3-button-chips)",
                gap: savedSelections.length >= 6 ? "8px" : "var(--gap-navbar3-chips)",
              }}
            >
              {savedSelections.map((typeId) => {
                const typeInfo = getTypeInfo(typeId);
                if (!typeInfo) return null;
                return (
                  <AssistanceChip
                    key={typeId}
                    name={typeInfo.name}
                    icon={typeInfo.icon}
                    isActive={activeAssistanceChips.has(typeId)}
                    onClick={() => handleChipClick(typeId)}
                    fontSize={savedSelections.length >= 6 ? "11px" : undefined}
                    iconSize={savedSelections.length >= 6 ? 18 : undefined}
                  />
                );
              })}
            </div>
          )}

          {/* Address chip — same gap from the previous element as
              button→first-chip, so it reads as the next item in the cluster. */}
          <div style={{ marginLeft: "var(--gap-navbar3-button-chips)", flexShrink: 0 }}>
            <AddressChipButton
              isActive={!!clientCoordinates}
              defaultCoordinates={addressDefaultCoordinates}
              clientAddress={clientAddress}
              clientCoordinates={clientCoordinates}
              onCoordinatesChange={handleAddressChange}
              disabled={addressDisabled}
              tooltipText={addressTooltip}
            />
          </div>
        </div>

        {/* Right: logged-in org / Guest name. min-width:0 + overflow:hidden
            lets long names truncate at narrow viewports instead of forcing
            the left cluster off-screen. */}
        <div
          className="font-handlee"
          style={{
            color: "var(--color-navbar3-user-text, #FFFFFF)",
            fontSize: "var(--font-size-navbar3-user)",
            letterSpacing: ".05em",
            whiteSpace: "nowrap",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginLeft: "16px",
          }}
        >
          {displayName}
        </div>
      </div>

      {/* ========== MOBILE LAYOUT (<md) ========== */}
      <div className="lg:hidden py-2 px-3">
        {/* Top row: Assistance button (left) + logged-in org / Guest (right).
            Chips are deliberately on a separate row below — they're allowed
            to wrap; the org name is not. min-w-0 on the name lets ellipsis
            kick in for long org names instead of pushing the button off-screen. */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div
            className="relative flex-shrink-0"
          >
            <button
              ref={buttonRef}
              onClick={handleOpenPanel}
              className="font-opensans text-sm px-3 py-1.5 rounded transition-all flex items-center gap-1 hover:brightness-125 cursor-pointer"
              style={{
                ...(savedSelections.length > 0
                  ? {
                      backgroundColor: "var(--color-navbar3-btn-active-bg)",
                      color: "var(--color-navbar3-btn-active-text)",
                      border: "var(--border-width-btn) solid var(--color-navbar3-btn-active-border)",
                    }
                  : {
                      backgroundColor: "var(--color-navbar3-btn-prompting-bg)",
                      color: "var(--color-navbar3-btn-prompting-text)",
                      border: "var(--border-width-btn) solid var(--color-navbar3-btn-prompting-border)",
                    }
                ),
              }}
            >
              {savedSelections.length > 0 ? `Assistance (${savedSelections.length})` : "Choose Assistance"}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
            {/* Panel still available */}
            <AssistancePanel
              isOpen={isPanelOpen}
              groups={groups}
              selectedIds={tempSelections}
              onTypeToggle={handleTypeToggle}
              onSave={handleSave}
              onClear={handleClear}
              panelRef={panelRef}
            />
          </div>

          {/* Logged-in org / Guest — same handlee styling as desktop, shrunk
              for mobile. Truncates with ellipsis rather than wrapping so the
              chips row below stays on the second line as intended. */}
          <div
            className="font-handlee"
            style={{
              color: "var(--color-navbar3-user-text, #FFFFFF)",
              fontSize: "14px",
              letterSpacing: ".05em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              textAlign: "right",
            }}
          >
            {displayName}
          </div>
        </div>

        {/* Chips row - wrap on mobile, with icon + label */}
        {savedSelections.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {savedSelections.map((typeId) => {
              const typeInfo = getTypeInfo(typeId);
              if (!typeInfo) return null;
              const iconResult = typeInfo.icon ? getIconByName(typeInfo.icon) : null;
              const IconComponents = iconResult
                ? (Array.isArray(iconResult) ? iconResult : [iconResult])
                : [];
              return (
                <button
                  key={typeId}
                  onClick={() => handleChipClick(typeId)}
                  className={`text-xs px-2 py-1 rounded-full transition-all flex items-center gap-1 ${
                    activeAssistanceChips.has(typeId)
                      ? "bg-navbar3-chip-active-bg text-navbar3-chip-active-text border border-white"
                      : "bg-navbar3-chip-inactive-bg text-navbar3-chip-inactive-text border border-black"
                  }`}
                >
                  {IconComponents.map((IconComp, idx) => (
                    <IconComp key={idx} size={14} />
                  ))}
                  {typeInfo.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
