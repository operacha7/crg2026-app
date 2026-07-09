const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { webcrypto } = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Bind Node's Web Crypto to globalThis so the same PBKDF2 routine used by
// the Cloudflare login function and by scripts/hash-passcodes.js works here
// unmodified. Node 18+ exposes Web Crypto under crypto.webcrypto.
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// Configuration
const SPREADSHEET_ID = '1m3-OHykdj7S_9fGdyJmFkgjNMQ9FA4BAmuyf4khMm7w';

const TABLES = [
  { sheetName: 'directory', supabaseTable: 'directory' },
  { sheetName: 'zip_codes', supabaseTable: 'zip_codes' },
  { sheetName: 'assistance', supabaseTable: 'assistance' },
  { sheetName: 'organizations', supabaseTable: 'organizations' },
  { sheetName: 'registered_organizations', supabaseTable: 'registered_organizations', primaryKey: 'account_id', transform: transformRegisteredOrg },
  { sheetName: 'announcements', supabaseTable: 'announcements', transform: transformAnnouncement },
  { sheetName: 'zip_code_data', supabaseTable: 'zip_code_data', transform: transformZipCodeData, primaryKey: 'id' },
  { sheetName: 'header_config', supabaseTable: 'header_config', transform: transformHeaderConfig },
  { sheetName: 'fin_funding_data', supabaseTable: 'fin_funding_data', transform: transformFinFundingData, primaryKey: 'id' },
  // training_sessions is the one table synced by UPSERT instead of the shared
  // delete-then-insert. The sheet carries id_no + 7 content columns; Supabase
  // owns created_at (default now()) and calendar_adds (an anonymous counter
  // written server-side by functions/track-calendar-add.js). Upserting on id_no
  // overwrites only the columns we send, so created_at and calendar_adds are
  // left untouched — the counter survives every sync. `mode: 'upsert'` routes
  // this table to uploadViaUpsert() below.
  {
    sheetName: 'training_sessions',
    supabaseTable: 'training_sessions',
    transform: transformTrainingSession,
    mode: 'upsert',
    primaryKey: 'id_no',
  },
];

// Columns that contain JSON data and should be parsed before inserting
const JSON_COLUMNS = ['org_hours'];

// Passthrough transform: sends values as-is, lets Supabase handle type coercion
// skipKeys: array of keys to exclude (e.g. auto-generated PKs)
function passthroughTransform(row, skipKeys = []) {
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    if (skipKeys.includes(key)) continue;
    result[key] = (value === null || value === undefined || value === '') ? null : value;
  }
  return result;
}

function transformZipCodeData(row) { return passthroughTransform(row, ['id']); }

// ─── Passcode hashing for registered_organizations ──────────────────────────
// The org_passcode column is intentionally stored as a PBKDF2 hash in
// Supabase so a database leak doesn't reveal anyone's passcode. Plaintext
// passcodes typed into Google Sheets get hashed here on the way through —
// only the hash ever leaves this script. Already-hashed values pass through
// unchanged, so re-running sync is safe.
//
// Hash format and parameters MUST match functions/_lib/session.js so the
// /login function's verifyPassword can recognize and validate hashes
// produced here.
const PBKDF2_ALGO = 'pbkdf2-sha256';
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BITS = 256;
const SALT_BYTES = 16;
const _enc = new TextEncoder();

function _bytesToB64Url(bytes) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function _hashPassword(plaintext) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    _enc.encode(plaintext),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_KEY_BITS
  );
  return `${PBKDF2_ALGO}$${PBKDF2_ITERATIONS}$${_bytesToB64Url(salt)}$${_bytesToB64Url(new Uint8Array(bits))}`;
}

function _isAlreadyHashed(value) {
  return typeof value === 'string' && value.startsWith(`${PBKDF2_ALGO}$`);
}

async function transformRegisteredOrg(row) {
  // Pass everything through; only org_passcode needs special handling.
  const result = passthroughTransform(row);
  const passcode = result.org_passcode;
  if (passcode && !_isAlreadyHashed(passcode)) {
    result.org_passcode = await _hashPassword(passcode);
    console.log(`  hashed passcode for ${row.reg_organization || row.account_id}`);
  }
  return result;
}

