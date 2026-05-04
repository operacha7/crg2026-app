// src/components/reports/CoverageReport.js
// Coverage Report (aka "The Matt Report") - shows which zip codes are served by
// organizations for a specific assistance type and status, highlighting
// "assistance deserts". All orgs now list real zip codes (the legacy 99999
// wildcard convention is gone), so there's no restricted/unrestricted split.
// Orgs are separated by " | " for readability.

import { useState, useEffect, useMemo } from "react";
import { useAppData } from "../../Contexts/AppDataContext";
import { fetchOrganizations } from "../../services/usageService";
import { matchesParentOrSubgroup } from "../../utils/orgFilters";

// Sort arrow indicator
function SortArrow({ active, direction }) {
  return (
    <span style={{ marginLeft: "4px", fontSize: "12px", opacity: active ? 1 : 0.4 }}>
      {direction === "asc" ? "▲" : "▼"}
    </span>
  );
}

export default function CoverageReport({
  county,
  zipCode,
  parentOrg,
  childOrg,
  assistanceType,
  status,
  displayFilter,
  onSummaryChange,
  onDisplayDataChange,
}) {
  // Sort state: column (zip or county) and direction
  const [sortBy, setSortBy] = useState("zip");
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  };
  const { directory, assistance, zipCodes } = useAppData();
  const [regOrgs, setRegOrgs] = useState([]);

  // Fetch registered organizations for color mapping
  useEffect(() => {
    async function loadRegOrgs() {
      const orgs = await fetchOrganizations();
      setRegOrgs(orgs);
    }
    loadRegOrgs();
  }, []);

  // Build org name -> color map from registered organizations
  const orgColorMap = useMemo(() => {
    const map = {};
    regOrgs.forEach(org => {
      if (org.org_color) {
        map[org.reg_organization] = org.org_color;
      }
    });
    return map;
  }, [regOrgs]);

  // Build set of registered org names for bold styling
  const registeredOrgNames = useMemo(() => {
    return new Set(regOrgs.map(org => org.reg_organization));
  }, [regOrgs]);

  // Map status name to status_id
  const statusId = useMemo(() => {
    switch (status) {
      case "Active": return 1;
      case "Limited": return 2;
      case "Inactive": return 3;
      default: return 1;
    }
  }, [status]);

  // Map assistance name to assist_id
  const assistId = useMemo(() => {
    if (!assistanceType) return null;
    const match = assistance.find(a => a.assistance === assistanceType);
    return match ? match.assist_id : null;
  }, [assistanceType, assistance]);

  // Filter directory records by selected filters
  const filteredDirectory = useMemo(() => {
    if (!assistId) return [];

    return directory.filter(record => {
      if (record.assist_id !== assistId) return false;
      if (record.status_id !== statusId) return false;
      if (parentOrg) {
        // parentOrg may be a real parent or a subgroup (e.g., "District 4")
        if (!matchesParentOrSubgroup(record, parentOrg)) return false;
      }
      if (childOrg) {
        if (record.organization !== childOrg) return false;
      }
      return true;
    });
  }, [directory, assistId, statusId, parentOrg, childOrg]);

  // Get Houston-area zip codes, optionally filtered by county and/or specific zip code
  const houstonZipCodes = useMemo(() => {
    let filtered = zipCodes.filter(z => z.houston_area === "Y");
    if (zipCode) {
      // Specific zip code selected - show only that row
      filtered = filtered.filter(z => z.zip_code === zipCode);
    } else if (county && county !== "All Counties") {
      filtered = filtered.filter(z => z.county === county);
    }
    return filtered.sort((a, b) => a.zip_code.localeCompare(b.zip_code));
  }, [zipCodes, county, zipCode]);

  // Build zip -> Set of org names map in one pass for efficiency
  const zipToOrgsMap = useMemo(() => {
    const map = new Map();
    filteredDirectory.forEach(record => {
      const zips = record.client_zip_codes || [];
      zips.forEach(zip => {
        if (!map.has(zip)) map.set(zip, new Set());
        map.get(zip).add(record.organization);
      });
    });
    return map;
  }, [filteredDirectory]);

  // Build coverage data for each Houston-area zip code
  const coverageData = useMemo(() => {
    const data = houstonZipCodes.map(zipRecord => {
      const orgSet = zipToOrgsMap.get(zipRecord.zip_code) || new Set();
      const allOrgs = [...orgSet].sort((a, b) => a.localeCompare(b));

      return {
        zipCode: zipRecord.zip_code,
        county: zipRecord.county || "",
        count: allOrgs.length,
        organizations: allOrgs,
      };
    });

    // Sort by zip or county, with direction
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "county") {
      data.sort((a, b) => (a.county.localeCompare(b.county) || a.zipCode.localeCompare(b.zipCode)) * dir);
    } else {
      data.sort((a, b) => a.zipCode.localeCompare(b.zipCode) * dir);
    }

    return data;
  }, [houstonZipCodes, zipToOrgsMap, sortBy, sortDir]);

  // Apply display filter (covered / no-coverage / all)
  const displayData = useMemo(() => {
    if (displayFilter === "covered") {
      return coverageData.filter(row => row.count > 0);
    }
    if (displayFilter === "no-coverage") {
      return coverageData.filter(row => row.count === 0);
    }
    return coverageData;
  }, [coverageData, displayFilter]);

  // Summary stats - pass up to NavBar3
  const totalZips = coverageData.length;
  const zipsWithCoverage = coverageData.filter(z => z.count > 0).length;
  const zipsWithoutCoverage = totalZips - zipsWithCoverage;
  // Unique organizations across the currently-filtered rows (what the user sees)
  const uniqueOrgCount = useMemo(() => {
    const names = new Set();
    displayData.forEach(z => z.organizations.forEach(org => names.add(org)));
    return names.size;
  }, [displayData]);

  useEffect(() => {
    if (onSummaryChange) {
      onSummaryChange({
        totalZips,
        zipsWithCoverage,
        zipsWithoutCoverage,
        uniqueOrgCount,
      });
    }
  }, [totalZips, zipsWithCoverage, zipsWithoutCoverage, uniqueOrgCount, onSummaryChange]);

  // Pass display data up for download
  useEffect(() => {
    if (onDisplayDataChange) {
      onDisplayDataChange(displayData);
    }
  }, [displayData, onDisplayDataChange]);

  // If no assistance type selected, show prompt
  if (!assistanceType) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-500 font-opensans" style={{ fontSize: "16px" }}>
          Select an Assistance Type to view coverage data
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr style={{ backgroundColor: "#B8001F" }}>
            <th
              className="text-left py-2 font-opensans font-semibold text-sm text-white select-none"
              style={{ backgroundColor: "#B8001F", paddingLeft: "10px", width: "70px", whiteSpace: "nowrap", cursor: "pointer" }}
              onClick={() => handleSort("zip")}
              title="Sort by Zip Code"
            >
              Zip <SortArrow active={sortBy === "zip"} direction={sortBy === "zip" ? sortDir : "asc"} />
            </th>
            <th
              className="text-left py-2 px-2 font-opensans font-semibold text-sm text-white select-none"
              style={{ backgroundColor: "#B8001F", width: "100px", whiteSpace: "nowrap", cursor: "pointer" }}
              onClick={() => handleSort("county")}
              title="Sort by County"
            >
              County <SortArrow active={sortBy === "county"} direction={sortBy === "county" ? sortDir : "asc"} />
            </th>
            <th
              className="text-center py-2 px-2 font-opensans font-semibold text-sm text-white"
              style={{ backgroundColor: "#B8001F", width: "60px" }}
            >
              Count
            </th>
            <th
              className="text-left py-2 px-4 font-opensans font-semibold text-sm text-white"
              style={{ backgroundColor: "#B8001F" }}
            >
              Organizations
            </th>
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, idx) => (
            <tr
              key={row.zipCode}
              style={{
                backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#F5F5F5",
              }}
              className="hover:!bg-[#f2f3cc] transition-colors duration-150"
            >
              <td className="py-2 font-opensans text-sm font-semibold" style={{ color: "#222831", paddingLeft: "10px" }}>
                {row.zipCode}
              </td>
              <td className="py-2 px-2 font-opensans text-sm" style={{ color: "#222831" }}>
                {row.county}
              </td>
              <td
                className="text-center py-2 px-2 font-opensans text-sm font-semibold"
                style={{ color: row.count === 0 ? "#B8001F" : "#222831" }}
              >
                {row.count}
              </td>
              <td className="py-2 px-4 font-opensans text-sm" style={{ lineHeight: "1.6" }}>
                {row.organizations.map((org, orgIdx) => {
                  const color = orgColorMap[org];
                  const isRegistered = registeredOrgNames.has(org);
                  return (
                    <span key={org}>
                      {color ? (
                        <span
                          style={{
                            backgroundColor: color,
                            padding: "1px 6px",
                            borderRadius: "3px",
                            fontWeight: isRegistered ? 700 : 400,
                          }}
                        >
                          {org}
                        </span>
                      ) : (
                        <span style={{ fontWeight: isRegistered ? 700 : 400 }}>
                          {org}
                        </span>
                      )}
                      {orgIdx < row.organizations.length - 1 && (
                        <span style={{ color: "#CCCCCC", margin: "0 4px" }}>|</span>
                      )}
                    </span>
                  );
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
