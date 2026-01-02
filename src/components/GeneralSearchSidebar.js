// src/components/GeneralSearchSidebar.js
import React from "react";
import { useTranslate } from "../Utility/Translate";
import { useLanguage } from "../Contexts/LanguageContext";

export default function GeneralSearchSidebar({
  sidebarRef,
  showSidebar,
  setShowSidebar,
  zip_codes,
  assistanceTypes,
  daysOfWeek,
  selectedZip,
  setSelectedZip,
  selectedAssist,
  setSelectedAssist,
  selectedDay,
  setSelectedDay,
  clearAllFilters,
}) {
  const { translate } = useTranslate();
  const { language } = useLanguage();

  console.log("GeneralSearchSidebar received zip_codes:", zip_codes);
  
  if (!showSidebar) return null;

  return (
    <div
      ref={sidebarRef}
      className="fixed right-0 top-0 h-full w-80 bg-[#f9f9f6] shadow-xl z-50 p-4 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{translate("tFilters")}</h2>
        <button
          onClick={() => setShowSidebar(false)}
          className="text-gray-600 text-2xl hover:text-black"
        >
          &times;
        </button>
      </div>

            {/* Zip Code Filter */}
            <div className="mb-4">
        <label className="block text-sm font-medium mb-1">{translate("tZipCode")}</label>
        <select
          value={selectedZip || ""}
          onChange={(e) => setSelectedZip(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1"
        >
          <option value="">{translate("tAllZipCodes")}</option>
          {Array.isArray(zip_codes) && zip_codes.map((zipObj, idx) => (
            <option key={idx} value={zipObj.zip_code}>
              {zipObj.zip_code}
            </option>
          ))}
        </select>
      </div>

      {/* Assistance Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">{translate("tAssistance")}</label>
        <select
          value={selectedAssist || ""}
          onChange={(e) => setSelectedAssist(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1"
        >
          <option value="">{translate("tAllAssistance")}</option>
          {Array.isArray(assistanceTypes) && assistanceTypes.map((type, index) => (
            <option key={index} value={type.assistance}>
              {type.assistance}
            </option>
          ))}
        </select>
      </div>

      {/* Day of Week Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">{translate("tDayOfOperation")}</label>
        <select
          value={selectedDay || ""}
          onChange={(e) => setSelectedDay(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1"
        >
          <option value="">{translate("tAllDays")}</option>
          {Array.isArray(daysOfWeek) && daysOfWeek.map((day, index) => {
            if (day && typeof day === 'object' && day.en) {
              return (
                <option key={`day-${index}`} value={day.en}>
                  {language === "Español" ? day.es : day.en}
                </option>
              );
            } else {
              return (
                <option key={`day-${index}`} value={day}>
                  {day}
                </option>
              );
            }
          })}
        </select>
      </div>

      {/* Clear Filters */}
      <button
        onClick={clearAllFilters}
        className="mt-4 text-lg text-blue-600 hover:underline"
      >
        {translate("tClearAll")}
      </button>
    </div>
  );
}