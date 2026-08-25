var TOKEN_SECRET_KEY = 'TOKEN_SECRET';
var TOKEN_LIFETIME_MS = 8 * 60 * 60 * 1000;

function getTokenSecret_() {
  var secret = PropertiesService.getScriptProperties().getProperty(TOKEN_SECRET_KEY);
  if (!secret) throw new Error('ยังไม่ได้ตั้งค่า TOKEN_SECRET — รันฟังก์ชัน setup() ก่อน');
  return secret;
}

function hashPassword_(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + ':' + salt);
  return bytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function login(username, password) {
  var users = readAll_('Users');
  var user = users.filter(function (u) { return u.username === username && u.active === true; })[0];
  if (!user) throw new Error('ไม่พบผู้ใช้นี้ หรือถูกปิดใช้งาน');
  var hash = hashPassword_(password, user.passwordSalt);
  if (hash !== user.passwordHash) throw new Error('รหัสผ่านไม่ถูกต้อง');
  var payload = {
    uid: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    departmentId: user.departmentId || null,
    memberId: user.memberId || null,
    exp: Date.now() + TOKEN_LIFETIME_MS
  };
  return { token: signToken_(payload), user: payload };
}

function signToken_(payload) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, getTokenSecret_()));
  return body + '.' + sig;
}

function verifyToken_(token) {
  if (!token) throw new Error('ไม่ได้ล็อกอิน');
  var parts = token.split('.');
  if (parts.length !== 2) throw new Error('token ไม่ถูกต้อง');
  var expectedSig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], getTokenSecret_()));
  if (expectedSig !== parts[1]) throw new Error('token ไม่ถูกต้อง');
  var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (payload.exp < Date.now()) throw new Error('session หมดอายุ กรุณาล็อกอินใหม่');
  return payload;
}

function requireRole_(user, roles) {
  if (roles.indexOf(user.role) === -1) throw new Error('ไม่มีสิทธิ์ทำรายการนี้');
}
