"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createUserAccount,
  resetUserPassword,
  setUserActive,
  setUserHeadDepartments,
  type UserActionResult,
} from "@/app/settings/users/actions";
import { FormErrors, FormSaved } from "@/components/FormMessages";
import { useConfirm, useToast, useToastOnSaved } from "@/components/ui/Feedback";
import { ROLE_LABEL, ALL_ROLES } from "@/lib/roles";
import type { UserRole } from "@/generated/prisma/client";

type Option = { id: number; name: string };

export type UserRow = {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  departmentName: string | null;
  memberName: string | null;
  headDepartments: Option[]; // เฉพาะ role DEPT_HEAD — แผนกที่คุม (คุมได้หลายแผนก)
  lastLoginAt: string | null; // แสดงผลแล้ว (formatted) หรือ null
};

const initial: UserActionResult = { ok: true, errors: [] };

const ROLE_HINT: Record<UserRole, string> = {
  ADMIN: "แก้ได้ทั้งหมด รวมวางแผน/มอบหมาย/จัดการระบบ",
  LAB_HEAD: "เท่าวิศวกร + อนุมัติชั้น 2 + วางแผน/มอบหมายงาน (ไม่ยุ่ง master/ผู้ใช้)",
  ENGINEER: "ปรับสถานะงาน + ลงผลเทส/รีพอร์ท",
  DEPT_HEAD: "อนุมัติชั้น 1 + เห็นเฉพาะแผนกที่คุม (เลือกแผนกด้านล่าง)",
  REQUESTER: "ลงทะเบียนงานของแผนกตัวเอง (admin วางแผนให้)",
  VIEWER: "ดูอย่างเดียว (ปกติไม่ต้องมีบัญชี — เปิดดูได้เลย)",
};

