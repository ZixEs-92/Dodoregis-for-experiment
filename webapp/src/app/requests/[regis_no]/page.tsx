import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toDisplayDate } from "@/lib/date";
import { isOverdue, isUrgent } from "@/lib/workflow";
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
      items: {
        include: { owner: true },
        orderBy: { itemNo: "asc" },
      },
      attachments: { orderBy: { id: "desc" } },
    },
  });

  if (!request) notFound();

  const members = await prisma.member.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const nextItemNo = (request.items.at(-1)?.itemNo ?? 0) + 1;
  const addItemBound = addItem.bind(null, regisNo);
  const uploadBound = uploadAttachment.bind(null, { requestNo: regisNo });

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Link href="/requests" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปรายการงาน
      </Link>

      <div className="card p-5 sm:p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">{request.regisNo}</h1>
          <span className="chip bg-surface-strong text-ink">{request.items.length} item</span>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2">
          <Row label="แผนกที่รีเควส" value={request.requestDept.name} />
          <Row label="ผู้รีเควส" value={request.requester} />
          <Row label="วันที่ได้ใบรีเควส" value={toDisplayDate(request.requestDate)} />
          {request.remark && <Row label="หมายเหตุ" value={request.remark} />}
          {request.folderUrl && (
            <Row
              label="โฟลเดอร์งาน"
              value={
                <a href={request.folderUrl} target="_blank" className="text-link hover:underline">
                  เปิด Drive
                </a>
              }
            />
          )}
        </dl>
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide pb-3 border-b border-hairline">
          รายการ item ในใบรีเควสนี้
        </h2>
        <div className="overflow-x-auto mt-4 mb-4 rounded-lg border border-hairline">
          <table className="w-full text-[14px] min-w-[680px]">
            <thead>
              <tr className="border-b border-hairline text-left">
                <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">Item</th>
                <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">ชิ้นงาน / พาร์ทโน</th>
                <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">ผู้รับผิดชอบ</th>
                <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">สถานะ</th>
                <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">Plan จบ</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((it) => {
                const overdue = isOverdue(it.planEnd, it.status);
                const urgent = isUrgent(it.remark);
                return (
                  <tr key={it.id} className={`border-b border-hairline last:border-0 ${urgent ? "bg-coral-soft" : ""}`}>
                    <td className="p-3 font-medium whitespace-nowrap">
                      {urgent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral mr-1.5 align-middle" title="งานด่วน" />}
                      <Link href={`/items/${it.itemCode}`} className="text-ink hover:text-link">
                        {it.itemCode}
                      </Link>
                    </td>
                    <td className="p-3">
                      <div className="text-ink">{it.partName}</div>
                      {it.partNo && <div className="text-[12px] text-muted">{it.partNo}</div>}
                    </td>
                    <td className="p-3 whitespace-nowrap text-body">{it.owner.name}</td>
                    <td className="p-3"><StatusBadge status={it.status} /></td>
                    <td className={`p-3 whitespace-nowrap ${overdue ? "text-coral font-medium" : "text-body"}`}>
                      {toDisplayDate(it.planEnd)}
                    </td>
                    <td className="p-3">
                      <Link href={`/items/${it.itemCode}`} className="text-[13px] text-link hover:underline whitespace-nowrap">
                        ดูรายละเอียด →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
