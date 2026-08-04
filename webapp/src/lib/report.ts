import { prisma } from "@/lib/prisma";
import {
  STATUS_LABEL,
  REPORT_STATUS_LABEL,
  RUN_RESULT_LABEL,
  isOverdue,
  isUrgent,
} from "@/lib/workflow";
import { leadTime, slaStatus, SLA_STATUS_LABEL, daysBetween } from "@/lib/tat";
import { requestRollup, PHASE_LABEL } from "@/lib/rollup";
import { testTitle } from "@/lib/format";
import { RequestStatus } from "@/generated/prisma/client";

/**
 * ข้อมูลสำหรับรายงาน/ส่งออก CSV
 * หลักการเลือกคอลัมน์: ต้องตอบคำถามที่คนถามจริงหลังเปิดไฟล์ได้ โดยไม่ต้องกลับมาเปิดเว็บซ้ำ
 * — ติดต่อผู้ขอได้ไหม · ของอยู่ไหน · raw data อยู่ไหน · ช้ากว่าแผนกี่วัน · เทสไปกี่รอบ
 */

export type NormItem = {
  // ระบุงาน
  regisNo: string;
  itemNo: number;
  itemCode: string;
  // ใบรีเควส
  dept: string;
  requester: string;
  requesterEmail: string;
  requesterPhone: string;
  requestDate: Date;
  testObject: string;
  purpose: string;
  requestRemark: string;
  createdByName: string;
  bkkYear: number;
  bkkMonth: number; // 1-12
  // ชิ้นงาน
  model: string;
  partName: string;
  partNo: string;
  qty: number | null;
  partsList: string; // รุ่น Lamp ที่รายการนี้ครอบคลุม
  // ที่มาจากใบรีเควส (คนละแกนกับ item)
  desiredDate: Date | null;
  reportRequired: boolean;
  // การทดสอบ
  testName: string;
  testDetail: string;
  status: RequestStatus;
  owner: string;
  urgent: boolean;
  remark: string;
  // แผน / จริง
  planStart: Date | null;
  planEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  overdue: boolean;
  overdueDays: number; // งานที่ยังไม่จบและเลยกำหนด — เลยมากี่วัน
  finishVsPlanDays: number | null; // จบจริง - plan จบ (ลบ = เร็วกว่าแผน)
  // พาร์ท / ที่เก็บ
  partReceivedDate: Date | null;
  partLocation: string;
  finishedLocation: string;
  rawDataLocation: string;
  // รีพอร์ท
  reportStatus: string;
  sentDate: Date | null;
  reportAuthor: string;
  reportApprover: string;
  reportUrl: string;
  reportFilePath: string;
  // ผลทดสอบ
  runCount: number;
  latestResult: string;
  latestRunTester: string;
  latestRunEnd: Date | null;
  rawDataUrls: string;
  // TAT / SLA
  leadDays: number;
  leadDone: boolean;
  slaTarget: number | null;
  slaStatusLabel: string;
  // audit
  createdAt: Date;
  updatedAt: Date;
};

export type RunRow = {
  regisNo: string;
  itemCode: string;
  testName: string;
  model: string;
  dept: string;
  runNo: number;
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number | null;
  loadingOwner: string;
  testOwner: string;
  result: string;
  rawDataUrl: string;
  remark: string;
};

export type RequestRow = {
  regisNo: string;
  dept: string;
  requester: string;
  requesterEmail: string;
  requesterPhone: string;
  requestDate: Date;
  testObject: string;
  purpose: string;
  remark: string;
  createdByName: string;
  partCount: number;
  partsList: string;
  itemCount: number;
  doneCount: number;
  overdueCount: number;
  unassignedCount: number;
  phase: string;
  progressPct: number;
  firstSentDate: Date | null;
  leadDays: number;
  desiredDate: Date | null;
  reportRequired: boolean;
  bkkYear: number;
  bkkMonth: number;
};

