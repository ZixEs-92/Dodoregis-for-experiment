"use server";

import { revalidatePath } from "next/cache";
import { ensureManageSystem } from "@/lib/guard";
import { setDeptStage } from "@/lib/appSettings";

/** เปิด/ปิดชั้นอนุมัติหัวหน้าแผนก — admin เท่านั้น (ผู้ใช้อาจปิดชั้นนี้ทีหลังถ้าใช้ไม่เวิร์ก) */
export async function toggleDeptStage(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const denied = await ensureManageSystem();
  if (denied) return { ok: false, error: denied };
  await setDeptStage(on);
  revalidatePath("/settings/approvals");
  return { ok: true };
}
