import QRCode from "qrcode";
import { headers } from "next/headers";

/**
 * Base URL สำหรับฝังใน QR — ต้องเป็น URL ที่มือถือสแกนแล้วเปิดได้จริง
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

export async function generateQrDataUrl(path: string, size = 220): Promise<string> {
  const base = await resolveBaseUrl();
  return QRCode.toDataURL(`${base}${path}`, { width: size, margin: 1 });
}

export async function absoluteUrl(path: string): Promise<string> {
  const base = await resolveBaseUrl();
  return `${base}${path}`;
}
