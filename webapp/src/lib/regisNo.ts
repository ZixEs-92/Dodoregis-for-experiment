import { prisma } from "@/lib/prisma";

/** ออกเลข TR-YYMM-### ใหม่ รันต่อเนื่องต่อเดือน เช่น TR-2607-001 */
export function regisPrefix(date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `TR-${yy}${mm}`;
}

export async function generateRegisNo(
  requestDate: Date
): Promise<{ regisNo: string; seq: number }> {
  const prefix = regisPrefix(requestDate);

  const last = await prisma.testRequest.findFirst({
    where: { regisNo: { startsWith: `${prefix}-` } },
    orderBy: { seq: "desc" },
  });

  const nextSeq = (last?.seq ?? 0) + 1;
  const regisNo = `${prefix}-${String(nextSeq).padStart(3, "0")}`;
  return { regisNo, seq: nextSeq };
}

/** เลข item = {regisNo}-NN เช่น TR-2607-001-01 */
export function buildItemCode(regisNo: string, itemNo: number): string {
  return `${regisNo}-${String(itemNo).padStart(2, "0")}`;
}

/** หา itemNo ถัดไปของใบรีเควส (1 ถ้ายังไม่มี item) */
export async function nextItemNo(regisNo: string): Promise<number> {
  const last = await prisma.testItem.findFirst({
    where: { regisNo },
    orderBy: { itemNo: "desc" },
  });
  return (last?.itemNo ?? 0) + 1;
}
