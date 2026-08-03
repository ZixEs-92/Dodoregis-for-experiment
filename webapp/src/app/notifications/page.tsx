import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { generateDueNotifications, generateOverdueApprovalNotifications } from "@/lib/notifications";
import { markNotificationRead, markAllNotificationsRead } from "@/app/actions";
import { guardPageUser } from "@/lib/guard";
import { toScope } from "@/lib/auth";
import { canEditTests, canManageSystem, canReachApprovals, departmentFilter } from "@/lib/roles";
import { toDisplayDateTime } from "@/lib/date";
import { NotificationLevel } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "แจ้งเตือน — Dodoregis" };

const LEVEL_COLOR: Record<NotificationLevel, string> = {
  INFO: "bg-info-soft text-info",
  WARNING: "bg-mustard-soft text-mustard-deep",
  CRITICAL: "bg-coral-soft text-coral",
};
const LEVEL_LABEL: Record<NotificationLevel, string> = {
  INFO: "ข้อมูล",
  WARNING: "ต้องติดตาม",
  CRITICAL: "ด่วน",
};

export default async function NotificationsPage() {
  const user = await guardPageUser("/notifications");
  const scope = toScope(user);
  const isTeam = canEditTests(user.role);

  // เปิดหน้านี้ = รีเฟรชแจ้งเตือนงานเลย/ใกล้กำหนด + ใบค้างรออนุมัติ (กันซ้ำรายวันในตัว)
  // ให้เฉพาะคนที่เกี่ยวข้องเป็นคนจุด — ผู้ขอทดสอบไม่ควรเขียนข้อมูลของทั้งแลป
  if (isTeam) await generateDueNotifications().catch(() => {});
  if (canReachApprovals(scope)) await generateOverdueApprovalNotifications().catch(() => {});

  // ผู้ขอทดสอบ/หัวหน้าแผนกเห็นเฉพาะแจ้งเตือนของงานในขอบเขตแผนกตัวเอง
  // เช็คทั้งทาง item->request (แจ้งเตือนสถานะ/กำหนดเวลา) และ regisNo ตรง (แจ้งเตือนระดับใบที่ไม่ผูก item)
  const deptFilter = departmentFilter(scope);
  const notifications = await prisma.notification.findMany({
    where: deptFilter
      ? {
          OR: [
            { item: { request: { requestDeptId: deptFilter } } },
            { request: { requestDeptId: deptFilter } },
          ],
        }
      : {},
    include: { item: true },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">แจ้งเตือน</h1>
          <p className="text-[14px] text-muted mt-0.5">
            งานเลยกำหนด/ใกล้กำหนด และการเปลี่ยนสถานะ · ยังไม่อ่าน {unread} รายการ
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canManageSystem(user.role) && (
            <Link href="/settings/line" className="btn-secondary btn-sm">⚙️ ตั้งค่า LINE</Link>
          )}
          {unread > 0 && isTeam && (
            <form action={markAllNotificationsRead}>
              <button type="submit" className="btn-secondary btn-sm">ทำเครื่องหมายอ่านทั้งหมด</button>
            </form>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card p-10 text-center text-muted">ยังไม่มีการแจ้งเตือน</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => {
            const markRead = markNotificationRead.bind(null, n.id);
            return (
              <li
                key={n.id}
                className={`card p-4 flex items-start gap-3 ${
                  n.readAt ? "opacity-60" : ""
                }`}
              >
                <span className={`chip ${LEVEL_COLOR[n.level]} shrink-0 mt-0.5`}>
                  {LEVEL_LABEL[n.level]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] text-ink">{n.message}</div>
                  <div className="text-[12px] text-muted mt-0.5">
                    {toDisplayDateTime(n.createdAt)}
                    {n.item ? (
                      <>
                        {" · "}
                        <Link href={`/items/${n.item.itemCode}`} className="text-link hover:underline">
                          เปิดงาน →
                        </Link>
                      </>
                    ) : (
                      n.regisNo && (
                        <>
                          {" · "}
                          <Link href={`/requests/${n.regisNo}`} className="text-link hover:underline">
                            เปิดใบ →
                          </Link>
                        </>
                      )
                    )}
                  </div>
                </div>
                {!n.readAt && (
                  <form action={markRead} className="shrink-0">
                    <button type="submit" className="text-[13px] text-link hover:underline">
                      อ่านแล้ว
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
