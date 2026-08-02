import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { MAX_UPLOAD_MB, MAX_UPLOAD_TOTAL_MB } from "@/lib/workflow";

// เก็บไฟล์อัปโหลดไว้นอก public (เสิร์ฟผ่าน route /api/attachments/[id] เท่านั้น)
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// ไฟล์เล็ก (รูป/PDF/เอกสาร) เท่านั้น — raw data ก้อนใหญ่ให้เก็บโฟลเดอร์กลางแล้วใส่ลิงก์
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const MAX_TOTAL_BYTES = MAX_UPLOAD_TOTAL_MB * 1024 * 1024;
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
  "application/vnd.ms-outlook", // .msg (อีเมลที่ save จาก Outlook)
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
  if (file.size === 0) return `ไฟล์ว่างเปล่า: ${file.name}`;
  if (file.size > MAX_BYTES)
    return `${file.name} ใหญ่เกิน ${MAX_UPLOAD_MB}MB (ไฟล์ใหญ่ให้เก็บโฟลเดอร์กลางแล้วแนบลิงก์แทน)`;
  if (file.type && !ALLOWED_MIME.has(file.type))
    return `ชนิดไฟล์ไม่รองรับ: ${file.name} (รองรับรูป, PDF, Word/Excel, email, text)`;
  return null;
}

/** ตรวจไฟล์หลายไฟล์ที่ส่งมาพร้อมกัน — รวมขนาดต้องไม่เกินโควตาต่อการส่ง 1 ครั้ง */
export function validateUploadBatch(files: File[]): string[] {
  const errors = files.map(validateUpload).filter((e): e is string => e !== null);
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    errors.push(
      `ไฟล์แนบรวมกันใหญ่เกิน ${MAX_UPLOAD_TOTAL_MB}MB — ลดจำนวนไฟล์ แล้วค่อยแนบเพิ่มในหน้าใบรีเควสภายหลัง`,
    );
  }
  return errors;
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
