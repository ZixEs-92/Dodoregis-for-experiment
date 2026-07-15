"use client";

import { useActionState } from "react";
import { createRequestWithItem, ActionResult } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";

type Option = { id: number; name: string };

const initialState: ActionResult = { ok: true, errors: [] };

export default function NewRequestForm({
  departments,
  members,
  today,
}: {
  departments: Option[];
  members: Option[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createRequestWithItem, initialState);

  return (
    <form action={formAction} className="card p-5 flex flex-col gap-5 sm:p-6">
      <FormErrors errors={state.errors} />

      <FieldGroup title="ข้อมูลใบรีเควส">
        <Field label="แผนกที่รีเควส" required>
          <select name="request_dept" required className="input">
            <option value="">เลือกแผนก</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field label="ผู้รีเควส (ชื่อ + ช่องทางติดต่อ)" required>
          <input type="text" name="requester" required className="input" />
        </Field>
        <Field label="วันที่ได้ใบรีเควส" required>
          <input type="date" name="request_date" required defaultValue={today} className="input" />
        </Field>
        <Field label="หมายเหตุใบรีเควส (รวม)">
          <input type="text" name="request_remark" className="input" />
        </Field>
      </FieldGroup>

      <div className="rounded-lg bg-surface-soft border border-hairline p-4 flex flex-col gap-5">
        <p className="text-[13px] text-muted">
          <span className="chip bg-ink text-white mr-2">Item #01</span>
          กรอกชิ้นงานชิ้นแรก — เพิ่ม item อื่นได้ภายหลังในหน้าใบรีเควส
        </p>

        <FieldGroup title="ชิ้นงานที่ทดสอบ" nested>
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
        </FieldGroup>

        <FieldGroup title="แผนงานของ item นี้" nested>
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
        </FieldGroup>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "กำลังบันทึก..." : "บันทึกใบรีเควส + item แรก"}
        </button>
      </div>
    </form>
  );
}

function FieldGroup({
  title,
  nested,
  children,
}: {
  title: string;
  nested?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-4 ${nested ? "" : "pb-5 border-b border-hairline last:border-0 last:pb-0"}`}>
      <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
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
