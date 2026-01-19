// src/layout/NavBar3Reports.js
// Live stats cards for Reports page
// Shows: Top Zip Code | Top Assistance | Top Organization (all time)

import { useState, useEffect } from "react";
import { fetchLiveStats } from "../services/usageService";

// Stat card component
function StatCard({ heading, value, percentage }) {
  const hasData = value && value !== 'N/A';

  return (
    <div
      className="flex items-center justify-center px-5 py-2"
      style={{
        backgroundColor: "var(--color-navbar3-reports-card-bg)",
        borderRadius: "var(--radius-navbar3-reports-card)",
      }}
    >
      <div className="flex flex-col items-start">
        {/* Heading */}
        <span
          className="font-lexend uppercase"
          style={{
            fontSize: "var(--font-size-navbar3-reports-heading)",
            color: "var(--color-navbar3-reports-heading)",
            fontWeight: 500,
            letterSpacing: "0.05em",
          }}
        >
          {heading}
        </span>
        {/* Value and Percentage row */}
        <div
          className="flex items-baseline"
          style={{ gap: "var(--gap-navbar3-reports-value-pct)" }}
        >
          <span
            className="font-lexend"
            style={{
              fontSize: "var(--font-size-navbar3-reports-value)",
              color: "var(--color-navbar3-reports-value)",
              fontWeight: 500,
            }}
          >
            {hasData ? value : "--"}
          </span>
          {hasData && (
            <span
              className="font-lexend"
              style={{
                fontSize: "var(--font-size-navbar3-reports-percentage)",
                color: "var(--color-navbar3-reports-percentage)",
                fontWeight: 500,
              }}
            >
              {percentage}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NavBar3Reports() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch live stats on mount
  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      const data = await fetchLiveStats();
      setStats(data);
      setLoading(false);
    }
    loadStats();
  }, []);

  return (
    <nav
      className="bg-navbar3-bg flex items-center justify-center"
      style={{
        height: "var(--height-navbar3-reports)",
        paddingLeft: "var(--padding-navbar3-left)",
        paddingRight: "20px",
      }}
    >
      {loading ? (
        <span className="text-white font-lexend" style={{ fontSize: "14px" }}>
          Loading stats...
        </span>
      ) : stats ? (
        <div
          className="flex items-center justify-center"
          style={{ gap: "var(--gap-navbar3-reports-cards)" }}
        >
          {/* Top Zip Code */}
          <StatCard
            heading="Top Zip Code"
            value={stats.topZip.value}
            percentage={stats.topZip.percentage}
          />

          {/* Top Assistance */}
          <StatCard
            heading="Top Assistance"
            value={stats.topAssistance.value}
            percentage={stats.topAssistance.percentage}
          />

          {/* Top Organization */}
          <StatCard
            heading="Top Organization"
            value={stats.topRegOrg.value}
            percentage={stats.topRegOrg.percentage}
          />
        </div>
      ) : (
        <span className="text-white font-lexend" style={{ fontSize: "14px" }}>
          No data available
        </span>
      )}
    </nav>
  );
}
