/**
 * parseHours.gs — Google Apps Script hours parser for CRG Houston
 *
 * Converts the hand-entered "hours of operation" text in the master Google Sheet into the
 * JSON shape that CRG's display layer (`formatHoursFromJson` in src/utils/formatters.js)
 * consumes:  { regular:[{days,open,close}], special:[{pattern,open,close}], labeled:[{label,days,open,close}] }
 *
 * DESIGN (see plan: Clean Rewrite of the Hours Parser):
 *  - A strict tokenizer + recursive-descent grammar, NOT tolerant regex matching.
 *  - Canonical vocabulary only: days are Mo Tu We Th Fr Sa Su; times are `H[:MM] a.m.` / `p.m.`.
 *  - FAIL LOUD, ALL-OR-NOTHING: if ANY token anywhere in a cell is unrecognized (a typo, a
 *    missing period, a stray character), PARSE_HOURS returns '' (blank) for the WHOLE cell.
 *    A blank cell is visible in the sheet and in the app, so the maintainer notices and fixes
 *    it. There is deliberately NO silent partial parse and NO raw-text passthrough on failure.
 *  - Mid-range closures ("… Closed 12 p.m. to 1 p.m.") are normalized by subtracting the
 *    closed interval, producing two ordinary ranges — so no new schema field and no change to
 *    the display layer.
 *
 * USAGE (run as ON-DEMAND BATCH — never as a live =PARSE_HOURS() formula; an in-cell formula
 * that recalculates would land "Loading…" style values during a sync and hide failures):
 *  - Reload the sheet, then use the "CRG Hours" menu → "Parse All Hours" or "Parse Selected".
 *  - Both write STATIC JSON values into the org_hours column.
 *
 * A copy of this file is version-tracked in the repo at scripts/apps-script/parseHours.gs.
 * The final `module.exports` guard lets the Node test harness import the pure functions;
 * Apps Script ignores it (there is no `module` global there).
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

var DAY_CODES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
var DAY_ORDER = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 };

// Canonical display for ordinals, preserving the as-written token.
var ORDINAL_CANON = { '1st': '1st', '2nd': '2nd', '3rd': '3rd', '4th': '4th', '5th': '5th', 'last': 'Last' };

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------
//
// Ordered token matchers. Order matters where prefixes collide:
//  - LABEL (word + ':') before DAY.
//  - ORDINAL ("1st") before TIME (so it isn't read as the number "1").
//  - FROM before DAY ("from" starts with the day letters "Fr").
// Whitespace between tokens is optional and skipped. If no matcher applies at some position,
// tokenize() throws → PARSE_HOURS returns ''.

var TOKEN_MATCHERS = [
  { type: 'LABEL',   re: /^([A-Za-z]+):/ },
  { type: 'ORDINAL', re: /^(1st|2nd|3rd|4th|5th|last)\b/i },
  { type: 'TIME',    re: /^(\d{1,2})(?::(\d{2}))?/ },
  { type: 'AMPM',    re: /^([ap])\.m\./i },
  { type: 'TO',      re: /^to\b/i },
  { type: 'FROM',    re: /^from\b/i },
  { type: 'CLOSED',  re: /^closed\b/i },
  { type: 'DAY',     re: /^(mo|tu|we|th|fr|sa|su)/i },
  { type: 'DASH',    re: /^-/ },
  { type: 'AMP',     re: /^&/ },
  { type: 'COMMA',   re: /^,/ }
];

function tokenize(input) {
  var s = String(input).replace(/\s+/g, ' ').trim();
  var tokens = [];
  var i = 0;
  while (i < s.length) {
    if (s[i] === ' ') { i++; continue; }
    var rest = s.slice(i);
    var matched = null;
    for (var m = 0; m < TOKEN_MATCHERS.length; m++) {
      var hit = TOKEN_MATCHERS[m].re.exec(rest);
      if (hit) { matched = { type: TOKEN_MATCHERS[m].type, text: hit[0], groups: hit }; break; }
    }
    if (!matched) {
      throw new Error('Unrecognized input at: "' + rest.slice(0, 20) + '"');
    }
    tokens.push(buildToken(matched));
    i += matched.text.length;
  }
  return tokens;
}

function buildToken(matched) {
  var t = { type: matched.type, text: matched.text };
  if (matched.type === 'LABEL') {
    t.value = matched.groups[1];
  } else if (matched.type === 'ORDINAL') {
    t.value = ORDINAL_CANON[matched.text.toLowerCase()];
  } else if (matched.type === 'DAY') {
    t.value = normalizeDay(matched.text);
  } else if (matched.type === 'TIME') {
    t.hour = parseInt(matched.groups[1], 10);
    t.minute = matched.groups[2] ? parseInt(matched.groups[2], 10) : 0;
  } else if (matched.type === 'AMPM') {
    t.value = matched.groups[1].toLowerCase(); // 'a' | 'p'
  }
  return t;
}

function normalizeDay(text) {
  var key = text.charAt(0).toUpperCase() + text.charAt(1).toLowerCase();
  return DAY_CODES.indexOf(key) !== -1 ? key : null;
}

// ---------------------------------------------------------------------------
// Parser (recursive descent over the token stream)
// ---------------------------------------------------------------------------

function parseSchedule(tokens) {
  var ctx = { tokens: tokens, pos: 0 };
  var result = { regular: [], special: [], labeled: [] };

  parseClauseInto(ctx, result);
  while (peekType(ctx) === 'AMP' || peekType(ctx) === 'COMMA') {
    // A separator here only starts a new clause if a clause-opener follows.
    if (!clauseOpenerAfterSeparators(ctx)) break;
    consumeSeparators(ctx);
    parseClauseInto(ctx, result);
  }

  if (ctx.pos < ctx.tokens.length) {
    throw new Error('Trailing tokens starting at ' + describe(peek(ctx)));
  }
  return result;
}

// A clause = [LABEL]? [ORDINALS]? [DAY-SCOPE]? TIME-SPEC* [CLOSURE]?
// It must contain at least one of: label, ordinals, day-scope.
function parseClauseInto(ctx, result) {
  var label = null;
  if (peekType(ctx) === 'LABEL') { label = next(ctx).value; }

  var ordinals = parseOrdinals(ctx);
  var days = parseDayScope(ctx);

  if (!label && ordinals.length === 0 && days.length === 0) {
    throw new Error('Clause with no label, ordinal, or day at ' + describe(peek(ctx)));
  }

  var timeSpecs = parseTimeSpecs(ctx);
  var closure = parseClosure(ctx);

  emitClause(result, { label: label, ordinals: ordinals, days: days, timeSpecs: timeSpecs, closure: closure });
}

function parseOrdinals(ctx) {
  var ordinals = [];
  if (peekType(ctx) !== 'ORDINAL') return ordinals;
  ordinals.push(next(ctx).value);
  // Additional ordinals joined by &/, (e.g. "1st & 3rd", "1st & 2nd").
  while ((peekType(ctx) === 'AMP' || peekType(ctx) === 'COMMA') && typeAfterSeparators(ctx) === 'ORDINAL') {
    consumeSeparators(ctx);
    ordinals.push(next(ctx).value);
  }
  return ordinals;
}

// A day-scope is one or more day units (single day OR "Mo - Fr" / "Mo to Fr" range),
// joined by &/, — collected only while no time-spec has begun.
function parseDayScope(ctx) {
  if (peekType(ctx) !== 'DAY') return [];
  var days = parseDayUnit(ctx);
  while ((peekType(ctx) === 'AMP' || peekType(ctx) === 'COMMA') && typeAfterSeparators(ctx) === 'DAY') {
    consumeSeparators(ctx);
    var more = parseDayUnit(ctx);
    for (var i = 0; i < more.length; i++) if (days.indexOf(more[i]) === -1) days.push(more[i]);
  }
  return days;
}

// One day, or a range: DAY (DASH | TO) DAY  (with wrap-around, e.g. "Th - Mo").
function parseDayUnit(ctx) {
  var start = next(ctx).value; // DAY
  var isRange = peekType(ctx) === 'DASH' || (peekType(ctx) === 'TO' && typeAt(ctx, 1) === 'DAY');
  if (!isRange) return [start];
  next(ctx); // consume DASH or TO
  if (peekType(ctx) !== 'DAY') throw new Error('Expected day after range separator');
  var end = next(ctx).value;
  return expandDayRange(start, end);
}

function expandDayRange(start, end) {
  var startIdx = DAY_ORDER[start];
  var endIdx = DAY_ORDER[end];
  var out = [];
  var i = startIdx;
  // Inclusive walk with wrap-around (Th - Mo → Th Fr Sa Su Mo).
  for (var guard = 0; guard < 7; guard++) {
    out.push(DAY_CODES[i]);
    if (i === endIdx) return out;
    i = (i + 1) % 7;
  }
  return out;
}

// Zero or more time-specs. Each is either a range (TIME AMPM to TIME AMPM) or an open-only
// time (optionally introduced by FROM). Multiple specs join by &/, when a TIME follows.
function parseTimeSpecs(ctx) {
  var specs = [];
  var first = tryParseTimeSpec(ctx);
  if (!first) return specs;
  specs.push(first);
  while ((peekType(ctx) === 'AMP' || peekType(ctx) === 'COMMA') && timeSpecStartsAfterSeparators(ctx)) {
    consumeSeparators(ctx);
    var s = tryParseTimeSpec(ctx);
    if (!s) throw new Error('Expected time after separator');
    specs.push(s);
  }
  return specs;
}

function tryParseTimeSpec(ctx) {
  var hadFrom = false;
  if (peekType(ctx) === 'FROM') { next(ctx); hadFrom = true; }
  if (peekType(ctx) !== 'TIME') {
    if (hadFrom) throw new Error('Expected time after "from"');
    return null;
  }
  var open = parseClock(ctx);
  if (peekType(ctx) === 'TO') {
    next(ctx);
    var close = parseClock(ctx);
    return { open: open, close: close };
  }
  return { open: open, close: null }; // open-only
}

// CLOSURE = CLOSED [FROM] TIME AMPM to TIME AMPM
function parseClosure(ctx) {
  if (peekType(ctx) !== 'CLOSED') return null;
  next(ctx);
  if (peekType(ctx) === 'FROM') next(ctx);
  var start = parseClock(ctx);
  if (peekType(ctx) !== 'TO') throw new Error('Closure needs "to"');
  next(ctx);
  var end = parseClock(ctx);
  return { start: start, end: end };
}

// TIME AMPM → "HH:MM"
function parseClock(ctx) {
  if (peekType(ctx) !== 'TIME') throw new Error('Expected time');
  var timeTok = next(ctx);
  if (peekType(ctx) !== 'AMPM') throw new Error('Time missing a.m./p.m.');
  var ap = next(ctx).value;
  return to24Hour(timeTok.hour, timeTok.minute, ap);
}

function to24Hour(hour, minute, ap) {
  if (hour < 1 || hour > 12) throw new Error('Hour out of range: ' + hour);
  if (minute > 59) throw new Error('Minute out of range: ' + minute);
  var h = hour;
  if (ap === 'p' && h !== 12) h += 12;
  else if (ap === 'a' && h === 12) h = 0;
  return pad2(h) + ':' + pad2(minute);
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

// ---------------------------------------------------------------------------
// Emit — map a parsed clause into the output schema
// ---------------------------------------------------------------------------

function emitClause(result, clause) {
  if (clause.closure && (clause.label || clause.ordinals.length > 0)) {
    throw new Error('Closures are only supported on plain day-scope clauses');
  }

  if (clause.label) {
    var lDays = clause.days.length > 0 ? clause.days.slice() : null;
    if (clause.timeSpecs.length === 0) {
      result.labeled.push({ label: clause.label, days: lDays, open: null, close: null });
    } else {
      clause.timeSpecs.forEach(function (ts) {
        result.labeled.push({ label: clause.label, days: lDays, open: ts.open, close: ts.close });
      });
    }
    return;
  }

  if (clause.ordinals.length > 0) {
    var pattern = clause.ordinals.join(' & ') + (clause.days.length ? ' ' + clause.days.join(' ') : '');
    if (clause.timeSpecs.length === 0) {
      result.special.push({ pattern: pattern, open: null, close: null });
    } else {
      clause.timeSpecs.forEach(function (ts) {
        result.special.push({ pattern: pattern, open: ts.open, close: ts.close });
      });
    }
    return;
  }

  // Plain day-scope → regular entries.
  var days = clause.days.slice();
  if (clause.closure) {
    if (clause.timeSpecs.length !== 1 || clause.timeSpecs[0].close === null) {
      throw new Error('A closure requires exactly one open→close range');
    }
    var r = clause.timeSpecs[0];
    var c = clause.closure;
    if (!(r.open < c.start && c.start < c.end && c.end < r.close)) {
      throw new Error('Closure interval must sit strictly inside the open range');
    }
    result.regular.push({ days: days.slice(), open: r.open, close: c.start });
    result.regular.push({ days: days.slice(), open: c.end, close: r.close });
    return;
  }

  if (clause.timeSpecs.length === 0) {
    result.regular.push({ days: days.slice(), open: null, close: null });
  } else {
    clause.timeSpecs.forEach(function (ts) {
      result.regular.push({ days: days.slice(), open: ts.open, close: ts.close });
    });
  }
}

// ---------------------------------------------------------------------------
// Token-stream helpers
// ---------------------------------------------------------------------------

function peek(ctx) { return ctx.tokens[ctx.pos] || null; }
function peekType(ctx) { return ctx.pos < ctx.tokens.length ? ctx.tokens[ctx.pos].type : null; }
function typeAt(ctx, offset) {
  var idx = ctx.pos + offset;
  return idx < ctx.tokens.length ? ctx.tokens[idx].type : null;
}
function next(ctx) {
  if (ctx.pos >= ctx.tokens.length) throw new Error('Unexpected end of input');
  return ctx.tokens[ctx.pos++];
}
function describe(tok) { return tok ? (tok.type + ' "' + tok.text + '"') : 'end'; }

// Skip a run of consecutive separators (COMMA/AMP) starting at pos; return the type of the
// token that follows the run (handles the Oxford ", &").
function typeAfterSeparators(ctx) {
  var i = ctx.pos;
  while (i < ctx.tokens.length && (ctx.tokens[i].type === 'AMP' || ctx.tokens[i].type === 'COMMA')) i++;
  return i < ctx.tokens.length ? ctx.tokens[i].type : null;
}
function consumeSeparators(ctx) {
  while (peekType(ctx) === 'AMP' || peekType(ctx) === 'COMMA') ctx.pos++;
}
function clauseOpenerAfterSeparators(ctx) {
  var t = typeAfterSeparators(ctx);
  return t === 'ORDINAL' || t === 'DAY' || t === 'LABEL';
}
function timeSpecStartsAfterSeparators(ctx) {
  var i = ctx.pos;
  while (i < ctx.tokens.length && (ctx.tokens[i].type === 'AMP' || ctx.tokens[i].type === 'COMMA')) i++;
  var t = i < ctx.tokens.length ? ctx.tokens[i].type : null;
  return t === 'TIME' || t === 'FROM';
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Parse human-readable hours into the CRG JSON string.
 * Returns '' on ANY failure (fail-loud), '24/7' for the round-the-clock special, or a JSON
 * string with the non-empty subset of { regular, special, labeled }.
 * @param {string} input
 * @return {string}
 * @customfunction
 */
