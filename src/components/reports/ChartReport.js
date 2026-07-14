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
  Legend,
} from "recharts";
import { ResponsivePie } from "@nivo/pie";
import { fetchDailyUsage, fetchMonthlyUsage, fetchOrganizations } from "../../services/usageService";
import { WEEKS_TO_SHOW, WEEKLY_FETCH_DAYS, getWeekStartStr, formatWeekRange } from "../../utils/weekBuckets";

// Intentionally jarring color for any org name that shows up in app_usage_logs
// but is no longer present in registered_organizations. Black stands out
// against the rest of the palette so the admin notices and can decide whether
// to re-add the org (with a real color) or remap the historical rows.
const MISSING_ORG_COLOR = "#9A9A9A";

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

// Get the Central-Time date `daysBack` days ago as YYYY-MM-DD. Used to keep the
// "Daily Average" donut fixed to the last 30 days even though the Weekly view
// fetches a wider window (WEEKLY_FETCH_DAYS) to feed the column chart.
function getCutoffDate(daysBack) {
  const dt = new Date();
  dt.setDate(dt.getDate() - daysBack);
  return dt.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

// Custom two-line X-axis tick for the Weekly column chart: week start on the
// first line, week end on the second (e.g. 7/5 over 7/11).
function WeekTick({ x, y, payload }) {
  const { start, end } = formatWeekRange(payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="#666" fontSize={10}>
        <tspan x={0} dy={12}>{start}</tspan>
        <tspan x={0} dy={12}>{end}</tspan>
      </text>
    </g>
  );
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
      orgs.forEach((org) => {
        colors[org.reg_organization] = org.org_color;
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
        reg_organization: selectedOrg === "All Users" ? null : selectedOrg,
        ...fetchParams,
      };

      let result;
      if (viewMode === "monthly") {
        result = await fetchMonthlyUsage({ ...params, months: 12 });
      } else {
        // Weekly view: fetch daily rows over a wider window and tag each with
        // its Sunday-start week so the column chart can bucket by week. The
        // donuts still read log_date directly (unchanged from the old Daily view).
        result = await fetchDailyUsage({ ...params, days: WEEKLY_FETCH_DAYS });
        result = result.map(row => ({ ...row, week: getWeekStartStr(row.log_date) }));
      }

      // Filter out Administrator data (used for testing only)
      const filteredResult = result.filter(row => row.reg_organization !== "Administrator");
      setData(filteredResult);
      setLoading(false);
    }
    loadData();
  }, [selectedOrg, viewMode, fetchParams]);

  // Get color for organization. Any name that isn't in registered_organizations
  // (or is there with org_color unset) falls through to black so the gap is
  // obvious in the chart.
  const getOrgColor = (orgName) => {
    return orgColors[orgName] || MISSING_ORG_COLOR;
  };

  // Calculate average (total / time period)
  // Daily: always divide by 30 days (fixed rolling window)
  // Monthly: divide by actual number of months with data (since we won't have months with zero activity)
  const averageData = useMemo(() => {
    const isMonthly = viewMode === "monthly";
    const dateKey = isMonthly ? "month" : "log_date";

    // This donut is intentionally unchanged by the Weekly view: it always shows
    // the Daily Average over the last 30 days. Since the Weekly fetch pulls a
    // wider window, restrict the source rows to the last 30 days here.
    const cutoff30 = isMonthly ? null : getCutoffDate(29);
    const source = isMonthly
      ? data
      : data.filter(row => row.log_date && row.log_date >= cutoff30);

    const uniquePeriods = [...new Set(source.map(row => row[dateKey]))].filter(d => d != null);

    // Daily average uses a fixed 30-day window, Monthly uses actual months in data
    const numPeriods = isMonthly ? (uniquePeriods.length || 1) : 30;

    const orgTotals = {};
    source.forEach((row) => {
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
    const dateKey = viewMode === "monthly" ? "month" : "log_date";
    const currentPeriod = viewMode === "monthly" ? getCurrentMonth() : getCentralDate();

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

  // Process data for bar chart (by period, stacked by organization).
  // Weekly buckets by Sunday-start week (the `week` field tagged at fetch time);
  // Monthly buckets by month.
  const barData = useMemo(() => {
    const isMonthly = viewMode === "monthly";
    const dateKey = isMonthly ? "month" : "week";
    const dateMap = {};

    data.forEach((row) => {
      const date = row[dateKey];
      if (!date) return;
      if (!dateMap[date]) {
        dateMap[date] = { date };
      }
      const org = row.reg_organization;
      dateMap[date][org] = (dateMap[date][org] || 0) + row.count;
    });

    // Convert to array and sort by date
    const full = Object.values(dateMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Per-period total for each bucket (sum across org bars)
    const periodTotal = (item) =>
      Object.keys(item)
        .filter(k => k !== "date" && !k.startsWith("_"))
        .reduce((sum, k) => sum + (item[k] || 0), 0);
    full.forEach(item => { item._total = periodTotal(item); });

    // Weekly shows the most recent WEEKS_TO_SHOW complete buckets; Monthly shows all.
    const displayed = isMonthly ? full : full.slice(-WEEKS_TO_SHOW);

    // Percentage change vs the immediately preceding bucket. Uses the full,
    // un-sliced array as the neighbor source so the first displayed week still
    // gets a change value from the (dropped) prior week. null when there's no
    // prior bucket or the prior total was 0 (avoids divide-by-zero).
    displayed.forEach((item) => {
      const fullIdx = full.indexOf(item);
      const prevTotal = fullIdx > 0 ? full[fullIdx - 1]._total : null;
      item._pctChange = (prevTotal != null && prevTotal > 0)
        ? Math.round(((item._total - prevTotal) / prevTotal) * 100)
        : null;
    });

    return displayed;
  }, [data, viewMode]);

  // Get unique organizations from bar data
  const organizations = useMemo(() => {
    const orgs = new Set();
    barData.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (key !== "date" && !key.startsWith("_")) {
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
    // Weekly labels come from the custom WeekTick, not this formatter.
    const [, month, day] = dateStr.split('-').map(Number);
    return `${month}/${day}`;
  };

  // Tooltip header label for the column chart. Weekly shows the full week range
  // (e.g. "7/5 – 7/11"); Monthly shows the month (e.g. "Jul '26").
  const formatTooltipLabel = (dateStr) => {
    if (viewMode === "monthly") return formatDate(dateStr);
    const { start, end } = formatWeekRange(dateStr);
    return `${start} – ${end}`;
  };

  // Get period label for current period chart. The "Today" donut is intentionally
  // unchanged by the Weekly view.
  const getCurrentPeriodLabel = () => {
    if (viewMode !== "monthly") {
      const today = new Date();
      return `Today (${today.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })})`;
    }
    const now = new Date();
    return now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
          title={viewMode === "monthly" ? "Monthly Average" : "Daily Average"}
          subtitle={`Based on last ${averageData.numPeriods} ${viewMode === "monthly" ? "months" : "days"}`}
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
          {viewMode === "monthly" ? "Last 12 Months" : `Last ${WEEKS_TO_SHOW} Weeks`}
        </h3>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              interval={0}
              height={80}
              {...(viewMode === "monthly"
                ? { tickFormatter: formatDate, angle: -45, textAnchor: "end", fontSize: 10 }
                : { tick: <WeekTick /> })}
            />
            <YAxis />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const totalCount = payload.reduce(
                    (sum, entry) => sum + (entry.value || 0),
                    0
                  );

                  // Percentage change vs the previous period (week or month),
                  // shown on hover.
                  const meta = barData.find((d) => d.date === label);
                  const pct = meta ? meta._pctChange : null;
                  const periodWord = viewMode === "monthly" ? "month" : "week";
                  let pctText = "—";
                  let pctColor = "#374151"; // neutral gray when no prior period
                  if (pct != null) {
                    const sign = pct >= 0 ? "+" : "";
                    pctText = `${sign}${pct}%`;
                    pctColor = pct >= 0 ? "#16a34a" : "#dc2626"; // green up / red down
                  }

                  return (
                    <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                      <p className="text-gray-800 mb-2">{formatTooltipLabel(label)}</p>
                      <p className="text-sm text-gray-600 mb-2">
                        Total: {totalCount}
                      </p>

                      {payload
                        .filter((entry) => entry.value > 0)
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

                      <p className="text-sm text-black mt-2 pt-2 border-t border-gray-200" style={{ fontWeight: 400 }}>
                        Change from previous {periodWord}:{" "}
                        <span style={{ fontWeight: 600, color: pctColor }}>{pctText}</span>
                      </p>
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
