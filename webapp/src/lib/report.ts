import { prisma } from "@/lib/prisma";
import { STATUS_LABEL, REPORT_STATUS_LABEL, RUN_RESULT_LABEL } from "@/lib/workflow";
import { testTitle } from "@/lib/format";
import { RequestStatus } from "@/generated/prisma/client";

export type NormItem = {
  regisNo: string;
  itemNo: number;
  itemCode: string;
  testName: string;
  partName: string;
  partNo: string;
  dept: string;
  requester: string;
  requestDate: Date;
  bkkYear: number;
  bkkMonth: number; // 1-12
  owner: string;
  status: RequestStatus;
  planStart: Date | null;
  planEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  reportStatus: string;
  sentDate: Date | null;
  latestResult: string;
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

/** ดึงงานทั้งหมด (ราย item) แล้ว normalize + ใส่ปี/เดือนตามเวลาไทย */
export async function getAllReportItems(): Promise<NormItem[]> {
  const items = await prisma.testItem.findMany({
    include: {
      request: { include: { requestDept: true } },
      owner: true,
      reports: { orderBy: { id: "desc" } },
      testRuns: { orderBy: { runNo: "desc" } },
    },
    orderBy: [{ regisNo: "asc" }, { itemNo: "asc" }],
  });

  return items.map((it) => {
    const { y, m } = bkkYM(it.request.requestDate);
    const latestReport = it.reports[0];
    const latestRunWithResult = it.testRuns.find((r) => r.result);
    return {
      regisNo: it.regisNo,
      itemNo: it.itemNo,
      itemCode: it.itemCode,
      testName: testTitle(it.testName, it.testDetail),
      partName: it.partName,
      partNo: it.partNo ?? "",
      dept: it.request.requestDept.name,
      requester: it.request.requester,
      requestDate: it.request.requestDate,
      bkkYear: y,
      bkkMonth: m,
      owner: it.owner?.name ?? "ยังไม่มอบหมาย",
      status: it.status,
      planStart: it.planStart,
      planEnd: it.planEnd,
      actualStart: it.actualStart,
      actualEnd: it.actualEnd,
      reportStatus: latestReport ? REPORT_STATUS_LABEL[latestReport.status] : "",
      sentDate: it.reports.find((r) => r.status === "SENT")?.sentDate ?? null,
      latestResult: latestRunWithResult?.result ? RUN_RESULT_LABEL[latestRunWithResult.result] : "",
    };
  });
}

export function availableYears(items: NormItem[]): number[] {
  return [...new Set(items.map((i) => i.bkkYear))].sort((a, b) => b - a);
}

export function filterPeriod(items: NormItem[], year: number, month: number | null): NormItem[] {
  return items.filter((i) => i.bkkYear === year && (month == null || i.bkkMonth === month));
}

// ── สรุป ─────────────────────────────────────────────────────

export type CountRow = { label: string; sub?: string; items: number; requests: number };

function countBy(items: NormItem[], keyFn: (i: NormItem) => string, subFn?: (i: NormItem) => string): CountRow[] {
  const map = new Map<string, { sub?: string; items: number; regis: Set<string> }>();
  for (const it of items) {
    const k = keyFn(it);
    let e = map.get(k);
    if (!e) {
      e = { sub: subFn?.(it), items: 0, regis: new Set() };
      map.set(k, e);
    }
    e.items++;
    e.regis.add(it.regisNo);
  }
  return [...map.entries()]
    .map(([label, e]) => ({ label, sub: e.sub, items: e.items, requests: e.regis.size }))
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
    rows.push({
      label: MONTH_TH[m],
      items: monthItems.length,
      requests: new Set(monthItems.map((i) => i.regisNo)).size,
    });
  }
  return rows;
}

// ── CSV ──────────────────────────────────────────────────────

export const DETAIL_HEADERS = [
  "regis_no", "item_no", "item_code", "ชื่อการทดสอบ", "ชื่อชิ้นงาน", "part_no",
  "แผนก", "ผู้รีเควส", "วันที่รับใบ", "ผู้รับผิดชอบ", "สถานะ",
  "plan_เริ่ม", "plan_จบ", "จริง_เริ่ม", "จริง_จบ", "สถานะรีพอร์ท", "วันส่งรีพอร์ท", "ผลเทสล่าสุด",
];

export function detailRows(items: NormItem[]): (string | number)[][] {
  return items.map((i) => [
    i.regisNo, i.itemNo, i.itemCode, i.testName, i.partName, i.partNo,
    i.dept, i.requester, csvDate(i.requestDate), i.owner, STATUS_LABEL[i.status],
    csvDate(i.planStart), csvDate(i.planEnd), csvDate(i.actualStart), csvDate(i.actualEnd),
    i.reportStatus, csvDate(i.sentDate), i.latestResult,
  ]);
}
