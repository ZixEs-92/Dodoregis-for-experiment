"use client";

import { useActionState, useState, useTransition } from "react";
import { ActionResult, deleteAttachment } from "@/app/actions";
import { FormErrors } from "@/components/FormMessages";
import { ATTACHMENT_KIND_LABEL } from "@/lib/workflow";
import { humanSize } from "@/lib/format";

type Attachment = {
  id: number;
  kind: keyof typeof ATTACHMENT_KIND_LABEL;
  label: string | null;
  fileName: string | null;
  storedName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  url: string | null;
};

const initial: ActionResult = { ok: true, errors: [] };

function iconFor(att: Attachment): string {
  if (att.url && !att.storedName) return "🔗";
  if (att.mimeType?.startsWith("image/")) return "🖼️";
  if (att.mimeType === "application/pdf") return "📄";
  if (att.mimeType?.includes("word")) return "📝";
  if (att.mimeType?.includes("sheet") || att.mimeType?.includes("excel")) return "📊";
  if (att.mimeType === "message/rfc822") return "✉️";
  return "📎";
}

export default function AttachmentsSection({
  uploadAction,
  attachments,
  title,
  readOnly = false,
}: {
  uploadAction: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  attachments: Attachment[];
  title: string;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(uploadAction, initial);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [deletingId, startDelete] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);

  function onDelete(id: number, name: string) {
    if (!window.confirm(`ลบไฟล์แนบ "${name}" ?`)) return;
    setPendingId(id);
    startDelete(async () => {
      await deleteAttachment(id);
      setPendingId(null);
    });
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-[13px] font-medium text-muted uppercase tracking-wide pb-3 border-b border-hairline">
        {title}
      </h2>

      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-2 mt-4">
          {attachments.map((att) => {
            const name = att.label || att.fileName || att.url || "ไฟล์แนบ";
            return (
              <li
                key={att.id}
                className="flex items-center gap-3 rounded-lg border border-hairline p-3"
              >
                <span className="text-lg shrink-0">{iconFor(att)}</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={`/api/attachments/${att.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-link hover:underline break-words"
                  >
                    {name}
                  </a>
                  <div className="text-[12px] text-muted">
                    {ATTACHMENT_KIND_LABEL[att.kind]}
                    {att.fileName && att.label && ` · ${att.fileName}`}
                    {att.sizeBytes ? ` · ${humanSize(att.sizeBytes)}` : ""}
                    {att.url && !att.storedName ? " · ลิงก์ภายนอก" : ""}
                  </div>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => onDelete(att.id, name)}
                    disabled={deletingId && pendingId === att.id}
                    className="text-[12px] text-coral hover:underline shrink-0 disabled:opacity-50"
                  >
                    ลบ
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted mt-4">ยังไม่มีไฟล์แนบ</p>
      )}

      {!readOnly && (
      <div className="mt-5 pt-5 border-t border-hairline">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
              mode === "file"
                ? "bg-ink text-white border-ink"
                : "bg-canvas text-body border-hairline hover:bg-surface-soft"
            }`}
          >
            อัปโหลดไฟล์
          </button>
          <button
            type="button"
            onClick={() => setMode("link")}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
              mode === "link"
                ? "bg-ink text-white border-ink"
                : "bg-canvas text-body border-hairline hover:bg-surface-soft"
            }`}
          >
            แนบลิงก์
          </button>
        </div>

        <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormErrors errors={state.errors} />
          <label className="flex flex-col gap-1.5">
            <span className="label-text">ประเภท</span>
            <select name="kind" defaultValue="OTHER" className="input">
              {Object.entries(ATTACHMENT_KIND_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-text">ชื่อ/คำอธิบาย</span>
            <input type="text" name="label" className="input" placeholder="เช่น รูปตอนรับพาร์ท" />
          </label>

          {mode === "file" ? (
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="label-text">
                ไฟล์ (รูป/PDF/Word/Excel/email/text · ไม่เกิน 15MB)
              </span>
              <input
                type="file"
                name="file"
                className="text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:text-white file:px-3 file:py-2 file:text-[13px] file:font-medium"
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="label-text">ลิงก์ (Google Drive ฯลฯ)</span>
              <input type="url" name="url" className="input" placeholder="https://..." />
            </label>
          )}

          <div className="sm:col-span-2">
            <button type="submit" disabled={pending} className="btn-primary btn-sm">
              {pending ? "กำลังอัปโหลด..." : "เพิ่มไฟล์แนบ"}
            </button>
          </div>
        </form>
      </div>
      )}
    </section>
  );
}
