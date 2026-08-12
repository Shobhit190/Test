/**
 * Generic Google Sheets "table" helpers.
 * Each table is a sheet tab; row 1 is headers, row 2+ is data.
 * Every table's first header column must be "id".
 */

function ss() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);

  throw new Error(
    "No spreadsheet found. Either open this script from your Sheet " +
      "(Extensions > Apps Script), or fill in your Sheet URL in " +
      "setupFromSheetUrl() below and run that function once."
  );
}

/**
 * For a STANDALONE Apps Script project (created via script.google.com
 * directly, not bound to a Sheet via Extensions > Apps Script): tells every
 * other function which spreadsheet to use. Not needed for a bound script.
 */
function setup(spreadsheetUrlOrId) {
  var input = String(spreadsheetUrlOrId).trim();
  var id = input;
  var match = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) id = match[1];

  // Strip anything that isn't a valid Drive-file-id character (letters,
  // digits, -, _). Valid ids never contain anything else, so this quietly
  // fixes invisible/zero-width characters that can ride along with a paste
  // (e.g. a zero-width space) without JS's trim() catching them.
  id = id.replace(/[^A-Za-z0-9_-]/g, "");

  if (id === "PASTE_YOUR_GOOGLE_SHEET_URL_HERE" || !id) {
    throw new Error(
      "setupFromSheetUrl() still has the placeholder text in it. " +
        "Open your Sheet in the browser, copy its full URL from the address bar, " +
        "and paste that in place of PASTE_YOUR_GOOGLE_SHEET_URL_HERE."
    );
  }

  var sheet;
  try {
    sheet = SpreadsheetApp.openById(id); // throws if malformed/inaccessible
  } catch (e) {
    throw new Error(
      "Could not open a spreadsheet with id \"" +
        id +
        "\" (" +
        e.message +
        "). Double check you pasted the FULL Sheet URL from the browser's address " +
        "bar (while the Sheet itself is open) with no extra text or missing characters."
    );
  }
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", id);
  Logger.log("Spreadsheet linked: " + sheet.getUrl());
}

/**
 * The Apps Script "Run" button can't take a typed-in argument, so this is
 * a zero-argument function you can select and Run directly: paste your
 * Sheet's URL between the quotes below, run this once, then run seedAll().
 * Skip this entirely if your script is bound to a Sheet (Extensions > Apps
 * Script from within the Sheet) — ss() will find it automatically.
 */
function setupFromSheetUrl() {
  setup("PASTE_YOUR_GOOGLE_SHEET_URL_HERE");
}

function getSheet_(name) {
  var sheet = ss().getSheetByName(name);
  if (!sheet) {
    sheet = ss().insertSheet(name);
  }
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  var range = sheet.getRange(1, 1, 1, headers.length);
  var existing = range.getValues()[0];
  var isBlank = existing.join("") === "";
  if (isBlank) {
    range.setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function newId_() {
  return Utilities.getUuid();
}

/**
 * Coerces a value to a string for text handling, treating null/undefined
 * as "". Needed because Google Sheets auto-parses a pure-numeric string
 * written to a cell (e.g. a KPI target of "100") into a real Number type;
 * once that row is read back, the value is a JS number, not a string, and
 * a bare `(v || "").trim()` throws since numbers have no .trim().
 */
function str_(v) {
  return v === undefined || v === null ? "" : String(v);
}

/** Reads every non-blank row of a table into an array of plain objects. */
function readTable(name, headers) {
  var sheet = getSheet_(name);
  ensureHeaders_(sheet, headers);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === "" || row[0] === null) continue; // skip blank rows
    var obj = { _row: i + 2 };
    for (var h = 0; h < headers.length; h++) {
      obj[headers[h]] = row[h];
    }
    out.push(obj);
  }
  return out;
}

/** Appends a new row. Fills in an id if the object doesn't already have one. */
function insertRow(name, headers, obj) {
  var sheet = getSheet_(name);
  ensureHeaders_(sheet, headers);
  if (!obj.id) obj.id = newId_();
  var row = headers.map(function (h) {
    var v = obj[h];
    return v === undefined || v === null ? "" : v;
  });
  sheet.appendRow(row);
  return obj;
}

/** Updates the row matching `id` by shallow-merging `patch` into it. */
function updateRowById(name, headers, id, patch) {
  var rows = readTable(name, headers);
  var target = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      target = rows[i];
      break;
    }
  }
  if (!target) throw new Error("Not found in " + name + ": " + id);
  var merged = {};
  headers.forEach(function (h) {
    merged[h] = target[h];
  });
  Object.keys(patch).forEach(function (k) {
    merged[k] = patch[k];
  });
  var sheet = getSheet_(name);
  var rowValues = headers.map(function (h) {
    var v = merged[h];
    return v === undefined || v === null ? "" : v;
  });
  sheet.getRange(target._row, 1, 1, headers.length).setValues([rowValues]);
  return merged;
}

/** Deletes every row for which predicate(row) is true. */
function deleteRowsWhere(name, headers, predicate) {
  var sheet = getSheet_(name);
  var rows = readTable(name, headers);
  var toDelete = rows.filter(predicate).map(function (r) {
    return r._row;
  });
  toDelete.sort(function (a, b) {
    return b - a;
  }); // delete bottom-up so row numbers stay valid
  toDelete.forEach(function (rowNum) {
    sheet.deleteRow(rowNum);
  });
}

function findOne_(name, headers, predicate) {
  var rows = readTable(name, headers);
  for (var i = 0; i < rows.length; i++) {
    if (predicate(rows[i])) return rows[i];
  }
  return null;
}
