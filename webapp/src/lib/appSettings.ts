// ค่าตั้งค่าที่แก้ได้ตอนรัน (key/value ใน AppSetting) — server-only (ใช้ prisma)
import { prisma } from "@/lib/prisma";

const DEPT_STAGE_KEY = "approval.deptStage";

/**
 * ชั้นอนุมัติหัวหน้าแผนกเปิดอยู่ไหม — ถ้ายังไม่มีแถวในตาราง ค่าเริ่มต้นคือ "เปิด"
 * (ผู้ใช้อาจปิดชั้นนี้ทีหลังถ้าใช้ไม่เวิร์ก — ดู docs/แผน-flow-อนุมัติใบรีเควส.md ข้อ 3.1.7)
 */
export async function isDeptStageOn(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: DEPT_STAGE_KEY } });
  return row ? row.value === "on" : true;
}

export async function setDeptStage(on: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: DEPT_STAGE_KEY },
    update: { value: on ? "on" : "off" },
    create: { key: DEPT_STAGE_KEY, value: on ? "on" : "off" },
  });
}
