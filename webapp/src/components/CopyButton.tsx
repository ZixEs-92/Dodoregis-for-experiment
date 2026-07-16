"use client";

import { useState } from "react";

export default function CopyButton({ value, label = "คัดลอก" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // fallback สำหรับเบราว์เซอร์เก่า/บริบทที่ไม่มี clipboard API
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-[12px] text-link hover:underline shrink-0 whitespace-nowrap"
      title="คัดลอกไปวางใน File Explorer"
    >
      {done ? "คัดลอกแล้ว ✓" : `⧉ ${label}`}
    </button>
  );
}
