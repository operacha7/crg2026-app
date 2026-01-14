// src/components/ResultsList.js
// Scrollable list of result rows
// Handles sorting by assistance id_no, status_id, then miles

import { useMemo } from "react";
import ResultRow from "./ResultRow";

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

export default function ResultsList({
  records = [],
  assistanceData = [],
  orgAssistanceMap = {}, // org name → array of assist_ids
  selectedIds = new Set(),
  onSelectionChange,
}) {
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

  if (sortedRecords.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 font-body">
        <div className="text-center">
          <p className="text-xl font-semibold">No Results Found</p>
          <p className="text-sm mt-2">Try adjusting your search criteria</p>
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
          />
        );
      })}
    </div>
  );
}
