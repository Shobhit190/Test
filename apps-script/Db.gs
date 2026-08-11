/**
 * Generic Google Sheets "table" helpers.
 * Each table is a sheet tab; row 1 is headers, row 2+ is data.
 * Every table's first header column must be "id".
 */

function ss() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error(
      "This script must be bound to a Google Sheet. Open your Sheet, then Extensions > Apps Script."
    );
  }
  return active;
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
