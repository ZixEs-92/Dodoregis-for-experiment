// Auth core (server-only) — password hashing, session cookie (JWT), current user
// ห้าม import ไฟล์นี้เข้า client component (มี next/headers + prisma). ฝั่ง client ใช้ lib/roles.ts แทน
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

export const SESSION_COOKIE = "dodoregis_session";
const MAX_AGE_SECONDS = 8 * 60 * 60; // 8 ชั่วโมง

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET ไม่ได้ตั้งค่าใน .env");
  return new TextEncoder().encode(s);
}

// ── รหัสผ่าน ──
export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// ── session token (JWT เซ็นด้วย HS256) ──
export async function signSession(user: {
  id: number;
  role: UserRole;
  displayName: string;
}): Promise<string> {
  return new SignJWT({ role: user.role, name: user.displayName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function setSessionCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

async function readPayload(): Promise<{ uid: number } | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const uid = Number(payload.sub);
    return uid ? { uid } : null;
  } catch {
    return null; // token หมดอายุ/ปลอม
  }
}

/** ผู้ใช้ปัจจุบันจาก session (null ถ้ายังไม่ล็อกอิน) — cache ต่อ 1 request */
export const getCurrentUser = cache(async () => {
  const p = await readPayload();
  if (!p) return null;
  const user = await prisma.user.findUnique({
    where: { id: p.uid },
    include: { department: true, member: true },
  });
  if (!user || !user.active) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** บังคับให้ล็อกอิน — ไม่งั้น redirect ไป /login (ใช้ใน Phase 3b) */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** บังคับให้มี role ตามที่กำหนด — ไม่งั้น redirect (ใช้ใน Phase 3b) */
export async function requireRole(...roles: UserRole[]): Promise<CurrentUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/");
  return u;
}
