"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { approveRequest, rejectRequest, type ActionResult } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";
import { useConfirm, useToast, useToastOnSaved } from "@/components/ui/Feedback";
import { APPROVAL_LABEL, APPROVAL_COLOR } from "@/lib/approval";
// type-only — ไฟล์ต้นทางใช้ prisma (server-only) แต่ import แบบ type ถูก erase ตอน build ไม่ลากมาที่ client bundle
import type { ApprovableSheet } from "@/lib/approvalQueue";

export type QueueRow = ApprovableSheet;

const initial: ActionResult = { ok: true, errors: [] };

/** แถวในคิว /approvals — อนุมัติ/ตีกลับได้ในลิสต์เลย ไม่ต้องเปิดหน้าใบ */
export default function ApprovalQueueRow({ row }: { row: QueueRow }) {
  const [showReject, setShowReject] = useState(false);
  const [approving, startApprove] = useTransition();
  const [approveError, setApproveError] = useState<string | null>(null);
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectRequest.bind(null, row.regisNo),
    initial,
  );
  const confirm = useConfirm();
  const toast = useToast();
  useToastOnSaved(rejectState, `ตีกลับใบ ${row.regisNo} แล้ว`);

  async function onApprove() {
    setApproveError(null);
    const ok = await confirm({
      title: `อนุมัติใบ ${row.regisNo} ?`,
      detail: `${row.deptName} · ${row.requester}${row.testObject ? ` · ${row.testObject}` : ""}`,
      confirmLabel: "อนุมัติ",
    });
    if (!ok) return;
    startApprove(async () => {
      const r = await approveRequest(row.regisNo);
      if (!r.ok) setApproveError(r.errors[0] ?? "เกิดข้อผิดพลาด");
      else toast(`อนุมัติใบ ${row.regisNo} แล้ว`, "success");
    });
  }

  return (
    <li className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/requests/${row.regisNo}`} className="text-[15px] font-semibold text-ink hover:underline">
              {row.regisNo}
            </Link>
            <span className={`chip ${APPROVAL_COLOR[row.approvalStatus]}`}>
              {APPROVAL_LABEL[row.approvalStatus]}
            </span>
            {row.daysWaiting != null && row.daysWaiting > 0 && (
              <span className="chip bg-coral-soft text-coral">ค้างมา {row.daysWaiting} วัน</span>
            )}
          </div>
          <p className="text-[13px] text-muted mt-1">
            {row.deptName} · {row.requester}
            {row.testObject && ` · ${row.testObject}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onApprove} disabled={approving} className="btn-primary btn-sm">
            {approving ? "กำลังอนุมัติ..." : "อนุมัติ"}
          </button>
          <button
            type="button"
            onClick={() => setShowReject((s) => !s)}
            className="btn-secondary btn-sm text-coral"
          >
            {showReject ? "ยกเลิก" : "ตีกลับ"}
          </button>
        </div>
      </div>

      {approveError && <p className="text-[12px] text-coral">{approveError}</p>}

      {showReject && (
        <form action={rejectAction} className="flex flex-col gap-2 rounded-lg border border-hairline p-3">
          <textarea
            name="reason"
            required
            rows={2}
            placeholder="เหตุผลที่ตีกลับ (บังคับกรอก) — ผู้ขอจะเห็นข้อความนี้"
            className="input"
          />
          <FormErrors errors={rejectState.errors} />
          <button
            type="submit"
            disabled={rejectPending}
            className="btn-secondary btn-sm w-fit text-coral"
          >
            {rejectPending ? "กำลังบันทึก..." : "ยืนยันตีกลับ"}
          </button>
        </form>
      )}
    </li>
  );
}
