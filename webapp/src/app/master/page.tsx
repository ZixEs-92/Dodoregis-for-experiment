import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MasterSection from "@/components/MasterSection";
import SlaSettings from "@/components/SlaSettings";
import { guardPageAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตั้งค่าข้อมูลระบบ — Dodoregis" };

export default async function MasterPage() {
  await guardPageAdmin("/master");
  const [departments, members, partLocations, finishedLocations] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.member.findMany({ orderBy: { name: "asc" } }),
    prisma.partLocation.findMany({ orderBy: { name: "asc" } }),
    prisma.finishedLocation.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/settings" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปตั้งค่าระบบ
      </Link>
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">ข้อมูลระบบ (Master Data)</h1>
        <p className="text-[14px] text-muted mt-0.5">
          จัดการรายการใน dropdown — เพิ่ม/แก้ชื่อ/ปิดใช้งาน · การปิดใช้งานจะซ่อนจากตัวเลือกใหม่ แต่ไม่กระทบงานเดิมที่อ้างอิงอยู่
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MasterSection
          kind="department"
          title="แผนก"
          rows={departments.map((d) => ({ id: d.id, name: d.name, active: d.active }))}
        />
        <MasterSection
          kind="member"
          title="ทีมงาน"
          withRole
          rows={members.map((m) => ({ id: m.id, name: m.name, role: m.role, active: m.active }))}
        />
        <MasterSection
          kind="partLocation"
          title="ตำแหน่งเก็บพาร์ท"
          rows={partLocations.map((p) => ({ id: p.id, name: p.name, active: p.active }))}
        />
        <MasterSection
          kind="finishedLocation"
          title="ตำแหน่งเก็บชิ้นงานเสร็จ"
          rows={finishedLocations.map((f) => ({ id: f.id, name: f.name, active: f.active }))}
        />
      </div>

      <SlaSettings
        departments={departments.map((d) => ({ id: d.id, name: d.name, slaDays: d.slaDays }))}
      />
    </div>
  );
}

