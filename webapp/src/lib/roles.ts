// สิทธิ์/บทบาทผู้ใช้ — ไฟล์นี้ปลอดภัยสำหรับ import ทั้งฝั่ง server และ client
// (ไม่ import โมดูล server-only เช่น next/headers, prisma) — type-only import ถูก erase ตอน build
import type { UserRole } from "@/generated/prisma/client";

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  ENGINEER: "วิศวกรทดสอบ",
  REQUESTER: "ผู้ขอทดสอบ",
  VIEWER: "ผู้ดูข้อมูล",
};

export const ALL_ROLES: UserRole[] = ["ADMIN", "ENGINEER", "REQUESTER", "VIEWER"];

/** มีสิทธิ์ระดับใดระดับหนึ่งใน roles ที่กำหนดหรือไม่ */
export function hasRole(role: UserRole | undefined | null, ...roles: UserRole[]): boolean {
  return role != null && roles.includes(role);
}

// ── ตัวช่วยเช็คสิทธิ์เชิงความหมาย (ใช้จริงเต็มรูปแบบใน Phase 3b) ──

/** ปรับสถานะงาน / ลงผลเทส / รีพอร์ท — engineer ขึ้นไป */
export function canEditTests(role: UserRole | null | undefined): boolean {
  return hasRole(role, "ADMIN", "ENGINEER");
}

/** ลงทะเบียนงานใหม่ — requester ขึ้นไป */
export function canCreateRequest(role: UserRole | null | undefined): boolean {
  return hasRole(role, "ADMIN", "ENGINEER", "REQUESTER");
}

/** วางแผน (ลงวันที่ + มอบหมายผู้รับผิดชอบ) และจัดการระบบ — admin เท่านั้น */
export function canPlanAndManage(role: UserRole | null | undefined): boolean {
  return hasRole(role, "ADMIN");
}

/**
 * ผู้ขอทดสอบเห็นได้เฉพาะงานแผนกตัวเอง — role อื่น (admin/engineer/viewer) เห็นทั้งหมด
 * ใช้ตัดสินใจว่าจะใส่ตัวกรอง requestDeptId ลงใน query หรือไม่
 */
export function isDeptScoped(
  role: UserRole | null | undefined,
  userDeptId: number | null | undefined,
): boolean {
  return role === "REQUESTER" && userDeptId != null;
}

/** เปิดดูใบรีเควส/รายการทดสอบใบนี้ได้ไหม (ใช้กับหน้ารายละเอียดที่เข้าตรงด้วย URL/QR) */
export function canViewRequest(
  role: UserRole | null | undefined,
  userDeptId: number | null | undefined,
  requestDeptId: number,
): boolean {
  return !isDeptScoped(role, userDeptId) || userDeptId === requestDeptId;
}

/**
 * แนบไฟล์เข้าใบรีเควส — ทีมแลปแนบได้ทุกใบ, ผู้ขอทดสอบแนบได้เฉพาะใบของแผนกตัวเอง
 * (เขาเป็นคนถืออีเมลต้นเรื่อง/ใบรีเควสตัวจริง/รูปชิ้นงาน) · ฝั่ง server บังคับซ้ำที่ assertCanEditRequest
 */
export function canAttachToRequest(
  role: UserRole | null | undefined,
  userDeptId: number | null | undefined,
  requestDeptId: number,
): boolean {
  if (canEditTests(role)) return true;
  return role === "REQUESTER" && userDeptId != null && userDeptId === requestDeptId;
}
