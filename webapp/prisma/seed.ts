import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const DEPARTMENTS = ["R&D", "QA", "Production", "Engineering", "Purchasing"];
const MEMBERS = [
  { name: "สมชาย ใจดี", role: "Lead Tester" },
  { name: "สมหญิง รักงาน", role: "Tester" },
  { name: "วีระ ทดสอบ", role: "Tester" },
  { name: "มานะ ตั้งใจ", role: "Tester" },
  { name: "ปิยะ ขยัน", role: "Tester" },
  { name: "นันทา สุขใจ", role: "QA Lead" },
  { name: "ประยุทธ์ มั่นคง", role: "Tester" },
  { name: "สุดา แสงทอง", role: "Tester" },
];
const PART_LOCATIONS = ["ชั้น A-1", "ชั้น A-2", "ชั้น A-3", "ห้อง Test 1", "ห้อง Test 2"];
const FINISHED_LOCATIONS = [
  "ชั้นงานเสร็จ B-1",
  "ชั้นงานเสร็จ B-2",
  "คืนแผนกผู้รีเควส",
  "ทิ้ง/ทำลาย",
];

function d(s: string): Date {
  return new Date(`${s}T00:00:00+07:00`);
}
function code(regis: string, n: number) {
  return `${regis}-${String(n).padStart(2, "0")}`;
}

