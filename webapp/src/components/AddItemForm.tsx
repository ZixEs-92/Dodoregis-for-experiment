"use client";

import { useActionState } from "react";
import { ActionResult } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";
import { useToastOnSaved } from "@/components/ui/Feedback";
import Icon from "@/components/ui/Icon";

type Option = { id: number; name: string };
export type PartOption = { id: number; name: string; partNo: string | null; qty: number | null };

const initial: ActionResult = { ok: true, errors: [] };

export default function AddItemForm({
  action,
  members,
  parts,
  nextItemNo,
  showPlanning = true,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  members: Option[];
  /** ชิ้นงานที่มีในใบนี้ — รายการทดสอบต้องเลือกอย่างน้อย 1 */
  parts: PartOption[];
  nextItemNo: number;
  /** requester ไม่เห็นส่วนวางแผน (owner/plan) — admin ลงให้ทีหลัง */
  showPlanning?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  useToastOnSaved(state, "เพิ่มรายการทดสอบแล้ว");

  return (
    <details className="border border-hairline rounded-lg overflow-hidden">
      <summary className="cursor-pointer select-none px-4 py-3 text-[14px] font-medium bg-ink text-white hover:bg-ink-active transition-colors">
        เพิ่มรายการทดสอบในใบนี้ (รายการที่ {nextItemNo})
      </summary>
      <form action={formAction} className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormErrors errors={state.errors} />
        </div>

        <Field label="ชื่อการทดสอบ" className="sm:col-span-2">
          <input type="text" name="test_name" placeholder="เช่น Photometric Test (KST)" className="input" />
        </Field>

        <Field label="รายละเอียดเทส / มาตรฐานอ้างอิง" required className="sm:col-span-2">
          <textarea name="test_detail" required rows={3} className="input" />
        </Field>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="label-text">
            ทดสอบชิ้นงานรุ่นไหนบ้าง <span className="text-coral">*</span>
          </span>
          {parts.length === 0 ? (
            <p className="text-[12px] text-mustard-deep">
              ใบนี้ยังไม่มีชิ้นงาน — เพิ่มชิ้นงาน/รุ่น Lamp ที่ส่วนด้านบนก่อน
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {parts.map((p) => (
                <label
                  key={p.id}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 text-[13px] text-body transition-colors hover:bg-surface-soft has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
                >
                  <input type="checkbox" name="part_ids" value={p.id} className="accent-[#181d26]" />
                  {p.name}
                  {p.partNo && <span className="opacity-70">({p.partNo})</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        {showPlanning && (
          <>
            <Field label="Plan เริ่มเทส">
              <input type="date" name="plan_start" className="input" />
            </Field>
            <Field label="Plan จบ">
              <input type="date" name="plan_end" className="input" />
            </Field>
            <Field label="ผู้รับผิดชอบหลัก" className="sm:col-span-2">
              <select name="owner" defaultValue="" className="input">
                <option value="">- ยังไม่มอบหมาย (วางแผนภายหลัง) -</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          </>
        )}

        <Field label="Remark ของรายการนี้" className="sm:col-span-2">
          <textarea name="remark" rows={2} placeholder='พิมพ์ "make รีพอร์ตเลย" หากเป็นงานด่วน' className="input" />
        </Field>

        <div className="sm:col-span-2">
          <button type="submit" disabled={pending || parts.length === 0} className="btn-primary btn-sm">
            <Icon name="plus" size={16} />
            {pending ? "กำลังบันทึก..." : "เพิ่มรายการทดสอบ"}
          </button>
        </div>
      </form>
    </details>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="label-text">
        {label}
        {required && <span className="text-coral"> *</span>}
      </span>
      {children}
    </label>
  );
}
