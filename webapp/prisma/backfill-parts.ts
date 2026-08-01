// Backfill: สร้าง RequestPart จาก partName/partNo/qty ของ item เดิม แล้วผูกกลับเข้า item
// รันครั้งเดียวหลัง migration request_parts — รันซ้ำได้ (ข้าม item ที่ผูกแล้ว)
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

async function main() {
  const items = await prisma.testItem.findMany({
    include: { parts: true },
    orderBy: [{ regisNo: "asc" }, { itemNo: "asc" }],
  });

  let created = 0;
  let linked = 0;
  for (const it of items) {
    if (it.parts.length > 0) continue; // ผูกไว้แล้ว
    const name = it.partName.trim();
    if (!name) continue;

    // ใช้ชิ้นงานเดิมของใบถ้าชื่อ+part no. ตรงกัน ไม่งั้นสร้างใหม่
    let part = await prisma.requestPart.findFirst({
      where: { regisNo: it.regisNo, name, partNo: it.partNo ?? null },
    });
    if (!part) {
      const count = await prisma.requestPart.count({ where: { regisNo: it.regisNo } });
      part = await prisma.requestPart.create({
        data: { regisNo: it.regisNo, name, partNo: it.partNo, qty: it.qty, sortOrder: count },
      });
      created++;
    }
    await prisma.testItem.update({
      where: { id: it.id },
      data: { parts: { connect: { id: part.id } } },
    });
    linked++;
  }

  console.log(`สร้างชิ้นงาน ${created} รายการ · ผูกเข้า item ${linked} รายการ`);
  const summary = await prisma.testRequest.findMany({
    select: { regisNo: true, parts: { select: { name: true, partNo: true } } },
  });
  for (const r of summary) {
    console.log(`  ${r.regisNo}: ${r.parts.map((p) => p.name + (p.partNo ? ` (${p.partNo})` : "")).join(" · ") || "—"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
