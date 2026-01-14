// src/components/SearchResults.js
import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Phone, Globe, MapPin, Clock, Info, CheckCircle, Navigation } from "lucide-react";

export default function SearchResults({
  filtered = [],
  expandedRows = {},
  rowRefs = { current: {} },
  toggleExpand,
  selectedRows = [],
  setSelectedRows,
}) {

  // Toggle row selection
  const toggleRow = (index) => {
    setSelectedRows((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const [activeTooltip, setActiveTooltip] = useState(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setActiveTooltip(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getStatusColor = (status) => {
    // Convert to uppercase for case-insensitive comparison
    const upperStatus = status?.toUpperCase() || '';
    
    // Check for open/abierto
    if (upperStatus === "ACTIVE" || upperStatus === "ACTIVO") {
      return "bg-[#8fbc8f]";
    }
    
    // Check for limited/limitado
    if (upperStatus === "LIMITED" || upperStatus === "LIMITADO") {
      return "bg-[#ffda6a]";
    }
    
    // Check for closed/cerrado
    if (upperStatus === "INACTIVE" || upperStatus === "INACTIVO") {
      return "bg-[#e74c3c]";
    }
    
    // Default case (null/empty status)
    return "bg-gray-300";
  };

  // Get the checkbox classes based on status and selection
  const getCheckboxClasses = (status, isSelected) => {
    const baseClasses = "transition-all duration-200";
    
    if (!isSelected) {
      return baseClasses; // Default checkbox appearance when not selected
    }
    
    // When selected, use the status color
    const upperStatus = status?.toUpperCase() || '';
    
    if (upperStatus === "ACTIVE" || upperStatus === "ACTIVO") {
      return `${baseClasses} !bg-[#8fbc8f] !border-[#8fbc8f] accent-[#8fbc8f]`;
    }
    
    if (upperStatus === "LIMITED" || upperStatus === "LIMITADO") {
      return `${baseClasses} !bg-[#ffda6a] !border-[#ffda6a] accent-[#ffda6a]`;
    }
    
    if (upperStatus === "INACTIVE" || upperStatus === "INACTIVO") {
      return `${baseClasses} !bg-[#e74c3c] !border-[#e74c3c] accent-[#e74c3c]`;
    }
    
    // Default case (null/empty status)
    return `${baseClasses} !bg-gray-300 !border-gray-300 accent-gray-300`;
  };

  const formatTooltip = (date, text) => (
    <div className="text-xs whitespace-pre-line">
      {date && <div>{date}</div>}
      {text && <div>{text}</div>}
    </div>
  );

  // Format distance for display
  const formatDistance = (distance) => {
    if (distance === null || distance === undefined) return ""; // Blank for null/empty coordinates
    return `${distance} mi`;
  };

  // Mobile card view for each result
  const renderMobileCard = (r, i) => {
    const hasTooltip = r.status_date || r.status_text;
    const showTooltip = activeTooltip === i;
    const status = r.status || (hasTooltip ? "" : null);
    const reqs = r.requirements?.split("\n").filter(Boolean) || [];
    const isSelected = selectedRows.includes(i);

    return (
      <div 
        key={i}
        className="bg-white border rounded-lg shadow-md mb-4 p-3 relative hover:shadow-lg hover:border-[#4A4E69] transition-all duration-200"
        ref={(el) => (rowRefs.current[i] = el)}
        data-index={i}
      >
        <div className="flex justify-between items-start mb-3">
          {/* Organization name */}
          <div className="font-medium text-[#4A4E69] flex-1">
            {r.webpage ? (
              <a
                href={r.webpage}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                {r.organization}
              </a>
            ) : (
              r.organization
            )}
          </div>
          
          {/* Distance and Checkbox */}
          <div className="flex items-center gap-2">
            {/* Distance */}
            {r.distance !== undefined && (
              <div className="flex items-center gap-1 text-sm font-medium text-gray-600">
                <Navigation className="w-3 h-3" />
                <span>{formatDistance(r.distance)}</span>
              </div>
            )}
            
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleRow(i)}
              className={`h-5 w-5 rounded ${getCheckboxClasses(r.status, isSelected)}`}
            />
          </div>
        </div>
        
        {/* Status */}
        {status && (
          <div className="mb-3 relative w-full">
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium">Status:</span>
            </div>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex items-center gap-1 px-3 py-1 text-sm rounded ${getStatusColor(status)} hover:brightness-90 transition-transform duration-150`}
              onClick={() => hasTooltip && setActiveTooltip((prev) => (prev === i ? null : i))}
            >
              <span>{status}</span>
              {hasTooltip && <ChevronDown className="w-3 h-3" />}
            </button>
            {showTooltip && (
              <div
                ref={tooltipRef}
                className="absolute left-0 top-full mt-1 bg-white border text-black text-xs p-2 rounded shadow z-50 w-full"
              >
                {formatTooltip(r.status_date, r.status_text)}
              </div>
            )}
          </div>
        )}

        {/* Assistance type */}
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1">
            <Info className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium">Assistance:</span>
          </div>
          <div className="text-sm px-1">{r.assistance}</div>
        </div>
        
        {/* Address with icon */}
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1">
            <MapPin className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium">Address:</span>
          </div>
          <div className="text-sm px-1">
            {r.google_maps ? (
              <a
                href={r.google_maps}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline"
              >
                {r.address}
              </a>
            ) : (
              r.address
            )}
          </div>
        </div>
        
        {/* Phone with icon */}
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1">
            <Phone className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium">Telephone:</span>
          </div>
          <div className="text-sm px-1">{r.telephone}</div>
        </div>
        
        {/* Hours with icon */}
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium">Hours:</span>
          </div>
          <div className="text-sm px-1">
            <div>{r.hours}</div>
            {r.hours_notes && (
              <div className="text-sm bg-yellow-100 italic text-red-500 mt-1 p-1 rounded">{r.hours_notes}</div>
            )}
          </div>
        </div>
        
        {/* Requirements with expand/collapse */}
        {reqs.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1">
              <Globe className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium">Requirements:</span>
            </div>
            <div 
              className={`transition-all duration-300 ${
                expandedRows[i] ? "max-h-full" : "max-h-24 overflow-hidden"
              }`}
            >
              <ul className="list-disc pl-5 text-sm">
                {reqs.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
            {reqs.length > 2 && (
              <div
                className="w-full text-center cursor-pointer pt-1"
                onClick={() => toggleExpand(i)}
              >
                {expandedRows[i] ? (
                  <ChevronUp className="w-5 h-5 mx-auto text-blue-400 hover:text-red-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 mx-auto text-red-400 hover:text-blue-600" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Desktop view with table
  const renderDesktopTable = () => (
    <table className="w-full table-fixed border-collapse">
      <thead className="bg-[#4A4E69] text-white sticky top-0 z-10">
        <tr>
          <th className="p-0 w-[50px] text-[75%] font-normal">Email</th>
          <th className="p-0 w-[40px] text-[75%] font-normal">Dist</th>
          <th className="w-[17%] p-2 font-normal">Organization</th>
          <th className="w-[17%] p-2 font-normal">Address</th>
          <th className="w-[8%] p-2 font-normal">Telephone</th>
          <th className="w-[12%] p-2 font-normal">Hours</th>
          <th className="w-[7%] p-2 font-normal">Assistance</th>
          <th className="w-[5%] p-2 font-normal">Status</th>
          <th className="w-[29%] p-2 font-normal">Requirements</th>
          <th className="w-[3%] p-2 text-[75%] font-normal">Zip</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((r, i) => {
          const hasTooltip = r.status_date || r.status_text;
          const showTooltip = activeTooltip === i;
          const status = r.status || (hasTooltip ? "" : null);
          const isSelected = selectedRows.includes(i);

          // Split requirements into non-empty lines
          const reqs = r.requirements?.split("\n").filter(Boolean) || [];

          return (
            <tr
              key={i}
              className="align-top hover:bg-[#E6F3F3] hover:shadow-lg hover:border-[#4A4E69] border border-transparent transition-all duration-200"
              ref={(el) => (rowRefs.current[i] = el)}
              data-index={i}
            >
              {/* Checkbox with status color */}
              <td className="p-1 border text-center">
                <div className="record"></div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleRow(i)}
                  className={`mx-auto h-5 w-5 ${getCheckboxClasses(r.status, isSelected)}`}
                />
              </td>

              {/* Distance Column */}
              <td className="p-1 border text-center">
                <div className="text-xs font-medium text-gray-700">
                  {formatDistance(r.distance)}
                </div>
              </td>

              {/* Organization */}
              <td className="p-2 border">
                {r.webpage ? (
                  <a
                    href={r.webpage}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    {r.organization}
                  </a>
                ) : (
                  r.organization
                )}
              </td>

              {/* Address */}
              <td className="p-2 border">
                {r.google_maps ? (
                  <a
                    href={r.google_maps}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline"
                  >
                    {r.address}
                  </a>
                ) : (
                  r.address
                )}
              </td>

              {/* Telephone */}
              <td className="p-2 border">{r.telephone}</td>

              {/* Hours + Notes */}
              <td className="p-2 border">
                <div>{r.hours}</div>
                {r.hours_notes && (
                 <div className="text-me bg-[#fff7d6] italic text-red-600 px-1 mt-1">{r.hours_notes}</div>
                )}
              </td>

              {/* Assistance */}
              <td className="p-2 border">{r.assistance}</td>

              {/* Status + Tooltip */}
              <td className="p-1 border">
                <div className="relative w-full status">
                  {status ? (
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`w-full flex flex-col items-center gap-[1px] px-2 py-1 text-xs rounded ${getStatusColor(
                        status,
                      )} hover:brightness-90 hover:scale-[1.02] transition-transform duration-150 cursor-pointer`}
                      onClick={() =>
                        hasTooltip &&
                        setActiveTooltip((prev) => (prev === i ? null : i))
                      }
                    >
                      <span>{status}</span>
                      {hasTooltip && (
                        <ChevronDown className="w-3 h-3 ml-[0.1rem]" />
                      )}
                    </button>
                  ) : hasTooltip ? (
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-full flex justify-center items-center px-2 py-1 text-xs rounded bg-gray-300 hover:brightness-95 hover:scale-[1.02] transition-transform duration-150 cursor-pointer"
                      onClick={() =>
                        setActiveTooltip((prev) => (prev === i ? null : i))
                      }
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  ) : null}

                  {showTooltip && (
                    <div
                      ref={tooltipRef}
                      className="absolute left-0 top-full mt-1 bg-white border text-black text-xs p-2 rounded shadow z-50 w-48"
                    >
                      {formatTooltip(r.status_date, r.status_text)}
                    </div>
                  )}
                </div>
              </td>

              {/* Requirements with bullets */}
              <td className="p-2 pb-5 border relative">
              <div className="requirements"></div>
                {reqs.length > 0 && (
                  <div
                    className={`transition-all duration-300 ${
                      expandedRows[i]
                        ? "max-h-full overflow-visible"
                        : "max-h-24 overflow-hidden"
                    }`}
                  >
                    <ul className="list-disc pl-4">
                      {reqs.map((req, idx) => (
                        <li key={idx}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {reqs.length > 3 && (
                  <div
                    className="absolute bottom-0 left-0 w-full text-center cursor-pointer text-sm text-gray-500"
                    onClick={() => toggleExpand(i)}
                  >
                    {expandedRows[i] ? (
                      <ChevronUp className="w-6 h-6 mx-auto text-blue-400 hover:text-red-600" />
                    ) : (
                      <ChevronDown className="w-6 h-6 mx-auto text-red-400 hover:text-blue-600" />
                    )}
                  </div>
                )}
              </td>

              {/* Zip Codes - UPDATED to handle array format */}
              <td className="p-2 border text-[75%] relative">
                <div
                  className={`transition-all duration-300 ${
                    expandedRows[i]
                      ? "max-h-full overflow-visible"
                      : "max-h-[6rem] mb-5 overflow-hidden"
                  } whitespace-pre-line`}
                >
                  {/* Handle both array and string formats */}
                  {Array.isArray(r.zip_codes) 
                    ? r.zip_codes.join('\n')
                    : typeof r.zip_codes === 'string' 
                      ? r.zip_codes.replace(/, /g, '\n') 
                      : ''}
                </div>
                {(Array.isArray(r.zip_codes) 
                  ? r.zip_codes.length > 6 
                  : typeof r.zip_codes === 'string' && r.zip_codes.split(',').length > 6) && (
                  <div
                    className="absolute bottom-0 left-0 w-full text-center cursor-pointer text-sm text-gray-500"
                    onClick={() => toggleExpand(i)}
                  >
                    {expandedRows[i] ? (
                      <ChevronUp className="w-6 h-6 mx-auto text-blue-400 hover:text-red-600" />
                    ) : (
                      <ChevronDown className="w-6 h-6 mx-auto text-red-400 hover:text-blue-600" />
                    )}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
 
  return (
    <div className="min-w-full">
      {/* Conditionally render either mobile cards or desktop table based on screen size */}
      <div className="hidden md:block">
        {renderDesktopTable()}
      </div>
      
      <div className="md:hidden px-2">
        {filtered.map((r, i) => renderMobileCard(r, i))}
      </div>
    </div>
  );
}