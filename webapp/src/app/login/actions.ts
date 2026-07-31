"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  signSession,
  setSessionCookie,
  clearSessionCookie,
} from "@/lib/auth";

export type LoginState = { error: string | null };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  // ตอบข้อความเดียวกันทุกกรณีที่ล็อกอินไม่ผ่าน เพื่อไม่บอกใบ้ว่ามี username นี้ไหม
  if (
    !user ||
    !user.active ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await setSessionCookie(await signSession(user));
  redirect("/"); // โยน NEXT_REDIRECT — ต้องอยู่นอก try/catch
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
