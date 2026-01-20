// src/utils/ScheduledReload.js
import { useEffect } from 'react';

/**
 * Component that schedules a page reload at 2 AM Central Time
 */
const ScheduledReload = () => {
  useEffect(() => {
    // Function to calculate milliseconds until next 2 AM Central Time
    const getMillisecondsUntilReload = () => {
      // Get current time in user's timezone
      const now = new Date();
      
      // Convert to Central Time (UTC-6 for CST or UTC-5 for CDT)
      // Determine if Daylight Saving Time is in effect
      const centralTimeOffsetHours = new Date().getTimezoneOffset() / 60;
      const isDST = isDaylightSavingTime(now);
      const centralTimeOffset = isDST ? -5 : -6; // CDT or CST
      
      // Calculate the timezone difference between user's local time and Central Time
      const timezoneDiffHours = centralTimeOffsetHours - (-centralTimeOffset);
      
      // Create today's 2 AM Central Time in user's local time
      let reloadTime = new Date();
      reloadTime.setHours(2 - timezoneDiffHours, 0, 0, 0);
      
      // If it's already past 2 AM Central Time, schedule for tomorrow
      if (now > reloadTime) {
        reloadTime.setDate(reloadTime.getDate() + 1);
      }
      
      // Calculate milliseconds until reload time
      return reloadTime.getTime() - now.getTime();
    };
    
    // Helper function to determine if Daylight Saving Time is in effect in Central Time
    const isDaylightSavingTime = (date) => {
      // This is a simplified check for DST in the US Central Time
      // DST starts second Sunday in March and ends first Sunday in November
      const year = date.getFullYear();
      
      // DST starts second Sunday in March
      const dstStart = new Date(year, 2, 1); // March 1
      const dstStartDay = dstStart.getDay();
      const dstStartDate = dstStart.getDate() + (14 - dstStartDay) % 7; // Second Sunday
      const dstStartFull = new Date(year, 2, dstStartDate, 2, 0, 0);
      
      // DST ends first Sunday in November
      const dstEnd = new Date(year, 10, 1); // November 1
      const dstEndDay = dstEnd.getDay();
      const dstEndDate = dstEnd.getDate() + (7 - dstEndDay) % 7; // First Sunday
      const dstEndFull = new Date(year, 10, dstEndDate, 2, 0, 0);
      
      return date >= dstStartFull && date < dstEndFull;
    };
    
    // Calculate time until next reload
    const msUntilReload = getMillisecondsUntilReload();
    console.log(`Scheduled reload in ${Math.floor(msUntilReload / 3600000)} hours and ${Math.floor((msUntilReload % 3600000) / 60000)} minutes`);
    
    // Set timeout for the reload
    const reloadTimeout = setTimeout(() => {
      console.log('Executing scheduled 2 AM reload');
      window.location.reload();
    }, msUntilReload);
    
    // Clean up the timeout if the component unmounts
    return () => {
      clearTimeout(reloadTimeout);
    };
  }, []);
  
  // This component doesn't render anything
  return null;
};

export default ScheduledReload;