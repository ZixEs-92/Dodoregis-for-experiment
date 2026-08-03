import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { guardPageAdmin } from "@/lib/guard";
import { isOverdue } from "@/lib/workflow";
import Icon, { type IconName } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";
export const metadata = { title: "ผู้ดูแลระบบ — Dodoregis" };

/**
 * ศูนย์รวมเครื่องมือของผู้ดูแล — เอาออกจากแถบเมนูหลักเพื่อไม่ให้รก
 * แต่ละการ์ดพ่วงตัวเลขจริงไว้ให้เห็นว่ามีอะไรต้องจัดการก่อนกดเข้าไป
 */
export default async function AdminHubPage() {
  await guardPageAdmin("/admin");

  const [unassigned, activeItems, userCount, deptCount, requestCount] = await Promise.all([
    prisma.testItem.count({
      where: { ownerId: null, status: { notIn: ["S8_CLOSED", "S10_CANCEL"] } },
    }),
    prisma.testItem.findMany({
      where: { status: { notIn: ["S8_CLOSED", "S10_CANCEL"] } },
      select: { planEnd: true, status: true },
    }),
    prisma.user.count({ where: { active: true } }),
    prisma.department.count({ where: { active: true } }),
    prisma.testRequest.count(),
  ]);
  const overdue = activeItems.filter((i) => isOverdue(i.planEnd, i.status)).length;

  const tools: {
    href: string;
    icon: IconName;
    title: string;
    desc: string;
    stat: string;
    urgent?: boolean;
  }[] = [
    {
      href: "/planning",
      icon: "clock",
      title: "คิวรอวางแผน",
      desc: "มอบหมายผู้รับผิดชอบ + ลงวันที่ให้งานที่แผนกส่งเข้ามา",
      stat: unassigned > 0 ? `${unassigned} รายการรอวางแผน` : "ไม่มีงานค้าง",
      urgent: unassigned > 0,
    },
    {
      href: "/analytics",
      icon: "chart",
      title: "วิเคราะห์ / KPI",
      desc: "throughput · ส่งตรงแผน · lead time · คอขวดแต่ละสถานะ · aging · CFD",
      stat: overdue > 0 ? `เลยกำหนดอยู่ ${overdue} รายการ` : "ไม่มีงานเลยกำหนด",
      urgent: overdue > 0,
    },
    {
      href: "/reports",
      icon: "file",
      title: "รายงาน + ส่งออก",
      desc: "สรุปรายปี/เดือน แยกตามแผนก·ผู้รีเควส·ผู้รับผิดชอบ + ดาวน์โหลด CSV",
      stat: `${requestCount} ใบรีเควสสะสม`,
    },
    {
      href: "/settings",
      icon: "settings",
      title: "ตั้งค่าระบบ",
      desc: "ข้อมูลระบบ (แผนก/ทีม/ที่เก็บ/SLA) · ผู้ใช้และสิทธิ์ · แจ้งเตือน LINE",
      stat: `${userCount} บัญชี · ${deptCount} แผนก`,
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">ผู้ดูแลระบบ</h1>
        <p className="text-[14px] text-muted mt-0.5">
          เครื่องมือจัดการทั้งหมดรวมไว้ที่นี่ — แถบเมนูด้านบนเก็บไว้เฉพาะงานที่ใช้ทุกวัน
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="card flex flex-col gap-2 p-5 transition-colors hover:bg-surface-soft"
          >
            <Icon name={t.icon} size={26} className="text-ink" />
            <span className="text-[16px] font-medium text-ink">{t.title} →</span>
            <span className="text-[13px] text-muted">{t.desc}</span>
            <span
              className={`mt-auto pt-2 text-[12px] font-medium ${
                t.urgent ? "text-coral" : "text-muted"
              }`}
            >
              {t.stat}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
