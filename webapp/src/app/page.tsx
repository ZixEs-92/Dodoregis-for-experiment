import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ALL_STATUSES,
  STATUS_LABEL,
  STATUS_COLOR,
  isOverdue,
  isDueSoon,
  isUrgent,
} from "@/lib/workflow";
import LoadingBoard, { LoadItem } from "@/components/LoadingBoard";
import { requestRollup, RequestPhase } from "@/lib/rollup";
import { getCurrentUser } from "@/lib/auth";
import RequesterHome from "@/components/home/RequesterHome";
import MyWorkBlock from "@/components/home/MyWorkBlock";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // หน้าต่างแรกของแอปคือหน้า login (ประตูทางเข้า) — ยังไม่ล็อกอินให้ไปที่นั่นก่อน
  // (หน้าดูงานอื่น ๆ เช่น /items /requests ยังเปิดให้ดูได้โดยไม่ล็อกอิน สำหรับสแกน QR)
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // หน้าแรกต่างกันตามบทบาท — คนส่งงานไม่ควรต้องเจอ KPI ภายในของทีมแลป
  if (user.role === "REQUESTER") {
    return (
      <RequesterHome
        departmentId={user.departmentId}
        departmentName={user.department?.name ?? null}
      />
    );
  }

  return <TeamDashboard isAdmin={user.role === "ADMIN"} memberId={user.memberId} />;
}

