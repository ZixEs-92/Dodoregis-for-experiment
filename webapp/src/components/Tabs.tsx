"use client";

import { useState } from "react";

export type TabDef = { id: string; label: string; content: React.ReactNode; badge?: number };

export default function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto -mx-1 px-1">
        <div role="tablist" className="inline-flex gap-1 rounded-lg border border-hairline bg-canvas p-1 min-w-full sm:min-w-0">
          {tabs.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.id)}
                className={`whitespace-nowrap rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  on ? "bg-ink text-white" : "text-muted hover:text-ink hover:bg-surface-soft"
                }`}
              >
                {t.label}
                {t.badge != null && t.badge > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] ${on ? "bg-white/25 text-white" : "bg-surface-strong text-ink"}`}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* render ทุก panel แต่ซ่อนตัวที่ไม่ active (คง state ของฟอร์มไว้) */}
      {tabs.map((t) => (
        <div key={t.id} hidden={t.id !== active}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
