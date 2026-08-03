import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/uploads";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // id เป็นเลขเรียง — ถ้าไม่กัน ใครก็ไล่โหลดไฟล์แนบทุกใบได้
  const user = await getCurrentUser();
  if (!user) return new Response("กรุณาเข้าสู่ระบบก่อน", { status: 401 });

  const { id } = await params;
  const attId = Number(id);
  if (!Number.isInteger(attId)) {
    return new Response("Not found", { status: 404 });
  }

  const att = await prisma.attachment.findUnique({
    where: { id: attId },
    include: {
      request: { select: { requestDeptId: true } },
      item: { select: { request: { select: { requestDeptId: true } } } },
    },
  });
  if (!att) return new Response("Not found", { status: 404 });

  // ผู้ขอทดสอบเปิดได้เฉพาะไฟล์ของใบในแผนกตัวเอง
  if (user.role === "REQUESTER") {
    const deptId = att.request?.requestDeptId ?? att.item?.request?.requestDeptId ?? null;
    if (deptId == null || deptId !== user.departmentId) {
      return new Response("ไม่มีสิทธิ์เปิดไฟล์นี้", { status: 403 });
    }
  }

  // ลิงก์ภายนอก → redirect
  if (att.url) redirect(att.url);

  if (!att.storedName) return new Response("Not found", { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readStoredFile(att.storedName);
  } catch {
    return new Response("File missing on disk", { status: 404 });
  }

  const isViewable =
    att.mimeType?.startsWith("image/") || att.mimeType === "application/pdf";
  const disposition = isViewable ? "inline" : "attachment";
  const filename = encodeURIComponent(att.fileName ?? att.storedName);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": att.mimeType ?? "application/octet-stream",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${filename}`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
