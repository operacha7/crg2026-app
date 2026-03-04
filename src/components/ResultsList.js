// src/components/ResultsList.js
// Scrollable list of result rows with sort and filter capabilities
// Renders ResultsHeader + FilterRow + scrollable ResultRow list
// Sort/filter state managed locally via useReducer

import { useMemo, useReducer, useEffect, useRef, useCallback } from "react";
import ResultRow from "./ResultRow";
import ResultsHeader from "../layout/ResultsHeader";
import FilterRow from "./FilterRow";
import { useAppData } from "../Contexts/AppDataContext";
import { parseHoursJson } from "../utils/formatters";

// ============ SORT/FILTER REDUCER ============

const initialState = {
  sortColumn: null,        // null = default, "organization", "miles"
  sortDirection: "asc",
  filterRowVisible: false,
  filterOrganization: "",
  filterDay: "",           // "" | "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su"
  filterRequirements: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "TOGGLE_SORT": {
      const col = action.column;
      if (state.sortColumn === col) {
        // Same column: asc → desc → default
        if (state.sortDirection === "asc") {
          return { ...state, sortDirection: "desc" };
        }
        // Was desc, go back to default
        return { ...state, sortColumn: null, sortDirection: "asc" };
      }
      // New column: start ascending
      return { ...state, sortColumn: col, sortDirection: "asc" };
    }
    case "TOGGLE_FILTER_ROW":
      return { ...state, filterRowVisible: !state.filterRowVisible };
    case "SET_FILTER_ORGANIZATION":
      return { ...state, filterOrganization: action.value };
    case "SET_FILTER_DAY":
      return { ...state, filterDay: action.value };
    case "SET_FILTER_REQUIREMENTS":
      return { ...state, filterRequirements: action.value };
    case "CLEAR_FILTER":
      return { ...state, [action.field]: "" };
    case "RESET_ALL":
      return { ...initialState };
    default:
      return state;
  }
}

// ============ SORT FUNCTIONS ============

// Default sort: status_id → assist_id → miles (all ascending)
function defaultSort(a, b) {
  const aStatusId = a.status_id || 999;
  const bStatusId = b.status_id || 999;
  if (aStatusId !== bStatusId) return aStatusId - bStatusId;

  const aAssistId = parseInt(a.assist_id, 10) || 999;
  const bAssistId = parseInt(b.assist_id, 10) || 999;
  if (aAssistId !== bAssistId) return aAssistId - bAssistId;

  const aMiles = a.distance ?? Infinity;
  const bMiles = b.distance ?? Infinity;
  return aMiles - bMiles;
}

function sortRecords(records, sortColumn, sortDirection) {
  if (!sortColumn) {
    return [...records].sort(defaultSort);
  }

  const dir = sortDirection === "asc" ? 1 : -1;

  return [...records].sort((a, b) => {
    let cmp = 0;
    if (sortColumn === "organization") {
      cmp = (a.organization || "").localeCompare(b.organization || "");
      if (cmp === 0) {
        const aId = parseInt(a.assist_id, 10) || 999;
        const bId = parseInt(b.assist_id, 10) || 999;
        cmp = aId - bId;
      }
    } else if (sortColumn === "miles") {
      cmp = (a.distance ?? Infinity) - (b.distance ?? Infinity);
    }
    return cmp * dir;
  });
}

// ============ FILTER FUNCTIONS ============

function filterRecords(records, filterOrganization, filterDay, filterRequirements) {
  let filtered = records;

  if (filterOrganization) {
    const term = filterOrganization.toLowerCase();
    filtered = filtered.filter(r =>
      (r.organization || "").toLowerCase().includes(term)
    );
  }

  if (filterDay) {
    filtered = filtered.filter(r => {
      const hours = parseHoursJson(r.org_hours);
      if (!hours) return false;
      const inRegular = hours.regular?.some(entry => entry.days?.includes(filterDay));
      const inLabeled = hours.labeled?.some(entry => entry.days?.includes(filterDay));
      return inRegular || inLabeled;
    });
  }

  if (filterRequirements) {
    const term = filterRequirements.toLowerCase();
    filtered = filtered.filter(r =>
      (r.requirements || "").toLowerCase().includes(term)
    );
  }

  return filtered;
}

// ============ ZERO RESULTS SUGGESTIONS ============

