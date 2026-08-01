import QRCode from "qrcode";
import { headers } from "next/headers";

/**
 * โหมดของเนื้อหาใน QR — ตั้งด้วย QR_MODE ใน .env
 *
 * "code" (ค่าเริ่มต้น) — ฝังแค่ "รหัส" เช่น TR-2607-001-01
 *   ✔ QR ไม่ผูกกับ URL → เปลี่ยนโดเมน/ย้ายเซิร์ฟเวอร์ ก็ไม่ต้องพิมพ์ label ใหม่
 *   ✔ สแกนผ่านหน้า /scan ในแอป (แอปแปลงรหัส → เปิดหน้างานให้เอง)
 *   ✘ กล้องมือถือปกติจะอ่านได้เป็นข้อความเฉย ๆ กดเปิดลิงก์ไม่ได้
 *
 * "url" — ฝัง URL เต็ม (พฤติกรรมเดิม) เหมาะเมื่อมีโดเมนถาวรแล้ว
 *   ✔ กล้องมือถือปกติสแกนแล้วเด้งเข้าหน้างานได้ทันที
 *   ✘ ถ้า URL เปลี่ยน label ที่พิมพ์ไปแล้วจะชี้ที่อยู่เก่า (แต่หน้า /scan ยังอ่านได้ เพราะตัดโดเมนทิ้ง)
 */
export type QrMode = "code" | "url";

export function qrMode(): QrMode {
  return process.env.QR_MODE === "url" ? "url" : "code";
}

/**
 * Base URL สำหรับฝังใน QR โหมด "url" และสำหรับลิงก์แบบเต็ม
 * ตั้ง APP_BASE_URL ใน .env (เช่น http://192.168.1.10:3000 หรือโดเมนจริง)
 * ถ้าไม่ตั้ง จะเดาจาก request header ซึ่งใช้ได้เฉพาะตอนเปิดผ่าน URL เดียวกับที่จะสแกน
 */
async function resolveBaseUrl(): Promise<string> {
  const envBase = process.env.APP_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const forwardedProto = h.get("x-forwarded-proto");
  const isLocalOrLan =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host);
  const protocol = forwardedProto ?? (isLocalOrLan ? "http" : "https");
  return `${protocol}://${host}`;
}

/** ดึงรหัสท้าย path ของงาน (/items/CODE หรือ /requests/CODE) — คืน null ถ้าไม่ใช่ */
function codeFromPath(path: string): string | null {
  const m = path.match(/^\/(?:items|requests)\/([^/?#]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** ข้อความที่จะฝังลงใน QR ตามโหมดที่ตั้งไว้ */
async function qrPayload(path: string): Promise<string> {
  if (qrMode() === "code") {
    const code = codeFromPath(path);
    if (code) return code; // เช่น "TR-2607-001-01" — นิ่ง ไม่ผูกกับ URL
  }
  return `${await resolveBaseUrl()}${path}`;
}

export async function generateQrDataUrl(path: string, size = 220): Promise<string> {
  return QRCode.toDataURL(await qrPayload(path), { width: size, margin: 1 });
}

export async function absoluteUrl(path: string): Promise<string> {
  const base = await resolveBaseUrl();
  return `${base}${path}`;
}
