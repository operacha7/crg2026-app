// scripts/export-directory.js
// Run with: node scripts/export-directory.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read from .env which has VITE_SUPABASE_URL and VITE_SUPABASE_SECRET_KEY
const envPath = path.join(__dirname, '..', '.env');
const devVars = fs.readFileSync(envPath, 'utf8');

function parseEnvFile(content) {
  const vars = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      vars[match[1].trim()] = match[2].trim();
    }
  });
  return vars;
}

const env = parseEnvFile(devVars);
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .dev.vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportDirectory() {
  console.log('Fetching directory data...');

  const { data, error } = await supabase
    .from('directory')
    .select('*');

  if (error) {
    console.error('Error fetching data:', error);
    process.exit(1);
  }

  const outputPath = path.join(__dirname, '..', 'docs', 'design', 'directory-sample.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Exported ${data.length} records to ${outputPath}`);
}

exportDirectory();
