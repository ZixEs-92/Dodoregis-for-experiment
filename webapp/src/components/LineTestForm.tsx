"use client";

import { useActionState } from "react";
import { sendLineTest, LineTestState } from "@/app/actions";

const initial: LineTestState = { ran: false, result: null, errors: [] };

const SAMPLE = "🔔 ทดสอบแจ้งเตือนจาก Dodoregis\nเลยกำหนด: TR-2607-001-01 · P703 LED HL HG\nผู้รับผิดชอบ: เอกชัย";

export default function LineTestForm({
  hasEnvConfig,
}: {
  hasEnvConfig: boolean;
}) {
  const [state, formAction, pending] = useActionState(sendLineTest, initial);
  const r = state.result;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="label-text">ข้อความทดสอบ</span>
        <textarea name="message" rows={3} defaultValue={SAMPLE} className="input" />
      </label>

      <details className="border border-hairline rounded-lg overflow-hidden">
        <summary className="cursor-pointer select-none px-4 py-2.5 text-[13px] font-medium bg-surface-soft text-ink">
          ทดสอบด้วย token / ปลายทางเฉพาะกิจ (ไม่บันทึก — ถ้าเว้นว่างจะใช้ค่าใน .env)
        </summary>
        <div className="p-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label-text">Channel access token</span>
            <input type="password" name="token" autoComplete="off" placeholder={hasEnvConfig ? "(ใช้จาก .env)" : "วาง token ที่นี่"} className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-text">ปลายทาง (userId / groupId)</span>
            <input type="text" name="to" autoComplete="off" placeholder={hasEnvConfig ? "(ใช้จาก .env)" : "Uxxxxxxxx… หรือ Cxxxxxxxx…"} className="input" />
          </label>
        </div>
      </details>

      <div>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "กำลังส่ง..." : "ส่งข้อความทดสอบ"}
        </button>
      </div>

      {state.ran && r && (
        <div
          className={`rounded-lg border p-4 text-[13px] flex flex-col gap-2 ${
            r.ok
              ? "bg-forest-soft border-forest/20 text-forest"
              : r.dryRun
                ? "bg-info-soft border-info-border/30 text-info"
                : "bg-coral-soft border-coral/30 text-coral"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <span className="chip bg-canvas/70">
              {r.dryRun ? "DRY-RUN" : r.ok ? `HTTP ${r.status} · สำเร็จ` : `HTTP ${r.status ?? "—"} · ล้มเหลว`}
            </span>
            <span>{r.detail}</span>
          </div>
          <div>
            <div className="text-[12px] opacity-80 mb-1">payload ที่ส่งไป {`POST /v2/bot/message/push`}:</div>
            <pre className="bg-ink text-white rounded-md p-3 text-[12px] overflow-x-auto">
{JSON.stringify(r.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </form>
  );
}
