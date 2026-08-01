"use client";

import { useActionState } from "react";
import Link from "next/link";
import { planItem, type ActionResult } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";
import { useToastOnSaved } from "@/components/ui/Feedback";
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

  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <QueueCard key={it.itemCode} item={it} members={members} />
      ))}
    </div>
  );
}

function QueueCard({
  item,
  members,
}: {
  item: QueueItem;
  members: (Option & { openCount: number })[];
}) {
  const [state, formAction, pending] = useActionState(
    planItem.bind(null, item.itemCode),
    initial,
  );
  useToastOnSaved(state, `วางแผน ${item.itemCode} แล้ว`);

  return (
    <section className={`card p-4 sm:p-5 ${item.urgent ? "border-coral/50" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
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
