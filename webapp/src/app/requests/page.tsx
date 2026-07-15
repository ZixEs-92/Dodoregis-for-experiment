import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ALL_STATUSES, STATUS_LABEL, isOverdue, isDueSoon, isUrgent } from "@/lib/workflow";
import { testTitle } from "@/lib/format";
import GroupedRequests, { ItemRow } from "@/components/GroupedRequests";
import { Prisma, RequestStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "รายการงาน — Dodoregis" };

type SearchParams = {
  q?: string;
  status?: string;
  dept?: string;
  owner?: string;
  overdue?: string;
  duesoon?: string;
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const [departments, members] = await Promise.all([
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const where: Prisma.TestItemWhereInput = {};
  if (sp.status) where.status = sp.status as RequestStatus;
  if (sp.owner) where.ownerId = Number(sp.owner);
  if (sp.dept) where.request = { requestDeptId: Number(sp.dept) };
  if (sp.q) {
    where.OR = [
      { itemCode: { contains: sp.q } },
      { partName: { contains: sp.q } },
      { partNo: { contains: sp.q } },
      { regisNo: { contains: sp.q } },
      { request: { requester: { contains: sp.q } } },
    ];
  }

  let items = await prisma.testItem.findMany({
    where,
    include: { owner: true, request: { include: { requestDept: true } } },
    orderBy: [{ regisNo: "desc" }, { itemNo: "asc" }],
  });

  if (sp.overdue === "1") items = items.filter((i) => isOverdue(i.planEnd, i.status));
  if (sp.duesoon === "1") items = items.filter((i) => isDueSoon(i.planEnd, i.status));

  const rows: ItemRow[] = items.map((it) => ({
    itemCode: it.itemCode,
    itemNo: it.itemNo,
    partName: it.partName,
    partNo: it.partNo,
    testTitle: testTitle(it.testName, it.testDetail),
    status: it.status,
    ownerName: it.owner.name,
    planEnd: it.planEnd ? it.planEnd.toISOString() : null,
    remark: it.remark,
    overdue: isOverdue(it.planEnd, it.status),
    urgent: isUrgent(it.remark),
    regisNo: it.regisNo,
    dept: it.request.requestDept.name,
    requester: it.request.requester,
    requestDate: it.request.requestDate.toISOString(),
  }));
  const activeFilterCount = [sp.q, sp.status, sp.dept, sp.owner].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">รายการงานทดสอบ</h1>
        <p className="text-[14px] text-muted mt-0.5">
          จัดกลุ่มตามใบรีเควส · แสดงสถานะแยกแต่ละ item
        </p>
      </div>

      <form className="card p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input
          type="text"
          name="q"
          placeholder="ค้นหา เลขงาน / ชิ้นงาน / พาร์ทโน / ผู้รีเควส"
          defaultValue={sp.q ?? ""}
          className="input col-span-2 sm:col-span-1"
        />
        <select name="status" defaultValue={sp.status ?? ""} className="input">
          <option value="">ทุกสถานะ</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select name="dept" defaultValue={sp.dept ?? ""} className="input">
          <option value="">ทุกแผนก</option>
          {departments.map((dp) => (
            <option key={dp.id} value={dp.id}>{dp.name}</option>
          ))}
        </select>
        <select name="owner" defaultValue={sp.owner ?? ""} className="input">
          <option value="">ทุกผู้รับผิดชอบ</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <div className="col-span-2 flex gap-2 sm:col-span-4">
          <button type="submit" className="btn-primary btn-sm">ค้นหา / กรอง</button>
          {activeFilterCount > 0 && (
            <Link href="/requests" className="btn-secondary btn-sm">ล้างตัวกรอง</Link>
          )}
        </div>
      </form>

      <GroupedRequests items={rows} />
    </div>
  );
}
