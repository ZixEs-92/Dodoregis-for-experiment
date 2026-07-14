import { prisma } from "@/lib/prisma";
import { isOverdue, isDueSoon, STATUS_LABEL } from "@/lib/workflow";
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
        message: `เลยกำหนด plan จบ: ${it.itemCode} · ${it.partName} · ผู้รับผิดชอบ ${it.owner.name}`,
      });
    } else if (isDueSoon(it.planEnd, it.status)) {
      rows.push({
        kind: "DUE_SOON",
        level: "WARNING",
        itemId: it.id,
        dedupeKey: `DUE_SOON:${it.id}:${today}`,
        message: `ใกล้ถึงกำหนด: ${it.itemCode} · ${it.partName} · ผู้รับผิดชอบ ${it.owner.name}`,
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

export async function getUnreadCount(): Promise<number> {
  return prisma.notification.count({ where: { readAt: null } });
}
