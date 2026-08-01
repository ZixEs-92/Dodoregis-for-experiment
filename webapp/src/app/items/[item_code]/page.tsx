import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateQrDataUrl, qrMode } from "@/lib/qr";
import { toInputDate, toDisplayDate } from "@/lib/date";
import {
  isUrgent,
  RUN_RESULT_LABEL,
  REPORT_STATUS_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  LOCATION_LOG_KIND_LABEL,
  validateStatusRequirements,
} from "@/lib/workflow";
import { leadTime, slaStatus, SLA_STATUS_LABEL, SLA_STATUS_COLOR } from "@/lib/tat";
import { requestRollup, PHASE_LABEL, PHASE_COLOR } from "@/lib/rollup";
import { testTitle, isHttpUrl } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { canEditTests } from "@/lib/roles";
import CopyButton from "@/components/CopyButton";
import Icon from "@/components/ui/Icon";
import StatusBadge from "@/components/StatusBadge";
import StatusStepper from "@/components/StatusStepper";
import ItemDetailsForm from "@/components/ItemDetailsForm";
import AttachmentsSection from "@/components/AttachmentsSection";
import MoveLocationForm from "@/components/MoveLocationForm";
import ActivityTimeline, { TimelineEvent } from "@/components/ActivityTimeline";
import Tabs, { TabDef } from "@/components/Tabs";
import {
  updateItemDetails,
  addTestRun,
  upsertReport,
  uploadAttachment,
  moveLocation,
} from "@/app/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ item_code: string }>;
}) {
  const { item_code } = await params;
  return { title: `${decodeURIComponent(item_code)} — Dodoregis` };
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ item_code: string }>;
}) {
  const { item_code } = await params;
  const itemCode = decodeURIComponent(item_code);

  const item = await prisma.testItem.findUnique({
    where: { itemCode },
    include: {
      request: {
        include: {
          requestDept: true,
          items: { select: { status: true, planEnd: true, remark: true } },
          parts: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        },
      },
      parts: { select: { id: true } },
      owner: true,
      partLocation: true,
      finishedPartLocation: true,
      testRuns: { include: { loadingOwner: true, testOwner: true }, orderBy: { runNo: "asc" } },
      reports: { include: { author: true, approver: true }, orderBy: { id: "desc" } },
      attachments: { orderBy: { id: "desc" } },
      statusLogs: { orderBy: { changedAt: "asc" } },
      locationLogs: { orderBy: { changedAt: "asc" } },
    },
  });

  if (!item) notFound();

  const [members, partLocations, finishedLocations] = await Promise.all([
    prisma.member.findMany({ orderBy: { name: "asc" } }),
    prisma.partLocation.findMany({ orderBy: { name: "asc" } }),
    prisma.finishedLocation.findMany({ orderBy: { name: "asc" } }),
  ]);

  const urgent = isUrgent(item.remark);
  const latestReport = item.reports[0];
  const roll = requestRollup(item.request.items);
  const itemTitle = testTitle(item.testName, item.testDetail);
  const itemQr = await generateQrDataUrl(`/items/${item.itemCode}`, 160);

  // TAT / SLA
  const slaDays = item.request.requestDept.slaDays;
  const sentDate = item.reports.find((r) => r.status === "SENT")?.sentDate ?? null;
  const lead = leadTime(item.request.requestDate, sentDate);
  const sla = slaStatus(lead.days, lead.done, slaDays);

  // สิทธิ์: viewer (ไม่ล็อกอิน) เห็นอย่างเดียว, engineer ขึ้นไปแก้ได้
  const currentUser = await getCurrentUser();
  const canEdit = canEditTests(currentUser?.role ?? null);

  // เงื่อนไขที่ยังขาดสำหรับไปสถานะถัดไป — บอกผู้ใช้ก่อนกด ไม่ใช่หลังกด
  const curIdx = STATUS_ORDER.indexOf(item.status);
  const nextStatus =
    curIdx >= 0 && curIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[curIdx + 1] : null;
  const nextBlockers = nextStatus ? validateStatusRequirements(nextStatus, item) : [];

  const updateBound = updateItemDetails.bind(null, item.itemCode);
  const createRun = addTestRun.bind(null, item.itemCode);
  const saveReport = upsertReport.bind(null, item.itemCode);
  const uploadBound = uploadAttachment.bind(null, { itemId: item.id });
  const moveBound = moveLocation.bind(null, item.itemCode);

  const events: TimelineEvent[] = [
    ...item.statusLogs.map((s) => ({
      at: s.changedAt,
      kind: "status" as const,
      title: s.fromStatus
        ? `${STATUS_LABEL[s.fromStatus]} → ${STATUS_LABEL[s.toStatus]}`
        : `เริ่มที่ ${STATUS_LABEL[s.toStatus]}`,
      detail: s.note ?? undefined,
    })),
    ...item.locationLogs.map((l) => ({
      at: l.changedAt,
      kind: "location" as const,
      title: `${LOCATION_LOG_KIND_LABEL[l.kind]}: ${l.fromName ?? "ยังไม่ระบุ"} → ${l.toName ?? "ยังไม่ระบุ"}`,
      detail: l.note ?? undefined,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  // ── panels ──
  const overviewPanel = (
    <div className="flex flex-col gap-4">
      {canEdit && (
      <section className="card p-5 sm:p-6">
        <SectionTitle>ขั้นตอนงาน</SectionTitle>
        <div className="mt-4">
          <StatusStepper
            itemCode={item.itemCode}
            currentStatus={item.status}
            statusBeforeHold={item.statusBeforeHold}
            nextBlockers={nextBlockers}
            hasOwner={item.ownerId != null}
          />
        </div>
      </section>
      )}

      <div className="card p-4 sm:p-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex flex-col">
          <span className="text-[12px] text-muted">Lead time (รับใบ → {lead.done ? "ส่งรีพอร์ท" : "ปัจจุบัน"})</span>
          <span className="text-[20px] font-medium text-ink">
            {lead.days} วัน{!lead.done && <span className="text-[12px] text-muted font-normal"> (ยังไม่ส่ง)</span>}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[12px] text-muted">เป้า SLA ({item.request.requestDept.name})</span>
          <span className="text-[20px] font-medium text-ink">{slaDays ? `${slaDays} วัน` : "—"}</span>
        </div>
        <span className={`chip ${SLA_STATUS_COLOR[sla]} self-center`}>{SLA_STATUS_LABEL[sla]}</span>
      </div>

      <section className="card p-5 sm:p-6">
        <SectionTitle>ข้อมูลสำคัญ</SectionTitle>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[14px] mt-4 sm:grid-cols-2">
          <Info
            label="ผู้รับผิดชอบ"
            value={item.owner?.name ?? <span className="text-mustard-deep font-medium">ยังไม่มอบหมาย (รอวางแผน)</span>}
          />
          <Info label="จำนวนพาร์ท" value={item.qty != null ? String(item.qty) : "—"} />
          <Info label="Plan เริ่ม – จบ" value={`${toDisplayDate(item.planStart)} – ${toDisplayDate(item.planEnd)}`} />
          <Info label="จริง เริ่ม – จบ" value={`${toDisplayDate(item.actualStart)} – ${toDisplayDate(item.actualEnd)}`} />
          <Info label="ที่เก็บพาร์ท" value={item.partLocation?.name ?? "—"} />
          <Info label="ที่เก็บหลังเสร็จ" value={item.finishedPartLocation?.name ?? "—"} />
          <Info
            label="ที่เก็บ raw data"
            value={
              isHttpUrl(item.rawDataLocation) ? (
                <a href={item.rawDataLocation!} target="_blank" rel="noopener noreferrer" className="text-link hover:underline break-all">
                  {item.rawDataLocation} ↗
                </a>
              ) : item.rawDataLocation ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="break-all">{item.rawDataLocation}</span>
                  <CopyButton value={item.rawDataLocation} />
                </span>
              ) : (
                "—"
              )
            }
          />
          <div className="sm:col-span-2">
            <Info label="รายละเอียดเทส" value={<span className="whitespace-pre-wrap">{item.testDetail}</span>} />
          </div>
          {item.remark && <Info label="หมายเหตุ" value={item.remark} />}
        </dl>
      </section>
    </div>
  );

  const detailPanel = (
    <section className="card p-5 sm:p-6">
      <SectionTitle>รายละเอียดการทดสอบ / แก้ไขข้อมูล item</SectionTitle>
      <ItemDetailsForm
        action={updateBound}
        defaults={{
          testName: item.testName ?? "",
          partIds: item.parts.map((p) => p.id),
          partReceivedDate: toInputDate(item.partReceivedDate),
          partLocationId: item.partLocationId,
          testDetail: item.testDetail,
          planStart: toInputDate(item.planStart),
          planEnd: toInputDate(item.planEnd),
          actualStart: toInputDate(item.actualStart),
          actualEnd: toInputDate(item.actualEnd),
          ownerId: item.ownerId,
          finishedPartLocationId: item.finishedPartLocationId,
          rawDataLocation: item.rawDataLocation ?? "",
          remark: item.remark ?? "",
        }}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        partLocations={partLocations.map((p) => ({ id: p.id, name: p.name }))}
        finishedLocations={finishedLocations.map((f) => ({ id: f.id, name: f.name }))}
        parts={item.request.parts.map((p) => ({
          id: p.id,
          name: p.name,
          partNo: p.partNo,
          qty: p.qty,
        }))}
      />
    </section>
  );

  const runsPanel = (
    <section className="card p-5 sm:p-6">
      <SectionTitle>ความคืบหน้า — Test Runs</SectionTitle>
      <div className="overflow-x-auto mt-4 mb-4 rounded-lg border border-hairline">
        <table className="w-full text-[14px] min-w-[720px]">
          <thead>
            <tr className="border-b border-hairline text-left">
              <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">ครั้งที่</th>
              <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">เริ่ม - จบ</th>
              <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">Loading</th>
              <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">ผู้เทส</th>
              <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">ผล</th>
              <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">Raw data</th>
              <th className="p-3 text-[12px] font-medium text-muted uppercase tracking-wide">Remark</th>
            </tr>
          </thead>
          <tbody>
            {item.testRuns.map((run) => (
              <tr key={run.id} className="border-b border-hairline last:border-0">
                <td className="p-3 font-medium text-ink">#{run.runNo}</td>
                <td className="p-3 whitespace-nowrap text-body">{toDisplayDate(run.startDate)} - {toDisplayDate(run.endDate)}</td>
                <td className="p-3 whitespace-nowrap text-body">{run.loadingOwner?.name ?? "-"}</td>
                <td className="p-3 whitespace-nowrap text-body">{run.testOwner?.name ?? "-"}</td>
                <td className="p-3 whitespace-nowrap">
                  {run.result ? (
                    <span className={`chip ${run.result === "PASS" ? "bg-forest-soft text-forest" : run.result === "FAIL" ? "bg-coral-soft text-coral" : "bg-mustard-soft text-mustard-deep"}`}>
                      {RUN_RESULT_LABEL[run.result]}
                    </span>
                  ) : <span className="text-muted">-</span>}
                </td>
                <td className="p-3">{run.rawDataUrl ? <a href={run.rawDataUrl} target="_blank" className="text-link hover:underline">ลิงก์</a> : <span className="text-muted">-</span>}</td>
                <td className="p-3 text-body">{run.remark ?? "-"}</td>
              </tr>
            ))}
            {item.testRuns.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <span className="text-[26px] leading-none">🧪</span>
                    <p className="text-[14px] font-medium text-ink">ยังไม่มีการบันทึกผลทดสอบ</p>
                    <p className="text-[13px] text-muted">
                      {canEdit
                        ? "เริ่มบันทึกครั้งแรกได้ที่ปุ่มด้านล่าง — บันทึกได้หลายครั้งถ้าต้อง retest"
                        : "เมื่อทีมแลปเริ่มทดสอบ ผลจะแสดงที่นี่"}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
      <details className="border border-hairline rounded-lg overflow-hidden">
        <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-medium bg-surface-soft text-ink">+ เพิ่ม Test Run (retest)</summary>
        <form action={createRun} className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="วันเริ่ม"><input type="date" name="start_date" className="input" /></Field>
          <Field label="วันจบ"><input type="date" name="end_date" className="input" /></Field>
          <Field label="ผู้รับผิดชอบ Loading">
            <select name="loading_owner" defaultValue="" className="input">
              <option value="">- ไม่ระบุ -</option>
              {members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </Field>
          <Field label="ผู้รับผิดชอบเทส">
            <select name="test_owner" defaultValue="" className="input">
              <option value="">- ไม่ระบุ -</option>
              {members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </Field>
          <Field label="ผลเทส">
            <select name="result" defaultValue="" className="input">
              <option value="">- ยังไม่มีผล -</option>
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
              <option value="CONDITIONAL_PASS">Conditional Pass</option>
            </select>
          </Field>
          <Field label="ลิงก์ Raw Data"><input type="url" name="rawdata_url" className="input" /></Field>
          <Field label="Remark" className="sm:col-span-2"><input type="text" name="remark" className="input" /></Field>
          <div className="sm:col-span-2"><button type="submit" className="btn-primary btn-sm">บันทึก Test Run</button></div>
        </form>
      </details>
      )}
    </section>
  );

  const reportPanel = (
    <section className="card p-5 sm:p-6">
      <SectionTitle>รีพอร์ท (ของ item นี้)</SectionTitle>
      {canEdit ? (
      <form action={saveReport} className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
        <Field label="สถานะรีพอร์ท">
          <select name="status" defaultValue={latestReport?.status ?? "NOT_STARTED"} className="input">
            {Object.entries(REPORT_STATUS_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
          </select>
        </Field>
        <Field label="วันที่ส่งรีพอร์ท"><input type="date" name="sent_date" defaultValue={toInputDate(latestReport?.sentDate)} className="input" /></Field>
        <Field label="ที่อยู่ไฟล์"><input type="text" name="file_path" defaultValue={latestReport?.filePath ?? ""} className="input" /></Field>
        <Field label="ลิงก์รีพอร์ท"><input type="url" name="report_url" defaultValue={latestReport?.reportUrl ?? ""} className="input" /></Field>
        <Field label="ผู้จัดทำ">
          <select name="author" defaultValue={latestReport?.authorId ?? ""} className="input">
            <option value="">- ไม่ระบุ -</option>
            {members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </Field>
        <Field label="ผู้อนุมัติ">
          <select name="approver" defaultValue={latestReport?.approverId ?? ""} className="input">
            <option value="">- ไม่ระบุ -</option>
            {members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </Field>
        <div className="sm:col-span-2"><button type="submit" className="btn-primary">บันทึกรีพอร์ท</button></div>
      </form>
      ) : latestReport ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[14px] mt-4 sm:grid-cols-2">
          <Info label="สถานะรีพอร์ท" value={REPORT_STATUS_LABEL[latestReport.status]} />
          <Info label="วันที่ส่ง" value={toDisplayDate(latestReport.sentDate)} />
          <Info label="ที่อยู่ไฟล์" value={latestReport.filePath ?? "—"} />
          <Info
            label="ลิงก์รีพอร์ท"
            value={
              latestReport.reportUrl ? (
                <a href={latestReport.reportUrl} target="_blank" rel="noopener noreferrer" className="text-link hover:underline break-all">
                  {latestReport.reportUrl} ↗
                </a>
              ) : "—"
            }
          />
          <Info label="ผู้จัดทำ" value={latestReport.author?.name ?? "—"} />
          <Info label="ผู้อนุมัติ" value={latestReport.approver?.name ?? "—"} />
        </dl>
      ) : (
        <p className="text-[13px] text-muted mt-4">ยังไม่มีข้อมูลรีพอร์ท</p>
      )}
    </section>
  );

  const attachmentsPanel = (
    <AttachmentsSection
      title="ไฟล์แนบของ item (รูปชิ้นงาน / สเปคทดสอบ)"
      uploadAction={uploadBound}
      readOnly={!canEdit}
      attachments={item.attachments.map((a) => ({
        id: a.id, kind: a.kind, label: a.label, fileName: a.fileName,
        storedName: a.storedName, mimeType: a.mimeType, sizeBytes: a.sizeBytes, url: a.url,
      }))}
    />
  );

  const historyPanel = (
    <div className="flex flex-col gap-4">
      {canEdit && (
      <section className="card p-5 sm:p-6">
        <SectionTitle>ย้ายที่เก็บชิ้นงาน (chain of custody)</SectionTitle>
        <p className="text-[12px] text-muted mt-3 mb-3">บันทึกย้ายที่เก็บได้เร็ว ๆ ตรงนี้ ระบบเก็บประวัติทุกครั้งที่ย้าย</p>
        <MoveLocationForm
          action={moveBound}
          partLocations={partLocations.map((p) => ({ id: p.id, name: p.name }))}
          finishedLocations={finishedLocations.map((f) => ({ id: f.id, name: f.name }))}
          currentPart={item.partLocation?.name ?? null}
          currentFinished={item.finishedPartLocation?.name ?? null}
        />
      </section>
      )}
      <section className="card p-5 sm:p-6">
        <SectionTitle>ประวัติกิจกรรม (audit trail)</SectionTitle>
        <ActivityTimeline events={events} />
      </section>
    </div>
  );

  // ยุบเหลือ 3 แท็บ ให้พอดีจอมือถือ และจัดกลุ่มตามสิ่งที่ผู้ใช้ตั้งใจมาทำ
  const tabs: TabDef[] = [
    {
      id: "overview",
      label: "ภาพรวม",
      content: (
        <div className="flex flex-col gap-4">
          {overviewPanel}
          {canEdit && detailPanel}
        </div>
      ),
    },
    {
      id: "work",
      label: "ผลทดสอบ & รีพอร์ท",
      badge: item.testRuns.length,
      content: (
        <div className="flex flex-col gap-4">
          {runsPanel}
          {reportPanel}
        </div>
      ),
    },
    {
      id: "files",
      label: "ไฟล์ & ประวัติ",
      badge: item.attachments.length,
      content: (
        <div className="flex flex-col gap-4">
          {attachmentsPanel}
          {historyPanel}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 pb-10">
      {/* breadcrumb: ใบรีเควส + สถานะรวม */}
      <Link href={`/requests/${item.regisNo}`} className="flex items-center gap-2 text-[13px] w-fit">
        <span className="text-muted hover:text-ink">← ใบรีเควส {item.regisNo}</span>
        <span className={`chip ${PHASE_COLOR[roll.phase]}`}>{PHASE_LABEL[roll.phase]} · เสร็จ {roll.done}/{roll.total}</span>
      </Link>

      {/* หัว item + สถานะปัจจุบัน (เห็นตลอด) + QR ระดับ item */}
      <div className="card p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">{item.itemCode}</h1>
            <StatusBadge status={item.status} />
            {urgent && <span className="chip bg-coral text-white font-semibold">งานด่วน</span>}
          </div>
          {itemTitle && <p className="text-[17px] font-medium text-ink">🧪 {itemTitle}</p>}
          <p className="text-[14px] text-muted">
            ชิ้นงาน: {item.partName}
            {item.partNo && <span> · {item.partNo}</span>}
          </p>
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <span className="grid place-items-center w-6 h-6 rounded-full bg-surface-strong text-ink text-[11px] font-medium shrink-0">
              {(item.owner?.name ?? "?").slice(0, 1)}
            </span>
            {item.owner?.name ?? "ยังไม่มอบหมาย"} · {item.request.requestDept.name} · ผู้รีเควส {item.request.requester}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0 self-center sm:self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={itemQr} alt={`QR ${item.itemCode}`} className="w-28 h-28 border border-hairline rounded-lg bg-white p-2" />
          <span className="text-[11px] text-muted">QR รายการนี้</span>
          {qrMode() === "code" && (
            <Link href="/scan" className="text-[11px] text-muted hover:text-ink text-center leading-tight">
              📷 สแกนผ่านแอป
            </Link>
          )}
          <Link href={`/labels?ids=${item.itemCode}`} className="text-[12px] text-link hover:underline">พิมพ์ label item นี้</Link>
        </div>
      </div>

      <Tabs tabs={tabs} />

      {/* สแกนชิ้นต่อไปได้เลยโดยไม่ต้องย้อนกลับหลายชั้น (มือถือ) */}
      <Link
        href="/scan"
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-white shadow-lg sm:hidden"
      >
        <Icon name="scan" size={16} />
        สแกนชิ้นต่อไป
      </Link>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide pb-3 border-b border-hairline">
      {children}
    </h2>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="label-text">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted shrink-0 w-32">{label}</dt>
      <dd className="text-ink min-w-0">{value}</dd>
    </div>
  );
}
