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

      <FieldGroup title="ผู้ขอทดสอบ">
        {lockedDept ? (
          <Field label="แผนกที่ขอ">
            <div className="input flex items-center bg-surface-soft text-ink">{lockedDept.name}</div>
            <span className="text-[11px] text-muted">ล็อกตามแผนกของบัญชีคุณ</span>
          </Field>
        ) : (
          <Field label="แผนกที่ขอ" required>
            <select name="request_dept" required className="input">
              <option value="">เลือกแผนก</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="ชื่อผู้ขอ" required>
          <input type="text" name="requester" required className="input" placeholder="ชื่อ–นามสกุล" />
        </Field>
        <Field label="อีเมล">
          <input type="email" name="requester_email" className="input" placeholder="name@company.com" />
        </Field>
        <Field label="เบอร์โทร / เบอร์ภายใน">
          <input type="tel" name="requester_phone" className="input" placeholder="เช่น 081-234-5678 หรือ ต่อ 1234" />
        </Field>
        <Field label="วันที่ได้ใบรีเควส" required>
          <input type="date" name="request_date" required defaultValue={today} className="input" />
        </Field>
      </FieldGroup>

      <FieldGroup title="งานที่ขอทดสอบ (ระดับใบรีเควส)">
        <Field label="Test object — ส่งอะไรมาทดสอบ" required className="sm:col-span-2">
          <input
            type="text"
            name="test_object"
            required
            className="input"
            placeholder="เช่น ไฟหน้า P703 LED ตัวอย่างจากล็อตผลิตแรก 5 ชิ้น"
          />
          <span className="text-[11px] text-muted">
            ภาพรวมของทั้งใบ — รายละเอียดการทดสอบแต่ละหัวข้อไปกรอกเป็นรายการย่อยด้านล่าง
          </span>
        </Field>
        <Field label="ที่มา / วัตถุประสงค์ที่ขอทดสอบ" className="sm:col-span-2">
          <textarea
            name="purpose"
            rows={2}
            className="input"
            placeholder="เช่น เปลี่ยนซัพพลายเออร์เลนส์ ต้องยืนยันว่าค่าความสว่างยังผ่านมาตรฐานเดิม"
          />
        </Field>
        <Field label="หมายเหตุใบรีเควส" className="sm:col-span-2">
          <input type="text" name="request_remark" className="input" />
        </Field>
      </FieldGroup>

      <details className="rounded-lg bg-surface-soft border border-hairline p-4">
        <summary className="cursor-pointer select-none text-[14px] font-medium text-ink">
          เพิ่มรายการทดสอบรายการแรก (ไม่บังคับ)
        </summary>
        <div className="mt-4 flex flex-col gap-5">
        <p className="text-[13px] text-muted">
          <span className="chip bg-ink text-white mr-2">รายการที่ 1</span>
          1 ใบรีเควสมีได้หลายรายการทดสอบ — จะกรอกตอนนี้ หรือให้ทีมแลปช่วยแตกรายการให้ทีหลังก็ได้
        </p>

        <FieldGroup title="ชิ้นงานที่ทดสอบ" nested>
          <Field label="ชื่อการทดสอบ (item test name)" className="sm:col-span-2">
            <input type="text" name="test_name" placeholder="เช่น Photometric Test (KST)" className="input" />
          </Field>
          {/* ไม่ใส่ required ที่นี่ เพราะทั้งส่วนนี้เป็นตัวเลือก — server ตรวจให้เมื่อเริ่มกรอกแล้วเท่านั้น */}
          <Field label="ชื่อชิ้นงาน / รุ่น Lamp" className="sm:col-span-2">
            <input type="text" name="part_name" className="input" />
          </Field>
          <Field label="Part No.">
            <input type="text" name="part_no" className="input" />
          </Field>
          <Field label="จำนวนพาร์ท">
            <input type="number" name="qty" min={0} className="input" />
          </Field>
          <Field label="รายละเอียดเทส / มาตรฐานอ้างอิง" className="sm:col-span-2">
            <textarea name="test_detail" rows={3} className="input" />
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
              ผู้รับผิดชอบ + วันที่แผนทดสอบ ทีมแลปจะเป็นคนวางแผนให้หลังรับงาน
            </p>
          </FieldGroup>
        )}
        </div>
      </details>

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={pending} className="btn-primary w-fit">
          {pending ? "กำลังบันทึก..." : "บันทึกใบรีเควส"}
        </button>
        <span className="text-[12px] text-muted">
          ระบบจะออกเลขใบให้อัตโนมัติ · เพิ่มรายการทดสอบภายหลังได้ในหน้าใบรีเควส
        </span>
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
