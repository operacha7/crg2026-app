// src/Utility/UserAction.js
import { supabase } from '../MainApp';

export async function logUserAction({ 
  reg_organization,
  language,
  nav_item,
  search_field,
  search_value,
  action_type,
  // Only accept specific status values that match your db constraint
  status = 'success' // Default to 'success' as before
}) {
  try {
    console.log("Attempting to log action:", { 
      reg_organization, language, nav_item, search_field, search_value, action_type, status
    });
    
    // Create log data
    const logData = {
      reg_organization,
      language,
      nav_item,
      search_field,
      search_value,
      action_type,
      status, // Use the provided status or default
      timestamp: new Date().toISOString()
    };
    
    console.log("Data to log:", logData);
    
    try {
      const { error } = await supabase
        .from('app_usage_logs')
        .insert([logData]);
      
      if (error) {
        console.error('Error details:', error.message, error.details, error.hint);
        return false;
      }
      
      console.log("Successfully logged action");
      return true;
    } catch (insertErr) {
      console.error("Error during insert:", insertErr);
      return false;
    }
  } catch (err) {
    console.error('Exception during logging:', err);
    console.error('Error details:', err.message, err.stack);
    return false;
  }
}

export async function getUsageLogs(timeRange = 'week') {
  try {
    // Set date range based on selection
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case 'day':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
    }
    
    const startDateStr = startDate.toISOString();
    
    // Use timezone conversion in the query
    const { data, error } = await supabase
      .from('app_usage_logs')
      .select('*, timestamp AT TIME ZONE \'America/Chicago\' as local_time')
      .gte('timestamp', startDateStr)
      .order('timestamp', { ascending: false });
      
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error retrieving usage logs:', err);
    return [];
  }
}