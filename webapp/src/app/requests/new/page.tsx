import { prisma } from "@/lib/prisma";
import NewRequestForm from "@/components/NewRequestForm";
import { guardPageCreate } from "@/lib/guard";
import { canEditTests } from "@/lib/roles";

// ตัวเลือกแผนกในฟอร์มขึ้นกับ session (dept_head เห็นเฉพาะแผนกที่คุม) — ต้อง dynamic เสมอ กันแคชข้ามคน
export const dynamic = "force-dynamic";
export const metadata = { title: "ลงงานใหม่ — Dodoregis" };

export default async function NewRequestPage() {
  const user = await guardPageCreate("/requests/new");
  const isRequester = user.role === "REQUESTER";
  const isDeptHead = user.role === "DEPT_HEAD";

  const [departments, members] = await Promise.all([
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  // dept_head เลือกแผนกได้เฉพาะแผนกที่ตัวเองคุม (ล็อกซ้ำฝั่ง server ใน createRequest)
  const headedDeptIds = new Set(user.headOfDepartments.map((d) => d.id));
  const selectableDepartments = isDeptHead
    ? departments.filter((d) => headedDeptIds.has(d.id))
    : departments;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">ลงทะเบียนงานทดสอบใหม่</h1>
        <p className="text-[14px] text-muted mt-0.5">
          {isRequester || isDeptHead
            ? "กรอกข้อมูลชิ้นงานที่จะส่งทดสอบ — ทีมแลปจะวางแผนวันที่ + ผู้รับผิดชอบให้หลังรับงาน"
            : "1 ใบรีเควส = 1 เลข TR-YYMM-### · แต่ละชิ้นงานเป็น item (TR-...-01, -02) ที่มีแผน/สถานะแยกกัน"}
        </p>
      </div>

      {isRequester && !user.department && (
        <div className="card p-4 border-coral bg-coral-soft text-[13px] text-coral">
          ⚠ บัญชีของคุณยังไม่ผูกกับแผนก — แจ้งผู้ดูแลระบบให้ตั้งค่าก่อนจึงจะลงงานได้
        </div>
      )}
      {isDeptHead && selectableDepartments.length === 0 && (
        <div className="card p-4 border-coral bg-coral-soft text-[13px] text-coral">
          ⚠ บัญชีของคุณยังไม่ได้กำหนดให้คุมแผนกใด — แจ้งผู้ดูแลระบบให้ตั้งค่าก่อนจึงจะลงงานได้
        </div>
      )}

      <NewRequestForm
        departments={selectableDepartments.map((d) => ({ id: d.id, name: d.name }))}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        today={today}
        lockedDept={
          isRequester && user.department
            ? { id: user.department.id, name: user.department.name }
            : null
        }
        showPlanning={canEditTests(user.role)}
      />
    </div>
  );
}
