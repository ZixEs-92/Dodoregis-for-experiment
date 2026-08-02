import { prisma } from "@/lib/prisma";
import { isOverdue, isUrgent } from "@/lib/workflow";
import { testTitle } from "@/lib/format";
import { guardPageUser } from "@/lib/guard";
import WeeklySchedule, { Person, DayHead, SchedItem } from "@/components/WeeklySchedule";
import MonthSchedule, { MonthCell, MonthItem } from "@/components/MonthSchedule";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตารางงาน — Dodoregis" };

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]; // getDay() 0=อา

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** วันจันทร์ของสัปดาห์ที่วันนั้นอยู่ */
function mondayOf(d: Date) {
  const base = startOfDay(d);
  const back = (base.getDay() + 6) % 7;
  const mon = new Date(base);
  mon.setDate(base.getDate() - back);
  return mon;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; month?: string; person?: string }>;
}) {
  // ตารางงานเป็นข้อมูลภายในทีม (ใครทำอะไร โหลดงานแต่ละคน) — ต้องล็อกอินก่อน
  const user = await guardPageUser("/schedule");

  const sp = await searchParams;
  const view = sp.view === "week" ? "week" : "month"; // ค่าเริ่มต้น = เดือน

  // requester เห็นเฉพาะงานของแผนกตัวเอง · ทีมแลป (engineer/admin) เห็นทุกงาน
  const deptScoped = user.role === "REQUESTER" && user.departmentId != null;
  const where: Prisma.TestItemWhereInput = {
    status: { notIn: ["S8_CLOSED", "S10_CANCEL"] },
    ...(deptScoped ? { request: { requestDeptId: user.departmentId! } } : {}),
  };

  // งานที่ยังไม่ปิด/ยกเลิก
  const items = await prisma.testItem.findMany({
    where,
    include: { owner: true },
    orderBy: [{ planEnd: "asc" }, { itemCode: "asc" }],
  });

  const now = new Date();
  const todayStart = startOfDay(now).getTime();

  // ── มุมมองเดือน ─────────────────────────────────────────
  if (view === "month") {
    const monthOffset = Number.isFinite(Number(sp.month)) ? parseInt(sp.month ?? "0", 10) : 0;
    const anchor = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const monthIndex = anchor.getMonth();

    // ตารางเริ่มที่วันจันทร์ของสัปดาห์ที่ 1 ของเดือน จนครอบวันสุดท้ายของเดือน
    const gridStart = mondayOf(anchor);
    const lastOfMonth = new Date(anchor.getFullYear(), monthIndex + 1, 0);
    const gridEnd = mondayOf(lastOfMonth);
    gridEnd.setDate(gridEnd.getDate() + 6);
    const dayCount = Math.round((gridEnd.getTime() - gridStart.getTime()) / DAY_MS) + 1;

    const cells: MonthCell[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(gridStart.getTime() + i * DAY_MS);
      cells.push({
        dayNum: d.getDate(),
        inMonth: d.getMonth() === monthIndex,
        isToday: startOfDay(d).getTime() === todayStart,
        dateLabel: d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit" }),
      });
    }

    const monthItems: MonthItem[] = items.map((it) => {
      const s = it.planStart ?? it.planEnd;
      const e = it.planEnd ?? it.planStart;
      const dayIndices: number[] = [];
      if (s && e) {
        const sMs = startOfDay(new Date(s)).getTime();
        const eMs = startOfDay(new Date(e)).getTime();
        for (let i = 0; i < dayCount; i++) {
          const ds = gridStart.getTime() + i * DAY_MS;
          if (sMs <= ds && ds <= eMs) dayIndices.push(i);
        }
      }
      return {
        itemCode: it.itemCode,
        label: testTitle(it.testName, it.testDetail) || it.partName,
        ownerName: it.owner?.name ?? "ยังไม่มอบหมาย",
        status: it.status,
        overdue: isOverdue(it.planEnd, it.status),
        urgent: isUrgent(it.remark),
        dayIndices,
      };
    });

    // แต่ละแถวของตารางเดือน = 1 สัปดาห์ → คำนวณ ?week= (ระยะห่างจากสัปดาห์ปัจจุบัน)
    const thisMonday = mondayOf(now).getTime();
    const weekRows = Math.ceil(dayCount / 7);
    const weekOffsets = Array.from({ length: weekRows }, (_, w) =>
      Math.round((gridStart.getTime() + w * 7 * DAY_MS - thisMonday) / (7 * DAY_MS)),
    );

    const monthLabel = anchor.toLocaleDateString("th-TH", {
      timeZone: "Asia/Bangkok",
      month: "long",
      year: "numeric",
    });

    return (
      <MonthSchedule
        cells={cells}
        items={monthItems}
        weekOffsets={weekOffsets}
        monthLabel={monthLabel}
        prevHref={`/schedule?month=${monthOffset - 1}`}
        nextHref={`/schedule?month=${monthOffset + 1}`}
        todayHref="/schedule"
        isThisMonth={monthOffset === 0}
      />
    );
  }

  // ── มุมมองสัปดาห์ (เจาะจากเดือน) ─────────────────────────
  const offset = Number.isFinite(Number(sp.week)) ? parseInt(sp.week ?? "0", 10) : 0;
  const base = startOfDay(now);
  base.setDate(base.getDate() + offset * 7);
  const monday = mondayOf(base);

  const dayStarts: Date[] = [];
  for (let i = 0; i < 7; i++) dayStarts.push(new Date(monday.getTime() + i * DAY_MS));
  const weekStart = dayStarts[0].getTime();
  const weekEnd = dayStarts[6].getTime() + DAY_MS - 1;

  const todayIndex =
    todayStart >= weekStart && todayStart <= weekEnd
      ? Math.floor((todayStart - weekStart) / DAY_MS)
      : -1;

  const days: DayHead[] = dayStarts.map((d, i) => ({
    label: DOW_TH[d.getDay()],
    date: d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit" }),
    isToday: i === todayIndex,
  }));

  const personMap = new Map<number, Person>();
  for (const it of items) {
    const startIso = it.planStart ?? it.planEnd;
    const endIso = it.planEnd ?? it.planStart;
    const noPlan = !startIso || !endIso;

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
      testTitle: testTitle(it.testName, it.testDetail),
      status: it.status,
      planStart: it.planStart ? it.planStart.toISOString() : null,
      planEnd: it.planEnd ? it.planEnd.toISOString() : null,
      overdue: isOverdue(it.planEnd, it.status),
      urgent: isUrgent(it.remark),
      dayIndices,
      noPlan,
    };

    // item ที่ยังไม่มอบหมาย รวมไว้ในแถว "ยังไม่มอบหมาย" (id 0)
    const key = it.ownerId ?? 0;
    let p = personMap.get(key);
    if (!p) {
      p = { ownerId: key, name: it.owner?.name ?? "⏳ ยังไม่มอบหมาย", items: [], weekCount: 0, todayCount: 0, overdueCount: 0 };
      personMap.set(key, p);
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
