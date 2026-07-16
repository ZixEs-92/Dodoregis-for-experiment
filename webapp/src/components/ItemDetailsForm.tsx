"use client";

import { useActionState } from "react";
import { ActionResult } from "@/app/actions";
import { FormErrors, FormSaved } from "@/components/FormMessages";

type Option = { id: number; name: string };

export type ItemDefaults = {
  testName: string;
  partName: string;
  partNo: string;
  qty: number | null;
  partReceivedDate: string;
  partLocationId: number | null;
  testDetail: string;
  planStart: string;
  planEnd: string;
  actualStart: string;
  actualEnd: string;
  ownerId: number;
  finishedPartLocationId: number | null;
  rawDataLocation: string;
  remark: string;
};

const initialState: ActionResult = { ok: true, errors: [] };

export default function ItemDetailsForm({
  action,
  defaults,
  members,
  partLocations,
  finishedLocations,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaults: ItemDefaults;
  members: Option[];
  partLocations: Option[];
  finishedLocations: Option[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5 mt-4">
      <FormErrors errors={state.errors} />
      <FormSaved show={state.ok && state.saved === true} />

      <FieldGroup title="ชิ้นงานที่ทดสอบ">
        <Field label="ชื่อการทดสอบ (item test name)" className="sm:col-span-2">
          <input type="text" name="test_name" defaultValue={defaults.testName} placeholder="เช่น Photometric Test (KST)" className="input" />
        </Field>
        <Field label="ชื่อชิ้นงาน / รุ่น Lamp" required>
          <input type="text" name="part_name" defaultValue={defaults.partName} required className="input" />
        </Field>
        <Field label="Part No.">
          <input type="text" name="part_no" defaultValue={defaults.partNo} className="input" />
        </Field>
        <Field label="จำนวนพาร์ท">
          <input type="number" name="qty" defaultValue={defaults.qty ?? ""} className="input" />
        </Field>
        <Field label="ผู้รับผิดชอบหลัก" required>
          <select name="owner" defaultValue={defaults.ownerId} required className="input">
            {members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </Field>
        <Field label="วันที่รับพาร์ท">
          <input type="date" name="part_received_date" defaultValue={defaults.partReceivedDate} className="input" />
        </Field>
        <Field label="ตำแหน่งเก็บพาร์ท">
          <select name="part_location" defaultValue={defaults.partLocationId ?? ""} className="input">
            <option value="">- ไม่ระบุ -</option>
            {partLocations.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </Field>
        <Field label="รายละเอียดเทส / มาตรฐานอ้างอิง" required className="sm:col-span-2">
          <textarea name="test_detail" defaultValue={defaults.testDetail} required rows={3} className="input" />
        </Field>
      </FieldGroup>

      <FieldGroup title="แผนงานของ item นี้">
        <Field label="Plan เริ่มเทส">
          <input type="date" name="plan_start" defaultValue={defaults.planStart} className="input" />
        </Field>
        <Field label="Plan จบ">
          <input type="date" name="plan_end" defaultValue={defaults.planEnd} className="input" />
        </Field>
        <Field label="เริ่มจริง">
          <input type="date" name="actual_start" defaultValue={defaults.actualStart} className="input" />
        </Field>
        <Field label="จบจริง">
          <input type="date" name="actual_end" defaultValue={defaults.actualEnd} className="input" />
        </Field>
      </FieldGroup>

      <FieldGroup title="ปิดงาน / จัดเก็บ">
        <Field label="ที่เก็บชิ้นงานหลังเสร็จ">
          <select name="finished_part_location" defaultValue={defaults.finishedPartLocationId ?? ""} className="input">
            <option value="">- ไม่ระบุ -</option>
            {finishedLocations.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
          </select>
        </Field>
        <Field label="ที่เก็บ raw data">
          <input type="text" name="raw_data_location" defaultValue={defaults.rawDataLocation} placeholder="วางลิงก์ Google Drive / SharePoint (https://…)" className="input" />
          <span className="text-[11px] text-muted">
            ใส่ลิงก์คลาวด์ (http/https) จึงจะคลิกเปิดโฟลเดอร์ได้ · path ในเครื่อง เช่น C:\… หรือ \\server\… เปิดจากเว็บไม่ได้
          </span>
        </Field>
        <Field label="Remark ของ item" className="sm:col-span-2">
          <textarea name="remark" defaultValue={defaults.remark} rows={2} placeholder='พิมพ์ "make รีพอร์ตเลย" หากเป็นงานด่วน' className="input" />
        </Field>
      </FieldGroup>

      <div>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "กำลังบันทึก..." : "บันทึกข้อมูล item"}
        </button>
      </div>
    </form>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pb-5 border-b border-hairline last:border-0 last:pb-0">
      <h3 className="text-[12px] font-medium text-muted uppercase tracking-wide">{title}</h3>
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
