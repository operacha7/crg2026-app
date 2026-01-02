// components/charts/TopRegOrganizations.js
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

const TopRegOrganizations = () => {
  const { getOrganizationColor } = useStatistics();
  const [data, setData] = useState([]);
  const [organizations, setOrganizations] = useState(['All']); // Dropdown of organizations (referred TO)
  const [selectedOrg, setSelectedOrg] = useState('All');
  const [loading, setLoading] = useState(true);
  const [allReferringOrganizations, setAllReferringOrganizations] = useState([]);

  // Helper function to add opacity to colors
  const addOpacityToColor = (hexColor, opacity = 0.8) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Fetch organizations that can be filtered by (organizations that were referred TO)
  const fetchOrganizations = async () => {
    try {
      const { data: orgData, error } = await supabase
        .from('email_referrals')
        .select('organization')
        .not('organization', 'is', null)
        .neq('organization', '');

      if (error) throw error;

      const uniqueOrgs = [...new Set(orgData.map(item => item.organization))];
      setOrganizations(['All', ...uniqueOrgs.sort()]);
      
    } catch (error) {
      console.error('Error fetching organizations:', error);
      setOrganizations(['All']);
    }
  };

  // Fetch referrals data - showing ALL registered organizations (not limited to 25)
  const fetchRegOrganizations = async (organization = 'All') => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('email_referrals')
        .select('reg_organization, organization')
        .not('reg_organization', 'is', null)
        .neq('reg_organization', '')
        .neq('reg_organization', 'Administrator')
        .not('organization', 'is', null)
        .neq('organization', '');

      if (organization !== 'All') {
        query = query.eq('organization', organization);
      }

      const { data: referralData, error } = await query;

      if (error) throw error;

      // Group by REGISTERED organization (reg_organization) and count by REFERRED organization
      const referralCounts = {};
      const referredOrgSet = new Set();

      referralData.forEach(record => {
        const regOrg = record.reg_organization;        // Registered organization (Y-axis)
        const referredOrg = record.organization;       // Organization referred (bars)
        
        referredOrgSet.add(referredOrg);
        
        // Group by the REGISTERED organization
        if (!referralCounts[regOrg]) {
          referralCounts[regOrg] = { organization: regOrg, totalCount: 0 };
        }
        
        // Count how many times each REFERRED organization was referred by this reg org
        if (!referralCounts[regOrg][referredOrg]) {
          referralCounts[regOrg][referredOrg] = 0;
        }
        
        referralCounts[regOrg][referredOrg]++;
        referralCounts[regOrg].totalCount++;
      });

      // Convert to array and sort by total count (most active registered organizations first)
      // NO LIMIT - show ALL registered organizations
      const sortedRegOrgs = Object.values(referralCounts)
        .sort((a, b) => b.totalCount - a.totalCount);

      setData(sortedRegOrgs);
      setAllReferringOrganizations(Array.from(referredOrgSet));
      
    } catch (error) {
      console.error('Error fetching registered organizations:', error);
      setData([]);
      setAllReferringOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchOrganizations();
  }, []);

  // Fetch data when organization changes
  useEffect(() => {
    if (organizations.length > 0) {
      fetchRegOrganizations(selectedOrg);
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
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const registeredOrganization = label;  // The registered organization
      
      // Filter out zero values and sort by count
      const referredOrgData = payload
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
      
      const totalCount = referredOrgData.reduce((sum, item) => sum + item.value, 0);
      
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-md max-w-sm">
          <p className="text-sm" style={{ color: '#4A4E69' }}>
            Registered Organization: {registeredOrganization}
          </p>
          <p className="text-sm font-medium mb-1">
            Total Referrals Made: {totalCount}
          </p>
          <div className="text-sm">
            <p className="text-xs text-gray-500 mb-1">Organizations Referred:</p>
            {referredOrgData.map((item, index) => (
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
  const CustomLegend = () => {
    if (allReferringOrganizations.length === 0) {
      return <div className="text-center text-gray-500 mt-4">No organizations to display</div>;
    }
    
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4 px-4">
        {allReferringOrganizations.map((referredOrg) => (
          <div key={referredOrg} className="flex items-center space-x-2">
            <div 
              className="w-4 h-4 rounded"
              style={{ 
                backgroundColor: addOpacityToColor(getOrganizationColor(referredOrg), 0.8)
              }}
            />
            <span className="text-sm font-medium text-gray-700">
              {referredOrg}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Calculate dynamic height
  const itemHeight = 35;
  const chartHeight = Math.max(500, data?.length * itemHeight || 500);
  const legendHeight = 350;
  const totalHeight = chartHeight + legendHeight;

  return (
    <div className="w-full flex flex-col">
      <h2 className="text-2xl mb-4" style={CHART_STYLES.title}>
        Referrals by Registered Organizations
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
            height: `${totalHeight}px`, 
            overflow: 'auto',
            marginBottom: '20px'
          }}
        >
          <BarChart 
            data={data} 
            layout="vertical" 
            width={window.innerWidth * 0.95}
            height={chartHeight}
            margin={CHART_STYLES.margins}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis 
              dataKey="organization" 
              type="category" 
              interval={0}
              width={280}
              tick={<CustomYAxisTick />}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Create a Bar component for each REFERRED organization */}
            {allReferringOrganizations.map((referredOrg) => (
              <Bar 
                key={referredOrg}
                dataKey={referredOrg} 
                stackId="referredOrganizations"
                fill={addOpacityToColor(getOrganizationColor(referredOrg), 0.8)}
                name={referredOrg}
              />
            ))}
          </BarChart>
          
          {/* Custom Legend at the bottom */}
          <CustomLegend />
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

export default TopRegOrganizations;