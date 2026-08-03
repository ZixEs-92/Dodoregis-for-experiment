import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { guardPageAdmin } from "@/lib/guard";
import { isUrgent } from "@/lib/workflow";
import { testTitle } from "@/lib/format";
import PlanningQueue, { QueueItem } from "@/components/PlanningQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "คิวรอวางแผน — Dodoregis" };

export default async function PlanningPage() {
  await guardPageAdmin("/planning");

  // งานที่ยังไม่มอบหมายและยังไม่จบ/ยกเลิก — เรียงใบเก่าสุดก่อน
  const [items, members] = await Promise.all([
    prisma.testItem.findMany({
      where: { ownerId: null, status: { notIn: ["S8_CLOSED", "S10_CANCEL"] } },
      include: { request: { include: { requestDept: true } } },
      orderBy: [{ request: { requestDate: "asc" } }, { itemCode: "asc" }],
    }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  // จำนวนงานเปิดต่อคน — ช่วย admin กระจายงาน
  const openCounts = await prisma.testItem.groupBy({
    by: ["ownerId"],
    where: { status: { notIn: ["S8_CLOSED", "S10_CANCEL"] }, ownerId: { not: null } },
    _count: { _all: true },
  });
  const countMap = new Map(openCounts.map((c) => [c.ownerId, c._count._all]));

  const rows: QueueItem[] = items.map((it) => ({
    itemCode: it.itemCode,
    partName: it.partName,
    partNo: it.partNo,
    testTitle: testTitle(it.testName, it.testDetail),
    testDetail: it.testDetail,
    status: it.status,
    regisNo: it.regisNo,
    dept: it.request.requestDept.name,
    requester: it.request.requester,
    requestDate: it.request.requestDate.toLocaleDateString("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }),
    urgent: isUrgent(it.remark),
    remark: it.remark,
  }));

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Link href="/admin" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปหน้าผู้ดูแลระบบ
      </Link>
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">
          คิวรอวางแผน {rows.length > 0 && <span className="text-coral">({rows.length})</span>}
        </h1>
        <p className="text-[14px] text-muted mt-0.5">
          งานที่แผนกลงทะเบียนเข้ามาแต่ยังไม่มอบหมายผู้รับผิดชอบ — เลือกคน + ลงวันที่แผน แล้วงานจะเข้าตารางปกติ
        </p>
      </div>

      <PlanningQueue
        items={rows}
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          openCount: countMap.get(m.id) ?? 0,
        }))}
      />
    </div>
  );
}
