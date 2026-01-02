// src/components/charts/shared/TimeBasedChartsLayout.js
import React from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Legend } from "recharts";
import { ResponsivePie } from '@nivo/pie';
import { useStatistics } from '../../../Contexts/StatisticsContext';
import { formatSelectedDate, getAllOrganizations } from '../utils/chartHelpers';

const TimeBasedChartsLayout = ({
  title,
  dailyAverage,
  totalToday,
  dailyTrend,
  dailyAverageTotal,
  totalTodayCount,
  loading
}) => {
  const { selectedDate, getCentralTimeDate, activeOrgId, setActiveOrgId, getOrganizationColor } = useStatistics();
  
  const organizations = getAllOrganizations(dailyTrend);
  const isToday = selectedDate === getCentralTimeDate();
  const selectedDateLabel = isToday ? 'Today' : formatSelectedDate(selectedDate);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading data...</div>;
  }

  return (
    <div className="w-full space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]" style={{ paddingRight: '80px' }}>
      <h2 className="text-2xl" style={{ color: '#4A4E69' }}>
        {title}
      </h2>
      
      {/* Top row - Two pie charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Average Pie Chart */}
        <div className="border rounded p-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-md" style={{ color: '#4A4E69' }}>Daily Average</h3>
            <span className="text-2xl text-gray-700">{dailyAverageTotal}</span>
          </div>
          <div style={{ height: '400px' }}>
            <ResponsivePie
              data={dailyAverage}
              margin={{ top: 80, right: 80, bottom: 80, left: 80 }}
              innerRadius={0.4}
              padAngle={1}
              cornerRadius={3}
              activeId={activeOrgId}
              onActiveIdChange={setActiveOrgId}
              activeOuterRadiusOffset={8}
              colors={{ datum: 'data.color' }}
              borderWidth={1}
              borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
              enableArcLinkLabels={true}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsTextColor="#4A4E69"
              arcLinkLabelsThickness={2}
              arcLinkLabelsColor={{ from: 'color' }}
              enableArcLabels={false}
              tooltip={({ datum }) => (
                <div className="bg-white p-3 border border-gray-300 rounded shadow-md">
                  <p className="text-sm" style={{ color: '#4A4E69' }}>{datum.label}</p>
                  <p className="text-sm">Daily Average: {datum.value}</p>
                  <p className="text-sm">Total Count: {datum.data.count}</p>
                  <p className="text-sm">Percentage: {((datum.value / dailyAverageTotal) * 100).toFixed(1)}%</p>
                </div>
              )}
            />
          </div>
        </div>
        
        {/* Total Today Pie Chart */}
        <div className="border rounded p-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-md" style={{ color: '#4A4E69' }}>Total {selectedDateLabel}</h3>
            <span className="text-2xl text-gray-700">{totalTodayCount}</span>
          </div>
          <div style={{ height: '400px' }}>
            {totalToday.length > 0 ? (
              <ResponsivePie
                data={totalToday}
                margin={{ top: 80, right: 80, bottom: 80, left: 80 }}
                innerRadius={0.4}
                padAngle={1}
                cornerRadius={3}
                activeId={activeOrgId}
                onActiveIdChange={setActiveOrgId}
                activeOuterRadiusOffset={8}
                colors={{ datum: 'data.color' }}
                borderWidth={1}
                borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                enableArcLinkLabels={true}
                arcLinkLabelsSkipAngle={10}
                arcLinkLabelsTextColor="#4A4E69"
                arcLinkLabelsThickness={2}
                arcLinkLabelsColor={{ from: 'color' }}
                enableArcLabels={false}
                tooltip={({ datum }) => (
                  <div className="bg-white p-3 border border-gray-300 rounded shadow-md">
                    <p className="text-sm" style={{ color: '#4A4E69' }}>{datum.label}</p>
                    <p className="text-sm">{selectedDateLabel}: {datum.value}</p>
                    <p className="text-sm">Percentage: {((datum.value / totalTodayCount) * 100).toFixed(1)}%</p>
                  </div>
                )}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <p className="text-gray-500">No activity for {selectedDateLabel.toLowerCase()}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom row - Combined chart */}
      <div className="border rounded p-4">
        <h3 className="text-md mb-2" style={{ color: '#4A4E69' }}>
          Daily Activity & Running Average (30 Days ending {formatSelectedDate(selectedDate)})
        </h3>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={dailyTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
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
                    if (entry.dataKey !== 'runningAverage') {
                      return sum + (entry.value || 0);
                    }
                    return sum;
                  }, 0);

                  const runningAvgEntry = payload.find(entry => entry.dataKey === 'runningAverage');
                  
                  return (
                    <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                      <p className="text-gray-800 mb-2">{label}</p>
                      <p className="text-sm text-gray-600 mb-2">Total: {totalCount}</p>
                      
                      {payload
                        .filter(entry => entry.dataKey !== 'runningAverage' && entry.value > 0)
                        .sort((a, b) => b.value - a.value)
                        .map((entry, index) => (
                          <p key={index} className="text-sm" style={{ color: entry.color }}>
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
            
            {organizations.map((org, index) => (
              <Bar
                key={org}
                dataKey={org}
                stackId="organizations"
                fill={getOrganizationColor(org)}
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
};

export default TimeBasedChartsLayout;