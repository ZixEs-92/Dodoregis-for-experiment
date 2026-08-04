import Link from "next/link";
import { STATUS_FILL } from "@/lib/workflow";
import type { RequestStatus } from "@/generated/prisma/client";

export type MonthItem = {
  itemCode: string;
  label: string; // ชื่อการทดสอบ หรือชื่อชิ้นงาน
  ownerName: string;
  status: RequestStatus;
  overdue: boolean;
  urgent: boolean;
  /** index ของวันในเดือน (0 = วันแรกของตาราง) ที่งานนี้ครอบคลุม */
  dayIndices: number[];
};

export type MonthCell = {
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  dateLabel: string;
};

const DOW = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

/**
 * ปฏิทินรายเดือน — ภาพรวมว่างานกระจุกตัวช่วงไหน
 * แต่ละแถว (สัปดาห์) กดเพื่อเจาะดูตารางคน × วัน ของสัปดาห์นั้นได้
 */
export default function MonthSchedule({
  cells,
  items,
  weekOffsets,
  monthLabel,
  monthOffset,
  prevHref,
  nextHref,
  todayHref,
  isThisMonth,
  mine,
  canFilterMine,
}: {
  cells: MonthCell[];
  items: MonthItem[];
  /** ค่า ?week= ของแต่ละแถวสัปดาห์ในตาราง */
  weekOffsets: number[];
  monthLabel: string;
  monthOffset: number;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  isThisMonth: boolean;
  /** true = กรองเหลือแค่งานของฉัน (มีความหมายเฉพาะ canFilterMine) */
  mine: boolean;
  /** ผู้ใช้คนนี้มีงานที่เป็นเจ้าของเองไหม — ถ้าไม่มีก็ไม่ต้องโชว์ปุ่มสลับ */
  canFilterMine: boolean;
}) {
  const weeks = Math.ceil(cells.length / 7);
  const totalPlanned = items.filter((i) => i.dayIndices.length > 0).length;
  const overdueCount = items.filter((i) => i.overdue).length;

  // ต่อ ?mine=1/0 เข้ากับลิงก์นำทางทุกอัน เพื่อให้ค่าที่เลือกไว้ติดไปด้วยตอนเปลี่ยนเดือน/มุมมอง
  const mineQS = canFilterMine ? `mine=${mine ? "1" : "0"}` : "";
  const withMine = (href: string) => (mineQS ? `${href}${href.includes("?") ? "&" : "?"}${mineQS}` : href);
  const teamHref = `/schedule?month=${monthOffset}&mine=0`;
  const soloHref = `/schedule?month=${monthOffset}&mine=1`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">ตารางงาน</h1>
          <p className="text-[14px] text-muted mt-0.5">
            {monthLabel} · {totalPlanned} งาน{mine ? "ของฉัน" : ""}ที่ลงแผนไว้
            {overdueCount > 0 && <span className="text-coral"> · เลยกำหนด {overdueCount}</span>}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canFilterMine && (
            <span className="inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
              <Link
                href={teamHref}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                  !mine ? "bg-ink text-white" : "text-muted hover:text-ink"
                }`}
              >
                ทั้งทีม
              </Link>
              <Link
                href={soloHref}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                  mine ? "bg-ink text-white" : "text-muted hover:text-ink"
                }`}
              >
                ของฉัน
              </Link>
            </span>
          )}
          <span className="inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
            <span className="rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-white">
              เดือน
            </span>
            <Link
              href={withMine("/schedule?view=week")}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink"
            >
              สัปดาห์
            </Link>
          </span>
          <span className="inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
            <Link href={withMine(prevHref)} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink">
              ‹ ก่อนหน้า
            </Link>
            <Link
              href={withMine(todayHref)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                isThisMonth ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              เดือนนี้
            </Link>
            <Link href={withMine(nextHref)} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink">
              ถัดไป ›
            </Link>
          </span>
        </div>
      </div>

      <section className="card overflow-hidden">
        {/* หัวคอลัมน์วัน */}
        <div className="grid grid-cols-7 border-b border-hairline bg-surface-soft">
          {DOW.map((d) => (
            <div key={d} className="p-2 text-center text-[12px] font-medium text-muted">
              {d}
            </div>
          ))}
        </div>

        {Array.from({ length: weeks }).map((_, w) => {
          const rowCells = cells.slice(w * 7, w * 7 + 7);
          const rowItemCount = new Set(
            items
              .filter((it) => it.dayIndices.some((d) => d >= w * 7 && d < w * 7 + 7))
              .map((it) => it.itemCode),
          ).size;

          return (
            <div key={w} className="border-b border-hairline last:border-b-0">
              <div className="grid grid-cols-7">
                {rowCells.map((c, i) => {
                  const dayIdx = w * 7 + i;
                  const dayItems = items.filter((it) => it.dayIndices.includes(dayIdx));
                  return (
                    <div
                      key={i}
                      className={`min-h-[5.5rem] border-l border-hairline p-1.5 first:border-l-0 ${
                        c.inMonth ? "" : "bg-surface-soft/60"
                      } ${c.isToday ? "bg-info-soft/50" : ""}`}
                    >
                      <div
                        className={`mb-1 text-[12px] ${
                          c.isToday
                            ? "font-semibold text-info"
                            : c.inMonth
                              ? "text-ink"
                              : "text-muted/60"
                        }`}
                      >
                        {c.dayNum}
                      </div>
                      <div className="flex flex-col gap-1">
                        {dayItems.slice(0, 3).map((it) => (
                          <Link
                            key={it.itemCode}
                            href={`/items/${it.itemCode}`}
                            title={`${it.itemCode} · ${it.label} · ${it.ownerName}`}
                            className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] transition-colors ${
                              it.overdue
                                ? "bg-coral-soft text-coral"
                                : it.urgent
                                  ? "bg-coral-soft/60 text-coral"
                                  : "bg-surface-soft text-ink hover:bg-surface-strong"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_FILL[it.status]}`} />
                            <span className="truncate">{it.label}</span>
                          </Link>
                        ))}
                        {dayItems.length > 3 && (
                          <span className="px-1 text-[10px] text-muted">
                            +{dayItems.length - 3} งาน
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* แถบเจาะดูรายสัปดาห์ */}
              <Link
                href={withMine(`/schedule?view=week&week=${weekOffsets[w]}`)}
                className="flex items-center gap-2 border-t border-hairline bg-surface-soft/70 px-3 py-1.5 text-[12px] text-muted transition-colors hover:bg-surface-soft hover:text-ink"
              >
                <span>สัปดาห์ที่ {w + 1}</span>
                <span className="text-muted">· {rowItemCount} งาน</span>
                <span className="ml-auto text-link">ดูตารางคน × วัน →</span>
              </Link>
            </div>
          );
        })}
      </section>

      <p className="text-[12px] text-muted">
        💡 กดที่ <b>แถบใต้แต่ละสัปดาห์</b> เพื่อดูว่าใครทำอะไรวันไหน · กดที่ <b>ชื่องาน</b> เพื่อเปิดหน้างาน
      </p>
    </div>
  );
}
