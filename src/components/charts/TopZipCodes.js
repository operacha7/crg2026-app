// components/charts/TopZipCodes.js
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
  margins: { top: 20, right: 30, left: 60, bottom: 5 },
  fonts: {
    axis: { fontSize: '13px', fontWeight: '500' }
  }
};

const TopZipCodes = () => {
  const { getOrganizationColor } = useStatistics();
  const [data, setData] = useState([]);
  const [organizations, setOrganizations] = useState(['All']); // Local organizations for this component
  const [selectedOrg, setSelectedOrg] = useState('All');
  const [loading, setLoading] = useState(true);
  const [allOrganizations, setAllOrganizations] = useState([]);
  const [zipNeighborhoods, setZipNeighborhoods] = useState({}); 

  // Helper function to add opacity to colors
  const addOpacityToColor = (color, opacity) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Fetch organizations present in the last 12 months view (keeps dropdown aligned to chart)
  const fetchZipOrganizations = async () => {
    try {
      const { data: orgData, error } = await supabase
        .from('v_top25_zip_org_12mo')
        .select('reg_organization')
        .order('reg_organization', { ascending: true });

      if (error) throw error;

      const uniqueOrgs = [...new Set((orgData || []).map(item => item.reg_organization))];
      setOrganizations(['All', ...uniqueOrgs]);
    } catch (error) {
      console.error('Error fetching zip organizations:', error);
      setOrganizations(['All']);
    }
  };

// Fetch neighborhoods
const fetchNeighborhoods = async () => {
  try {
    const { data, error } = await supabase
      .from('zip_codes')
      .select('zip_code, org_county_city_zip_neighborhood');

    if (error) throw error;

    const zipMap = {};
    data.forEach(({ zip_code, org_county_city_zip_neighborhood }) => {
      zipMap[zip_code] = org_county_city_zip_neighborhood;
    });

    setZipNeighborhoods(zipMap);
  } catch (error) {
    console.error('Error fetching zip neighborhoods:', error);
    setZipNeighborhoods({});
  }
};


  // Fetch top zip codes data from the DB view (last 12 months, already ranked and limited)
  const fetchTopZipCodes = async (organization = 'All') => {
    try {
      setLoading(true);

      let query = supabase
        .from('v_top25_zip_org_12mo')
        .select('zip, reg_organization, searches, total_searches')
        .order('total_searches', { ascending: false });

      if (organization !== 'All') {
        query = query.eq('reg_organization', organization);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      // Reshape rows (zip, org, searches, total_searches) into stacked series per zip
      const byZip = {};
      const orgSet = new Set();

      (rows || []).forEach(({ zip, reg_organization, searches, total_searches }) => {
        orgSet.add(reg_organization);
        if (!byZip[zip]) byZip[zip] = { zip, totalCount: Number(total_searches) };
        byZip[zip][reg_organization] = Number(searches);
      });

      const sorted = Object.values(byZip)
        .sort((a, b) => b.totalCount - a.totalCount)
        .slice(0, 25);

      setData(sorted);
      setAllOrganizations(Array.from(orgSet));
    } catch (error) {
      console.error('Error fetching top zip codes:', error);
      setData([]);
      setAllOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchZipOrganizations();
    fetchNeighborhoods();
  }, []);

  // Fetch data when organization changes
  useEffect(() => {
    if (organizations.length > 0) {
      fetchTopZipCodes(selectedOrg);
    }
  }, [selectedOrg, organizations]);

  const CustomZipTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const totalForZip = payload.reduce((sum, entry) => sum + entry.value, 0);
      const neighborhood = zipNeighborhoods[label];
  
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg max-w-xs">
          <p className="font-semibold text-[1rem]" style={{ color: CHART_STYLES.title.color }}>
            {neighborhood?.trim() || `Zip Code: ${label}`}
          </p>
          <p className="font-medium text-blue-600">
            {`Total Searches: ${totalForZip}`}
          </p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom Legend Component
  const CustomTopZipsLegend = () => {
    if (allOrganizations.length === 0) {
      return <div className="text-center text-gray-500 mt-4">No organizations to display</div>;
    }
    
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4 px-4">
        {allOrganizations.map((regOrg) => (
          <div key={regOrg} className="flex items-center space-x-2">
            <div 
              className="w-4 h-4 rounded"
              style={{ 
                backgroundColor: addOpacityToColor(getOrganizationColor(regOrg), 0.8)
              }}
            />
            <span className="text-sm font-medium text-gray-700">
              {regOrg}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Calculate dynamic height
  const baseHeight = 400;
  const itemHeight = 35;
  const chartHeight = Math.max(baseHeight, data?.length * itemHeight || baseHeight);

  // Compute X-axis max rounded up to nearest 5 so bars don't hit the right edge
  const maxTotal = Math.max(...(data || []).map(d => d?.totalCount || 0), 0);
  const xAxisMax = Math.ceil(maxTotal / 5) * 5;

  return (
    <div className="w-full flex flex-col">
      <h2 className="text-2xl mb-4" style={CHART_STYLES.title}>
        Top 25 Zip Codes by Organization (Last 12 Months)
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
        <div>
          <BarChart 
            data={data} 
            layout="vertical" 
            width={window.innerWidth * 0.95} 
            height={chartHeight}
            margin={CHART_STYLES.margins}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              domain={[0, xAxisMax]} 
              allowDecimals={false}
            />
            <YAxis 
              dataKey="zip" 
              type="category" 
              interval={0}
              width={60}
              tick={{ fontSize: 15, fontWeight: 500 }}
            />
            <Tooltip content={<CustomZipTooltip />} />
            
            {/* Map organizations to Bar components with colors */}
            {allOrganizations.map((org) => (
              <Bar 
                key={org}
                dataKey={org} 
                stackId="organizations"
                fill={addOpacityToColor(getOrganizationColor(org), 0.7)}
                name={org}
              />
            ))}
          </BarChart>
          <CustomTopZipsLegend />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p style={{ color: CHART_STYLES.title.color }}>
            No zip code data available for the selected organization
          </p>
        </div>
      )}
    </div>
  );
};

export default TopZipCodes;