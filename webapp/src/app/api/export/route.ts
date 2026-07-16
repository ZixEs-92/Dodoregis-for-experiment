import { toCsv } from "@/lib/csv";
import {
  getAllReportItems,
  filterPeriod,
  byDepartment,
  byRequester,
  byOwner,
  byMonth,
  detailRows,
  DETAIL_HEADERS,
} from "@/lib/report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const monthRaw = url.searchParams.get("month");
  const month = monthRaw ? Number(monthRaw) : null;
  const type = url.searchParams.get("type") ?? "detail";

  if (!Number.isInteger(year)) {
    return new Response("ต้องระบุปี (year)", { status: 400 });
  }

  const all = await getAllReportItems();
  const items = filterPeriod(all, year, month && month >= 1 && month <= 12 ? month : null);

  let headers: string[];
  let rows: (string | number)[][];

  switch (type) {
    case "dept":
      headers = ["แผนก", "จำนวนงาน (item)", "จำนวนใบรีเควส"];
      rows = byDepartment(items).map((r) => [r.label, r.items, r.requests]);
      break;
    case "requester":
      headers = ["ผู้รีเควส", "แผนก", "จำนวนงาน (item)", "จำนวนใบรีเควส"];
      rows = byRequester(items).map((r) => [r.label, r.sub ?? "", r.items, r.requests]);
      break;
    case "owner":
      headers = ["ผู้รับผิดชอบ", "จำนวนงาน (item)", "จำนวนใบรีเควส"];
      rows = byOwner(items).map((r) => [r.label, r.items, r.requests]);
      break;
    case "month":
      headers = ["เดือน", "จำนวนงาน (item)", "จำนวนใบรีเควส"];
      rows = byMonth(items).map((r) => [r.label, r.items, r.requests]);
      break;
    default: // detail
      headers = DETAIL_HEADERS;
      rows = detailRows(items);
  }

  const csv = toCsv(headers, rows);
  const period = month ? `${year}-m${String(month).padStart(2, "0")}` : `${year}`;
  const filename = `dodoregis-${period}-${type}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
