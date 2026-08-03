"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, getCurrentUser } from "@/lib/auth";
import { ensureManageSystem } from "@/lib/guard";
import { ALL_ROLES } from "@/lib/roles";
import type { UserRole } from "@/generated/prisma/client";

export type UserActionResult = { ok: boolean; errors: string[]; saved?: boolean };

const VALID_ROLES: UserRole[] = ALL_ROLES;

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** id ที่ติ๊กเลือกไว้ในฟอร์ม (checkbox หลายค่าชื่อเดียวกัน) */
function ids(fd: FormData, key: string): number[] {
  return fd
    .getAll(key)
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** admin สร้างบัญชีผู้ใช้ใหม่ */
export async function createUserAccount(
  _prev: UserActionResult,
  formData: FormData,
): Promise<UserActionResult> {
  const denied = await ensureManageSystem();
  if (denied) return { ok: false, errors: [denied] };

  const username = str(formData, "username");
  const password = str(formData, "password");
  const displayName = str(formData, "display_name");
  const roleRaw = (str(formData, "role") ?? "").toUpperCase();

  const errors: string[] = [];
  if (!username || !/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    errors.push("username ต้องเป็น a-z 0-9 . _ - ยาว 3–32 ตัว");
  }
  if (!password || password.length < 6) errors.push("รหัสผ่านอย่างน้อย 6 ตัวอักษร");
  if (!displayName) errors.push("กรุณากรอกชื่อที่แสดง");
  if (!VALID_ROLES.includes(roleRaw as UserRole)) errors.push("role ไม่ถูกต้อง");
  const role = roleRaw as UserRole;

  const departmentId = num(formData, "department");
  const memberId = num(formData, "member");
  const headDeptIds = ids(formData, "department_ids");
  if (role === "REQUESTER" && !departmentId) {
    errors.push("ผู้ขอทดสอบต้องเลือกแผนก (เห็นเฉพาะงานแผนกตัวเอง)");
  }
  if (role === "DEPT_HEAD" && headDeptIds.length === 0) {
    errors.push("หัวหน้าแผนกต้องเลือกอย่างน้อย 1 แผนกที่คุม");
  }
  if (errors.length > 0) return { ok: false, errors };

  const exists = await prisma.user.findUnique({ where: { username: username! } });
  if (exists) return { ok: false, errors: [`มี username "${username}" อยู่แล้ว`] };

  await prisma.user.create({
    data: {
      username: username!,
      passwordHash: await hashPassword(password!),
      displayName: displayName!,
      role,
      departmentId: role === "REQUESTER" ? departmentId : null,
      memberId: role === "ENGINEER" || role === "LAB_HEAD" ? memberId : null,
      headOfDepartments:
        role === "DEPT_HEAD" ? { connect: headDeptIds.map((id) => ({ id })) } : undefined,
    },
  });

  revalidatePath("/settings/users");
  return { ok: true, errors: [], saved: true };
}

/** admin แก้ชุดแผนกที่ dept_head คนนี้คุม (แทนที่ทั้งชุด) */
export async function setUserHeadDepartments(
  userId: number,
  departmentIds: number[],
): Promise<UserActionResult> {
  const denied = await ensureManageSystem();
  if (denied) return { ok: false, errors: [denied] };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, errors: ["ไม่พบผู้ใช้นี้"] };
  if (user.role !== "DEPT_HEAD") {
    return { ok: false, errors: ["แก้แผนกที่คุมได้เฉพาะบัญชีบทบาทหัวหน้าแผนก"] };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { headOfDepartments: { set: departmentIds.map((id) => ({ id })) } },
  });

  revalidatePath("/settings/users");
  return { ok: true, errors: [], saved: true };
}

/** admin ตั้งรหัสผ่านใหม่ให้ผู้ใช้ */
export async function resetUserPassword(
  userId: number,
  _prev: UserActionResult,
  formData: FormData,
): Promise<UserActionResult> {
  const denied = await ensureManageSystem();
  if (denied) return { ok: false, errors: [denied] };

  const password = str(formData, "password");
  if (!password || password.length < 6) {
    return { ok: false, errors: ["รหัสผ่านอย่างน้อย 6 ตัวอักษร"] };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });

  revalidatePath("/settings/users");
  return { ok: true, errors: [], saved: true };
}

/** เปิด/ปิดการใช้งานบัญชี (ห้ามปิดบัญชีตัวเอง) */
export async function setUserActive(userId: number, active: boolean): Promise<UserActionResult> {
  const denied = await ensureManageSystem();
  if (denied) return { ok: false, errors: [denied] };

  const me = await getCurrentUser();
  if (me && me.id === userId && !active) {
    return { ok: false, errors: ["ปิดการใช้งานบัญชีตัวเองไม่ได้"] };
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/settings/users");
  return { ok: true, errors: [], saved: true };
}
