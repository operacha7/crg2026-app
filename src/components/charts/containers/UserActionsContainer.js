// src/components/charts/containers/UserActionsContainer.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../MainApp';
import { useStatistics } from '../../../Contexts/StatisticsContext';
import UserActionsLayout from '../shared/UserActionsLayout';

const UserActionsContainer = () => {
  const { selectedDate, getCentralTimeDate } = useStatistics(); // Removed organizations from here
  
  const [userActionsData, setUserActionsData] = useState([]);
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

  const fetchUserActionsData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Calculate date range: 12 months ending with selectedDate
      const endDate = selectedDate || getCentralTimeDate();
      const endDateObj = new Date(endDate + 'T12:00:00');
      const startDateObj = new Date(endDateObj);
      startDateObj.setMonth(startDateObj.getMonth() - 11); // 11 months back for 12 total months
      const startDateStr = getCentralTimeDate(startDateObj);
      
      console.log(`Fetching user actions data from ${startDateStr} to ${endDate}`);
      
      // Fetch ALL user actions data using pagination to avoid 1000 record limit
      let allData = [];
      let hasMore = true;
      let offset = 0;
      const pageSize = 1000;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('app_usage_logs')
          .select('search_field, reg_organization, date')
          .in('search_field', ['Create Pdf', 'Send Email'])
          .neq('reg_organization', 'Administrator')
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

      console.log(`Total user actions records fetched: ${allData.length}`);

      // Filter by organization if selected
      const filteredData = selectedOrg === 'All' 
        ? allData 
        : allData.filter(record => record.reg_organization === selectedOrg);

      console.log(`Records after org filter: ${filteredData.length}`);

      // Process data into monthly totals
      const monthlyData = {};
      
      filteredData.forEach(record => {
        const monthKey = record.date.substring(0, 7); // YYYY-MM
        const actionType = record.search_field;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            'Create Pdf': 0,
            'Send Email': 0
          };
        }
        
        monthlyData[monthKey][actionType]++;
      });

      console.log('Monthly data breakdown:', monthlyData);

      // Generate 12 months of data (fill missing months with zeros)
      const processedData = [];

      console.log(`Generating months from ${startDateStr} to ${endDate}`);

      // Generate exactly 12 months starting from startDateObj
      for (let i = 0; i < 12; i++) {
        const currentMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth() + i, 1);
        
        const monthKey = getCentralTimeDate(currentMonth).substring(0, 7); // YYYY-MM
        const monthData = monthlyData[monthKey] || { 'Create Pdf': 0, 'Send Email': 0 };
        
        processedData.push({
          month: monthKey,
          'Create Pdf': monthData['Create Pdf'],
          'Send Email': monthData['Send Email'],
          total: monthData['Create Pdf'] + monthData['Send Email']
        });
        
        console.log(`Generated month: ${monthKey}`);
      }

      console.log('Final processed data:', processedData);

      // Calculate percentage changes
      const dataWithChanges = processedData.map((current, index) => {
        if (index === 0) {
          return {
            ...current,
            'Create Pdf Change': 0,
            'Send Email Change': 0,
            'Total Change': 0
          };
        }
        
        const previous = processedData[index - 1];
        
        const pdfChange = previous['Create Pdf'] === 0 
          ? (current['Create Pdf'] > 0 ? 100 : 0)
          : ((current['Create Pdf'] - previous['Create Pdf']) / previous['Create Pdf']) * 100;
          
        const emailChange = previous['Send Email'] === 0 
          ? (current['Send Email'] > 0 ? 100 : 0)
          : ((current['Send Email'] - previous['Send Email']) / previous['Send Email']) * 100;
          
        const totalChange = previous.total === 0 
          ? (current.total > 0 ? 100 : 0)
          : ((current.total - previous.total) / previous.total) * 100;

        return {
          ...current,
          'Create Pdf Change': Math.round(pdfChange * 10) / 10,
          'Send Email Change': Math.round(emailChange * 10) / 10,
          'Total Change': Math.round(totalChange * 10) / 10
        };
      });

      setUserActionsData(dataWithChanges);
      
    } catch (error) {
      console.error('Error fetching user actions data:', error);
      setUserActionsData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedOrg, getCentralTimeDate]);

  // Fetch organizations on component mount
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchUserActionsData();
  }, [fetchUserActionsData]);

  return (
    <UserActionsLayout
      data={userActionsData}
      selectedOrg={selectedOrg}
      setSelectedOrg={setSelectedOrg}
      organizations={organizations} // Now using local organizations
      loading={loading}
    />
  );
};

export default UserActionsContainer;