// src/components/charts/containers/SearchActivityContainer.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../MainApp';
import { useStatistics } from '../../../Contexts/StatisticsContext';
import SearchActivityLayout from '../shared/SearchActivityLayout';

const SearchActivityContainer = () => {
  const { selectedDate, getCentralTimeDate } = useStatistics(); // Removed organizations from here
  
  const [searchActivityData, setSearchActivityData] = useState([]);
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

  // Search field mapping
  const getStandardizedSearchField = (searchField) => {
    const searchFieldMap = {
      'organization': 'Organization',
      'zip code': 'Zip Code',
      'day': 'Search',
      'neighborhood': 'Search',
      'requirements': 'Search'
    };
    
    return searchFieldMap[searchField] || searchField;
  };

  const fetchSearchActivityData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Calculate date range: 12 months ending with selectedDate
      const endDate = selectedDate || getCentralTimeDate();
      const endDateObj = new Date(endDate + 'T12:00:00');
      const startDateObj = new Date(endDateObj);
      startDateObj.setMonth(startDateObj.getMonth() - 11); // 11 months back for 12 total months
      const startDateStr = getCentralTimeDate(startDateObj);
      
      console.log(`Fetching search activity data from ${startDateStr} to ${endDate}`);
      
      // Fetch ALL search activity data using pagination to avoid 1000 record limit
      let allData = [];
      let hasMore = true;
      let offset = 0;
      const pageSize = 1000;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('app_usage_logs')
          .select('search_field, reg_organization, date')
          .not('search_field', 'in', '("Create Pdf","Send Email","assistance")')
          .neq('reg_organization', 'Administrator')
          .not('search_field', 'is', null)
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

      console.log(`Total search activity records fetched: ${allData.length}`);

      // Filter by organization if selected
      const filteredData = selectedOrg === 'All' 
        ? allData 
        : allData.filter(record => record.reg_organization === selectedOrg);

      console.log(`Records after org filter: ${filteredData.length}`);

      // Process data into monthly totals with standardized search fields
      const monthlyData = {};
      
      filteredData.forEach(record => {
        const monthKey = record.date.substring(0, 7); // YYYY-MM
        const standardizedField = getStandardizedSearchField(record.search_field);
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            'Organization': 0,
            'Search': 0,
            'Zip Code': 0
          };
        }
        
        if (monthlyData[monthKey][standardizedField] !== undefined) {
          monthlyData[monthKey][standardizedField]++;
        }
      });

      console.log('Monthly data breakdown:', monthlyData);

      // Generate 12 months of data (fill missing months with zeros)
      const processedData = [];

      console.log(`Generating months from ${startDateStr} to ${endDate}`);

      // Generate exactly 12 months starting from startDateObj
      for (let i = 0; i < 12; i++) {
        const currentMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth() + i, 1);
        
        const monthKey = getCentralTimeDate(currentMonth).substring(0, 7); // YYYY-MM
        const monthData = monthlyData[monthKey] || { 'Organization': 0, 'Search': 0, 'Zip Code': 0 };
        
        processedData.push({
          month: monthKey,
          'Organization': monthData['Organization'],
          'Search': monthData['Search'],
          'Zip Code': monthData['Zip Code'],
          total: monthData['Organization'] + monthData['Search'] + monthData['Zip Code']
        });
        
        console.log(`Generated month: ${monthKey}`);
      }

      console.log('Final processed data:', processedData);

      // Calculate percentage changes
      const dataWithChanges = processedData.map((current, index) => {
        if (index === 0) {
          return {
            ...current,
            'Organization Change': 0,
            'Search Change': 0,
            'Zip Code Change': 0,
            'Total Change': 0
          };
        }
        
        const previous = processedData[index - 1];
        
        const orgChange = previous['Organization'] === 0 
          ? (current['Organization'] > 0 ? 100 : 0)
          : ((current['Organization'] - previous['Organization']) / previous['Organization']) * 100;
          
        const searchChange = previous['Search'] === 0 
          ? (current['Search'] > 0 ? 100 : 0)
          : ((current['Search'] - previous['Search']) / previous['Search']) * 100;
          
        const zipChange = previous['Zip Code'] === 0 
          ? (current['Zip Code'] > 0 ? 100 : 0)
          : ((current['Zip Code'] - previous['Zip Code']) / previous['Zip Code']) * 100;
          
        const totalChange = previous.total === 0 
          ? (current.total > 0 ? 100 : 0)
          : ((current.total - previous.total) / previous.total) * 100;

        return {
          ...current,
          'Organization Change': Math.round(orgChange * 10) / 10,
          'Search Change': Math.round(searchChange * 10) / 10,
          'Zip Code Change': Math.round(zipChange * 10) / 10,
          'Total Change': Math.round(totalChange * 10) / 10
        };
      });

      setSearchActivityData(dataWithChanges);
      
    } catch (error) {
      console.error('Error fetching search activity data:', error);
      setSearchActivityData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedOrg, getCentralTimeDate]);

  // Fetch organizations on component mount
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchSearchActivityData();
  }, [fetchSearchActivityData]);

  return (
    <SearchActivityLayout
      data={searchActivityData}
      selectedOrg={selectedOrg}
      setSelectedOrg={setSelectedOrg}
      organizations={organizations} // Now using local organizations
      loading={loading}
    />
  );
};

export default SearchActivityContainer;