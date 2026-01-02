// src/components/charts/shared/AssistanceUsageLayout.js
import React from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CHART_STYLES = {
  title: {
    fontSize: '24px',
    fontWeight: 'normal',
    color: '#4A4E69',
    marginBottom: '16px'
  }
};

const AssistanceUsageLayout = ({
  data,
  selectedOrg,
  setSelectedOrg,
  organizations,
  loading
}) => {

  const formatMonthHeader = (month) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(year, monthNum - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatChartMonth = (month) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(year, monthNum - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  // Prepare chart data
  const chartData = data.map(item => ({
    month: formatChartMonth(item.month),
    'Food': item['Food'],
    'Rent': item['Rent'],
    'Utilities': item['Utilities'],
    'All Other': item['All Other'],
    'Food Chg': item['Food Change'],
    'Rent Chg': item['Rent Change'],
    'Utilities Chg': item['Utilities Change'],
    'All Other Chg': item['All Other Change'],
    'Total Chg': item['Total Change']
  }));

  // Chart colors matching the mockup
  const chartColors = {
    'Food': '#995C90',
    'Rent': '#D6A76E',
    'Utilities': '#CCC475',
    'All Other': '#C0C0C0'
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold text-gray-800 mb-2">{label}</p>
          {payload.map((entry) => {
            if (entry.dataKey.includes('Chg')) {
              return (
                <p key={entry.dataKey} style={{ color: entry.color }}>
                  {entry.dataKey}: {entry.value}%
                </p>
              );
            } else {
              return (
                <p key={entry.dataKey} style={{ color: entry.color }}>
                  {entry.dataKey}: {entry.value}
                </p>
              );
            }
          })}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg" style={{ color: CHART_STYLES.title.color }}>
          Loading data...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col" style={{ paddingRight: '80px' }}>
      <h2 className="text-2xl mb-4" style={CHART_STYLES.title}>
        Usage Report: Assistance
      </h2>
      
      <div className="mb-6">
        <select 
          className="p-3 border rounded-lg bg-white shadow-sm"
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
        >
          {organizations.map(org => (
            <option key={org} value={org}>{org}</option>
          ))}
        </select>
      </div>

      {data.length > 0 ? (
        <>
          {/* Data Table */}
          <div className="bg-white rounded-lg shadow-lg border overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#4A4E69] text-white">
                  <tr>
                    <th className="p-4 text-left">Assistance</th>
                    {data.map(item => (
                      <th key={item.month} className="p-4 text-right">
                        {formatMonthHeader(item.month)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Food Row */}
                  <tr className="bg-gray-50">
                    <td className="p-4 font-medium text-gray-800">Food</td>
                    {data.map(item => (
                      <td key={item.month} className="p-4 text-right">
                        {item['Food'] > 0 ? (
                          <span className="text-blue-800 px-3 py-1 rounded font-bold">
                            {item['Food']}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  
                  {/* Rent Row */}
                  <tr className="bg-white">
                    <td className="p-4 font-medium text-gray-800">Rent</td>
                    {data.map(item => (
                      <td key={item.month} className="p-4 text-right">
                        {item['Rent'] > 0 ? (
                          <span className="text-blue-800 px-3 py-1 rounded font-bold">
                            {item['Rent']}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Utilities Row */}
                  <tr className="bg-gray-50">
                    <td className="p-4 font-medium text-gray-800">Utilities</td>
                    {data.map(item => (
                      <td key={item.month} className="p-4 text-right">
                        {item['Utilities'] > 0 ? (
                          <span className="text-blue-800 px-3 py-1 rounded font-bold">
                            {item['Utilities']}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* All Other Row */}
                  <tr className="bg-white">
                    <td className="p-4 font-medium text-gray-800">All Other</td>
                    {data.map(item => (
                      <td key={item.month} className="p-4 text-right">
                        {item['All Other'] > 0 ? (
                          <span className="text-blue-800 px-3 py-1 rounded font-bold">
                            {item['All Other']}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Total Row */}
                  <tr className="bg-[#9A8C98] text-white font-bold border-t-2 border-gray-300">
                    <td className="p-4 text-left">TOTAL</td>
                    {data.map(item => (
                      <td key={item.month} className="p-4 text-right">
                        <span className="text-white px-3 py-1 rounded font-bold">
                          {item.total}
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-lg shadow-lg border p-6">
            <h3 className="text-xl mb-4" style={CHART_STYLES.title}>
              Assistance Usage Trends
            </h3>
            
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11, fontWeight: 500 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" 
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                
                {/* Solid lines for counts */}
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="Food" 
                  stroke={chartColors['Food']}
                  strokeWidth={2}
                  name="Food"
                  dot={{ r: 4 }}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="Rent" 
                  stroke={chartColors['Rent']}
                  strokeWidth={2}
                  name="Rent"
                  dot={{ r: 4 }}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="Utilities" 
                  stroke={chartColors['Utilities']}
                  strokeWidth={2}
                  name="Utilities"
                  dot={{ r: 4 }}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="All Other" 
                  stroke={chartColors['All Other']}
                  strokeWidth={2}
                  name="All Other"
                  dot={{ r: 4 }}
                />
                
                {/* Dashed lines for percentage changes */}
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Food Chg" 
                  stroke={chartColors['Food']}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Food Chg %"
                  dot={{ r: 3 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Rent Chg" 
                  stroke={chartColors['Rent']}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Rent Chg %"
                  dot={{ r: 3 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Utilities Chg %" 
                  stroke={chartColors['Utilities']}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Utilities Chg"
                  dot={{ r: 3 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="All Other Chg" 
                  stroke={chartColors['All Other']}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="All Other Chg %"
                  dot={{ r: 3 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Total Chg" 
                  stroke="#333333"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Total Chg %"
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
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

export default AssistanceUsageLayout;