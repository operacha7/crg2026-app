// src/components/charts/shared/RankingChartsLayout.js
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useStatistics } from '../../../Contexts/StatisticsContext';

const CHART_STYLES = {
  title: {
    fontSize: '24px',
    fontWeight: 'normal',
    color: '#4A4E69',
    marginBottom: '16px'
  },
  margins: { top: 20, right: 30, left: 60, bottom: 5 },
};

const RankingChartsLayout = ({ 
  title,
  data,
  dataKey, // 'zip' or 'organization'
  yAxisWidth = 60,
  customYAxisTick = null,
  customTooltip,
  loading,
  selectedOrg,
  onOrgChange,
  organizations
}) => {
  const { getOrganizationColor } = useStatistics();
  const [allOrganizations, setAllOrganizations] = useState([]);

  // Helper function to add opacity to colors
  const addOpacityToColor = (color, opacity = 0.7) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Extract organizations from data when data changes
  useEffect(() => {
    if (data && data.length > 0) {
      const orgsSet = new Set();
      data.forEach(item => {
        Object.keys(item).forEach(key => {
          if (key !== dataKey && key !== 'totalCount' && key !== 'Administrator' && item[key] > 0) {
            orgsSet.add(key);
          }
        });
      });
      setAllOrganizations(Array.from(orgsSet));
    } else {
      setAllOrganizations([]);
    }
  }, [data, dataKey]);

  // Custom Legend Component
  const CustomLegend = () => {
    if (allOrganizations.length === 0) {
      return <div className="text-center text-gray-500 mt-4">No organizations to display</div>;
    }
    
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4 px-4">
        {allOrganizations.map((org) => (
          <div key={org} className="flex items-center space-x-2">
            <div 
              className="w-4 h-4 rounded"
              style={{ 
                backgroundColor: addOpacityToColor(getOrganizationColor(org), 0.8)
              }}
            />
            <span className="text-sm font-medium text-gray-700">
              {org}
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

  return (
    <div className="w-full flex flex-col">
      <h2 className="text-2xl mb-4" style={CHART_STYLES.title}>
        {title}
      </h2>
      
      {/* Organization filter dropdown */}
      <div className="mb-4">
        <select 
          className="p-2 border rounded"
          value={selectedOrg}
          onChange={(e) => onOrgChange && onOrgChange(e.target.value)}
        >
          {organizations && organizations.map(org => (
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
            <XAxis type="number" />
            <YAxis 
              dataKey={dataKey}
              type="category" 
              interval={0}
              width={yAxisWidth}
              tick={customYAxisTick || { fontSize: 15, fontWeight: 500 }}
            />
            <Tooltip content={customTooltip} />
            
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
          <CustomLegend />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p style={{ color: CHART_STYLES.title.color }}>
            No data available for the selected organization
          </p>
        </div>
      )}
    </div>
  );
};

export default RankingChartsLayout;