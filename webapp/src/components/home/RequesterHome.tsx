import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toDisplayDate } from "@/lib/date";
import { isOverdue, isUrgent, STATUS_LABEL } from "@/lib/workflow";
import { testTitle } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { requestRollup, PHASE_LABEL, PHASE_COLOR } from "@/lib/rollup";
import ApprovalBox from "@/components/home/ApprovalBox";
import { getApprovableSheets, getMyPendingSheets } from "@/lib/approvalQueue";
import { canReachApprovals, type Scope } from "@/lib/roles";

/**
 * หน้าแรกของผู้ขอทดสอบ/หัวหน้าแผนก — ตอบคำถามเดียวที่เขามี: "งานที่ส่งไปถึงไหนแล้ว จะเสร็จเมื่อไหร่"
 * ไม่แสดง KPI ภายในของทีมแลป (workload รายคน, % ส่งตรงแผน) เพราะไม่ใช่ข้อมูลที่ใช้ตัดสินใจอะไรได้
 * ใบที่ยังไม่อนุมัติ/ถูกตีกลับ แยกไปกล่อง "รออนุมัติ" ต่างหาก ไม่ปนกับรายการงานปกติด้านล่าง (ซึ่งนับเฉพาะใบที่อนุมัติแล้ว)
 */
export default async function RequesterHome({
  departmentIds,
  departmentName,
  scope,
}: {
  departmentIds: number[];
  departmentName: string | null;
  scope: Scope;
}) {
  if (departmentIds.length === 0) {
    return (
      <div className="card empty-state">
        <span className="text-[30px] leading-none">🔒</span>
        <p className="text-[15px] font-medium text-ink">
          บัญชีของคุณยังไม่ผูกกับแผนก{scope.role === "DEPT_HEAD" ? "ที่คุม" : ""}
        </p>
        <p className="text-[13px] text-muted">
          แจ้งผู้ดูแลระบบให้ตั้งค่าแผนกให้ก่อน จึงจะลงทะเบียนงานและดูงานของแผนกได้
        </p>
      </div>
    );
  }

  const [myPending, iCanApprove] = await Promise.all([
    getMyPendingSheets(scope),
    canReachApprovals(scope) ? getApprovableSheets(scope) : Promise.resolve([]),
  ]);

  const requests = await prisma.testRequest.findMany({
    where: { requestDeptId: { in: departmentIds }, approvalStatus: "APPROVED" },
    include: { items: { orderBy: { itemNo: "asc" } } },
    orderBy: { requestDate: "desc" },
    take: 50,
  });

  const allItems = requests.flatMap((r) => r.items);
  const active = allItems.filter(
    (i) => i.status !== "S8_CLOSED" && i.status !== "S10_CANCEL",
  );
  const done = allItems.filter((i) => i.status === "S8_CLOSED").length;
  const overdue = allItems.filter((i) => isOverdue(i.planEnd, i.status)).length;
  const waitingPlan = active.filter((i) => !i.ownerId).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">
            งานทดสอบของแผนก{departmentName ? ` ${departmentName}` : ""}
          </h1>
          <p className="text-[14px] text-muted mt-0.5">
            ติดตามสถานะงานที่ส่งเข้าแลป · ทีมแลปเป็นผู้กำหนดวันทดสอบให้
          </p>
        </div>
        <Link href="/requests/new" className="btn-primary">
          + ลงทะเบียนงานใหม่
        </Link>
      </div>

      {/* กล่องรออนุมัติ — แยกจากการ์ดงานปกติเสมอ ไม่ให้สับสนว่างานไหน "รับเข้าแลปแล้วจริง" */}
      {scope.role === "DEPT_HEAD" && (
        <ApprovalBox title="ใบรอฉันเซ็น" sheets={iCanApprove} mode="sign" />
      )}
      <ApprovalBox title="ใบของแผนกที่ยังไม่ผ่านการอนุมัติ" sheets={myPending} mode="mine" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="กำลังดำเนินการ" value={active.length} sub="ยังไม่ปิดงาน" />
        <Stat label="รอทีมแลปวางแผน" value={waitingPlan} sub="ยังไม่ระบุวันทดสอบ" tone={waitingPlan > 0 ? "warn" : undefined} />
        <Stat label="เลยกำหนด" value={overdue} sub="ควรสอบถามทีมแลป" tone={overdue > 0 ? "bad" : undefined} />
        <Stat label="เสร็จแล้ว" value={done} sub="ปิดงานเรียบร้อย" tone="good" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-medium text-ink">
          ใบรีเควสที่ส่งไป ({requests.length})
        </h2>

        {requests.length === 0 ? (
          <div className="card empty-state">
            <span className="text-[30px] leading-none">📋</span>
            <p className="text-[15px] font-medium text-ink">ยังไม่มีงานที่ส่งเข้าแลป</p>
            <p className="text-[13px] text-muted">
              กรอกชื่อชิ้นงานและรายละเอียดการทดสอบ แล้วทีมแลปจะรับงานและวางแผนให้
            </p>
            <Link href="/requests/new" className="btn-primary btn-sm mt-1">
              + ลงทะเบียนงานใหม่
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((req) => {
              const roll = requestRollup(req.items);
              return (
                <Link
                  key={req.regisNo}
                  href={`/requests/${req.regisNo}`}
                  className="card flex flex-col gap-3 p-4 transition-colors hover:bg-surface-soft"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-ink">{req.regisNo}</span>
                    <span className={`chip ${PHASE_COLOR[roll.phase]}`}>{PHASE_LABEL[roll.phase]}</span>
                    <span className="text-[12px] text-muted">
                      ส่งเมื่อ {toDisplayDate(req.requestDate)}
                    </span>
                    <span className="ml-auto text-[12px] text-muted">
                      เสร็จ {roll.done}/{roll.total} รายการ
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {req.items.map((it) => {
                      const late = isOverdue(it.planEnd, it.status);
                      return (
                        <div
                          key={it.id}
                          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
                        >
                          <StatusBadge status={it.status} />
                          <span className="text-ink">
                            {testTitle(it.testName, it.testDetail) || it.partName}
                          </span>
                          {isUrgent(it.remark) && (
                            <span className="chip bg-coral text-white">ด่วน</span>
                          )}
                          <span className={`ml-auto ${late ? "font-medium text-coral" : "text-muted"}`}>
                            {it.planEnd
                              ? `${late ? "เลยกำหนด " : "กำหนดเสร็จ "}${toDisplayDate(it.planEnd)}`
                              : it.ownerId
                                ? STATUS_LABEL[it.status]
                                : "รอทีมแลปวางแผน"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "bad"
      ? "text-coral"
      : tone === "warn"
        ? "text-mustard-deep"
        : tone === "good"
          ? "text-forest"
          : "text-ink";
  return (
    <div className="card flex flex-col gap-0.5 p-4">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={`text-[28px] font-medium leading-tight ${toneClass}`}>{value}</span>
      <span className="text-[11px] text-muted">{sub}</span>
    </div>
  );
}
