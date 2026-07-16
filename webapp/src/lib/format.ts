/** client-safe formatters (ไม่ import node module) */

/**
 * ชื่อการทดสอบของ item — ใช้ testName ถ้ามี ไม่งั้น fallback บรรทัดแรกของรายละเอียดเทส
 * (item หลายอันในใบเดียวมักชื่อชิ้นงานเหมือนกัน — ชื่อทดสอบช่วยแยกออกจากกัน)
 */
export function testTitle(
  testName: string | null | undefined,
  testDetail: string | null | undefined
): string {
  const n = (testName ?? "").trim();
  if (n) return n;
  const d = (testDetail ?? "").trim();
  if (!d) return "";
  const first = d.split(/\r?\n/)[0].trim();
  return first.length > 48 ? `${first.slice(0, 48)}…` : first;
}

/** เป็นลิงก์เว็บที่คลิกเปิดได้ไหม (http/https) — path ในเครื่อง/UNC คลิกจากเบราว์เซอร์ไม่ได้ */
export function isHttpUrl(s: string | null | undefined): boolean {
  return !!s && /^https?:\/\//i.test(s.trim());
}

export function humanSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
