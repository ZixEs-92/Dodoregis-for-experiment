"use client";

import { useActionState, useState, useTransition } from "react";
import {
  ActionResult,
  addMaster,
  renameMaster,
  toggleMasterActive,
} from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";

type MasterKind = "department" | "member" | "partLocation" | "finishedLocation";
type Row = { id: number; name: string; role?: string | null; active: boolean; inUse?: boolean };

const initial: ActionResult = { ok: true, errors: [] };

export default function MasterSection({
  kind,
  title,
  rows,
  withRole,
}: {
  kind: MasterKind;
  title: string;
  rows: Row[];
  withRole?: boolean;
}) {
  const addBound = addMaster.bind(null, kind);
  const [state, formAction, pending] = useActionState(addBound, initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function save(id: number, name: string, role: string) {
    const fd = new FormData();
    fd.set("name", name);
    if (withRole) fd.set("role", role);
    startTransition(async () => {
      await renameMaster(kind, id, fd);
      setEditingId(null);
    });
  }

  function toggle(id: number, active: boolean) {
    startTransition(async () => {
      await toggleMasterActive(kind, id, active);
    });
  }

  return (
    <section className="card p-5">
      <h2 className="text-[15px] font-medium text-ink mb-4">{title}</h2>

      <ul className="flex flex-col divide-y divide-hairline mb-4">
        {rows.map((r) => (
          <MasterRow
            key={r.id}
            row={r}
            withRole={withRole}
            editing={editingId === r.id}
            onEdit={() => setEditingId(r.id)}
            onCancel={() => setEditingId(null)}
            onSave={save}
            onToggle={toggle}
          />
        ))}
        {rows.length === 0 && <li className="py-3 text-[13px] text-muted">ยังไม่มีข้อมูล</li>}
      </ul>

      <form action={formAction} className="flex flex-col gap-2 pt-4 border-t border-hairline">
        <FormErrors errors={state.errors} />
        <div className="flex flex-wrap gap-2">
          <input type="text" name="name" placeholder="ชื่อใหม่" className="input flex-1 min-w-[140px]" />
          {withRole && (
            <input type="text" name="role" placeholder="ตำแหน่ง (เช่น Tester)" className="input flex-1 min-w-[140px]" />
          )}
          <button type="submit" disabled={pending} className="btn-primary btn-sm">
            + เพิ่ม
          </button>
        </div>
      </form>
    </section>
  );
}

function MasterRow({
  row,
  withRole,
  editing,
  onEdit,
  onCancel,
  onSave,
  onToggle,
}: {
  row: Row;
  withRole?: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (id: number, name: string, role: string) => void;
  onToggle: (id: number, active: boolean) => void;
}) {
  const [name, setName] = useState(row.name);
  const [role, setRole] = useState(row.role ?? "");

  if (editing) {
    return (
      <li className="py-2.5 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input flex-1 min-w-[120px]" />
        {withRole && (
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="ตำแหน่ง" className="input flex-1 min-w-[120px]" />
        )}
        <button onClick={() => onSave(row.id, name, role)} className="btn-primary btn-sm">บันทึก</button>
        <button onClick={onCancel} className="btn-secondary btn-sm">ยกเลิก</button>
      </li>
    );
  }

  return (
    <li className="py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <span className={`text-[14px] ${row.active ? "text-ink" : "text-muted line-through"}`}>{row.name}</span>
        {row.role && <span className="text-[12px] text-muted ml-2">{row.role}</span>}
        {!row.active && <span className="chip bg-surface-strong text-muted ml-2">ปิดใช้งาน</span>}
      </div>
      <button onClick={onEdit} className="text-[13px] text-link hover:underline">แก้ชื่อ</button>
      <button
        onClick={() => onToggle(row.id, !row.active)}
        className={`text-[13px] hover:underline ${row.active ? "text-coral" : "text-forest"}`}
      >
        {row.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
      </button>
    </li>
  );
}
