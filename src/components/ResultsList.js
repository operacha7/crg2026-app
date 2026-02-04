// src/components/ResultsList.js
// Scrollable list of result rows
// Handles sorting by assistance id_no, status_id, then miles

import { useMemo } from "react";
import ResultRow from "./ResultRow";
import { useAppData } from "../Contexts/AppDataContext";

// Sort records by: 1) status_id, 2) assist_id, 3) miles (all ascending)
function sortRecords(records) {
  return [...records].sort((a, b) => {
    // 1. Sort by status_id (1=Active, 2=Limited, 3=Inactive)
    const aStatusId = a.status_id || 999;
    const bStatusId = b.status_id || 999;
    if (aStatusId !== bStatusId) {
      return aStatusId - bStatusId;
    }

    // 2. Sort by assist_id (text field, convert to number for sorting)
    const aAssistId = parseInt(a.assist_id, 10) || 999;
    const bAssistId = parseInt(b.assist_id, 10) || 999;
    if (aAssistId !== bAssistId) {
      return aAssistId - bAssistId;
    }

    // 3. Sort by miles/distance
    const aMiles = a.distance ?? Infinity;
    const bMiles = b.distance ?? Infinity;
    return aMiles - bMiles;
  });
}

/**
 * Generate helpful suggestions when zero results are found
 */
function getZeroResultsSuggestions(filters, searchMode) {
  const suggestions = [];

  if (searchMode === "llm" && filters) {
    // Analyze what filters are applied and suggest removing restrictive ones
    if (filters.days && filters.days.length > 0) {
      suggestions.push({
        text: "Remove day filter",
        hint: `Currently filtering for ${filters.days.join(", ")}`,
      });
    }
    if (filters.time_filter) {
      const timeDesc = filters.time_filter.type === "morning" ? "morning hours" :
                       filters.time_filter.type === "afternoon" ? "afternoon hours" :
                       filters.time_filter.type === "evening" ? "evening hours" : "specific hours";
      suggestions.push({
        text: "Remove time filter",
        hint: `Currently filtering for ${timeDesc}`,
      });
    }
    if (filters.max_miles) {
      suggestions.push({
        text: "Increase or remove distance limit",
        hint: `Currently limited to ${filters.max_miles} miles`,
      });
    }
    if (filters.zip_codes && filters.zip_codes.length > 0) {
      suggestions.push({
        text: "Try a different or broader zip code area",
        hint: `Currently searching zip ${filters.zip_codes.join(", ")}`,
      });
    }
    if (filters.neighborhood) {
      suggestions.push({
        text: "Remove neighborhood filter",
        hint: `Currently filtering for ${filters.neighborhood}`,
      });
    }
    if (filters.requirements_keywords && filters.requirements_keywords.length > 0) {
      suggestions.push({
        text: "Remove requirements filter",
        hint: `Currently searching for "${filters.requirements_keywords.join(", ")}"`,
      });
    }
    if (filters.county) {
      suggestions.push({
        text: "Try searching without county filter",
        hint: `Currently limited to ${filters.county} County`,
      });
    }
    if (filters.city && filters.city !== "Houston") {
      suggestions.push({
        text: "Try expanding to Houston area",
        hint: `Currently limited to ${filters.city}`,
      });
    }

    // If we have assistance types, suggest related types
    if (filters.assistance_types && filters.assistance_types.length === 1) {
      suggestions.push({
        text: "Try a broader search term",
        hint: `Currently searching for "${filters.assistance_types[0]}" only`,
      });
    }
  }

  // Always add a generic suggestion if we don't have specific ones
  if (suggestions.length === 0) {
    suggestions.push({
      text: "Try broadening your search",
      hint: "Use fewer filters or a more general search term",
    });
  }

  return suggestions.slice(0, 4); // Max 4 suggestions
}

export default function ResultsList({
  records = [],
  assistanceData = [],
  orgAssistanceMap = {}, // org name → array of assist_ids
  selectedIds = new Set(),
  onSelectionChange,
}) {
  // Get search context for zero-results guidance and driving distance indicator
  const { activeSearchMode, llmSearchFilters, llmSearchQuery, llmSearchInterpretation, clientCoordinates } = useAppData();

  // Determine if we're showing driving distances (vs Haversine)
  const isDrivingDistance = !!clientCoordinates;
  // Sort records
  const sortedRecords = useMemo(
    () => sortRecords(records),
    [records]
  );

  // Handle individual row selection
  const handleSelect = (id, isSelected) => {
    const newSelectedIds = new Set(selectedIds);
    if (isSelected) {
      newSelectedIds.add(id);
    } else {
      newSelectedIds.delete(id);
    }
    onSelectionChange?.(newSelectedIds);
  };

  // Get assistance info for a record (icon and label for tooltip)
  const getAssistanceInfo = (record) => {
    const assistanceType = assistanceData.find((ad) => ad.assistance === record.assistance);
    return {
      icon: assistanceType?.icon || null,
      label: assistanceType?.assistance || record.assistance,
    };
  };

  // Generate suggestions for zero results
  const suggestions = useMemo(() =>
    getZeroResultsSuggestions(llmSearchFilters, activeSearchMode),
    [llmSearchFilters, activeSearchMode]
  );

  if (sortedRecords.length === 0) {
    const isLLMSearch = activeSearchMode === "llm";

    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 font-body">
        <div className="text-center max-w-lg px-4">
          <p className="text-xl font-semibold text-gray-700">No Results Found</p>

          {/* Show the interpreted query for LLM search */}
          {isLLMSearch && llmSearchInterpretation && (
            <p className="text-sm mt-2 italic text-gray-500">
              Searched for: "{llmSearchInterpretation}"
            </p>
          )}

          {/* Suggestions to broaden search */}
          {suggestions.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-600 mb-3">
                Suggestions to find more results:
              </p>
              <ul className="text-left space-y-2">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold">•</span>
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

          {/* Example searches for LLM mode */}
          {isLLMSearch && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400 mb-2">Example searches:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["food pantry", "rent help", "medical clinic", "job training"].map((example) => (
                  <span
                    key={example}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                  >
                    {example}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
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
  );
}
