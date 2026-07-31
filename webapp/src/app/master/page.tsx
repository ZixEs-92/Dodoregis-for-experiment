import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MasterSection from "@/components/MasterSection";
import SlaSettings from "@/components/SlaSettings";
import { guardPageAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตั้งค่าข้อมูลระบบ — Dodoregis" };

export default async function MasterPage() {
  await guardPageAdmin();
  const [departments, members, partLocations, finishedLocations] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.member.findMany({ orderBy: { name: "asc" } }),
    prisma.partLocation.findMany({ orderBy: { name: "asc" } }),
    prisma.finishedLocation.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">ตั้งค่าข้อมูลระบบ (Master Data)</h1>
          <p className="text-[14px] text-muted mt-0.5">
            จัดการรายการใน dropdown — เพิ่ม/แก้ชื่อ/ปิดใช้งาน · การปิดใช้งานจะซ่อนจากตัวเลือกใหม่ แต่ไม่กระทบงานเดิมที่อ้างอิงอยู่
          </p>
        </div>
        <MasterLink href="/settings/users" icon="👥" label="จัดการผู้ใช้" sub="บัญชี / บทบาท / รหัสผ่าน" />
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

function MasterLink({
  href,
  icon,
  label,
  sub,
}: {
  href: string;
  icon: string;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="card px-4 py-3 flex items-center gap-3 hover:bg-surface-soft transition-colors shrink-0"
    >
      <span className="text-[22px] leading-none">{icon}</span>
      <span className="flex flex-col">
        <span className="text-[14px] font-medium text-ink">{label} →</span>
        <span className="text-[11px] text-muted">{sub}</span>
      </span>
    </Link>
  );
}
