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
  { href: "/master", label: "ตั้งค่าระบบ" },
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
            <span className="font-semibold text-[15px] text-ink hidden sm:inline">
              Dodoregis
            </span>
          </Link>

          <nav className="flex items-center gap-1 flex-1 justify-end sm:justify-center">
            {links.map((l) => {
              const active =
                l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-2 rounded-lg text-[14px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-ink text-white"
                      : "text-body hover:bg-surface-soft"
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
              title="สแกน QR ชิ้นงาน"
              className={`grid place-items-center w-10 h-10 rounded-lg transition-colors ${
                pathname.startsWith("/scan")
                  ? "bg-ink text-white"
                  : "text-body hover:bg-surface-soft"
              }`}
            >
              <span className="text-[18px] leading-none">📷</span>
            </Link>

            <Link
              href="/notifications"
              title="แจ้งเตือน"
              className={`relative grid place-items-center w-10 h-10 rounded-lg transition-colors ${
                pathname.startsWith("/notifications")
                  ? "bg-ink text-white"
                  : "text-body hover:bg-surface-soft"
              }`}
            >
              <span className="text-[18px] leading-none">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-white text-[11px] font-semibold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {canCreateRequest(user?.role) && (
              <Link href="/requests/new" className="btn-primary btn-sm">
                + ลงงานใหม่
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2 pl-1 sm:pl-2 sm:border-l sm:border-hairline">
                <div className="hidden sm:flex flex-col leading-tight text-right">
                  <span className="text-[13px] font-medium text-ink">{user.name}</span>
                  <span className="text-[11px] text-muted">{ROLE_LABEL[user.role]}</span>
                </div>
                <form action={logout}>
                  <button
                    type="submit"
                    title="ออกจากระบบ"
                    className="grid place-items-center w-10 h-10 rounded-lg text-body hover:bg-surface-soft transition-colors"
                  >
                    <span className="text-[16px] leading-none">⏻</span>
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="grid place-items-center h-10 px-3 rounded-lg text-[14px] font-medium text-body hover:bg-surface-soft transition-colors whitespace-nowrap"
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
