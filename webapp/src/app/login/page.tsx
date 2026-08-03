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

  const { next: nextRaw } = await searchParams;
  // ?next= มาจาก URL — รับเฉพาะ path ภายใน (กติกาเดียวกับตอน redirect ใน login action)
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : undefined;

  return (
    <div className="max-w-sm mx-auto mt-4 sm:mt-10 flex flex-col gap-5 pb-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid place-items-center w-11 h-11 rounded-lg bg-ink text-white text-lg font-semibold">
          D
        </span>
        <h1 className="text-[22px] font-semibold text-ink">Dodoregis</h1>
        <p className="text-[13px] text-muted">ระบบลงทะเบียนและติดตามงานทดสอบ</p>
      </div>

      {/* มาจากการสแกน QR หรือกดลิงก์งาน — บอกให้รู้ว่าล็อกอินแล้วจะพากลับไปที่เดิม */}
      {next && (
        <div className="card p-4 flex items-start gap-3 bg-info-soft border-info">
          <span className="text-[22px] leading-none">📷</span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-ink">
              เข้าสู่ระบบก่อนเพื่อดูงานนี้
            </span>
            <span className="text-[12px] text-muted">
              ล็อกอินแล้วระบบจะพากลับไปที่ <span className="font-mono">{next}</span> ให้เอง
            </span>
          </div>
        </div>
      )}

      <div className="card p-5 sm:p-6">
        <LoginForm next={next} />
      </div>

      <p className="text-[12px] text-muted text-center">
        ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบเพื่อสร้างให้
      </p>
    </div>
  );
}
