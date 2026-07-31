import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "เข้าสู่ระบบ — Dodoregis" };

export default async function LoginPage() {
  // ถ้าล็อกอินอยู่แล้ว ไม่ต้องแสดงหน้า login
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="max-w-sm mx-auto mt-6 sm:mt-12 flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid place-items-center w-11 h-11 rounded-lg bg-ink text-white text-lg font-semibold">
          D
        </span>
        <h1 className="text-[22px] font-semibold text-ink">เข้าสู่ระบบ Dodoregis</h1>
        <p className="text-[13px] text-muted">ระบบลงทะเบียนและติดตามงานทดสอบ</p>
      </div>

      <div className="card p-5 sm:p-6">
        <LoginForm />
      </div>

      <p className="text-[12px] text-muted text-center">
        ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบเพื่อสร้างให้
      </p>
    </div>
  );
}