export default function UsersManager({
  users,
  departments,
  members,
  currentUserId,
}: {
  users: UserRow[];
  departments: Option[];
  members: Option[];
  currentUserId: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <CreateUserCard departments={departments} members={members} />
      <section className="card p-5 sm:p-6">
        <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide pb-3 border-b border-hairline">
          ผู้ใช้ทั้งหมด ({users.length})
        </h2>
        {users.length === 0 ? (
          <p className="text-[13px] text-muted mt-4">
            ยังไม่มีบัญชีผู้ใช้ — สร้างบัญชีแรกด้านบน
          </p>
        ) : (
          <ul className="flex flex-col gap-2 mt-4">
            {users.map((u) => (
              <UserRowItem
                key={u.id}
                user={u}
                isSelf={u.id === currentUserId}
                departments={departments}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateUserCard({ departments, members }: { departments: Option[]; members: Option[] }) {
  const [state, formAction, pending] = useActionState(createUserAccount, initial);
  const [role, setRole] = useState<UserRole>("ENGINEER");
  useToastOnSaved(state, "สร้างบัญชีผู้ใช้แล้ว");

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide pb-3 border-b border-hairline">
        เพิ่มผู้ใช้ใหม่
      </h2>
      <form action={formAction} className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormErrors errors={state.errors} />
          <FormSaved show={state.ok && state.saved === true} />
        </div>

        <Field label="Username" required>
          <input name="username" required className="input" autoCapitalize="none" placeholder="เช่น somchai.j" />
        </Field>
        <Field label="รหัสผ่าน (อย่างน้อย 6 ตัว)" required>
          <input name="password" type="text" required minLength={6} className="input" placeholder="ตั้งรหัสเริ่มต้นให้ผู้ใช้" />
        </Field>
        <Field label="ชื่อที่แสดง" required>
          <input name="display_name" required className="input" placeholder="เช่น สมชาย ใจดี" />
        </Field>
        <Field label="บทบาท (role)" required>
          <select
            name="role"
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <span className="text-[11px] text-muted">{ROLE_HINT[role]}</span>
        </Field>

        {role === "REQUESTER" && (
          <Field label="แผนก (requester เห็นเฉพาะงานแผนกนี้)" required>
            <select name="department" required className="input" defaultValue="">
              <option value="">เลือกแผนก</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
        )}
        {role === "DEPT_HEAD" && (
          <div className="sm:col-span-2">
            <span className="label-text">แผนกที่คุม (เลือกได้หลายแผนก) *</span>
            {departments.length === 0 ? (
              <p className="text-[12px] text-muted mt-1">ยังไม่มีแผนกในระบบ — เพิ่มที่หน้าข้อมูลระบบก่อน</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {departments.map((d) => (
                  <label
                    key={d.id}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline px-3 text-[13px] text-body transition-colors hover:bg-surface-soft has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
                  >
                    <input type="checkbox" name="department_ids" value={d.id} className="sr-only" />
                    {d.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {(role === "ENGINEER" || role === "LAB_HEAD") && (
          <Field label="ผูกกับรายชื่อทีม (สำหรับ workload/มอบหมาย)">
            <select name="member" className="input" defaultValue="">
              <option value="">- ไม่ผูก -</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
        )}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="btn-primary btn-sm">
            {pending ? "กำลังสร้าง..." : "สร้างบัญชี"}
          </button>
        </div>
      </form>
    </section>
  );
}

function UserRowItem({
  user,
  isSelf,
  departments,
}: {
  user: UserRow;
  isSelf: boolean;
  departments: Option[];
}) {
  const [showReset, setShowReset] = useState(false);
  const [showDepts, setShowDepts] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState(
    resetUserPassword.bind(null, user.id),
    initial,
  );
  const [toggling, startToggle] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [savingDepts, startSaveDepts] = useTransition();
  const [deptError, setDeptError] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  useToastOnSaved(resetState, `ตั้งรหัสผ่านใหม่ให้ ${user.displayName} แล้ว`);

  async function onSaveDepts(fd: FormData) {
    setDeptError(null);
    const departmentIds = fd.getAll("department_ids").map(Number);
    if (departmentIds.length === 0) {
      setDeptError("ต้องเลือกอย่างน้อย 1 แผนก");
      return;
    }
    startSaveDepts(async () => {
      const r = await setUserHeadDepartments(user.id, departmentIds);
      if (!r.ok) setDeptError(r.errors[0] ?? "เกิดข้อผิดพลาด");
      else {
        toast(`ปรับแผนกที่คุมของ ${user.displayName} แล้ว`, "success");
        setShowDepts(false);
      }
    });
  }

  async function onToggle() {
    setToggleError(null);
    if (user.active) {
      const ok = await confirm({
        title: `ปิดการใช้งานบัญชี ${user.displayName} ?`,
        detail: "ผู้ใช้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง ข้อมูลงานเดิมไม่หาย",
        confirmLabel: "ปิดการใช้งาน",
        danger: true,
      });
      if (!ok) return;
    }
    startToggle(async () => {
      const r = await setUserActive(user.id, !user.active);
      if (!r.ok) setToggleError(r.errors[0] ?? "เกิดข้อผิดพลาด");
      else toast(user.active ? "ปิดการใช้งานบัญชีแล้ว" : "เปิดใช้งานบัญชีแล้ว", "success");
    });
  }

  return (
    <li className={`rounded-lg border border-hairline p-3 ${user.active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="grid place-items-center w-9 h-9 rounded-full bg-surface-strong text-ink text-[13px] font-medium shrink-0">
          {user.displayName.slice(0, 1)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-medium text-ink">{user.displayName}</span>
            <span className="chip bg-surface-strong text-ink">{ROLE_LABEL[user.role]}</span>
            {isSelf && <span className="chip bg-info-soft text-info">บัญชีคุณ</span>}
            {!user.active && <span className="chip bg-coral-soft text-coral">ปิดใช้งาน</span>}
          </div>
          <div className="text-[12px] text-muted mt-0.5">
            @{user.username}
            {user.departmentName && ` · แผนก ${user.departmentName}`}
            {user.memberName && ` · ทีม ${user.memberName}`}
            {user.role === "DEPT_HEAD" &&
              (user.headDepartments.length > 0
                ? ` · คุมแผนก ${user.headDepartments.map((d) => d.name).join(", ")}`
                : " · ยังไม่ได้กำหนดแผนกที่คุม")}
            {user.lastLoginAt ? ` · เข้าใช้ล่าสุด ${user.lastLoginAt}` : " · ยังไม่เคยเข้าใช้"}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user.role === "DEPT_HEAD" && (
            <button
              type="button"
              onClick={() => setShowDepts((s) => !s)}
              className="text-[12px] text-link hover:underline"
            >
              {showDepts ? "ยกเลิก" : "แก้แผนกที่คุม"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowReset((s) => !s)}
            className="text-[12px] text-link hover:underline"
          >
            {showReset ? "ยกเลิก" : "ตั้งรหัสใหม่"}
          </button>
          {!isSelf && (
            <button
              type="button"
              onClick={onToggle}
              disabled={toggling}
              className={`text-[12px] hover:underline disabled:opacity-50 ${user.active ? "text-coral" : "text-forest"}`}
            >
              {user.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          )}
        </div>
      </div>

      {toggleError && <p className="text-[12px] text-coral mt-2">{toggleError}</p>}

      {showDepts && (
        <form
          action={onSaveDepts}
          className="mt-3 flex flex-col gap-2 rounded-lg border border-hairline p-3"
        >
          <span className="label-text">แผนกที่คุม (เลือกได้หลายแผนก)</span>
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <label
                key={d.id}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline px-3 text-[13px] text-body transition-colors hover:bg-surface-soft has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
              >
                <input
                  type="checkbox"
                  name="department_ids"
                  value={d.id}
                  defaultChecked={user.headDepartments.some((h) => h.id === d.id)}
                  className="sr-only"
                />
                {d.name}
              </label>
            ))}
          </div>
          {deptError && <p className="text-[12px] text-coral">{deptError}</p>}
          <button type="submit" disabled={savingDepts} className="btn-secondary btn-sm w-fit">
            {savingDepts ? "กำลังบันทึก..." : "บันทึกแผนกที่คุม"}
          </button>
        </form>
      )}

      {showReset && (
        <form action={resetAction} className="flex gap-2 mt-3 items-start flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <input
              name="password"
              type="text"
              required
              minLength={6}
              className="input"
              placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
            />
            <FormErrors errors={resetState.errors} />
            <FormSaved show={resetState.ok && resetState.saved === true} />
          </div>
          <button type="submit" disabled={resetPending} className="btn-secondary btn-sm shrink-0">
            {resetPending ? "กำลังบันทึก..." : "บันทึกรหัสใหม่"}
          </button>
        </form>
      )}
    </li>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-text">
        {label}
        {required && <span className="text-coral"> *</span>}
      </span>
      {children}
    </label>
  );
}
