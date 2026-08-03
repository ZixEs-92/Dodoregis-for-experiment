import Link from "next/link";
import { guardPageApprove } from "@/lib/guard";
import { toScope } from "@/lib/auth";
import { getApprovableSheets } from "@/lib/approvalQueue";
import ApprovalQueueRow from "@/components/ApprovalQueueRow";

// สิทธิ์เข้าหน้านี้ขึ้นกับ session — ต้อง dynamic เสมอ กัน Next แคชผลของคนแรกไปให้คนถัดไปที่ URL เดียวกัน
export const dynamic = "force-dynamic";
export const metadata = { title: "คิวรออนุมัติ — Dodoregis" };

export default async function ApprovalsPage() {
  const user = await guardPageApprove("/approvals");
  const rows = await getApprovableSheets(toScope(user));

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Link href="/" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปหน้าหลัก
      </Link>
      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">
          คิวรออนุมัติ {rows.length > 0 && <span className="text-coral">({rows.length})</span>}
        </h1>
        <p className="text-[14px] text-muted mt-0.5">
          ใบรีเควสที่รอการอนุมัติจากคุณ — เรียงใบที่ค้างนานสุดขึ้นก่อน
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card empty-state">
          <p className="text-[15px] font-medium text-ink">ไม่มีใบรออนุมัติ</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <ApprovalQueueRow key={r.regisNo} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
