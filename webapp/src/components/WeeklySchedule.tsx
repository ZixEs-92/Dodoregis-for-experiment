"use client";

import { useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { STATUS_FILL, STATUS_LABEL } from "@/lib/workflow";
import { RequestStatus } from "@/generated/prisma/client";

export type SchedItem = {
  itemCode: string;
  partName: string;
  testTitle: string;
  status: RequestStatus;
  planStart: string | null;
  planEnd: string | null;
  overdue: boolean;
  urgent: boolean;
  dayIndices: number[];
  noPlan: boolean;
};

export type DayHead = { label: string; date: string; isToday: boolean };

export type Person = {
  ownerId: number;
  name: string;
  items: SchedItem[];
  weekCount: number;
  todayCount: number;
  overdueCount: number;
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
  });
}

function ItemChip({ it, compact }: { it: SchedItem; compact?: boolean }) {
  const tone = it.overdue
    ? "border-coral bg-coral-soft text-coral"
    : it.urgent
      ? "border-coral/40 bg-coral-soft text-coral"
      : "border-hairline bg-canvas text-ink hover:bg-surface-soft";
  return (
    <Link
      href={`/items/${it.itemCode}`}
      title={`${it.itemCode} · ${it.testTitle ? it.testTitle + " · " : ""}${it.partName} · ${STATUS_LABEL[it.status]}${it.overdue ? " · เลยกำหนด" : ""}`}
      className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-[11px] transition-colors ${tone}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${STATUS_FILL[it.status]}`} />
      <span className="truncate font-medium">{it.itemCode}</span>
      {!compact && <span className="truncate text-muted">{it.testTitle || it.partName}</span>}
    </Link>
  );
}

export default function WeeklySchedule({
  persons,
  days,
  todayIndex,
  offset,
  weekLabel,
  focusPerson,
  mine,
  canFilterMine,
}: {
  persons: Person[];
  days: DayHead[];
  todayIndex: number;
  offset: number;
  weekLabel: string;
  focusPerson: number | null;
  /** true = กรองเหลือแค่งานของฉัน (มีความหมายเฉพาะ canFilterMine) */
  mine: boolean;
  /** ผู้ใช้คนนี้มีงานที่เป็นเจ้าของเองไหม — ถ้าไม่มีก็ไม่ต้องโชว์ปุ่มสลับ */
  canFilterMine: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(focusPerson != null ? [focusPerson] : [])
  );

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const showToday = todayIndex >= 0;
  const totalWeek = persons.reduce((n, p) => n + p.weekCount, 0);

  // ต่อ ?mine=1/0 เข้ากับลิงก์นำทางทุกอัน เพื่อให้ค่าที่เลือกไว้ติดไปด้วยตอนเปลี่ยนสัปดาห์/มุมมอง
  const mineQS = canFilterMine ? `mine=${mine ? "1" : "0"}` : "";
  const withMine = (href: string) => (mineQS ? `${href}${href.includes("?") ? "&" : "?"}${mineQS}` : href);
  const teamHref = `/schedule?view=week&week=${offset}&mine=0`;
  const soloHref = `/schedule?view=week&week=${offset}&mine=1`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">ตารางงาน — รายสัปดาห์</h1>
          <p className="text-[14px] text-muted mt-0.5">
            {mine ? "งานของฉัน" : "ใครมีงานอะไรต้องทำ"} · {weekLabel} · {totalWeek} งานในสัปดาห์นี้
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canFilterMine && (
            <span className="inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
              <NavBtn href={teamHref} label="ทั้งทีม" active={!mine} />
              <NavBtn href={soloHref} label="ของฉัน" active={mine} />
            </span>
          )}
          <span className="inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
            <NavBtn href={withMine("/schedule")} label="เดือน" />
            <span className="rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-white">
              สัปดาห์
            </span>
          </span>
          <span className="inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
            <NavBtn href={withMine(`/schedule?view=week&week=${offset - 1}`)} label="‹ ก่อนหน้า" />
            <NavBtn href={withMine("/schedule?view=week")} label="สัปดาห์นี้" active={offset === 0} />
            <NavBtn href={withMine(`/schedule?view=week&week=${offset + 1}`)} label="ถัดไป ›" />
          </span>
        </div>
      </div>

      {/* วันนี้ใครต้องทำอะไร */}
      {showToday && (
        <section className="card p-5">
          <h2 className="text-[15px] font-medium text-ink mb-1">วันนี้ ({days[todayIndex].label} {days[todayIndex].date}) ต้องทำอะไรบ้าง</h2>
          <p className="text-[12px] text-muted mb-4">งานที่กำหนดตรงวันนี้ + งานเลยกำหนดที่ยังค้าง</p>
          <TodayPanel persons={persons} todayIndex={todayIndex} />
        </section>
      )}

      {/* ตารางคน × วัน */}
      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px] min-w-[860px]">
            <thead>
              <tr className="border-b border-hairline">
                <th className="sticky left-0 z-10 bg-surface-soft p-3 text-left text-[12px] font-medium text-muted uppercase tracking-wide w-44">
                  ผู้รับผิดชอบ
                </th>
                {days.map((d, i) => (
                  <th
                    key={i}
                    className={`p-2 text-center text-[12px] font-medium border-l border-hairline ${
                      d.isToday ? "bg-info-soft text-info" : "bg-surface-soft text-muted"
                    }`}
                  >
                    <div>{d.label}</div>
                    <div className="text-[11px] font-normal">{d.date}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {persons.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-muted">ไม่มีงานที่ยังเปิดอยู่</td>
                </tr>
              )}
              {persons.map((p) => (
                <PersonRows
                  key={p.ownerId}
                  person={p}
                  todayIndex={todayIndex}
                  expanded={expanded.has(p.ownerId)}
                  onToggle={() => toggle(p.ownerId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[12px] text-muted">
        💡 กดที่ <b>ชื่อคน</b> เพื่อกางดูงานทั้งหมดของคนนั้น (รวมงานที่ยังไม่ลงแผน) · กดที่ <b>ชิป</b> เพื่อเปิดหน้างาน
      </p>
    </div>
  );
}

function NavBtn({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "bg-ink text-white" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function TodayPanel({ persons, todayIndex }: { persons: Person[]; todayIndex: number }) {
  const rows = persons
    .map((p) => {
      const seen = new Set<string>();
      const todays = p.items.filter((it) => {
        const hit = it.dayIndices.includes(todayIndex) || it.overdue;
        if (hit && !seen.has(it.itemCode)) {
          seen.add(it.itemCode);
          return true;
        }
        return false;
      });
      return { p, todays };
    })
    .filter((r) => r.todays.length > 0);

  if (rows.length === 0) {
    return <p className="text-[14px] text-muted py-2">วันนี้ยังไม่มีงานที่ถึงกำหนดหรือค้าง 🎉</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {rows.map(({ p, todays }) => (
        <div key={p.ownerId} className="rounded-lg border border-hairline overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-soft border-b border-hairline">
            <span className="grid place-items-center w-7 h-7 rounded-full bg-ink text-white text-[12px] font-medium shrink-0">
              {p.name.slice(0, 1)}
            </span>
            <span className="text-[14px] font-medium text-ink">{p.name}</span>
            <span className="ml-auto text-[12px] text-muted">{todays.length} งาน</span>
          </div>
          <ul className="divide-y divide-hairline">
            {todays.map((it) => (
              <li key={it.itemCode} className="px-3 py-2 flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${STATUS_FILL[it.status]}`} />
                <Link href={`/items/${it.itemCode}`} className="text-[13px] font-medium text-ink hover:text-link shrink-0">
                  {it.itemCode}
                </Link>
                <span className="text-[12px] text-muted truncate flex-1 min-w-0">{it.testTitle || it.partName}</span>
                {it.overdue && <span className="chip bg-coral text-white shrink-0">เลยกำหนด</span>}
                {it.urgent && !it.overdue && <span className="chip bg-coral-soft text-coral shrink-0">ด่วน</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PersonRows({
  person,
  todayIndex,
  expanded,
  onToggle,
}: {
  person: Person;
  todayIndex: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-hairline hover:bg-surface-soft/60">
        <td className="sticky left-0 z-10 bg-canvas p-3 align-top w-44">
          <button onClick={onToggle} className="flex items-center gap-2 text-left w-full">
            <span className={`text-muted text-[11px] transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
            <span className="grid place-items-center w-6 h-6 rounded-full bg-surface-strong text-ink text-[11px] font-medium shrink-0">
              {person.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink truncate hover:text-link">{person.name}</span>
              <span className="block text-[11px] text-muted">
                สัปดาห์นี้ {person.weekCount}
                {person.overdueCount > 0 && <span className="text-coral"> · เลย {person.overdueCount}</span>}
              </span>
            </span>
          </button>
        </td>
        {Array.from({ length: 7 }).map((_, i) => {
          const cell = person.items.filter((it) => it.dayIndices.includes(i));
          const isToday = i === todayIndex;
          return (
            <td key={i} className={`p-1.5 align-top border-l border-hairline ${isToday ? "bg-info-soft/40" : ""}`}>
              <div className="flex flex-col gap-1">
                {cell.map((it) => (
                  <ItemChip key={it.itemCode} it={it} compact />
                ))}
              </div>
            </td>
          );
        })}
      </tr>
      {expanded && (
        <tr className="border-b border-hairline bg-surface-soft/40">
          <td colSpan={8} className="p-4">
            <PersonDetail person={person} />
          </td>
        </tr>
      )}
    </>
  );
}

function PersonDetail({ person }: { person: Person }) {
  const scheduled = person.items.filter((it) => !it.noPlan);
  const noPlan = person.items.filter((it) => it.noPlan);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] font-medium text-ink">งานทั้งหมดของ {person.name} ({person.items.length})</div>
      <ul className="flex flex-col gap-1.5">
        {scheduled.map((it) => (
          <li key={it.itemCode} className="flex flex-wrap items-center gap-2 text-[13px]">
            <Link href={`/items/${it.itemCode}`} className="font-medium text-ink hover:text-link shrink-0">{it.itemCode}</Link>
            <span className="text-body truncate max-w-[220px]">{it.testTitle || it.partName}</span>
            <StatusBadge status={it.status} />
            <span className={`text-[12px] ${it.overdue ? "text-coral font-medium" : "text-muted"}`}>
              แผน {fmt(it.planStart)}–{fmt(it.planEnd)}{it.overdue && " · เลยกำหนด"}
            </span>
            {it.urgent && <span className="chip bg-coral-soft text-coral">ด่วน</span>}
          </li>
        ))}
      </ul>
      {noPlan.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] text-muted">ยังไม่ลงแผน ({noPlan.length}) — ควรกำหนดวัน</div>
          <ul className="flex flex-col gap-1.5">
            {noPlan.map((it) => (
              <li key={it.itemCode} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Link href={`/items/${it.itemCode}`} className="font-medium text-ink hover:text-link">{it.itemCode}</Link>
                <span className="text-body truncate max-w-[220px]">{it.testTitle || it.partName}</span>
                <StatusBadge status={it.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
