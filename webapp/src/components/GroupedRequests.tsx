"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { ALL_STATUSES, STATUS_LABEL, STATUS_COLOR } from "@/lib/workflow";
import { requestRollup, PHASE_LABEL, PHASE_COLOR } from "@/lib/rollup";
import { RequestStatus } from "@/generated/prisma/client";

export type ItemRow = {
  itemCode: string;
  itemNo: number;
  partName: string;
  partNo: string | null;
  status: RequestStatus;
  ownerName: string;
  planEnd: string | null;
  remark: string | null;
  overdue: boolean;
  urgent: boolean;
  regisNo: string;
  dept: string;
  requester: string;
  requestDate: string;
};

type ViewMode = "status" | "request";

type Section = {
  key: string;
  items: ItemRow[];
  /** header content depends on mode */
  status?: RequestStatus;
  regisNo?: string;
  dept?: string;
  requester?: string;
  requestDate?: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function GroupedRequests({ items }: { items: ItemRow[] }) {
  const [mode, setMode] = useState<ViewMode>("status");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const router = useRouter();

  const sections = useMemo<Section[]>(() => {
    if (mode === "status") {
      const byStatus = new Map<RequestStatus, ItemRow[]>();
      for (const it of items) {
        const arr = byStatus.get(it.status);
        if (arr) arr.push(it);
        else byStatus.set(it.status, [it]);
      }
      return ALL_STATUSES.filter((s) => byStatus.has(s)).map((s) => ({
        key: `status:${s}`,
        status: s,
        items: byStatus.get(s)!,
      }));
    }
    // by request
    const byReq = new Map<string, Section>();
    for (const it of items) {
      let g = byReq.get(it.regisNo);
      if (!g) {
        g = {
          key: `req:${it.regisNo}`,
          regisNo: it.regisNo,
          dept: it.dept,
          requester: it.requester,
          requestDate: it.requestDate,
          items: [],
        };
        byReq.set(it.regisNo, g);
      }
      g.items.push(it);
    }
    return [...byReq.values()].sort((a, b) => b.regisNo!.localeCompare(a.regisNo!));
  }, [items, mode]);

  function toggleSelect(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleSelectMany(codes: string[], allSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of codes) {
        if (allSelected) next.delete(c);
        else next.add(c);
      }
      return next;
    });
  }

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function collapseAll() {
    setCollapsed(new Set(sections.map((s) => s.key)));
  }
  function expandAll() {
    setCollapsed(new Set());
  }

  function printLabels() {
    if (selected.size === 0) return;
    router.push(`/labels?ids=${[...selected].join(",")}`);
  }

  const groupCount = sections.length;
  const requestCount =
    mode === "request" ? groupCount : new Set(items.map((i) => i.regisNo)).size;

  return (
    <div className="flex flex-col gap-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
          <button
            onClick={() => setMode("status")}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              mode === "status" ? "bg-ink text-white" : "text-muted hover:text-ink"
            }`}
          >
            ตามสถานะ
          </button>
          <button
            onClick={() => setMode("request")}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              mode === "request" ? "bg-ink text-white" : "text-muted hover:text-ink"
            }`}
          >
            ตามใบรีเควส
          </button>
        </div>

        <div className="flex gap-1">
          <button onClick={expandAll} className="btn-secondary btn-sm">ขยายทั้งหมด</button>
          <button onClick={collapseAll} className="btn-secondary btn-sm">ย่อทั้งหมด</button>
        </div>

        <button
          onClick={printLabels}
          disabled={selected.size === 0}
          className="btn-secondary btn-sm ml-auto"
        >
          พิมพ์ QR label ({selected.size})
        </button>
      </div>

      <div className="text-[13px] text-muted">
        พบ <span className="font-medium text-ink">{items.length}</span> item ใน{" "}
        <span className="font-medium text-ink">{requestCount}</span> ใบรีเควส
        {mode === "status" && ` · แบ่ง ${groupCount} สถานะ`}
        {selected.size > 0 && ` · เลือก ${selected.size} item`}
      </div>

      {mode === "status" && (
        <div className="rounded-lg bg-info-soft/60 border border-info-border/20 px-3.5 py-2 text-[12px] text-info">
          💡 1 ใบรีเควสมีได้หลายรายการทดสอบ (item) — กด <b>“ตามใบรีเควส”</b> ด้านบนเพื่อดูจัดกลุ่มตามใบ และเข้าไป <b>เพิ่ม item</b> ในแต่ละใบ
        </div>
      )}

      {sections.length === 0 && (
        <div className="card p-10 text-center text-muted">ไม่พบงานที่ตรงเงื่อนไข</div>
      )}

      {sections.map((sec) => {
        const codes = sec.items.map((i) => i.itemCode);
        const allSelected = codes.every((c) => selected.has(c));
        const isCollapsed = collapsed.has(sec.key);
        const overdueCount = sec.items.filter((i) => i.overdue).length;

        return (
          <div key={sec.key} className="card overflow-hidden">
            {/* section header */}
            <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 bg-surface-soft border-b border-hairline">
              <button
                onClick={() => toggleCollapse(sec.key)}
                className="flex items-center gap-3 hover:opacity-70 transition-opacity"
                title="ย่อ/ขยาย"
              >
                <span className={`text-muted transition-transform ${isCollapsed ? "" : "rotate-90"}`}>▶</span>
                {mode === "status" && (
                  <span className={`chip ${STATUS_COLOR[sec.status!]}`}>{STATUS_LABEL[sec.status!]}</span>
                )}
              </button>

              {mode === "request" && (
                <>
                  <Link href={`/requests/${sec.regisNo}`} className="font-semibold text-ink hover:text-link">
                    {sec.regisNo}
                  </Link>
                  {(() => {
                    const roll = requestRollup(
                      sec.items.map((it) => ({
                        status: it.status,
                        planEnd: it.planEnd ? new Date(it.planEnd) : null,
                        remark: it.remark,
                      }))
                    );
                    return (
                      <span className={`chip ${PHASE_COLOR[roll.phase]}`}>
                        {PHASE_LABEL[roll.phase]} · เสร็จ {roll.done}/{roll.total}
                      </span>
                    );
                  })()}
                  <span className="text-[13px] text-muted">
                    {sec.dept} · {sec.requester}
                  </span>
                  <span className="text-[12px] text-muted">รับใบ {fmtDate(sec.requestDate!)}</span>
                  <Link href={`/requests/${sec.regisNo}`} className="text-[12px] text-link hover:underline whitespace-nowrap">
                    เปิดใบ / + เพิ่ม item →
                  </Link>
                </>
              )}

              <span className="ml-auto flex items-center gap-2 text-[12px] text-muted">
                {overdueCount > 0 && (
                  <span className="chip bg-coral text-white">เลยกำหนด {overdueCount}</span>
                )}
                <span className="font-medium text-ink">{sec.items.length}</span> รายการ
              </span>
            </div>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-[14px] min-w-[720px]">
                  <thead>
                    <tr className="border-b border-hairline text-left">
                      <th className="p-3 w-8">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleSelectMany(codes, allSelected)}
                          className="accent-ink"
                          title="เลือกทุก item ในกลุ่มนี้"
                        />
                      </th>
                      <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">Item</th>
                      <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">ชิ้นงาน / พาร์ทโน</th>
                      <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">ผู้รับผิดชอบ</th>
                      {mode === "request" ? (
                        <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">สถานะ</th>
                      ) : null}
                      <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">Plan จบ</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.items.map((it) => (
                      <tr
                        key={it.itemCode}
                        className={`border-b border-hairline last:border-0 hover:bg-surface-soft transition-colors ${
                          it.urgent ? "bg-coral-soft hover:bg-coral-soft" : ""
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(it.itemCode)}
                            onChange={() => toggleSelect(it.itemCode)}
                            className="accent-ink"
                          />
                        </td>
                        <td className="p-3 font-medium whitespace-nowrap">
                          {it.urgent && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral mr-1.5 align-middle" title="งานด่วน" />
                          )}
                          <Link href={`/items/${it.itemCode}`} className="text-ink hover:text-link">
                            {mode === "status" ? it.itemCode : `#${String(it.itemNo).padStart(2, "0")}`}
                          </Link>
                        </td>
                        <td className="p-3">
                          <div className="text-ink">{it.partName}</div>
                          {it.partNo && <div className="text-[12px] text-muted">{it.partNo}</div>}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="grid place-items-center w-6 h-6 rounded-full bg-surface-strong text-ink text-[11px] font-medium shrink-0">
                              {it.ownerName.slice(0, 1)}
                            </span>
                            <span className="text-body">{it.ownerName}</span>
                          </div>
                        </td>
                        {mode === "request" ? (
                          <td className="p-3"><StatusBadge status={it.status} /></td>
                        ) : null}
                        <td className={`p-3 whitespace-nowrap ${it.overdue ? "text-coral font-medium" : "text-body"}`}>
                          {fmtDate(it.planEnd)}
                        </td>
                        <td className="p-3">
                          <Link href={`/items/${it.itemCode}`} className="text-[13px] text-link hover:underline whitespace-nowrap">
                            ดู →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
