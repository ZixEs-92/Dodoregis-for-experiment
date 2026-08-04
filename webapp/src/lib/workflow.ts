import { RequestStatus } from "@/generated/prisma/client";

export const STATUS_ORDER: RequestStatus[] = [
  "S1_RECEIVED",
  "S2_WAIT_PART",
  "S3_PART_IN",
  "S4_TESTING",
  "S5_TEST_DONE",
  "S6_REPORTING",
  "S7_SENT",
  "S8_CLOSED",
];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  S1_RECEIVED: "1-รับใบรีเควส",
  S2_WAIT_PART: "2-รอรับพาร์ท",
  S3_PART_IN: "3-รับพาร์ทแล้ว/รอคิวเทส",
  S4_TESTING: "4-กำลังเทส",
  S5_TEST_DONE: "5-เทสเสร็จ",
  S6_REPORTING: "6-กำลังทำรีพอร์ท",
  S7_SENT: "7-ส่งรีพอร์ทแล้ว",
  S8_CLOSED: "8-ปิดงาน",
  S9_HOLD: "9-Hold",
  S10_CANCEL: "10-Cancel",
};

export const STATUS_COLOR: Record<RequestStatus, string> = {
  S1_RECEIVED: "bg-surface-strong text-ink",
  S2_WAIT_PART: "bg-yellow-soft text-mustard-deep",
  S3_PART_IN: "bg-mint-soft text-forest",
  S4_TESTING: "bg-peach-soft text-coral",
  S5_TEST_DONE: "bg-cream text-ink",
  S6_REPORTING: "bg-mustard-soft text-mustard-deep",
  S7_SENT: "bg-info-soft text-info",
  S8_CLOSED: "bg-forest text-white",
  S9_HOLD: "bg-mustard text-ink",
  S10_CANCEL: "bg-coral text-white",
};

export const ALL_STATUSES: RequestStatus[] = [...STATUS_ORDER, "S9_HOLD", "S10_CANCEL"];

/** ข้อความบนปุ่ม = งานที่ผู้ใช้กำลังจะทำ ไม่ใช่ชื่อสถานะปลายทาง */
export const STATUS_ACTION_LABEL: Record<RequestStatus, string> = {
  S1_RECEIVED: "กลับไปขั้นรับใบรีเควส",
  S2_WAIT_PART: "รอรับพาร์ท",
  S3_PART_IN: "รับพาร์ทแล้ว",
  S4_TESTING: "เริ่มเทส",
  S5_TEST_DONE: "เทสเสร็จ",
  S6_REPORTING: "เริ่มทำรีพอร์ท",
  S7_SENT: "ส่งรีพอร์ทแล้ว",
  S8_CLOSED: "ปิดงาน",
  S9_HOLD: "พักงานชั่วคราว",
  S10_CANCEL: "ยกเลิกงาน",
};

/** สีทึบสำหรับกราฟ (CFD / time-in-status) — แยกสถานะให้เห็นชัด */
export const STATUS_FILL: Record<RequestStatus, string> = {
  S1_RECEIVED: "bg-surface-strong",
  S2_WAIT_PART: "bg-yellow",
  S3_PART_IN: "bg-mint",
  S4_TESTING: "bg-peach",
  S5_TEST_DONE: "bg-cream",
  S6_REPORTING: "bg-mustard",
  S7_SENT: "bg-info",
  S8_CLOSED: "bg-forest",
  S9_HOLD: "bg-mustard",
  S10_CANCEL: "bg-coral",
};

export const RUN_RESULT_LABEL = {
  PASS: "Pass",
  FAIL: "Fail",
  CONDITIONAL_PASS: "Conditional Pass",
} as const;

export const REPORT_STATUS_LABEL = {
  NOT_STARTED: "ยังไม่เริ่ม",
  IN_PROGRESS: "กำลังทำ",
  PENDING_APPROVAL: "รออนุมัติ",
  SENT: "ส่งแล้ว",
} as const;

export const LOCATION_LOG_KIND_LABEL = {
  PART_LOCATION: "ที่เก็บพาร์ท",
  FINISHED_LOCATION: "ที่เก็บชิ้นงานเสร็จ",
  RAW_DATA: "ที่เก็บ raw data",
} as const;

export const ATTACHMENT_KIND_LABEL = {
  REQUEST_DOC: "ใบรีเควส",
  EMAIL: "อีเมล",
  PHOTO: "รูปชิ้นงาน",
  TEST_SPEC: "สเปค/มาตรฐานทดสอบ",
  OTHER: "อื่นๆ",
} as const;

