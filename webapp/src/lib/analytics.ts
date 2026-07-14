import { RequestStatus } from "@/generated/prisma/client";
import { STATUS_ORDER } from "@/lib/workflow";

const DAY_MS = 24 * 60 * 60 * 1000;

// ── time-in-status (วิเคราะห์คอขวด) ─────────────────────────

export type ItemLogsForAnalytics = {
  createdAt: Date;
  status: RequestStatus;
  statusLogs: { fromStatus: RequestStatus | null; toStatus: RequestStatus; changedAt: Date }[];
};

/**
 * เวลาที่งานอยู่ในแต่ละสถานะ (เฉลี่ยเป็นวัน) — จาก status_logs
 * ช่วงเวลาในสถานะ S = ตั้งแต่ log ที่ toStatus=S จนถึง log ถัดไป (หรือถึง now สำหรับสถานะปัจจุบัน)
 * งานที่ยังอยู่ในสถานะปิด/ยกเลิก ไม่ยืดเวลาต่อ
 */
export function computeTimeInStatus(
  items: ItemLogsForAnalytics[],
  now: Date = new Date()
): { status: RequestStatus; avgDays: number; totalDays: number; samples: number }[] {
  const totalMs = new Map<RequestStatus, number>();
  const samples = new Map<RequestStatus, number>();

  for (const it of items) {
    const logs = [...it.statusLogs].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
    if (logs.length === 0) continue;
    for (let i = 0; i < logs.length; i++) {
      const s = logs[i].toStatus;
      const start = logs[i].changedAt.getTime();
      const isLast = i === logs.length - 1;
      const stopClock = s === "S8_CLOSED" || s === "S10_CANCEL";
      const end = isLast ? (stopClock ? start : now.getTime()) : logs[i + 1].changedAt.getTime();
      const dur = Math.max(0, end - start);
      totalMs.set(s, (totalMs.get(s) ?? 0) + dur);
      samples.set(s, (samples.get(s) ?? 0) + 1);
    }
  }

  return STATUS_ORDER.filter((s) => (samples.get(s) ?? 0) > 0).map((s) => {
    const total = (totalMs.get(s) ?? 0) / DAY_MS;
    const n = samples.get(s) ?? 0;
    return { status: s, avgDays: n ? total / n : 0, totalDays: total, samples: n };
  });
}

// ── aging WIP (งานค้างในสถานะเดิมนาน) ──────────────────────

/** วันที่ที่งานเข้าสถานะปัจจุบัน = changedAt ของ log ล่าสุด (หรือ createdAt ถ้าไม่มี log) */
export function enteredCurrentStatusAt(it: ItemLogsForAnalytics): Date {
  if (it.statusLogs.length === 0) return it.createdAt;
  return it.statusLogs.reduce(
    (latest, l) => (l.changedAt.getTime() > latest.getTime() ? l.changedAt : latest),
    it.statusLogs[0].changedAt
  );
}

export function daysInCurrentStatus(it: ItemLogsForAnalytics, now: Date = new Date()): number {
  return Math.floor((now.getTime() - enteredCurrentStatusAt(it).getTime()) / DAY_MS);
}

// ── CFD (cumulative flow — จำนวนงานในแต่ละสถานะ ณ สิ้นวัน) ──

export type CfdItem = {
  createdAt: Date;
  statusLogs: { toStatus: RequestStatus; changedAt: Date }[];
};

/** สถานะของงาน ณ เวลา t (หา log ล่าสุดที่ changedAt <= t; ถ้าไม่มีถือว่ายังไม่มีสถานะ) */
function statusAt(it: CfdItem, t: number): RequestStatus | null {
  let cur: RequestStatus | null = null;
  let curT = -Infinity;
  for (const l of it.statusLogs) {
    const lt = l.changedAt.getTime();
    if (lt <= t && lt >= curT) {
      cur = l.toStatus;
      curT = lt;
    }
  }
  return cur;
}

/**
 * CFD ย้อนหลัง `days` วัน (รวมวันนี้) — คืน array ต่อวัน พร้อมจำนวนงานแยกตามสถานะ ณ สิ้นวัน
 * ต้องมี status_logs (งานเก่าที่ไม่มี log จะไม่ถูกนับ)
 */
export function computeCfd(
  items: CfdItem[],
  days: number,
  now: Date = new Date()
): { date: string; counts: Record<RequestStatus, number> }[] {
  const out: { date: string; counts: Record<RequestStatus, number> }[] = [];
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(end.getTime() - d * DAY_MS);
    const t = day.getTime();
    const counts = Object.fromEntries(
      STATUS_ORDER.map((s) => [s, 0])
    ) as Record<RequestStatus, number>;
    for (const it of items) {
      const s = statusAt(it, t);
      // ไม่นับงานที่ปิด/ยกเลิกไปแล้ว เพื่อให้เห็น WIP ที่ค้างจริง
      if (s && s !== "S8_CLOSED" && s !== "S10_CANCEL") counts[s]++;
    }
    out.push({
      date: day.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", month: "2-digit", day: "2-digit" }),
      counts,
    });
  }
  return out;
}
