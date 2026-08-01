"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { planItem, planItemsBulk, type ActionResult } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";
import { useToastOnSaved, useToast } from "@/components/ui/Feedback";
import StatusBadge from "@/components/StatusBadge";
import type { RequestStatus } from "@/generated/prisma/client";

type Option = { id: number; name: string };

export type QueueItem = {
  itemCode: string;
  partName: string;
  partNo: string | null;
  testTitle: string;
  testDetail: string;
  status: RequestStatus;
  regisNo: string;
  dept: string;
  requester: string;
  requestDate: string; // formatted
  urgent: boolean;
  remark: string | null;
  /** จำนวนคิวงานที่ยังไม่ปิดของแต่ละคน (โชว์ตอนเลือกเพื่อช่วยกระจายงาน) */
};

const initial: ActionResult = { ok: true, errors: [] };

export default function PlanningQueue({
  items,
  members,
}: {
  items: QueueItem[];
  members: (Option & { openCount: number })[];
}) {
  if (items.length === 0) {
    return (
      <div className="card p-10 text-center flex flex-col items-center gap-2">
        <span className="text-[34px] leading-none">🎉</span>
        <p className="text-[15px] font-medium text-ink">ไม่มีงานรอวางแผน</p>
        <p className="text-[13px] text-muted">
          งานใหม่ที่แผนกลงทะเบียนเข้ามาแบบยังไม่มอบหมาย จะโผล่ที่นี่ให้มอบหมาย + ลงวันที่
        </p>
      </div>
    );
  }

  return <Queue items={items} members={members} />;
}

function Queue({
  items,
  members,
}: {
  items: QueueItem[];
  members: (Option & { openCount: number })[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOwner, setBulkOwner] = useState("");
  const [bulkStart, setBulkStart] = useState("");
  const [bulkEnd, setBulkEnd] = useState("");
  const [busy, startBulk] = useTransition();
  const toast = useToast();

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function runBulk() {
    const ownerId = Number(bulkOwner);
    if (!ownerId) {
      toast("เลือกผู้รับผิดชอบก่อน", "error");
      return;
    }
    const codes = [...selected];
    startBulk(async () => {
      const res = await planItemsBulk(codes, ownerId, bulkStart || null, bulkEnd || null);
      if (res.ok) {
        toast(`วางแผน ${res.count ?? codes.length} รายการแล้ว`, "success");
        setSelected(new Set());
        setBulkOwner("");
        setBulkStart("");
        setBulkEnd("");
      } else {
        toast(res.errors[0] ?? "วางแผนไม่สำเร็จ", "error");
      }
    });
  }

  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.itemCode)))}
          className="btn-secondary btn-sm"
        >
          {allSelected ? "ยกเลิกเลือกทั้งหมด" : `เลือกทั้งหมด (${items.length})`}
        </button>
        <span className="text-[13px] text-muted">
          เลือกหลายรายการเพื่อมอบหมายคนเดียวกันรวดเดียว
        </span>
      </div>

      {/* แถบมอบหมายรวม — โผล่เมื่อมีการเลือก */}
      {selected.size > 0 && (
        <div className="sticky top-[4.5rem] z-10 flex flex-wrap items-end gap-2 rounded-lg border border-ink bg-ink p-3 text-white">
          <span className="text-[13px] font-medium">เลือกไว้ {selected.size} รายการ</span>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/70">ผู้รับผิดชอบ</span>
            <select
              value={bulkOwner}
              onChange={(e) => setBulkOwner(e.target.value)}
              className="h-11 rounded-lg border border-hairline bg-canvas px-2 text-[13px] text-ink"
            >
              <option value="">เลือก…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (คิว {m.openCount})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/70">Plan เริ่ม</span>
            <input
              type="date"
              value={bulkStart}
              onChange={(e) => setBulkStart(e.target.value)}
              className="h-11 rounded-lg border border-hairline bg-canvas px-2 text-[13px] text-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/70">Plan จบ</span>
            <input
              type="date"
              value={bulkEnd}
              onChange={(e) => setBulkEnd(e.target.value)}
              className="h-11 rounded-lg border border-hairline bg-canvas px-2 text-[13px] text-ink"
            />
          </label>
          <button
            type="button"
            onClick={runBulk}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-lg bg-canvas px-4 text-[13px] font-medium text-ink hover:bg-surface-soft disabled:opacity-50"
          >
            {busy ? "กำลังบันทึก…" : "วางแผนทั้งหมด ✓"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="inline-flex min-h-11 items-center px-2 text-[13px] text-white/80 hover:text-white"
          >
            ยกเลิกการเลือก
          </button>
        </div>
      )}

      {items.map((it) => (
        <QueueCard
          key={it.itemCode}
          item={it}
          members={members}
          selected={selected.has(it.itemCode)}
          onToggle={() => toggle(it.itemCode)}
        />
      ))}
    </div>
  );
}

function QueueCard({
  item,
  members,
  selected,
  onToggle,
}: {
  item: QueueItem;
  members: (Option & { openCount: number })[];
  selected: boolean;
  onToggle: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    planItem.bind(null, item.itemCode),
    initial,
  );
  useToastOnSaved(state, `วางแผน ${item.itemCode} แล้ว`);

  return (
    <section
      className={`card p-4 sm:p-5 ${item.urgent ? "border-coral/50" : ""} ${
        selected ? "ring-2 ring-info-border" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex cursor-pointer items-start gap-3 min-w-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`เลือก ${item.itemCode}`}
            className="mt-1 h-5 w-5 shrink-0 accent-[#181d26]"
          />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/items/${item.itemCode}`} className="text-[15px] font-semibold text-link hover:underline">
              {item.itemCode}
            </Link>
            <StatusBadge status={item.status} />
            {item.urgent && <span className="chip bg-coral text-white font-semibold">งานด่วน</span>}
          </div>
          {item.testTitle && <p className="text-[14px] font-medium text-ink mt-1">🧪 {item.testTitle}</p>}
          <p className="text-[13px] text-muted mt-0.5">
            ชิ้นงาน: {item.partName}
            {item.partNo && ` · ${item.partNo}`}
          </p>
          <p className="text-[12px] text-muted mt-0.5">
            {item.dept} · ผู้รีเควส {item.requester} · รับใบ {item.requestDate}
          </p>
          {item.remark && <p className="text-[12px] text-mustard-deep mt-0.5">หมายเหตุ: {item.remark}</p>}
        </div>
        </label>
      </div>

      <form
        action={formAction}
        className="mt-3 pt-3 border-t border-hairline grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
      >
        <label className="flex flex-col gap-1.5">
          <span className="label-text">มอบหมายผู้รับผิดชอบ *</span>
          <select name="owner" required defaultValue="" className="input">
            <option value="">เลือกผู้รับผิดชอบ</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (คิว {m.openCount})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-text">Plan เริ่ม</span>
          <input type="date" name="plan_start" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-text">Plan จบ</span>
          <input type="date" name="plan_end" className="input" />
        </label>
        <button type="submit" disabled={pending} className="btn-primary btn-sm h-11">
          {pending ? "กำลังบันทึก..." : "วางแผน ✓"}
        </button>
        <div className="sm:col-span-4">
          <FormErrors errors={state.errors} />
        </div>
      </form>
    </section>
  );
}
