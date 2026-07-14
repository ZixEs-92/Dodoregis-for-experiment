import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";

// เก็บไฟล์อัปโหลดไว้นอก public (เสิร์ฟผ่าน route /api/attachments/[id] เท่านั้น)
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MAX_BYTES = 15 * 1024 * 1024; // 15MB — ไฟล์เล็ก (รูป/PDF/เอกสาร); raw data ใหญ่ให้ใส่ลิงก์
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "message/rfc822", // .eml
  "text/plain",
  "text/csv",
]);

export type StoredFile = {
  fileName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
};

export function validateUpload(file: File): string | null {
  if (file.size === 0) return "ไฟล์ว่างเปล่า";
  if (file.size > MAX_BYTES)
    return `ไฟล์ใหญ่เกิน 15MB (ไฟล์ใหญ่ให้ใช้แนบลิงก์แทน)`;
  if (file.type && !ALLOWED_MIME.has(file.type))
    return `ชนิดไฟล์ไม่รองรับ: ${file.type} (รองรับรูป, PDF, Word/Excel, email, text)`;
  return null;
}

export async function storeUploadedFile(file: File): Promise<StoredFile> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name) || "";
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
  return {
    fileName: file.name,
    storedName,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

export async function readStoredFile(storedName: string): Promise<Buffer> {
  // กัน path traversal — ยอมเฉพาะชื่อไฟล์ล้วน
  const safe = path.basename(storedName);
  return readFile(path.join(UPLOAD_DIR, safe));
}

export async function deleteStoredFile(storedName: string): Promise<void> {
  const safe = path.basename(storedName);
  try {
    await unlink(path.join(UPLOAD_DIR, safe));
  } catch {
    // ไฟล์อาจถูกลบไปแล้ว — ไม่ต้อง throw
  }
}
