import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toDisplayDate } from "@/lib/date";
import { isOverdue, isDueSoon, isUrgent } from "@/lib/workflow";
import { testTitle } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";

/**
 * บล็อก "งานของฉัน" บนสุดของหน้าแรกสำหรับวิศวกร
 * เดิมต้องเข้ารายการงานแล้วกรองชื่อตัวเองทุกครั้ง — ย้ายมาไว้เป็นสิ่งแรกที่เห็น
 */
export default async function MyWorkBlock({ memberId }: { memberId: number | null }) {
  if (!memberId) {
    return (
      <div className="card p-4 text-[13px] text-muted">
        💡 บัญชีของคุณยังไม่ได้ผูกกับรายชื่อในทีม จึงยังไม่มีบล็อก “งานของฉัน” —
        แจ้งผู้ดูแลระบบให้ผูกให้ที่หน้าจัดการผู้ใช้
      </div>
    );
  }

  const items = await prisma.testItem.findMany({
    where: { ownerId: memberId, status: { notIn: ["S8_CLOSED", "S10_CANCEL"] } },
    include: { request: { include: { requestDept: true } } },
    orderBy: [{ planEnd: "asc" }, { itemCode: "asc" }],
  });

  const late = items.filter((i) => isOverdue(i.planEnd, i.status));
  const soon = items.filter((i) => isDueSoon(i.planEnd, i.status));
  const rest = items.filter((i) => !late.includes(i) && !soon.includes(i));

  return (
    <section className="card p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-medium text-ink">งานของฉัน</h2>
        <span className="chip bg-surface-strong text-ink">{items.length} รายการ</span>
        {late.length > 0 && <span className="chip bg-coral text-white">เลยกำหนด {late.length}</span>}
        {soon.length > 0 && (
          <span className="chip bg-yellow-soft text-mustard-deep">ครบใน 7 วัน {soon.length}</span>
        )}
        <Link href="/schedule" className="ml-auto text-[13px] text-link hover:underline">
          ดูตารางงานสัปดาห์ →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <span className="text-[26px] leading-none">✅</span>
          <p className="text-[14px] font-medium text-ink">ไม่มีงานค้างในมือ</p>
          <p className="text-[13px] text-muted">งานที่ผู้ดูแลระบบมอบหมายให้จะมาแสดงที่นี่</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Group title="เลยกำหนดแล้ว" tone="bad" items={late} />
          <Group title="ครบกำหนดใน 7 วัน" tone="warn" items={soon} />
          <Group title="งานอื่นที่รับผิดชอบ" items={rest} />
        </div>
      )}
    </section>
  );
}

type Row = {
  id: number;
  itemCode: string;
  partName: string;
  testName: string | null;
  testDetail: string;
  planEnd: Date | null;
  remark: string | null;
  status: Parameters<typeof StatusBadge>[0]["status"];
  request: { requestDept: { name: string } };
};

function Group({
  title,
  items,
  tone,
}: {
  title: string;
  items: Row[];
  tone?: "bad" | "warn";
}) {
  if (items.length === 0) return null;
  const titleClass =
    tone === "bad" ? "text-coral" : tone === "warn" ? "text-mustard-deep" : "text-muted";

  return (
    <div className="flex flex-col gap-2">
      <h3 className={`text-[12px] font-medium uppercase tracking-wide ${titleClass}`}>
        {title} ({items.length})
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={`/items/${it.itemCode}`}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-hairline px-3 py-2.5 text-[13px] transition-colors hover:bg-surface-soft"
            >
              <StatusBadge status={it.status} />
              <span className="font-medium text-ink">
                {testTitle(it.testName, it.testDetail) || it.partName}
              </span>
              {isUrgent(it.remark) && <span className="chip bg-coral text-white">ด่วน</span>}
              <span className="text-muted">· {it.request.requestDept.name}</span>
              <span className="ml-auto text-muted">
                {it.planEnd ? `กำหนด ${toDisplayDate(it.planEnd)}` : "ยังไม่มีวันกำหนด"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
