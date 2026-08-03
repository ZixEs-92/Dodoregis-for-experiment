// สถานะอนุมัติใบรีเควส (Phase 4c) — logic ล้วน client-safe เหมือน lib/workflow.ts
// คนละแกนกับ RequestStatus (1-8) ของ item — ห้ามปนกัน (ดูแผน docs/แผน-flow-อนุมัติใบรีเควส.md ส่วนที่ 4)
import { canApproveDept, canApproveLab, canEditTests, canViewRequest, type Scope } from "@/lib/roles";
import type { ApprovalStatus, UserRole } from "@/generated/prisma/client";

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  PENDING_DEPT: "รออนุมัติ — หัวหน้าแผนก",
  PENDING_LAB: "รออนุมัติ — หัวหน้าแลป",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ถูกตีกลับ",
};

export const APPROVAL_COLOR: Record<ApprovalStatus, string> = {
  PENDING_DEPT: "bg-mustard-soft text-mustard-deep",
  PENDING_LAB: "bg-info-soft text-info",
  APPROVED: "bg-forest-soft text-forest",
  REJECTED: "bg-coral-soft text-coral",
};

/** ชั้นที่สถานะนี้ค้างรออยู่ — null ถ้าไม่ได้ค้างรออนุมัติ (อนุมัติแล้ว/ถูกตีกลับ) */
export function stageOf(status: ApprovalStatus): "DEPT" | "LAB" | null {
  if (status === "PENDING_DEPT") return "DEPT";
  if (status === "PENDING_LAB") return "LAB";
  return null;
}

/**
 * สถานะเริ่มต้นตอนสร้างใบ — ตามข้อ 3.2 ในแผน
 * ADMIN/LAB_HEAD/ENGINEER คีย์เอง (รับใบกระดาษ/อีเมลมา) = อนุมัติอัตโนมัติ
 * DEPT_HEAD ลงใบให้แผนกตัวเอง = ไม่ต้องเซ็นอนุมัติตัวเอง ข้ามไปรอหัวหน้าแลปเลย
 * REQUESTER = รอหัวหน้าแผนกก่อน เว้นแต่ปิดชั้นนี้ไว้ หรือแผนกยังไม่มีหัวหน้า (กันใบค้างไม่มีคนเซ็น)
 */
export function initialApprovalStatus(opts: {
  creatorRole: UserRole;
  deptStageOn: boolean;
  deptHasHead: boolean;
}): ApprovalStatus {
  if (opts.creatorRole !== "REQUESTER" && opts.creatorRole !== "DEPT_HEAD") {
    return "APPROVED";
  }
  if (opts.creatorRole === "DEPT_HEAD") return "PENDING_LAB";
  return opts.deptStageOn && opts.deptHasHead ? "PENDING_DEPT" : "PENDING_LAB";
}

/** สถานะถัดไปเมื่ออนุมัติผ่านชั้นปัจจุบัน (เรียกเฉพาะตอน stageOf(current) ไม่ใช่ null) */
export function nextStatusOnApprove(current: ApprovalStatus): ApprovalStatus {
  if (current === "PENDING_DEPT") return "PENDING_LAB";
  if (current === "PENDING_LAB") return "APPROVED";
  return current;
}

export type ApprovalActions = {
  canApprove: boolean;
  canReject: boolean;
  canResubmit: boolean;
};

/** ปุ่มที่ทำได้ตอนนี้กับใบนี้ — ใช้ทั้งฝั่ง UI (โชว์/ซ่อนปุ่ม) และ server action (เช็คสิทธิ์ซ้ำ) */
export function actionsFor(
  status: ApprovalStatus,
  scope: Scope,
  requestDeptId: number,
): ApprovalActions {
  const stage = stageOf(status);
  const canAct =
    stage === "DEPT"
      ? canApproveDept(scope, requestDeptId)
      : stage === "LAB"
        ? canApproveLab(scope.role)
        : false;
  const canResubmit =
    status === "REJECTED" &&
    (scope.role === "ADMIN" ||
      ((scope.role === "REQUESTER" || scope.role === "DEPT_HEAD") &&
        canViewRequest(scope, requestDeptId)));
  return { canApprove: canAct, canReject: canAct, canResubmit };
}

/**
 * ผู้ขอ/หัวหน้าแผนกแก้เนื้อใบ (เพิ่ม/ลบรายการทดสอบ, แก้รุ่น Lamp) ได้ไหมตอนนี้ — ข้อ 3.3.2 ในแผน
 * ทีมแลป (ADMIN/LAB_HEAD/ENGINEER) แก้ได้เสมอ ไม่ผูกกับสถานะอนุมัติ
 * ผู้ขอ/หัวหน้าแผนกแก้ได้เฉพาะก่อนหัวหน้าแผนกเซ็น (PENDING_DEPT) หรือตอนถูกตีกลับ (REJECTED)
 * — พอเข้า PENDING_LAB (หัวหน้าแผนกเซ็นแล้ว) หรือ APPROVED แก้ไม่ได้แล้ว (ปิดช่องโหว่ F1)
 */
export function canEditRequestNow(
  scope: Scope,
  requestDeptId: number,
  status: ApprovalStatus,
): boolean {
  if (canEditTests(scope.role)) return true;
  if (scope.role !== "REQUESTER" && scope.role !== "DEPT_HEAD") return false;
  if (!canViewRequest(scope, requestDeptId)) return false;
  return status === "PENDING_DEPT" || status === "REJECTED";
}
