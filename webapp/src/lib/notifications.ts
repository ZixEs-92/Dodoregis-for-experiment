import { prisma } from "@/lib/prisma";
import { isOverdue, isDueSoon, STATUS_LABEL } from "@/lib/workflow";
import { APPROVAL_LABEL } from "@/lib/approval";
import { NotificationLevel, RequestStatus } from "@/generated/prisma/client";

function bangkokToday(): string {
  // yyyy-mm-dd ตามเวลาไทย ใช้ทำ dedupe key รายวัน
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

type NewNotif = {
  kind: string;
  level: NotificationLevel;
  message: string;
  itemId: number;
  dedupeKey: string;
};

/**
 * สแกนงานที่เลยกำหนด/ใกล้กำหนด แล้วสร้างแจ้งเตือน (กันซ้ำรายวันด้วย dedupeKey)
 * คืนจำนวนที่สร้างใหม่จริง
 */
export async function generateDueNotifications(): Promise<number> {
  const items = await prisma.testItem.findMany({
    where: {
      status: { notIn: ["S8_CLOSED", "S10_CANCEL"] },
      planEnd: { not: null },
    },
    include: { owner: true },
  });

  const today = bangkokToday();
  const rows: NewNotif[] = [];
  for (const it of items) {
    if (isOverdue(it.planEnd, it.status)) {
      rows.push({
        kind: "OVERDUE",
        level: "CRITICAL",
        itemId: it.id,
        dedupeKey: `OVERDUE:${it.id}:${today}`,
        message: `เลยกำหนด plan จบ: ${it.itemCode} · ${it.model} · ผู้รับผิดชอบ ${it.owner?.name ?? "ยังไม่มอบหมาย"}`,
      });
    } else if (isDueSoon(it.planEnd, it.status)) {
      rows.push({
        kind: "DUE_SOON",
        level: "WARNING",
        itemId: it.id,
        dedupeKey: `DUE_SOON:${it.id}:${today}`,
        message: `ใกล้ถึงกำหนด: ${it.itemCode} · ${it.model} · ผู้รับผิดชอบ ${it.owner?.name ?? "ยังไม่มอบหมาย"}`,
      });
    }
  }
  if (rows.length === 0) return 0;

  // SQLite ไม่รองรับ skipDuplicates → กรอง dedupeKey ที่มีอยู่แล้วออกเอง
  const existing = await prisma.notification.findMany({
    where: { dedupeKey: { in: rows.map((r) => r.dedupeKey) } },
    select: { dedupeKey: true },
  });
  const seen = new Set(existing.map((e) => e.dedupeKey));
  const fresh = rows.filter((r) => !seen.has(r.dedupeKey));
  if (fresh.length > 0) await prisma.notification.createMany({ data: fresh });
  return fresh.length;
}

/** แจ้งเตือนแบบเรียลไทม์ตอนสถานะเปลี่ยน (เรียกจาก action) */
export async function notifyStatusChange(
  itemId: number,
  itemCode: string,
  partName: string,
  toStatus: RequestStatus
): Promise<void> {
  await prisma.notification.create({
    data: {
      kind: "STATUS_CHANGE",
      level: "INFO",
      itemId,
      dedupeKey: `STATUS_CHANGE:${itemId}:${Date.now()}`,
      message: `เปลี่ยนสถานะ ${itemCode} → ${STATUS_LABEL[toStatus]} · ${partName}`,
    },
  });
}

/**
 * แจ้งเตือนตอนแผนกลงทะเบียนงานใหม่เข้ามา — ให้ทีมแลปรู้โดยไม่ต้องรอเปิดแดชบอร์ด
 * itemId เป็น null ได้ เพราะใบรีเควสสร้างโดยยังไม่มีรายการทดสอบก็ได้ — regisNo ใส่ไว้เสมอ
 * เพื่อให้ผู้ขอ/หัวหน้าแผนกเห็นแจ้งเตือนของใบตัวเองได้แม้ตอนที่ยังไม่มี item ผูกอยู่
 */
export async function notifyNewRequest(opts: {
  itemId: number | null;
  regisNo: string;
  subject: string; // ชื่อรายการทดสอบ หรือ test object ของใบ
  deptName: string;
  requester: string;
  needsItems?: boolean;
}): Promise<void> {
  const what = opts.needsItems
    ? `ใบรีเควสใหม่ (ยังไม่มีรายการทดสอบ)`
    : `งานใหม่รอวางแผน`;
  await prisma.notification.create({
    data: {
      kind: "NEW_REQUEST",
      level: "WARNING",
      itemId: opts.itemId,
      regisNo: opts.regisNo,
      dedupeKey: `NEW_REQUEST:${opts.regisNo}:${opts.itemId ?? "no-item"}`,
      message: `${what}: ${opts.regisNo} · ${opts.subject} · จาก ${opts.deptName} (${opts.requester})`,
    },
  });
}

/** ใบนี้พร้อมวางแผนหรือยัง (ยังไม่มี item หรือมี item ที่ยังไม่มอบหมาย) — เรียกทั้งตอนสร้างใบและตอนอนุมัติผ่านครบ */
export async function checkAndNotifyNeedsPlanning(regisNo: string): Promise<void> {
  const req = await prisma.testRequest.findUnique({
    where: { regisNo },
    include: { requestDept: true, items: { orderBy: { itemNo: "asc" } } },
  });
  if (!req) return;
  const firstItem = req.items[0];
  const anyUnassigned = req.items.some((i) => !i.ownerId);
  if (req.items.length === 0 || anyUnassigned) {
    await notifyNewRequest({
      itemId: firstItem?.id ?? null,
      regisNo: req.regisNo,
      subject: req.testObject ?? firstItem?.partName ?? "—",
      deptName: req.requestDept.name,
      requester: req.requester,
      needsItems: req.items.length === 0,
    });
  }
}

/** ส่งใบเข้าอนุมัติ (ครั้งแรกหรือส่งใหม่หลังถูกตีกลับ) — เตือนหัวหน้าที่ต้องเซ็นชั้นนี้ */
export async function notifyApprovalNeeded(opts: {
  regisNo: string;
  stage: "DEPT" | "LAB";
  deptName: string;
  testObject: string | null;
}): Promise<void> {
  const stageLabel = opts.stage === "DEPT" ? "หัวหน้าแผนก" : "หัวหน้าแลป";
  await prisma.notification.create({
    data: {
      kind: "APPROVAL_NEEDED",
      level: "WARNING",
      regisNo: opts.regisNo,
      dedupeKey: `APPROVAL_NEEDED:${opts.regisNo}:${opts.stage}:${Date.now()}`,
      message: `รออนุมัติจาก${stageLabel}: ${opts.regisNo} · ${opts.deptName}${opts.testObject ? ` · ${opts.testObject}` : ""}`,
    },
  });
}

/** ใบถูกตีกลับ — เตือนผู้ขอพร้อมเหตุผล (เห็นเฉพาะแผนกของใบนั้นผ่านการกรองขอบเขตตามปกติ) */
export async function notifyRejected(opts: {
  regisNo: string;
  reason: string;
  deptName: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      kind: "REJECTED",
      level: "CRITICAL",
      regisNo: opts.regisNo,
      dedupeKey: `REJECTED:${opts.regisNo}:${Date.now()}`,
      message: `ใบถูกตีกลับ: ${opts.regisNo} · ${opts.deptName} — ${opts.reason}`,
    },
  });
}

