/**
 * ระบบ Regis งานทดสอบ — Apps Script
 * ติดตั้ง: Extensions > Apps Script > วางโค้ดนี้ > แก้ ROOT_FOLDER_ID > Save > รีเฟรชชีท
 */

// ⚠️ แก้ตรงนี้: ใส่ Folder ID ของโฟลเดอร์กลางใน Google Drive (จาก URL ของโฟลเดอร์)
const ROOT_FOLDER_ID = 'ใส่_FOLDER_ID_ที่นี่';

const SHEET_REQ = 'TestRequests';
const SHEET_RUN = 'TestRuns';
// คอลัมน์ในชีท TestRequests (A=1 ... U=21)
const COL = { REGIS: 1, DATE_REQ: 4, MODEL: 5, STATUS: 15, FOLDER: 19, LINK: 20, QR: 21 };

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ระบบ Regis')
    .addItem('➕ ลงงานใหม่ (ออกเลข + สร้างโฟลเดอร์ + QR)', 'newRegis')
    .addItem('📁 สร้างโฟลเดอร์/QR ให้แถวที่เลือก', 'fixSelectedRow')
    .addItem('📂 สร้างโฟลเดอร์ Run ให้แถวที่เลือก (ชีท TestRuns)', 'newRunFolder')
    .addToUi();
}

/** ลงงานใหม่: เพิ่มแถว, ออกเลข TR-YYMM-###, สร้างโฟลเดอร์, ใส่ลิงก์+QR */
function newRegis() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_REQ);
  const row = sh.getLastRow() + 1;
  const regisNo = nextRegisNo_(sh);

  sh.getRange(row, COL.REGIS).setValue(regisNo);
  sh.getRange(row, COL.DATE_REQ).setValue(new Date());
  sh.getRange(row, COL.STATUS).setValue('1-รับใบรีเควส');
  createFolders_(sh, row, regisNo);
  setQr_(ss, sh, row);
  ss.toast('ลงงาน ' + regisNo + ' แล้ว — กรอกรายละเอียดที่เหลือในแถวที่ ' + row, 'ระบบ Regis', 8);
}

/** ใช้กรณีลงแถวเองแล้วอยากให้ระบบสร้างโฟลเดอร์+QR ย้อนหลัง */
function fixSelectedRow() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_REQ);
  const row = sh.getActiveCell().getRow();
  if (row < 2) return;
  let regisNo = sh.getRange(row, COL.REGIS).getValue();
  if (!regisNo) {
    regisNo = nextRegisNo_(sh);
    sh.getRange(row, COL.REGIS).setValue(regisNo);
  }
  if (!sh.getRange(row, COL.FOLDER).getValue() || String(sh.getRange(row, COL.FOLDER).getValue()).indexOf('http') !== 0) {
    createFolders_(sh, row, regisNo);
  }
  setQr_(ss, sh, row);
  ss.toast('อัปเดตแถว ' + row + ' (' + regisNo + ') แล้ว', 'ระบบ Regis', 5);
}

/** ในชีท TestRuns: สร้างโฟลเดอร์ 03_RawData/RunN ของงานนั้น แล้วใส่ลิงก์ในคอลัมน์ H */
function newRunFolder() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_RUN);
  if (ss.getActiveSheet().getName() !== SHEET_RUN) {
    SpreadsheetApp.getUi().alert('กรุณาเลือกแถวในชีท TestRuns ก่อน');
    return;
  }
  const row = sh.getActiveCell().getRow();
  if (row < 2) return;
  const regisNo = String(sh.getRange(row, 1).getValue());
  const runNo = sh.getRange(row, 2).getValue() || 1;
  if (!regisNo) { SpreadsheetApp.getUi().alert('แถวนี้ยังไม่มี Regis No.'); return; }

  const jobFolder = findJobFolder_(regisNo);
  if (!jobFolder) { SpreadsheetApp.getUi().alert('หาโฟลเดอร์ของ ' + regisNo + ' ไม่เจอ'); return; }
  const raw = getOrCreate_(jobFolder, '03_RawData');
  const run = getOrCreate_(raw, 'Run' + runNo);
  sh.getRange(row, 8).setValue(run.getUrl());
  ss.toast('สร้าง ' + regisNo + '/03_RawData/Run' + runNo + ' แล้ว', 'ระบบ Regis', 5);
}

// ---------- helpers ----------

/** เลขรันถัดไปของเดือนนี้: TR-YYMM-### */
function nextRegisNo_(sh) {
  const now = new Date();
  const prefix = 'TR-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyMM') + '-';
  const vals = sh.getRange(2, COL.REGIS, Math.max(sh.getLastRow() - 1, 1), 1).getValues().flat();
  let max = 0;
  vals.forEach(function (v) {
    v = String(v);
    if (v.indexOf(prefix) === 0) max = Math.max(max, parseInt(v.substring(prefix.length), 10) || 0);
  });
  return prefix + ('00' + (max + 1)).slice(-3);
}

/** สร้างโครงโฟลเดอร์ ปี/RegisNo_Model/01..04 แล้วใส่ลิงก์ในคอลัมน์ S */
function createFolders_(sh, row, regisNo) {
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const year = getOrCreate_(root, String(new Date().getFullYear()));
  const model = String(sh.getRange(row, COL.MODEL).getValue() || '').trim();
  const name = model ? regisNo + '_' + model.replace(/[\\/:*?"<>|]/g, '-') : regisNo;
  const job = getOrCreate_(year, name);
  getOrCreate_(job, '01_Request');
  getOrCreate_(job, '02_Photos');
  getOrCreate_(job, '03_RawData');
  const rep = getOrCreate_(job, '04_Report');
  getOrCreate_(rep, 'Draft');
  getOrCreate_(rep, 'Final');
  sh.getRange(row, COL.FOLDER).setValue(job.getUrl());
}

/** ลิงก์เปิด record + รูป QR (สแกนแล้วเปิดแถวนั้นใน Google Sheets/AppSheet) */
function setQr_(ss, sh, row) {
  const link = ss.getUrl() + '#gid=' + sh.getSheetId() + '&range=A' + row;
  sh.getRange(row, COL.LINK).setValue(link);
  sh.getRange(row, COL.QR).setFormula(
    '=IMAGE("https://quickchart.io/qr?size=200&text=" & ENCODEURL(' +
    sh.getRange(row, COL.LINK).getA1Notation() + '))'
  );
  sh.setRowHeight(row, 80);
}

function getOrCreate_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** หาโฟลเดอร์งานจาก Regis No. (ค้นทุกโฟลเดอร์ปีใต้ root) */
function findJobFolder_(regisNo) {
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const years = root.getFolders();
  while (years.hasNext()) {
    const y = years.next();
    const subs = y.getFolders();
    while (subs.hasNext()) {
      const f = subs.next();
      if (f.getName().indexOf(regisNo) === 0) return f;
    }
  }
  return null;
}
