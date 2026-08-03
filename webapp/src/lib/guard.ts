// ตัวกันสิทธิ์ฝั่ง server (Phase 3b) — เรียกต้นทุก server action ที่แก้ข้อมูล
// คืน null = ผ่าน, คืน string = ข้อความเหตุผลที่ถูกปฏิเสธ
// นโยบาย: "ดู" เปิดให้ทุกคน (ไม่ต้องล็อกอิน) แต่ "แก้/สร้าง" ต้องล็อกอิน + role พอ
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { canCreateRequest, canEditTests, canPlanAndManage } from "@/lib/roles";
import type { UserRole } from "@/generated/prisma/client";

async function currentRole(): Promise<UserRole | null> {
  const u = await getCurrentUser();
  return u?.role ?? null;
}

// ── ตัวกันระดับหน้า (เรียกต้น page component) — redirect ถ้าสิทธิ์ไม่พอ ──
// ยังไม่ล็อกอิน → ไปหน้า login พร้อม ?next= เพื่อพากลับมาหน้าเดิม (สำคัญกับ flow สแกน QR)
// ล็อกอินแล้วแต่ role ไม่พอ → กลับหน้าหลัก (ไปหน้า login ซ้ำไม่ช่วยอะไร)

function toLogin(nextPath?: string): never {
  redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
}

/** หน้าที่ต้องล็อกอินก่อน (role ใดก็ได้) — คืนผู้ใช้ปัจจุบันให้ใช้ต่อได้เลย */
export async function guardPageUser(nextPath?: string): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) toLogin(nextPath);
  return u;
}

/** หน้าเฉพาะผู้สร้างงาน (requester+) */
export async function guardPageCreate(nextPath?: string): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) toLogin(nextPath);
  if (!canCreateRequest(u.role)) redirect("/");
  return u;
}

/** หน้าของทีมแลป (engineer + admin) — เช่น รายงาน/วิเคราะห์/พิมพ์ label */
export async function guardPageTeam(nextPath?: string): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) toLogin(nextPath);
  if (!canEditTests(u.role)) redirect("/");
  return u;
}

/** หน้าเฉพาะ admin */
export async function guardPageAdmin(nextPath?: string): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) toLogin(nextPath);
  if (!canPlanAndManage(u.role)) redirect("/");
  return u;
}

/** ต้องล็อกอิน (role ใดก็ได้) */
export async function ensureUser(): Promise<string | null> {
  return (await currentRole()) ? null : "กรุณาเข้าสู่ระบบก่อน";
}

/** ลงทะเบียนงานใหม่ — requester ขึ้นไป */
export async function ensureCreateRequest(): Promise<string | null> {
  return canCreateRequest(await currentRole())
    ? null
    : "ไม่มีสิทธิ์สร้างงาน — ต้องเข้าสู่ระบบเป็นผู้ขอทดสอบขึ้นไป";
}

/** ปรับสถานะ/ลงผลเทส/รีพอร์ท/ไฟล์แนบ/ย้ายที่เก็บ — engineer ขึ้นไป */
export async function ensureEditTests(): Promise<string | null> {
  return canEditTests(await currentRole())
    ? null
    : "ไม่มีสิทธิ์แก้ไข — ต้องเข้าสู่ระบบเป็นวิศวกรทดสอบขึ้นไป";
}

/** วางแผน/มอบหมาย/จัดการ master + users — admin เท่านั้น */
export async function ensurePlanManage(): Promise<string | null> {
  return canPlanAndManage(await currentRole())
    ? null
    : "เฉพาะผู้ดูแลระบบเท่านั้น";
}
