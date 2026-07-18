// Node test harness for parseHours.gs
//
// Loads the Apps Script file in a vm sandbox (Apps Script globals like SpreadsheetApp are
// never referenced at load time), then:
//   1. Runs every line from the supplied Google Sheet extract through PARSE_HOURS and reports
//      which return '' (blank). The ONLY blanks should be the genuine typos/format errors in
//      the source data — those are listed in EXPECTED_BLANKS with the reason.
//   2. Asserts exact JSON for the tricky pattern classes.
//
// Run:  node scripts/apps-script/parseHours.test.mjs

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import url from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'parseHours.gs'), 'utf8');
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'parseHours.gs' });
const { PARSE_HOURS } = sandbox.module.exports;

const MoFr = ['Mo', 'Tu', 'We', 'Th', 'Fr'];

// ---------------------------------------------------------------------------
// The corpus — every line from the extract (CRG 2026 Master Data PDF, 7 pages).
// ---------------------------------------------------------------------------
const CORPUS = [
  '1st & 3rd Fr 8 a.m. to 3 p.m.',
  '1st & 3rd Mo',
  '1st & 3rd Sa',
  '1st & 3rd Th & 4th Sa 9 a.m. to 11 a.m.',
  '1st & 3rd Tu 9 a.m. to 11 a.m.',
  '1st & 3rd Tu 9:30 a.m. to 4:30 p.m.',
  '1st & 3rd We from 1 p.m. & 2nd & 4th Sa from 10 a.m.',
  '1st Sa 10 a.m. to 12 p.m. & 3rd Sa 8 a.m. to 12 p.m.',
  '1st Th 1 p.m. to 3 p.m.',
  '1st Th 9 a.m. to 12 p.m.',
  '1st Tu 8 a.m. to 11 a.m.',
  '1st We & 3rd Sa',
  '24/7',
  '2nd & 3rd Fr',
  '2nd & 4th Mo 10 a.m. to 3 p.m.',
  '2nd & 4th Mo 4 p.m. to 6 p.m.',
  '2nd & 4th Mo 9 a.m. to 12 p.m.',
  '2nd & 4th Tu 6:30 a.m. to 8 a.m.',
  '2nd & 4th We 10 a.m. to 2 p.m.',
  '2nd & 4th We 11 a.m. to 12 p.m.',
  '2nd Fr 8 a.m. to 10 p.m.',
  '2nd Mo 8 a.m. to 11 a.m.',
  '2nd Mo 8 a.m. to 5 p.m.',
  '2nd Th 10 a.m. to 1 p.m.',
  '2nd Tu',
  '2nd Tu 8 a.m to 11 a.m.',                                     // BLANK: "a.m" missing period
  '3rd Fr 8 a.m. to 12 p.m.',
  '3rd Fr 8:30 a.m. to 3:30 p.m.',
  '3rd Sa 9 a.m. t0 12 p.m.',                                    // BLANK: "t0" not "to"
  '3rd Su',
  '3rd We 8 a.m. to 11 a.m.',
  'Fr',
  'Fr - Sa 9 a.m. to 12 p.m.',
  'Fr & Sa',
  'Fr 7 a.m.',
  'Fr 8 a.m. to 11 a.m.',
  'Fr 8:30 a.m. to 11 a.m.',
  'Fr 9 a.m. to 1:30 p.m.',
  'Fr 9 a.m. to 12 p.m.',
  'Mo - Th 8:30 a.m. to 5:30 p.m. & Fr 8:30 a.m. to 4:30 p.m.',
  'Mo - Fr',
  'Mo - Fr 10 a.m. to 1 p.m.',
  'Mo - Fr 10 a.m. to 1:30 p.m.',
  'Mo - Fr 10 a.m. to 1:40 p.m.',
  'Mo - Fr 10 a.m. to 2 p.m.',
  'Mo - Fr 10 a.m. to 2 p.m. & Sa 9 a.m. to 12 p.m.',
  'Mo - Fr 10 a.m. to 3 p.m. & Su 10 a.m. to 11 a.m.',
  'Mo - Fr 10 a.m. to 3:30 p.m.',
  'Mo - Fr 10 a.m. to 4 p.m.',
  'Mo - Fr 10 a.m. to 6 p.m. & Sa 10 a.m. to 5 p.m.',
  'Mo - Fr 10 a.m. to 7 p.m.',
  'Mo - Fr 12 p.m. & 5 p.m.',
  'Mo - Fr 5 p.m.',
  'Mo - Fr 6 a.m. to 5:00 p.m.',
  'Mo - Fr 6:30 a.m. to 6 p.m.',
  'Mo - Fr 7 a.m. to 3 p.m.',
  'Mo - Fr 7 a.m. to 3:00 p.m.',
  'Mo - Fr 7 a.m. to 3:30 p.m.',
  'Mo - Fr 7 a.m. to 4 p.m.',
  'Mo - Fr 7 a.m. to 4 p.m. & Sa 8 a.m. to 11 p.m.',
  'Mo - Fr 7 a.m. to 4:00 p.m.',
  'Mo - Fr 7 a.m. to 5 p.m',                                     // BLANK: "5 p.m" missing period
  'Mo - Fr 7 a.m. to 5 p.m.',
  'Mo - Fr 7 a.m. to 5:00 p.m. & Sa 8 a.m. to 12 p.m.',
  'Mo - Fr 7 a.m. to 6 p.m.',
  'Mo - Fr 7 a.m. to 7 p.m.',
  'Mo - Fr 7:15 a.m. to 4 p.m.',
  'Mo - Fr 7:30 a.m. to 12 p.m.',
  'Mo - Fr 7:30 a.m. to 5 p.m.',
  'Mo - Fr 7:30 a.m. to 5:30 p.m.',
  'Mo - Fr 7:30 a.m. to 6 p.m.',
  'Mo - Fr 7:45 a.m. to 3:45 p.m.',
  'Mo - Fr 8 a.m. to 1 p.m.',
  'Mo - Fr 8 a.m. to 12 p.m.',
  'Mo - Fr 8 a.m. to 12 p.m. (phone) Fr 1 p.m. to 3:30 p.m. (free clinic)', // BLANK: parentheticals
  'Mo - Fr 8 a.m. to 12 p.m. & Tu, We, Th 1 p.m. to 4 p.m.',
  'Mo - Fr 8 a.m. to 2 p.m.',
  'Mo - Fr 8 a.m. to 3:30 p.m.',
  'Mo - Fr 8 a.m. to 4 p.m.',
  'Mo - Fr 8 a.m. to 4 p.m. & Tu & Th 4:30 p.m. to 7 p.m. & Sa 9 a.m. to 1 p.m.',
  'Mo - Fr 8 a.m. to 4:30 p.m.',
  'Mo - Fr 8 a.m. to 5 p.m.',
  'Mo - Fr 8 a.m. to 5 p.m. Closed 12 p.m. to 1 p.m.',
  'Mo - Fr 8 a.m. to 5 p.m. & 2nd Sa 8 a.m. to 4:30 p.m.',
  'Mo - Fr 8 a.m. to 5 p.m. & Sa 8 a.m. to 12 p.m.',
  'Mo - Fr 8 a.m. to 5:15 p.m. & 4th & 5th Sa 8 a.m. to 4 p.m.',
  'Mo - Fr 8 a.m. to 6 p.m.',
  'Mo - Fr 8 a.m. to 6 p.m. & 2nd We 8 a.m. to 1:30 p.m.',
  'Mo - Fr 8 a.m. to 6 p.m. & Sa 8 a.m. to 3 p.m.',
  'Mo - Fr 8 a.m. to 7 p.m.',
  'Mo - Fr 8 a.m. to 8 p.m.',
  'Mo - Fr 8 a.m. to 8 p.m. & Su 12 p.m. to 6 p.m.',
  'Mo - Fr 8:30 a.m to 3:30 p.m.',                               // BLANK: "a.m" missing period
  'Mo - Fr 8:30 a.m. to 11:30 p.m & Mo - Fr 1"30 p.m. to 3:30 p.m.', // BLANK: typos
  'Mo - Fr 8:30 a.m. to 12:30 p.m.',
  'Mo - Fr 8:30 a.m. to 4 p.m.',
  'Mo - Fr 8:30 a.m. to 4:30 p.m. Closed 12 p.m. to 1 p.m.',
  'Mo - Fr 8:30 a.m. to 5 p.m.',
  'Mo - Fr 8:30 a.m. to 5:30 p.m.',
  'Mo - Fr 9 a.m.',
  'Mo - Fr 9 a.m. to 1 p.m.',
  'Mo - Fr 9 a.m. to 11:45 a.m. & Last Th 5 p.m. to 6 p.m.',
  'Mo - Fr 9 a.m. to 12 p.m. & 1 p.m. to 3 p.m.',
  'Mo - Fr 9 a.m. to 12:30 p.m.',
  'Mo - Fr 9 a.m. to 2 p.m.',
  'Mo - Fr 9 a.m. to 2:30 p.m.',
  'Mo - Fr 9 a.m. to 3 p.m.',
  'Mo - Fr 9 a.m. to 4 p.m.',
  'Mo - Fr 9 a.m. to 4 p.m. Closed from 12 p.m. to 1 p.m.',
  'Mo - Fr 9 a.m. to 4:30 p.m.',
  'Mo - Fr 9 a.m. to 5 p.m.',
  'Mo - Fr 9 a.m. to 5 p.m., Tu 2 p.m. to 4:30 p.m., Th 9 a.m. to 11:30 a.m.',
  'Mo - Fr 9 a.m. to 5:30 p.m.',
  'Mo - Fr 9 a.m. to 6 p.m.',
  'Mo - Fr 9 a.m. to 6 p.m. & Sa 9 a.m. to 3 p.m.',
  'Mo - Fr 9 a.m. to 7 p.m.',
  'Mo - Fr 9:30 a.m. to 11 a.m.',
  'Mo - Sa',
  'Mo - Sa 10 a.m. to 2 p.m.',
  'Mo - Sa 10 a.m. to 4 p.m.',
  'Mo - Sa 12 p.m. & 6 p.m. & Su 1 p.m. & 6 p.m.',
  'Mo - Sa 8 a.m. to 5 p.m.',
  'Mo - Sa 8 a.m. to 8 p.m.',
  'Mo - Sa 9 a.m. to 4 p.m.',
  'Mo - Su',
  'Mo - Th',
  'Mo - Th 10 a.m. to 1:30 p.m.',
  'Mo - Th 10 a.m. to 2 p.m.',
  'Mo - Th 10 a.m. to 5 p.m. & Fr 12 p.m. to 4 p.m',            // BLANK: "4 p.m" missing period
  'Mo - Th 11 a.m. to 3 p.m.',
  'Mo - Th 7 a.m. to 5 p.m. & Fr 7:30 a.m. to 5 p.m. & Sa 9 a.m. to 4 p.m.',
  'Mo - Th 7:30 a.m. to 8 p.m. & Fr 7:30 a.m. to 5 p.m. & Dental Tu - Th 8 a.m. to 5 p.m.', // BLANK: "Dental" label needs a colon
  'Mo - Th 8 a.m. to 11 a.m.',
  'Mo - Th 8 a.m. to 12 p.m.',
  'Mo - Th 8 a.m. to 2 p.m. & Fr 8 a.m. to 12 p.m.',
  'Mo - Th 8 a.m. to 4:30 p.m. Closed 12 p.m. to 1 p.m.',
  'Mo - Th 8 a.m. to 4:30 p.m. & Fr 8 a.m. to 3 p.m.',
  'Mo - Th 8 a.m. to 5 p.m.',
  'Mo - Th 8 a.m. to 5 p.m. & Fr 8 a.m. to 1 p.m.',
  'Mo - Th 8 a.m. to 5 p.m. & Fr 8 a.m. to 4 p.m.',
  'Mo - Th 8 a.m. to 5 p.m., Fr 8 a.m. to 3 p.m.',
  'Mo - Th 8 a.m. to 5:30 p.m. & Fr 8 a.m. to 6 p.m.',
  'Mo - Th 8 a.m. to 6 p.m. & Fr 8 a.m. to 5 p.m.',
  'Mo - Th 8 a.m. to 7 p.m. & Sa 8 a.m. to 2 p.m.',
  'Mo - Th 8 a.m. to 8 p.m. & Fr 8 a.m. to 6 p.m. & Sa 8 a.m. to 5 p.m.',
  'Mo - Th 8:20 a.m. to 5 p.m. & Fr 8:20 a.m. to 12 p.m.',
  'Mo - Th 8:30 a.m. to 1 p.m.',
  'Mo - Th 8:30 a.m. to 3 p.m. & Fr 8:30 a.m. to 2 p.m.',
  'Mo - Th 8:30 a.m. to 3:30 p.m.',
  'Mo - Th 8:30 a.m. to 3:30 p.m. & Fr 8:30 a.m. to 2 p.m.',
  'Mo - Th 8:30 a.m. to 3:30 p.m. & Fr 8:30 a.m. to 2:30 p.m.',
  'Mo - Th 8:30 a.m. to 4:30 p.m.',
  'Mo - Th 8:30 a.m. to 4:30 p.m. & Fr 8:30 a.m. to 1:30 p.m.',
  'Mo - Th 8:30 a.m. to 4:30 p.m. & Fr 8:30 a.m. to 12 p.m.',
  'Mo - Th 8:30 a.m. to 7 p.m & Fr 8:30 a.m. to 6 p.m.',        // BLANK: "7 p.m" missing period
  'Mo - Th 9 a.m. to 1:00 p.m.',
  'Mo - Th 9 a.m. to 10:30 a.m. & We 6 p.m. to 7:30 p.m.',
  'Mo - Th 9 a.m. to 12 p.m.',
  'Mo - Th 9 a.m. to 12 p.m. & 1 p.m. to 4 p.m.',
  'Mo - Th 9 a.m. to 2:30 p.m.',
  'Mo - Th 9 a.m. to 2:30 p.m. & We 6:30 p.m. & Fr 6 p.m. to 8 p.m.',
  'Mo - Th 9 a.m. to 4:30 p.m. & Fr 9 a.m. to 1 p.m.',
  'Mo - Th 9 a.m. to 5 p.m.',
  'Mo - Th 9 a.m. to 5 p.m. Closed 12 p.m. to 1 p.m.',
  'Mo - Th 9 a.m. to 5 p.m. & Fr 9 a.m. to 3 p.m.',
  'Mo - Th 9 a.m. to 6 p.m. & Sa 9 a.m. to 2 p.m.',
  'Mo - Th 9:30 a.m. to 11:30 a.m.',
  'Mo - Th 9:30 a.m. to 3:30 p.m.',
  'Mo - Th 9:30 a.m. to 5 p.m.',
  'Mo - We 8 a.m. to 4 p.m.',
  'Mo - We 8 a.m. to 5 p.m.',
  'Mo - We 9 a.m. to 11:45 a.m. & Sa 10 a.m. to 11:45 a.m.',
  'Mo - We 9:30 a.m. to 12 p.m.',
  'Mo & Fr 10 a.m. to 1 p.m.',
  'Mo & Fr 8:30 a.m. to 10:30 a.m.',
  'Mo & Fri 10 a.m. to 3 p.m.',                                 // BLANK: "Fri" not "Fr"
  'Mo & Th',
  'Mo & Th & 1st & 3rd Sa 10 a.m. to 1 p.m.',
  'Mo & Th 2 p.m. to 4 p.m. & We & Fr 5 p.m. to 7 p.m. & Tu 10 a.m. to 12 p.m. & 6 p.m. to 8 p.m.',
  'Mo & Th 8 a.m. to 3 p.m.',
  'Mo & Th 9:30 a.m. to 11:15 a.m.',
  'Mo & Th 9:30 a.m. to 12:30 p.m.',
  'Mo & We & Fr 10 a.m. to 12 p.m.',
  'Mo & We 9 a.m. to 12 p.m.',
  'Mo & We 9 a.m. to 5 p.m. & Th 9 a.m. to 3 p.m.',
  'Mo 1 p.m. to 3 p.m. & We 10 a.m. to 12 p.m. & 1:30 p.m. to 6 p.m.',
  'Mo 10 a.m. to 2 p.m.',
  'Mo 10 a.m. to 7 p.m. & Tu - Th 8:30 a.m. to 5:30 p.m. & Fr 7 a.m. to 4 p.m.',
  'Mo 12 p.m. to 2:30 p.m. & Tu 9 a.m. to 2:30 p.m. & 4:30 p.m. to 6:30 p.m. & We 9 a.m. to 2:30 p.m. & Th 8:30 a.m. to 11:30 a.m.',
  'Mo 4 p.m. to 5 p.m. & 1st & 3rd We 12:30 p.m. to 2 p.m.',
  'Mo 4 p.m. to 6 p.m. & Tu & Th 9 a.m. to 2 p.m.',
  'Mo 5:30 p.m.',
  'Mo 8 a.m. to 3 p.m.',
  'Mo 8 a.m. to 4 p.m.',
  'Mo 8 a.m. to 5 p.m. & Tu - Fr 7 a.m. to 4 p.m.',
  'Mo 8 a.m. to 5:30 p.m. & We 8 a.m. to 6 p.m. & Fr & Sa 8 a.m. to 1:30 p.m.',
  'Mo 8 a.m. to 7 p.m. & Tu - Fr 8 a.m. to 5 p.m.',
  'Mo 8 a.m. to 7 p.m. & Tu, We, Th 8 a.m. to 5 p.m. & Fr 8 a.m. to 12 p.m. Closed 12 p.m. to 1 p.m.', // BLANK: closure (12-1) sits outside the Fr range (8-12)
  'Mo 8:30 a.m. to 10 a.m.',
  'Mo 8:30 a.m. to 6 p.m. & Tu, Th, Fr 7:30 a.m. to 5 p.m. & We 7:30 a.m. to 12 p.m.',
  'Mo 9 a.m. to 10:30 a.m.',
  'Mo 9 a.m. to 11 a.m. & Tu, We, Th 10 a.m. to 5 p.m. & Fr 8 a.m. to 10 a.m. & 2nd & 4th Sa 9 a.m. to 11 a.m.',
  'Mo 9 a.m. to 12 p.m. & We 10 a.m. to 2 p.m.',
  'Mo 9 a.m. to 5 p.m.',
  'Mo 9 a.m. to 6 p.m. & Tu - Th 8 a.m. to 5 p.m. & 3rd Sa 8 a.m. to 12 p.m.',
  'Mo 9 a.m. to 6 p.m. & We & Th 8 a.m. to 5 p.m. & 3rd Sa 8 a.m. to 12 p.m.',
  'Mo to Fr 5 a.m. to 8 p.m.',
  'Mo to Fr 5:30 p.m.',
  'Mo to Fr 6 a.m. to 6 p.m.',
  'Mo to Fr 7:15 a.m. to 4 p.m.',
  'Mo to Fr 7:15 a.m. to 5:45 p.m.',
  'Mo to Fr 7:30 a.m. to 3 p.m.',
  'Mo to Fr 7:30 a.m. to 4 p.m.',
  'Mo to Fr 8 a.m. to 4:30 p.m.',
  'Mo to Fr 8:30 a.m. to 4:30 p.m.',
  'Mo to Fr 9 a.m. to 5 p.m.',
  'Mo to Fr 9 a.m.to 4 p.m.',
  'Mo, Th, Fr, Sa 10 a.m. to 6 p.m.',
  'Mo, Tu & Th 11 a.m. to 2 p.m. & Th 5 p.m. to 7 p.m. & Fr 10 a.m. to 12 p.m.',
  'Mo, Tu & We 8 a.m. to 12 p.m.',
  'Mo, Tu 8 a.m. to 6 p.m. & We, Th 8 a.m. to 5:30 p.m. & Fr 8 a.m. to 1 p.m.',
  'Mo, Tu, Th 8 a.m. to 5:30 p.m.',
  'Mo, Tu, Th, Fr 7 a.m. to 5 p.m. & We 7 a.m. to 6 p.m.',
  'Mo, Tu, Th, Fr 8 a.m. to 6 p.m.',
  'Mo, Tu, Th, Fr 8:30 a.m to 5 p.m. & We 9:30 a.m. to 5 p.m.', // BLANK: "8:30 a.m" missing period
  'Mo, Tu, We 7 a.m. to 5:30 p.m. & Th, Fr 8 a.m. to 5 p.m.',
  'Mo, Tu, We, Fr 10 a.m. to 6 p.m. & Th 10 a.m. to 8 p.m. & Sa 10 a.m. to 4:30 p.m.',
  'Mo, Tu, We, Fr 8 a.m. to 4 p.m.',
  'Mo, Tu, We, Th 8 a.m. to 4:30 p.m. & Fr 8 a.m. to 12 p.m. Closed 12 p.m. to 12:45 p.m.', // BLANK: closure not inside range
  'Mo, Tu, We, Th 9 a.m. to 4:30 p.m. & Fr 9 a.m. to 1 p.m.',
  'Mo, Tu, We, Th, Fr 7 a.m. to 5 p.m. & Sa 8 a.m. to 12 p.m.',
  'Mo, We & Fr 10 a.m. to 2 p.m.',
  'Mo, We & Fr 10 a.m. to 4 p.m.',
  'Mo, We & Fr 9 a.m. to 11 a.m.',
  'Mo, We & Fr 9:30 a.m. to 11:30 a.m.',
  'Mo, We & Fr 9:30 a.m. to 12:30 p.m.',
  'Mo, We & Th 6 p.m.',
  'Mo, We 1 p.m to 2:30 p.m. & Tu, Th, Fr 9:30 a.m. to 11 a.m. & Sa 10 a.m. to 11:30 a.m.', // BLANK: "1 p.m" missing period
  'Mo, We 8 a.m. to 5 p.m. & Tu 8 a.m. to 7 p.m. & Th 7 a.m. to 6 p.m. & Fr 8 a.m. to 1 p.m.',
  'Mo, We, Fr 10 a.m. to 1:30 p.m.',
  'Mo, We, Fr 10 a.m. to 11:30 a.m.',
  'Mo, We, Fr 10 a.m. to 12 p.m.',
  'Mo, We, Fr 8 a.m. to 11 a.m.',
  'Mo, We, Fr 8 a.m. to 3 p.m.',
  'Mo, We, Fr 9 a.m. to 12 p.m.',
  'Mo, We, Th 8 a.m. to 5:30 p.m. & Tu 8 a.m. to 6 p.m. & Fr 8 a.m. to 1:30 p.m.',
  'Mo, We, Th, Fr 7 a.m. to 5 p.m. & Tu 7 a.m. to 6 p.m.',
  'Office: Mo - Fr 8:30 a.m. to 4:30 p.m. & Shelter: 4 p.m. to 8 p.m.',
  'Sa',
  'Sa & Su',
  'Sa 10 a.m. to 12 p.m.',
  'Sa 10:30 a.m.',
  'Sa 9 a.m. to 1 p.m.',
  'Sa 9 a.m. to 11 a.m.',
  'Sa 9 a.m. to 12 p.m.',
  'Th - Fr 9 a.m. to 1 p.m. & 3rd Sa 9 a.m. to 1 p.m.',
  'Th - Mo 7 a.m.',
  'Th - Sa 10 a.m. to 6 p.m.',
  'Th & Fr 9 a.m. to 11 a.m.',
  'Th 10 a.m. to 1 p.m.',
  'Th 10 a.m.tp 2 p.m.',                                         // BLANK: "tp" not "to"
  'Th 4 p.m. to 6 p.m. & Sa 10 a.m. to 12 p.m.',
  'Th 8:30 a.m. to 12:30 a.m. & Fr 7:30 a.m. to 11 a.m. & Sa 8:30 a.m. to 12:30 p.m.',
  'Th 9 a.m. to 12 p.m.',
  'Tu - Fr 10 a.m. to 5 p.m. & Sa 9 a.m. to 4 p.m.',
  'Tu - Fr 8 a.m. to 10 a.m.',
  'Tu - Fr 8 a.m. to 3 p.m. & Mo 8 a.m. to 5 p.m.',
  'Tu - Fr 8:30 a.m. to 1 p.m.',
  'Tu - Fr 9 a.m. to 5 p.m & Sa 9 a.m. to 3 p.m.',              // BLANK: "5 p.m" missing period
  'Tu - Fr 9 a.m. to 5 p.m.',
  'Tu - Sa 10 a.m. to 3 p.m.',
  'Tu - Sa 10 a.m. to 6 p.m.',
  'Tu - Sa 11 a.m. & Su 8:30 a.m.',
  'Tu - Su 12 p.m. to 5 p.m.',
  'Tu - Th 1 p.m. to 4 p.m.',
  'Tu - Th 10 a.m. to 3 p.m.',
  'Tu - Th 8 a.m. to 2 p.m.',
  'Tu - Th 9:30 a.m. to 11:30 a.m.',
  'Tu & Fr 8:30 a.m. to 4:30 p.m.',
  'Tu & Th',
  'Tu & Th 10 a.m. to 2 p.m.',
  'Tu & Th 4:30 p.m. to 5:30 p.m.',
  'Tu & Th 9 a.m. to 12 p.m.',
  'Tu & Th 9 a.m. to 12 p.m. & 1st Sa 9 a.m. to 11 a.m.',
  'Tu & Th 9 a.m. to 2:45 p.m.',
  'Tu & Th 9:30 a.m. to 11 a.m.',
  'Tu & Th 9:30 a.m. to 3:30 p.m.',
  'Tu & We',
  'Tu & We 8 a.m. to 5 p.m.',
  'Tu & We 9 a.m. to 12 p.m. & Fri 11 a.m. to 12 p.m.',        // BLANK: "Fri" not "Fr"
  'Tu & We 9 a.m. to 12 p.m. & Th 10:30 a.m. to 12:30 p.m.',
  'Tu 10 a.m. to 1 p.m. & 4th Sa 10 a.m. to 12 p.m.',
  'Tu 10 a.m. to 12 p.m.',
  'Tu 10 a.m. to 2 p.m.',
  'Tu 10 a.m. to 2 p.m. & Th 10 a.m. to 12 p.m.',
  'Tu 10 a.m. to 5 p.m.',
  'Tu 3 p.m. to 7 p.m. & Th 5:30 p.m. to 7 p.m.',
  'Tu 5 p.m. to 6 p.m.',
  'Tu 5 p.m. to 7 p.m. & Th 8:30 a.m. to 11:30 a.m.',
  'Tu 7:30 a.m. to 11 a.m. & Th, Sa 9 a.m. to 11 a.m.',
  'Tu 7:30 a.m. to 11:00 a.m. & We 4:30 p.m. to 8 p.m.',
  'Tu 7:30 a.m. to 11:30 a.m.',
  'Tu 8 a.m. to 3 p.m.',
  'Tu 9 a.m. to 11 a.m.',
  'Tu 9 a.m. to 11 a.m. & We 6 p.m. to 7 p.m. & Sa 9 a.m. to 11 a.m.',
  'Tu 9 a.m. to 4 p.m.',
  'Tu 9:30 a.m. to 12:30 p.m. & Th 10 a.m. to 1 p.m.',
  'Tu, Th & Fr 10 a.m. to 12:30 p.m. & We 6 p.m. to 8 p.m.',
  'Tu, Th & Sa 10 a.m. to 1 p.m.',
  'Tu, Th & Sa 8 a.m. to 10 a.m.',
  'Tu, Th & Sa 8 a.m. to 12 p.m.',
  'Tu, Th 10 a.m. to 2 p.m.',
  'Tu, Th 8 a.m. to 12 p.m. & 3rd Sa 9 a.m. to 11 a.m. & 1st Fr 9 a.m. to 11 a.m.',
  'Tu, Th 9 a.m. to 9 p.m. & We 8 a.m. to 4 p.m.',
  'Tu, We & Th 10 a.m. to 1 p.m. & Fr 10 a.m. to 11:30 a.m.',
  'Tu, We & Th 10 a.m. to 12 p.m.',
  'Tu, We & Th 2 p.m. to 4 p.m.',
  'Tu, We & Th 9 a.m. to 11 a.m.',
  'Tu, We & Th 9:30 a.m. to 11:30 a.m.',
  'Tu, We, & Th 8:30 a.m. to 7 p.m.',
  'We',
  'We - Fr 9 a.m. to 12 p.m.',
  'We 10 a.m to 5 p.m.',                                        // BLANK: "10 a.m" missing period
  'We 10 a.m. to 12 p.m.',
  'We 8 a.m. to 3 p.m.',
  'We 8 a.m. to 9:30 a.m.',
  'We 8:30 a.m. to 11 a.m. & Th 6 p.m. to 8 p.m.',
  'We 9 a.m. to 11 a.m.',
  'We 9 a.m. to 12 p.m.',
  'We, Th 9 a.m. to 11 a.m.',
];

