/**
 * ส่งข้อความแจ้งเตือนออกภายนอก (env-gated, ไม่มี dependency — ใช้ fetch ล้วน)
 *
 * หมายเหตุ: LINE Notify ปิดบริการ 1 เม.ย. 2025 แล้ว — ใช้ทางเลือกด้านล่างแทน
 *
 * ตั้งค่าใน .env อย่างใดอย่างหนึ่ง:
 *   1) NOTIFY_WEBHOOK_URL — POST {text} เข้ากับ Slack / Discord / Teams / Telegram-bridge ได้เลย
 *   2) LINE_CHANNEL_ACCESS_TOKEN + LINE_TO — push ผ่าน LINE Messaging API
 */
export async function sendExternal(
  lines: string[]
): Promise<{ sent: boolean; channel: string | null; error?: string }> {
  if (lines.length === 0) return { sent: false, channel: null };
  const text = lines.join("\n");

  const webhook = process.env.NOTIFY_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return { sent: res.ok, channel: "webhook", error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (e) {
      return { sent: false, channel: "webhook", error: String(e) };
    }
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_TO;
  if (token && to) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
      });
      return { sent: res.ok, channel: "line", error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (e) {
      return { sent: false, channel: "line", error: String(e) };
    }
  }

  return { sent: false, channel: null };
}