async function TeamDashboard({
  isAdmin,
  memberId,
}: {
  isAdmin: boolean;
  memberId: number | null;
}) {
  const items = await prisma.testItem.findMany({
    include: {
      owner: true,
      testRuns: { include: { loadingOwner: true } },
      reports: true,
    },
  });
  const requestCount = await prisma.testRequest.count();

  const total = items.length;
  const overdue = items.filter((i) => isOverdue(i.planEnd, i.status));
  const dueSoon = items.filter((i) => isDueSoon(i.planEnd, i.status));

  // ส่งตรง plan % (งานที่ส่งเสร็จและมี plan จบ)
  let onTimeN = 0;
  let onTimeD = 0;
  for (const i of items) {
    const sent = i.reports.find((r) => r.status === "SENT")?.sentDate ?? null;
    const completionDate = sent ?? (i.status === "S8_CLOSED" ? i.actualEnd : null);
    if (!completionDate || !i.planEnd) continue;
    onTimeD++;
    if (completionDate.getTime() <= i.planEnd.getTime()) onTimeN++;
  }
  const onTimePct = onTimeD ? Math.round((onTimeN / onTimeD) * 100) : null;

  // aging buckets ของงานเลยกำหนด
  const nowMs = new Date().getTime();
  const DAY = 24 * 60 * 60 * 1000;
  const overdueDays = (i: (typeof overdue)[number]) =>
    Math.floor((nowMs - i.planEnd!.getTime()) / DAY);
  const ov1 = overdue.filter((i) => overdueDays(i) <= 3).length;
  const ov2 = overdue.filter((i) => {
    const d = overdueDays(i);
    return d > 3 && d <= 7;
  }).length;
  const ov3 = overdue.filter((i) => overdueDays(i) > 7).length;

  const statusCounts = new Map<string, number>();
  for (const s of ALL_STATUSES) statusCounts.set(s, 0);
  for (const i of items) statusCounts.set(i.status, (statusCounts.get(i.status) ?? 0) + 1);
  const maxStatusCount = Math.max(1, ...statusCounts.values());

  const active = items.filter(
    (i) => i.status !== "S8_CLOSED" && i.status !== "S10_CANCEL"
  );
  // งานรอวางแผน (ยังไม่มอบหมาย) — โชว์แบนเนอร์ให้ admin
  const unassignedCount = active.filter((i) => !i.ownerId).length;
  const workload = new Map<string, number>();
  for (const i of active) {
    const names = new Set<string>();
    names.add(i.owner?.name ?? "ยังไม่มอบหมาย");
    for (const run of i.testRuns) if (run.loadingOwner) names.add(run.loadingOwner.name);
    for (const name of names) workload.set(name, (workload.get(name) ?? 0) + 1);
  }
  const workloadSorted = [...workload.entries()].sort((a, b) => b[1] - a[1]);

  // สถานะรวมราย "ใบรีเควส" (rollup)
  const byReq = new Map<string, { status: typeof items[number]["status"]; planEnd: Date | null; remark: string | null }[]>();
  for (const i of items) {
    const arr = byReq.get(i.regisNo) ?? [];
    arr.push({ status: i.status, planEnd: i.planEnd, remark: i.remark });
    byReq.set(i.regisNo, arr);
  }
  const phaseCount: Record<RequestPhase, number> = { EMPTY: 0, NOT_STARTED: 0, IN_PROGRESS: 0, DONE: 0 };
  for (const arr of byReq.values()) phaseCount[requestRollup(arr).phase]++;

  const loadItems: LoadItem[] = active.map((i) => ({
    itemCode: i.itemCode,
    partName: i.partName,
    status: i.status,
    ownerName: i.owner?.name ?? "ยังไม่มอบหมาย",
    planStart: i.planStart ? i.planStart.toISOString() : null,
    planEnd: i.planEnd ? i.planEnd.toISOString() : null,
    overdue: isOverdue(i.planEnd, i.status),
    urgent: isUrgent(i.remark),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">
            {isAdmin ? "ภาพรวมทั้งแลป" : "หน้าหลัก"}
          </h1>
          <p className="text-[14px] text-muted mt-0.5">
            ภาพรวมงานทดสอบ (นับเป็นราย item) · {requestCount} ใบรีเควส
          </p>
        </div>
        <div className="ml-auto hidden gap-2 sm:flex">
          <Link href="/schedule" className="btn-primary btn-sm">ตารางงานรายสัปดาห์ →</Link>
          <Link href="/analytics" className="btn-secondary btn-sm">วิเคราะห์ / KPI →</Link>
        </div>
      </div>

      {/* วิศวกร: งานของตัวเองต้องเป็นสิ่งแรกที่เห็น ไม่ต้องไปกรองเอง */}
      {!isAdmin && <MyWorkBlock memberId={memberId} />}

      {isAdmin && unassignedCount > 0 && (
        <Link
          href="/planning"
          className="card p-4 flex flex-wrap items-center gap-3 border-mustard bg-yellow-soft hover:opacity-90 transition-opacity"
        >
          <span className="text-[20px] leading-none">⏳</span>
          <span className="text-[14px] font-medium text-ink">
            มีงานรอวางแผน {unassignedCount} รายการ — มอบหมายผู้รับผิดชอบ + ลงวันที่
          </span>
          <span className="ml-auto text-[13px] text-link">ไปที่คิววางแผน →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="งานทั้งหมด (item)" value={total} sub="ทุกสถานะ" className="bg-surface-dark text-white" href="/requests" />
        <SummaryCard label="เลยกำหนด plan จบ" value={overdue.length} sub={overdue.length > 0 ? `เกิน 7 วัน ${ov3} · 4–7 วัน ${ov2} · 1–3 วัน ${ov1}` : "ต้องติดตามด่วน"} className="bg-coral text-white" href="/requests?overdue=1" />
        <SummaryCard label="ครบกำหนดใน 7 วัน" value={dueSoon.length} sub="เตรียมตัวล่วงหน้า" className="bg-mustard text-ink" href="/requests?duesoon=1" />
        <SummaryCard label="ส่งตรง plan" value={onTimePct === null ? "—" : `${onTimePct}%`} sub={`${onTimeD} งานที่ส่งเสร็จ`} className="bg-forest text-white" href="/analytics" />
      </div>

      <Link href="/requests" className="card p-4 flex flex-wrap items-center gap-x-5 gap-y-2 hover:border-border-strong transition-colors">
        <span className="text-[13px] font-medium text-ink">ภาพรวมใบรีเควส ({requestCount})</span>
        <span className="chip bg-yellow-soft text-mustard-deep">รอเริ่ม {phaseCount.NOT_STARTED}</span>
        <span className="chip bg-info-soft text-info">กำลังดำเนินการ {phaseCount.IN_PROGRESS}</span>
        <span className="chip bg-forest text-white">เสร็จสิ้น {phaseCount.DONE}</span>
        <span className="ml-auto text-[12px] text-link">ดูรายการ →</span>
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="text-[15px] font-medium text-ink mb-4">จำนวน item ตามสถานะ</h2>
          <div className="flex flex-col gap-2.5">
            {ALL_STATUSES.map((s) => {
              const count = statusCounts.get(s) ?? 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className={`chip ${STATUS_COLOR[s]} w-40 shrink-0 justify-center sm:w-48`}>
                    {STATUS_LABEL[s]}
                  </span>
                  <div className="flex-1 bg-surface-strong rounded-sm h-2.5 overflow-hidden">
                    <div className="bg-ink h-full rounded-sm" style={{ width: `${(count / maxStatusCount) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-[14px] font-medium text-ink shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="text-[15px] font-medium text-ink mb-1">Workload ต่อคน</h2>
          <p className="text-[12px] text-muted mb-4">item ที่ยังไม่ปิด</p>
          {workloadSorted.length === 0 ? (
            <p className="text-[14px] text-muted">ไม่มีงานที่ยังเปิดอยู่</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {workloadSorted.map(([name, count]) => (
                <li key={name} className="flex items-center gap-3">
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-surface-strong text-ink text-[12px] font-medium shrink-0">
                    {name.slice(0, 1)}
                  </span>
                  <span className="flex-1 text-[14px] text-body truncate">{name}</span>
                  <div className="w-20 bg-surface-strong rounded-sm h-2 overflow-hidden hidden sm:block">
                    <div className="bg-ink h-full rounded-sm" style={{ width: `${Math.min(100, (count / workloadSorted[0][1]) * 100)}%` }} />
                  </div>
                  <span className="w-6 text-right text-[14px] font-medium text-ink">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <LoadingBoard items={loadItems} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  className,
  href,
}: {
  label: string;
  value: number | string;
  sub: string;
  className: string;
  href: string;
}) {
  return (
    <Link href={href} className="block">
      <div className={`rounded-lg p-6 flex flex-col gap-1 h-full transition-opacity hover:opacity-90 ${className}`}>
        <span className="text-[13px] font-medium opacity-80">{label}</span>
        <span className="text-[38px] font-medium leading-tight">{value}</span>
        <span className="text-[12px] opacity-70">{sub}</span>
      </div>
    </Link>
  );
}
