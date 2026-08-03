// Session token ล้วน ๆ — ไม่แตะ prisma / next/headers เพื่อให้ proxy.ts import ได้
// (proxy รันหน้า route ทั้งหมด ถ้าลาก prisma เข้าไปด้วยจะหนักและพังตอน build)
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/generated/prisma/client";

export const SESSION_COOKIE = "dodoregis_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 ชั่วโมง

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET ไม่ได้ตั้งค่าใน .env");
  return new TextEncoder().encode(s);
}

export async function signSessionToken(user: {
  id: number;
  role: UserRole;
  displayName: string;
}): Promise<string> {
  return new SignJWT({ role: user.role, name: user.displayName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

/** ตรวจลายเซ็น + วันหมดอายุ คืน user id — null ถ้า token เสีย/หมดอายุ/ไม่มี */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<{ uid: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const uid = Number(payload.sub);
    return uid ? { uid } : null;
  } catch {
    return null; // token หมดอายุ/ปลอม
  }
}
