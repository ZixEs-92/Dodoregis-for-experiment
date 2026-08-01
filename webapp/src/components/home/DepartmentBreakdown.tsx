import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isOverdue } from "@/lib/workflow";

/**
 * งานแยกตามแผนกที่ส่งเข้ามา — กดเข้าไปดูรายการของแผนกนั้นได้
 * ตอบคำถามของหัวหน้าแลปว่า "งานมาจากไหนเยอะ แผนกไหนกำลังรอเราอยู่"
 */
export default async function DepartmentBreakdown() {
  const [departments, items] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.testItem.findMany({
      where: { status: { notIn: ["S10_CANCEL"] } },
      select: {
        status: true,
        planEnd: true,
        ownerId: true,
        request: { select: { requestDeptId: true } },
      },
    }),
  ]);

  const rows = departments
    .map((d) => {
      const mine = items.filter((i) => i.request.requestDeptId === d.id);
      const active = mine.filter((i) => i.status !== "S8_CLOSED");
      return {
        id: d.id,
        name: d.name,
        active: active.length,
        done: mine.filter((i) => i.status === "S8_CLOSED").length,
        overdue: active.filter((i) => isOverdue(i.planEnd, i.status)).length,
        waitingPlan: active.filter((i) => !i.ownerId).length,
        total: mine.length,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.active - a.active || b.total - a.total);

  if (rows.length === 0) return null;

  const maxActive = Math.max(1, ...rows.map((r) => r.active));

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-medium text-ink">งานแยกตามแผนกที่ส่งเข้ามา</h2>
        <span className="text-[12px] text-muted">กดที่แผนกเพื่อดูรายการงานของแผนกนั้น</span>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/requests?dept=${r.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-hairline px-3 py-2.5 transition-colors hover:bg-surface-soft"
            >
              <span className="text-[14px] font-medium text-ink">{r.name}</span>

              {r.waitingPlan > 0 && (
                <span className="chip bg-yellow-soft text-mustard-deep">
                  รอวางแผน {r.waitingPlan}
                </span>
              )}
              {r.overdue > 0 && (
                <span className="chip bg-coral text-white">เลยกำหนด {r.overdue}</span>
              )}

              <span className="ml-auto flex items-center gap-2">
                <span className="hidden h-2 w-24 overflow-hidden rounded-sm bg-surface-strong sm:block">
                  <span
                    className="block h-full rounded-sm bg-ink"
                    style={{ width: `${(r.active / maxActive) * 100}%` }}
                  />
                </span>
                <span className="text-[13px] text-muted">
                  <span className="font-medium text-ink">{r.active}</span> กำลังทำ · เสร็จ {r.done}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
