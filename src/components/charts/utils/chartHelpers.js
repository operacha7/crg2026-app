// src/components/charts/utils/chartHelpers.js
export const formatSelectedDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/Chicago'
    });
  };
  
  export const getAllOrganizations = (trendData) => {
    if (!trendData || trendData.length === 0) return [];
    
    const orgSet = new Set();
    trendData.forEach(day => {
      Object.keys(day).forEach(key => {
        if (key !== 'date' && key !== 'fullDate' && key !== 'runningAverage' && key !== 'dailyCount') {
          orgSet.add(key);
        }
      });
    });
    
    return Array.from(orgSet).sort();
  };
  
  export const processDataForTopN = (data, maxItems = 9, getOrganizationColor) => {
    if (!data || data.length === 0) return [];
    
    const sortedData = [...data].sort((a, b) => b.value - a.value);
    
    if (sortedData.length <= maxItems) {
      return sortedData.map(item => ({
        ...item,
        color: getOrganizationColor(item.name)
      }));
    }
    
    const topItems = sortedData.slice(0, maxItems - 1);
    const remainingItems = sortedData.slice(maxItems - 1);
    const othersTotal = remainingItems.reduce((sum, item) => sum + item.value, 0);
    
    const result = topItems.map(item => ({
      ...item,
      color: getOrganizationColor(item.name)
    }));
    
    if (othersTotal > 0) {
      result.push({
        name: 'Others',
        value: othersTotal,
        color: '#CCCCCC',
        count: remainingItems.length
      });
    }
    
    return result;
  };