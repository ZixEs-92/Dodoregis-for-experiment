import { prisma } from "@/lib/prisma";
import { getCurrentUser, toScope } from "@/lib/auth";
import { departmentFilter } from "@/lib/roles";
import { testTitle } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

/** ค้นหางานสำหรับแถบคำสั่งด่วน (⌘K) — คืนผลไม่เกิน 8 รายการ */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return Response.json({ items: [] });

  // requester/หัวหน้าแผนก ค้นเจอเฉพาะงานในขอบเขตแผนกตัวเอง (กติกาเดียวกับหน้ารายการงาน)
  const deptFilter = departmentFilter(toScope(user));

  const where: Prisma.TestItemWhereInput = {
    OR: [
      { itemCode: { contains: q } },
      { partName: { contains: q } },
      { partNo: { contains: q } },
      { testName: { contains: q } },
      { regisNo: { contains: q } },
    ],
    ...(deptFilter ? { request: { requestDeptId: deptFilter } } : {}),
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
