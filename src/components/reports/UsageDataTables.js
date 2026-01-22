// src/components/reports/UsageDataTables.js
// Usage Data Tables report
// Three sections: Communications, Search, Assistance
// Columns: dates + Da/Mo + Mo/Yr percentages

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../MainApp";
import { fetchDailyUsage, fetchMonthlyUsage } from "../../services/usageService";
import VerticalLineIcon from "../../icons/VerticalLineIcon";

// Assistance types in order by assist_id (from assistance table)
const ASSISTANCE_TYPES = [
  "Rent", "Utilities", "Food", "Clothing",
  "Homeless - Shelters", "Homeless - Day Centers", "Homeless - Other", "Housing",
  "Medical - Primary Care", "Medical - Equipment", "Medical - Mental Health",
  "Medical - Addiction Recovery", "Medical - Program Enrollment", "Medical - Bill Payment",
  "Domestic Abuse - Shelters", "Domestic Abuse - Other", "Education - Children", "Childcare",
  "Education - Adults", "Jobs", "Transportation", "Legal", "Immigration",
  "Seniors", "Handyman", "Animals", "Christmas", "Other"
];

// Search modes
const SEARCH_MODES = ["Zip Code", "Organization", "Location", "Ask a Question"];

// Communication actions
const COMMUNICATION_ACTIONS = ["Send Email", "Create PDF"];

