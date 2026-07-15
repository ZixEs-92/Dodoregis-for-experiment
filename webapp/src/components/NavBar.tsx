"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/schedule", label: "ตารางงาน" },
  { href: "/requests", label: "รายการงาน" },
  { href: "/analytics", label: "วิเคราะห์" },
  { href: "/master", label: "ตั้งค่าระบบ" },
];

export default function NavBar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

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

            <Link href="/requests/new" className="btn-primary btn-sm">
              + ลงงานใหม่
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
