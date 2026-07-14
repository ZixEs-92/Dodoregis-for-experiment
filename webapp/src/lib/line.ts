/**
 * LINE Messaging API (LINE OA) — push message
 *
 * ต้องมี: LINE Official Account + Messaging API channel (LINE Developers Console)
 *   - LINE_CHANNEL_ACCESS_TOKEN : long-lived token (แท็บ Messaging API ใน channel)
 *   - LINE_TO                   : ปลายทาง = userId ของตัวเอง (แท็บ Basic settings)
 *                                 หรือ groupId (ได้จาก webhook เมื่อเชิญบอทเข้ากลุ่ม)
 * push endpoint: POST https://api.line.me/v2/bot/message/push
 */

export const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export type LineResult = {
  attempted: boolean; // ได้ยิง request จริงไหม (false = dry-run)
  ok: boolean;
  status: number | null;
  dryRun: boolean;
  detail: string;
  payload: unknown;
};

export function lineConfig() {
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "").trim();
  const to = (process.env.LINE_TO ?? "").trim();
  return {
    hasToken: token.length > 0,
    hasDestination: to.length > 0,
    tokenPreview: token ? `${token.slice(0, 6)}… (${token.length} ตัวอักษร)` : null,
    toPreview: to ? `${to.slice(0, 5)}…` : null,
  };
}

export function buildPushPayload(text: string, to: string) {
  return { to, messages: [{ type: "text", text }] };
}

/**
 * ส่ง push ไป LINE — คืนผลละเอียด (status + ข้อความจาก LINE) เพื่อใช้ในหน้า demo
 * ถ้าไม่มี token หรือปลายทาง → dry-run (คืน payload ที่จะส่งโดยไม่ยิงจริง)
 */
export async function sendLinePush(
  text: string,
  opts?: { token?: string; to?: string }
): Promise<LineResult> {
  const token = (opts?.token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "").trim();
  const to = (opts?.to ?? process.env.LINE_TO ?? "").trim();
  const payload = buildPushPayload(text, to);

  if (!token || !to) {
    const missing = [!token && "token", !to && "ปลายทาง (LINE_TO)"].filter(Boolean).join(" และ ");
    return {
      attempted: false,
      ok: false,
      status: null,
      dryRun: true,
      detail: `ยังไม่ได้ตั้ง ${missing} — นี่คือ payload ที่ระบบจะส่ง (dry-run ยังไม่ได้ยิงจริง)`,
      payload,
    };
  }

  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    return {
      attempted: true,
      ok: res.ok,
      status: res.status,
      dryRun: false,
      detail: res.ok
        ? "ส่งสำเร็จ ✓ ไปเช็คข้อความใน LINE ได้เลย"
        : `LINE ตอบกลับ HTTP ${res.status}: ${body || "(ไม่มีรายละเอียด)"}`,
      payload,
    };
  } catch (e) {
    return {
      attempted: true,
      ok: false,
      status: null,
      dryRun: false,
      detail: `เชื่อมต่อ LINE ไม่ได้: ${String(e)}`,
      payload,
    };
  }
}
