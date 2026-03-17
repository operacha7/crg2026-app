/**
 * Fetch Census ACS 5-Year Data for Houston-area zip codes
 *
 * This script pulls socioeconomic indicators from the US Census Bureau's
 * American Community Survey (ACS) 5-Year estimates at the ZCTA level,
 * then saves to a CSV file for import into Google Sheets.
 *
 * Data source: ACS 2020-2024 5-Year Estimates Data Profiles
 * API docs: https://www.census.gov/data/developers/data-sets/acs-5year.html
 *
 * Usage:
 *   node scripts/fetch-census-data.js              # Fetch all Houston zips, save CSV
 *   node scripts/fetch-census-data.js --discover    # List available variables (debug)
 *
 * Prerequisites:
 *   - Census API key (free): https://api.census.gov/data/key_signup.html
 *   - Add CENSUS_API_KEY to your .env file
 *   - Supabase credentials in .env (to fetch Houston zip code list)
 */

const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// ═══════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════

const CENSUS_API_KEY = process.env.CENSUS_API_KEY || "";
const ACS_YEAR = "2024"; // Most recent 5-year: 2020-2024
const ACS_DATASET = `${ACS_YEAR}/acs/acs5/profile`;

// Census API base URL
const CENSUS_BASE = "https://api.census.gov/data";

// Data source citation - referenced by MapboxMap distress data table
// Keep this in sync with the CENSUS_SOURCE constant in MapboxMap.js
const DATA_SOURCE = "U.S. Census Bureau, ACS 2020–2024 5-Year Estimates";

// Output path
const CSV_OUTPUT = path.resolve(__dirname, "../public/data/census-data.csv");

// ═══════════════════════════════════════════════════════════════════
// Census ACS Data Profile Variables
// ═══════════════════════════════════════════════════════════════════
// PE suffix = Percent Estimate, E suffix = Raw Estimate
// These are from the Data Profile tables (DP02, DP03, DP04, DP05)
//
// Variable numbers can shift between ACS years. If the script fails,
// run with --discover flag to check available variables.

const VARIABLES = {
  // ── DP03: Economic Characteristics ──────────────────────────────
  DP03_0128PE: {
    key: "poverty_rate",
    label: "Poverty Rate (%)",
    description: "Percent of population below poverty level",
    type: "percent",
  },
  DP03_0062E: {
    key: "median_household_income",
    label: "Median Household Income ($)",
    description: "Median household income in the past 12 months (in inflation-adjusted dollars)",
    type: "dollar",
  },
  DP03_0009PE: {
    key: "unemployment_rate",
    label: "Unemployment Rate (%)",
    description: "Percent of civilian labor force that is unemployed",
    type: "percent",
  },
  DP03_0099PE: {
    key: "uninsured_pct",
    label: "No Health Insurance (%)",
    description: "Percent of civilian noninstitutionalized population without health insurance",
    type: "percent",
  },
  DP03_0074PE: {
    key: "snap_pct",
    label: "SNAP Recipients (%)",
    description: "Percent of households receiving SNAP/Food Stamp benefits",
    type: "percent",
  },

  // ── DP02: Social Characteristics ────────────────────────────────
  DP02_0060PE: {
    key: "no_hs_diploma_less_9th_pct",
    label: "Less than 9th grade (%)",
    description: "Percent of population 25+ with less than 9th grade education",
    type: "percent",
    _combine: "no_hs_diploma_pct", // Combined with 9th-12th no diploma
  },
  DP02_0061PE: {
    key: "no_hs_diploma_9th_12th_pct",
    label: "9th-12th grade, no diploma (%)",
    description: "Percent of population 25+ with 9th-12th grade, no diploma",
    type: "percent",
    _combine: "no_hs_diploma_pct",
  },

  // ── DP04: Housing Characteristics ───────────────────────────────
  DP04_0003PE: {
    key: "vacancy_rate",
    label: "Vacancy Rate (%)",
    description: "Percent of housing units that are vacant",
    type: "percent",
  },
  DP04_0046PE: {
    key: "owner_occupancy_rate",
    label: "Owner Occupancy Rate (%)",
    description: "Percent of occupied housing units that are owner-occupied",
    type: "percent",
  },
  DP04_0058PE: {
    key: "no_vehicle_pct",
    label: "No Vehicle (%)",
    description: "Percent of occupied housing units with no vehicle available",
    type: "percent",
  },

  // ── DP05: Demographics ──────────────────────────────────────────
  DP05_0001E: {
    key: "population",
    label: "Total Population",
    description: "Total population count",
    type: "count",
  },
};