/**
 * ใบที่ค้างรออนุมัติเกิน N วัน — เตือนซ้ำได้ทุกวัน (กันซ้ำรายวันด้วย dedupeKey เหมือน generateDueNotifications)
 * คืนจำนวนที่สร้างใหม่จริง
 */
export async function generateOverdueApprovalNotifications(thresholdDays = 2): Promise<number> {
  const cutoff = new Date(Date.now() - thresholdDays * 86_400_000);
  const pending = await prisma.testRequest.findMany({
    where: {
      approvalStatus: { in: ["PENDING_DEPT", "PENDING_LAB"] },
      submittedAt: { lte: cutoff },
    },
    include: { requestDept: true },
  });
  if (pending.length === 0) return 0;

  const today = bangkokToday();
  const rows = pending.map((r) => ({
    kind: "APPROVAL_OVERDUE",
    level: "CRITICAL" as NotificationLevel,
    regisNo: r.regisNo,
    dedupeKey: `APPROVAL_OVERDUE:${r.regisNo}:${today}`,
    message: `ค้างรออนุมัติ (${APPROVAL_LABEL[r.approvalStatus]}): ${r.regisNo} · ${r.requestDept.name}${r.testObject ? ` · ${r.testObject}` : ""}`,
  }));

  const existing = await prisma.notification.findMany({
    where: { dedupeKey: { in: rows.map((r) => r.dedupeKey) } },
    select: { dedupeKey: true },
  });
  const seen = new Set(existing.map((e) => e.dedupeKey));
  const fresh = rows.filter((r) => !seen.has(r.dedupeKey));
  if (fresh.length > 0) await prisma.notification.createMany({ data: fresh });
  return fresh.length;
}

/**
 * จำนวนแจ้งเตือนที่ยังไม่อ่าน — ส่ง departmentIds มาถ้าเห็นแค่บางแผนก (requester/dept_head)
 * null = เห็นทุกแผนก (ทีมแลป/viewer) · [] = ยังไม่ผูกแผนกไหนเลย นับเป็น 0
 * เช็คทั้งทาง item->request (แจ้งเตือนเก่า) และ regisNo ตรง (แจ้งเตือนระดับใบที่ไม่ผูก item)
 */
export async function getUnreadCount(departmentIds?: number[] | null): Promise<number> {
  if (departmentIds && departmentIds.length === 0) return 0;
  return prisma.notification.count({
    where: {
      readAt: null,
      ...(departmentIds != null
        ? {
            OR: [
              { item: { request: { requestDeptId: { in: departmentIds } } } },
              { request: { requestDeptId: { in: departmentIds } } },
            ],
          }
        : {}),
    },
  });
}
