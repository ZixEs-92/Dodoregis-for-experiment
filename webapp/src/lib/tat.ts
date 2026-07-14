/** Turnaround Time (TAT) / SLA — คำนวณ lead time request → ส่งรีพอร์ท */

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/** lead time (วัน) จากวันรับใบรีเควสถึงวันส่งรีพอร์ท (หรือถึงตอนนี้ถ้ายังไม่ส่ง) */
export function leadTime(
  requestDate: Date,
  sentDate: Date | null,
  now: Date = new Date()
): { days: number; done: boolean } {
  const end = sentDate ?? now;
  return { days: Math.max(0, daysBetween(requestDate, end)), done: !!sentDate };
}

export type SlaStatus = "on_time" | "at_risk" | "over" | "none";

/**
 * สถานะเทียบ SLA:
 * - over    = ใช้เวลาเกินเป้าแล้ว
 * - at_risk = ยังไม่เสร็จ และเหลือ ≤ 20% ของเป้า (ใกล้ชนเพดาน)
 * - on_time = อยู่ในเป้า
 * - none    = แผนกไม่ได้ตั้งเป้า SLA
 */
export function slaStatus(
  leadDays: number,
  done: boolean,
  slaDays: number | null
): SlaStatus {
  if (!slaDays || slaDays <= 0) return "none";
  if (leadDays > slaDays) return "over";
  if (!done && leadDays >= slaDays * 0.8) return "at_risk";
  return "on_time";
}

export const SLA_STATUS_LABEL: Record<SlaStatus, string> = {
  on_time: "อยู่ในเป้า",
  at_risk: "ใกล้ชนเป้า",
  over: "เกินเป้า",
  none: "ไม่ได้ตั้งเป้า",
};

export const SLA_STATUS_COLOR: Record<SlaStatus, string> = {
  on_time: "bg-forest-soft text-forest",
  at_risk: "bg-mustard-soft text-mustard-deep",
  over: "bg-coral-soft text-coral",
  none: "bg-surface-strong text-muted",
};
