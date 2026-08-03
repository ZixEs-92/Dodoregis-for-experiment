// สิทธิ์/บทบาทผู้ใช้ — ไฟล์นี้ปลอดภัยสำหรับ import ทั้งฝั่ง server และ client
// (ไม่ import โมดูล server-only เช่น next/headers, prisma) — type-only import ถูก erase ตอน build
import type { UserRole } from "@/generated/prisma/client";

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  LAB_HEAD: "หัวหน้าแผนกทดสอบ",
  ENGINEER: "วิศวกรทดสอบ",
  DEPT_HEAD: "หัวหน้าแผนก",
  REQUESTER: "ผู้ขอทดสอบ",
  VIEWER: "ผู้ดูข้อมูล",
};

export const ALL_ROLES: UserRole[] = [
  "ADMIN",
  "LAB_HEAD",
  "ENGINEER",
  "DEPT_HEAD",
  "REQUESTER",
  "VIEWER",
];

/** มีสิทธิ์ระดับใดระดับหนึ่งใน roles ที่กำหนดหรือไม่ */
export function hasRole(role: UserRole | undefined | null, ...roles: UserRole[]): boolean {
  return role != null && roles.includes(role);
}

/**
 * ข้อมูลขั้นต่ำที่ต้องใช้ตัดสินสิทธิ์เชิงแผนก — ให้ client component ส่งมาได้โดยไม่ต้องลาก User ทั้งก้อน
 * headOfDepartmentIds ว่างได้ถ้าไม่ใช่ DEPT_HEAD (ไม่ใช้)
 */
export type Scope = {
  role: UserRole | null | undefined;
  departmentId: number | null | undefined;
  headOfDepartmentIds: number[];
};

// ── สิทธิ์เชิงความหมาย ──────────────────────────────────────

/** แก้สถานะงาน / ลงผลเทส / รีพอร์ท */
export function canEditTests(role: UserRole | null | undefined): boolean {
  return hasRole(role, "ADMIN", "LAB_HEAD", "ENGINEER");
}

/**
 * ทีมแลป: เข้า analytics / reports / labels / api-export ได้ (เห็นทุกแผนก)
 * วันนี้สมาชิกเท่ากับ canEditTests พอดี — แยกชื่อไว้เพราะเป็นคนละคำถาม
 * (ถ้าวันหลังมี role ที่ "ดูรายงานได้แต่แก้ผลเทสไม่ได้" จะแก้ที่นี่ที่เดียว)
 */
export function canViewLabWide(role: UserRole | null | undefined): boolean {
  return hasRole(role, "ADMIN", "LAB_HEAD", "ENGINEER");
}

/** ลงทะเบียนงานใหม่ */
export function canCreateRequest(role: UserRole | null | undefined): boolean {
  return hasRole(role, "ADMIN", "LAB_HEAD", "ENGINEER", "DEPT_HEAD", "REQUESTER");
}

/** วางแผน (มอบหมายผู้รับผิดชอบ + ลงวันที่) */
export function canPlanWork(role: UserRole | null | undefined): boolean {
  return hasRole(role, "ADMIN", "LAB_HEAD");
}

/** จัดการระบบ — master data, ผู้ใช้, ตั้งค่า (LINE ฯลฯ) — admin เท่านั้น */
export function canManageSystem(role: UserRole | null | undefined): boolean {
  return hasRole(role, "ADMIN");
}

/** อนุมัติชั้น 1 (หัวหน้าแผนก) — ต้องคุมแผนกของใบนั้นอยู่ · admin ข้ามได้ (override) */
export function canApproveDept(scope: Scope, requestDeptId: number): boolean {
  if (scope.role === "ADMIN") return true;
  return scope.role === "DEPT_HEAD" && scope.headOfDepartmentIds.includes(requestDeptId);
}

/** อนุมัติชั้น 2 (หัวหน้าแลป) */
export function canApproveLab(role: UserRole | null | undefined): boolean {
  return hasRole(role, "ADMIN", "LAB_HEAD");
}

// ── ขอบเขตแผนก (เห็น/แก้เฉพาะแผนกที่เกี่ยวข้อง) ──────────────

/**
 * แผนกที่ผู้ใช้คนนี้เห็นได้ — null = เห็นทุกแผนก (ทีมแลป/viewer)
 * REQUESTER เห็นแผนกต้นสังกัดแผนกเดียว · DEPT_HEAD เห็นทุกแผนกที่ตัวเองคุม (คุมได้หลายแผนก)
 */
export function visibleDepartmentIds(scope: Scope): number[] | null {
  if (canViewLabWide(scope.role) || scope.role === "VIEWER") return null;
  if (scope.role === "DEPT_HEAD") return scope.headOfDepartmentIds;
  if (scope.role === "REQUESTER") return scope.departmentId != null ? [scope.departmentId] : [];
  return [];
}

/** ใช้ประกอบ where ของ Prisma (เช่น requestDeptId: departmentFilter(scope)) — undefined = ไม่ต้องกรอง */
export function departmentFilter(scope: Scope): { in: number[] } | undefined {
  const ids = visibleDepartmentIds(scope);
  return ids === null ? undefined : { in: ids };
}

/** เปิดดูใบรีเควส/รายการทดสอบใบนี้ได้ไหม (ใช้กับหน้ารายละเอียดที่เข้าตรงด้วย URL/QR) */
export function canViewRequest(scope: Scope, requestDeptId: number): boolean {
  const ids = visibleDepartmentIds(scope);
  return ids === null || ids.includes(requestDeptId);
}

/**
 * แนบไฟล์เข้าใบรีเควส — ทีมแลปแนบได้ทุกใบ, ผู้ขอ/หัวหน้าแผนกแนบได้เฉพาะใบในขอบเขตแผนกตัวเอง
 * (เขาเป็นคนถืออีเมลต้นเรื่อง/ใบรีเควสตัวจริง/รูปชิ้นงาน) · ฝั่ง server บังคับซ้ำที่ assertCanEditRequest
 */
export function canAttachToRequest(scope: Scope, requestDeptId: number): boolean {
  if (canEditTests(scope.role)) return true;
  if (scope.role !== "REQUESTER" && scope.role !== "DEPT_HEAD") return false;
  return canViewRequest(scope, requestDeptId);
}
