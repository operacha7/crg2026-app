#!/usr/bin/env node

/**
 * Converts a CasesFiled-*.txt file from Harris County JP courts into a clean CSV.
 *
 * Usage:  npm run convert-cases
 *
 * Expects exactly one CasesFiled-*.txt file in docs/.
 * Outputs a .csv with the same name in docs/.
 * Limits output to first 1000 data records.
 *
 * Output columns:
 *   Case Number, JP Court ID, Case Type, Case File Date, Claim Amount,
 *   Plaintiff Name, Plaintiff City, Plaintiff State,
 *   Defendant Zip (extracted)
 *
 * Defendant zip extraction: tries dedicated zip column first, then scans
 * address fields. If no zip found, falls back to Addr Line 1.
 */

const fs = require("fs");
const path = require("path");

const DOCS_DIR = path.join(__dirname, "..", "docs");
const MAX_RECORDS = Infinity;

// --- Find the input file ---
const files = fs
  .readdirSync(DOCS_DIR)
  .filter((f) => f.startsWith("CasesFiled-") && f.endsWith(".txt"));

if (files.length === 0) {
  console.error("No CasesFiled-*.txt file found in docs/");
  process.exit(1);
}
if (files.length > 1) {
  console.error(
    "Multiple CasesFiled-*.txt files found in docs/. Please keep only one at a time:"
  );
  files.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

const inputFile = path.join(DOCS_DIR, files[0]);
const outputFile = inputFile.replace(/\.txt$/, ".csv");

console.log(`Input:  ${files[0]}`);
console.log(`Output: ${path.basename(outputFile)}`);

// --- Simple CSV line parser (handles quoted fields with commas) ---
function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// --- Escape a field for CSV output ---
function escapeCsv(value) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// --- Extract a 5-digit zip from text ---
function extractZip(text) {
  const match = text.match(/\b(\d{5})(?:-\d{4})?(?:\b|$)/);
  return match ? match[1] : "";
}

// --- Find column index by header name pattern ---
function findCol(headers, pattern) {
  return headers.findIndex((h) => h.trim().match(pattern));
}

// --- Read and process ---
const raw = fs.readFileSync(inputFile, "utf-8");
const lines = raw
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

if (lines.length === 0) {
  console.error("File is empty.");
  process.exit(1);
}

// First line is the header
const header = parseCsvLine(lines[0]);

// Source column indices
const COL = {
  caseNumber: findCol(header, /^Case Number/i),
  jpCourtId: findCol(header, /^JP Court ID/i),
  caseType: findCol(header, /^Case Type/i),
  caseFileDate: findCol(header, /^Case File Date/i),
  claimAmount: findCol(header, /^Claim Amount/i),
  plaintiffName: findCol(header, /^Plaintiff Name/i),
  plaintiffCity: findCol(header, /^Plaintiff Addr City/i),
  plaintiffState: findCol(header, /^Plaintiff Addr State/i),
  defAddr1: findCol(header, /^Defendant Addr Line 1/i),
  defAddr2: findCol(header, /^Defendant Addr Line 2/i),
  defCity: findCol(header, /^Defendant Addr City/i),
  defZip: findCol(header, /^Defendant Addr Zip/i),
};

// Verify required columns were found
const missing = Object.entries(COL).filter(([, idx]) => idx === -1);
if (missing.length > 0) {
  console.error("Could not find columns:", missing.map(([k]) => k).join(", "));
  process.exit(1);
}

// --- Extract zip with addr line 1 fallback ---
function extractZipOrAddr(fields, zipIdx, addr1Idx, addr2Idx, cityIdx) {
  // Try dedicated zip column
  let zip = fields[zipIdx]?.trim() || "";
  if (zip && zip !== "null") {
    // Normalize zip+4 (e.g. "77041-5404") to 5-digit
    const cleanZip = extractZip(zip);
    if (cleanZip) return cleanZip;
  }

  // Try extracting from address fields
  const addrParts = [
    fields[addr1Idx] || "",
    fields[addr2Idx] || "",
    fields[cityIdx] || "",
  ].join(" ");
  zip = extractZip(addrParts);
  if (zip) return zip;

  // Fallback: try to extract zip from addr line 1 alone (e.g. "77041-5404")
  const addr1 = fields[addr1Idx]?.trim() || "";
  const addr1Zip = extractZip(addr1);
  if (addr1Zip) return addr1Zip;

  // Last resort: return addr line 1 so user can see the raw address
  return addr1;
}

// Output header
const OUTPUT_HEADERS = [
  "Case Number",
  "JP Court ID",
  "Case Type",
  "Case File Date",
  "Claim Amount",
  "Plaintiff Name",
  "Plaintiff City",
  "Plaintiff State",
  "Defendant Zip (extracted)",
];

const outputLines = [OUTPUT_HEADERS.join(",")];

let recordCount = 0;
let defZipFound = 0;
let defAddrFallback = 0;

for (let i = 1; i < lines.length && recordCount < MAX_RECORDS; i++) {
  const f = parseCsvLine(lines[i]);

  const defResult = extractZipOrAddr(
    f, COL.defZip, COL.defAddr1, COL.defAddr2, COL.defCity
  );

  // Track stats
  if (/^\d{5}$/.test(defResult)) defZipFound++;
  else if (defResult) defAddrFallback++;

  const row = [
    f[COL.caseNumber] || "",
    f[COL.jpCourtId] || "",
    f[COL.caseType] || "",
    f[COL.caseFileDate] || "",
    f[COL.claimAmount] || "",
    f[COL.plaintiffName] || "",
    f[COL.plaintiffCity] || "",
    f[COL.plaintiffState] || "",
    defResult,
  ].map(escapeCsv);

  outputLines.push(row.join(","));
  recordCount++;
}

fs.writeFileSync(outputFile, outputLines.join("\n"), "utf-8");

console.log(`\nDone! ${recordCount} records written (max ${MAX_RECORDS}).`);
console.log(`Defendant zip:  ${defZipFound} extracted, ${defAddrFallback} fell back to address`);
console.log(`\nOutput: ${outputFile}`);