export default function UsageDataTables({ selectedOrg, viewMode }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data
  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const params = {
        reg_organization: selectedOrg === "All Organizations" ? null : selectedOrg,
      };

      let result;
      if (viewMode === "daily") {
        result = await fetchDailyUsage({ ...params, days: 30 });
      } else {
        result = await fetchMonthlyUsage({ ...params, months: 12 });
      }

      console.log('UsageDataTables loaded data:', result);
      setData(result);
      setLoading(false);
    }
    loadData();
  }, [selectedOrg, viewMode]);

  // Get date columns
  const dateColumns = useMemo(() => {
    const dateKey = viewMode === "daily" ? "log_date" : "month";
    const dates = [...new Set(data.map(row => row[dateKey]))]
      .filter(d => d != null) // Filter out null/undefined
      .sort();
    console.log('UsageDataTables dateColumns:', { dateKey, dates, sampleData: data.slice(0, 3) });
    return dates;
  }, [data, viewMode]);

  // Format date for column header
  // Parse date string manually to avoid timezone issues
  const formatDateHeader = (dateStr) => {
    if (!dateStr) return '';

    if (viewMode === "monthly") {
      // Monthly uses "YYYY-MM" format from database
      const parts = dateStr.split('-');
      if (parts.length < 2) return dateStr;
      const [year, month] = parts.map(Number);
      return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
    }
    // Daily uses "YYYY-MM-DD" format from database
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const [, month, day] = parts.map(Number);
    return `${month}/${day}`;
  };

  // Build data for Communications section
  const communicationsData = useMemo(() => {
    const dateKey = viewMode === "daily" ? "log_date" : "month";

    const rows = COMMUNICATION_ACTIONS.map(action => {
      const actionType = action === "Send Email" ? "email" : "pdf";
      const rowData = { metric: action };
      let total = 0;

      dateColumns.forEach(date => {
        const count = data
          .filter(row => row[dateKey] === date && row.action_type === actionType)
          .reduce((sum, row) => sum + row.count, 0);
        rowData[date] = count;
        total += count;
      });

      rowData._total = total;
      return rowData;
    });

    // Calculate totals row
    const totalsRow = { metric: "Total", _isTotal: true };
    let grandTotal = 0;
    dateColumns.forEach(date => {
      const columnTotal = rows.reduce((sum, row) => sum + (row[date] || 0), 0);
      totalsRow[date] = columnTotal;
      grandTotal += columnTotal;
    });
    totalsRow._total = grandTotal;

    // Calculate percentages
    rows.forEach(row => {
      const lastDate = dateColumns[dateColumns.length - 1];
      const lastColumnTotal = totalsRow[lastDate] || 0;
      row._daMo = lastColumnTotal > 0 ? Math.round((row[lastDate] / lastColumnTotal) * 100) : 0;
      row._moYr = grandTotal > 0 ? Math.round((row._total / grandTotal) * 100) : 0;
    });
    totalsRow._daMo = 100;
    totalsRow._moYr = 100;

    return [...rows, totalsRow];
  }, [data, dateColumns, viewMode]);

  // Build data for Search section
  const searchData = useMemo(() => {
    const dateKey = viewMode === "daily" ? "log_date" : "month";

    const rows = SEARCH_MODES.map(mode => {
      const rowData = { metric: mode };
      let total = 0;

      dateColumns.forEach(date => {
        const count = data
          .filter(row => row[dateKey] === date && row.action_type === "search" && row.search_mode === mode)
          .reduce((sum, row) => sum + row.count, 0);
        rowData[date] = count;
        total += count;
      });

      rowData._total = total;
      return rowData;
    });

    // Calculate totals row
    const totalsRow = { metric: "Total", _isTotal: true };
    let grandTotal = 0;
    dateColumns.forEach(date => {
      const columnTotal = rows.reduce((sum, row) => sum + (row[date] || 0), 0);
      totalsRow[date] = columnTotal;
      grandTotal += columnTotal;
    });
    totalsRow._total = grandTotal;

    // Calculate percentages
    rows.forEach(row => {
      const lastDate = dateColumns[dateColumns.length - 1];
      const lastColumnTotal = totalsRow[lastDate] || 0;
      row._daMo = lastColumnTotal > 0 ? Math.round((row[lastDate] / lastColumnTotal) * 100) : 0;
      row._moYr = grandTotal > 0 ? Math.round((row._total / grandTotal) * 100) : 0;
    });
    totalsRow._daMo = 100;
    totalsRow._moYr = 100;

    return [...rows, totalsRow];
  }, [data, dateColumns, viewMode]);

  // Build data for Assistance section
  const assistanceData = useMemo(() => {
    const dateKey = viewMode === "daily" ? "log_date" : "month";

    const rows = ASSISTANCE_TYPES.map(type => {
      const rowData = { metric: type };
      let total = 0;

      dateColumns.forEach(date => {
        const count = data
          .filter(row => row[dateKey] === date && row.assistance_type === type)
          .reduce((sum, row) => sum + row.count, 0);
        rowData[date] = count;
        total += count;
      });

      rowData._total = total;
      return rowData;
    });

    // Calculate totals row
    const totalsRow = { metric: "Total", _isTotal: true };
    let grandTotal = 0;
    dateColumns.forEach(date => {
      const columnTotal = rows.reduce((sum, row) => sum + (row[date] || 0), 0);
      totalsRow[date] = columnTotal;
      grandTotal += columnTotal;
    });
    totalsRow._total = grandTotal;

    // Calculate percentages
    rows.forEach(row => {
      const lastDate = dateColumns[dateColumns.length - 1];
      const lastColumnTotal = totalsRow[lastDate] || 0;
      row._daMo = lastColumnTotal > 0 ? Math.round((row[lastDate] / lastColumnTotal) * 100) : 0;
      row._moYr = grandTotal > 0 ? Math.round((row._total / grandTotal) * 100) : 0;
    });
    totalsRow._daMo = 100;
    totalsRow._moYr = 100;

    return [...rows, totalsRow];
  }, [data, dateColumns, viewMode]);

  // Render section header row with vertical line icon
  const renderSectionHeader = (title, isFirst = false) => (
    <tr className="bg-white">
      <td
        colSpan={dateColumns.length + 3}
        className="font-opensans font-bold"
        style={{
          color: "#222831",
          paddingLeft: "10px",
          paddingTop: isFirst ? "8px" : "24px", // gap above heading
          fontSize: "15px",
        }}
      >
        <span className="inline-flex items-center">
          <VerticalLineIcon size={16} color="#222831" />
          {title}
        </span>
      </td>
    </tr>
  );

  // Render data rows for a section
  const renderDataRows = (rows, startIdx = 0) => (
    <>
      {rows.map((row, idx) => (
        <tr
          key={row.metric}
          className={`${row._isTotal ? "font-semibold bg-[#d4d0c7]" : ((startIdx + idx) % 2 === 0 ? "bg-white" : "bg-[#F5F5F5]")} ${!row._isTotal ? "hover:!bg-reports-row-hover" : ""} transition-colors duration-150 group`}
        >
          <td
            className={`py-2 font-opensans text-sm sticky left-0 ${row._isTotal ? "bg-[#d4d0c7]" : ((startIdx + idx) % 2 === 0 ? "bg-white" : "bg-[#F5F5F5]")} ${!row._isTotal ? "group-hover:!bg-reports-row-hover" : ""} transition-colors duration-150`}
            style={{
              paddingLeft: "10px",
            }}
          >
            {row.metric}
          </td>
          {dateColumns.map(date => (
            <td key={date} className="text-center px-2 py-2 font-opensans text-sm">
              {row[date] || "–"}
            </td>
          ))}
          <td className="text-center px-2 py-2 font-opensans text-sm font-medium text-blue-700">
            {row._daMo}%
          </td>
          <td className="text-center px-2 py-2 font-opensans text-sm font-medium text-blue-700">
            {row._moYr}%
          </td>
        </tr>
      ))}
    </>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-500">Loading data...</span>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        {/* Single header row - red background, white text */}
        <thead>
          <tr style={{ backgroundColor: "#B8001F" }}>
            <th className="text-left py-2 font-opensans font-semibold text-sm text-white sticky left-0 min-w-[180px]" style={{ backgroundColor: "#B8001F", paddingLeft: "10px" }}>
              Metric
            </th>
            {dateColumns.map(date => (
              <th key={date} className="text-center px-2 py-2 font-opensans font-semibold text-sm text-white min-w-[70px]">
                {formatDateHeader(date)}
              </th>
            ))}
            <th className="text-center px-2 py-2 font-opensans font-semibold text-sm text-white min-w-[70px]">
              Da/Mo
            </th>
            <th className="text-center px-2 py-2 font-opensans font-semibold text-sm text-white min-w-[70px]">
              Mo/Yr
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Communications Section */}
          {renderSectionHeader("Communications", true)}
          {renderDataRows(communicationsData, 0)}

          {/* Search Section */}
          {renderSectionHeader("Search")}
          {renderDataRows(searchData, 0)}

          {/* Assistance Section */}
          {renderSectionHeader("Assistance")}
          {renderDataRows(assistanceData, 0)}
        </tbody>
      </table>
    </div>
  );
}