// ═══════════════════════════════════════════════════════════════════
// Houston-area zip codes
// ═══════════════════════════════════════════════════════════════════

async function getHoustonZipCodes() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (supabaseUrl && supabaseKey) {
    console.log("📡 Fetching Houston zip codes from Supabase...");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("zip_codes")
      .select("zip_code")
      .eq("houston_area", "Y");

    if (error) {
      console.error("Supabase error:", error.message);
      throw error;
    }

    const zips = data.map((r) => r.zip_code).sort();
    console.log(`  Found ${zips.length} Houston-area zip codes`);
    return zips;
  }

  throw new Error(
    "No Supabase credentials found. Add SUPABASE_URL and SUPABASE_SECRET_KEY to .env"
  );
}

// ═══════════════════════════════════════════════════════════════════
// Census API Functions
// ═══════════════════════════════════════════════════════════════════

async function fetchCensusData(variableCodes, zctas) {
  const varList = ["NAME", ...variableCodes].join(",");

  // Census API has URL length limits; batch ZCTAs in groups of 50
  const BATCH_SIZE = 50;
  const allResults = [];

  for (let i = 0; i < zctas.length; i += BATCH_SIZE) {
    const batch = zctas.slice(i, i + BATCH_SIZE);
    const zctaList = batch.join(",");
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(zctas.length / BATCH_SIZE);

    const url =
      `${CENSUS_BASE}/${ACS_DATASET}?get=${varList}` +
      `&for=zip%20code%20tabulation%20area:${zctaList}` +
      (CENSUS_API_KEY ? `&key=${CENSUS_API_KEY}` : "");

    console.log(`  📥 Fetching batch ${batchNum}/${totalBatches} (${batch.length} ZCTAs)...`);

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      console.error(`  ❌ Census API error (batch ${batchNum}):`, text);

      if (text.includes("unknown/unsupported")) {
        console.error("\n⚠️  Some variable codes may have changed for this ACS year.");
        console.error("   Run with --discover flag to check available variables.");
        console.error(`   API URL: ${url.replace(CENSUS_API_KEY, "YOUR_KEY")}\n`);
      }
      throw new Error(`Census API returned ${response.status}: ${text}`);
    }

    const data = await response.json();

    // First row is headers, rest is data
    if (i === 0) {
      allResults.push(data[0]); // Headers only from first batch
    }
    allResults.push(...data.slice(1));

    // Small delay between batches to be polite to Census API
    if (i + BATCH_SIZE < zctas.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allResults;
}

// Discover mode: list variables matching keywords
async function discoverVariables(tablePrefix) {
  const url = `${CENSUS_BASE}/${ACS_DATASET}/variables.json` +
    (CENSUS_API_KEY ? `?key=${CENSUS_API_KEY}` : "");

  console.log(`\n🔍 Fetching variable list for ACS ${ACS_YEAR} 5-Year Data Profile...`);
  console.log(`   This may take a moment (large response)...\n`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Census API returned ${response.status}`);
  }

  const data = await response.json();
  const variables = data.variables;

  const prefix = tablePrefix || "DP";
  const filtered = Object.entries(variables)
    .filter(
      ([code]) =>
        code.startsWith(prefix) && (code.endsWith("PE") || code.endsWith("E"))
    )
    .map(([code, info]) => ({
      code,
      label: info.label || info.concept || "No label",
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  console.log(`Found ${filtered.length} variables starting with "${prefix}":\n`);
  filtered.forEach(({ code, label }) => {
    console.log(`  ${code}: ${label}`);
  });

  return filtered;
}

// ═══════════════════════════════════════════════════════════════════
// Data Processing
// ═══════════════════════════════════════════════════════════════════

function processResults(rawData) {
  if (!rawData || rawData.length < 2) {
    throw new Error("No data returned from Census API");
  }

  const headers = rawData[0];
  const varCodes = Object.keys(VARIABLES);

  // Map header positions
  const colIndex = {};
  headers.forEach((h, i) => {
    colIndex[h] = i;
  });

  const zctaCol = colIndex["zip code tabulation area"];
  if (zctaCol === undefined) {
    throw new Error("ZCTA column not found in Census response");
  }

  const processed = [];

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    const zcta = row[zctaCol];

    const record = { zip_code: zcta };

    // Extract each variable
    varCodes.forEach((code) => {
      const idx = colIndex[code];
      if (idx !== undefined) {
        const val = parseFloat(row[idx]);
        record[VARIABLES[code].key] = isNaN(val) ? null : val;
      }
    });

    // Combine no HS diploma: less than 9th + 9th-12th no diploma
    const less9th = record.no_hs_diploma_less_9th_pct || 0;
    const no_diploma = record.no_hs_diploma_9th_12th_pct || 0;
    record.no_hs_diploma_pct =
      less9th === null && no_diploma === null ? null : Math.round((less9th + no_diploma) * 10) / 10;

    // Remove the individual sub-fields
    delete record.no_hs_diploma_less_9th_pct;
    delete record.no_hs_diploma_9th_12th_pct;

    processed.push(record);
  }

  // Compute Houston metro median household income from the fetched data
  const incomeValues = processed
    .map((r) => r.median_household_income)
    .filter((v) => v != null && !Number.isNaN(v))
    .sort((a, b) => a - b);

  let metroMedianIncome = null;
  if (incomeValues.length > 0) {
    const mid = Math.floor(incomeValues.length / 2);
    metroMedianIncome = incomeValues.length % 2 === 0
      ? Math.round((incomeValues[mid - 1] + incomeValues[mid]) / 2)
      : incomeValues[mid];
    console.log(`   Houston metro median household income: $${metroMedianIncome.toLocaleString()} (computed from ${incomeValues.length} zip codes)`);
  }

  // Calculate income ratio (zip median / Houston metro median)
  processed.forEach((record) => {
    if (record.median_household_income !== null && metroMedianIncome !== null) {
      record.income_ratio = Math.round((record.median_household_income / metroMedianIncome) * 100) / 100;
    } else {
      record.income_ratio = null;
    }
  });

  // Sort by zip code
  processed.sort((a, b) => a.zip_code.localeCompare(b.zip_code));

  return processed;
}

// ═══════════════════════════════════════════════════════════════════
// CSV Output
// ═══════════════════════════════════════════════════════════════════

function saveToCSV(records) {
  // CSV column order
  const columns = [
    "zip_code",
    "population",
    "poverty_rate",
    "median_household_income",
    "income_ratio",
    "unemployment_rate",
    "uninsured_pct",
    "snap_pct",
    "no_hs_diploma_pct",
    "vacancy_rate",
    "owner_occupancy_rate",
    "no_vehicle_pct",
  ];

  // Human-readable headers for Google Sheets
  const headers = [
    "Zip Code",
    "Population",
    "Poverty Rate (%)",
    "Median Household Income ($)",
    "Income Ratio (vs Metro)",
    "Unemployment Rate (%)",
    "No Health Insurance (%)",
    "SNAP Recipients (%)",
    "No HS Diploma (%)",
    "Vacancy Rate (%)",
    "Owner Occupancy Rate (%)",
    "No Vehicle (%)",
  ];

  const lines = [headers.join(",")];

  records.forEach((r) => {
    const row = columns.map((col) => {
      const val = r[col];
      return val === null || val === undefined ? "" : val;
    });
    lines.push(row.join(","));
  });

  fs.writeFileSync(CSV_OUTPUT, lines.join("\n"));
  console.log(`\n💾 Saved CSV to ${CSV_OUTPUT}`);
  console.log(`   ${records.length} rows × ${columns.length} columns`);
  console.log(`   Ready for import into Google Sheets`);
}

// ═══════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Census ACS Data Fetcher for CRG Houston");
  console.log(`  Dataset: ACS ${ACS_YEAR} 5-Year Estimates (Data Profiles)`);
  console.log(`  Income ratio: computed from Houston metro median`);
  console.log("═══════════════════════════════════════════════════════\n");

  // --discover mode: list available variables
  if (args.includes("--discover")) {
    const prefix = args[args.indexOf("--discover") + 1] || "DP";
    await discoverVariables(prefix);
    return;
  }

  if (!CENSUS_API_KEY) {
    console.log("⚠️  No CENSUS_API_KEY found in .env");
    console.log("   The Census API works without a key but with rate limits.");
    console.log("   Get a free key at: https://api.census.gov/data/key_signup.html\n");
  }

  // Step 1: Get Houston zip codes
  const houstonZips = await getHoustonZipCodes();

  // Step 2: Fetch Census data
  const variableCodes = Object.keys(VARIABLES);
  console.log(`\n📊 Fetching ${variableCodes.length} variables for ${houstonZips.length} ZCTAs...`);
  console.log(`   Variables: ${variableCodes.join(", ")}\n`);

  const rawData = await fetchCensusData(variableCodes, houstonZips);
  console.log(`  ✅ Received ${rawData.length - 1} rows from Census API\n`);

  // Step 3: Process results
  const processed = processResults(rawData);

  // Report any zip codes with missing data
  const withData = processed.filter((r) => r.poverty_rate !== null);
  const noData = processed.filter((r) => r.poverty_rate === null);
  console.log(`📋 Results: ${withData.length} ZCTAs with data, ${noData.length} with missing data`);
  if (noData.length > 0) {
    console.log(`   Missing: ${noData.map((r) => r.zip_code).join(", ")}`);
  }

  // Step 4: Save to CSV
  saveToCSV(processed);

  // Print summary stats
  const povertyRates = withData.map((r) => r.poverty_rate).sort((a, b) => a - b);
  const incomes = withData.map((r) => r.median_household_income).filter(Boolean).sort((a, b) => a - b);
  const populations = withData.map((r) => r.population).filter(Boolean);
  const totalPop = populations.reduce((sum, p) => sum + p, 0);

  console.log("\n📊 Summary Statistics:");
  console.log(`   Total population across all zips: ${totalPop.toLocaleString()}`);
  console.log(`   Poverty rate range: ${povertyRates[0]}% - ${povertyRates[povertyRates.length - 1]}%`);
  console.log(`   Income range: $${incomes[0]?.toLocaleString()} - $${incomes[incomes.length - 1]?.toLocaleString()}`);

  // Print first/last 3 for quick sanity check
  console.log("\n📊 Sample data (first 3 and last 3 by zip):\n");
  const sample = [...processed.slice(0, 3), ...processed.slice(-3)];
  sample.forEach((r) => {
    console.log(`  ${r.zip_code} (pop: ${r.population !== null ? r.population.toLocaleString() : "N/A"}):`);
    console.log(`    Poverty: ${r.poverty_rate}%  |  Median Income: $${r.median_household_income !== null ? r.median_household_income.toLocaleString() : "N/A"}  |  Income Ratio: ${r.income_ratio}`);
    console.log(`    Unemployment: ${r.unemployment_rate}%  |  No HS Diploma: ${r.no_hs_diploma_pct}%`);
    console.log(`    Uninsured: ${r.uninsured_pct}%  |  SNAP: ${r.snap_pct}%  |  No Vehicle: ${r.no_vehicle_pct}%`);
    console.log(`    Vacancy: ${r.vacancy_rate}%  |  Owner Occupied: ${r.owner_occupancy_rate}%`);
    console.log();
  });

  console.log("✅ Done!\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
