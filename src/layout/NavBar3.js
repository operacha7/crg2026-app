// src/layout/NavBar3.js
// Assistance type filter bar
// Shows Assistance button + selected assistance type chips + dropdown panel
// Fetches assistance types from Supabase for dynamic/evergreen groups

import { useState, useEffect, useRef, useCallback } from "react";
import { dataService } from "../services/dataService";
import { getIconByName } from "../icons/iconMap";
import { useAppData } from "../Contexts/AppDataContext";
import { logUsage } from "../services/usageService";

const MAX_INDIVIDUAL_SELECTIONS = 3;

// Group colors for the 6 groups (unselected state)
const GROUP_COLORS = {
  1: "var(--color-assistance-group1)",
  2: "var(--color-assistance-group2)",
  3: "var(--color-assistance-group3)",
  4: "var(--color-assistance-group4)",
  5: "var(--color-assistance-group5)",
  6: "var(--color-assistance-group6)",
};

// Assistance button - changes text based on whether chips exist
// No chevron - panel opens on hover
function AssistanceButton({ hasSelections, onClick, buttonRef }) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={`
        font-opensans transition-all duration-200 flex items-center gap-2
        ${hasSelections
          ? "bg-navbar2-btn-active-bg text-navbar2-btn-active-text hover:brightness-125"
          : "bg-transparent text-navbar2-btn-inactive-text hover:bg-white/10"
        }
      `}
      style={{
        height: "var(--height-navbar3-btn)",
        paddingLeft: "var(--padding-navbar2-btn-x)",
        paddingRight: "var(--padding-navbar2-btn-x)",
        borderRadius: "var(--radius-navbar2-btn)",
        fontSize: "var(--font-size-navbar2-btn)",
        fontWeight: "var(--font-weight-navbar2-btn)",
        letterSpacing: "var(--letter-spacing-navbar2-btn)",
      }}
    >
      {hasSelections ? "Change Assistance" : "Select Assistance"}
    </button>
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
      className="font-opensans transition-all duration-200 hover:brightness-110 flex items-center gap-2"
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
        border: `1px solid ${isActive
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
        font-opensans transition-all duration-200 flex items-center gap-2
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
        whiteSpace: "nowrap", // Prevent text wrapping
        width: "100%", // Fill column width (all chips same width within group)
        textAlign: "left",
      }}
    >
      {IconComponents.map((IconComp, idx) => (
        <IconComp key={idx} size={25} />
      ))}
      {name}
    </button>
  );
}

// Group button - toggles all items in group
function GroupButton({ name, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="font-opensans transition-all duration-200 hover:brightness-110"
      style={{
        backgroundColor: color,
        color: "var(--color-assistance-text)",
        width: "100%", // Match column width (widest chip determines size)
        height: "var(--height-assistance-group-btn)",
        borderRadius: "var(--radius-assistance-chip)",
        fontSize: "var(--font-size-assistance-chip)",
        letterSpacing: "var(--letter-spacing-assistance-chip)",
        fontWeight: "700",
      }}
    >
      {name}
    </button>
  );
}

// Helper: Group assistance data by group number
function groupAssistanceData(assistanceList) {
  const groups = {};

  assistanceList.forEach((item) => {
    const groupNum = item.group;
    if (!groups[groupNum]) {
      groups[groupNum] = {
        id: groupNum,
        name: `Group ${groupNum}`,
        color: GROUP_COLORS[groupNum] || GROUP_COLORS[1],
        types: [],
      };
    }
    // Use assist_id from assistance table - matches directory.assist_id (both text)
    groups[groupNum].types.push({
      id: item.assist_id, // Text field, matches directory.assist_id
      name: item.assistance,
      icon: item.icon,
    });
  });

  // Convert to array and sort by group number
  return Object.values(groups).sort((a, b) => a.id - b.id);
}

// Helper: Check if selections represent a full single group
function isFullGroupSelected(selectedIds, groups) {
  for (const group of groups) {
    const groupTypeIds = group.types.map((t) => t.id);
    const allSelected = groupTypeIds.every((id) => selectedIds.includes(id));
    const onlyThisGroup = selectedIds.every((id) => groupTypeIds.includes(id));
    if (allSelected && onlyThisGroup && groupTypeIds.length > 0) {
      return group.id;
    }
  }
  return null;
}

// Dropdown Panel Component
function AssistancePanel({
  isOpen,
  groups,
  selectedIds,
  onTypeToggle,
  onGroupToggle,
  onSave,
  onClear,
  panelRef,
}) {
  if (!isOpen) return null;

  const fullGroupId = isFullGroupSelected(selectedIds, groups);
  const isInFullGroupMode = fullGroupId !== null;
  const selectionCount = selectedIds.length;

  return (
    <div
      ref={panelRef}
      className="fixed mt-2 shadow-xl z-50 overflow-auto"
      style={{
        borderRadius: "var(--radius-panel)",
        width: "min(1300px, calc(100vw - 32px))", // Responsive: max 1300px or screen width - 32px
        maxHeight: "calc(100vh - 230px)", // Leave room for navbars
        left: "16px",
        right: "16px",
        top: "210px", // Below NavBar1 (80px) + NavBar2 (70px) + NavBar3 (60px)
        border: "var(--width-panel-border) solid var(--color-panel-border)",
      }}
      // Prevent click-outside handler from closing panel when clicking inside
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
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
          (Select one Group or up to three Assistance Types)
        </p>
      </div>

      {/* Body */}
      <div
        style={{
          backgroundColor: "var(--color-panel-body-bg)",
          padding: "20px",
        }}
      >
        {/* Groups grid - wraps on smaller screens */}
        <div className="flex flex-wrap gap-4 justify-center">
          {groups.map((group) => {
            // Determine if this group's items should be disabled
            const isGroupDisabled = isInFullGroupMode && fullGroupId !== group.id;

            return (
              <div key={group.id} className="flex flex-col items-stretch">
                <GroupButton
                  name={group.name}
                  color={group.color}
                  onClick={() => onGroupToggle(group.id)}
                />
                <div className="mt-3 space-y-2">
                  {group.types.map((type) => {
                    const isSelected = selectedIds.includes(type.id);

                    // Can select if:
                    // 1. Already selected (can always deselect)
                    // 2. In full group mode for THIS group
                    // 3. Not in full group mode and under the limit
                    const canSelect = isSelected ||
                      (isInFullGroupMode && fullGroupId === group.id) ||
                      (!isInFullGroupMode && selectionCount < MAX_INDIVIDUAL_SELECTIONS);

                    const isDisabled = isGroupDisabled || (!isSelected && !canSelect);

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
            );
          })}
        </div>

        {/* Footer with buttons - closer together on mobile */}
        <div className="flex justify-center items-center gap-8 md:gap-36 mt-8 md:mt-16">
          <button
            onClick={onClear}
            className="font-opensans transition-all duration-200 hover:brightness-110"
            style={{
              backgroundColor: "var(--color-panel-btn-cancel-bg)",
              color: "var(--color-panel-btn-text)",
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
      </div>
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
    // Quick Tips state for auto-opening on first multi-selection
    setQuickTipsOpen,
    setQuickTipsExpandedSection,
    quickTipsShownThisSession,
    setQuickTipsShownThisSession,
    setQuickTipsHighlightChipToggle,
  } = useAppData();

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

  // Handle type toggle in panel
  const handleTypeToggle = (typeId, groupId) => {
    setTempSelections((prev) => {
      const isCurrentlySelected = prev.includes(typeId);

      if (isCurrentlySelected) {
        return prev.filter((id) => id !== typeId);
      } else {
        const fullGroupId = isFullGroupSelected(prev, groups);

        if (fullGroupId) {
          if (groupId !== fullGroupId) {
            return prev;
          }
          return [...prev, typeId];
        } else {
          if (prev.length >= MAX_INDIVIDUAL_SELECTIONS) {
            return prev;
          }
          return [...prev, typeId];
        }
      }
    });
  };

  // Handle group toggle in panel
  const handleGroupToggle = (groupId) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const groupTypeIds = group.types.map((t) => t.id);
    const allInGroupSelected = groupTypeIds.every((id) => tempSelections.includes(id));

    if (allInGroupSelected) {
      // Deselect all in this group
      setTempSelections((prev) => prev.filter((id) => !groupTypeIds.includes(id)));
    } else {
      // Check if we're in full group mode for another group
      const fullGroupId = isFullGroupSelected(tempSelections, groups);
      if (fullGroupId && fullGroupId !== groupId) {
        return;
      }
      // Select all in this group (replaces current selections)
      setTempSelections(groupTypeIds);
    }
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

    // Auto-open Quick Tips to Assistance section on first multi-selection of session
    // Highlight the chip toggle section to draw attention to the toggling feature
    if (tempSelections.length > 1 && !quickTipsShownThisSession) {
      setQuickTipsOpen(true);
      setQuickTipsExpandedSection("assistance");
      setQuickTipsHighlightChipToggle(true);
      setQuickTipsShownThisSession(true);
    }
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
        <span className="text-white font-opensans">Loading...</span>
      </nav>
    );
  }

  // Display name for logged-in user
  const displayName = loggedInUser?.isGuest
    ? 'Guest'
    : loggedInUser?.reg_organization || 'Guest';

  return (
    <nav className="bg-navbar3-bg relative">
      {/* ========== DESKTOP LAYOUT (md+) ========== */}
      <div
        className="hidden md:flex items-center justify-between"
        style={{
          height: "var(--height-navbar3)",
          paddingLeft: "var(--padding-navbar3-left)",
          paddingRight: "var(--padding-navbar1-right)",
        }}
      >
        {/* Left side: Assistance button and chips */}
        <div className="flex items-center flex-1 min-w-0">
          {/* Assistance button container */}
          <div
            ref={containerRef}
            className="relative"
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
              onGroupToggle={handleGroupToggle}
              onSave={handleSave}
              onClear={handleClear}
              panelRef={panelRef}
            />
          </div>

          {/* Chips - use smaller font/icons when 6+ selections to prevent wrapping */}
          {savedSelections.length > 0 && (
            <div
              className="flex items-center"
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
        </div>

        {/* Right side: Logged-in user */}
        <span
          className="font-handlee flex-shrink-0 ml-4"
          style={{
            color: "var(--color-navbar3-user-text, #F3EED9)",
            fontSize: "var(--font-size-navbar3-user)",
            letterSpacing: ".05em",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </span>
      </div>

      {/* ========== MOBILE LAYOUT (<md) ========== */}
      <div className="md:hidden py-2 px-3">
        {/* Top row: Assistance button + user name */}
        <div className="flex items-center justify-between mb-2">
          <div
            className="relative"
          >
            <button
              ref={buttonRef}
              onClick={handleOpenPanel}
              className={`
                font-opensans text-sm px-3 py-1.5 rounded transition-all flex items-center gap-1
                ${savedSelections.length > 0
                  ? "bg-navbar2-btn-active-bg text-navbar2-btn-active-text"
                  : "bg-transparent text-navbar2-btn-inactive-text border border-white/30"
                }
              `}
            >
              {savedSelections.length > 0 ? `Assistance (${savedSelections.length})` : "Select Assistance"}
            </button>
            {/* Panel still available */}
            <AssistancePanel
              isOpen={isPanelOpen}
              groups={groups}
              selectedIds={tempSelections}
              onTypeToggle={handleTypeToggle}
              onGroupToggle={handleGroupToggle}
              onSave={handleSave}
              onClear={handleClear}
              panelRef={panelRef}
            />
          </div>

          <span
            className="font-Montserrat text-sm truncate max-w-[150px]"
            style={{ color: "var(--color-navbar3-user-text, #000000)" }}
          >
            {displayName}
          </span>
        </div>

        {/* Chips row - wrap on mobile */}
        {savedSelections.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {savedSelections.map((typeId) => {
              const typeInfo = getTypeInfo(typeId);
              if (!typeInfo) return null;
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
