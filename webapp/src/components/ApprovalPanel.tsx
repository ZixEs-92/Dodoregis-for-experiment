"use client";

import { useActionState, useState, useTransition } from "react";
import { approveRequest, rejectRequest, resubmitRequest, type ActionResult } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";
import { useConfirm, useToast, useToastOnSaved } from "@/components/ui/Feedback";
import { APPROVAL_LABEL, APPROVAL_COLOR } from "@/lib/approval";
import type { ApprovalStatus } from "@/generated/prisma/client";

export type ApprovalLogEntry = {
  stage: string;
  action: string;
  byName: string | null;
  reason: string | null;
  at: string; // ฟอร์แมตแล้วจากฝั่ง server
};

const initial: ActionResult = { ok: true, errors: [] };

const ACTION_LABEL: Record<string, string> = {
  SUBMIT: "ส่งเข้าอนุมัติ",
  APPROVE: "อนุมัติ",
  REJECT: "ตีกลับ",
  AUTO_APPROVE: "อนุมัติอัตโนมัติ (ทีมแลปคีย์เอง)",
  OVERRIDE: "อนุมัติ/ตีกลับแทน (admin)",
};
const STAGE_LABEL: Record<string, string> = { DEPT: "หัวหน้าแผนก", LAB: "หัวหน้าแลป" };

/** แถบสถานะอนุมัติบนหน้าใบ — ใครเซ็นแล้ว, เหตุผลที่ตีกลับ, ปุ่มตามสิทธิ์, ไทม์ไลน์ */
export default function ApprovalPanel({
  regisNo,
  approvalStatus,
  resubmitCount,
  deptApprovedByName,
  deptApprovedAt,
  labApprovedByName,
  labApprovedAt,
  rejectedStage,
  rejectedByName,
  rejectedAt,
  rejectReason,
  canApprove,
  canReject,
  canResubmit,
  logs,
}: {
  regisNo: string;
  approvalStatus: ApprovalStatus;
  resubmitCount: number;
  deptApprovedByName: string | null;
  deptApprovedAt: string | null;
  labApprovedByName: string | null;
  labApprovedAt: string | null;
  rejectedStage: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  canApprove: boolean;
  canReject: boolean;
  canResubmit: boolean;
  logs: ApprovalLogEntry[];
}) {
  const [showReject, setShowReject] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [approving, startApprove] = useTransition();
  const [approveError, setApproveError] = useState<string | null>(null);
  const [resubmitting, startResubmit] = useTransition();
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectRequest.bind(null, regisNo),
    initial,
  );
  const confirm = useConfirm();
  const toast = useToast();
  useToastOnSaved(rejectState, "ตีกลับใบนี้แล้ว");

  async function onApprove() {
    setApproveError(null);
    const ok = await confirm({ title: `อนุมัติใบ ${regisNo} ?`, confirmLabel: "อนุมัติ" });
    if (!ok) return;
    startApprove(async () => {
      const r = await approveRequest(regisNo);
      if (!r.ok) setApproveError(r.errors[0] ?? "เกิดข้อผิดพลาด");
      else toast("อนุมัติแล้ว", "success");
    });
  }

  async function onResubmit() {
    setResubmitError(null);
    const ok = await confirm({
      title: "ส่งใบนี้เข้าอนุมัติใหม่?",
      detail: "จะเริ่มขั้นตอนอนุมัติใหม่ทั้ง 2 ชั้น",
      confirmLabel: "ส่งใหม่",
    });
    if (!ok) return;
    startResubmit(async () => {
      const r = await resubmitRequest(regisNo);
      if (!r.ok) setResubmitError(r.errors[0] ?? "เกิดข้อผิดพลาด");
      else toast("ส่งใบนี้เข้าอนุมัติใหม่แล้ว", "success");
    });
  }

  return (
    <section className="card p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip ${APPROVAL_COLOR[approvalStatus]} font-semibold`}>
          {APPROVAL_LABEL[approvalStatus]}
        </span>
        {resubmitCount > 0 && (
          <span className="text-[12px] text-muted">ส่งใหม่แล้ว {resubmitCount} ครั้ง</span>
        )}
        <button
          type="button"
          onClick={() => setShowLog((s) => !s)}
          className="ml-auto text-[12px] text-link hover:underline"
        >
          {showLog ? "ซ่อนประวัติการอนุมัติ" : "ดูประวัติการอนุมัติ"}
        </button>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted shrink-0">หัวหน้าแผนก</dt>
          <dd className="text-ink">
            {deptApprovedByName ? `${deptApprovedByName} · ${deptApprovedAt}` : "ยังไม่เซ็น"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted shrink-0">หัวหน้าแลป</dt>
          <dd className="text-ink">
            {labApprovedByName ? `${labApprovedByName} · ${labApprovedAt}` : "ยังไม่เซ็น"}
          </dd>
        </div>
      </dl>

      {approvalStatus === "REJECTED" && rejectReason && (
        <div className="rounded-lg border border-coral/30 bg-coral-soft p-3 text-[13px] text-coral">
          <div className="font-medium">
            ถูกตีกลับโดย{rejectedByName ? ` ${rejectedByName}` : ""}
            {rejectedStage && ` (${STAGE_LABEL[rejectedStage] ?? rejectedStage})`}
            {rejectedAt && ` · ${rejectedAt}`}
          </div>
          <p className="mt-1">{rejectReason}</p>
        </div>
      )}

      {(canApprove || canReject || canResubmit) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canApprove && (
            <button type="button" onClick={onApprove} disabled={approving} className="btn-primary btn-sm">
              {approving ? "กำลังอนุมัติ..." : "อนุมัติ"}
            </button>
          )}
          {canReject && (
            <button
              type="button"
              onClick={() => setShowReject((s) => !s)}
              className="btn-secondary btn-sm text-coral"
            >
              {showReject ? "ยกเลิก" : "ตีกลับ"}
            </button>
          )}
          {canResubmit && (
            <button
              type="button"
              onClick={onResubmit}
              disabled={resubmitting}
              className="btn-secondary btn-sm"
            >
              {resubmitting ? "กำลังส่ง..." : "แก้แล้วส่งใหม่"}
            </button>
          )}
        </div>
      )}
      {approveError && <p className="text-[12px] text-coral">{approveError}</p>}
      {resubmitError && <p className="text-[12px] text-coral">{resubmitError}</p>}

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
          <button type="submit" disabled={rejectPending} className="btn-secondary btn-sm w-fit text-coral">
            {rejectPending ? "กำลังบันทึก..." : "ยืนยันตีกลับ"}
          </button>
        </form>
      )}

      {showLog && (
        <ul className="flex flex-col gap-1.5 border-t border-hairline pt-3 text-[12px] text-muted">
          {logs.length === 0 && <li>ยังไม่มีประวัติ</li>}
          {logs.map((l, i) => (
            <li key={i}>
              {l.at} · {STAGE_LABEL[l.stage] ?? l.stage} · {ACTION_LABEL[l.action] ?? l.action}
              {l.byName && ` · ${l.byName}`}
              {l.reason && ` — ${l.reason}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
