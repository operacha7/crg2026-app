// components/charts/TopReferrals.js
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { supabase } from '../../MainApp';
import { useStatistics } from '../../Contexts/StatisticsContext';

// Shared chart constants for standardization
const CHART_STYLES = {
  title: {
    fontSize: '24px',
    fontWeight: 'normal',
    color: '#4A4E69',
    marginBottom: '16px'
  },
  margins: { top: 20, right: 20, left: 10, bottom: 5 },
  fonts: {
    axis: { fontSize: '13px', fontWeight: '500' }
  }
};

const TopReferrals = () => {
  const { getOrganizationColor } = useStatistics();
  const [data, setData] = useState([]);
  const [organizations, setOrganizations] = useState(['All']); // Dropdown of reg_organizations
  const [selectedOrg, setSelectedOrg] = useState('All');
  const [loading, setLoading] = useState(true);
  const [allReferredOrganizations, setAllReferredOrganizations] = useState([]);

  // Helper function to add opacity to colors
  const addOpacityToColor = (hexColor, opacity = 0.8) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Fetch dropdown orgs from the same 12-mo view so the filter matches the chart
const fetchReferralOrganizations = async () => {
  try {
    const { data: orgData, error } = await supabase
      .from('v_top25_referrals_12mo')
      .select('reg_organization')
      .order('reg_organization', { ascending: true });

    if (error) throw error;

    const uniqueOrgs = [...new Set((orgData || []).map(r => r.reg_organization))];
    setOrganizations(['All', ...uniqueOrgs]);
  } catch (err) {
    console.error('Error fetching referral organizations:', err);
    setOrganizations(['All']);
  }
};

// Fetch top referrals from the view
const fetchTopReferrals = async (organization = 'All') => {
  try {
    setLoading(true);

    let query = supabase
      .from('v_top25_referrals_12mo')
      .select('organization, reg_organization, referrals, total_referrals')
      .order('total_referrals', { ascending: false });

    if (organization !== 'All') {
      query = query.eq('reg_organization', organization);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    // Shape rows into stacked series per REFERRED org
    const byReferred = {};
    const referringSet = new Set();

    (rows || []).forEach(({ organization, reg_organization, referrals, total_referrals }) => {
      referringSet.add(reg_organization);
      if (!byReferred[organization]) byReferred[organization] = { organization, totalCount: Number(total_referrals) };
      byReferred[organization][reg_organization] = Number(referrals);
    });

    const sorted = Object.values(byReferred)
      .sort((a, b) => b.totalCount - a.totalCount)   // view already limits to 25
      .slice(0, 25);

    setData(sorted);
    setAllReferredOrganizations(Array.from(referringSet));
  } catch (err) {
    console.error('Error fetching top referrals:', err);
    setData([]);
    setAllReferredOrganizations([]);
  } finally {
    setLoading(false);
  }
};

  // Initial load
  useEffect(() => {
    fetchReferralOrganizations();
  }, []);

  // Fetch data when organization changes
  useEffect(() => {
    if (organizations.length > 0) {
      fetchTopReferrals(selectedOrg);
    }
  }, [selectedOrg, organizations]);

  // Custom Y-axis tick component to handle long text
  const CustomYAxisTick = (props) => {
    const { x, y, payload } = props;
    const maxLength = 40;
    const text = payload.value;
    const displayText = text.length > maxLength ? 
      text.substring(0, maxLength - 3) + '...' : text;

    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={0} 
          y={0} 
          dy={4} 
          textAnchor="end" 
          fill="#4A4E69" 
          fontSize="13"
          fontWeight="500"
        >
          {displayText}
        </text>
      </g>
    );
  };

  // Custom tooltip component
  const CustomReferralTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const referredOrganization = label;  // The organization that was referred TO
      
      // Filter out zero values and sort by count
      const referringOrgData = payload
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
      
      const totalCount = referringOrgData.reduce((sum, item) => sum + item.value, 0);
      
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-md max-w-sm">
          <p className="text-sm" style={{ color: '#4A4E69' }}>
            Referred Organization: {referredOrganization}
          </p>
          <p className="text-sm font-medium mb-1">
            Total Referrals Received: {totalCount}
          </p>
          <div className="text-sm">
            <p className="text-xs text-gray-500 mb-1">Referred by:</p>
            {referringOrgData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded mr-2"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-xs">{item.dataKey}</span>
                </div>
                <span className="font-medium text-xs">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Legend Component
  const CustomReferralLegend = () => {
    if (allReferredOrganizations.length === 0) {
      return <div className="text-center text-gray-500 mt-4">No organizations to display</div>;
    }
    
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4 px-4">
        {allReferredOrganizations.map((referringOrg) => (
          <div key={referringOrg} className="flex items-center space-x-2">
            <div 
              className="w-4 h-4 rounded"
              style={{ 
                backgroundColor: addOpacityToColor(getOrganizationColor(referringOrg), 0.8)
              }}
            />
            <span className="text-sm font-medium text-gray-700">
              {referringOrg}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Calculate dynamic height
  const referralItemHeight = 35;
  const referralChartHeight = Math.max(500, data?.length * referralItemHeight || 500);
  const referralLegendHeight = 60;
  const referralTotalHeight = referralChartHeight + referralLegendHeight;

const maxTotal = Math.max(...(data || []).map(d => d?.totalCount || 0), 0);
const xAxisMax = Math.ceil(maxTotal / 5) * 5;

  return (
    <div className="w-full flex flex-col">
      <h2 className="text-2xl mb-4" style={CHART_STYLES.title}>
        Top 25 Referrals by Organization (Last 12 Months)
      </h2>
      
      {/* Organization filter dropdown */}
      <div className="mb-4">
        <select 
          className="p-2 border rounded"
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
        >
          {organizations.map(org => (
            <option key={org} value={org}>{org}</option>
          ))}
        </select>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-lg" style={{ color: CHART_STYLES.title.color }}>
            Loading data...
          </div>
        </div>
      ) : data && data.length > 0 ? (
        <div 
          className="flex-grow" 
          style={{ 
            height: `${referralTotalHeight}px`, 
            overflow: 'auto',
            marginBottom: '20px'
          }}
        >
          <BarChart 
            data={data} 
            layout="vertical" 
            width={window.innerWidth * 0.95}
            height={referralChartHeight}
            margin={CHART_STYLES.margins}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, xAxisMax]} allowDecimals={false} />
            <YAxis 
              dataKey="organization" 
              type="category" 
              interval={0}
              width={280}
              tick={<CustomYAxisTick />}
            />
            <Tooltip content={<CustomReferralTooltip />} />
            
            {/* Create a Bar component for each REFERRING organization */}
            {allReferredOrganizations.map((referringOrg) => (
              <Bar 
                key={referringOrg}
                dataKey={referringOrg} 
                stackId="referringOrganizations"
                fill={addOpacityToColor(getOrganizationColor(referringOrg), 0.8)}
                name={referringOrg}
              />
            ))}
          </BarChart>
          
          {/* Custom Legend at the bottom */}
          <CustomReferralLegend />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p style={{ color: CHART_STYLES.title.color }}>
            No referral data available for the selected organization
          </p>
        </div>
      )}
    </div>
  );
};

export default TopReferrals;