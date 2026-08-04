"use client";

import { useActionState } from "react";
import { ActionResult } from "@/app/actions";
import { FormErrors, FormSaved } from "@/components/FormMessages";
import { useToastOnSaved } from "@/components/ui/Feedback";

type Option = { id: number; name: string };
export type PartChoice = {
  id: number;
  model: string;
  partName: string | null;
  partNo: string | null;
  qty: number | null;
};

export type ItemDefaults = {
  testName: string;
  /** id ชิ้นงานที่รายการนี้เลือกไว้ */
  partIds: number[];
  partReceivedDate: string;
  partLocationId: number | null;
  testDetail: string;
  planStart: string;
  planEnd: string;
  actualStart: string;
  actualEnd: string;
  ownerId: number | null;
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
  parts,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaults: ItemDefaults;
  members: Option[];
  partLocations: Option[];
  finishedLocations: Option[];
  /** ชิ้นงานทั้งหมดของใบรีเควสนี้ */
  parts: PartChoice[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useToastOnSaved(state, "บันทึกข้อมูล item แล้ว");

  return (
    <form action={formAction} className="flex flex-col gap-5 mt-4">
      <FormErrors errors={state.errors} />
      <FormSaved show={state.ok && state.saved === true} />

      <FieldGroup title="ชิ้นงานที่ทดสอบ">
        <Field label="ชื่อการทดสอบ (item test name)" className="sm:col-span-2">
          <input type="text" name="test_name" defaultValue={defaults.testName} placeholder="เช่น Photometric Test (KST)" className="input" />
        </Field>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="label-text">
            ทดสอบชิ้นงานรุ่นไหนบ้าง <span className="text-coral">*</span>
          </span>
          {parts.length === 0 ? (
            <p className="text-[12px] text-mustard-deep">
              ใบรีเควสนี้ยังไม่มีชิ้นงาน — เพิ่มได้ที่หน้าใบรีเควส
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {parts.map((p) => (
                <label
                  key={p.id}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 text-[13px] text-body transition-colors hover:bg-surface-soft has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
                >
                  <input
                    type="checkbox"
                    name="part_ids"
                    value={p.id}
                    defaultChecked={defaults.partIds.includes(p.id)}
                    className="accent-[#181d26]"
                  />
                  {p.model}
                  {p.partName && <span className="opacity-70"> · {p.partName}</span>}
                  {p.partNo && <span className="opacity-70"> ({p.partNo})</span>}
                </label>
              ))}
            </div>
          )}
        </div>
        <Field label="ผู้รับผิดชอบหลัก">
          <select name="owner" defaultValue={defaults.ownerId ?? ""} className="input">
            <option value="">- ยังไม่มอบหมาย -</option>
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
            ลิงก์คลาวด์ (http/https) = คลิกเปิดได้เลย · path เน็ตเวิร์ก \\server\… (เช่น \\EVA-NAS02\…) กดจากเว็บไม่ได้ แต่มีปุ่ม “คัดลอก” ให้เอาไปวางใน File Explorer (ต้องอยู่ในเน็ตองค์กร/VPN)
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
