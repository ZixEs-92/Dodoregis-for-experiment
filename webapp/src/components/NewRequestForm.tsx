"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useActionState } from "react";
import { createRequest, ActionResult } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";
import Icon from "@/components/ui/Icon";

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

type PartRow = { name: string; partNo: string; qty: string };
type ItemRow = {
  testName: string;
  testDetail: string;
  partIdx: number[];
  remark: string;
  planStart: string;
  planEnd: string;
  ownerId: string;
};

const emptyPart = (): PartRow => ({ name: "", partNo: "", qty: "" });
const emptyItem = (): ItemRow => ({
  testName: "",
  testDetail: "",
  partIdx: [],
  remark: "",
  planStart: "",
  planEnd: "",
  ownerId: "",
});

const initialState: ActionResult = { ok: true, errors: [] };

/**
 * ฟอร์มลงใบรีเควส
 * โครงสร้าง: ใบรีเควส → ชิ้นงาน/รุ่น Lamp (เพิ่มได้หลายรุ่น) → รายการทดสอบ (เพิ่มได้หลายรายการ)
 * แต่ละรายการทดสอบติ๊กเลือกว่าจะทดสอบรุ่นไหนบ้าง
 */
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
  const [state, formAction, pending] = useActionState(createRequest, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const [parts, setParts] = useState<PartRow[]>([emptyPart()]);
  const [items, setItems] = useState<ItemRow[]>([]);

  const storedDraft = useSyncExternalStore(subscribeDraft, readDraft, () => null);
  const draftFound = storedDraft !== null && !dismissed;

  // ── ชิ้นงาน ──
  const setPart = (i: number, patch: Partial<PartRow>) =>
    setParts((rows) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const addPart = () => setParts((rows) => [...rows, emptyPart()]);
  const removePart = (i: number) => {
    setParts((rows) => (rows.length === 1 ? rows : rows.filter((_, n) => n !== i)));
    // เอาชิ้นงานที่ถูกลบออกจากรายการทดสอบ แล้วเลื่อน index ที่อยู่หลังมันลง 1
    setItems((rows) =>
      rows.map((r) => ({
        ...r,
        partIdx: r.partIdx.filter((p) => p !== i).map((p) => (p > i ? p - 1 : p)),
      })),
    );
  };

  // ── รายการทดสอบ ──
  const setItem = (i: number, patch: Partial<ItemRow>) =>
    setItems((rows) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const addItem = () => setItems((rows) => [...rows, emptyItem()]);
  const removeItem = (i: number) => setItems((rows) => rows.filter((_, n) => n !== i));
  const togglePartOnItem = (itemIndex: number, partIndex: number) =>
    setItems((rows) =>
      rows.map((r, n) =>
        n === itemIndex
          ? {
              ...r,
              partIdx: r.partIdx.includes(partIndex)
                ? r.partIdx.filter((p) => p !== partIndex)
                : [...r.partIdx, partIndex].sort((a, b) => a - b),
            }
          : r,
      ),
    );

  // ── ร่าง ──
  function saveDraft() {
    const form = formRef.current;
    if (!form) return;
    const data: Record<string, string> = {};
    for (const [k, v] of new FormData(form).entries()) {
      if (typeof v === "string" && v.trim()) data[k] = v;
    }
    data.parts_json = JSON.stringify(parts);
    data.items_json = JSON.stringify(items);
    if (Object.keys(data).length > 0) writeDraft(JSON.stringify(data));
  }

  function restoreDraft() {
    const form = formRef.current;
    if (!storedDraft || !form) return;
    try {
      const data = JSON.parse(storedDraft) as Record<string, string>;
      for (const [k, v] of Object.entries(data)) {
        if (k === "parts_json" || k === "items_json") continue;
        const field = form.elements.namedItem(k);
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement
        ) {
          field.value = v;
        }
      }
      if (data.parts_json) {
        const p = JSON.parse(data.parts_json) as PartRow[];
        if (Array.isArray(p) && p.length > 0) setParts(p);
      }
      if (data.items_json) {
        const i = JSON.parse(data.items_json) as ItemRow[];
        if (Array.isArray(i)) setItems(i);
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

  const namedParts = parts.filter((p) => p.name.trim());

  return (
    <form
      ref={formRef}
      action={(fd) => {
        writeDraft(null);
        return formAction(fd);
      }}
      onBlur={saveDraft}
      className="card p-5 flex flex-col gap-5 sm:p-6"
    >
      {/* ส่งโครงสร้างซ้อนเป็น JSON — server อ่านแล้วสร้างชิ้นงาน + รายการทดสอบให้ */}
      <input type="hidden" name="parts_json" value={JSON.stringify(parts)} readOnly />
      <input type="hidden" name="items_json" value={JSON.stringify(items)} readOnly />

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

      <FieldGroup title="งานที่ขอทดสอบ">
        <Field label="Test object — ส่งอะไรมาทดสอบ" required className="sm:col-span-2">
          <input
            type="text"
            name="test_object"
            required
            className="input"
            placeholder="เช่น ไฟหน้า P703 ตัวอย่างจากล็อตผลิตแรก"
          />
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

      {/* ── ชิ้นงาน / รุ่น Lamp (หลายรุ่นได้) ── */}
      <section className="flex flex-col gap-3 pb-5 border-b border-hairline">
        <div>
          <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide">
            ชิ้นงาน / รุ่น Lamp ที่ส่งมา <span className="text-coral">*</span>
          </h2>
          <p className="text-[12px] text-muted mt-0.5">
            ใส่ได้หลายรุ่น — เดี๋ยวรายการทดสอบด้านล่างจะให้เลือกว่าทดสอบรุ่นไหนบ้าง
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {parts.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-lg border border-hairline p-3 sm:grid-cols-[1fr_10rem_6rem_auto] sm:items-end"
            >
              <label className="flex flex-col gap-1">
                <span className="label-text">ชื่อชิ้นงาน / รุ่น Lamp</span>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => setPart(i, { name: e.target.value })}
                  className="input"
                  placeholder="เช่น P703 LED HL HG"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label-text">Part No.</span>
                <input
                  type="text"
                  value={p.partNo}
                  onChange={(e) => setPart(i, { partNo: e.target.value })}
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label-text">จำนวน</span>
                <input
                  type="number"
                  min={0}
                  value={p.qty}
                  onChange={(e) => setPart(i, { qty: e.target.value })}
                  className="input"
                />
              </label>
              <button
                type="button"
                onClick={() => removePart(i)}
                disabled={parts.length === 1}
                aria-label={`ลบชิ้นงานรายการที่ ${i + 1}`}
                className="btn-secondary btn-sm text-coral disabled:opacity-30"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={addPart} className="btn-secondary btn-sm w-fit">
          <Icon name="plus" size={16} />
          เพิ่มรุ่น Lamp
        </button>
      </section>

      {/* ── รายการทดสอบ (หลายรายการได้) ── */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide">
            รายการทดสอบ (ไม่บังคับ)
          </h2>
          <p className="text-[12px] text-muted mt-0.5">
            1 รายการ = 1 หัวข้อทดสอบ ที่มีแผน/สถานะ/รีพอร์ทของตัวเอง —
            จะกรอกตอนนี้ หรือให้ทีมแลปช่วยแตกรายการให้ทีหลังก็ได้
          </p>
        </div>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-hairline px-3 py-4 text-center text-[13px] text-muted">
            ยังไม่มีรายการทดสอบ — บันทึกใบไว้ก่อนได้ แล้วค่อยเพิ่มภายหลัง
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((it, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-soft p-3">
                <div className="flex items-center gap-2">
                  <span className="chip bg-ink text-white">รายการที่ {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="ml-auto text-[12px] text-coral hover:underline"
                  >
                    ลบรายการนี้
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="label-text">ชื่อการทดสอบ</span>
                    <input
                      type="text"
                      value={it.testName}
                      onChange={(e) => setItem(i, { testName: e.target.value })}
                      className="input"
                      placeholder="เช่น Photometric Test (KST)"
                    />
                  </label>

                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="label-text">
                      รายละเอียดเทส / มาตรฐานอ้างอิง <span className="text-coral">*</span>
                    </span>
                    <textarea
                      value={it.testDetail}
                      onChange={(e) => setItem(i, { testDetail: e.target.value })}
                      rows={3}
                      className="input"
                    />
                  </label>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="label-text">
                      ทดสอบชิ้นงานรุ่นไหนบ้าง <span className="text-coral">*</span>
                    </span>
                    {namedParts.length === 0 ? (
                      <p className="text-[12px] text-mustard-deep">
                        กรอกชื่อชิ้นงาน/รุ่น Lamp ด้านบนก่อน แล้วจะเลือกได้ที่นี่
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {parts.map((p, pi) =>
                          p.name.trim() ? (
                            <label
                              key={pi}
                              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors ${
                                it.partIdx.includes(pi)
                                  ? "border-ink bg-ink text-white"
                                  : "border-hairline bg-canvas text-body hover:bg-surface-soft"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={it.partIdx.includes(pi)}
                                onChange={() => togglePartOnItem(i, pi)}
                                className="sr-only"
                              />
                              {it.partIdx.includes(pi) && <Icon name="check" size={14} />}
                              {p.name}
                              {p.partNo && (
                                <span className={it.partIdx.includes(pi) ? "text-white/70" : "text-muted"}>
                                  ({p.partNo})
                                </span>
                              )}
                            </label>
                          ) : null,
                        )}
                      </div>
                    )}
                  </div>

                  {showPlanning && (
                    <>
                      <label className="flex flex-col gap-1">
                        <span className="label-text">Plan เริ่มเทส</span>
                        <input
                          type="date"
                          value={it.planStart}
                          onChange={(e) => setItem(i, { planStart: e.target.value })}
                          className="input"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="label-text">Plan จบ</span>
                        <input
                          type="date"
                          value={it.planEnd}
                          onChange={(e) => setItem(i, { planEnd: e.target.value })}
                          className="input"
                        />
                      </label>
                      <label className="flex flex-col gap-1 sm:col-span-2">
                        <span className="label-text">ผู้รับผิดชอบหลัก</span>
                        <select
                          value={it.ownerId}
                          onChange={(e) => setItem(i, { ownerId: e.target.value })}
                          className="input"
                        >
                          <option value="">- ยังไม่มอบหมาย (วางแผนภายหลัง) -</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}

                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="label-text">Remark ของรายการนี้</span>
                    <textarea
                      value={it.remark}
                      onChange={(e) => setItem(i, { remark: e.target.value })}
                      rows={2}
                      placeholder='พิมพ์ "make รีพอร์ตเลย" หากเป็นงานด่วน'
                      className="input"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={addItem} className="btn-secondary btn-sm w-fit">
          <Icon name="plus" size={16} />
          เพิ่มรายการทดสอบ
        </button>

        {!showPlanning && items.length > 0 && (
          <p className="text-[12px] text-muted">
            ผู้รับผิดชอบ + วันที่แผนทดสอบ ทีมแลปจะเป็นคนวางแผนให้หลังรับงาน
          </p>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={pending} className="btn-primary w-fit">
          {pending ? "กำลังบันทึก..." : "บันทึกใบรีเควส"}
        </button>
        <span className="text-[12px] text-muted">
          ระบบจะออกเลขใบให้อัตโนมัติ · เพิ่มชิ้นงานและรายการทดสอบภายหลังได้ในหน้าใบรีเควส
        </span>
      </div>
    </form>
  );
}

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-5 border-b border-hairline">
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
