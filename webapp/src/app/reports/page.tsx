import Link from "next/link";
import { guardPageTeam } from "@/lib/guard";
import {
  getAllReportItems,
  availableYears,
  filterPeriod,
  byDepartment,
  byRequester,
  byOwner,
  byMonth,
  CountRow,
} from "@/lib/report";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายงาน / ส่งออกข้อมูล — Dodoregis" };

const MONTHS = [
  { v: "", l: "ทั้งปี" },
  { v: "1", l: "ม.ค." }, { v: "2", l: "ก.พ." }, { v: "3", l: "มี.ค." },
  { v: "4", l: "เม.ย." }, { v: "5", l: "พ.ค." }, { v: "6", l: "มิ.ย." },
  { v: "7", l: "ก.ค." }, { v: "8", l: "ส.ค." }, { v: "9", l: "ก.ย." },
  { v: "10", l: "ต.ค." }, { v: "11", l: "พ.ย." }, { v: "12", l: "ธ.ค." },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await guardPageTeam("/reports");
  const sp = await searchParams;
  const all = await getAllReportItems();
  const years = availableYears(all);
  const nowYear = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).slice(0, 4));
  if (years.length === 0) years.push(nowYear);

  const year = sp.year && years.includes(Number(sp.year)) ? Number(sp.year) : years[0];
  const month = sp.month && /^([1-9]|1[0-2])$/.test(sp.month) ? Number(sp.month) : null;

  const items = filterPeriod(all, year, month);
  const totalItems = items.length;
  const totalRequests = new Set(items.map((i) => i.regisNo)).size;
  const periodLabel = month ? `${MONTHS[month].l} ${year}` : `ทั้งปี ${year}`;

  const qs = `year=${year}${month ? `&month=${month}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปหน้าผู้ดูแลระบบ
      </Link>
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">รายงาน / ส่งออกข้อมูล</h1>
        <p className="text-[14px] text-muted mt-0.5">
          สรุปจำนวนงานรายปี/รายเดือน แยกตามแผนก · ผู้รีเควส · ผู้รับผิดชอบ — ดาวน์โหลดเก็บเป็น CSV (เปิด Excel ได้)
        </p>
      </div>

      {/* เลือกช่วงเวลา */}
      <form className="card p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label-text">ปี</span>
          <select name="year" defaultValue={String(year)} className="input w-32">
            {years.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-text">เดือน</span>
          <select name="month" defaultValue={month ? String(month) : ""} className="input w-32">
            {MONTHS.map((m) => (<option key={m.v} value={m.v}>{m.l}</option>))}
          </select>
        </label>
        <button type="submit" className="btn-primary btn-sm">ดูรายงาน</button>
      </form>

      {/* สรุปยอด */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={`งานทั้งหมด (${periodLabel})`} value={totalItems} sub="item" />
        <Stat label="ใบรีเควส" value={totalRequests} sub="ใบ" />
        <Stat label="แผนกที่รีเควส" value={byDepartment(items).length} sub="แผนก" />
      </div>

      {/* ดาวน์โหลด */}
      <section className="card p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-[15px] font-medium text-ink">ดาวน์โหลด CSV</h2>
          <p className="text-[12px] text-muted mt-0.5">
            ช่วง {periodLabel} · UTF-8 เปิดใน Excel / Google Sheets ได้เลย · มีลิงก์เปิดงานในไฟล์ให้กดกลับเข้าระบบ
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-muted uppercase tracking-wide">ข้อมูลดิบ (ใช้ทำ pivot / วิเคราะห์ต่อ)</span>
          <div className="flex flex-wrap gap-2">
            <DownloadBtn qs={qs} type="detail" label="รายการทดสอบ — ละเอียดทุกคอลัมน์" primary />
            <DownloadBtn qs={qs} type="requests" label="รายใบรีเควส" />
            <DownloadBtn qs={qs} type="parts" label="รายชิ้นงาน / รุ่น Lamp" />
            <DownloadBtn qs={qs} type="runs" label="รายครั้งที่เทส (test run)" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-muted uppercase tracking-wide">สรุปพร้อมใช้</span>
          <div className="flex flex-wrap gap-2">
            <DownloadBtn qs={qs} type="dept" label="สรุปตามแผนก" />
            <DownloadBtn qs={qs} type="requester" label="สรุปตามผู้ขอทดสอบ" />
            <DownloadBtn qs={qs} type="owner" label="สรุปตามผู้รับผิดชอบ" />
            <DownloadBtn qs={`year=${year}`} type="month" label="สรุปรายเดือน (ทั้งปี)" />
          </div>
        </div>

        <p className="text-[12px] text-muted border-t border-hairline pt-3">
          💡 ไฟล์ <b>รายการทดสอบ</b> มีครบทั้งข้อมูลติดต่อผู้ขอ · ที่เก็บพาร์ท/ชิ้นงาน/raw data ·
          แผนเทียบจริง · lead time + สถานะ SLA · จำนวนครั้งที่เทส · ลิงก์รีพอร์ท —
          เอาไปทำ pivot ได้โดยไม่ต้องกลับมาเปิดเว็บ
        </p>
      </section>

      {totalItems === 0 ? (
        <div className="card p-10 text-center text-muted">ไม่มีงานในช่วง {periodLabel}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CountTable title="ตามแผนกที่รีเควส" col="แผนก" rows={byDepartment(items)} />
            <CountTable title="ตามผู้รับผิดชอบ" col="ผู้รับผิดชอบ" rows={byOwner(items)} />
          </div>
          <CountTable title="ตามผู้รีเควส" col="ผู้รีเควส" rows={byRequester(items)} showSub subCol="แผนก" />
          {!month && (
            <CountTable title={`รายเดือน ปี ${year}`} col="เดือน" rows={byMonth(items)} hideZero />
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="card p-4 flex flex-col gap-0.5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="text-[28px] font-medium text-ink leading-tight">{value}</span>
      <span className="text-[11px] text-muted">{sub}</span>
    </div>
  );
}

function DownloadBtn({ qs, type, label, primary }: { qs: string; type: string; label: string; primary?: boolean }) {
  return (
    <a href={`/api/export?${qs}&type=${type}`} className={primary ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
      ⬇ {label}
    </a>
  );
}

function CountTable({
  title,
  col,
  rows,
  showSub,
  subCol,
  hideZero,
}: {
  title: string;
  col: string;
  rows: CountRow[];
  showSub?: boolean;
  subCol?: string;
  hideZero?: boolean;
}) {
  const shown = hideZero ? rows.filter((r) => r.items > 0) : rows;
  return (
    <section className="card p-5">
      <h2 className="text-[15px] font-medium text-ink mb-4">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-hairline text-left">
              <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide">{col}</th>
              {showSub && <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide">{subCol}</th>}
              <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide text-right">จำนวนงาน</th>
              <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide text-right">ใบ</th>
              <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide text-right">ปิดแล้ว</th>
              <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide text-right">เลยกำหนด</th>
              <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide text-right">lead เฉลี่ย</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.label + (r.sub ?? "")} className="border-b border-hairline last:border-0">
                <td className="p-2.5 text-ink">{r.label}</td>
                {showSub && <td className="p-2.5 text-muted">{r.sub ?? "—"}</td>}
                <td className="p-2.5 text-right font-medium text-ink">{r.items}</td>
                <td className="p-2.5 text-right text-body">{r.requests}</td>
                <td className="p-2.5 text-right text-body">{r.done}</td>
                <td className={`p-2.5 text-right ${r.overdue > 0 ? "font-medium text-coral" : "text-muted"}`}>
                  {r.overdue || "—"}
                </td>
                <td className="p-2.5 text-right text-body">{r.avgLead != null ? `${r.avgLead} วัน` : "—"}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={showSub ? 7 : 6} className="p-6 text-center text-muted">ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
