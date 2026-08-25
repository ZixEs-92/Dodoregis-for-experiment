function doGet(e) {
  return jsonOutput_({ ok: true, message: 'Dodoregis GAS API is running' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ ok: false, error: 'invalid request body' });
  }

  try {
    if (body.action === 'login') {
      return jsonOutput_({ ok: true, data: login(body.username, body.password) });
    }

    var user = verifyToken_(body.token);
    var data = body.data || {};
    var result;

    switch (body.action) {
      case 'listMasterData':
        result = listMasterData_();
        break;
      case 'listRequests':
        result = listRequests_(user);
        break;
      case 'createRequest':
        result = createRequest_(user, data);
        break;
      case 'getRequestDetail':
        result = getRequestDetail_(user, data.requestId);
        break;
      case 'addRequestPart':
        result = addRequestPart_(user, data);
        break;
      case 'addItem':
        result = addItem_(user, data);
        break;
      case 'getItemDetail':
        result = getItemDetail_(user, data.itemCode);
        break;
      case 'changeItemStatus':
        result = changeItemStatus_(user, data);
        break;
      case 'addTestRun':
        result = addTestRun_(user, data);
        break;
      default:
        throw new Error('ไม่รู้จัก action: ' + body.action);
    }

    return jsonOutput_({ ok: true, data: result });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err.message || err) });
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
