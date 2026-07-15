import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateQrDataUrl } from "@/lib/qr";
import { toDisplayDate } from "@/lib/date";
import { isOverdue, isUrgent } from "@/lib/workflow";
import { requestRollup, PHASE_LABEL, PHASE_COLOR } from "@/lib/rollup";
import StatusBadge from "@/components/StatusBadge";
import AddItemForm from "@/components/AddItemForm";
import AttachmentsSection from "@/components/AttachmentsSection";
import { addItem, uploadAttachment } from "@/app/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ regis_no: string }>;
}) {
  const { regis_no } = await params;
  return { title: `${decodeURIComponent(regis_no)} — Dodoregis` };
}

export default async function RequestOverviewPage({
  params,
}: {
  params: Promise<{ regis_no: string }>;
}) {
  const { regis_no } = await params;
  const regisNo = decodeURIComponent(regis_no);

  const request = await prisma.testRequest.findUnique({
    where: { regisNo },
    include: {
      requestDept: true,
      items: { include: { owner: true }, orderBy: { itemNo: "asc" } },
      attachments: { orderBy: { id: "desc" } },
    },
  });

  if (!request) notFound();

  const members = await prisma.member.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const roll = requestRollup(request.items);
  const qrDataUrl = await generateQrDataUrl(`/requests/${regisNo}`);
  const nextItemNo = (request.items.at(-1)?.itemNo ?? 0) + 1;
  const addItemBound = addItem.bind(null, regisNo);
  const uploadBound = uploadAttachment.bind(null, { requestNo: regisNo });

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Link href="/requests" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปรายการงาน
      </Link>

      {/* หัวใบ + สถานะรวม + QR */}
      <div className="card p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">{request.regisNo}</h1>
            <span className={`chip ${PHASE_COLOR[roll.phase]} font-semibold`}>{PHASE_LABEL[roll.phase]}</span>
            {roll.overdueCount > 0 && <span className="chip bg-coral text-white">🔴 เลยกำหนด {roll.overdueCount}</span>}
            {roll.urgentCount > 0 && <span className="chip bg-coral-soft text-coral">⚡ ด่วน {roll.urgentCount}</span>}
            {roll.hold > 0 && <span className="chip bg-mustard text-ink">⏸ Hold {roll.hold}</span>}
          </div>

          {/* progress */}
          <div className="flex items-center gap-3 max-w-md">
            <div className="flex-1 bg-surface-strong rounded-sm h-2.5 overflow-hidden">
              <div className="bg-forest h-full rounded-sm" style={{ width: `${roll.progressPct}%` }} />
            </div>
            <span className="text-[13px] font-medium text-ink shrink-0">
              เสร็จ {roll.done}/{roll.total} item
            </span>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-2">
            <Row label="แผนกที่รีเควส" value={request.requestDept.name} />
            <Row label="ผู้รีเควส" value={request.requester} />
            <Row label="วันที่ได้ใบรีเควส" value={toDisplayDate(request.requestDate)} />
            {request.remark && <Row label="หมายเหตุ" value={request.remark} />}
            {request.folderUrl && (
              <Row label="โฟลเดอร์งาน" value={<a href={request.folderUrl} target="_blank" className="text-link hover:underline">เปิด Drive</a>} />
            )}
          </dl>
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0 self-center sm:self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR ${regisNo}`} className="w-28 h-28 border border-hairline rounded-lg bg-white p-2" />
          <Link href={`/labels?regis=${regisNo}`} className="text-[12px] text-link hover:underline">พิมพ์ label ใบนี้</Link>
        </div>
      </div>

      {/* รายการ item เป็นการ์ด/ปุ่ม */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-ink">รายการทดสอบในใบนี้ ({request.items.length})</h2>
        </div>

        {request.items.length === 0 ? (
          <div className="card p-8 text-center text-muted">ยังไม่มี item — เพิ่มด้านล่าง</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {request.items.map((it) => {
              const overdue = isOverdue(it.planEnd, it.status);
              const urgent = isUrgent(it.remark);
              return (
                <Link
                  key={it.id}
                  href={`/items/${it.itemCode}`}
                  className={`card p-4 flex flex-col gap-2 transition-colors hover:border-border-strong hover:bg-surface-soft ${urgent ? "border-coral/40" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">
                      {urgent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral mr-1.5 align-middle" title="งานด่วน" />}
                      #{String(it.itemNo).padStart(2, "0")} · {it.itemCode}
                    </span>
                    <StatusBadge status={it.status} />
                  </div>
                  <div className="text-[15px] text-ink">
                    {it.partName}
                    {it.partNo && <span className="text-muted text-[13px]"> · {it.partNo}</span>}
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5 text-muted">
                      <span className="grid place-items-center w-5 h-5 rounded-full bg-surface-strong text-ink text-[10px] font-medium">
                        {it.owner.name.slice(0, 1)}
                      </span>
                      {it.owner.name}
                    </span>
                    <span className={overdue ? "text-coral font-medium" : "text-muted"}>
                      กำหนดจบ {toDisplayDate(it.planEnd)}
                    </span>
                  </div>
                  <span className="text-[13px] text-link mt-1">ดูรายละเอียด →</span>
                </Link>
              );
            })}
          </div>
        )}

        <AddItemForm
          action={addItemBound}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          nextItemNo={nextItemNo}
        />
      </section>

      <AttachmentsSection
        title="ไฟล์แนบระดับใบรีเควส (email / ใบรีเควส / เอกสารรวม)"
        uploadAction={uploadBound}
        attachments={request.attachments.map((a) => ({
          id: a.id,
          kind: a.kind,
          label: a.label,
          fileName: a.fileName,
          storedName: a.storedName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          url: a.url,
        }))}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted shrink-0 w-32">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
