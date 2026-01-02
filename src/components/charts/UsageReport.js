// src/components/charts/UsageReport.js - Simple display of usage_summary_monthly data
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { supabase } from '../../MainApp';

const UsageReport = () => {
  const [data, setData] = useState([]);
  const [organizations, setOrganizations] = useState(['All']);
  const [selectedOrg, setSelectedOrg] = useState('All');
  const [loading, setLoading] = useState(true);

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

  // Fetch organizations list (once on mount)
  const fetchOrganizations = async () => {
    try {
      const { data: rawData, error } = await supabase
        .from('usage_summary_monthly')
        .select('reg_organization');
      
      if (error) throw error;
      
      const uniqueOrgs = ['All', ...[...new Set(rawData?.map(r => r.reg_organization) || [])].sort()];
      setOrganizations(uniqueOrgs);
      
    } catch (error) {
      console.error('Error fetching organizations:', error);
      setOrganizations(['All']);
    }
  };

  // Fetch data from usage_summary_monthly (filtered by organization)
  const fetchData = async (organization = 'All') => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('usage_summary_monthly')
        .select('*');

      if (organization !== 'All') {
        query = query.eq('reg_organization', organization);
      }

      const { data: rawData, error } = await query;
      
      if (error) throw error;

      // Get unique months and sort them
      const uniqueMonths = [...new Set(rawData?.map(r => r.month) || [])].sort();

      // Group data by search_field
      const groupedData = {};
      rawData?.forEach(row => {
        const searchField = row.search_field;
        if (!groupedData[searchField]) {
          groupedData[searchField] = {};
        }
        groupedData[searchField][row.month] = (groupedData[searchField][row.month] || 0) + row.usage_count;
      });

      // Convert to array format with months as columns
      const tableData = {
        months: uniqueMonths,
        searchFields: Object.keys(groupedData).sort().map(searchField => ({
          search_field: searchField,
          monthData: groupedData[searchField]
        }))
      };

      setData(tableData);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setData({ months: [], searchFields: [] });
    } finally {
      setLoading(false);
    }
  };

  // Load organizations once on mount, then load data
  useEffect(() => {
    fetchOrganizations();
  }, []);

  // Load data when organization selection changes
  useEffect(() => {
    if (organizations.length > 1) { // Wait until organizations are loaded
      fetchData(selectedOrg);
    }
  }, [selectedOrg, organizations]);

  const formatMonthHeader = (month) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(year, monthNum - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Process data for Recharts - separate into 6 main categories in alphabetical order
  const chartData = data.months ? data.months.map(month => {
    let assistanceTotal = 0;
    let createPdfTotal = 0;
    let organizationTotal = 0;
    let sendEmailTotal = 0;
    let zipCodeTotal = 0;
    let allOthersTotal = 0;
    
    data.searchFields.forEach(row => {
      const searchField = row.search_field?.toLowerCase() || '';
      const value = row.monthData[month] || 0;
      
      if (searchField.includes('assistance')) {
        assistanceTotal += value;
      } else if (searchField.includes('create pdf')) {
        createPdfTotal += value;
      } else if (searchField.includes('organization')) {
        organizationTotal += value;
      } else if (searchField.includes('send email')) {
        sendEmailTotal += value;
      } else if (searchField.includes('zip')) {
        zipCodeTotal += value;
      } else {
        allOthersTotal += value;
      }
    });
    
    return {
      month: formatMonthHeader(month),
      assistance: assistanceTotal,
      'Create Pdf': createPdfTotal,
      organization: organizationTotal,
      'Send Email': sendEmailTotal,
      'zip code': zipCodeTotal,
      'All Others': allOthersTotal
    };
  }) : [];

  // Chart colors - 6 categories in alphabetical order
  const chartColors = {
    'assistance': '#995C90',
    'Create Pdf': '#D6A76E',
    'organization': '#5C6B9E',
    'Send Email': '#CCC475',
    'zip code': '#74B069',
    'All Others': '#C0C0C0'
  };

  // Custom Legend Component
  const CustomUsageLegend = () => {
    const categories = ['assistance', 'Create Pdf', 'organization', 'Send Email', 'zip code', 'All Others'];
    
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4 px-4">
        {categories.map((category) => (
          <div key={category} className="flex items-center space-x-2">
            <div 
              className="w-4 h-4 rounded"
              style={{ backgroundColor: chartColors[category] }}
            />
            <span className="text-sm font-medium text-gray-700">
              {category}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Chart component using Recharts
  const Chart = () => {
    if (!chartData || chartData.length === 0) return null;
    
    const categories = ['All Others', 'zip code', 'Send Email', 'organization', 'Create Pdf', 'assistance'];

    return (
      <div className="mt-8">
        <h3 className="text-2xl mb-4" style={CHART_STYLES.title}>
          Search Usage Trends
        </h3>
        
        <BarChart 
          data={chartData} 
          width={window.innerWidth * 0.95} 
          height={400}
          margin={CHART_STYLES.margins}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 11, fontWeight: 500 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            tick={{ fontSize: 13, fontWeight: 500 }}
            
          />
          <Tooltip />
          
          {/* Map categories to Bar components with colors */}
          {categories.map((category) => (
            <Bar 
              key={category}
              dataKey={category} 
              stackId="usage"
              fill={chartColors[category]}
              name={category}
            />
          ))}
        </BarChart>
        <CustomUsageLegend />
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col">
      <h2 className="text-2xl mb-4" style={CHART_STYLES.title}>
        Search Usage Report
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
      
      {loading ? (
        <div className="flex justify-center items-center h-64">Loading data...</div>
      ) : data.months && data.months.length > 0 ? (
        <>
          <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#4A4E69] text-white">
                  <tr>
                    <th className="p-4 text-left">Search Type</th>
                    {data.months.map(month => (
                      <th key={month} className="p-4 text-right">
                        {formatMonthHeader(month)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Show the 6 consolidated categories */}
                  {['assistance', 'Create Pdf', 'organization', 'Send Email', 'zip code', 'All Others'].map((category, index) => {
                    // Calculate totals for this category across all months
                    const categoryTotals = {};
                    let grandTotal = 0;
                    
                    data.months.forEach(month => {
                      let monthTotal = 0;
                      
                      data.searchFields.forEach(row => {
                        const searchField = row.search_field?.toLowerCase() || '';
                        const value = row.monthData[month] || 0;
                        
                        let belongsToCategory = false;
                        if (category === 'assistance' && searchField.includes('assistance')) {
                          belongsToCategory = true;
                        } else if (category === 'Create Pdf' && searchField.includes('create pdf')) {
                          belongsToCategory = true;
                        } else if (category === 'organization' && searchField.includes('organization')) {
                          belongsToCategory = true;
                        } else if (category === 'Send Email' && searchField.includes('send email')) {
                          belongsToCategory = true;
                        } else if (category === 'zip code' && searchField.includes('zip')) {
                          belongsToCategory = true;
                        } else if (category === 'All Others' && 
                                   !searchField.includes('assistance') && 
                                   !searchField.includes('create pdf') && 
                                   !searchField.includes('organization') && 
                                   !searchField.includes('send email') && 
                                   !searchField.includes('zip')) {
                          belongsToCategory = true;
                        }
                        
                        if (belongsToCategory) {
                          monthTotal += value;
                        }
                      });
                      
                      categoryTotals[month] = monthTotal;
                      grandTotal += monthTotal;
                    });
                    
                    // Only show row if it has data
                    if (grandTotal > 0) {
                      return (
                        <tr 
                          key={category}
                          className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                        >
                          <td className="p-4 font-medium text-gray-800">
                            {category}
                          </td>
                          {data.months.map(month => (
                            <td key={month} className="p-4 text-right">
                              {categoryTotals[month] > 0 ? (
                                <span className="text-blue-800 px-3 py-1 rounded font-bold">
                                  {categoryTotals[month]}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    }
                    return null;
                  })}
                  
                  {/* Add Total Row */}
                  <tr className="bg-[#9A8C98] text-white font-bold border-t-2 border-gray-300">
                    <td className="p-4 text-left">
                      TOTAL
                    </td>
                    {data.months.map(month => {
                      const monthTotal = data.searchFields.reduce((total, row) => {
                        return total + (row.monthData[month] || 0);
                      }, 0);
                      
                      return (
                        <td key={month} className="p-4 text-right">
                          <span className="text-white px-3 py-1 rounded font-bold">
                            {monthTotal}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <Chart />
        </>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p>Loading...</p>
        </div>
      )}
    </div>
  );
};

export default UsageReport;