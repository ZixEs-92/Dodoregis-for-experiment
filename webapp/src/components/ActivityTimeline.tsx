import { toDisplayDateTime } from "@/lib/date";

export type TimelineEvent = {
  at: Date;
  kind: "status" | "location";
  title: string;
  detail?: string;
};

export default function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[14px] text-muted mt-4">ยังไม่มีประวัติ</p>;
  }

  return (
    <ol className="mt-4 flex flex-col">
      {events.map((ev, i) => {
        const isStatus = ev.kind === "status";
        return (
          <li key={i} className="flex gap-3">
            {/* rail */}
            <div className="flex flex-col items-center">
              <span
                className={`grid place-items-center w-6 h-6 rounded-full text-[11px] shrink-0 ${
                  isStatus ? "bg-ink text-white" : "bg-mint-soft text-forest"
                }`}
                title={isStatus ? "เปลี่ยนสถานะ" : "ย้ายที่เก็บ"}
              >
                {isStatus ? "◆" : "⇄"}
              </span>
              {i < events.length - 1 && <span className="w-px flex-1 bg-hairline my-1" />}
            </div>
            {/* body */}
            <div className="pb-4 min-w-0">
              <div className="text-[14px] text-ink">{ev.title}</div>
              <div className="text-[12px] text-muted">{toDisplayDateTime(ev.at)}</div>
              {ev.detail && <div className="text-[12px] text-body mt-0.5">{ev.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
