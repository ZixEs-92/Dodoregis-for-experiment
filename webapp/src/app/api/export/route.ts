import { toCsv } from "@/lib/csv";
import {
  getAllReportItems,
  getAllRunRows,
  getAllRequestRows,
  filterPeriod,
  inPeriod,
  byDepartment,
  byRequester,
  byOwner,
  byMonth,
  detailRows,
  DETAIL_HEADERS,
  runRows,
  RUN_HEADERS,
  requestRows,
  REQUEST_HEADERS,
  partRows,
  PART_HEADERS,
  summaryRows,
  SUMMARY_HEADERS,
} from "@/lib/report";

export const dynamic = "force-dynamic";

/**
 * ดาวน์โหลด CSV
 * ?year=YYYY [&month=1-12] &type=detail|runs|requests|parts|dept|requester|owner|month
 * ทุกไฟล์เป็น UTF-8 + BOM เปิดใน Excel ภาษาไทยไม่เพี้ยน
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const monthRaw = url.searchParams.get("month");
  const monthNum = monthRaw ? Number(monthRaw) : null;
  const month = monthNum && monthNum >= 1 && monthNum <= 12 ? monthNum : null;
  const type = url.searchParams.get("type") ?? "detail";

  if (!Number.isInteger(year)) {
    return new Response("ต้องระบุปี (year)", { status: 400 });
  }

  // ลิงก์ในไฟล์ให้กดเปิดงานจาก Excel ได้เลย
  // ใช้ที่อยู่ที่ผู้ใช้กำลังเปิดอยู่จริงเป็นหลัก (APP_BASE_URL อาจตั้งค้างไว้เป็น IP เก่า)
  const fwdHost = request.headers.get("x-forwarded-host");
  const fwdProto = request.headers.get("x-forwarded-proto") ?? "https";
  const baseUrl = fwdHost
    ? `${fwdProto}://${fwdHost}`
    : url.origin || (process.env.APP_BASE_URL?.replace(/\/+$/, "") ?? "");

  const all = await getAllReportItems();
  const items = filterPeriod(all, year, month);

  let headers: string[];
  let rows: (string | number)[][];

  switch (type) {
    case "runs": {
      // เอาเฉพาะ run ของงานที่อยู่ในช่วงเวลาที่เลือก
      const codes = new Set(items.map((i) => i.itemCode));
      const runs = (await getAllRunRows()).filter((r) => codes.has(r.itemCode));
      headers = RUN_HEADERS;
      rows = runRows(runs);
      break;
    }
    case "requests": {
      const { requests } = await getAllRequestRows();
      headers = REQUEST_HEADERS;
      rows = requestRows(
        requests.filter((r) => inPeriod(r.bkkYear, r.bkkMonth, year, month)),
        baseUrl,
      );
      break;
    }
    case "parts": {
      const { parts } = await getAllRequestRows();
      headers = PART_HEADERS;
      rows = partRows(parts.filter((p) => inPeriod(p.bkkYear, p.bkkMonth, year, month)));
      break;
    }
    case "dept":
      headers = SUMMARY_HEADERS("แผนก");
      rows = summaryRows(byDepartment(items));
      break;
    case "requester":
      headers = SUMMARY_HEADERS("ผู้ขอทดสอบ", "แผนก");
      rows = summaryRows(byRequester(items), true);
      break;
    case "owner":
      headers = SUMMARY_HEADERS("ผู้รับผิดชอบ");
      rows = summaryRows(byOwner(items));
      break;
    case "month":
      headers = SUMMARY_HEADERS("เดือน");
      rows = summaryRows(byMonth(items));
      break;
    default: // detail
      headers = DETAIL_HEADERS;
      rows = detailRows(items, baseUrl);
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