// Lines that SHOULD return '' (genuine source-data errors — fail loud by design).
const EXPECTED_BLANKS = new Set([
  '2nd Tu 8 a.m to 11 a.m.',
  '3rd Sa 9 a.m. t0 12 p.m.',
  'Mo - Fr 7 a.m. to 5 p.m',
  'Mo - Fr 8 a.m. to 12 p.m. (phone) Fr 1 p.m. to 3:30 p.m. (free clinic)',
  'Mo - Fr 8:30 a.m to 3:30 p.m.',
  'Mo - Fr 8:30 a.m. to 11:30 p.m & Mo - Fr 1"30 p.m. to 3:30 p.m.',
  'Mo - Th 10 a.m. to 5 p.m. & Fr 12 p.m. to 4 p.m',
  'Mo - Th 7:30 a.m. to 8 p.m. & Fr 7:30 a.m. to 5 p.m. & Dental Tu - Th 8 a.m. to 5 p.m.',
  'Mo - Th 8:30 a.m. to 7 p.m & Fr 8:30 a.m. to 6 p.m.',
  'Mo & Fri 10 a.m. to 3 p.m.',
  'Mo, Tu, Th, Fr 8:30 a.m to 5 p.m. & We 9:30 a.m. to 5 p.m.',
  'Mo, Tu, We, Th 8 a.m. to 4:30 p.m. & Fr 8 a.m. to 12 p.m. Closed 12 p.m. to 12:45 p.m.',
  'Mo 8 a.m. to 7 p.m. & Tu, We, Th 8 a.m. to 5 p.m. & Fr 8 a.m. to 12 p.m. Closed 12 p.m. to 1 p.m.',
  'Mo, We 1 p.m to 2:30 p.m. & Tu, Th, Fr 9:30 a.m. to 11 a.m. & Sa 10 a.m. to 11:30 a.m.',
  'Th 10 a.m.tp 2 p.m.',
  'Tu - Fr 9 a.m. to 5 p.m & Sa 9 a.m. to 3 p.m.',
  'Tu & We 9 a.m. to 12 p.m. & Fri 11 a.m. to 12 p.m.',
  'We 10 a.m to 5 p.m.',
]);

