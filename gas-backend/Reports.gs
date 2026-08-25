function getReportForItem_(itemId) {
  return readAll_('Reports').filter(function (r) { return String(r.itemId) === String(itemId); })[0] || null;
}

function upsertReport_(user, data) {
  var existing = getReportForItem_(data.itemId);
  var patch = {
    itemId: data.itemId,
    sentDate: data.sentDate !== undefined ? data.sentDate : (existing ? existing.sentDate : ''),
    reportUrl: data.reportUrl !== undefined ? data.reportUrl : (existing ? existing.reportUrl : ''),
    sentTo: data.sentTo !== undefined ? data.sentTo : (existing ? existing.sentTo : ''),
    preparedBy: data.preparedBy !== undefined ? data.preparedBy : (existing ? existing.preparedBy : user.username),
    approvedBy: data.approvedBy !== undefined ? data.approvedBy : (existing ? existing.approvedBy : ''),
    updatedAt: new Date().toISOString()
  };
  if (existing) {
    return updateRow_('Reports', existing.id, patch);
  }
  patch.id = nextId_('Reports');
  appendRow_('Reports', patch);
  return patch;
}
