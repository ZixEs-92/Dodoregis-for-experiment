"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { RequestStatus } from "@/generated/prisma/client";

export type LoadItem = {
  itemCode: string;
  partName: string;
  status: RequestStatus;
  ownerName: string;
  planStart: string | null;
  planEnd: string | null;
  overdue: boolean;
  urgent: boolean;
};

type RangeMode = "today" | "week" | "all";

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    month: "2-digit",
    day: "2-digit",
  });
}

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
function dayEnd(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

/** ช่วงเวลาของโหมดที่เลือก (เวลาเครื่อง) */
function rangeBounds(mode: RangeMode): [number, number] {
  const now = new Date();
  if (mode === "today") return [dayStart(now), dayEnd(now)];
  // week = จันทร์–อาทิตย์ ของสัปดาห์นี้
  const day = now.getDay(); // 0=อา..6=ส
  const sinceMonday = (day + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - sinceMonday);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [dayStart(mon), dayEnd(sun)];
}

/** งานอยู่ในช่วงเวลาที่เลือกไหม — ใช้ช่วง [planStart, planEnd] ตัดกับช่วงที่เลือก */
function inRange(it: LoadItem, mode: RangeMode): boolean {
  if (mode === "all") return true;
  const startIso = it.planStart ?? it.planEnd;
  const endIso = it.planEnd ?? it.planStart;
  if (!startIso || !endIso) return false; // ไม่มีแผน → เห็นเฉพาะ "ทั้งหมด"
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  const [rs, re] = rangeBounds(mode);
  return s <= re && e >= rs;
}

const MODE_LABEL: Record<RangeMode, string> = {
  today: "วันนี้",
  week: "สัปดาห์นี้",
  all: "ทั้งหมด",
};

export default function LoadingBoard({ items }: { items: LoadItem[] }) {
  const [mode, setMode] = useState<RangeMode>("today");

  const groups = useMemo(() => {
    const filtered = items.filter((it) => inRange(it, mode));
    const byOwner = new Map<string, LoadItem[]>();
    for (const it of filtered) {
      const arr = byOwner.get(it.ownerName);
      if (arr) arr.push(it);
      else byOwner.set(it.ownerName, [it]);
    }
    return [...byOwner.entries()]
      .map(([name, list]) => ({
        name,
        list: list.sort((a, b) => (a.planEnd ?? "9999").localeCompare(b.planEnd ?? "9999")),
      }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [items, mode]);

  const totalShown = groups.reduce((n, g) => n + g.list.length, 0);

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-medium text-ink">Loading รายบุคคล</h2>
          <p className="text-[12px] text-muted">
            งานของแต่ละคน ({MODE_LABEL[mode]}) · {totalShown} item · {groups.length} คน
          </p>
        </div>
        <div className="ml-auto inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
          {(["today", "week", "all"] as RangeMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                mode === m ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-[14px] text-muted py-4 text-center">
          ไม่มีงานตามแผนในช่วง{MODE_LABEL[mode]}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.name} className="rounded-lg border border-hairline overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-soft border-b border-hairline">
                <span className="grid place-items-center w-7 h-7 rounded-full bg-ink text-white text-[12px] font-medium shrink-0">
                  {g.name.slice(0, 1)}
                </span>
                <span className="text-[14px] font-medium text-ink">{g.name}</span>
                <span className="ml-auto text-[12px] text-muted">{g.list.length} งาน</span>
              </div>
              <ul className="divide-y divide-hairline">
                {g.list.map((it) => (
                  <li key={it.itemCode}>
                    <Link
                      href={`/items/${it.itemCode}`}
                      className={`flex items-center gap-2 px-3 py-2 hover:bg-surface-soft transition-colors ${
                        it.urgent ? "bg-coral-soft hover:bg-coral-soft" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {it.urgent && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral shrink-0" title="งานด่วน" />
                          )}
                          <span className="text-[13px] font-medium text-ink truncate">{it.itemCode}</span>
                        </div>
                        <div className="text-[12px] text-muted truncate">{it.partName}</div>
                      </div>
                      <StatusBadge status={it.status} />
                      <span
                        className={`text-[12px] whitespace-nowrap w-12 text-right ${
                          it.overdue ? "text-coral font-medium" : "text-muted"
                        }`}
                        title="กำหนดจบ"
                      >
                        {fmtDate(it.planEnd)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