function transformFinFundingData(row) { return passthroughTransform(row, ['id']); }

// training_sessions: pass the sheet's id_no + 7 content columns straight
// through. We deliberately drop calendar_adds (Supabase-owned counter) and
// created_at (default now()) if they ever appear as stray sheet columns, so an
// upsert never overwrites them. Postgres handles the type coercion: `time`
// accepts "1:00 PM", `date` accepts "2026-06-25".
function transformTrainingSession(row) {
  return passthroughTransform(row, ['created_at', 'calendar_adds']);
}

function transformHeaderConfig(row) {
  const result = passthroughTransform(row);
  // Convert visible from string "TRUE"/"FALSE" to boolean
  if (result.visible !== null) {
    result.visible = String(result.visible).toUpperCase() === 'TRUE';
  }
  return result;
}

// Parse a value as a number (int or float), returning null if not numeric
function parseNumericOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const parsed = Number(val);
  return isNaN(parsed) ? null : parsed;
}

// Build the centered "Link to associated CRG resource" anchor from a comma-
// separated directory_id_no cell (e.g. "1256, 147, 3"). Returns '' when the
// cell is blank or has no numeric ids. The href is an internal, same-tab link
// (no target="_blank") intercepted client-side to run an "Ask a Question"
// search for those records — so it is intentionally NOT routed through
// formatParagraph (which would rewrite the relative URL to https://).
function buildResourceLink(directoryIdNoRaw) {
  if (!directoryIdNoRaw) return '';
  const ids = directoryIdNoRaw
    .toString()
    .split(',')
    .map(s => s.trim())
    .filter(s => /^\d+$/.test(s));
  if (ids.length === 0) return '';

  const href = `/find?ids=${ids.join(',')}`;
  const anchor = `<a href="${escapeHtml(href)}" style="color: #0066CC; text-decoration: underline">Link to associated CRG resource</a>`;
  return `<p style="text-align: center">${anchor}</p>`;
}

