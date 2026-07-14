"use client";

import { useState, useTransition } from "react";
import { changeItemStatus } from "@/app/actions";
import { RequestStatus } from "@/generated/prisma/client";
import { STATUS_ORDER, STATUS_LABEL } from "@/lib/workflow";

export default function StatusStepper({
  itemCode,
  currentStatus,
  statusBeforeHold,
}: {
  itemCode: string;
  currentStatus: RequestStatus;
  statusBeforeHold: RequestStatus | null;
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // revalidatePath ใน action ทำให้ props รีเฟรชเองหลังเปลี่ยนสำเร็จ — ไม่ต้องเก็บ state ซ้ำ
  function go(target: RequestStatus, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErrors([]);
    startTransition(async () => {
      const res = await changeItemStatus(itemCode, target);
      if (!res.ok) setErrors(res.errors);
    });
  }

  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const isHold = currentStatus === "S9_HOLD";
  const isCancelled = currentStatus === "S10_CANCEL";
  const nextStatus =
    currentIdx >= 0 && currentIdx < STATUS_ORDER.length - 1
      ? STATUS_ORDER[currentIdx + 1]
      : null;
  const prevStatus = currentIdx > 0 ? STATUS_ORDER[currentIdx - 1] : null;
  const resumeTarget = statusBeforeHold ?? "S1_RECEIVED";

  return (
    <div className="flex flex-col gap-4">
      {/* ปุ่มหลักตามบริบท */}
      <div className="flex flex-wrap items-center gap-2">
        {isHold && (
          <button
            disabled={isPending}
            onClick={() => go(resumeTarget)}
            className="btn-primary btn-sm"
          >
            ▶ กลับไปทำงานต่อ ({STATUS_LABEL[resumeTarget]})
          </button>
        )}
        {isCancelled && (
          <button
            disabled={isPending}
            onClick={() =>
              go("S1_RECEIVED", "ยกเลิกสถานะ Cancel แล้วเปิดงานใหม่ที่ขั้น 1?")
            }
            className="btn-secondary btn-sm"
          >
            เปิดงานใหม่อีกครั้ง
          </button>
        )}
        {!isHold && !isCancelled && nextStatus && (
          <button
            disabled={isPending}
            onClick={() => go(nextStatus)}
            className="btn-primary btn-sm"
          >
            ไปขั้นถัดไป → {STATUS_LABEL[nextStatus]}
          </button>
        )}
        {!isHold && !isCancelled && prevStatus && (
          <button
            disabled={isPending}
            onClick={() =>
              go(prevStatus, `ถอยกลับไปสถานะ ${STATUS_LABEL[prevStatus]}?`)
            }
            className="btn-secondary btn-sm"
          >
            ← ถอยกลับ
          </button>
        )}
      </div>

      {/* เส้นทาง workflow ทั้งหมด — กดข้ามขั้นได้แต่ต้อง confirm */}
      <div className="flex flex-wrap gap-2">
        {STATUS_ORDER.map((s, idx) => {
          const isCurrent = s === currentStatus;
          const isPast = currentIdx >= 0 && idx < currentIdx;
          return (
            <button
              key={s}
              disabled={isPending || isCurrent}
              onClick={() =>
                go(
                  s,
                  s === nextStatus
                    ? undefined
                    : isPast
                    ? `ถอยกลับไปสถานะ ${STATUS_LABEL[s]}?`
                    : `ข้ามไปสถานะ ${STATUS_LABEL[s]} เลยหรือไม่? (ไม่ได้ไปตามลำดับ)`
                )
              }
              className={`px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors disabled:opacity-100 ${
                isCurrent
                  ? "bg-ink text-white border-ink cursor-default"
                  : isPast
                  ? "bg-surface-soft text-body border-hairline hover:bg-surface-strong disabled:opacity-50"
                  : "bg-canvas text-body border-hairline hover:bg-surface-soft disabled:opacity-50"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 pt-3 border-t border-hairline">
        <button
          disabled={isPending || isHold}
          onClick={() => go("S9_HOLD")}
          className="px-3.5 py-2 rounded-lg text-[13px] font-medium bg-mustard-soft text-mustard-deep hover:bg-mustard hover:text-ink transition-colors disabled:opacity-50"
        >
          ⏸ 9-Hold พักงานชั่วคราว
        </button>
        <button
          disabled={isPending || isCancelled}
          onClick={() =>
            go("S10_CANCEL", "ยกเลิกงานนี้? (record จะยังอยู่ในระบบ ไม่ถูกลบ)")
          }
          className="px-3.5 py-2 rounded-lg text-[13px] font-medium bg-coral-soft text-coral hover:bg-coral hover:text-white transition-colors disabled:opacity-50"
        >
          ✕ 10-Cancel ยกเลิกงาน
        </button>
      </div>

      {errors.length > 0 && (
        <div className="bg-coral-soft border border-coral/30 text-coral rounded-lg p-3.5 text-[13px]">
          <ul className="list-disc list-inside flex flex-col gap-0.5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
