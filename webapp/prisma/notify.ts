import "dotenv/config";
import { PrismaClient, NotificationLevel } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sendExternal } from "../src/lib/notify-external";

// สคริปต์แจ้งเตือน (ตั้ง cron เช้าทุกวัน): สแกนงานเลย/ใกล้กำหนด → สร้างแจ้งเตือนในแอป + ส่งออกภายนอก
// standalone (สร้าง PrismaClient เอง + logic overdue ในตัว) เพื่อไม่ผูกกับ path alias ของ Next

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

const DAY = 24 * 60 * 60 * 1000;
const CLOSED = ["S8_CLOSED", "S10_CANCEL"];

function isOverdue(planEnd: Date | null, status: string): boolean {
  if (!planEnd || CLOSED.includes(status)) return false;
  return planEnd.getTime() + DAY <= Date.now();
}
function isDueSoon(planEnd: Date | null, status: string): boolean {
  if (!planEnd || CLOSED.includes(status)) return false;
  const now = Date.now();
  return planEnd.getTime() + DAY > now && planEnd.getTime() <= now + 7 * DAY;
}

type Row = {
  kind: string;
  level: NotificationLevel;
  itemId: number;
  dedupeKey: string;
  message: string;
};

async function main() {
  const items = await prisma.testItem.findMany({
    where: { status: { notIn: CLOSED as never }, planEnd: { not: null } },
    include: { owner: true },
  });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  const rows: Row[] = [];
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

  let freshMessages: string[] = [];
  if (rows.length > 0) {
    const existing = await prisma.notification.findMany({
      where: { dedupeKey: { in: rows.map((r) => r.dedupeKey) } },
      select: { dedupeKey: true },
    });
    const seen = new Set(existing.map((e) => e.dedupeKey));
    const fresh = rows.filter((r) => !seen.has(r.dedupeKey));
    if (fresh.length > 0) await prisma.notification.createMany({ data: fresh });
    freshMessages = fresh.map((f) => f.message);
  }

  console.log(`แจ้งเตือนใหม่ ${freshMessages.length} รายการ (งานเข้าเงื่อนไขทั้งหมด ${rows.length})`);

  if (freshMessages.length > 0) {
    const res = await sendExternal([`[Dodoregis] แจ้งเตือนงาน ${today}`, ...freshMessages]);
    if (res.channel) {
      console.log(`ส่งออกช่องทาง ${res.channel}: ${res.sent ? "สำเร็จ" : "ล้มเหลว " + (res.error ?? "")}`);
    } else {
      console.log("ยังไม่ได้ตั้งค่าช่องทางส่งออก (NOTIFY_WEBHOOK_URL หรือ LINE_*) — สร้างแจ้งเตือนในแอปอย่างเดียว");
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
