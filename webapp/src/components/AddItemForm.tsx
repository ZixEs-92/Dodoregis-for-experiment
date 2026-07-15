"use client";

import { useActionState } from "react";
import { ActionResult } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";

type Option = { id: number; name: string };

const initial: ActionResult = { ok: true, errors: [] };

export default function AddItemForm({
  action,
  members,
  nextItemNo,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  members: Option[];
  nextItemNo: number;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <details className="border border-hairline rounded-lg overflow-hidden">
      <summary className="cursor-pointer select-none px-4 py-3 text-[14px] font-medium bg-ink text-white hover:bg-ink-active transition-colors">
        ➕ เพิ่มรายการทดสอบในใบนี้ (item #{String(nextItemNo).padStart(2, "0")})
      </summary>
      <form action={formAction} className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormErrors errors={state.errors} />
        </div>
        <Field label="ชื่อการทดสอบ (item test name)" className="sm:col-span-2">
          <input type="text" name="test_name" placeholder="เช่น Photometric Test (KST)" className="input" />
        </Field>
        <Field label="ชื่อชิ้นงาน / รุ่น Lamp" required className="sm:col-span-2">
          <input type="text" name="part_name" required className="input" />
        </Field>
        <Field label="Part No.">
          <input type="text" name="part_no" className="input" />
        </Field>
        <Field label="จำนวนพาร์ท">
          <input type="number" name="qty" min={0} className="input" />
        </Field>
        <Field label="รายละเอียดเทส / มาตรฐานอ้างอิง" required className="sm:col-span-2">
          <textarea name="test_detail" required rows={3} className="input" />
        </Field>
        <Field label="Plan เริ่มเทส">
          <input type="date" name="plan_start" className="input" />
        </Field>
        <Field label="Plan จบ">
          <input type="date" name="plan_end" className="input" />
        </Field>
        <Field label="ผู้รับผิดชอบหลัก" required className="sm:col-span-2">
          <select name="owner" required className="input">
            <option value="">เลือกผู้รับผิดชอบ</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Remark ของ item" className="sm:col-span-2">
          <textarea name="remark" rows={2} placeholder='พิมพ์ "make รีพอร์ตเลย" หากเป็นงานด่วน' className="input" />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="btn-primary btn-sm">
            {pending ? "กำลังบันทึก..." : "เพิ่ม item"}
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
