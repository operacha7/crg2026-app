// src/components/AssistanceSidebar.js
import React from "react";
import { X } from "lucide-react";
import { getMainAssistance } from "./AssistanceTypes"; // Updated import
import { useTranslate } from "../Utility/Translate";

export default function AssistanceSidebar({
  sidebarRef,
  assistanceTypes,
  selectedMore,
  toggleMore,
  clearMore,
  onClose,
}) {
  
  const { translate } = useTranslate();
  
  // Get main assistance types dynamically
  const mainAssistance = getMainAssistance(assistanceTypes);
  
  // Add console logs to debug
  console.log("AssistanceSidebar - assistanceTypes:", assistanceTypes);
  console.log("AssistanceSidebar - mainAssistance:", mainAssistance);
  console.log("AssistanceSidebar - selectedMore:", selectedMore);
  
  // Make sure we have valid data to work with
  const validAssistanceTypes = Array.isArray(assistanceTypes) ? assistanceTypes : [];
  
  // Filter out main assistance types - new version for the new structure
  const moreAssistanceTypes = validAssistanceTypes.filter(item => 
    item && item.main === false
  );
  
  console.log("AssistanceSidebar - filtered types:", moreAssistanceTypes);

  return (
    <div
      ref={sidebarRef}
      role="dialog"
      aria-modal="true"
      className="fixed top-0 right-0 h-screen max-h-screen w-72 sm:w-80 bg-white shadow-xl z-50 flex flex-col overflow-hidden"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }}
    >
      <div className="flex justify-between items-center px-4 py-3 border-b sticky top-0 bg-white z-10">
        <h2 className="text-lg font-bold">{translate("tMoreAssistance")}</h2>
        <X className="w-5 h-5 cursor-pointer" onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-scroll px-4 py-3 pr-5">
        {moreAssistanceTypes.length > 0 ? (
          moreAssistanceTypes.map((item, i) => {
            // With the new structure, displayText and value are simpler
            const displayText = item.assistance;
            const value = item.assistance;
            
            const isSelected = selectedMore.includes(value);
            
            return (
              <label key={i} className="block mb-2 py-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleMore(value)}
                  className="mr-2"
                />
                {displayText}
              </label>
            );
          })
        ) : (
          <p>{translate("tNoAdditionalAssistance")}</p>
        )}
      </div>
      <div className="px-4 py-3 border-t sticky bottom-0 bg-white">
        <button
          onClick={clearMore}
          className="text-lg text-blue-600 hover:underline"
        >
          {translate("tClearAll")}
        </button>
      </div>
    </div>
  );
}