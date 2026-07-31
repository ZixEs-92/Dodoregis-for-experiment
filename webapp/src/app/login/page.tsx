import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "เข้าสู่ระบบ — Dodoregis" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // ถ้าล็อกอินอยู่แล้ว ไม่ต้องแสดงหน้า login
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { next } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-4 sm:mt-10 flex flex-col gap-5 pb-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid place-items-center w-11 h-11 rounded-lg bg-ink text-white text-lg font-semibold">
          D
        </span>
        <h1 className="text-[22px] font-semibold text-ink">Dodoregis</h1>
        <p className="text-[13px] text-muted">ระบบลงทะเบียนและติดตามงานทดสอบ</p>
      </div>

      {/* ทางลัดสำหรับคนหน้างาน — ดู/สแกนได้เลย ไม่ต้องล็อกอิน */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/scan"
          className="card p-4 flex flex-col items-center gap-1.5 text-center hover:bg-surface-soft transition-colors"
        >
          <span className="text-[26px] leading-none">📷</span>
          <span className="text-[14px] font-medium text-ink">สแกน QR ชิ้นงาน</span>
          <span className="text-[11px] text-muted">เปิดดูงานจาก label ได้ทันที</span>
        </Link>
        <Link
          href="/requests"
          className="card p-4 flex flex-col items-center gap-1.5 text-center hover:bg-surface-soft transition-colors"
        >
          <span className="text-[26px] leading-none">📋</span>
          <span className="text-[14px] font-medium text-ink">ดูรายการงาน</span>
          <span className="text-[11px] text-muted">เข้าดูได้เลย ไม่ต้องล็อกอิน</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex-1 h-px bg-hairline" />
        <span className="text-[12px] text-muted">เข้าสู่ระบบเพื่อลงงาน / แก้ไข</span>
        <span className="flex-1 h-px bg-hairline" />
      </div>

      <div className="card p-5 sm:p-6">
        <LoginForm next={next} />
      </div>

      <p className="text-[12px] text-muted text-center">
        ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบเพื่อสร้างให้
      </p>
    </div>
  );
}
