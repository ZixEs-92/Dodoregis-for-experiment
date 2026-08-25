var STATUS_ORDER = [
  'S1_RECEIVED', 'S2_WAITING_PART', 'S3_PART_RECEIVED', 'S4_TESTING',
  'S5_DONE_TESTING', 'S6_REPORTING', 'S7_SENT', 'S8_CLOSED'
];
var SPECIAL_STATUSES = ['S9_HOLD', 'S10_CANCEL'];

function statusIndex_(status) {
  return STATUS_ORDER.indexOf(status);
}

function addItem_(user, data) {
  requireRole_(user, ['ADMIN', 'ENGINEER']);
  var request = findById_('TestRequests', data.requestId);
  if (!request) throw new Error('ไม่พบใบรีเควสนี้');
  var itemCode = nextItemCode_(data.requestId, request.regisNo);
  var item = {
    id: nextId_('TestItems'),
    itemCode: itemCode,
    requestId: data.requestId,
    testName: data.testName || '',
    status: 'S1_RECEIVED',
    ownerId: data.ownerId || '',
    planDate: data.planDate || '',
    model: data.model || '',
    partName: data.partName || '',
    partNo: data.partNo || '',
    qty: data.qty || '',
    partIdsCsv: (data.partIds || []).join(','),
    partReceivedDate: '',
    partLocation: '',
    finishedLocation: '',
    rawDataLocation: '',
    createdAt: new Date().toISOString()
  };
  appendRow_('TestItems', item);
  logStatus_(item.id, '', 'S1_RECEIVED', user, 'สร้างรายการทดสอบ');
  return item;
}

function getItemDetail_(user, itemCode) {
  var item = readAll_('TestItems').filter(function (i) { return i.itemCode === itemCode; })[0];
  if (!item) throw new Error('ไม่พบรายการทดสอบนี้ (' + itemCode + ')');
  var request = findById_('TestRequests', item.requestId);
  if (user.role === 'REQUESTER' && String(request.departmentId) !== String(user.departmentId)) {
    throw new Error('ไม่มีสิทธิ์ดูรายการนี้');
  }
  var runs = readAll_('TestRuns').filter(function (r) { return String(r.itemId) === String(item.id); });
  var report = getReportForItem_(item.id);
  var statusLogs = readAll_('StatusLogs').filter(function (l) { return String(l.itemId) === String(item.id); });
  var locationLogs = readAll_('LocationLogs').filter(function (l) { return String(l.itemId) === String(item.id); });
  return { item: item, request: request, runs: runs, report: report, statusLogs: statusLogs, locationLogs: locationLogs };
}

function validateStatusRequirements_(target, item, request, report) {
  var errors = [];
  if (statusIndex_(target) >= statusIndex_('S3_PART_RECEIVED') && statusIndex_(item.status) < statusIndex_('S3_PART_RECEIVED')) {
    if (!item.partReceivedDate) errors.push('ต้องมีวันที่รับพาร์ท');
    if (!item.partLocation) errors.push('ต้องมีตำแหน่งเก็บพาร์ท');
  }
  if (statusIndex_(target) >= statusIndex_('S7_SENT') && request.reportRequired) {
    var hasSentDate = report && report.sentDate;
    var hasReportUrlOrSentTo = report && (report.reportUrl || report.sentTo);
    if (!hasSentDate) errors.push('ต้องมีวันที่ส่งรีพอร์ท');
    if (!hasReportUrlOrSentTo) errors.push('ต้องมีลิงก์รีพอร์ท หรือระบุว่าส่งให้ใคร');
  }
  if (target === 'S8_CLOSED') {
    if (!item.finishedLocation) errors.push('ต้องมีที่เก็บชิ้นงาน');
    if (!item.rawDataLocation) errors.push('ต้องมีที่เก็บ raw data');
  }
  return errors;
}

function changeItemStatus_(user, data) {
  requireRole_(user, ['ADMIN', 'ENGINEER']);
  var item = findById_('TestItems', data.itemId);
  if (!item) throw new Error('ไม่พบรายการทดสอบนี้');
  var request = findById_('TestRequests', item.requestId);
  var target = data.target;

  if (SPECIAL_STATUSES.indexOf(target) === -1) {
    var curIdx = statusIndex_(item.status);
    var targetIdx = statusIndex_(target);
    if (targetIdx === -1) throw new Error('สถานะไม่ถูกต้อง: ' + target);
    if (targetIdx < curIdx) throw new Error('ย้อนสถานะไม่ได้');
  }

  var patch = { status: target };
  ['partReceivedDate', 'partLocation', 'finishedLocation', 'rawDataLocation'].forEach(function (f) {
    if (data[f]) patch[f] = data[f];
  });

  var reportPatch = {};
  ['sentDate', 'reportUrl', 'sentTo'].forEach(function (f) {
    if (data[f]) reportPatch[f] = data[f];
  });
  var report = getReportForItem_(item.id);
  if (Object.keys(reportPatch).length) {
    reportPatch.itemId = item.id;
    report = upsertReport_(user, reportPatch);
  }

  var mergedItem = {};
  Object.keys(item).forEach(function (k) { mergedItem[k] = patch[k] !== undefined ? patch[k] : item[k]; });
  var errors = validateStatusRequirements_(target, mergedItem, request, report);
  if (errors.length) throw new Error(errors.join(', '));

  updateRow_('TestItems', item.id, patch);
  logStatus_(item.id, item.status, target, user, data.note || '');
  if (data.partLocation) logLocation_(item.id, 'PART', data.partLocation, user);
  if (data.finishedLocation) logLocation_(item.id, 'FINISHED', data.finishedLocation, user);
  if (data.rawDataLocation) logLocation_(item.id, 'RAW_DATA', data.rawDataLocation, user);

  return getItemDetail_(user, item.itemCode);
}

function logStatus_(itemId, from, to, user, note) {
  appendRow_('StatusLogs', {
    id: nextId_('StatusLogs'),
    itemId: itemId,
    fromStatus: from,
    toStatus: to,
    changedBy: user.username,
    changedAt: new Date().toISOString(),
    note: note || ''
  });
}

function logLocation_(itemId, kind, location, user) {
  appendRow_('LocationLogs', {
    id: nextId_('LocationLogs'),
    itemId: itemId,
    kind: kind,
    location: location,
    changedBy: user.username,
    changedAt: new Date().toISOString()
  });
}
