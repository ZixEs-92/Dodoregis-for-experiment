import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ALL_STATUSES, STATUS_LABEL, isOverdue, isDueSoon, isUrgent } from "@/lib/workflow";
import { testTitle } from "@/lib/format";
import GroupedRequests, { ItemRow } from "@/components/GroupedRequests";
import { Prisma, RequestStatus } from "@/generated/prisma/client";
import { guardPageUser } from "@/lib/guard";
import { isDeptScoped } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata = { title: "รายการงาน — Dodoregis" };

type SearchParams = {
  q?: string;
  status?: string;
  dept?: string;
  owner?: string;
  overdue?: string;
  duesoon?: string;
  unassigned?: string;
};

/** มุมมองที่ใช้บ่อย — กดครั้งเดียวแทนการตั้งตัวกรองเอง */
const QUICK_VIEWS = [
  { key: "", label: "ทั้งหมด", href: "/requests" },
  { key: "overdue", label: "เลยกำหนด", href: "/requests?overdue=1" },
  { key: "duesoon", label: "ครบใน 7 วัน", href: "/requests?duesoon=1" },
  { key: "unassigned", label: "รอวางแผน", href: "/requests?unassigned=1" },
];

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

  // requester ถูกจำกัดให้เห็นเฉพาะงานแผนกตัวเอง (ทับตัวกรอง dept จาก URL)
  const user = await guardPageUser("/requests");
  const deptScoped = isDeptScoped(user.role, user.departmentId);

  const where: Prisma.TestItemWhereInput = {};
  if (sp.status) where.status = sp.status as RequestStatus;
  if (sp.owner) where.ownerId = Number(sp.owner);
  if (sp.dept) where.request = { requestDeptId: Number(sp.dept) };
  if (sp.unassigned === "1") where.ownerId = null;
  if (deptScoped) where.request = { requestDeptId: user.departmentId! };
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
    ownerName: it.owner?.name ?? "ยังไม่มอบหมาย",
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
  const activeView =
    sp.overdue === "1"
      ? "overdue"
      : sp.duesoon === "1"
        ? "duesoon"
        : sp.unassigned === "1"
          ? "unassigned"
          : activeFilterCount === 0
            ? ""
            : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">รายการงานทดสอบ</h1>
        <p className="text-[14px] text-muted mt-0.5">
          จัดกลุ่มตามใบรีเควส · แสดงสถานะแยกแต่ละ item
          {deptScoped && <span className="text-info"> · เฉพาะแผนก {user.department!.name}</span>}
        </p>
      </div>

      {/* มุมมองด่วน — กดครั้งเดียวถึงงานที่ต้องดู ไม่ต้องตั้งตัวกรองเอง */}
      <div className="flex flex-wrap gap-2">
        {QUICK_VIEWS.map((v) => {
          const on = activeView === v.key;
          return (
            <Link
              key={v.key || "all"}
              href={v.href}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg border px-3.5 text-[13px] font-medium transition-colors ${
                on
                  ? "border-ink bg-ink text-white"
                  : "border-hairline bg-canvas text-body hover:bg-surface-soft"
              }`}
            >
              {v.label}
            </Link>
          );
        })}
      </div>

      <details className="card p-4" open={activeFilterCount > 0}>
        <summary className="cursor-pointer select-none text-[13px] font-medium text-ink">
          ตัวกรองละเอียด
          {activeFilterCount > 0 && (
            <span className="ml-2 chip bg-info-soft text-info">{activeFilterCount}</span>
          )}
        </summary>
        <form className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      </details>

      <GroupedRequests items={rows} />
    </div>
  );
}