function PARSE_HOURS(input) {
  if (input === null || input === undefined) return '';
  var str = String(input).trim();
  if (str === '') return '';
  if (str.toLowerCase() === '24/7') return '24/7';

  try {
    var tokens = tokenize(str);
    var parsed = parseSchedule(tokens);

    var out = {};
    if (parsed.regular.length) out.regular = parsed.regular;
    if (parsed.special.length) out.special = parsed.special;
    if (parsed.labeled.length) out.labeled = parsed.labeled;

    if (!out.regular && !out.special && !out.labeled) return '';
    return JSON.stringify(out);
  } catch (e) {
    return ''; // fail loud: blank cell → maintainer notices and fixes the source text
  }
}

// ---------------------------------------------------------------------------
// Apps Script menu + batch runners (ignored by Node)
// ---------------------------------------------------------------------------

function onOpen() {
  if (typeof SpreadsheetApp === 'undefined') return;
  SpreadsheetApp.getUi()
    .createMenu('CRG Hours')
    .addItem('Parse All Hours', 'parseAllHours')
    .addItem('Parse Selected', 'parseSelectedCells')
    .addToUi();
}

/**
 * Bulk parse: read source hours from column K (11), write JSON to column AF (32).
 * Adjust SOURCE_COL / OUTPUT_COL if the sheet layout changes.
 */
