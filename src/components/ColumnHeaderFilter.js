// src/components/ColumnHeaderFilter.js
// Reusable column header with popover filter: sort, search, multi-select checkboxes.
// Renders as a <th> that opens a dropdown when clicked.

import React, { useState, useRef, useEffect, useCallback } from "react";
import SortIcon from "../icons/SortIcons";

export default function ColumnHeaderFilter({
  label,
  values = [],
  selectedValues,       // Set or null (null = all selected)
  onSelectionChange,    // fn(Set or null)
  sortActive = false,
  sortDirection = "asc",
  onSort,               // fn("asc" | "desc")
  style = {},
  thStyle = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const popoverRef = useRef(null);
  const thRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        thRef.current && !thRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchText("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const isFiltered = selectedValues !== null;
  const activeSet = selectedValues || new Set(values);

  const filteredValues = searchText
    ? values.filter((v) => v.toLowerCase().includes(searchText.toLowerCase()))
    : values;

  const handleToggle = useCallback((val) => {
    const next = new Set(activeSet);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    // If all are selected again, revert to null (no filter)
    onSelectionChange(next.size === values.length ? null : next);
  }, [activeSet, values, onSelectionChange]);

  const handleAll = useCallback(() => {
    onSelectionChange(null);
  }, [onSelectionChange]);

  const handleNone = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const handleClear = useCallback(() => {
    onSelectionChange(null);
  }, [onSelectionChange]);

  // Parse label for line breaks (supports "|" as line break like existing headers)
  const labelParts = label.split("|").map((s) => s.trim());

  return (
    <th
      ref={thRef}
      style={{
        position: "relative",
        cursor: "pointer",
        userSelect: "none",
        ...thStyle,
        overflow: "visible",
      }}
      onClick={() => {
        setIsOpen((prev) => !prev);
        if (!isOpen) setSearchText("");
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
        <span>
          {labelParts.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {part}
            </React.Fragment>
          ))}
        </span>
        {/* Sort indicator — shared SortIcon pattern (bars when inactive, arrow when active) */}
        <SortIcon active={sortActive} direction={sortDirection} size={12} />
        {/* Filter funnel icon: dim when no filter, solid gold when filter active */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          style={{
            marginLeft: "3px",
            fill: isFiltered ? "#FFC857" : "rgba(255,255,255,0.4)",
            transition: "fill 0.2s",
            flexShrink: 0,
          }}
          title={isFiltered ? "Filter active" : "Click to filter"}
        >
          <path d="M1 2h14l-5.5 6.5V14l-3-2v-3.5z" />
        </svg>
      </span>

      {isOpen && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 100,
            width: "280px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #D0D0D0",
            borderRadius: "6px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            fontWeight: 400,
            fontSize: "14px",
            color: "#333",
            ...style,
          }}
        >
          {/* Sort controls */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              padding: "10px 14px 8px",
              borderBottom: "1px solid #E8E8E8",
            }}
          >
            <button
              onClick={() => onSort && onSort("asc")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                color: sortActive && sortDirection === "asc" ? "#005C72" : "#666",
                fontWeight: sortActive && sortDirection === "asc" ? 600 : 400,
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ fontSize: "12px" }}>&#8593;</span> A&#8594;Z
            </button>
            <button
              onClick={() => onSort && onSort("desc")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                color: sortActive && sortDirection === "desc" ? "#005C72" : "#666",
                fontWeight: sortActive && sortDirection === "desc" ? 600 : 400,
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ fontSize: "12px" }}>&#8595;</span> Z&#8594;A
            </button>
          </div>

          {/* FILTER label + Clear */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 14px 4px",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: "13px", letterSpacing: "0.5px" }}>
              FILTER
            </span>
            <button
              onClick={handleClear}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: "#888",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: 0,
              }}
            >
              &#8635; Clear
            </button>
          </div>

          {/* Search input */}
          <div style={{ padding: "4px 14px 8px" }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                padding: "7px 10px",
                border: "1px solid #D0D0D0",
                borderRadius: "4px",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* All / None */}
          <div style={{ padding: "0 14px 6px", display: "flex", gap: "12px" }}>
            <button
              onClick={handleAll}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: "#1a73e8",
                padding: 0,
                fontWeight: 500,
              }}
            >
              All
            </button>
            <button
              onClick={handleNone}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: "#333",
                padding: 0,
                fontWeight: 500,
              }}
            >
              None
            </button>
          </div>

          {/* Scrollable checklist */}
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              borderTop: "1px solid #E8E8E8",
              padding: "4px 0",
            }}
          >
            {filteredValues.length === 0 && (
              <div style={{ padding: "10px 14px", color: "#999", fontSize: "13px" }}>
                No matches
              </div>
            )}
            {filteredValues.map((val) => (
              <label
                key={val}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "5px 14px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F5F5F5"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <input
                  type="checkbox"
                  checked={activeSet.has(val)}
                  onChange={() => handleToggle(val)}
                  style={{ width: "16px", height: "16px", accentColor: "#005C72" }}
                />
                {val}
              </label>
            ))}
          </div>
        </div>
      )}
    </th>
  );
}