export type PartRow = {
  regisNo: string;
  dept: string;
  requestDate: Date;
  model: string;
  partName: string;
  partNo: string;
  qty: number | null;
  usedByCount: number;
  usedBy: string;
  bkkYear: number;
  bkkMonth: number;
};

function bkkYM(d: Date): { y: number; m: number } {
  const s = d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // yyyy-mm-dd
  const [y, m] = s.split("-").map(Number);
  return { y, m };
}

export function csvDate(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function csvDateTime(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).slice(0, 16);
}

const yn = (b: boolean) => (b ? "ใช่" : "");

// ── ราย item ─────────────────────────────────────────────────

export async function getAllReportItems(): Promise<NormItem[]> {
  const items = await prisma.testItem.findMany({
    include: {
      request: { include: { requestDept: true, createdBy: true } },
      owner: true,
      parts: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      partLocation: true,
      finishedPartLocation: true,
      reports: { include: { author: true, approver: true }, orderBy: { id: "desc" } },
      testRuns: { include: { loadingOwner: true, testOwner: true }, orderBy: { runNo: "desc" } },
    },
    orderBy: [{ regisNo: "asc" }, { itemNo: "asc" }],
  });

  const now = new Date();

  return items.map((it) => {
    const { y, m } = bkkYM(it.request.requestDate);
    const latestReport = it.reports[0];
    const sentDate = it.reports.find((r) => r.status === "SENT")?.sentDate ?? null;
    const latestRunWithResult = it.testRuns.find((r) => r.result);
    const latestRun = it.testRuns[0];
    const overdue = isOverdue(it.planEnd, it.status);
    const lead = leadTime(it.request.requestDate, sentDate, now);
    const slaTarget = it.request.requestDept.slaDays ?? null;

    return {
      regisNo: it.regisNo,
      itemNo: it.itemNo,
      itemCode: it.itemCode,

      dept: it.request.requestDept.name,
      requester: it.request.requester,
      requesterEmail: it.request.requesterEmail ?? "",
      requesterPhone: it.request.requesterPhone ?? "",
      requestDate: it.request.requestDate,
      testObject: it.request.testObject ?? "",
      purpose: it.request.purpose ?? "",
      requestRemark: it.request.remark ?? "",
      createdByName: it.request.createdBy?.displayName ?? "",
      bkkYear: y,
      bkkMonth: m,

      model: it.model,
      partName: it.partName ?? "",
      partNo: it.partNo ?? "",
      qty: it.qty,
      partsList: it.parts.map((p) => p.model + (p.partNo ? ` (${p.partNo})` : "")).join(" | "),
      desiredDate: it.request.desiredDate,
      reportRequired: it.request.reportRequired,

      testName: testTitle(it.testName, it.testDetail),
      testDetail: it.testDetail,
      status: it.status,
      owner: it.owner?.name ?? "ยังไม่มอบหมาย",
      urgent: isUrgent(it.remark),
      remark: it.remark ?? "",

      planStart: it.planStart,
      planEnd: it.planEnd,
      actualStart: it.actualStart,
      actualEnd: it.actualEnd,
      overdue,
      overdueDays: overdue && it.planEnd ? Math.max(0, daysBetween(it.planEnd, now)) : 0,
      finishVsPlanDays:
        it.actualEnd && it.planEnd ? daysBetween(it.planEnd, it.actualEnd) : null,

      partReceivedDate: it.partReceivedDate,
      partLocation: it.partLocation?.name ?? "",
      finishedLocation: it.finishedPartLocation?.name ?? "",
      rawDataLocation: it.rawDataLocation ?? "",

      reportStatus: latestReport ? REPORT_STATUS_LABEL[latestReport.status] : "",
      sentDate,
      reportAuthor: latestReport?.author?.name ?? "",
      reportApprover: latestReport?.approver?.name ?? "",
      reportUrl: latestReport?.reportUrl ?? "",
      reportFilePath: latestReport?.filePath ?? "",

      runCount: it.testRuns.length,
      latestResult: latestRunWithResult?.result
        ? RUN_RESULT_LABEL[latestRunWithResult.result]
        : "",
      latestRunTester: latestRun?.testOwner?.name ?? "",
      latestRunEnd: latestRun?.endDate ?? null,
      rawDataUrls: it.testRuns.map((r) => r.rawDataUrl).filter(Boolean).join(" | "),

      leadDays: lead.days,
      leadDone: lead.done,
      slaTarget,
      slaStatusLabel: SLA_STATUS_LABEL[slaStatus(lead.days, lead.done, slaTarget)],

      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    };
  });
}