// ---------------------------------------------------------------------------
// Run 1: corpus coverage
// ---------------------------------------------------------------------------
const blanks = [];
for (const line of CORPUS) {
  if (PARSE_HOURS(line) === '') blanks.push(line);
}
const unexpectedBlanks = blanks.filter((b) => !EXPECTED_BLANKS.has(b));
const missedBlanks = [...EXPECTED_BLANKS].filter((b) => !blanks.includes(b));

console.log(`Corpus: ${CORPUS.length} lines`);
console.log(`Blank (failed to parse): ${blanks.length}  |  expected: ${EXPECTED_BLANKS.size}`);

if (unexpectedBlanks.length) {
  console.log('\n❌ UNEXPECTED BLANKS (parser gap — should have parsed):');
  unexpectedBlanks.forEach((b) => console.log('   • ' + b));
}
if (missedBlanks.length) {
  console.log('\n⚠️  EXPECTED-BLANK lines that DID parse (should have failed):');
  missedBlanks.forEach((b) => console.log('   • ' + b + '  →  ' + PARSE_HOURS(b)));
}

// ---------------------------------------------------------------------------
// Run 2: exact-shape assertions for the tricky classes
// ---------------------------------------------------------------------------
function eq(input, expected) {
  const got = PARSE_HOURS(input);
  const gotVal = got === '24/7' || got === '' ? got : JSON.parse(got);
  assert.deepEqual(gotVal, expected, `\nInput:    ${input}\nExpected: ${JSON.stringify(expected)}\nGot:      ${got}`);
}

