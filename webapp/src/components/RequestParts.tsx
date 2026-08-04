"use client";

import { useActionState, useState, useTransition } from "react";
import { addRequestPart, deleteRequestPart, type ActionResult } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";
import { useConfirm, useToast, useToastOnSaved } from "@/components/ui/Feedback";
import Icon from "@/components/ui/Icon";

export type PartRow = {
  id: number;
  model: string;
  partName: string | null;
  partNo: string | null;
  qty: number | null;
  usedBy: string[]; // itemCode ของรายการทดสอบที่ใช้ชิ้นงานนี้
};

const initial: ActionResult = { ok: true, errors: [] };

/**
 * ชิ้นงาน/รุ่น Lamp ของใบรีเควส — เพิ่มได้หลายรุ่น
 * รายการทดสอบ (item) จะเลือกจากรายการนี้ว่าจะทดสอบรุ่นไหนบ้าง
 */
export default function RequestParts({
  regisNo,
  parts,
  canEdit,
}: {
  regisNo: string;
  parts: PartRow[];
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    addRequestPart.bind(null, regisNo),
    initial,
  );
  useToastOnSaved(state, "เพิ่มชิ้นงานแล้ว");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, startDelete] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();

  async function onDelete(p: PartRow) {
    if (p.usedBy.length > 0) {
      toast(`ลบไม่ได้ — ใช้อยู่ในรายการ ${p.usedBy.join(", ")}`, "error");
      return;
    }
    const ok = await confirm({
      title: `ลบชิ้นงาน “${p.model}” ?`,
      detail: "ลบได้เฉพาะชิ้นงานที่ยังไม่มีรายการทดสอบใช้อยู่",
      confirmLabel: "ลบชิ้นงาน",
      danger: true,
    });
    if (!ok) return;
    setBusyId(p.id);
    startDelete(async () => {
      const res = await deleteRequestPart(p.id);
      setBusyId(null);
      toast(res.ok ? "ลบชิ้นงานแล้ว" : (res.errors[0] ?? "ลบไม่สำเร็จ"), res.ok ? "success" : "error");
    });
  }

  return (
    <section className="card p-5 sm:p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-medium text-ink">
          ชิ้นงาน / รุ่น Lamp ในใบนี้ ({parts.length})
        </h2>
        <p className="text-[12px] text-muted mt-0.5">
          รายการทดสอบด้านล่างจะเลือกจากรายการนี้ว่าทดสอบรุ่นไหนบ้าง
        </p>
      </div>

      {parts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hairline px-3 py-4 text-center text-[13px] text-muted">
          ยังไม่มีชิ้นงานในใบนี้
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {parts.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-hairline px-3 py-2.5"
            >
              <span className="text-[14px] font-medium text-ink">{p.model}</span>
              {p.partName && <span className="text-[13px] text-muted">{p.partName}</span>}
              {p.partNo && <span className="text-[13px] text-muted">Part No. {p.partNo}</span>}
              {p.qty != null && <span className="text-[13px] text-muted">{p.qty} ชิ้น</span>}
              {p.usedBy.length > 0 ? (
                <span className="chip bg-info-soft text-info">ใช้ใน {p.usedBy.length} รายการ</span>
              ) : (
                <span className="chip bg-surface-strong text-muted">ยังไม่มีรายการทดสอบ</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  disabled={busyId === p.id}
                  className="ml-auto text-[12px] text-coral hover:underline disabled:opacity-50"
                >
                  ลบ
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form
          action={formAction}
          className="grid grid-cols-1 gap-3 border-t border-hairline pt-4 sm:grid-cols-[8rem_1fr_8rem_6rem_auto] sm:items-end"
        >
          <div className="sm:col-span-5">
            <FormErrors errors={state.errors} />
          </div>
          <label className="flex flex-col gap-1">
            <span className="label-text">Model *</span>
            <input type="text" name="model" required className="input" placeholder="เช่น P703" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-text">ชื่อชิ้นงาน</span>
            <input type="text" name="part_name" className="input" placeholder="เช่น LED HL HG" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-text">Part No.</span>
            <input type="text" name="part_no" className="input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-text">จำนวน</span>
            <input type="number" name="qty" min={0} className="input" />
          </label>
          <button type="submit" disabled={pending} className="btn-secondary btn-sm">
            <Icon name="plus" size={16} />
            {pending ? "กำลังเพิ่ม..." : "เพิ่มรุ่น"}
          </button>
        </form>
      )}
    </section>
  );
}
