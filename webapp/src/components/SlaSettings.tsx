"use client";

import { useState, useTransition } from "react";
import { setDepartmentSla } from "@/app/actions";

type DeptRow = { id: number; name: string; slaDays: number | null };

export default function SlaSettings({ departments }: { departments: DeptRow[] }) {
  return (
    <section className="card p-5">
      <h2 className="text-[15px] font-medium text-ink mb-1">เป้า SLA / TAT ต่อแผนก</h2>
      <p className="text-[12px] text-muted mb-4">
        เป้าจำนวนวันตั้งแต่รับใบรีเควสถึงส่งรีพอร์ท (ใช้วัด on-time ใน dashboard) · เว้นว่าง = ไม่ตั้งเป้า
      </p>
      <ul className="flex flex-col divide-y divide-hairline">
        {departments.map((d) => (
          <SlaRow key={d.id} dept={d} />
        ))}
        {departments.length === 0 && (
          <li className="py-3 text-[13px] text-muted">ยังไม่มีแผนก</li>
        )}
      </ul>
    </section>
  );
}

function SlaRow({ dept }: { dept: DeptRow }) {
  const [value, setValue] = useState(dept.slaDays != null ? String(dept.slaDays) : "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    const fd = new FormData();
    fd.set("sla_days", value);
    startTransition(async () => {
      await setDepartmentSla(dept.id, fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <li className="py-2.5 flex items-center gap-3">
      <span className="flex-1 min-w-0 text-[14px] text-ink truncate">{dept.name}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="—"
        className="input w-24 h-9 text-center"
      />
      <span className="text-[13px] text-muted w-8">วัน</span>
      <button onClick={save} disabled={pending} className="btn-secondary btn-sm">
        {pending ? "..." : saved ? "✓" : "บันทึก"}
      </button>
    </li>
  );
}
