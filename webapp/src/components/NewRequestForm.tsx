"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useActionState } from "react";
import { createRequestWithItem, ActionResult } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";

const DRAFT_KEY = "dodoregis:new-request-draft";
const DRAFT_EVENT = "dodoregis:draft-changed";

/** อ่านร่างจาก localStorage แบบ SSR-safe (server snapshot = ไม่มีร่าง) */
function subscribeDraft(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DRAFT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DRAFT_EVENT, onChange);
  };
}
function readDraft() {
  return localStorage.getItem(DRAFT_KEY);
}
function writeDraft(value: string | null) {
  if (value === null) localStorage.removeItem(DRAFT_KEY);
  else localStorage.setItem(DRAFT_KEY, value);
  window.dispatchEvent(new Event(DRAFT_EVENT));
}

type Option = { id: number; name: string };

const initialState: ActionResult = { ok: true, errors: [] };

export default function NewRequestForm({
  departments,
  members,
  today,
  lockedDept = null,
  showPlanning = true,
}: {
  departments: Option[];
  members: Option[];
  today: string;
  /** โหมด requester: แผนกถูกล็อกเป็นแผนกของผู้ใช้ (server บังคับซ้ำอีกชั้น) */
  lockedDept?: Option | null;
  /** ซ่อนส่วนวางแผน (owner + plan วันที่) สำหรับ requester — admin เป็นคนลงให้ทีหลัง */
  showPlanning?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createRequestWithItem, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // เก็บร่างไว้ในเครื่อง — พิมพ์รายละเอียดยาว ๆ แล้วปิดแท็บ/เน็ตหลุด ไม่หาย
  const storedDraft = useSyncExternalStore(subscribeDraft, readDraft, () => null);
  const draftFound = storedDraft !== null && !dismissed;

  function saveDraft() {
    const form = formRef.current;
    if (!form) return;
    const data: Record<string, string> = {};
    for (const [k, v] of new FormData(form).entries()) {
      if (typeof v === "string" && v.trim()) data[k] = v;
    }
    if (Object.keys(data).length > 0) writeDraft(JSON.stringify(data));
  }

  function restoreDraft() {
    const form = formRef.current;
    if (!storedDraft || !form) return;
    try {
      const data = JSON.parse(storedDraft) as Record<string, string>;
      for (const [k, v] of Object.entries(data)) {
        const field = form.elements.namedItem(k);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
          field.value = v;
        }
      }
      setDismissed(true);
    } catch {
      writeDraft(null);
    }
  }

  function discardDraft() {
    writeDraft(null);
    setDismissed(true);
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        writeDraft(null); // ส่งแล้วไม่ต้องเก็บร่างอีก
        return formAction(fd);
      }}
      onBlur={saveDraft}
      className="card p-5 flex flex-col gap-5 sm:p-6"
    >
      <FormErrors errors={state.errors} />

      {draftFound && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-info-border/30 bg-info-soft px-3.5 py-2.5 text-[13px] text-info">
          <span className="flex-1">พบร่างที่กรอกค้างไว้ก่อนหน้านี้</span>
          <button type="button" onClick={restoreDraft} className="font-medium underline">
            กู้คืนร่าง
          </button>
          <button type="button" onClick={discardDraft} className="text-muted underline">
            ทิ้งร่าง
          </button>
        </div>
      )}

      <FieldGroup title="ข้อมูลใบรีเควส">
        {lockedDept ? (
          <Field label="แผนกที่รีเควส">
            <div className="input flex items-center bg-surface-soft text-ink">{lockedDept.name}</div>
            <span className="text-[11px] text-muted">ล็อกตามแผนกของบัญชีคุณ</span>
          </Field>
        ) : (
          <Field label="แผนกที่รีเควส" required>
            <select name="request_dept" required className="input">
              <option value="">เลือกแผนก</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
        )}
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

        {showPlanning ? (
          <FieldGroup title="แผนงานของ item นี้" nested>
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
            <Field label="Remark ของ item" className="sm:col-span-2">
              <textarea name="remark" rows={2} placeholder='พิมพ์ "make รีพอร์ตเลย" หากเป็นงานด่วน' className="input" />
            </Field>
          </FieldGroup>
        ) : (
          <FieldGroup title="เพิ่มเติม" nested>
            <Field label="Remark ของ item" className="sm:col-span-2">
              <textarea name="remark" rows={2} placeholder='พิมพ์ "make รีพอร์ตเลย" หากเป็นงานด่วน' className="input" />
            </Field>
            <p className="text-[12px] text-muted sm:col-span-2">
              📌 ผู้รับผิดชอบ + วันที่แผนทดสอบ ทีมแลป/admin จะเป็นคนวางแผนให้หลังรับงาน
            </p>
          </FieldGroup>
        )}
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
