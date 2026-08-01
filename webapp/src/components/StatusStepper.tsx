"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { changeItemStatus } from "@/app/actions";
import { RequestStatus } from "@/generated/prisma/client";
import {
  STATUS_ORDER,
  STATUS_LABEL,
  STATUS_ACTION_LABEL,
  STATUS_COLOR,
} from "@/lib/workflow";
import { useToast, useConfirm } from "@/components/ui/Feedback";

/**
 * ตัวเปลี่ยนสถานะงาน
 * ออกแบบให้เหลือตัวควบคุม 3 ตัว แทนการวางปุ่มทุกสถานะเรียงกัน:
 *   1. ปุ่มหลัก — งานถัดไปตามลำดับ (ข้อความเป็นคำกริยา ไม่ใช่เลขสถานะ)
 *   2. เมนูเลือกสถานะ — สำหรับกรณีข้าม/ถอย
 *   3. เมนู ⋯ — พักงาน / ยกเลิกงาน ซึ่งเป็นการกระทำที่ต้องตั้งใจ
 * เงื่อนไขบังคับกรอกจะบอกตั้งแต่ก่อนกด ไม่ใช่หลังกดแล้ว error
 */
export default function StatusStepper({
  itemCode,
  currentStatus,
  statusBeforeHold,
  nextBlockers = [],
  hasOwner = true,
}: {
  itemCode: string;
  currentStatus: RequestStatus;
  statusBeforeHold: RequestStatus | null;
  /** สิ่งที่ยังขาดสำหรับไปสถานะถัดไป — คำนวณฝั่ง server */
  nextBlockers?: string[];
  hasOwner?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState<null | "status" | "more">(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const isHold = currentStatus === "S9_HOLD";
  const isCancelled = currentStatus === "S10_CANCEL";
  const nextStatus =
    currentIdx >= 0 && currentIdx < STATUS_ORDER.length - 1
      ? STATUS_ORDER[currentIdx + 1]
      : null;
  const prevStatus = currentIdx > 0 ? STATUS_ORDER[currentIdx - 1] : null;
  const resumeTarget = statusBeforeHold ?? "S1_RECEIVED";

  // ยังไม่มอบหมาย = เดินหน้าเกินสถานะ 2 ไม่ได้ (ตรงกับกติกาฝั่ง server)
  const blockedByOwner =
    !hasOwner && nextStatus != null && STATUS_ORDER.indexOf(nextStatus) > 1;
  const blockers = blockedByOwner
    ? ["ยังไม่มอบหมายผู้รับผิดชอบ — ให้ผู้ดูแลระบบวางแผนก่อน"]
    : nextBlockers;
  const canAdvance = nextStatus != null && blockers.length === 0;

  function run(target: RequestStatus, successMsg: string) {
    setMenuOpen(null);
    startTransition(async () => {
      const res = await changeItemStatus(itemCode, target);
      if (res.ok) toast(successMsg, "success");
      else toast(res.errors[0] ?? "เปลี่ยนสถานะไม่สำเร็จ", "error");
    });
  }

  async function pick(target: RequestStatus) {
    setMenuOpen(null);
    if (target === currentStatus) return;
    const targetIdx = STATUS_ORDER.indexOf(target);
    const isBackward = targetIdx >= 0 && currentIdx >= 0 && targetIdx < currentIdx;
    const isSkip = targetIdx >= 0 && currentIdx >= 0 && targetIdx > currentIdx + 1;

    if (isBackward || isSkip) {
      const ok = await confirm({
        title: isBackward
          ? `ถอยกลับไป “${STATUS_LABEL[target]}” ?`
          : `ข้ามไป “${STATUS_LABEL[target]}” เลย ?`,
        detail: isBackward
          ? "ระบบจะบันทึกการถอยกลับไว้ในประวัติกิจกรรม"
          : "งานจะข้ามขั้นตอนระหว่างทาง และบันทึกไว้ในประวัติกิจกรรม",
        confirmLabel: isBackward ? "ถอยกลับ" : "ข้ามไป",
      });
      if (!ok) return;
    }
    run(target, `เปลี่ยนเป็น ${STATUS_LABEL[target]} แล้ว`);
  }

  async function hold() {
    setMenuOpen(null);
    const ok = await confirm({
      title: "พักงานนี้ไว้ชั่วคราว ?",
      detail: `ระบบจะจำสถานะปัจจุบัน (${STATUS_LABEL[currentStatus]}) ไว้ กดกลับมาทำต่อได้ทุกเมื่อ`,
      confirmLabel: "พักงาน",
    });
    if (ok) run("S9_HOLD", "พักงานไว้แล้ว");
  }

  async function cancel() {
    setMenuOpen(null);
    const ok = await confirm({
      title: "ยกเลิกงานนี้ ?",
      detail: "ข้อมูลจะยังอยู่ในระบบ ไม่ถูกลบ แต่งานจะไม่ถูกนับในคิวและรายงานอีกต่อไป",
      confirmLabel: "ยกเลิกงาน",
      danger: true,
    });
    if (ok) run("S10_CANCEL", "ยกเลิกงานแล้ว");
  }

  return (
    <div ref={wrapRef} className="flex flex-col gap-3">
      {/* แถวตัวควบคุมหลัก */}
      <div className="flex flex-wrap items-center gap-2">
        {isHold ? (
          <button
            disabled={isPending}
            onClick={() => run(resumeTarget, "กลับมาทำงานต่อแล้ว")}
            className="btn-primary btn-sm"
          >
            ▶ กลับมาทำต่อ ({STATUS_LABEL[resumeTarget]})
          </button>
        ) : isCancelled ? (
          <button
            disabled={isPending}
            onClick={() => run("S1_RECEIVED", "เปิดงานใหม่แล้ว")}
            className="btn-secondary btn-sm"
          >
            เปิดงานนี้ใหม่อีกครั้ง
          </button>
        ) : nextStatus ? (
          <button
            disabled={isPending || !canAdvance}
            onClick={() => run(nextStatus, `เปลี่ยนเป็น ${STATUS_LABEL[nextStatus]} แล้ว`)}
            className="btn-primary btn-sm"
          >
            {isPending ? "กำลังบันทึก…" : `${STATUS_ACTION_LABEL[nextStatus]} →`}
          </button>
        ) : (
          <span className="chip bg-forest text-white">งานปิดเรียบร้อยแล้ว</span>
        )}

        {/* เมนูเลือกสถานะ (ข้าม/ถอย) */}
        <div className="relative">
          <button
            type="button"
            disabled={isPending}
            aria-haspopup="menu"
            aria-expanded={menuOpen === "status"}
            onClick={() => setMenuOpen((m) => (m === "status" ? null : "status"))}
            className="btn-secondary btn-sm"
          >
            เปลี่ยนสถานะเป็น ▾
          </button>
          {menuOpen === "status" && (
            <div
              role="menu"
              className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-hairline bg-canvas py-1 shadow-lg"
            >
              {STATUS_ORDER.map((s) => {
                const on = s === currentStatus;
                return (
                  <button
                    key={s}
                    role="menuitem"
                    disabled={on || isPending}
                    onClick={() => pick(s)}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] transition-colors ${
                      on ? "bg-surface-soft font-medium text-ink" : "text-body hover:bg-surface-soft"
                    }`}
                  >
                    <span className={`chip ${STATUS_COLOR[s]} shrink-0`}>{STATUS_LABEL[s]}</span>
                    {on && <span className="ml-auto text-[11px] text-muted">ตอนนี้</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* เมนูรอง: พักงาน / ยกเลิก */}
        <div className="relative">
          <button
            type="button"
            disabled={isPending}
            aria-label="ตัวเลือกเพิ่มเติม"
            aria-haspopup="menu"
            aria-expanded={menuOpen === "more"}
            onClick={() => setMenuOpen((m) => (m === "more" ? null : "more"))}
            className="btn-secondary btn-sm px-3"
          >
            ⋯
          </button>
          {menuOpen === "more" && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-hairline bg-canvas py-1 shadow-lg"
            >
              {prevStatus && !isHold && !isCancelled && (
                <button
                  role="menuitem"
                  onClick={() => pick(prevStatus)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-body hover:bg-surface-soft"
                >
                  ← ถอยกลับ ({STATUS_LABEL[prevStatus]})
                </button>
              )}
              <button
                role="menuitem"
                disabled={isHold}
                onClick={hold}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-body hover:bg-surface-soft disabled:opacity-40"
              >
                ⏸ พักงานชั่วคราว
              </button>
              <button
                role="menuitem"
                disabled={isCancelled}
                onClick={cancel}
                className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2.5 text-left text-[13px] text-coral hover:bg-coral-soft disabled:opacity-40"
              >
                ✕ ยกเลิกงาน
              </button>
            </div>
          )}
        </div>
      </div>

      {/* บอกเงื่อนไขก่อนกด ไม่ใช่หลังกด */}
      {!isHold && !isCancelled && nextStatus && blockers.length > 0 && (
        <div className="rounded-lg border border-mustard/40 bg-mustard-soft px-3.5 py-3 text-[13px] text-mustard-deep">
          <p className="font-medium">
            ต้องกรอกข้อมูลให้ครบก่อนถึงจะ “{STATUS_ACTION_LABEL[nextStatus]}” ได้
          </p>
          <ul className="mt-1 list-inside list-disc">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {!blockedByOwner && (
            <p className="mt-1 text-[12px]">กรอกได้ที่แท็บ “รายละเอียดเทส”</p>
          )}
        </div>
      )}
    </div>
  );
}
