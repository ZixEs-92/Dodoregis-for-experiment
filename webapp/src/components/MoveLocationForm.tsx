"use client";

import { useActionState, useState } from "react";
import { ActionResult } from "@/app/actions";
import { FormErrors, FormSaved } from "@/components/FormMessages";

type Option = { id: number; name: string };

const initial: ActionResult = { ok: true, errors: [] };

export default function MoveLocationForm({
  action,
  partLocations,
  finishedLocations,
  currentPart,
  currentFinished,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  partLocations: Option[];
  finishedLocations: Option[];
  currentPart: string | null;
  currentFinished: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [kind, setKind] = useState<"PART_LOCATION" | "FINISHED_LOCATION">("PART_LOCATION");

  const options = kind === "PART_LOCATION" ? partLocations : finishedLocations;
  const currentName = kind === "PART_LOCATION" ? currentPart : currentFinished;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormErrors errors={state.errors} />
      {state.ok && state.saved && <FormSaved show />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="label-text">ประเภทที่เก็บ</span>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "PART_LOCATION" | "FINISHED_LOCATION")}
            className="input"
          >
            <option value="PART_LOCATION">ที่เก็บพาร์ท (ระหว่างเทส)</option>
            <option value="FINISHED_LOCATION">ที่เก็บชิ้นงานเสร็จ</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="label-text">
            ย้ายไปที่ <span className="text-muted">(ปัจจุบัน: {currentName ?? "ยังไม่ระบุ"})</span>
          </span>
          <select name="location" defaultValue="" className="input" required>
            <option value="">เลือกที่เก็บปลายทาง</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="label-text">หมายเหตุ (ใครย้าย / เหตุผล)</span>
        <input type="text" name="note" className="input" placeholder="เช่น ย้ายเข้าห้องเทส 2 โดย... " />
      </label>

      <div>
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? "กำลังบันทึก..." : "บันทึกการย้ายที่เก็บ"}
        </button>
      </div>
    </form>
  );
}