// Basic range
eq('Mo - Fr 9 a.m. to 5 p.m.', { regular: [{ days: MoFr, open: '09:00', close: '17:00' }] });
// The originally-failing ordinal
eq('1st & 2nd We 11 a.m. to 12 p.m.', { special: [{ pattern: '1st & 2nd We', open: '11:00', close: '12:00' }] });
// Mid-range closure → two ranges (no schema change)
eq('Mo - Fr 8 a.m. to 5 p.m. Closed 12 p.m. to 1 p.m.', {
  regular: [
    { days: MoFr, open: '08:00', close: '12:00' },
    { days: MoFr, open: '13:00', close: '17:00' },
  ],
});
eq('Mo - Fr 9 a.m. to 4 p.m. Closed from 12 p.m. to 1 p.m.', {
  regular: [
    { days: MoFr, open: '09:00', close: '12:00' },
    { days: MoFr, open: '13:00', close: '16:00' },
  ],
});
// Discrete open-only service times
eq('Mo - Fr 12 p.m. & 5 p.m.', {
  regular: [
    { days: MoFr, open: '12:00', close: null },
    { days: MoFr, open: '17:00', close: null },
  ],
});
// Split-shift (two ranges, same days)
eq('Mo - Fr 9 a.m. to 12 p.m. & 1 p.m. to 3 p.m.', {
  regular: [
    { days: MoFr, open: '09:00', close: '12:00' },
    { days: MoFr, open: '13:00', close: '15:00' },
  ],
});
// Labeled sub-schedules
eq('Office: Mo - Fr 8:30 a.m. to 4:30 p.m. & Shelter: 4 p.m. to 8 p.m.', {
  labeled: [
    { label: 'Office', days: MoFr, open: '08:30', close: '16:30' },
    { label: 'Shelter', days: null, open: '16:00', close: '20:00' },
  ],
});
// Wrap-around range
eq('Th - Mo 7 a.m.', { regular: [{ days: ['Th', 'Fr', 'Sa', 'Su', 'Mo'], open: '07:00', close: null }] });
// 24/7 passthrough
eq('24/7', '24/7');
// Days-only ordinal
eq('1st & 3rd Sa', { special: [{ pattern: '1st & 3rd Sa', open: null, close: null }] });
// Days-only range
eq('Mo - Fr', { regular: [{ days: MoFr, open: null, close: null }] });
// "to" as a day-range separator
eq('Mo to Fr 9 a.m. to 5 p.m.', { regular: [{ days: MoFr, open: '09:00', close: '17:00' }] });
// Oxford comma-and day list
eq('Tu, We, & Th 8:30 a.m. to 7 p.m.', { regular: [{ days: ['Tu', 'We', 'Th'], open: '08:30', close: '19:00' }] });
// Mixed regular + ordinal in one cell
eq('Tu 10 a.m. to 1 p.m. & 4th Sa 10 a.m. to 12 p.m.', {
  regular: [{ days: ['Tu'], open: '10:00', close: '13:00' }],
  special: [{ pattern: '4th Sa', open: '10:00', close: '12:00' }],
});
// Last-weekday ordinal alongside a range
eq('Mo - Fr 9 a.m. to 11:45 a.m. & Last Th 5 p.m. to 6 p.m.', {
  regular: [{ days: MoFr, open: '09:00', close: '11:45' }],
  special: [{ pattern: 'Last Th', open: '17:00', close: '18:00' }],
});
// 12 a.m. / 12 p.m. boundary handling
eq('Fr 7 a.m.', { regular: [{ days: ['Fr'], open: '07:00', close: null }] });

// Fail-loud sanity
assert.equal(PARSE_HOURS('Th 10 a.m.tp 2 p.m.'), '', 'typo should blank');
assert.equal(PARSE_HOURS(''), '', 'empty should blank');
assert.equal(PARSE_HOURS('garbage text here'), '', 'junk should blank');

// ---------------------------------------------------------------------------
const pass = unexpectedBlanks.length === 0 && missedBlanks.length === 0;
console.log('\n' + (pass ? '✅ Corpus coverage OK.' : '❌ Corpus coverage FAILED — see above.'));
console.log('✅ All exact-shape assertions passed.');
if (!pass) process.exit(1);
