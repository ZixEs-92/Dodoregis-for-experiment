import Link from "next/link";
import { lineConfig } from "@/lib/line";
import LineTestForm from "@/components/LineTestForm";
import { guardPageAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตั้งค่าแจ้งเตือน LINE — Dodoregis" };

export default async function LineSettingsPage() {
  await guardPageAdmin();
  const cfg = lineConfig();
  const ready = cfg.hasToken && cfg.hasDestination;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Link href="/notifications" className="text-[13px] text-muted hover:text-ink w-fit">
        ← กลับไปหน้าแจ้งเตือน
      </Link>

      <div>
        <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">ตั้งค่าแจ้งเตือนผ่าน LINE OA</h1>
        <p className="text-[14px] text-muted mt-0.5">
          ผูก LINE Official Account เพื่อส่งแจ้งเตือนงานเลย/ใกล้กำหนดเข้า LINE (แทน LINE Notify ที่ปิดไปแล้ว)
        </p>
      </div>

      {/* สถานะการตั้งค่า */}
      <section className="card p-5">
        <h2 className="text-[15px] font-medium text-ink mb-4">สถานะการตั้งค่า (จาก .env)</h2>
        <div className="flex flex-col gap-2.5">
          <StatusLine
            ok={cfg.hasToken}
            label="Channel access token"
            detail={cfg.tokenPreview ?? "ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN"}
          />
          <StatusLine
            ok={cfg.hasDestination}
            label="ปลายทาง (LINE_TO)"
            detail={cfg.toPreview ?? "ยังไม่ได้ตั้ง LINE_TO (userId หรือ groupId)"}
          />
        </div>
        <div className={`mt-4 rounded-lg px-4 py-2.5 text-[13px] ${ready ? "bg-forest-soft text-forest" : "bg-mustard-soft text-mustard-deep"}`}>
          {ready
            ? "พร้อมส่งจริง — กดปุ่มด้านล่างเพื่อทดสอบ หรือรัน npm run notify"
            : "ยังไม่ครบ — ทดสอบได้แบบ dry-run (เห็น payload) หรือวาง token/ปลายทางชั่วคราวในฟอร์มด้านล่าง"}
        </div>
      </section>

      {/* คู่มือ */}
      <section className="card p-5">
        <h2 className="text-[15px] font-medium text-ink mb-1">ต้องใช้ข้อมูลอะไรบ้าง (ทำครั้งเดียว)</h2>
        <p className="text-[12px] text-muted mb-4">ทำที่ LINE Developers Console — ฟรี</p>
        <ol className="flex flex-col gap-3 text-[14px] text-body">
          <Step n={1} title="สร้าง LINE Official Account + Messaging API channel">
            เข้า <Code>developers.line.biz</Code> → สร้าง Provider → สร้าง channel แบบ <b>Messaging API</b> (จะได้ LINE OA มาด้วย)
          </Step>
          <Step n={2} title="ออก Channel access token">
            ในแท็บ <b>Messaging API</b> ของ channel → กด <b>Issue</b> ที่หัวข้อ “Channel access token (long-lived)” → คัดลอกมาใส่ <Code>LINE_CHANNEL_ACCESS_TOKEN</Code>
          </Step>
          <Step n={3} title="หา ‘ปลายทาง’ ที่จะส่งไป">
            <span className="block">• <b>ส่งหาตัวเอง:</b> แท็บ <b>Basic settings</b> → คัดลอก <b>Your user ID</b> (ขึ้นต้น <Code>U…</Code>)</span>
            <span className="block">• <b>ส่งเข้ากลุ่มทีม:</b> เชิญบอท (LINE OA) เข้ากลุ่ม แล้วอ่าน <Code>groupId</Code> (ขึ้นต้น <Code>C…</Code>) จาก webhook event</span>
            <span className="block">นำค่าที่ได้ใส่ <Code>LINE_TO</Code></span>
          </Step>
          <Step n={4} title="เพิ่มบอทเป็นเพื่อน / เข้ากลุ่ม">
            ผู้รับต้องเพิ่ม LINE OA เป็นเพื่อน (หรืออยู่กลุ่มเดียวกับบอท) ไม่งั้น LINE จะปฏิเสธการ push
          </Step>
          <Step n={5} title="ใส่ค่าใน .env แล้ว restart">
            <pre className="bg-ink text-white rounded-md p-3 text-[12px] overflow-x-auto mt-1">{`LINE_CHANNEL_ACCESS_TOKEN="xxxxx"
LINE_TO="Uxxxxxxxx…"`}</pre>
            จากนั้นตั้ง cron รัน <Code>npm run notify</Code> เช้าทุกวัน — งานเลย/ใกล้กำหนดจะเด้งเข้า LINE
          </Step>
        </ol>
      </section>

      {/* demo ทดสอบส่ง */}
      <section className="card p-5">
        <h2 className="text-[15px] font-medium text-ink mb-1">ทดสอบส่งข้อความ (demo)</h2>
        <p className="text-[12px] text-muted mb-4">
          ยิงจริงไป LINE ถ้าตั้งค่าครบ · ถ้ายังไม่ครบจะแสดง payload แบบ dry-run ให้เห็นว่าจะส่งอะไร
        </p>
        <LineTestForm hasEnvConfig={ready} />
      </section>

      <p className="text-[12px] text-muted">
        หมายเหตุ: adapter รองรับ webhook (Slack/Discord/Teams) ด้วย — ตั้ง <Code>NOTIFY_WEBHOOK_URL</Code> แทนได้ · โค้ดส่งอยู่ที่{" "}
        <Code>src/lib/line.ts</Code> และ <Code>src/lib/notify-external.ts</Code>
      </p>
    </div>
  );
}

function StatusLine({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid place-items-center w-6 h-6 rounded-full text-white text-[13px] shrink-0 ${ok ? "bg-forest" : "bg-surface-strong"}`}>
        {ok ? "✓" : "—"}
      </span>
      <span className="text-[14px] text-ink w-48 shrink-0">{label}</span>
      <span className="text-[13px] text-muted truncate">{detail}</span>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid place-items-center w-6 h-6 rounded-full bg-ink text-white text-[12px] font-medium shrink-0">{n}</span>
      <div className="min-w-0">
        <div className="font-medium text-ink">{title}</div>
        <div className="text-[13px] text-body mt-0.5">{children}</div>
      </div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-surface-strong text-ink rounded px-1.5 py-0.5 text-[12px]">{children}</code>;
}
