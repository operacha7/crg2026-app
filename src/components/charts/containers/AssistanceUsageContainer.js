// src/components/charts/containers/AssistanceUsageContainer.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../MainApp';
import { useStatistics } from '../../../Contexts/StatisticsContext';
import AssistanceUsageLayout from '../shared/AssistanceUsageLayout';

const AssistanceUsageContainer = () => {
  const { selectedDate, getCentralTimeDate } = useStatistics(); // Removed organizations from here
  
  const [assistanceData, setAssistanceData] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('All');
  const [organizations, setOrganizations] = useState(['All']); // Add local organizations state
  const [loading, setLoading] = useState(true);

  // Fetch organizations using the PostgreSQL function
  const fetchOrganizations = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_distinct_organizations');

      if (error) throw error;

      console.log('Organizations from RPC:', data);
      
      // The RPC returns an array of objects with 'organization' property
      const organizations = data.map(item => item.organization).filter(org => org);
      
      setOrganizations(['All', ...organizations]);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      setOrganizations(['All']);
    }
  }, []);

  // Assistance value mapping for search_value when search_field = "assistance"
  const getStandardizedAssistanceValue = (searchValue) => {
    if (!searchValue) return 'All Other';
    
    const assistanceMap = {
      'Food': 'Food',
      'Alimento': 'Food',    // Spanish -> English
      'Rent': 'Rent', 
      'Alojamiento': 'Rent',  // Spanish -> English
      'Utilities': 'Utilities',
      'Servicios Públicos': 'Utilities' // Spanish -> English
    };
    
    // Handle comma-separated values
    const values = searchValue.split(',').map(val => val.trim());
    const standardizedValues = values.map(val => assistanceMap[val] || 'All Other');
    
    // Return the most specific value (prioritize known categories)
    if (standardizedValues.includes('Food')) return 'Food';
    if (standardizedValues.includes('Rent')) return 'Rent';
    if (standardizedValues.includes('Utilities')) return 'Utilities';
    return 'All Other';
  };

  const fetchAssistanceData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Calculate date range: 12 months ending with selectedDate
      const endDate = selectedDate || getCentralTimeDate();
      const endDateObj = new Date(endDate + 'T12:00:00');
      const startDateObj = new Date(endDateObj);
      startDateObj.setMonth(startDateObj.getMonth() - 11); // 11 months back for 12 total months
      const startDateStr = getCentralTimeDate(startDateObj);
      
      console.log(`Fetching assistance data from ${startDateStr} to ${endDate}`);
      
      // Fetch ALL assistance data using pagination to avoid 1000 record limit
      let allData = [];
      let hasMore = true;
      let offset = 0;
      const pageSize = 1000;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('app_usage_logs')
          .select('search_value, reg_organization, date, action_type')
          .eq('search_field', 'assistance')
          .neq('action_type', 'deselect')
          .neq('reg_organization', 'Administrator')
          .not('search_value', 'is', null)
          .gte('date', startDateStr)
          .lte('date', endDate)
          .range(offset, offset + pageSize - 1)
          .order('date');

        if (error) throw error;

        console.log(`Fetched batch ${offset}-${offset + pageSize}: ${data.length} records`);
        
        allData = [...allData, ...data];
        
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }

      console.log(`Total assistance records fetched: ${allData.length}`);

      // Filter by organization if selected
      const filteredData = selectedOrg === 'All' 
        ? allData 
        : allData.filter(record => record.reg_organization === selectedOrg);

      console.log(`Records after org filter: ${filteredData.length}`);

      // Process data into monthly totals with standardized assistance values
      const monthlyData = {};
      
      filteredData.forEach(record => {
        const monthKey = record.date.substring(0, 7); // YYYY-MM
        const standardizedValue = getStandardizedAssistanceValue(record.search_value);
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            'Food': 0,
            'Rent': 0,
            'Utilities': 0,
            'All Other': 0
          };
        }
        
        monthlyData[monthKey][standardizedValue]++;
      });

      console.log('Monthly data breakdown:', monthlyData);

      // Generate 12 months of data (fill missing months with zeros)
      const processedData = [];

      console.log(`Generating months from ${startDateStr} to ${endDate}`);

      // Generate exactly 12 months starting from startDateObj
      for (let i = 0; i < 12; i++) {
        const currentMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth() + i, 1);
        
        const monthKey = getCentralTimeDate(currentMonth).substring(0, 7); // YYYY-MM
        const monthData = monthlyData[monthKey] || { 'Food': 0, 'Rent': 0, 'Utilities': 0, 'All Other': 0 };
        
        processedData.push({
          month: monthKey,
          'Food': monthData['Food'],
          'Rent': monthData['Rent'],
          'Utilities': monthData['Utilities'],
          'All Other': monthData['All Other'],
          total: monthData['Food'] + monthData['Rent'] + monthData['Utilities'] + monthData['All Other']
        });
        
        console.log(`Generated month: ${monthKey}`);
      }

      console.log('Final processed data:', processedData);

      // Calculate percentage changes
      const dataWithChanges = processedData.map((current, index) => {
        if (index === 0) {
          return {
            ...current,
            'Food Change': 0,
            'Rent Change': 0,
            'Utilities Change': 0,
            'All Other Change': 0,
            'Total Change': 0
          };
        }
        
        const previous = processedData[index - 1];
        
        const foodChange = previous['Food'] === 0 
          ? (current['Food'] > 0 ? 100 : 0)
          : ((current['Food'] - previous['Food']) / previous['Food']) * 100;
          
        const rentChange = previous['Rent'] === 0 
          ? (current['Rent'] > 0 ? 100 : 0)
          : ((current['Rent'] - previous['Rent']) / previous['Rent']) * 100;
          
        const utilitiesChange = previous['Utilities'] === 0 
          ? (current['Utilities'] > 0 ? 100 : 0)
          : ((current['Utilities'] - previous['Utilities']) / previous['Utilities']) * 100;
          
        const allOtherChange = previous['All Other'] === 0 
          ? (current['All Other'] > 0 ? 100 : 0)
          : ((current['All Other'] - previous['All Other']) / previous['All Other']) * 100;
          
        const totalChange = previous.total === 0 
          ? (current.total > 0 ? 100 : 0)
          : ((current.total - previous.total) / previous.total) * 100;

        return {
          ...current,
          'Food Change': Math.round(foodChange * 10) / 10,
          'Rent Change': Math.round(rentChange * 10) / 10,
          'Utilities Change': Math.round(utilitiesChange * 10) / 10,
          'All Other Change': Math.round(allOtherChange * 10) / 10,
          'Total Change': Math.round(totalChange * 10) / 10
        };
      });

      setAssistanceData(dataWithChanges);
      
    } catch (error) {
      console.error('Error fetching assistance data:', error);
      setAssistanceData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedOrg, getCentralTimeDate]);

  // Fetch organizations on component mount
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchAssistanceData();
  }, [fetchAssistanceData]);

  return (
    <AssistanceUsageLayout
      data={assistanceData}
      selectedOrg={selectedOrg}
      setSelectedOrg={setSelectedOrg}
      organizations={organizations} // Now using local organizations
      loading={loading}
    />
  );
};

export default AssistanceUsageContainer;