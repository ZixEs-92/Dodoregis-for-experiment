import { RequestStatus } from "@/generated/prisma/client";
import { isOverdue, isUrgent } from "@/lib/workflow";

/** สถานะรวมของใบรีเควส (object หลัก) — คำนวณอัตโนมัติจาก item ทั้งหมด */
export type RequestPhase = "EMPTY" | "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export const PHASE_LABEL: Record<RequestPhase, string> = {
  EMPTY: "ยังไม่มี item",
  NOT_STARTED: "รอเริ่ม",
  IN_PROGRESS: "กำลังดำเนินการ",
  DONE: "เสร็จสิ้น",
};

export const PHASE_COLOR: Record<RequestPhase, string> = {
  EMPTY: "bg-surface-strong text-muted",
  NOT_STARTED: "bg-yellow-soft text-mustard-deep",
  IN_PROGRESS: "bg-info-soft text-info",
  DONE: "bg-forest text-white",
};

export type RollupItem = {
  status: RequestStatus;
  planEnd: Date | null;
  remark: string | null;
};

export type Rollup = {
  phase: RequestPhase;
  total: number;
  done: number; // S8_CLOSED
  sent: number; // อยู่ S7 ขึ้นไป (ส่งรีพอร์ทแล้ว)
  cancelled: number; // S10
  hold: number; // S9
  active: number; // ยังไม่ปิด/ยกเลิก
  overdueCount: number;
  urgentCount: number;
  progressPct: number; // done / (total - cancelled)
};

const NOT_STARTED_STATUSES: RequestStatus[] = ["S1_RECEIVED", "S2_WAIT_PART"];

export function requestRollup(items: RollupItem[]): Rollup {
  const total = items.length;
  let done = 0;
  let sent = 0;
  let cancelled = 0;
  let hold = 0;
  let overdueCount = 0;
  let urgentCount = 0;

  for (const it of items) {
    if (it.status === "S8_CLOSED") done++;
    if (it.status === "S7_SENT" || it.status === "S8_CLOSED") sent++;
    if (it.status === "S10_CANCEL") cancelled++;
    if (it.status === "S9_HOLD") hold++;
    if (isOverdue(it.planEnd, it.status)) overdueCount++;
    if (isUrgent(it.remark)) urgentCount++;
  }

  const active = total - done - cancelled;
  const denom = Math.max(1, total - cancelled);
  const progressPct = Math.round((done / denom) * 100);

  let phase: RequestPhase;
  if (total === 0) {
    phase = "EMPTY";
  } else if (done + cancelled === total) {
    phase = "DONE"; // ทุก item ปิดงาน/ยกเลิก
  } else {
    // มี item ที่ยัง active — ถ้าทุกตัวที่ active ยัง S1–S2 = ยังไม่เริ่ม
    const activeItems = items.filter(
      (it) => it.status !== "S8_CLOSED" && it.status !== "S10_CANCEL"
    );
    const allNotStarted = activeItems.every((it) =>
      NOT_STARTED_STATUSES.includes(it.status)
    );
    phase = allNotStarted ? "NOT_STARTED" : "IN_PROGRESS";
  }

  return {
    phase,
    total,
    done,
    sent,
    cancelled,
    hold,
    active,
    overdueCount,
    urgentCount,
    progressPct,
  };
}
