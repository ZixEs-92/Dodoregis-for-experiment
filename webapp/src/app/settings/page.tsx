import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { guardPageAdmin } from "@/lib/guard";
import { lineConfig } from "@/lib/line";
import Icon, { type IconName } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตั้งค่าระบบ — Dodoregis" };

export default async function SettingsHubPage() {
  await guardPageAdmin("/settings");

  const [deptCount, memberCount, partLocCount, finishedLocCount, userCount] =
    await Promise.all([
      prisma.department.count({ where: { active: true } }),
      prisma.member.count({ where: { active: true } }),
      prisma.partLocation.count({ where: { active: true } }),
      prisma.finishedLocation.count({ where: { active: true } }),
      prisma.user.count({ where: { active: true } }),
    ]);
  const line = lineConfig();
  const lineReady = line.hasToken && line.hasDestination;

  const sections: {
    href: string;
    icon: IconName;
    title: string;
    desc: string;
    stat: string;
    warn?: boolean;
  }[] = [
    {
      href: "/master",
      icon: "database",
      title: "ข้อมูลระบบ",
      desc: "แผนก · รายชื่อทีม · ตำแหน่งจัดเก็บ · เป้า SLA รายแผนก",
      stat: `${deptCount} แผนก · ${memberCount} คน · ${partLocCount + finishedLocCount} ตำแหน่งเก็บ`,
    },
    {
      href: "/settings/users",
      icon: "users",
      title: "ผู้ใช้และสิทธิ์",
      desc: "สร้างบัญชี · กำหนดบทบาท · ตั้งรหัสใหม่ · เปิด-ปิดการใช้งาน",
      stat: `${userCount} บัญชีที่ใช้งานอยู่`,
    },
    {
      href: "/settings/line",
      icon: "message",
      title: "แจ้งเตือนผ่าน LINE",
      desc: "ผูก LINE Official Account เพื่อส่งแจ้งเตือนงานใกล้/เลยกำหนด",
      stat: lineReady ? "ตั้งค่าแล้ว พร้อมส่ง" : "ยังไม่ได้ตั้งค่า",
      warn: !lineReady,
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Link href="/admin" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปหน้าผู้ดูแลระบบ
      </Link>
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">ตั้งค่าระบบ</h1>
        <p className="text-[14px] text-muted mt-0.5">
          ทุกอย่างที่ต้องตั้งค่าอยู่ในหน้านี้ที่เดียว
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card flex flex-col gap-2 p-5 transition-colors hover:bg-surface-soft"
          >
            <Icon name={s.icon} size={26} className="text-ink" />
            <span className="text-[16px] font-medium text-ink">{s.title} →</span>
            <span className="text-[13px] text-muted">{s.desc}</span>
            <span
              className={`mt-auto pt-2 text-[12px] font-medium ${
                s.warn ? "text-mustard-deep" : "text-muted"
              }`}
            >
              {s.stat}
            </span>
          </Link>
        ))}
      </div>

      <div className="card p-4 text-[13px] text-muted">
        💡 การ &quot;ดู&quot; ข้อมูลเปิดให้ทุกคนโดยไม่ต้องล็อกอิน (เพื่อให้สแกน QR หน้างานได้สะดวก) —
        สร้างบัญชีเฉพาะคนที่ต้องลงงานหรือแก้ไขข้อมูลเท่านั้น
      </div>
    </div>
  );
}
