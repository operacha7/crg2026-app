// src/components/charts/containers/EmailChartsContainer.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../MainApp';
import { useStatistics } from '../../../Contexts/StatisticsContext';
import { processDataForTopN } from '../utils/chartHelpers';
import TimeBasedChartsLayout from '../shared/TimeBasedChartsLayout';

const EmailChartsContainer = () => {
  const { selectedDate, getCentralTimeDate, getOrganizationColor } = useStatistics();
  
  const [emailDailyAverage, setEmailDailyAverage] = useState([]);
  const [emailTotalToday, setEmailTotalToday] = useState([]);
  const [emailDailyTrend, setEmailDailyTrend] = useState([]);
  const [emailDailyAverageTotal, setEmailDailyAverageTotal] = useState(0);
  const [emailTotalTodayCount, setEmailTotalTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEmailCharts = useCallback(async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const selectedDay = selectedDate || getCentralTimeDate(now);
      const thirtyDaysAgo = new Date(selectedDay + 'T12:00:00');
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = getCentralTimeDate(thirtyDaysAgo);
      
      // 1. Fetch rolling 30-day average data - Email only
      const { data: dailyAvgData, error: dailyAvgError } = await supabase
        .from('app_usage_logs')
        .select('reg_organization, date')
        .eq('action_type', 'email')  // Email only
        .neq('reg_organization', 'Administrator')
        .gte('date', thirtyDaysAgoStr)
        .lte('date', selectedDay)
        .order('date');
      
      if (dailyAvgError) throw dailyAvgError;
      
      // Process rolling 30-day average data
      const orgCounts = {};
      dailyAvgData.forEach(record => {
        if (!orgCounts[record.reg_organization]) {
          orgCounts[record.reg_organization] = 0;
        }
        orgCounts[record.reg_organization]++;
      });
      
      const dailyAverages = [];
      let totalDailyAvg = 0;
      
      Object.entries(orgCounts).forEach(([org, count]) => {
        const dailyAvg = count / 30;
        dailyAverages.push({
          id: org,
          label: org,
          value: parseFloat(dailyAvg.toFixed(2)),
          count: count
        });
        totalDailyAvg += dailyAvg;
      });
      
      const processedDailyAvg = processDataForTopN(
        dailyAverages.map(item => ({ ...item, name: item.label })),
        9,
        getOrganizationColor
      ).map(item => ({
        id: item.name,
        label: item.name,
        value: item.value,
        count: item.count,
        color: item.color
      }));
      
      setEmailDailyAverage(processedDailyAvg);
      setEmailDailyAverageTotal(parseFloat(totalDailyAvg.toFixed(1)));
      
      // 2. Fetch selected date's data - Email only
      const { data: selectedDateData, error: selectedDateError } = await supabase
        .from('app_usage_logs')
        .select('reg_organization')
        .eq('action_type', 'email')  // Email only
        .neq('reg_organization', 'Administrator')
        .eq('date', selectedDay);
      
      if (selectedDateError) throw selectedDateError;
      
      const selectedDateCounts = {};
      selectedDateData.forEach(record => {
        if (!selectedDateCounts[record.reg_organization]) {
          selectedDateCounts[record.reg_organization] = 0;
        }
        selectedDateCounts[record.reg_organization]++;
      });
      
      const selectedDateTotals = Object.entries(selectedDateCounts).map(([org, count]) => ({
        name: org,
        value: count
      }));
      
      const processedSelectedDateTotals = processDataForTopN(selectedDateTotals, 9, getOrganizationColor).map(item => ({
        id: item.name,
        label: item.name,
        value: item.value,
        color: item.color
      }));
      
      setEmailTotalToday(processedSelectedDateTotals);
      setEmailTotalTodayCount(selectedDateData.length);
      
      // 3. Fetch daily trend data - Email only
      const { data: trendData, error: trendError } = await supabase
        .from('app_usage_logs')
        .select('date, reg_organization')
        .eq('action_type', 'email')  // Email only
        .neq('reg_organization', 'Administrator')
        .gte('date', thirtyDaysAgoStr)
        .lte('date', selectedDay)
        .order('date');

      if (trendError) throw trendError;

      // Process trend data
      const dailyOrgCounts = {};
      const allOrganizations = new Set();

      trendData.forEach(record => {
        const date = record.date;
        const org = record.reg_organization;
        
        allOrganizations.add(org);
        
        if (!dailyOrgCounts[date]) {
          dailyOrgCounts[date] = {};
        }
        
        if (!dailyOrgCounts[date][org]) {
          dailyOrgCounts[date][org] = 0;
        }
        
        dailyOrgCounts[date][org]++;
      });

      const trendArray = [];
      let runningTotal = 0;
      let dayCount = 0;

      const selectedDateObj = new Date(selectedDay + 'T12:00:00');

      for (let i = 29; i >= 0; i--) {
        const date = new Date(selectedDateObj);
        date.setDate(selectedDateObj.getDate() - i);
        const dateStr = getCentralTimeDate(date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' });
        const monthDay = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', timeZone: 'America/Chicago' });
        
        const dayData = {
          date: `${monthDay} ${dayName}`,
          fullDate: dateStr
        };
        
        let totalForDay = 0;
        allOrganizations.forEach(org => {
          const count = dailyOrgCounts[dateStr]?.[org] || 0;
          dayData[org] = count;
          totalForDay += count;
        });
        
        runningTotal += totalForDay;
        dayCount++;
        dayData.runningAverage = parseFloat((runningTotal / dayCount).toFixed(1));
        dayData.dailyCount = totalForDay;
        
        trendArray.push(dayData);
      }

      setEmailDailyTrend(trendArray);
      
    } catch (error) {
      console.error('Error fetching email charts:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, getCentralTimeDate, getOrganizationColor]);

  useEffect(() => {
    fetchEmailCharts();
  }, [fetchEmailCharts]);

  return (
    <TimeBasedChartsLayout
      title="Number of Emails Per Day"
      dailyAverage={emailDailyAverage}
      totalToday={emailTotalToday}
      dailyTrend={emailDailyTrend}
      dailyAverageTotal={emailDailyAverageTotal}
      totalTodayCount={emailTotalTodayCount}
      loading={loading}
    />
  );
};

export default EmailChartsContainer;