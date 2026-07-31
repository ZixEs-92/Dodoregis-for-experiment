import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import UsersManager, { UserRow } from "@/components/UsersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "จัดการผู้ใช้ — Dodoregis" };

function fmtDateTime(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function UsersPage() {
  const me = await requireRole("ADMIN");

  const [users, departments, members] = await Promise.all([
    prisma.user.findMany({
      include: { department: true, member: true },
      orderBy: [{ active: "desc" }, { role: "asc" }, { username: "asc" }],
    }),
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    active: u.active,
    departmentName: u.department?.name ?? null,
    memberName: u.member?.name ?? null,
    lastLoginAt: fmtDateTime(u.lastLoginAt),
  }));

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Link href="/master" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปตั้งค่าระบบ
      </Link>
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">จัดการผู้ใช้</h1>
        <p className="text-[14px] text-muted mt-0.5">
          สร้างบัญชี / ตั้งรหัสใหม่ / เปิด-ปิดการใช้งาน · การ &quot;ดู&quot; ข้อมูลเปิดให้ทุกคนโดยไม่ต้องล็อกอิน
          — สร้างบัญชีเฉพาะคนที่ต้องลงงานหรือแก้ไข
        </p>
      </div>

      <UsersManager
        users={rows}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        currentUserId={me.id}
      />
    </div>
  );
}
