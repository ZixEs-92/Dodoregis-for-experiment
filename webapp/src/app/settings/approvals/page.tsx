import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { guardPageAdmin } from "@/lib/guard";
import { isDeptStageOn } from "@/lib/appSettings";
import DeptStageToggle from "@/components/DeptStageToggle";

// สิทธิ์เข้าหน้านี้ขึ้นกับ session — ต้อง dynamic เสมอ กัน Next แคชผลของคนแรกไปให้คนถัดไปที่ URL เดียวกัน
export const dynamic = "force-dynamic";
export const metadata = { title: "ตั้งค่าการอนุมัติ — Dodoregis" };

export default async function ApprovalSettingsPage() {
  await guardPageAdmin("/settings/approvals");

  const [deptStageOn, departments, labHeads] = await Promise.all([
    isDeptStageOn(),
    prisma.department.findMany({
      where: { active: true },
      include: { heads: { orderBy: { displayName: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "LAB_HEAD" },
      orderBy: { displayName: "asc" },
    }),
  ]);

  const noHeadDepts = departments.filter((d) => d.heads.length === 0);

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Link href="/settings" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปตั้งค่าระบบ
      </Link>
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">ตั้งค่าการอนุมัติ</h1>
        <p className="text-[14px] text-muted mt-0.5">
          เปิด/ปิดชั้นอนุมัติหัวหน้าแผนก · ดูว่าใครเป็นหัวหน้าแผนก/หัวหน้าแลปบ้าง
        </p>
      </div>

      <section className="card p-5">
        <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide pb-3 border-b border-hairline mb-4">
          ชั้นอนุมัติ
        </h2>
        <DeptStageToggle initialOn={deptStageOn} />
      </section>

      {noHeadDepts.length > 0 && (
        <div className="card p-4 border-coral bg-coral-soft text-[13px] text-coral">
          ⚠ แผนก {noHeadDepts.map((d) => d.name).join(", ")} ยังไม่มีหัวหน้าแผนก — ใบใหม่ของแผนกนี้จะข้าม
          ไปรอหัวหน้าแลปโดยอัตโนมัติ (กันใบค้างไม่มีคนเซ็น) ไปที่{" "}
          <Link href="/settings/users" className="underline">จัดการผู้ใช้</Link> เพื่อกำหนดหัวหน้าแผนก
        </div>
      )}

      <section className="card p-5">
        <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide pb-3 border-b border-hairline mb-4">
          หัวหน้าแผนก (ชั้น 1) — ตามแผนก
        </h2>
        <ul className="flex flex-col gap-3">
          {departments.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-medium text-ink w-32 shrink-0">{d.name}</span>
              {d.heads.length === 0 ? (
                <span className="chip bg-coral-soft text-coral">ยังไม่มีหัวหน้า</span>
              ) : (
                d.heads.map((h) => (
                  <span key={h.id} className="chip bg-surface-strong text-ink">{h.displayName}</span>
                ))
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide pb-3 border-b border-hairline mb-4">
          หัวหน้าแลป (ชั้น 2) — เห็นได้ทุกแผนก
        </h2>
        {labHeads.length === 0 ? (
          <p className="text-[13px] text-mustard-deep">
            ยังไม่มีบัญชีหัวหน้าแลป — ใบที่ถึงชั้นนี้จะรอ admin เซ็นแทนไปก่อน ไปที่{" "}
            <Link href="/settings/users" className="underline text-link">จัดการผู้ใช้</Link> เพื่อสร้างบัญชี
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {labHeads.map((h) => (
              <li key={h.id} className="chip bg-surface-strong text-ink">{h.displayName}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
