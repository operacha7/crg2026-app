// src/components/reports/ChartReport.js
// Shared chart layout for Zip Code, Emails, and PDFs reports
// Shows: Two donut charts (Average, Today/This Month), Bar chart (bottom)

import { useState, useEffect, useMemo } from "react";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { ResponsivePie } from "@nivo/pie";
import { fetchDailyUsage, fetchMonthlyUsage, fetchOrganizations } from "../../services/usageService";

// Fallback colors for registered orgs that don't have org_color set in database
const DEFAULT_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
  "#F8B500", "#00CED1", "#FF6347", "#32CD32", "#FFD700",
];

// Color for organizations no longer in registered_organizations table (removed/historical)
const INACTIVE_ORG_COLOR = "#808080";

// Get today's date in Central Time
function getCentralDate() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Chicago'
  });
}

// Get current month as YYYY-MM (matches v_monthly_usage TEXT format)
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function ChartReport({
  selectedOrg,
  viewMode,
  fetchParams, // { action_type, search_mode } to filter data
}) {
  const [data, setData] = useState([]);
  const [orgColors, setOrgColors] = useState({});
  const [colorsLoaded, setColorsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch organization colors from registered_organizations table
  // Guest is included in registered_organizations with its own org_color
  useEffect(() => {
    async function loadOrgColors() {
      const orgs = await fetchOrganizations();
      const colors = {};
      orgs.forEach((org, idx) => {
        // Use org_color from database, fallback to default colors
        colors[org.reg_organization] = org.org_color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      });
      setOrgColors(colors);
      setColorsLoaded(true);
    }
    loadOrgColors();
  }, []);

  // Fetch data based on view mode
  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const params = {
        reg_organization: selectedOrg === "All Organizations" ? null : selectedOrg,
        ...fetchParams,
      };

      let result;
      if (viewMode === "daily") {
        result = await fetchDailyUsage({ ...params, days: 30 });
      } else {
        result = await fetchMonthlyUsage({ ...params, months: 12 });
      }

      // Filter out Administrator data (used for testing only)
      const filteredResult = result.filter(row => row.reg_organization !== "Administrator");
      setData(filteredResult);
      setLoading(false);
    }
    loadData();
  }, [selectedOrg, viewMode, fetchParams]);

  // Get color for organization
  // If org is not in registered_organizations (removed/historical), use gray
  const getOrgColor = (orgName) => {
    return orgColors[orgName] || INACTIVE_ORG_COLOR;
  };

  // Calculate average (total / time period)
  // Daily: always divide by 30 days (fixed rolling window)
  // Monthly: divide by actual number of months with data (since we won't have months with zero activity)
  const averageData = useMemo(() => {
    const dateKey = viewMode === "daily" ? "log_date" : "month";
    const uniquePeriods = [...new Set(data.map(row => row[dateKey]))].filter(d => d != null);

    // Daily uses fixed 30-day window, Monthly uses actual months in data
    const numPeriods = viewMode === "daily" ? 30 : (uniquePeriods.length || 1);

    const orgTotals = {};
    data.forEach((row) => {
      const org = row.reg_organization;
      orgTotals[org] = (orgTotals[org] || 0) + row.count;
    });

    // Calculate averages per period
    const pieData = Object.entries(orgTotals)
      .map(([org, total]) => ({
        id: org,
        label: org,
        value: Math.round((total / numPeriods) * 10) / 10, // Round to 1 decimal
        color: getOrgColor(org),
      }))
      .sort((a, b) => b.value - a.value);

    const totalAverage = pieData.reduce((sum, item) => sum + item.value, 0);

    return { pieData, total: Math.round(totalAverage * 10) / 10, numPeriods };
  }, [data, orgColors, viewMode]);

  // Get today's/this month's data
  const currentPeriodData = useMemo(() => {
    const dateKey = viewMode === "daily" ? "log_date" : "month";
    const currentPeriod = viewMode === "daily" ? getCentralDate() : getCurrentMonth();

    const periodData = data.filter(row => row[dateKey] === currentPeriod);

    const orgTotals = {};
    periodData.forEach((row) => {
      const org = row.reg_organization;
      orgTotals[org] = (orgTotals[org] || 0) + row.count;
    });

    const pieData = Object.entries(orgTotals)
      .map(([org, count]) => ({
        id: org,
        label: org,
        value: count,
        color: getOrgColor(org),
      }))
      .sort((a, b) => b.value - a.value);

    const total = pieData.reduce((sum, item) => sum + item.value, 0);

    return { pieData, total };
  }, [data, orgColors, viewMode]);

  // Process data for bar chart (by date, stacked by organization)
  const barData = useMemo(() => {
    const dateKey = viewMode === "daily" ? "log_date" : "month";
    const dateMap = {};

    data.forEach((row) => {
      const date = row[dateKey];
      if (!dateMap[date]) {
        dateMap[date] = { date };
      }
      const org = row.reg_organization;
      dateMap[date][org] = (dateMap[date][org] || 0) + row.count;
    });

    // Convert to array and sort by date
    const result = Object.values(dateMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Calculate running average
    let runningSum = 0;
    result.forEach((item, idx) => {
      const dayTotal = Object.keys(item)
        .filter(k => k !== "date" && k !== "runningAverage")
        .reduce((sum, k) => sum + (item[k] || 0), 0);
      runningSum += dayTotal;
      item.runningAverage = Math.round(runningSum / (idx + 1));
    });

    return result;
  }, [data, viewMode]);

  // Get unique organizations from bar data
  const organizations = useMemo(() => {
    const orgs = new Set();
    barData.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (key !== "date" && key !== "runningAverage") {
          orgs.add(key);
        }
      });
    });
    return Array.from(orgs).sort();
  }, [barData]);

  // Format date for display
  // Parse date string manually to avoid timezone issues
  const formatDate = (dateStr) => {
    if (viewMode === "monthly") {
      // Monthly uses "YYYY-MM" format from database
      const [year, month] = dateStr.split('-').map(Number);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[month - 1]} '${String(year).slice(-2)}`;
    }
    // Daily uses "YYYY-MM-DD" format from database
    const [, month, day] = dateStr.split('-').map(Number);
    return `${month}/${day}`;
  };

  // Get period label for current period chart
  const getCurrentPeriodLabel = () => {
    if (viewMode === "daily") {
      const today = new Date();
      return `Today (${today.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })})`;
    } else {
      const now = new Date();
      return now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
  };

  // Wait for both data and organization colors to load
  if (loading || !colorsLoaded) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-500">Loading data...</span>
      </div>
    );
  }

  // Donut chart component
  const DonutChart = ({ title, pieData, total, subtitle }) => (
    <div className="bg-white border rounded p-4 flex-1">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-md font-opensans" style={{ color: "#4A4E69" }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        <span className="text-2xl text-gray-700">{total}</span>
      </div>
      <div style={{ height: "280px" }}>
        {pieData.length > 0 ? (
          <ResponsivePie
            data={pieData}
            margin={{ top: 20, right: 60, bottom: 20, left: 60 }}
            innerRadius={0.4}
            padAngle={1}
            cornerRadius={3}
            colors={{ datum: "data.color" }}
            borderWidth={1}
            borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
            enableArcLinkLabels={true}
            arcLinkLabelsSkipAngle={15}
            arcLinkLabelsTextColor="#4A4E69"
            arcLinkLabelsThickness={2}
            arcLinkLabelsColor={{ from: "color" }}
            enableArcLabels={false}
            tooltip={({ datum }) => (
              <div className="bg-white p-3 border border-gray-300 rounded shadow-md">
                <p className="text-sm" style={{ color: "#4A4E69" }}>
                  {datum.label}
                </p>
                <p className="text-sm">Count: {datum.value}</p>
                {total > 0 && (
                  <p className="text-sm">
                    Percentage: {((datum.value / total) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            )}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <p className="text-gray-500">No data available</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      {/* Top row - Two donut charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Average Donut Chart */}
        <DonutChart
          title={viewMode === "daily" ? "Daily Average" : "Monthly Average"}
          subtitle={`Based on last ${averageData.numPeriods} ${viewMode === "daily" ? "days" : "months"}`}
          pieData={averageData.pieData}
          total={averageData.total}
        />

        {/* Today/This Month Donut Chart */}
        <DonutChart
          title={getCurrentPeriodLabel()}
          pieData={currentPeriodData.pieData}
          total={currentPeriodData.total}
        />
      </div>

      {/* Bottom row - Bar chart */}
      <div className="bg-white border rounded p-4">
        <h3 className="text-md font-opensans mb-2" style={{ color: "#4A4E69" }}>
          {viewMode === "daily" ? "Last 30 Days" : "Last 12 Months"}
        </h3>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              angle={-45}
              textAnchor="end"
              height={80}
              fontSize={10}
            />
            <YAxis />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const totalCount = payload.reduce((sum, entry) => {
                    if (entry.dataKey !== "runningAverage") {
                      return sum + (entry.value || 0);
                    }
                    return sum;
                  }, 0);

                  const runningAvgEntry = payload.find(
                    (entry) => entry.dataKey === "runningAverage"
                  );

                  return (
                    <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                      <p className="text-gray-800 mb-2">{formatDate(label)}</p>
                      <p className="text-sm text-gray-600 mb-2">
                        Total: {totalCount}
                      </p>

                      {payload
                        .filter(
                          (entry) =>
                            entry.dataKey !== "runningAverage" && entry.value > 0
                        )
                        .sort((a, b) => b.value - a.value)
                        .map((entry, index) => (
                          <p
                            key={index}
                            className="text-sm"
                            style={{ color: entry.color }}
                          >
                            {entry.dataKey}: {entry.value}
                          </p>
                        ))}

                      {runningAvgEntry && (
                        <p className="text-sm text-green-600 mt-2 pt-2 border-t border-gray-200">
                          Running Average: {runningAvgEntry.value}
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />

            {organizations.map((org) => (
              <Bar
                key={org}
                dataKey={org}
                stackId="organizations"
                fill={getOrgColor(org)}
                name={org}
              />
            ))}

            <Line
              type="monotone"
              dataKey="runningAverage"
              stroke="#ff00ff"
              strokeWidth={2}
              name="Running Average"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
