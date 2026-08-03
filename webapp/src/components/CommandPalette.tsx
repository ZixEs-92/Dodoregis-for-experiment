"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/workflow";
import type { RequestStatus, UserRole } from "@/generated/prisma/client";
import { canCreateRequest, canEditTests, canPlanAndManage } from "@/lib/roles";

type Hit = {
  itemCode: string;
  title: string;
  partName: string;
  status: RequestStatus;
  ownerName: string | null;
};

type PageCmd = { href: string; label: string; icon: IconName };

/**
 * แถบคำสั่งด่วน — กด Ctrl/⌘ + K จากหน้าไหนก็ได้
 * พิมพ์รหัสงานหรือชื่อชิ้นงานเพื่อกระโดดไปทันที หรือเลือกหน้าที่ต้องการ
 * แก้ปัญหาเดิมที่ต้องเข้ารายการงาน → ตั้งตัวกรอง → กดค้นหา ทุกครั้ง
 */
export default function CommandPalette({ role = null }: { role?: UserRole | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pages = useMemo<PageCmd[]>(
    () => [
      { href: "/", label: "หน้าหลัก", icon: "home" },
      { href: "/board", label: "บอร์ดงาน", icon: "board" },
      { href: "/requests", label: "รายการงาน", icon: "list" },
      { href: "/scan", label: "สแกน QR ชิ้นงาน", icon: "scan" },
      { href: "/schedule", label: "ตารางงาน (เดือน/สัปดาห์)", icon: "calendar" },
      { href: "/notifications", label: "แจ้งเตือน", icon: "bell" },
      ...(canCreateRequest(role)
        ? ([{ href: "/requests/new", label: "ลงทะเบียนงานใหม่", icon: "plus" }] as PageCmd[])
        : []),
      // หน้าของทีมแลป — วิศวกรเข้าได้ด้วย ไม่ใช่เฉพาะ admin
      ...(canEditTests(role)
        ? ([
            { href: "/analytics", label: "วิเคราะห์ / KPI", icon: "chart" },
            { href: "/reports", label: "รายงาน + export", icon: "file" },
            { href: "/labels", label: "พิมพ์ QR Label", icon: "scan" },
          ] as PageCmd[])
        : []),
      ...(canPlanAndManage(role)
        ? ([
            { href: "/admin", label: "ผู้ดูแลระบบ (รวมเครื่องมือ)", icon: "settings" },
            { href: "/planning", label: "คิวรอวางแผน", icon: "clock" },
            { href: "/settings", label: "ตั้งค่าระบบ", icon: "settings" },
          ] as PageCmd[])
        : []),
    ],
    [role],
  );

  const matchedPages = useMemo(() => {
    if (!q.trim()) return pages;
    const needle = q.trim().toLowerCase();
    return pages.filter((p) => p.label.toLowerCase().includes(needle));
  }, [pages, q]);

  // แสดงผลค้นหาเฉพาะเมื่อพิมพ์ยาวพอ — ไม่ต้องเคลียร์ state ใน effect
  const visibleHits = q.trim().length >= 2 ? hits : [];
  const total = visibleHits.length + matchedPages.length;

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
    setCursor(0);
  }, []);

  // เปิด/ปิดด้วยคีย์บอร์ด
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (o) {
            setQ("");
            setHits([]);
            setCursor(0);
          }
          return !o;
        });
      } else if (e.key === "Escape") {
        close();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  // โฟกัสช่องพิมพ์เมื่อเปิด (สั่ง DOM — ไม่ใช่การตั้ง state)
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // ค้นหางาน (หน่วงเล็กน้อยกันยิงถี่)
  useEffect(() => {
    const needle = q.trim();
    if (!open || needle.length < 2) return;

    let alive = true;
    const timer = setTimeout(async () => {
      if (!alive) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(needle)}`);
        const data = (await res.json()) as { items: Hit[] };
        if (alive) setHits(data.items ?? []);
      } catch {
        if (alive) setHits([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, open]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [router, close],
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (total === 0 ? 0 : (c + 1) % total));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (total === 0 ? 0 : (c - 1 + total) % total));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (cursor < visibleHits.length) {
        const hit = visibleHits[cursor];
        if (hit) go(`/items/${hit.itemCode}`);
      } else {
        const page = matchedPages[cursor - visibleHits.length];
        if (page) go(page.href);
      }
    }
  }

  return (
    <>
      {/* ปุ่มเปิดสำหรับคนที่ไม่ใช้คีย์บอร์ด (เดสก์ท็อป) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-[13px] text-muted transition-colors hover:bg-canvas lg:inline-flex"
      >
        <Icon name="search" size={16} />
        ค้นหางาน
        <kbd className="rounded border border-hairline bg-canvas px-1.5 py-0.5 text-[11px] font-medium">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-3 pt-[10vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ค้นหาและคำสั่งด่วน"
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg bg-canvas shadow-xl"
          >
            <div className="flex items-center gap-2 border-b border-hairline px-4">
              <Icon name="search" className="text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={onInputKey}
                placeholder="พิมพ์รหัสงาน ชื่อชิ้นงาน หรือชื่อหน้า…"
                className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/70"
              />
              {loading && <span className="text-[12px] text-muted">กำลังค้น…</span>}
            </div>

            <div className="max-h-[60vh] overflow-y-auto py-1">
              {visibleHits.length > 0 && (
                <Group label="งานทดสอบ">
                  {visibleHits.map((h, i) => (
                    <Row
                      key={h.itemCode}
                      active={cursor === i}
                      onSelect={() => go(`/items/${h.itemCode}`)}
                      onHover={() => setCursor(i)}
                    >
                      <span className="font-mono text-[12px] font-semibold text-ink">
                        {h.itemCode}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-body">
                        {h.title}
                      </span>
                      <span className={`chip ${STATUS_COLOR[h.status]} shrink-0`}>
                        {STATUS_LABEL[h.status]}
                      </span>
                    </Row>
                  ))}
                </Group>
              )}

              {matchedPages.length > 0 && (
                <Group label="ไปที่หน้า">
                  {matchedPages.map((p, i) => {
                    const idx = visibleHits.length + i;
                    return (
                      <Row
                        key={p.href}
                        active={cursor === idx}
                        onSelect={() => go(p.href)}
                        onHover={() => setCursor(idx)}
                      >
                        <Icon name={p.icon} size={16} className="text-muted" />
                        <span className="flex-1 text-[13px] text-body">{p.label}</span>
                      </Row>
                    );
                  })}
                </Group>
              )}

              {q.trim().length >= 2 && !loading && visibleHits.length === 0 && matchedPages.length === 0 && (
                <p className="px-4 py-8 text-center text-[13px] text-muted">
                  ไม่พบงานหรือหน้าที่ตรงกับ “{q}”
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-hairline px-4 py-2 text-[11px] text-muted">
              <span>↑↓ เลื่อน</span>
              <span>↵ เปิด</span>
              <span>Esc ปิด</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  active,
  onSelect,
  onHover,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
        active ? "bg-surface-soft" : ""
      }`}
    >
      {children}
    </button>
  );
}
