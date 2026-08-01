"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { changeItemStatus } from "@/app/actions";
import { STATUS_ORDER, STATUS_LABEL, STATUS_COLOR } from "@/lib/workflow";
import { useToast, useConfirm } from "@/components/ui/Feedback";
import type { RequestStatus } from "@/generated/prisma/client";

export type BoardItem = {
  itemCode: string;
  title: string;
  partName: string;
  ownerName: string | null;
  dept: string;
  planEnd: string | null; // แสดงผลแล้ว
  status: RequestStatus;
  overdue: boolean;
  urgent: boolean;
};

export type BoardLayout = "rows" | "columns";

/**
 * บอร์ดงานตามสถานะ
 * ค่าเริ่มต้นเป็น "แนวตั้ง" — แต่ละสถานะเป็นแถบเต็มความกว้าง เลื่อนลงอ่านได้ต่อเนื่อง
 * (8 สถานะเรียงแนวนอนต้องรูดข้างยาวมาก โดยเฉพาะบนมือถือ)
 * ยังสลับไปแบบคอลัมน์ (kanban คลาสสิก) ได้ที่ปุ่มมุมขวาบน
 * ลากการ์ดข้ามกลุ่มเพื่อเปลี่ยนสถานะได้ทั้ง 2 แบบ · มือถือใช้เมนูในการ์ด
 */
export default function KanbanBoard({
  items,
  canEdit,
  layout = "rows",
}: {
  items: BoardItem[];
  canEdit: boolean;
  layout?: BoardLayout;
}) {
  const [dragging, setDragging] = useState<BoardItem | null>(null);
  const [hoverGroup, setHoverGroup] = useState<RequestStatus | null>(null);
  const [busy, startMove] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  async function move(item: BoardItem, to: RequestStatus) {
    setDragging(null);
    setHoverGroup(null);
    if (item.status === to) return;

    const fromIdx = STATUS_ORDER.indexOf(item.status);
    const toIdx = STATUS_ORDER.indexOf(to);
    if (toIdx < fromIdx || toIdx > fromIdx + 1) {
      const ok = await confirm({
        title:
          toIdx < fromIdx
            ? `ถอย ${item.itemCode} กลับไป “${STATUS_LABEL[to]}” ?`
            : `ข้าม ${item.itemCode} ไป “${STATUS_LABEL[to]}” ?`,
        detail: "ระบบจะบันทึกไว้ในประวัติกิจกรรมของงานนี้",
        confirmLabel: "ยืนยัน",
      });
      if (!ok) return;
    }

    startMove(async () => {
      const res = await changeItemStatus(item.itemCode, to);
      if (res.ok) toast(`${item.itemCode} → ${STATUS_LABEL[to]}`, "success");
      else toast(res.errors[0] ?? "ย้ายไม่สำเร็จ", "error");
    });
  }

  const dropProps = (status: RequestStatus) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canEdit || !dragging) return;
      e.preventDefault();
      setHoverGroup(status);
    },
    onDragLeave: () => setHoverGroup((g) => (g === status ? null : g)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (canEdit && dragging) move(dragging, status);
    },
  });

  const card = (it: BoardItem) => (
    <article
      key={it.itemCode}
      draggable={canEdit && !busy}
      onDragStart={() => setDragging(it)}
      onDragEnd={() => {
        setDragging(null);
        setHoverGroup(null);
      }}
      className={`card flex flex-col gap-1.5 p-2.5 ${
        canEdit ? "cursor-grab active:cursor-grabbing" : ""
      } ${dragging?.itemCode === it.itemCode ? "opacity-50" : ""} ${
        it.urgent ? "border-coral/40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <Link
          href={`/items/${it.itemCode}`}
          className="text-[12px] font-semibold text-link hover:underline"
        >
          {it.itemCode}
        </Link>
        {it.urgent && <span className="chip bg-coral text-white ml-auto">ด่วน</span>}
      </div>
      <p className="text-[13px] font-medium text-ink">{it.title || it.partName}</p>
      <p className="text-[11px] text-muted">
        {it.ownerName ?? "ยังไม่มอบหมาย"} · {it.dept}
      </p>
      <span className={`text-[11px] ${it.overdue ? "font-medium text-coral" : "text-muted"}`}>
        {it.planEnd ? `${it.overdue ? "เลยกำหนด " : "กำหนด "}${it.planEnd}` : "ไม่มีวันกำหนด"}
      </span>

      {/* มือถือ: ย้ายด้วยเมนูแทนการลาก */}
      {canEdit && (
        <label className="mt-1 sm:hidden">
          <span className="sr-only">ย้าย {it.itemCode} ไปสถานะอื่น</span>
          <select
            value={it.status}
            disabled={busy}
            onChange={(e) => move(it, e.target.value as RequestStatus)}
            className="w-full rounded-md border border-hairline bg-canvas px-2 py-1.5 text-[12px] text-ink"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                ย้ายไป: {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      )}
    </article>
  );

  // ── แนวนอน (kanban คลาสสิก) ──
  if (layout === "columns") {
    return (
      <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-3">
          {STATUS_ORDER.map((status) => {
            const cards = items.filter((i) => i.status === status);
            const isTarget = hoverGroup === status;
            return (
              <section
                key={status}
                {...dropProps(status)}
                className={`flex w-[16rem] shrink-0 flex-col rounded-lg border transition-colors ${
                  isTarget ? "border-info-border bg-info-soft" : "border-hairline bg-surface-soft"
                }`}
              >
                <header className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
                  <span className={`chip ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
                  <span className="ml-auto text-[12px] font-medium text-muted">{cards.length}</span>
                </header>
                <div className="flex min-h-[6rem] flex-col gap-2 p-2">
                  {cards.length === 0 ? (
                    <p className="px-1 py-4 text-center text-[12px] text-muted">
                      {isTarget ? "วางที่นี่" : "—"}
                    </p>
                  ) : (
                    cards.map(card)
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  // ── แนวตั้ง (ค่าเริ่มต้น) — แต่ละสถานะเต็มความกว้าง เลื่อนลงอ่าน ──
  return (
    <div className="flex flex-col gap-3">
      {STATUS_ORDER.map((status) => {
        const cards = items.filter((i) => i.status === status);
        const isTarget = hoverGroup === status;
        const overdueCount = cards.filter((c) => c.overdue).length;
        return (
          <section
            key={status}
            {...dropProps(status)}
            className={`overflow-hidden rounded-lg border transition-colors ${
              isTarget ? "border-info-border bg-info-soft" : "border-hairline bg-canvas"
            }`}
          >
            <header className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface-soft px-3 py-2.5">
              <span className={`chip ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
              <span className="text-[13px] font-medium text-ink">{cards.length} รายการ</span>
              {overdueCount > 0 && (
                <span className="chip bg-coral text-white">เลยกำหนด {overdueCount}</span>
              )}
              {isTarget && (
                <span className="ml-auto text-[12px] font-medium text-info">วางที่นี่เพื่อย้ายมา</span>
              )}
            </header>

            {cards.length === 0 ? (
              <p className="px-3 py-4 text-[12px] text-muted">— ไม่มีงานในขั้นนี้</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cards.map(card)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