// ── ราย test run ─────────────────────────────────────────────

export async function getAllRunRows(): Promise<RunRow[]> {
  const runs = await prisma.testRun.findMany({
    include: {
      loadingOwner: true,
      testOwner: true,
      item: { include: { request: { include: { requestDept: true } } } },
    },
    orderBy: [{ itemId: "asc" }, { runNo: "asc" }],
  });

  return runs.map((r) => ({
    regisNo: r.item.regisNo,
    itemCode: r.item.itemCode,
    testName: testTitle(r.item.testName, r.item.testDetail),
    model: r.item.model,
    dept: r.item.request.requestDept.name,
    runNo: r.runNo,
    startDate: r.startDate,
    endDate: r.endDate,
    durationDays: r.startDate && r.endDate ? daysBetween(r.startDate, r.endDate) : null,
    loadingOwner: r.loadingOwner?.name ?? "",
    testOwner: r.testOwner?.name ?? "",
    result: r.result ? RUN_RESULT_LABEL[r.result] : "",
    rawDataUrl: r.rawDataUrl ?? "",
    remark: r.remark ?? "",
  }));
}

// ── รายใบรีเควส / รายชิ้นงาน ─────────────────────────────────

export async function getAllRequestRows(): Promise<{
  requests: RequestRow[];
  parts: PartRow[];
}> {
  const rows = await prisma.testRequest.findMany({
    include: {
      requestDept: true,
      createdBy: true,
      parts: {
        include: { items: { select: { itemCode: true } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
      items: { include: { reports: true } },
    },
    orderBy: { regisNo: "asc" },
  });

  const now = new Date();
  const requests: RequestRow[] = [];
  const parts: PartRow[] = [];

  for (const r of rows) {
    const { y, m } = bkkYM(r.requestDate);
    const roll = requestRollup(r.items);
    const sentDates = r.items
      .flatMap((i) => i.reports)
      .filter((rep) => rep.status === "SENT" && rep.sentDate)
      .map((rep) => rep.sentDate!)
      .sort((a, b) => a.getTime() - b.getTime());
    const firstSent = sentDates[0] ?? null;
    const lead = leadTime(r.requestDate, firstSent, now);

    requests.push({
      regisNo: r.regisNo,
      dept: r.requestDept.name,
      requester: r.requester,
      requesterEmail: r.requesterEmail ?? "",
      requesterPhone: r.requesterPhone ?? "",
      requestDate: r.requestDate,
      testObject: r.testObject ?? "",
      purpose: r.purpose ?? "",
      remark: r.remark ?? "",
      createdByName: r.createdBy?.displayName ?? "",
      partCount: r.parts.length,
      partsList: r.parts.map((p) => p.model + (p.partNo ? ` (${p.partNo})` : "")).join(" | "),
      itemCount: r.items.length,
      doneCount: roll.done,
      overdueCount: roll.overdueCount,
      unassignedCount: r.items.filter((i) => !i.ownerId).length,
      phase: PHASE_LABEL[roll.phase],
      progressPct: roll.progressPct,
      firstSentDate: firstSent,
      leadDays: lead.days,
      desiredDate: r.desiredDate,
      reportRequired: r.reportRequired,
      bkkYear: y,
      bkkMonth: m,
    });

    for (const p of r.parts) {
      parts.push({
        regisNo: r.regisNo,
        dept: r.requestDept.name,
        requestDate: r.requestDate,
        model: p.model,
        partName: p.partName ?? "",
        partNo: p.partNo ?? "",
        qty: p.qty,
        usedByCount: p.items.length,
        usedBy: p.items.map((i) => i.itemCode).join(" | "),
        bkkYear: y,
        bkkMonth: m,
      });
    }
  }

  return { requests, parts };
}

// ── ช่วงเวลา ─────────────────────────────────────────────────

export function availableYears(items: NormItem[]): number[] {
  return [...new Set(items.map((i) => i.bkkYear))].sort((a, b) => b - a);
}

export function filterPeriod(items: NormItem[], year: number, month: number | null): NormItem[] {
  return items.filter((i) => i.bkkYear === year && (month == null || i.bkkMonth === month));
}

function inPeriod(y: number, m: number, year: number, month: number | null): boolean {
  return y === year && (month == null || m === month);
}

// ── สรุป ─────────────────────────────────────────────────────

export type CountRow = {
  label: string;
  sub?: string;
  items: number;
  requests: number;
  done: number;
  overdue: number;
  avgLead: number | null; // เฉลี่ยเฉพาะงานที่ส่งรีพอร์ทแล้ว
  onTimePct: number | null;
};

function countBy(
  items: NormItem[],
  keyFn: (i: NormItem) => string,
  subFn?: (i: NormItem) => string,
): CountRow[] {
  const map = new Map<
    string,
    { sub?: string; items: NormItem[]; regis: Set<string> }
  >();
  for (const it of items) {
    const k = keyFn(it);
    let e = map.get(k);
    if (!e) {
      e = { sub: subFn?.(it), items: [], regis: new Set() };
      map.set(k, e);
    }
    e.items.push(it);
    e.regis.add(it.regisNo);
  }

  return [...map.entries()]
    .map(([label, e]) => {
      const finished = e.items.filter((i) => i.leadDone);
      const avgLead = finished.length
        ? Math.round((finished.reduce((n, i) => n + i.leadDays, 0) / finished.length) * 10) / 10
        : null;
      const withPlan = e.items.filter((i) => i.actualEnd && i.planEnd);
      const onTimePct = withPlan.length
        ? Math.round(
            (withPlan.filter((i) => (i.finishVsPlanDays ?? 0) <= 0).length / withPlan.length) * 100,
          )
        : null;
      return {
        label,
        sub: e.sub,
        items: e.items.length,
        requests: e.regis.size,
        done: e.items.filter((i) => i.status === "S8_CLOSED").length,
        overdue: e.items.filter((i) => i.overdue).length,
        avgLead,
        onTimePct,
      };
    })
    .sort((a, b) => b.items - a.items);
}

export function byDepartment(items: NormItem[]): CountRow[] {
  return countBy(items, (i) => i.dept);
}
export function byRequester(items: NormItem[]): CountRow[] {
  return countBy(items, (i) => i.requester, (i) => i.dept);
}
export function byOwner(items: NormItem[]): CountRow[] {
  return countBy(items, (i) => i.owner);
}

const MONTH_TH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function byMonth(items: NormItem[]): CountRow[] {
  const rows: CountRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthItems = items.filter((i) => i.bkkMonth === m);
    const finished = monthItems.filter((i) => i.leadDone);
    const withPlan = monthItems.filter((i) => i.actualEnd && i.planEnd);
    rows.push({
      label: MONTH_TH[m],
      items: monthItems.length,
      requests: new Set(monthItems.map((i) => i.regisNo)).size,
      done: monthItems.filter((i) => i.status === "S8_CLOSED").length,
      overdue: monthItems.filter((i) => i.overdue).length,
      avgLead: finished.length
        ? Math.round((finished.reduce((n, i) => n + i.leadDays, 0) / finished.length) * 10) / 10
        : null,
      onTimePct: withPlan.length
        ? Math.round(
            (withPlan.filter((i) => (i.finishVsPlanDays ?? 0) <= 0).length / withPlan.length) * 100,
          )
        : null,
    });
  }
  return rows;
}

// ── CSV: ราย item (ละเอียด) ──────────────────────────────────

export const DETAIL_HEADERS = [
  // ระบุงาน
  "regis_no", "item_no", "item_code", "ลิงก์เปิดงาน",
  // ใบรีเควส
  "แผนกที่ขอ", "ผู้ขอ", "อีเมลผู้ขอ", "เบอร์ผู้ขอ", "วันที่รับใบ",
  "test object (ส่งอะไรมา)", "วัตถุประสงค์", "หมายเหตุใบ", "ผู้บันทึกใบ",
  // ชิ้นงาน
  "Model (รวม)", "ชื่อชิ้นงาน (รวม)", "part_no", "จำนวน", "รุ่น Lamp ที่ทดสอบ",
  // requester
  "วันที่ต้องการผล (ผู้ขอ)", "ต้องการรีพอร์ท",
  // การทดสอบ
  "ชื่อการทดสอบ", "รายละเอียดเทส/มาตรฐาน", "สถานะ", "ผู้รับผิดชอบ", "งานด่วน", "หมายเหตุรายการ",
  // แผน / จริง
  "plan_เริ่ม", "plan_จบ", "จริง_เริ่ม", "จริง_จบ",
  "เลยกำหนด", "เลยกำหนด (วัน)", "จบช้ากว่าแผน (วัน)",
  // พาร์ท / ที่เก็บ
  "วันที่รับพาร์ท", "ที่เก็บพาร์ท", "ที่เก็บหลังเสร็จ", "ที่เก็บ raw data",
  // รีพอร์ท
  "สถานะรีพอร์ท", "วันส่งรีพอร์ท", "ผู้จัดทำรีพอร์ท", "ผู้อนุมัติ", "ลิงก์รีพอร์ท", "ที่อยู่ไฟล์รีพอร์ท",
  // ผลทดสอบ
  "จำนวนครั้งที่เทส", "ผลเทสล่าสุด", "ผู้เทสล่าสุด", "วันจบเทสล่าสุด", "ลิงก์ raw data (ทุกครั้ง)",
  // TAT / SLA
  "lead time (วัน)", "ส่งรีพอร์ทแล้ว", "เป้า SLA (วัน)", "สถานะ SLA",
  // audit
  "สร้างเมื่อ", "แก้ไขล่าสุด",
];

export function detailRows(items: NormItem[], baseUrl = ""): (string | number)[][] {
  return items.map((i) => [
    i.regisNo, i.itemNo, i.itemCode, baseUrl ? `${baseUrl}/items/${i.itemCode}` : "",

    i.dept, i.requester, i.requesterEmail, i.requesterPhone, csvDate(i.requestDate),
    i.testObject, i.purpose, i.requestRemark, i.createdByName,

    i.model, i.partName, i.partNo, i.qty ?? "", i.partsList,

    csvDate(i.desiredDate), i.reportRequired ? "ใช่" : "ไม่",

    i.testName, i.testDetail, STATUS_LABEL[i.status], i.owner, yn(i.urgent), i.remark,

    csvDate(i.planStart), csvDate(i.planEnd), csvDate(i.actualStart), csvDate(i.actualEnd),
    yn(i.overdue), i.overdueDays || "", i.finishVsPlanDays ?? "",

    csvDate(i.partReceivedDate), i.partLocation, i.finishedLocation, i.rawDataLocation,

    i.reportStatus, csvDate(i.sentDate), i.reportAuthor, i.reportApprover, i.reportUrl, i.reportFilePath,

    i.runCount, i.latestResult, i.latestRunTester, csvDate(i.latestRunEnd), i.rawDataUrls,

    i.leadDays, yn(i.leadDone), i.slaTarget ?? "", i.slaStatusLabel,

    csvDateTime(i.createdAt), csvDateTime(i.updatedAt),
  ]);
}

// ── CSV: ราย test run ────────────────────────────────────────

export const RUN_HEADERS = [
  "regis_no", "item_code", "ชื่อการทดสอบ", "Model", "แผนกที่ขอ",
  "ครั้งที่", "วันเริ่ม", "วันจบ", "ใช้เวลา (วัน)",
  "ผู้รับผิดชอบ loading", "ผู้ทดสอบ", "ผลเทส", "ลิงก์ raw data", "หมายเหตุ",
];

export function runRows(rows: RunRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.regisNo, r.itemCode, r.testName, r.model, r.dept,
    r.runNo, csvDate(r.startDate), csvDate(r.endDate), r.durationDays ?? "",
    r.loadingOwner, r.testOwner, r.result, r.rawDataUrl, r.remark,
  ]);
}

