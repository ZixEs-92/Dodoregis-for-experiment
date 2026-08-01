import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  STATUS_ORDER,
  STATUS_LABEL,
  STATUS_FILL,
  isOverdue,
} from "@/lib/workflow";
import { daysBetween } from "@/lib/tat";
import {
  computeTimeInStatus,
  computeCfd,
  daysInCurrentStatus,
  ItemLogsForAnalytics,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "วิเคราะห์ / KPI — Dodoregis" };

type Range = "month" | "30d" | "all";
const RANGE_LABEL: Record<Range, string> = {
  month: "เดือนนี้",
  "30d": "30 วันล่าสุด",
  all: "ทั้งหมด",
};

function rangeStart(range: Range, now: Date): Date | null {
  if (range === "all") return null;
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range: Range = sp.range === "month" || sp.range === "all" ? sp.range : "30d";
  const now = new Date();
  const start = rangeStart(range, now);

  const items = await prisma.testItem.findMany({
    include: {
      request: { include: { requestDept: true } },
      owner: true,
      reports: true,
      testRuns: true,
      statusLogs: true,
    },
  });

  // ── completion / lead time / on-time ──
  type Completed = { leadDays: number; onTime: boolean | null; deptName: string };
  const completed: Completed[] = [];
  for (const it of items) {
    const sent = it.reports.find((r) => r.status === "SENT")?.sentDate ?? null;
    const completionDate = sent ?? (it.status === "S8_CLOSED" ? it.actualEnd : null);
    if (!completionDate) continue;
    if (start && completionDate < start) continue;
    const leadDays = Math.max(0, daysBetween(it.request.requestDate, completionDate));
    const onTime = it.planEnd ? completionDate.getTime() <= it.planEnd.getTime() : null;
    completed.push({ leadDays, onTime, deptName: it.request.requestDept.name });
  }

  const throughput = completed.length;
  const avgLead = throughput
    ? completed.reduce((s, c) => s + c.leadDays, 0) / throughput
    : 0;
  const withPlan = completed.filter((c) => c.onTime !== null);
  const onTimePct = withPlan.length
    ? (withPlan.filter((c) => c.onTime).length / withPlan.length) * 100
    : null;

  // ── retest & pass rate (จาก test runs — ทุกงาน ไม่ผูกช่วงเวลา) ──
  let itemsWithRuns = 0;
  let itemsRetested = 0;
  let itemsWithResult = 0;
  let itemsPass = 0;
  for (const it of items) {
    if (it.testRuns.length > 0) {
      itemsWithRuns++;
      if (it.testRuns.length > 1) itemsRetested++;
      const withResult = it.testRuns.filter((r) => r.result);
      if (withResult.length > 0) {
        itemsWithResult++;
        const latest = withResult.sort((a, b) => b.runNo - a.runNo)[0];
        if (latest.result === "PASS") itemsPass++;
      }
    }
  }
  const retestPct = itemsWithRuns ? (itemsRetested / itemsWithRuns) * 100 : null;
  const passPct = itemsWithResult ? (itemsPass / itemsWithResult) * 100 : null;

  // ── by department ──
  const deptMap = new Map<string, { count: number; lead: number; onTimeN: number; onTimeD: number }>();
  for (const c of completed) {
    const d = deptMap.get(c.deptName) ?? { count: 0, lead: 0, onTimeN: 0, onTimeD: 0 };
    d.count++;
    d.lead += c.leadDays;
    if (c.onTime !== null) {
      d.onTimeD++;
      if (c.onTime) d.onTimeN++;
    }
    deptMap.set(c.deptName, d);
  }
  const byDept = [...deptMap.entries()]
    .map(([name, d]) => ({
      name,
      count: d.count,
      avgLead: d.count ? d.lead / d.count : 0,
      onTimePct: d.onTimeD ? (d.onTimeN / d.onTimeD) * 100 : null,
    }))
    .sort((a, b) => b.count - a.count);

  // ── aging buckets (งาน active ที่เลยกำหนด) ──
  const active = items.filter(
    (i) => i.status !== "S8_CLOSED" && i.status !== "S10_CANCEL"
  );
  const overdueItems = active.filter((i) => isOverdue(i.planEnd, i.status));
  const buckets = { b1: 0, b2: 0, b3: 0 }; // 1-3 / 4-7 / >7
  for (const i of overdueItems) {
    const d = daysBetween(i.planEnd!, now);
    if (d <= 3) buckets.b1++;
    else if (d <= 7) buckets.b2++;
    else buckets.b3++;
  }

  // ── bottleneck (time in status) ──
  const logItems: ItemLogsForAnalytics[] = items.map((i) => ({
    createdAt: i.createdAt,
    status: i.status,
    statusLogs: i.statusLogs,
  }));
  const timeInStatus = computeTimeInStatus(logItems, now);
  const maxAvg = Math.max(1, ...timeInStatus.map((t) => t.avgDays));

  // ── aging WIP (ค้างสถานะเดิม > 7 วัน) ──
  const agingWip = active
    .map((i) => ({
      itemCode: i.itemCode,
      partName: i.partName,
      status: i.status,
      ownerName: i.owner?.name ?? "ยังไม่มอบหมาย",
      days: daysInCurrentStatus({ createdAt: i.createdAt, status: i.status, statusLogs: i.statusLogs }, now),
    }))
    .filter((x) => x.days > 7)
    .sort((a, b) => b.days - a.days)
    .slice(0, 15);

  // ── CFD (14 วันล่าสุด) ──
  const cfd = computeCfd(items, 14, now);
  const cfdMax = Math.max(
    1,
    ...cfd.map((d) => STATUS_ORDER.reduce((s, st) => s + d.counts[st], 0))
  );
  const cfdStatuses = STATUS_ORDER.filter((s) => s !== "S8_CLOSED");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปหน้าผู้ดูแลระบบ
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">วิเคราะห์ / KPI</h1>
          <p className="text-[14px] text-muted mt-0.5">
            ประสิทธิภาพงานทดสอบ · ช่วง {RANGE_LABEL[range]}
          </p>
        </div>
        <div className="ml-auto inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
          {(["month", "30d", "all"] as Range[]).map((r) => (
            <Link
              key={r}
              href={`/analytics?range=${r}`}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                range === r ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {RANGE_LABEL[r]}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="งานที่ส่งเสร็จ (ช่วงนี้)" value={String(throughput)} sub="throughput" />
        <KpiCard
          label="ส่งตรง plan"
          value={onTimePct === null ? "—" : `${onTimePct.toFixed(0)}%`}
          sub={`${withPlan.length} งานที่มี plan`}
          tone={onTimePct !== null && onTimePct >= 80 ? "good" : onTimePct !== null && onTimePct < 50 ? "bad" : "neutral"}
        />
        <KpiCard label="Lead time เฉลี่ย" value={throughput ? `${avgLead.toFixed(1)}` : "—"} sub="วัน (รับใบ→ส่ง)" />
        <KpiCard
          label="Retest rate"
          value={retestPct === null ? "—" : `${retestPct.toFixed(0)}%`}
          sub={`${itemsWithRuns} งานที่มีการเทส`}
          tone={retestPct !== null && retestPct > 30 ? "bad" : "neutral"}
        />
        <KpiCard
          label="Pass rate"
          value={passPct === null ? "—" : `${passPct.toFixed(0)}%`}
          sub={`${itemsWithResult} งานที่มีผล`}
          tone={passPct !== null && passPct >= 80 ? "good" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* bottleneck */}
        <section className="card p-5 lg:col-span-3">
          <h2 className="text-[15px] font-medium text-ink mb-1">คอขวด — เวลาเฉลี่ยในแต่ละสถานะ</h2>
          <p className="text-[12px] text-muted mb-4">คำนวณจากประวัติสถานะ (งานที่มี log แล้วเท่านั้น)</p>
          {timeInStatus.length === 0 ? (
            <p className="text-[14px] text-muted py-3">ยังไม่มีประวัติสถานะพอจะคำนวณ — ข้อมูลจะสะสมเมื่อมีการเปลี่ยนสถานะ</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {timeInStatus.map((t) => (
                <div key={t.status} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-[13px] text-body truncate sm:w-48">{STATUS_LABEL[t.status]}</span>
                  <div className="flex-1 bg-surface-strong rounded-sm h-2.5 overflow-hidden">
                    <div className={`${STATUS_FILL[t.status]} h-full rounded-sm`} style={{ width: `${(t.avgDays / maxAvg) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right text-[13px] font-medium text-ink shrink-0">{t.avgDays.toFixed(1)} วัน</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* aging buckets */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="text-[15px] font-medium text-ink mb-1">งานเลยกำหนด (แยกความรุนแรง)</h2>
          <p className="text-[12px] text-muted mb-4">{overdueItems.length} งานที่ยังเปิดและเลยกำหนด</p>
          <div className="flex flex-col gap-3">
            <BucketRow label="เลย 1–3 วัน" value={buckets.b1} color="bg-mustard" />
            <BucketRow label="เลย 4–7 วัน" value={buckets.b2} color="bg-peach" />
            <BucketRow label="เลยเกิน 7 วัน" value={buckets.b3} color="bg-coral" />
          </div>
        </section>
      </div>

      {/* by department */}
      <section className="card p-5">
        <h2 className="text-[15px] font-medium text-ink mb-4">แยกตามแผนกที่รีเควส (ช่วง {RANGE_LABEL[range]})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px] min-w-[520px]">
            <thead>
              <tr className="border-b border-hairline text-left">
                <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide">แผนก</th>
                <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide">ส่งเสร็จ</th>
                <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide">Lead time เฉลี่ย</th>
                <th className="p-2.5 text-[12px] font-medium text-muted uppercase tracking-wide">ส่งตรง plan</th>
              </tr>
            </thead>
            <tbody>
              {byDept.map((d) => (
                <tr key={d.name} className="border-b border-hairline last:border-0">
                  <td className="p-2.5 text-ink">{d.name}</td>
                  <td className="p-2.5 text-body">{d.count}</td>
                  <td className="p-2.5 text-body">{d.avgLead.toFixed(1)} วัน</td>
                  <td className="p-2.5 text-body">{d.onTimePct === null ? "—" : `${d.onTimePct.toFixed(0)}%`}</td>
                </tr>
              ))}
              {byDept.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted">ยังไม่มีงานที่ส่งเสร็จในช่วงนี้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* CFD */}
      <section className="card p-5">
        <h2 className="text-[15px] font-medium text-ink mb-1">Cumulative Flow — WIP ต่อสถานะ (14 วันล่าสุด)</h2>
        <p className="text-[12px] text-muted mb-4">งานที่ยังไม่ปิด แยกตามสถานะ ณ สิ้นแต่ละวัน (จากประวัติสถานะ)</p>
        <div className="flex items-end gap-1 h-40">
          {cfd.map((d) => {
            const total = cfdStatuses.reduce((s, st) => s + d.counts[st], 0);
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${d.date}: ${total} งาน`}>
                <div className="w-full flex flex-col justify-end" style={{ height: "100%" }}>
                  {cfdStatuses.map((st) =>
                    d.counts[st] > 0 ? (
                      <div
                        key={st}
                        className={`${STATUS_FILL[st]} w-full`}
                        style={{ height: `${(d.counts[st] / cfdMax) * 100}%` }}
                        title={`${STATUS_LABEL[st]}: ${d.counts[st]}`}
                      />
                    ) : null
                  )}
                </div>
                <span className="text-[10px] text-muted">{d.date}</span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4">
          {cfdStatuses.map((st) => (
            <span key={st} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
              <span className={`inline-block w-3 h-3 rounded-xs ${STATUS_FILL[st]}`} />
              {STATUS_LABEL[st]}
            </span>
          ))}
        </div>
      </section>

      {/* aging WIP */}
      <section className="card p-5">
        <h2 className="text-[15px] font-medium text-ink mb-1">งานค้างนาน (aging WIP)</h2>
        <p className="text-[12px] text-muted mb-4">งานที่ยังเปิดและอยู่สถานะเดิมเกิน 7 วัน — เรียงค้างนานสุดก่อน</p>
        {agingWip.length === 0 ? (
          <p className="text-[14px] text-muted py-3">ไม่มีงานค้างเกิน 7 วัน 🎉</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {agingWip.map((x) => (
              <li key={x.itemCode} className="py-2.5 flex items-center gap-3">
                <Link href={`/items/${x.itemCode}`} className="text-[14px] font-medium text-ink hover:text-link shrink-0">
                  {x.itemCode}
                </Link>
                <span className="text-[13px] text-body truncate flex-1 min-w-0">{x.partName}</span>
                <span className="text-[12px] text-muted hidden sm:inline">{STATUS_LABEL[x.status]}</span>
                <span className="text-[12px] text-muted hidden sm:inline">{x.ownerName}</span>
                <span className="chip bg-coral-soft text-coral shrink-0">ค้าง {x.days} วัน</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const valueColor = tone === "good" ? "text-forest" : tone === "bad" ? "text-coral" : "text-ink";
  return (
    <div className="card p-4 flex flex-col gap-0.5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={`text-[26px] font-medium leading-tight ${valueColor}`}>{value}</span>
      <span className="text-[11px] text-muted">{sub}</span>
    </div>
  );
}

function BucketRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-[13px] text-body">{label}</span>
      <div className="flex-1 bg-surface-strong rounded-sm h-3 overflow-hidden">
        <div className={`${color} h-full rounded-sm`} style={{ width: value > 0 ? `${Math.min(100, value * 20)}%` : "0%" }} />
      </div>
      <span className="w-6 text-right text-[14px] font-medium text-ink shrink-0">{value}</span>
    </div>
  );
}
