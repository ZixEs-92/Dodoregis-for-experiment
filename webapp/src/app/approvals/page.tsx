import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { guardPageApprove } from "@/lib/guard";
import { toScope } from "@/lib/auth";
import { canApproveDept, canApproveLab } from "@/lib/roles";
import ApprovalQueueRow, { QueueRow } from "@/components/ApprovalQueueRow";

// สิทธิ์เข้าหน้านี้ขึ้นกับ session — ต้อง dynamic เสมอ กัน Next แคชผลของคนแรกไปให้คนถัดไปที่ URL เดียวกัน
export const dynamic = "force-dynamic";
export const metadata = { title: "คิวรออนุมัติ — Dodoregis" };

export default async function ApprovalsPage() {
  const user = await guardPageApprove("/approvals");
  const scope = toScope(user);

  const pending = await prisma.testRequest.findMany({
    where: { approvalStatus: { in: ["PENDING_DEPT", "PENDING_LAB"] } },
    include: { requestDept: true },
    orderBy: { submittedAt: "asc" },
  });

  // กรอง "ตัวเองต้องเซ็น" ในโค้ด — dept_head คุมได้หลายแผนก (array) ทำเป็น Prisma where ตรง ๆ ไม่ตรงไปตรงมา
  const mine = pending.filter((r) =>
    r.approvalStatus === "PENDING_DEPT"
      ? canApproveDept(scope, r.requestDeptId)
      : canApproveLab(scope.role),
  );

  const now = new Date().getTime();
  const rows: QueueRow[] = mine.map((r) => ({
    regisNo: r.regisNo,
    deptName: r.requestDept.name,
    requester: r.requester,
    testObject: r.testObject,
    approvalStatus: r.approvalStatus,
    daysWaiting: r.submittedAt ? Math.floor((now - r.submittedAt.getTime()) / 86_400_000) : null,
  }));

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Link href="/" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปหน้าหลัก
      </Link>
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">
          คิวรออนุมัติ {rows.length > 0 && <span className="text-coral">({rows.length})</span>}
        </h1>
        <p className="text-[14px] text-muted mt-0.5">
          ใบรีเควสที่รอการอนุมัติจากคุณ — เรียงใบที่ค้างนานสุดขึ้นก่อน
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card empty-state">
          <p className="text-[15px] font-medium text-ink">ไม่มีใบรออนุมัติ</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <ApprovalQueueRow key={r.regisNo} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