function parseAllHours() {
  var SOURCE_COL = 11;  // column K
  var OUTPUT_COL = 32;  // column AF
  var ui = SpreadsheetApp.getUi();

  // Guard against silent column drift: confirm the layout before writing anything.
  var confirm = ui.alert(
    'Verify columns',
    'This will READ hours from column ' + columnLetter(SOURCE_COL) +
      ' and WRITE JSON to column ' + columnLetter(OUTPUT_COL) + '.\n\n' +
      'Are those still correct?',
    ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) {
    ui.alert('Cancelled. Update SOURCE_COL / OUTPUT_COL in the script if the layout changed.');
    return;
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { ui.alert('No data found'); return; }

  var source = sheet.getRange(2, SOURCE_COL, lastRow - 1, 1).getValues();
  var blanks = [];
  var out = source.map(function (row, idx) {
    var val = row[0];
    if (!val) return [''];
    var parsed = PARSE_HOURS(val);
    if (parsed === '') blanks.push(idx + 2); // sheet row number
    return [parsed];
  });

  sheet.getRange(2, OUTPUT_COL, lastRow - 1, 1).setValues(out);
  var msg = 'Parsed ' + (lastRow - 1) + ' rows.';
  if (blanks.length) msg += '\n\n' + blanks.length + ' returned BLANK (fix source text) at rows: ' + blanks.join(', ');
  ui.alert(msg);
}

// Convert a 1-based column number to its spreadsheet letter (11 → "K", 32 → "AF").
function columnLetter(col) {
  var letter = '';
  var n = col;
  while (n > 0) {
    var rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/**
 * Parse the currently selected cells; write results into the adjacent columns to the right.
 */
function parseSelectedCells() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var selection = sheet.getActiveRange();
  var values = selection.getValues();
  var results = values.map(function (row) {
    return row.map(function (cell) { return cell ? PARSE_HOURS(cell) : ''; });
  });
  sheet.getRange(selection.getRow(), selection.getColumn() + selection.getNumColumns(),
    selection.getNumRows(), selection.getNumColumns()).setValues(results);
}

// ---------------------------------------------------------------------------
// Node test-harness bridge (Apps Script has no `module`, so this is a no-op there)
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PARSE_HOURS: PARSE_HOURS, tokenize: tokenize, parseSchedule: parseSchedule };
}
