"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { ROLE_LABEL, canCreateRequest, canPlanAndManage } from "@/lib/roles";
import Icon, { type IconName } from "@/components/ui/Icon";
import type { UserRole } from "@/generated/prisma/client";

/**
 * แถบเมนูล่างสำหรับมือถือ — 5 ช่อง โดยให้ "สแกน" อยู่กลางเพราะเป็นงานที่ทำบ่อยที่สุดหน้างาน
 * เมนูที่เหลือเก็บในแผ่นเลื่อน "เพิ่มเติม" (เดสก์ท็อปใช้แถบบนเหมือนเดิม จึงซ่อนตัวนี้)
 */

type NavUser = { name: string; role: UserRole } | null;

export default function BottomNav({
  user = null,
  unreadCount = 0,
}: {
  user?: NavUser;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = () => setSheetOpen(false);

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSheetOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const isOn = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const moreLinks: { href: string; label: string; icon: IconName }[] = [
    { href: "/board", label: "บอร์ดงาน", icon: "board" },
    // ตารางงานต้องล็อกอินก่อน — ไม่ต้องโชว์ให้คนที่สแกน QR เข้ามาเฉย ๆ
    ...(user ? ([{ href: "/schedule", label: "ตารางงาน", icon: "calendar" }] as const) : []),
    ...(canPlanAndManage(user?.role)
      ? ([{ href: "/admin", label: "ผู้ดูแลระบบ", icon: "settings" }] as const)
      : []),
  ];

  return (
    <>
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <div className="grid grid-cols-5">
          <Tab href="/" label="หน้าหลัก" icon="home" on={isOn("/")} />
          <Tab href="/requests" label="งาน" icon="list" on={isOn("/requests")} />

          <Link
            href="/scan"
            aria-label="สแกน QR ชิ้นงาน"
            className="flex flex-col items-center justify-center gap-0.5 py-1.5"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white">
              <Icon name="scan" size={22} />
            </span>
            <span className="text-[10px] font-medium text-ink">สแกน</span>
          </Link>

          <Tab
            href="/notifications"
            label="แจ้งเตือน"
            icon="bell"
            on={isOn("/notifications")}
            badge={unreadCount}
          />

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-muted"
          >
            <Icon name="menu" size={18} />
            <span className="text-[10px] font-medium">เพิ่มเติม</span>
          </button>
        </div>
      </nav>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-ink/40 sm:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="เมนูเพิ่มเติม"
            className="w-full rounded-t-lg bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-surface-strong" />

            {user ? (
              <div className="mb-3 flex items-center gap-3 rounded-lg bg-surface-soft p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-strong text-[13px] font-medium text-ink">
                  {user.name.slice(0, 1)}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[14px] font-medium text-ink">{user.name}</span>
                  <span className="text-[12px] text-muted">{ROLE_LABEL[user.role]}</span>
                </span>
              </div>
            ) : (
              <Link href="/login" onClick={closeSheet} className="btn-primary mb-3 w-full">
                เข้าสู่ระบบ
              </Link>
            )}

            {canCreateRequest(user?.role) && (
              <Link href="/requests/new" onClick={closeSheet} className="btn-primary mb-3 w-full">
                + ลงงานใหม่
              </Link>
            )}

            <ul className="flex flex-col">
              {moreLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={closeSheet}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-[15px] text-ink hover:bg-surface-soft"
                  >
                    <Icon name={l.icon} className="text-muted" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            {user && (
              <form action={logout} className="mt-2 border-t border-hairline pt-2">
                <button
                  type="submit"
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-[15px] text-coral hover:bg-coral-soft"
                >
                  <Icon name="logout" />
                  ออกจากระบบ
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Tab({
  href,
  label,
  icon,
  on,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: IconName;
  on: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 ${
        on ? "text-ink" : "text-muted"
      }`}
    >
      <Icon name={icon} size={18} />
      <span className="text-[10px] font-medium">{label}</span>
      {badge > 0 && (
        <span className="absolute right-1/2 top-1.5 grid h-[17px] min-w-[17px] translate-x-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-semibold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