// ── CSV: รายใบรีเควส ─────────────────────────────────────────

export const REQUEST_HEADERS = [
  "regis_no", "ลิงก์เปิดใบ", "แผนกที่ขอ", "ผู้ขอ", "อีเมลผู้ขอ", "เบอร์ผู้ขอ", "วันที่รับใบ",
  "test object (ส่งอะไรมา)", "วัตถุประสงค์", "หมายเหตุ", "ผู้บันทึกใบ",
  "จำนวนรุ่น Lamp", "รุ่น Lamp ทั้งหมด",
  "วันที่ต้องการผล", "ต้องการรีพอร์ท",
  "จำนวนรายการทดสอบ", "ปิดงานแล้ว", "เลยกำหนด", "ยังไม่มอบหมาย",
  "สถานะรวม", "ความคืบหน้า (%)", "วันส่งรีพอร์ทแรก", "lead time (วัน)",
];

export function requestRows(rows: RequestRow[], baseUrl = ""): (string | number)[][] {
  return rows.map((r) => [
    r.regisNo, baseUrl ? `${baseUrl}/requests/${r.regisNo}` : "",
    r.dept, r.requester, r.requesterEmail, r.requesterPhone, csvDate(r.requestDate),
    r.testObject, r.purpose, r.remark, r.createdByName,
    r.partCount, r.partsList,
    csvDate(r.desiredDate), r.reportRequired ? "ใช่" : "ไม่",
    r.itemCount, r.doneCount, r.overdueCount, r.unassignedCount,
    r.phase, r.progressPct, csvDate(r.firstSentDate), r.leadDays,
  ]);
}

