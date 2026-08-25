function createRequest_(user, data) {
  requireRole_(user, ['ADMIN', 'ENGINEER', 'REQUESTER']);
  var regisNo = nextRegisNo_();
  var id = nextId_('TestRequests');
  var departmentId = user.role === 'REQUESTER' ? user.departmentId : data.departmentId;
  var req = {
    id: id,
    regisNo: regisNo,
    requesterName: data.requesterName || '',
    requesterEmail: data.requesterEmail || '',
    requesterPhone: data.requesterPhone || '',
    receivedDate: data.receivedDate || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'),
    testObject: data.testObject || '',
    purpose: data.purpose || '',
    departmentId: departmentId,
    createdBy: user.uid,
    desiredDate: data.desiredDate || '',
    reportRequired: data.reportRequired !== false,
    createdAt: new Date().toISOString()
  };
  appendRow_('TestRequests', req);

  (data.parts || []).forEach(function (p) {
    appendRow_('RequestParts', {
      id: nextId_('RequestParts'),
      requestId: id,
      model: p.model || '',
      partName: p.partName || '',
      partNo: p.partNo || '',
      qty: p.qty || ''
    });
  });

  return getRequestDetail_(user, id);
}

function listRequests_(user) {
  var requests = readAll_('TestRequests');
  if (user.role === 'REQUESTER') {
    requests = requests.filter(function (r) { return String(r.departmentId) === String(user.departmentId); });
  }
  requests.sort(function (a, b) { return b.id - a.id; });
  return requests;
}

function getRequestDetail_(user, requestId) {
  var request = findById_('TestRequests', requestId);
  if (!request) throw new Error('ไม่พบใบรีเควสนี้');
  if (user.role === 'REQUESTER' && String(request.departmentId) !== String(user.departmentId)) {
    throw new Error('ไม่มีสิทธิ์ดูใบนี้');
  }
  var parts = readAll_('RequestParts').filter(function (p) { return String(p.requestId) === String(requestId); });
  var items = readAll_('TestItems').filter(function (i) { return String(i.requestId) === String(requestId); });
  return { request: request, parts: parts, items: items };
}

function addRequestPart_(user, data) {
  requireRole_(user, ['ADMIN', 'ENGINEER']);
  var part = {
    id: nextId_('RequestParts'),
    requestId: data.requestId,
    model: data.model || '',
    partName: data.partName || '',
    partNo: data.partNo || '',
    qty: data.qty || ''
  };
  appendRow_('RequestParts', part);
  return part;
}
