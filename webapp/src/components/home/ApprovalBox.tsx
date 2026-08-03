import Link from "next/link";
import { APPROVAL_LABEL, APPROVAL_COLOR } from "@/lib/approval";
import type { ApprovableSheet } from "@/lib/approvalQueue";

/**
 * กล่อง "รออนุมัติ" บนหน้าแรก — แยกจากการ์ดงานปกติเสมอตามที่ผู้ใช้ขอ
 * ใช้ได้ 2 แบบ: "ใบรอฉันเซ็น" (mode="sign", ลิงก์ไป /approvals) กับ
 * "ใบของแผนกฉันที่ยังไม่ผ่าน" (mode="mine", ลิงก์ไปหน้าใบแต่ละใบ)
 */
export default function ApprovalBox({
  title,
  sheets,
  mode,
}: {
  title: string;
  sheets: ApprovableSheet[];
  mode: "sign" | "mine";
}) {
  if (sheets.length === 0) return null;

  return (
    <section className="card p-4 sm:p-5 flex flex-col gap-3 border-mustard bg-yellow-soft">
      <div className="flex items-center gap-2">
        <span className="text-[18px] leading-none">⏳</span>
        <h2 className="text-[15px] font-semibold text-ink">
          {title} <span className="text-mustard-deep">({sheets.length})</span>
        </h2>
        {mode === "sign" && (
          <Link href="/approvals" className="ml-auto text-[13px] text-link hover:underline">
            ไปที่คิวอนุมัติ →
          </Link>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {sheets.slice(0, 5).map((s) => (
          <li key={s.regisNo}>
            <Link
              href={`/requests/${s.regisNo}`}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-canvas p-2.5 text-[13px] hover:bg-surface-soft transition-colors"
            >
              <span className="font-semibold text-ink">{s.regisNo}</span>
              <span className={`chip ${APPROVAL_COLOR[s.approvalStatus]}`}>
                {APPROVAL_LABEL[s.approvalStatus]}
              </span>
              <span className="text-muted truncate">
                {s.deptName} · {s.requester}
                {s.testObject && ` · ${s.testObject}`}
              </span>
              {s.daysWaiting != null && s.daysWaiting > 0 && (
                <span className="ml-auto shrink-0 text-coral font-medium">
                  ค้างมา {s.daysWaiting} วัน
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {sheets.length > 5 && (
        <span className="text-[12px] text-muted">และอีก {sheets.length - 5} ใบ</span>
      )}
    </section>
  );
}
