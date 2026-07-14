import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { unlink } from "node:fs/promises";
import path from "node:path";

// ลบข้อมูลงานทั้งหมด (ใบรีเควส / item / runs / report / ไฟล์แนบ) — เก็บ master data ไว้
// ใช้เมื่ออยากเริ่มกรอกข้อมูลจริง โดยไม่เอาข้อมูลตัวอย่างกลับมา (ต่างจาก `prisma db seed`)

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

async function main() {
  // ลบไฟล์อัปโหลดบนดิสก์ก่อน (กันไฟล์กำพร้าค้างในโฟลเดอร์ uploads)
  const withFiles = await prisma.attachment.findMany({ where: { storedName: { not: null } } });
  for (const a of withFiles) {
    if (!a.storedName) continue;
    try {
      await unlink(path.join(process.cwd(), "uploads", path.basename(a.storedName)));
    } catch {
      // ไฟล์อาจถูกลบไปแล้ว — ข้าม
    }
  }

  const att = await prisma.attachment.deleteMany();
  const rep = await prisma.report.deleteMany();
  const run = await prisma.testRun.deleteMany();
  const item = await prisma.testItem.deleteMany();
  const req = await prisma.testRequest.deleteMany();

  console.log(
    `ล้างข้อมูลงานแล้ว: ${req.count} ใบรีเควส, ${item.count} item, ${run.count} runs, ` +
      `${rep.count} reports, ${att.count} ไฟล์แนบ · master data (แผนก/ทีม/ที่เก็บ) ยังอยู่ครบ`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