// ── CSV: รายชิ้นงาน ──────────────────────────────────────────

export const PART_HEADERS = [
  "regis_no", "แผนกที่ขอ", "วันที่รับใบ", "Model", "ชื่อชิ้นงาน", "part_no", "จำนวน",
  "ใช้ในกี่รายการทดสอบ", "รายการทดสอบที่ใช้",
];

export function partRows(rows: PartRow[]): (string | number)[][] {
  return rows.map((p) => [
    p.regisNo, p.dept, csvDate(p.requestDate), p.model, p.partName, p.partNo, p.qty ?? "",
    p.usedByCount, p.usedBy,
  ]);
}

// ── CSV: สรุป (ใช้ร่วมกันทุกแบบ) ─────────────────────────────

export const SUMMARY_HEADERS = (col: string, subCol?: string) => [
  col,
  ...(subCol ? [subCol] : []),
  "จำนวนงาน (item)", "จำนวนใบรีเควส", "ปิดงานแล้ว", "เลยกำหนด",
  "lead time เฉลี่ย (วัน)", "จบตามแผน (%)",
];

export function summaryRows(rows: CountRow[], withSub = false): (string | number)[][] {
  return rows.map((r) => [
    r.label,
    ...(withSub ? [r.sub ?? ""] : []),
    r.items, r.requests, r.done, r.overdue,
    r.avgLead ?? "", r.onTimePct ?? "",
  ]);
}

export { inPeriod };
