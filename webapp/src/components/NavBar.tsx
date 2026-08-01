"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { ROLE_LABEL, canCreateRequest } from "@/lib/roles";
import type { UserRole } from "@/generated/prisma/client";

const baseLinks = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/schedule", label: "ตารางงาน" },
  { href: "/requests", label: "รายการงาน" },
  { href: "/analytics", label: "วิเคราะห์" },
  { href: "/reports", label: "รายงาน" },
];
// เมนูเฉพาะ admin (หน้าเหล่านี้ถูก guard ไว้อยู่แล้ว — ซ่อนเมนูให้ UX ไม่งง)
const adminLinks = [
  { href: "/planning", label: "วางแผน" },
  { href: "/settings", label: "ตั้งค่าระบบ" },
];

export default function NavBar({
  unreadCount = 0,
  user = null,
}: {
  unreadCount?: number;
  user?: { name: string; role: UserRole } | null;
}) {
  const pathname = usePathname();
  const links = user?.role === "ADMIN" ? [...baseLinks, ...adminLinks] : baseLinks;

  return (
    <header className="sticky top-0 z-20 bg-canvas border-b border-hairline">
      <div className="max-w-6xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="grid place-items-center w-8 h-8 rounded-md bg-ink text-white text-sm font-semibold">
              D
            </span>
            <span className="font-semibold text-[15px] text-ink">Dodoregis</span>
          </Link>

          {/* เมนูข้อความ: เดสก์ท็อปเท่านั้น — มือถือใช้แถบล่างแทน */}
          <nav className="hidden flex-1 justify-center gap-1 sm:flex">
            {links.map((l) => {
              const active =
                l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 py-2 rounded-lg text-[14px] font-medium whitespace-nowrap transition-colors ${
                    active ? "bg-ink text-white" : "text-body hover:bg-surface-soft"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/scan"
              aria-label="สแกน QR ชิ้นงาน"
              title="สแกน QR ชิ้นงาน"
              className={`btn-icon hidden sm:grid ${
                pathname.startsWith("/scan") ? "bg-ink text-white hover:bg-ink" : ""
              }`}
            >
              <span className="text-[18px] leading-none">📷</span>
            </Link>

            <Link
              href="/notifications"
              aria-label={`แจ้งเตือน${unreadCount > 0 ? ` ${unreadCount} รายการที่ยังไม่อ่าน` : ""}`}
              title="แจ้งเตือน"
              className={`btn-icon relative hidden sm:grid ${
                pathname.startsWith("/notifications") ? "bg-ink text-white hover:bg-ink" : ""
              }`}
            >
              <span className="text-[18px] leading-none">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-white text-[11px] font-semibold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {canCreateRequest(user?.role) && (
              <Link href="/requests/new" className="btn-primary btn-sm hidden sm:inline-flex">
                + ลงงานใหม่
              </Link>
            )}

            {user ? (
              <div className="hidden items-center gap-2 pl-2 border-l border-hairline sm:flex">
                <div className="flex flex-col leading-tight text-right">
                  <span className="text-[13px] font-medium text-ink">{user.name}</span>
                  <span className="text-[11px] text-muted">{ROLE_LABEL[user.role]}</span>
                </div>
                <form action={logout}>
                  <button
                    type="submit"
                    aria-label="ออกจากระบบ"
                    title="ออกจากระบบ"
                    className="btn-icon"
                  >
                    <span className="text-[16px] leading-none">⏻</span>
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-[14px] font-medium text-body transition-colors hover:bg-surface-soft"
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
