function addTestRun_(user, data) {
  requireRole_(user, ['ADMIN', 'ENGINEER']);
  var runs = readAll_('TestRuns').filter(function (r) { return String(r.itemId) === String(data.itemId); });
  var run = {
    id: nextId_('TestRuns'),
    itemId: data.itemId,
    runNo: runs.length + 1,
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    loadedBy: data.loadedBy || '',
    testedBy: data.testedBy || '',
    result: data.result || '',
    rawDataLink: data.rawDataLink || ''
  };
  appendRow_('TestRuns', run);
  return run;
}
