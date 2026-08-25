var DB_SPREADSHEET_ID_KEY = 'DB_SPREADSHEET_ID';

function getDb_() {
  var id = PropertiesService.getScriptProperties().getProperty(DB_SPREADSHEET_ID_KEY);
  if (!id) throw new Error('ยังไม่ได้ตั้งค่า DB_SPREADSHEET_ID — รันฟังก์ชัน setup() ก่อน');
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  var sheet = getDb_().getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบชีต: ' + name);
  return sheet;
}

function readAll_(name) {
  var sheet = getSheet_(name);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var blank = row.every(function (c) { return c === '' || c === null; });
    if (blank) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
    rows.push(obj);
  }
  return rows;
}

function findById_(name, id) {
  var rows = readAll_(name);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

function nextId_(name) {
  return withLock_(function () {
    var rows = readAll_(name);
    var max = 0;
    rows.forEach(function (r) { if (Number(r.id) > max) max = Number(r.id); });
    return max + 1;
  });
}

function appendRow_(name, obj) {
  var sheet = getSheet_(name);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
  return obj;
}

function updateRow_(name, id, patch) {
  var sheet = getSheet_(name);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      for (var j = 0; j < headers.length; j++) {
        if (patch[headers[j]] !== undefined) sheet.getRange(i + 1, j + 1).setValue(patch[headers[j]]);
      }
      return findById_(name, id);
    }
  }
  throw new Error('ไม่พบแถว: ' + name + '#' + id);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function nextSeq_(counterKey) {
  return withLock_(function () {
    var sheet = getSheet_('Counters');
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === counterKey) {
        var next = Number(values[i][1]) + 1;
        sheet.getRange(i + 1, 2).setValue(next);
        return next;
      }
    }
    sheet.appendRow([counterKey, 1]);
    return 1;
  });
}

function pad_(n, width) {
  var s = '' + n;
  while (s.length < width) s = '0' + s;
  return s;
}

function nextRegisNo_() {
  var yymm = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMM');
  var seq = nextSeq_('regis:' + yymm);
  return 'TR-' + yymm + '-' + pad_(seq, 3);
}

function nextItemCode_(requestId, regisNo) {
  var seq = nextSeq_('item:' + requestId);
  return regisNo + '-' + pad_(seq, 2);
}

function listMasterData_() {
  return {
    departments: readAll_('Departments'),
    members: readAll_('Members')
  };
}
