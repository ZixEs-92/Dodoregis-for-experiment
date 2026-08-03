// คิวอนุมัติ — server-only (ใช้ prisma) แยกจาก lib/approval.ts ที่เป็น pure logic client-safe
// ใช้ร่วมกันระหว่างหน้า /approvals, กล่องหน้าแรก, และตัวเลขค้างในเมนู เพื่อไม่ให้เกณฑ์ "ใบไหนต้องเซ็น" เพี้ยนกันคนละที่
import { prisma } from "@/lib/prisma";
import { canApproveDept, canApproveLab, canReachApprovals, type Scope } from "@/lib/roles";
import type { ApprovalStatus } from "@/generated/prisma/client";

export type ApprovableSheet = {
  regisNo: string;
  deptName: string;
  requester: string;
  testObject: string | null;
  approvalStatus: ApprovalStatus;
  daysWaiting: number | null;
};

type SheetRow = {
  regisNo: string;
  requestDept: { name: string };
  requester: string;
  testObject: string | null;
  approvalStatus: ApprovalStatus;
  submittedAt: Date | null;
};

function toApprovable(r: SheetRow): ApprovableSheet {
  return {
    regisNo: r.regisNo,
    deptName: r.requestDept.name,
    requester: r.requester,
    testObject: r.testObject,
    approvalStatus: r.approvalStatus,
    daysWaiting: r.submittedAt
      ? Math.floor((new Date().getTime() - r.submittedAt.getTime()) / 86_400_000)
      : null,
  };
}

/** ใบที่ scope นี้ต้องเซ็นตอนนี้ (ทั้ง 2 ชั้น) เรียงค้างนานสุดก่อน — ใช้ทั้งหน้า /approvals และกล่องหน้าแรก/เมนู */
export async function getApprovableSheets(scope: Scope): Promise<ApprovableSheet[]> {
  if (!canReachApprovals(scope)) return [];
  const pending = await prisma.testRequest.findMany({
    where: { approvalStatus: { in: ["PENDING_DEPT", "PENDING_LAB"] } },
    include: { requestDept: true },
    orderBy: { submittedAt: "asc" },
  });
  return pending
    .filter((r) =>
      r.approvalStatus === "PENDING_DEPT"
        ? canApproveDept(scope, r.requestDeptId)
        : canApproveLab(scope.role),
    )
    .map(toApprovable);
}

/**
 * ใบของแผนกตัวเอง (requester/dept_head) ที่ยังไม่อนุมัติหรือถูกตีกลับ
 * ใช้โชว์เป็นกล่องแยกหน้าแรก — ไม่ปนกับการ์ดงานปกติที่นับเฉพาะใบที่อนุมัติแล้ว
 */
export async function getMyPendingSheets(scope: Scope): Promise<ApprovableSheet[]> {
  const ids =
    scope.role === "REQUESTER" && scope.departmentId != null
      ? [scope.departmentId]
      : scope.role === "DEPT_HEAD"
        ? scope.headOfDepartmentIds
        : null;
  if (!ids || ids.length === 0) return [];
  const sheets = await prisma.testRequest.findMany({
    where: { requestDeptId: { in: ids }, approvalStatus: { not: "APPROVED" } },
    include: { requestDept: true },
    orderBy: { submittedAt: "asc" },
  });
  return sheets.map(toApprovable);
}
