// src/components/UsageStats.jsx
import React, { useState } from "react";
import { supabase } from "../MainApp";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const UsageStats = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabUsage, setTabUsage] = useState([]);
  const [zipCodeUsage, setZipCodeUsage] = useState([]);
  const [organizationUsage, setOrganizationUsage] = useState([]);
  const [timeRange, setTimeRange] = useState("week"); // 'day', 'week', 'month'

  const fetchUsageData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Set date range based on selection
      const now = new Date();
      let startDate;

      switch (timeRange) {
        case "day":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 1);
          break;
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
      }

      const startDateStr = startDate.toISOString();

      // Fetch tab usage statistics
      const { data: tabData, error: tabError } = await supabase
        .from("usage_logs")
        .select("action_type, count")
        .gte("logged_at", startDateStr)
        .order("count", { ascending: false })
        .limit(10);

      if (tabError) throw new Error(`Tab data error: ${tabError.message}`);
      setTabUsage(tabData || []);

      // Fetch zip code usage
      const { data: zipData, error: zipError } = await supabase
        .from("usage_logs")
        .select("search_value, count")
        .eq("search_type", "Zip Code")
        .gte("logged_at", startDateStr)
        .order("count", { ascending: false })
        .limit(10);

      if (zipError) throw new Error(`Zip code data error: ${zipError.message}`);
      setZipCodeUsage(zipData || []);

      // Fetch organization usage
      const { data: orgData, error: orgError } = await supabase
        .from("usage_logs")
        .select("organization, count")
        .gte("logged_at", startDateStr)
        .order("count", { ascending: false })
        .limit(10);

      if (orgError)
        throw new Error(`Organization data error: ${orgError.message}`);
      setOrganizationUsage(orgData || []);
    } catch (err) {
      console.error("Error fetching usage data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="usage-stats-container p-4">
      <h1 className="text-2xl font-bold mb-4">Usage Statistics</h1>

      {/* Time range selector */}
      <div className="mb-6">
        <label className="mr-2">Time Range:</label>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="border rounded p-1"
        >
          <option value="day">Last 24 Hours</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
        <button
          onClick={fetchUsageData}
          className="ml-2 bg-blue-500 text-white px-3 py-1 rounded"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading usage data...</div>
      ) : error ? (
        <div className="text-red-500 py-4">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tab Usage Chart */}
          <div className="border rounded p-4">
            <h2 className="text-lg font-semibold mb-2">Tab Usage</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tabUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="action_type" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Zip Code Usage Chart */}
          <div className="border rounded p-4">
            <h2 className="text-lg font-semibold mb-2">Top Zip Codes</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={zipCodeUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="search_value" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Organization Usage Chart */}
          <div className="border rounded p-4">
            <h2 className="text-lg font-semibold mb-2">
              Organization Activity
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={organizationUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="organization" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsageStats;