function getZeroResultsSuggestions(filters, searchMode) {
  const suggestions = [];

  if (searchMode === "llm" && filters) {
    if (filters.days && filters.days.length > 0) {
      suggestions.push({ text: "Remove day filter", hint: `Currently filtering for ${filters.days.join(", ")}` });
    }
    if (filters.time_filter) {
      const timeDesc = filters.time_filter.type === "morning" ? "morning hours" :
                       filters.time_filter.type === "afternoon" ? "afternoon hours" :
                       filters.time_filter.type === "evening" ? "evening hours" : "specific hours";
      suggestions.push({ text: "Remove time filter", hint: `Currently filtering for ${timeDesc}` });
    }
    if (filters.max_miles) {
      suggestions.push({ text: "Increase or remove distance limit", hint: `Currently limited to ${filters.max_miles} miles` });
    }
    if (filters.zip_codes && filters.zip_codes.length > 0) {
      suggestions.push({ text: "Try a different or broader zip code area", hint: `Currently searching zip ${filters.zip_codes.join(", ")}` });
    }
    if (filters.neighborhood) {
      suggestions.push({ text: "Remove neighborhood filter", hint: `Currently filtering for ${filters.neighborhood}` });
    }
    if (filters.requirements_keywords && filters.requirements_keywords.length > 0) {
      suggestions.push({ text: "Remove requirements filter", hint: `Currently searching for "${filters.requirements_keywords.join(", ")}"` });
    }
    if (filters.county) {
      suggestions.push({ text: "Try searching without county filter", hint: `Currently limited to ${filters.county} County` });
    }
    if (filters.city && filters.city !== "Houston") {
      suggestions.push({ text: "Try expanding to Houston area", hint: `Currently limited to ${filters.city}` });
    }
    if (filters.assistance_types && filters.assistance_types.length === 1) {
      suggestions.push({ text: "Try a broader search term", hint: `Currently searching for "${filters.assistance_types[0]}" only` });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({ text: "Try broadening your search", hint: "Use fewer filters or a more general search term" });
  }

  return suggestions.slice(0, 4);
}

// ============ COMPONENT ============

export default function ResultsList({
  records = [],
  assistanceData = [],
  orgAssistanceMap = {},
  selectedIds = new Set(),
  onSelectionChange,
  searchKey = "",
  onFilteredCountChange,
}) {
  const { activeSearchMode, llmSearchFilters, llmSearchQuery, llmSearchInterpretation, clientCoordinates } = useAppData();
  const isDrivingDistance = !!clientCoordinates;

  // Sort/filter state
  const [state, dispatch] = useReducer(reducer, initialState);

  // Auto-reset when search parameters change
  const prevSearchKey = useRef(searchKey);
  useEffect(() => {
    if (searchKey !== prevSearchKey.current) {
      prevSearchKey.current = searchKey;
      dispatch({ type: "RESET_ALL" });
    }
  }, [searchKey]);

  // Determine if any filter or sort is active (for Reset button and funnel color)
  const hasActiveState = state.sortColumn !== null ||
    state.filterOrganization !== "" ||
    state.filterDay !== "" ||
    state.filterRequirements !== "";

  const hasActiveFilters = state.filterOrganization !== "" ||
    state.filterDay !== "" ||
    state.filterRequirements !== "";

  // Pipeline: filter → sort
  const filteredRecords = useMemo(
    () => filterRecords(records, state.filterOrganization, state.filterDay, state.filterRequirements),
    [records, state.filterOrganization, state.filterDay, state.filterRequirements]
  );

  const sortedRecords = useMemo(
    () => sortRecords(filteredRecords, state.sortColumn, state.sortDirection),
    [filteredRecords, state.sortColumn, state.sortDirection]
  );

  // Report filtered count back to parent (exclude inactive to match NavBar1 convention)
  const activeFilteredCount = useMemo(
    () => filteredRecords.filter(r => r.status_id !== 3).length,
    [filteredRecords]
  );
  useEffect(() => {
    // Only override count when inline filters are active; null = use parent's default
    onFilteredCountChange?.(hasActiveFilters ? activeFilteredCount : null);
  }, [activeFilteredCount, hasActiveFilters, onFilteredCountChange]);

  // Handlers
  const handleSort = useCallback((column) => {
    dispatch({ type: "TOGGLE_SORT", column });
  }, []);

  const handleToggleFilterRow = useCallback(() => {
    if (state.filterRowVisible) {
      // Closing: reset all filters and hide
      dispatch({ type: "RESET_ALL" });
    } else {
      dispatch({ type: "TOGGLE_FILTER_ROW" });
    }
  }, [state.filterRowVisible]);

  const handleSelect = (id, isSelected) => {
    const newSelectedIds = new Set(selectedIds);
    if (isSelected) {
      newSelectedIds.add(id);
    } else {
      newSelectedIds.delete(id);
    }
    onSelectionChange?.(newSelectedIds);
  };

  const getAssistanceInfo = (record) => {
    const assistanceType = assistanceData.find((ad) => ad.assistance === record.assistance);
    return {
      icon: assistanceType?.icon || null,
      label: assistanceType?.assistance || record.assistance,
    };
  };

  const suggestions = useMemo(() =>
    getZeroResultsSuggestions(llmSearchFilters, activeSearchMode),
    [llmSearchFilters, activeSearchMode]
  );

  // Zero results (after all filters applied)
  if (sortedRecords.length === 0) {
    const isLLMSearch = activeSearchMode === "llm";
    const hasInlineFilters = hasActiveFilters;

    return (
      <div className="flex-1 flex flex-col lg:overflow-hidden">
        {/* Header + filter row always render */}
        <ResultsHeader
          sortColumn={state.sortColumn}
          sortDirection={state.sortDirection}
          onSort={handleSort}
          filterRowVisible={state.filterRowVisible}
          onToggleFilterRow={handleToggleFilterRow}
          hasActiveFilters={hasActiveFilters}
        />
        {state.filterRowVisible && (
          <FilterRow
            filterOrganization={state.filterOrganization}
            filterDay={state.filterDay}
            filterRequirements={state.filterRequirements}
            onFilterOrganizationChange={(v) => dispatch({ type: "SET_FILTER_ORGANIZATION", value: v })}
            onFilterDayChange={(v) => dispatch({ type: "SET_FILTER_DAY", value: v })}
            onFilterRequirementsChange={(v) => dispatch({ type: "SET_FILTER_REQUIREMENTS", value: v })}
            onClearFilter={(field) => dispatch({ type: "CLEAR_FILTER", field })}
          />
        )}

        <div className="flex-1 flex items-center justify-center text-gray-500 font-body">
          <div className="text-center max-w-lg px-4">
            {hasInlineFilters && records.length > 0 ? (
              <>
                <p className="text-xl font-semibold text-gray-700">No Matching Results</p>
                <p className="text-sm mt-2 text-gray-500">
                  Your filters narrowed {records.length} results to 0. Try adjusting or clearing your filters.
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold text-gray-700">No Results Found</p>
                {isLLMSearch && llmSearchInterpretation && (
                  <p className="text-sm mt-2 italic text-gray-500">
                    Searched for: &ldquo;{llmSearchInterpretation}&rdquo;
                  </p>
                )}
                {suggestions.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-gray-600 mb-3">Suggestions to find more results:</p>
                    <ul className="text-left space-y-2">
                      {suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-teal-600 font-bold">&bull;</span>
                          <div>
                            <span className="text-gray-700">{suggestion.text}</span>
                            {suggestion.hint && (
                              <span className="text-xs text-gray-400 block">{suggestion.hint}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {isLLMSearch && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-400 mb-2">Example searches:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {["food pantry", "rent help", "medical clinic", "job training"].map((example) => (
                        <span key={example} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:overflow-hidden">
      {/* Fixed header + filter row */}
      <ResultsHeader
        sortColumn={state.sortColumn}
        sortDirection={state.sortDirection}
        onSort={handleSort}
        filterRowVisible={state.filterRowVisible}
        onToggleFilterRow={handleToggleFilterRow}
        hasActiveFilters={hasActiveFilters}
      />
      {state.filterRowVisible && (
        <FilterRow
          filterOrganization={state.filterOrganization}
          filterDay={state.filterDay}
          filterRequirements={state.filterRequirements}
          onFilterOrganizationChange={(v) => dispatch({ type: "SET_FILTER_ORGANIZATION", value: v })}
          onFilterDayChange={(v) => dispatch({ type: "SET_FILTER_DAY", value: v })}
          onFilterRequirementsChange={(v) => dispatch({ type: "SET_FILTER_REQUIREMENTS", value: v })}
          onClearFilter={(field) => dispatch({ type: "CLEAR_FILTER", field })}
          onResetAll={() => dispatch({ type: "RESET_ALL" })}
          hasActiveState={hasActiveState}
        />
      )}

      {/* Scrollable result rows */}
      <div className="flex-1 overflow-y-auto">
        {sortedRecords.map((record, index) => {
          const assistanceInfo = getAssistanceInfo(record);
          return (
            <ResultRow
              key={record.id}
              record={record}
              isSelected={selectedIds.has(record.id)}
              onSelect={handleSelect}
              assistanceIcon={assistanceInfo.icon}
              assistanceLabel={assistanceInfo.label}
              allAssistanceTypes={assistanceData}
              orgAssistanceMap={orgAssistanceMap}
              rowIndex={index}
              isDrivingDistance={isDrivingDistance}
            />
          );
        })}
      </div>
    </div>
  );
}
