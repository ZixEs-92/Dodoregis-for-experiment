// รันฟังก์ชันนี้ครั้งเดียวจาก Apps Script editor (เลือก "setup" ที่ dropdown แล้วกด Run)
// จะสร้างสเปรดชีตฐานข้อมูลใหม่ + ตั้งค่า Script Properties + สร้างบัญชี admin เริ่มต้นให้
function setup() {
  var ss = SpreadsheetApp.create('Dodoregis GAS DB');
  var props = PropertiesService.getScriptProperties();
  props.setProperty('DB_SPREADSHEET_ID', ss.getId());
  props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());

  var schemas = {
    Users: ['id', 'username', 'passwordHash', 'passwordSalt', 'displayName', 'role', 'departmentId', 'memberId', 'active'],
    Departments: ['id', 'name', 'slaDays'],
    Members: ['id', 'name', 'departmentId', 'active'],
    Counters: ['key', 'value'],
    TestRequests: ['id', 'regisNo', 'requesterName', 'requesterEmail', 'requesterPhone', 'receivedDate', 'testObject', 'purpose', 'departmentId', 'createdBy', 'desiredDate', 'reportRequired', 'createdAt'],
    RequestParts: ['id', 'requestId', 'model', 'partName', 'partNo', 'qty'],
    TestItems: ['id', 'itemCode', 'requestId', 'testName', 'status', 'ownerId', 'planDate', 'model', 'partName', 'partNo', 'qty', 'partIdsCsv', 'partReceivedDate', 'partLocation', 'finishedLocation', 'rawDataLocation', 'createdAt'],
    TestRuns: ['id', 'itemId', 'runNo', 'startDate', 'endDate', 'loadedBy', 'testedBy', 'result', 'rawDataLink'],
    Reports: ['id', 'itemId', 'sentDate', 'reportUrl', 'sentTo', 'preparedBy', 'approvedBy', 'updatedAt'],
    StatusLogs: ['id', 'itemId', 'fromStatus', 'toStatus', 'changedBy', 'changedAt', 'note'],
    LocationLogs: ['id', 'itemId', 'kind', 'location', 'changedBy', 'changedAt']
  };

  var first = true;
  Object.keys(schemas).forEach(function (name) {
    var sheet = first ? ss.getSheets()[0].setName(name) : ss.insertSheet(name);
    first = false;
    sheet.getRange(1, 1, 1, schemas[name].length).setValues([schemas[name]]);
    sheet.setFrozenRows(1);
  });

  var salt = Utilities.getUuid();
  var hash = hashPassword_('admin123', salt);
  ss.getSheetByName('Users').appendRow([1, 'admin', hash, salt, 'ผู้ดูแลระบบ', 'ADMIN', '', '', true]);

  ss.getSheetByName('Departments').appendRow([1, 'แผนกทดสอบ', 5]);

  Logger.log('สร้างสำเร็จ — เปิดสเปรดชีตที่: ' + ss.getUrl());
  Logger.log('เข้าสู่ระบบด้วย username: admin / password: admin123 (เปลี่ยนทันทีหลัง deploy จริง — ตอนนี้ยังไม่มีหน้าเปลี่ยนรหัสผ่าน ต้องแก้ passwordHash/passwordSalt ในชีต Users เอง)');
}