export type AttachmentKindKey = keyof typeof ATTACHMENT_KIND_LABEL;

/** ขนาดไฟล์แนบสูงสุดต่อ 1 ไฟล์ (MB) — ไฟล์ใหญ่กว่านี้ให้เก็บโฟลเดอร์กลางแล้วแนบลิงก์ */
export const MAX_UPLOAD_MB = 5;
/** รวมทุกไฟล์ในการส่ง 1 ครั้ง — ต้องน้อยกว่า serverActions.bodySizeLimit ใน next.config.ts */
export const MAX_UPLOAD_TOTAL_MB = 20;

/** ข้อมูล item ที่ใช้ตรวจกติกาบังคับกรอกตามสถานะ */
export type ItemForValidation = {
  partReceivedDate: Date | null;
  partLocationId: number | null;
  finishedPartLocationId: number | null;
  rawDataLocation: string | null;
  reports: { sentDate: Date | null; reportUrl: string | null; sentTo: string | null }[];
};

/**
 * กติกาบังคับกรอกตามสถานะ (ดู CLAUDE.md) — ตรวจแบบสะสม:
 * งานที่อยู่สถานะ N ต้องมีข้อมูลครบทุก gate ตั้งแต่ต้นจนถึง N
 * ใช้ทั้งตอนเปลี่ยนสถานะ (target = สถานะปลายทาง) และตอนแก้ข้อมูล
 * (target = สถานะปัจจุบัน เพื่อกันเคลียร์ฟิลด์ที่สถานะนั้นบังคับไว้แล้ว)
 * Hold/Cancel ไม่มีข้อบังคับ
 */
export function validateStatusRequirements(
  target: RequestStatus,
  data: ItemForValidation
): string[] {
  const errors: string[] = [];
  const idx = STATUS_ORDER.indexOf(target);
  if (idx < 0) return errors; // S9_HOLD / S10_CANCEL

  if (idx >= STATUS_ORDER.indexOf("S3_PART_IN")) {
    if (!data.partReceivedDate)
      errors.push("ต้องมีวันที่รับพาร์ท (บังคับตั้งแต่สถานะ 3-รับพาร์ทแล้ว)");
    if (!data.partLocationId)
      errors.push("ต้องมีตำแหน่งเก็บพาร์ท (บังคับตั้งแต่สถานะ 3-รับพาร์ทแล้ว)");
  }

  if (idx >= STATUS_ORDER.indexOf("S7_SENT")) {
    // ลิงก์รีพอร์ทหรือบันทึก "ส่งให้ใคร" อย่างใดอย่างหนึ่งพอ — กันเคสส่งจากมือถือที่ยังไม่มีลิงก์โฟลเดอร์กลางมาแปะตอนนั้น
    const hasSentReport = data.reports.some((r) => r.sentDate && (r.reportUrl || r.sentTo));
    if (!hasSentReport)
      errors.push("ต้องมีรีพอร์ทที่กรอกวันที่ส่ง + ลิงก์รีพอร์ทหรือบันทึกว่าส่งให้ใคร (บังคับตั้งแต่สถานะ 7-ส่งรีพอร์ทแล้ว)");
  }

  if (idx >= STATUS_ORDER.indexOf("S8_CLOSED")) {
    if (!data.finishedPartLocationId)
      errors.push("ต้องมีที่เก็บชิ้นงานหลังเสร็จก่อนปิดงาน");
    if (!data.rawDataLocation) errors.push("ต้องมีที่เก็บ raw data ก่อนปิดงาน");
  }

  return errors;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** planEnd เก็บเป็น 00:00 ของวันครบกำหนด — นับเลยกำหนดเมื่อพ้นสิ้นวันนั้นแล้วเท่านั้น */
export function isOverdue(planEnd: Date | null, status: RequestStatus): boolean {
  if (!planEnd) return false;
  if (status === "S8_CLOSED" || status === "S10_CANCEL") return false;
  return planEnd.getTime() + DAY_MS <= Date.now();
}

/** ครบกำหนดภายใน N วันข้างหน้า (นับรวมงานที่ครบกำหนดวันนี้) */
export function isDueSoon(planEnd: Date | null, status: RequestStatus, days = 7): boolean {
  if (!planEnd) return false;
  if (status === "S8_CLOSED" || status === "S10_CANCEL") return false;
  const now = Date.now();
  const notYetOverdue = planEnd.getTime() + DAY_MS > now;
  return notYetOverdue && planEnd.getTime() <= now + days * DAY_MS;
}

export function isUrgent(remark: string | null): boolean {
  if (!remark) return false;
  return remark.includes("make รีพอร์ต");
}
