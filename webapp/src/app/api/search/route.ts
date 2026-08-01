import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { testTitle } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

/** ค้นหางานสำหรับแถบคำสั่งด่วน (⌘K) — คืนผลไม่เกิน 8 รายการ */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return Response.json({ items: [] });

  // requester ค้นเจอเฉพาะงานแผนกตัวเอง (กติกาเดียวกับหน้ารายการงาน)
  const user = await getCurrentUser();
  const deptScoped = user?.role === "REQUESTER" && user.departmentId != null;

  const where: Prisma.TestItemWhereInput = {
    OR: [
      { itemCode: { contains: q } },
      { partName: { contains: q } },
      { partNo: { contains: q } },
      { testName: { contains: q } },
      { regisNo: { contains: q } },
    ],
    ...(deptScoped ? { request: { requestDeptId: user!.departmentId! } } : {}),
  };

  const items = await prisma.testItem.findMany({
    where,
    include: { owner: true },
    orderBy: [{ regisNo: "desc" }, { itemNo: "asc" }],
    take: 8,
  });

  return Response.json({
    items: items.map((it) => ({
      itemCode: it.itemCode,
      title: testTitle(it.testName, it.testDetail) || it.partName,
      partName: it.partName,
      status: it.status,
      ownerName: it.owner?.name ?? null,
    })),
  });
}
