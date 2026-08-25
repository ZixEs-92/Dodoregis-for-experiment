var API_URL = 'PUT_YOUR_APPS_SCRIPT_EXEC_URL_HERE';

function getToken() { return localStorage.getItem('dodoregis_token'); }
function setToken(t) { localStorage.setItem('dodoregis_token', t); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('dodoregis_user')); }
  catch (e) { return null; }
}
function setUser(u) { localStorage.setItem('dodoregis_user', JSON.stringify(u)); }
function logout() {
  localStorage.removeItem('dodoregis_token');
  localStorage.removeItem('dodoregis_user');
  location.href = 'index.html';
}

async function apiLogin(username, password) {
  var res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'login', username: username, password: password })
  });
  var json = await res.json();
  if (!json.ok) throw new Error(json.error || 'ล็อกอินไม่สำเร็จ');
  setToken(json.data.token);
  setUser(json.data.user);
  return json.data.user;
}

async function callApi(action, data) {
  var res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, token: getToken(), data: data || {} })
  });
  var json = await res.json();
  if (!json.ok) throw new Error(json.error || 'เกิดข้อผิดพลาด');
  return json.data;
}

function requireLogin() {
  if (!getToken() || !getUser()) location.href = 'index.html';
}

function renderTopbar(activePage) {
  var user = getUser();
  if (!user) return '';
  return '' +
    '<div class="topbar">' +
    '<div><strong>Dodoregis</strong> <span class="sub" style="margin:0">(GAS)</span></div>' +
    '<div class="who">' + user.displayName + ' · ' + user.role +
    ' &nbsp; <a href="requests.html">รายการงาน</a> &nbsp; <a href="scan.html">สแกน QR</a>' +
    ' &nbsp; <a href="#" onclick="logout(); return false;">ออกจากระบบ</a></div>' +
    '</div>';
}

function statusLabel(status) {
  var labels = {
    S1_RECEIVED: '1-รับใบรีเควส',
    S2_WAITING_PART: '2-รอรับพาร์ท',
    S3_PART_RECEIVED: '3-รับพาร์ทแล้ว/รอคิวเทส',
    S4_TESTING: '4-กำลังเทส',
    S5_DONE_TESTING: '5-เทสเสร็จ',
    S6_REPORTING: '6-กำลังทำรีพอร์ท',
    S7_SENT: '7-ส่งรีพอร์ทแล้ว',
    S8_CLOSED: '8-ปิดงาน',
    S9_HOLD: '9-Hold',
    S10_CANCEL: '10-Cancel'
  };
  return labels[status] || status;
}
