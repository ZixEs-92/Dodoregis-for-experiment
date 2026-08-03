import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { guardPageUser } from "@/lib/guard";
import { canEditTests, isDeptScoped } from "@/lib/roles";
import { isOverdue, isUrgent } from "@/lib/workflow";
import { testTitle } from "@/lib/format";
import { toDisplayDate } from "@/lib/date";
import KanbanBoard, { BoardItem, BoardLayout } from "@/components/KanbanBoard";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "บอร์ดงาน — Dodoregis" };

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string }>;
}) {
  const { layout: layoutParam } = await searchParams;
  const layout: BoardLayout = layoutParam === "columns" ? "columns" : "rows";
  const user = await guardPageUser("/board");
  const canEdit = canEditTests(user.role);

  // requester เห็นเฉพาะแผนกตัวเอง เหมือนหน้ารายการงาน
  const deptScoped = isDeptScoped(user.role, user.departmentId);
  const where: Prisma.TestItemWhereInput = {
    status: { notIn: ["S10_CANCEL"] },
    ...(deptScoped ? { request: { requestDeptId: user.departmentId! } } : {}),
  };

  const items = await prisma.testItem.findMany({
    where,
    include: { owner: true, request: { include: { requestDept: true } } },
    orderBy: [{ planEnd: "asc" }, { itemCode: "asc" }],
  });

  const cards: BoardItem[] = items.map((it) => ({
    itemCode: it.itemCode,
    title: testTitle(it.testName, it.testDetail),
    partName: it.partName,
    ownerName: it.owner?.name ?? null,
    dept: it.request.requestDept.name,
    planEnd: it.planEnd ? toDisplayDate(it.planEnd) : null,
    status: it.status,
    overdue: isOverdue(it.planEnd, it.status),
    urgent: isUrgent(it.remark),
  }));

  const onHold = cards.filter((c) => c.status === "S9_HOLD");

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">บอร์ดงาน</h1>
          <p className="text-[14px] text-muted mt-0.5">
            {canEdit
              ? "ลากการ์ดข้ามกลุ่มเพื่อเปลี่ยนสถานะ (บนมือถือใช้เมนูในการ์ด)"
              : "ดูความคืบหน้าของงานทั้งหมดเรียงตามขั้นตอน"}
            {onHold.length > 0 && ` · พักงานอยู่ ${onHold.length} รายการ`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
            <Link
              href="/board"
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                layout === "rows" ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              แนวตั้ง
            </Link>
            <Link
              href="/board?layout=columns"
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                layout === "columns" ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              แนวนอน
            </Link>
          </span>
          <Link href="/requests" className="btn-secondary btn-sm">
            ดูเป็นรายการ →
          </Link>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="card empty-state">
          <p className="text-[15px] font-medium text-ink">ยังไม่มีงานในระบบ</p>
          <p className="text-[13px] text-muted">เมื่อมีการลงทะเบียนงาน การ์ดจะมาเรียงที่นี่</p>
        </div>
      ) : (
        <KanbanBoard items={cards} canEdit={canEdit} layout={layout} />
      )}
    </div>
  );
}
