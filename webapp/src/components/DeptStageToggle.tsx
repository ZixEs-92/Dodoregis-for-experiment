"use client";

import { useState, useTransition } from "react";
import { toggleDeptStage } from "@/app/settings/approvals/actions";
import { useToast } from "@/components/ui/Feedback";

/** สวิตช์เปิด/ปิดชั้นอนุมัติหัวหน้าแผนก — ปิดแล้วใบใหม่ข้ามไปรอหัวหน้าแลปเลย */
export default function DeptStageToggle({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = useState(initialOn);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function onChange(next: boolean) {
    setError(null);
    const prev = on;
    setOn(next); // optimistic — สวิตช์ตอบสนองทันที
    startTransition(async () => {
      const r = await toggleDeptStage(next);
      if (!r.ok) {
        setOn(prev);
        setError(r.error ?? "เกิดข้อผิดพลาด");
      } else {
        toast(next ? "เปิดชั้นหัวหน้าแผนกแล้ว" : "ปิดชั้นหัวหน้าแผนกแล้ว", "success");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-3 cursor-pointer">
        <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors data-[on=true]:bg-ink bg-surface-strong" data-on={on}>
          <input
            type="checkbox"
            checked={on}
            disabled={pending}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only"
          />
          <span
            className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            style={{ transform: on ? "translateX(22px)" : "translateX(4px)" }}
          />
        </span>
        <span className="text-[14px] font-medium text-ink">
          ชั้นอนุมัติหัวหน้าแผนก {on ? "เปิดอยู่" : "ปิดอยู่"}
        </span>
      </label>
      <p className="text-[12px] text-muted ml-14">
        {on
          ? "ใบใหม่จากผู้ขอต้องผ่านหัวหน้าแผนกก่อน แล้วค่อยไปหัวหน้าแลป"
          : "ใบใหม่ข้ามหัวหน้าแผนก ไปรอหัวหน้าแลปเซ็นชั้นเดียว"}
      </p>
      {error && <p className="text-[12px] text-coral ml-14">{error}</p>}
    </div>
  );
}
