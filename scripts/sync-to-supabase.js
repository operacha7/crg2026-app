const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Debug - let's see what's loaded
console.log('REACT_APP_SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL);
console.log('REACT_APP_SUPABASE_SECRET_KEY:', process.env.REACT_APP_SUPABASE_SECRET_KEY ? 'Found (hidden)' : 'NOT FOUND');

// Configuration
const SPREADSHEET_ID = '1m3-OHykdj7S_9fGdyJmFkgjNMQ9FA4BAmuyf4khMm7w';

const TABLES = [
  { sheetName: 'directory', supabaseTable: 'directory' },
  { sheetName: 'zip_codes', supabaseTable: 'zip_codes' },
  { sheetName: 'assistance', supabaseTable: 'assistance' },
  { sheetName: 'organizations', supabaseTable: 'organizations' },
  { sheetName: 'registered_organizations', supabaseTable: 'registered_organizations' },
];

// Columns that contain JSON data and should be parsed before inserting
const JSON_COLUMNS = ['org_hours'];

// Initialize Supabase
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_SECRET_KEY
);

// Initialize Google Sheets
async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(__dirname, 'google-credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// Fetch data from a Google Sheet tab
async function fetchSheetData(sheets, sheetName) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    console.log(`No data found in ${sheetName}`);
    return [];
  }

  const headers = rows[0];
  const data = rows.slice(1).map((row, rowIndex) => {
    const obj = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.toLowerCase().replace(/\s+/g, '_');
      let value = row[index] || null;
      
      // Parse JSON columns so they're stored as objects, not strings
      if (value && JSON_COLUMNS.includes(cleanHeader)) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          console.warn(`  Warning: Row ${rowIndex + 2} - Could not parse JSON in "${cleanHeader}":`, value.substring(0, 50) + '...');
          // Keep original value if parsing fails
        }
      }
      
      obj[cleanHeader] = value;
    });
    return obj;
  });

  return data;
}

// Upload data to Supabase (delete all, then insert)
async function uploadToSupabase(tableName, data) {
  if (data.length === 0) {
    console.log(`Skipping ${tableName} - no data`);
    return;
  }

  // Delete all existing rows using id_no (your primary key)
  const { error: deleteError } = await supabase
    .from(tableName)
    .delete()
    .gte('id_no', 0);

  if (deleteError) {
    console.error(`Error deleting from ${tableName}:`, deleteError);
    return;
  }

  const { error: insertError } = await supabase
    .from(tableName)
    .insert(data);

  if (insertError) {
    console.error(`Error inserting into ${tableName}:`, insertError);
    return;
  }

  console.log(`✓ ${tableName}: ${data.length} rows synced`);
}

// Main sync function
async function syncAll() {
  console.log('Starting sync...\n');

  const sheets = await getGoogleSheetsClient();

  for (const table of TABLES) {
    console.log(`Syncing ${table.sheetName}...`);
    const data = await fetchSheetData(sheets, table.sheetName);
    await uploadToSupabase(table.supabaseTable, data);
  }

  console.log('\n✓ Sync complete!');
}

syncAll().catch(console.error);