// Transform function for announcements
// Converts format_1/para_1, format_2/para_2, etc. into a single message_html field
// Dynamically handles any number of paragraphs (not limited to 4)
function transformAnnouncement(row) {
  // Parse audience_code - extract first character from "1-All CRG Users" -> 1
  const audienceCodeRaw = row.audience_code || '1';
  const audienceCode = parseInt(audienceCodeRaw.toString().charAt(0), 10) || 1;

  // Build HTML from format/para pairs - dynamically find all para_N fields
  const paragraphs = [];
  let i = 1;
  while (true) {
    const para = row[`para_${i}`];
    if (para === undefined) {
      // No more paragraphs found
      break;
    }
    if (para && para.trim()) {
      const format = row[`format_${i}`] || '';
      const html = formatParagraph(para, format);
      paragraphs.push(html);
    }
    i++;
  }

  let messageHtml = paragraphs.join('\n');

  // Optional "Link to associated CRG resource" — the admin lists one or more
  // directory id_no values in the sheet's directory_id_no column (comma-
  // separated). We append a single centered link at the very bottom. Clicking
  // it runs a normal "Ask a Question" search for those records (see the click
  // interceptor in AnnouncementPopup). The ids live only in this link — no
  // separate Supabase column is needed.
  const resourceLink = buildResourceLink(row.directory_id_no);
  if (resourceLink) {
    messageHtml = messageHtml ? `${messageHtml}\n${resourceLink}` : resourceLink;
  }

  // Build title_html from format_0 + title (rendered inline, wrapped in <span>).
  // format_0 is a sheet-only column; title_html lives in Supabase. If title is
  // blank, leave title_html null so the React side falls back to plain title.
  const titleHtml = formatTitle(row.title || '', row.format_0 || '');

  // Return transformed row with only the fields that match Supabase columns
  // Note: id_no is omitted - Supabase SERIAL will auto-generate it
  return {
    start_date: parseDate(row.start_date),
    expiration_date: parseDate(row.expiration_date),
    audience_code: audienceCode,
    reg_organization: row.reg_organization || null,
    title: row.title,
    title_html: titleHtml,
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

// Convert format codes and paragraph text into HTML.
// Paragraph-level codes (column): bold, italic, underline, bullet, boldfirst, center, link, 6-char hex color
// Inline tokens parsed inside text by parseInline(): **bold**, _italic_, ==highlight==, {#HEX}colored{/}
function formatParagraph(text, formatCodes) {
  const codes = formatCodes
    ? formatCodes.split(',').map(c => c.trim().toLowerCase())
    : [];

  const isBold = codes.includes('bold');
  const isItalic = codes.includes('italic');
  const isUnderline = codes.includes('underline');
  const isBullet = codes.includes('bullet');
  const isBoldFirst = codes.includes('boldfirst');
  const isCenter = codes.includes('center');
  const isLink = codes.includes('link');

  // Find hex color code (6 characters, with or without leading #)
  const hexColorRaw = codes.find(c => /^#?[0-9a-f]{6}$/i.test(c));
  const hexColor = hexColorRaw ? hexColorRaw.replace(/^#/, '') : null;

  // Inline styles applied to the text-bearing element (span/li/p)
  const styles = [];
  if (isBold) styles.push('font-weight: bold');
  if (isItalic) styles.push('font-style: italic');
  if (isUnderline) styles.push('text-decoration: underline');
  if (hexColor) styles.push(`color: #${hexColor.toUpperCase()}`);

  const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';

  // Center is block-level — applies to the wrapper (<p> or <ul>)
  const centerAttr = isCenter ? ` style="text-align: center"` : '';

  if (isLink) {
    // Whole paragraph is a clickable hyperlink. Cell syntax: "Display text | URL".
    // No pipe → the bare URL is used as both the link and the visible text.
    const pipeIndex = text.indexOf('|');
    let displayText, url;
    if (pipeIndex !== -1) {
      displayText = text.substring(0, pipeIndex).trim();
      url = text.substring(pipeIndex + 1).trim();
    } else {
      url = text.trim();
      displayText = url;
    }
    // Default to https:// when the user omits a scheme (so it's not treated as relative)
    if (url && !/^(https?:|mailto:|tel:)/i.test(url)) {
      url = `https://${url}`;
    }

    // Link looks like a link by default (blue + underline); hex color code overrides the color
    const linkStyles = [];
    if (isBold) linkStyles.push('font-weight: bold');
    if (isItalic) linkStyles.push('font-style: italic');
    linkStyles.push('text-decoration: underline');
    linkStyles.push(`color: #${hexColor ? hexColor.toUpperCase() : '0066CC'}`);
    const linkStyleAttr = ` style="${linkStyles.join('; ')}"`;

    const anchor = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${linkStyleAttr}>${parseInline(displayText)}</a>`;
    return `<p${centerAttr}>${anchor}</p>`;
  } else if (isBullet && isBoldFirst) {
    // Each line becomes a bullet point with first line of each bullet bolded
    const lines = text.split('\n').filter(line => line.trim());
    const firstStyles = ['font-weight: bold'];
    if (isItalic) firstStyles.push('font-style: italic');
    if (isUnderline) firstStyles.push('text-decoration: underline');
    if (hexColor) firstStyles.push(`color: #${hexColor.toUpperCase()}`);
    const firstStyleAttr = ` style="${firstStyles.join('; ')}"`;

    // Style for the rest of the text in each bullet (no bold)
    const restBulletStyles = [];
    if (isItalic) restBulletStyles.push('font-style: italic');
    if (isUnderline) restBulletStyles.push('text-decoration: underline');
    if (hexColor) restBulletStyles.push(`color: #${hexColor.toUpperCase()}`);
    const restBulletStyleAttr = restBulletStyles.length > 0 ? ` style="${restBulletStyles.join('; ')}"` : '';

    const listItems = lines.map(line => {
      const trimmed = line.trim();
      // Split on first period+space to separate the bold "first line" from the rest
      const dotIndex = trimmed.indexOf('.  ');
      if (dotIndex !== -1) {
        const firstPart = trimmed.substring(0, dotIndex + 1);
        const restPart = trimmed.substring(dotIndex + 1);
        return `  <li><span${firstStyleAttr}>${parseInline(firstPart)}</span><span${restBulletStyleAttr}>${parseInline(restPart)}</span></li>`;
      }
      // No split point found — bold the whole line
      return `  <li${firstStyleAttr}>${parseInline(trimmed)}</li>`;
    }).join('\n');
    return `<ul${centerAttr}>\n${listItems}\n</ul>`;
  } else if (isBullet) {
    // Each line becomes a bullet point
    const lines = text.split('\n').filter(line => line.trim());
    const listItems = lines.map(line => `  <li${styleAttr}>${parseInline(line.trim())}</li>`).join('\n');
    return `<ul${centerAttr}>\n${listItems}\n</ul>`;
  } else if (isBoldFirst) {
    // Bold only the first line, rest is normal (with other styles applied)
    const lines = text.split('\n');
    const firstLine = lines[0] || '';
    const restLines = lines.slice(1).join('\n');

    // Build style for non-bold portion (italic, underline, color still apply)
    const restStyles = [];
    if (isItalic) restStyles.push('font-style: italic');
    if (isUnderline) restStyles.push('text-decoration: underline');
    if (hexColor) restStyles.push(`color: #${hexColor.toUpperCase()}`);
    const restStyleAttr = restStyles.length > 0 ? ` style="${restStyles.join('; ')}"` : '';

    // First line gets bold + other styles
    const firstStyles = ['font-weight: bold'];
    if (isItalic) firstStyles.push('font-style: italic');
    if (isUnderline) firstStyles.push('text-decoration: underline');
    if (hexColor) firstStyles.push(`color: #${hexColor.toUpperCase()}`);
    const firstStyleAttr = ` style="${firstStyles.join('; ')}"`;

    if (restLines.trim()) {
      return `<p${centerAttr}><span${firstStyleAttr}>${parseInline(firstLine)}</span><br/><span${restStyleAttr}>${parseInline(restLines)}</span></p>`;
    } else {
      // Single-line boldfirst — fold center into the same <p> style attr
      const combined = [...firstStyles];
      if (isCenter) combined.push('text-align: center');
      return `<p style="${combined.join('; ')}">${parseInline(firstLine)}</p>`;
    }
  } else {
    // Regular paragraph — merge center with the inline styles on <p>
    const combined = [...styles];
    if (isCenter) combined.push('text-align: center');
    const combinedAttr = combined.length > 0 ? ` style="${combined.join('; ')}"` : '';
    return `<p${combinedAttr}>${parseInline(text)}</p>`;
  }
}

// Generate HTML for the announcement subject (title). Wrapped in <span> so it
// renders inline inside the "Subject:" row of the memo. Supports the same
// paragraph-level codes as formatParagraph except bullet/boldfirst (which
// don't make sense for a one-line title). Inline markdown is parsed too.
function formatTitle(text, formatCodes) {
  if (!text?.trim()) return null;

  const codes = formatCodes
    ? formatCodes.split(',').map(c => c.trim().toLowerCase())
    : [];

  const isBold = codes.includes('bold');
  const isItalic = codes.includes('italic');
  const isUnderline = codes.includes('underline');
  const isCenter = codes.includes('center');

  const hexColorRaw = codes.find(c => /^#?[0-9a-f]{6}$/i.test(c));
  const hexColor = hexColorRaw ? hexColorRaw.replace(/^#/, '') : null;

  const styles = [];
  if (isBold) styles.push('font-weight: bold');
  if (isItalic) styles.push('font-style: italic');
  if (isUnderline) styles.push('text-decoration: underline');
  if (hexColor) styles.push(`color: #${hexColor.toUpperCase()}`);
  if (isCenter) {
    // text-align only works on block elements, so promote the span to block
    // and let it span the available width of the Subject row.
    styles.push('display: block', 'width: 100%', 'text-align: center');
  }

  const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
  return `<span${styleAttr}>${parseInline(text)}</span>`;
}

// Parse inline markdown tokens after HTML-escaping the raw input.
// Tokens: **bold**, _italic_, ==highlight== (yellow), {#HEX}colored text{/}
// Invalid hex (anything that isn't exactly 6 hex chars) silently strips the
// {#...}{/} wrapper and renders the inner text plain — user preference, so a
// typo in the hex defaults the text back to black instead of leaving stray
// braces visible.
function parseInline(text) {
  if (text === null || text === undefined) return '';
  let s = escapeHtml(text);
  // Bold first, so ** isn't eaten by the italic pass
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/_(.+?)_/g, '<em>$1</em>');
  s = s.replace(/==(.+?)==/g, '<mark style="background-color:#FFFF00">$1</mark>');
  // Valid hex color first
  s = s.replace(/\{#([0-9a-fA-F]{6})\}(.+?)\{\/\}/g, '<span style="color:#$1">$2</span>');
  // Then strip any remaining {#...}{/} wrappers (invalid hex → render plain)
  s = s.replace(/\{#[^}]*\}(.+?)\{\/\}/g, '$1');
  return s;
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
      
      // Parse JSON columns so they're stored as objects, not strings.
      // Plain-string shorthands (e.g. "24/7") are kept as-is and stored as a JSON string.
      if (value && JSON_COLUMNS.includes(cleanHeader)) {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
        if (looksLikeJson) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            console.warn(`  Warning: Row ${rowIndex + 2} - Could not parse JSON in "${cleanHeader}":`, value.substring(0, 50) + '...');
          }
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
async function uploadToSupabase(tableName, data, primaryKey = 'id_no') {
  if (data.length === 0) {
    console.log(`Skipping ${tableName} - no data`);
    return 0;
  }

  // Delete all existing rows using primary key
  const { error: deleteError } = await supabase
    .from(tableName)
    .delete()
    .gte(primaryKey, 0);

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

// Upload via UPSERT keyed on the primary key (used by training_sessions).
// Unlike uploadToSupabase, this never deletes: rows are matched on primaryKey
// and only the columns present in `data` are written. Columns we omit
// (created_at, calendar_adds) keep their existing Supabase values, so the
// anonymous add-counter survives every sync. New ids insert fresh with column
// defaults. To retire a session, delete its row directly in Supabase — removing
// it from the sheet alone won't (upsert doesn't prune).
// Returns the count of records upserted, or null if failed.
async function uploadViaUpsert(tableName, data, primaryKey = 'id_no') {
  if (data.length === 0) {
    console.log(`Skipping ${tableName} - no data`);
    return 0;
  }

  const { error } = await supabase
    .from(tableName)
    .upsert(data, { onConflict: primaryKey });

  if (error) {
    console.error(`Error upserting into ${tableName}:`, error);
    return null;
  }

  console.log(`✓ ${tableName}: ${data.length} rows upserted`);
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
    zip_code_data_count: syncCounts.zip_code_data,
    header_config_count: syncCounts.header_config,
    fin_funding_data_count: syncCounts.fin_funding_data,
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

    // Apply transform if provided. Promise.all handles both sync transforms
    // (their non-promise return values pass through unchanged) and async ones
    // like transformRegisteredOrg, which awaits PBKDF2 hashing per row.
    if (table.transform && data.length > 0) {
      data = await Promise.all(data.map(table.transform));
    }

    const count = table.mode === 'upsert'
      ? await uploadViaUpsert(table.supabaseTable, data, table.primaryKey)
      : await uploadToSupabase(table.supabaseTable, data, table.primaryKey);
    syncCounts[table.supabaseTable] = count;
  }

  // Log the sync results to sync_log table
  await logSyncResults(syncCounts);

  console.log('\n✓ Sync complete!');

  // Cache-key reminder. Only matters when the sync involved a SCHEMA change
  // (added / removed / renamed columns in directory, assistance, or zip_codes).
  // Row content updates do NOT require a bump — the in-app stale-while-
  // revalidate cache picks them up automatically on the next page load.
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('⚠️  SCHEMA CHANGE? Bump the Phase 1 cache key before deploying.');
  console.log('   File: src/services/dataCache.js:20');
  console.log('   Change CACHE_KEY (e.g. "crg-phase1-v1" → "crg-phase1-v2")');
  console.log('   so existing browsers discard their cached older shape and');
  console.log('   refetch — otherwise components may crash on missing fields.');
  console.log('   Skip this if you only added/edited rows.');
  console.log('──────────────────────────────────────────────────────────────');
}

syncAll().catch(console.error);