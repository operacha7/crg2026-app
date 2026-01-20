const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Configuration
const SPREADSHEET_ID = '1m3-OHykdj7S_9fGdyJmFkgjNMQ9FA4BAmuyf4khMm7w';

const TABLES = [
  { sheetName: 'directory', supabaseTable: 'directory' },
  { sheetName: 'zip_codes', supabaseTable: 'zip_codes' },
  { sheetName: 'assistance', supabaseTable: 'assistance' },
  { sheetName: 'organizations', supabaseTable: 'organizations' },
  { sheetName: 'registered_organizations', supabaseTable: 'registered_organizations' },
  { sheetName: 'announcements', supabaseTable: 'announcements', transform: transformAnnouncement },
];

// Columns that contain JSON data and should be parsed before inserting
const JSON_COLUMNS = ['org_hours'];

// Transform function for announcements
// Converts format_1/para_1, format_2/para_2, etc. into a single message_html field
function transformAnnouncement(row) {
  // Parse audience_code - extract first character from "1-All CRG Users" -> 1
  const audienceCodeRaw = row.audience_code || '1';
  const audienceCode = parseInt(audienceCodeRaw.toString().charAt(0), 10) || 1;

  // Build HTML from format/para pairs
  const paragraphs = [];
  for (let i = 1; i <= 4; i++) {
    const format = row[`format_${i}`] || '';
    const para = row[`para_${i}`];

    if (para && para.trim()) {
      const html = formatParagraph(para, format);
      paragraphs.push(html);
    }
  }

  const messageHtml = paragraphs.join('\n');

  // Return transformed row with only the fields that match Supabase columns
  // Note: id_no is omitted - Supabase SERIAL will auto-generate it
  return {
    start_date: parseDate(row.start_date),
    expiration_date: parseDate(row.expiration_date),
    audience_code: audienceCode,
    reg_organization: row.reg_organization || null,
    title: row.title,
    message_html: messageHtml,
  };
}

// Parse date from MM/DD/YYYY to YYYY-MM-DD format for Supabase
function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = dateStr.toString();
  // Handle MM/DD/YYYY format
  const parts = str.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    // Handle 2-digit or 4-digit year
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Return as-is if already in correct format or unparseable
  return str;
}

// Convert format codes and paragraph text into HTML
function formatParagraph(text, formatCodes) {
  const codes = formatCodes
    ? formatCodes.split(',').map(c => c.trim().toLowerCase())
    : [];

  const isBold = codes.includes('bold');
  const isItalic = codes.includes('italic');
  const isUnderline = codes.includes('underline');
  const isBullet = codes.includes('bullet');

  // Find hex color code (6 characters, valid hex)
  const hexColor = codes.find(c => /^[0-9a-f]{6}$/i.test(c));

  // Build inline styles
  const styles = [];
  if (isBold) styles.push('font-weight: bold');
  if (isItalic) styles.push('font-style: italic');
  if (isUnderline) styles.push('text-decoration: underline');
  if (hexColor) styles.push(`color: #${hexColor.toUpperCase()}`);

  const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';

  if (isBullet) {
    // Each line becomes a bullet point
    const lines = text.split('\n').filter(line => line.trim());
    const listItems = lines.map(line => `  <li${styleAttr}>${escapeHtml(line.trim())}</li>`).join('\n');
    return `<ul>\n${listItems}\n</ul>`;
  } else {
    // Regular paragraph
    return `<p${styleAttr}>${escapeHtml(text)}</p>`;
  }
}

// Escape HTML special characters
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SECRET_KEY
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
// Returns the count of records inserted, or null if failed
async function uploadToSupabase(tableName, data) {
  if (data.length === 0) {
    console.log(`Skipping ${tableName} - no data`);
    return 0;
  }

  // Delete all existing rows using id_no (your primary key)
  const { error: deleteError } = await supabase
    .from(tableName)
    .delete()
    .gte('id_no', 0);

  if (deleteError) {
    console.error(`Error deleting from ${tableName}:`, deleteError);
    return null;
  }

  const { error: insertError } = await supabase
    .from(tableName)
    .insert(data);

  if (insertError) {
    console.error(`Error inserting into ${tableName}:`, insertError);
    return null;
  }

  console.log(`✓ ${tableName}: ${data.length} rows synced`);
  return data.length;
}

// Log sync results to sync_log table
async function logSyncResults(syncCounts) {
  // Get current time in Central Time
  const now = new Date();
  const centralTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  // Parse the formatted date back to ISO format for Supabase
  // Format: "MM/DD/YYYY, HH:MM:SS" -> "YYYY-MM-DD HH:MM:SS"
  const [datePart, timePart] = centralTime.split(', ');
  const [month, day, year] = datePart.split('/');
  const syncTimestamp = `${year}-${month}-${day} ${timePart}`;

  const logEntry = {
    sync_timestamp: syncTimestamp,
    directory_count: syncCounts.directory,
    zip_codes_count: syncCounts.zip_codes,
    assistance_count: syncCounts.assistance,
    organizations_count: syncCounts.organizations,
    registered_organizations_count: syncCounts.registered_organizations,
    announcements_count: syncCounts.announcements,
  };

  const { error } = await supabase
    .from('sync_log')
    .insert(logEntry);

  if (error) {
    console.error('Error logging sync results:', error);
    console.log('Sync log entry that failed:', logEntry);
  } else {
    console.log(`\n✓ Sync logged at ${centralTime} (Central Time)`);
  }
}

// Main sync function
async function syncAll() {
  console.log('Starting sync...\n');

  const sheets = await getGoogleSheetsClient();

  // Track counts for each table
  const syncCounts = {};

  for (const table of TABLES) {
    console.log(`Syncing ${table.sheetName}...`);
    let data = await fetchSheetData(sheets, table.sheetName);

    // Apply transform if provided (used for announcements)
    if (table.transform && data.length > 0) {
      data = data.map(table.transform);
    }

    const count = await uploadToSupabase(table.supabaseTable, data);
    syncCounts[table.supabaseTable] = count;
  }

  // Log the sync results to sync_log table
  await logSyncResults(syncCounts);

  console.log('\n✓ Sync complete!');
}

syncAll().catch(console.error);