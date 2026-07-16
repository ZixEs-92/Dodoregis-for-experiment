/** สร้าง CSV string (ใส่ UTF-8 BOM ให้ Excel เปิดภาษาไทยถูก) */
const BOM = "﻿";

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined): string => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  return BOM + lines.join("\r\n");
}
