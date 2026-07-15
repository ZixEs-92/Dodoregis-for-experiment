import { prisma } from "@/lib/prisma";
import { isOverdue, isUrgent } from "@/lib/workflow";
import WeeklySchedule, { Person, DayHead, SchedItem } from "@/components/WeeklySchedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตารางงานรายสัปดาห์ — Dodoregis" };

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]; // getDay() 0=อา

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; person?: string }>;
}) {
  const sp = await searchParams;
  const offset = Number.isFinite(Number(sp.week)) ? parseInt(sp.week ?? "0", 10) : 0;

  const now = new Date();
  const base = startOfDay(now);
  base.setDate(base.getDate() + offset * 7);
  const sinceMon = (base.getDay() + 6) % 7; // ระยะจากวันจันทร์
  const monday = new Date(base);
  monday.setDate(base.getDate() - sinceMon);

  const dayStarts: Date[] = [];
  for (let i = 0; i < 7; i++) dayStarts.push(new Date(monday.getTime() + i * DAY_MS));
  const weekStart = dayStarts[0].getTime();
  const weekEnd = dayStarts[6].getTime() + DAY_MS - 1;

  const todayStart = startOfDay(now).getTime();
  const todayIndex = todayStart >= weekStart && todayStart <= weekEnd
    ? Math.floor((todayStart - weekStart) / DAY_MS)
    : -1;

  const days: DayHead[] = dayStarts.map((d, i) => ({
    label: DOW_TH[d.getDay()],
    date: d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit" }),
    isToday: i === todayIndex,
  }));

  // งานที่ยังไม่ปิด/ยกเลิก
  const items = await prisma.testItem.findMany({
    where: { status: { notIn: ["S8_CLOSED", "S10_CANCEL"] } },
    include: { owner: true },
    orderBy: [{ planEnd: "asc" }, { itemCode: "asc" }],
  });

  const personMap = new Map<number, Person>();
  for (const it of items) {
    const startIso = it.planStart ?? it.planEnd;
    const endIso = it.planEnd ?? it.planStart;
    const noPlan = !startIso || !endIso;

    // วันในสัปดาห์ที่งานนี้ครอบคลุม (ช่วง plan ตัดกับแต่ละวัน)
    const dayIndices: number[] = [];
    if (!noPlan) {
      const s = startOfDay(new Date(startIso!)).getTime();
      const e = startOfDay(new Date(endIso!)).getTime();
      for (let i = 0; i < 7; i++) {
        const ds = dayStarts[i].getTime();
        if (s <= ds && ds <= e) dayIndices.push(i);
      }
    }

    const schedItem: SchedItem = {
      itemCode: it.itemCode,
      partName: it.partName,
      status: it.status,
      planStart: it.planStart ? it.planStart.toISOString() : null,
      planEnd: it.planEnd ? it.planEnd.toISOString() : null,
      overdue: isOverdue(it.planEnd, it.status),
      urgent: isUrgent(it.remark),
      dayIndices,
      noPlan,
    };

    let p = personMap.get(it.ownerId);
    if (!p) {
      p = { ownerId: it.ownerId, name: it.owner.name, items: [], weekCount: 0, todayCount: 0, overdueCount: 0 };
      personMap.set(it.ownerId, p);
    }
    p.items.push(schedItem);
    if (dayIndices.length > 0) p.weekCount++;
    if (schedItem.overdue) p.overdueCount++;
    if (todayIndex >= 0 && (dayIndices.includes(todayIndex) || schedItem.overdue)) p.todayCount++;
  }

  const persons = [...personMap.values()].sort(
    (a, b) => b.weekCount + b.overdueCount - (a.weekCount + a.overdueCount) || a.name.localeCompare(b.name)
  );

  const weekLabel = `${dayStarts[0].toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit" })} – ${dayStarts[6].toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric" })}`;

  return (
    <WeeklySchedule
      persons={persons}
      days={days}
      todayIndex={todayIndex}
      offset={offset}
      weekLabel={weekLabel}
      focusPerson={sp.person ? Number(sp.person) : null}
    />
  );
}