async function main() {
  // master data (idempotent)
  for (const name of DEPARTMENTS)
    await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  for (const m of MEMBERS)
    await prisma.member.upsert({ where: { name: m.name }, update: { role: m.role }, create: m });
  for (const name of PART_LOCATIONS)
    await prisma.partLocation.upsert({ where: { name }, update: {}, create: { name } });
  for (const name of FINISHED_LOCATIONS)
    await prisma.finishedLocation.upsert({ where: { name }, update: {}, create: { name } });

  const dept = Object.fromEntries((await prisma.department.findMany()).map((x) => [x.name, x.id]));
  const mem = Object.fromEntries((await prisma.member.findMany()).map((x) => [x.name, x.id]));
  const pl = Object.fromEntries((await prisma.partLocation.findMany()).map((x) => [x.name, x.id]));
  const fl = Object.fromEntries((await prisma.finishedLocation.findMany()).map((x) => [x.name, x.id]));

  // reset transactional data
  await prisma.attachment.deleteMany();
  await prisma.report.deleteMany();
  await prisma.testRun.deleteMany();
  await prisma.testItem.deleteMany();
  await prisma.testRequest.deleteMany();

  // ── ใบรีเควส 1: หลาย item หลากสถานะในใบเดียว ──
  const r1 = "TR-2607-001";
  await prisma.testRequest.create({
    data: {
      regisNo: r1,
      seq: 1,
      requestDeptId: dept["R&D"],
      requester: "คุณเอกชัย (R&D) 081-234-5671",
      requestDate: d("2026-07-02"),
      remark: "ชุดทดสอบโคมไฟหน้า รุ่นใหม่ 3 แบบ",
      items: {
        create: [
          {
            itemNo: 1,
            itemCode: code(r1, 1),
            partName: "Lamp Model A Headlight (Low beam)",
            partNo: "LMP-A-001",
            qty: 3,
            partReceivedDate: d("2026-07-05"),
            partLocationId: pl["ชั้น A-1"],
            testDetail: "ECE R112 — Photometric (low beam)",
            planStart: d("2026-07-08"),
            planEnd: d("2026-07-16"),
            actualStart: d("2026-07-08"),
            status: "S4_TESTING",
            ownerId: mem["สมชาย ใจดี"],
          },
          {
            itemNo: 2,
            itemCode: code(r1, 2),
            partName: "Lamp Model A Headlight (High beam)",
            partNo: "LMP-A-002",
            qty: 3,
            partReceivedDate: d("2026-07-05"),
            partLocationId: pl["ชั้น A-1"],
            testDetail: "ECE R112 — Photometric (high beam)",
            planStart: d("2026-07-08"),
            planEnd: d("2026-07-18"),
            status: "S3_PART_IN",
            ownerId: mem["สมหญิง รักงาน"],
          },
          {
            itemNo: 3,
            itemCode: code(r1, 3),
            partName: "Lamp Model A DRL",
            partNo: "LMP-A-003",
            qty: 2,
            testDetail: "ECE R7 — Color + Luminous Intensity",
            status: "S2_WAIT_PART",
            planEnd: d("2026-07-25"),
            ownerId: mem["วีระ ทดสอบ"],
          },
        ],
      },
    },
  });

  // ── ใบรีเควส 2: item เดียว งานด่วน กำลังทำรีพอร์ท ──
  const r2 = "TR-2607-002";
  const req2 = await prisma.testRequest.create({
    data: {
      regisNo: r2,
      seq: 2,
      requestDeptId: dept["Purchasing"],
      requester: "คุณดวงพร (Purchasing) 081-234-5672",
      requestDate: d("2026-06-10"),
      items: {
        create: [
          {
            itemNo: 1,
            itemCode: code(r2, 1),
            partName: "Lamp Model F Reverse Lamp",
            partNo: "LMP-F-061",
            qty: 3,
            partReceivedDate: d("2026-06-14"),
            partLocationId: pl["ชั้น A-2"],
            testDetail: "มอก. 2718 — Photometric + Durability",
            planStart: d("2026-06-16"),
            planEnd: d("2026-07-14"),
            actualStart: d("2026-06-16"),
            actualEnd: d("2026-07-11"),
            status: "S6_REPORTING",
            ownerId: mem["นันทา สุขใจ"],
            remark: "ลูกค้ารอด่วนมาก make รีพอร์ตเลย",
          },
        ],
      },
    },
    include: { items: true },
  });
  const item2 = req2.items[0];
  await prisma.testRun.create({
    data: {
      itemId: item2.id,
      runNo: 1,
      startDate: d("2026-06-16"),
      endDate: d("2026-07-11"),
      loadingOwnerId: mem["สุดา แสงทอง"],
      testOwnerId: mem["นันทา สุขใจ"],
      result: "PASS",
      rawDataUrl: "https://drive.google.com/drive/folders/TR-2607-002-01-run1",
    },
  });
  await prisma.report.create({
    data: { itemId: item2.id, status: "IN_PROGRESS", authorId: mem["นันทา สุขใจ"] },
  });

  // ── ใบรีเควส 3: 2 item เลยกำหนด + retest ──
  const r3 = "TR-2607-003";
  const req3 = await prisma.testRequest.create({
    data: {
      regisNo: r3,
      seq: 3,
      requestDeptId: dept["Engineering"],
      requester: "คุณอนุชา (Engineering) 081-234-5673",
      requestDate: d("2026-06-20"),
      items: {
        create: [
          {
            itemNo: 1,
            itemCode: code(r3, 1),
            partName: "Lamp Model D Signal Lamp (หน้า)",
            partNo: "LMP-D-033",
            qty: 6,
            partReceivedDate: d("2026-06-25"),
            partLocationId: pl["ห้อง Test 1"],
            testDetail: "ECE R6 — Luminous Intensity",
            planStart: d("2026-06-28"),
            planEnd: d("2026-07-05"),
            actualStart: d("2026-06-28"),
            status: "S4_TESTING",
            ownerId: mem["มานะ ตั้งใจ"],
            remark: "เลยแผนเพราะรอเครื่องมือ",
          },
          {
            itemNo: 2,
            itemCode: code(r3, 2),
            partName: "Lamp Model D Signal Lamp (หลัง)",
            partNo: "LMP-D-034",
            qty: 6,
            partReceivedDate: d("2026-06-25"),
            partLocationId: pl["ห้อง Test 1"],
            testDetail: "ECE R6 — Luminous Intensity (rear)",
            planStart: d("2026-06-28"),
            planEnd: d("2026-07-10"),
            actualStart: d("2026-06-28"),
            actualEnd: d("2026-07-09"),
            status: "S5_TEST_DONE",
            ownerId: mem["ปิยะ ขยัน"],
          },
        ],
      },
    },
    include: { items: true },
  });
  const d1 = req3.items.find((i) => i.itemNo === 1)!;
  const d2 = req3.items.find((i) => i.itemNo === 2)!;
  await prisma.testRun.createMany({
    data: [
      { itemId: d1.id, runNo: 1, startDate: d("2026-06-28"), endDate: d("2026-07-02"), testOwnerId: mem["มานะ ตั้งใจ"], result: "FAIL", rawDataUrl: "https://drive.google.com/drive/folders/TR-2607-003-01-run1", remark: "ค่าตก retest" },
      { itemId: d1.id, runNo: 2, startDate: d("2026-07-03"), loadingOwnerId: mem["ประยุทธ์ มั่นคง"], testOwnerId: mem["มานะ ตั้งใจ"] },
      { itemId: d2.id, runNo: 1, startDate: d("2026-06-28"), endDate: d("2026-07-09"), testOwnerId: mem["ปิยะ ขยัน"], result: "PASS", rawDataUrl: "https://drive.google.com/drive/folders/TR-2607-003-02-run1" },
    ],
  });

  // ── ใบรีเควส 4: ปิดงานสมบูรณ์ (item เดียว) ──
  const r4 = "TR-2607-004";
  const req4 = await prisma.testRequest.create({
    data: {
      regisNo: r4,
      seq: 4,
      requestDeptId: dept["QA"],
      requester: "คุณกิตติ (QA) 081-234-5674",
      requestDate: d("2026-05-05"),
      folderUrl: "https://drive.google.com/drive/folders/TR-2607-004",
      items: {
        create: [
          {
            itemNo: 1,
            itemCode: code(r4, 1),
            partName: "Lamp Model H Stop Lamp",
            partNo: "LMP-H-088",
            qty: 5,
            partReceivedDate: d("2026-05-10"),
            partLocationId: pl["ห้อง Test 1"],
            testDetail: "ECE R7 — Luminous Intensity + Endurance",
            planStart: d("2026-05-12"),
            planEnd: d("2026-06-05"),
            actualStart: d("2026-05-12"),
            actualEnd: d("2026-06-02"),
            status: "S8_CLOSED",
            ownerId: mem["สมชาย ใจดี"],
            finishedPartLocationId: fl["คืนแผนกผู้รีเควส"],
            rawDataLocation: "https://drive.google.com/drive/folders/TR-2607-004-01-rawdata",
          },
        ],
      },
    },
    include: { items: true },
  });
  const item4 = req4.items[0];
  await prisma.testRun.create({
    data: {
      itemId: item4.id,
      runNo: 1,
      startDate: d("2026-05-12"),
      endDate: d("2026-06-02"),
      loadingOwnerId: mem["ประยุทธ์ มั่นคง"],
      testOwnerId: mem["สมชาย ใจดี"],
      result: "PASS",
      rawDataUrl: "https://drive.google.com/drive/folders/TR-2607-004-01-run1",
    },
  });
  await prisma.report.create({
    data: {
      itemId: item4.id,
      status: "SENT",
      sentDate: d("2026-06-05"),
      filePath: "TestLab/2026/TR-2607-004_LampH/04_Report/Final/TR-2607-004-01_Report.pdf",
      reportUrl: "https://drive.google.com/file/d/TR-2607-004-01-report",
      authorId: mem["สมชาย ใจดี"],
      approverId: mem["นันทา สุขใจ"],
    },
  });

  // ── ใบรีเควส 5: เพิ่งรับใบ ยังไม่แตก item ย่อย ──
  const r5 = "TR-2607-005";
  await prisma.testRequest.create({
    data: {
      regisNo: r5,
      seq: 5,
      requestDeptId: dept["Production"],
      requester: "คุณพรทิพย์ (Production) 081-234-5675",
      requestDate: d("2026-07-11"),
      items: {
        create: [
          {
            itemNo: 1,
            itemCode: code(r5, 1),
            partName: "Lamp Model B Tail Lamp",
            partNo: "LMP-B-014",
            qty: 5,
            testDetail: "JIS D5500 — Vibration + Thermal Shock",
            planStart: d("2026-07-20"),
            planEnd: d("2026-07-28"),
            status: "S1_RECEIVED",
            ownerId: mem["สมหญิง รักงาน"],
          },
        ],
      },
    },
  });

  // ── ตัวอย่างไฟล์แนบ: ไฟล์อัปโหลดจริง 1 (ระดับใบรีเควส) + ลิงก์ 1 (ระดับ item) ──
  const uploadsDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const sampleName = "seed-sample-request.txt";
  await writeFile(
    path.join(uploadsDir, sampleName),
    "ตัวอย่างเอกสารใบรีเควส (seed)\nModel A Headlight — ทดสอบตาม ECE R112\nติดต่อ: คุณเอกชัย R&D",
    "utf-8"
  );
  await prisma.attachment.create({
    data: {
      requestNo: r1,
      kind: "REQUEST_DOC",
      label: "ใบรีเควสต้นฉบับ (ตัวอย่าง)",
      fileName: "ใบรีเควส_TR-2607-001.txt",
      storedName: sampleName,
      mimeType: "text/plain",
      sizeBytes: 180,
    },
  });
  const firstItem1 = await prisma.testItem.findUniqueOrThrow({ where: { itemCode: code(r1, 1) } });
  await prisma.attachment.create({
    data: {
      itemId: firstItem1.id,
      kind: "TEST_SPEC",
      label: "มาตรฐาน ECE R112 (ลิงก์)",
      url: "https://unece.org/transport/documents/2021/03/standards/un-regulation-no-112",
    },
  });

  const itemCount = await prisma.testItem.count();
  console.log(`Seed complete: 5 requests, ${itemCount} items, attachments created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
