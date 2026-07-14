"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateRegisNo, buildItemCode, nextItemNo } from "@/lib/regisNo";
import { validateStatusRequirements } from "@/lib/workflow";
import { notifyStatusChange } from "@/lib/notifications";
import {
  storeUploadedFile,
  validateUpload,
  deleteStoredFile,
} from "@/lib/uploads";
import {
  RequestStatus,
  RunResult,
  ReportStatus,
  AttachmentKind,
} from "@/generated/prisma/client";

export type ActionResult = {
  ok: boolean;
  errors: string[];
  saved?: boolean;
};

// ── helpers ─────────────────────────────────────────────────

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T00:00:00+07:00`);
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

async function nameOfPartLocation(id: number | null): Promise<string | null> {
  if (!id) return null;
  const r = await prisma.partLocation.findUnique({ where: { id } });
  return r?.name ?? null;
}
async function nameOfFinishedLocation(id: number | null): Promise<string | null> {
  if (!id) return null;
  const r = await prisma.finishedLocation.findUnique({ where: { id } });
  return r?.name ?? null;
}

const RESULT_VALUES: string[] = ["PASS", "FAIL", "CONDITIONAL_PASS"];
const REPORT_STATUS_VALUES: string[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "PENDING_APPROVAL",
  "SENT",
];
const KIND_VALUES: string[] = [
  "REQUEST_DOC",
  "EMAIL",
  "PHOTO",
  "TEST_SPEC",
  "OTHER",
];

// ── ตรวจฟิลด์ระดับ item ──

function validateItemFields(fd: FormData): string[] {
  const errors: string[] = [];
  if (!str(fd, "part_name")) errors.push("กรุณากรอกชื่อชิ้นงาน/รุ่น Lamp");
  if (!str(fd, "test_detail")) errors.push("กรุณากรอกรายละเอียดเทส/มาตรฐานอ้างอิง");
  if (!num(fd, "owner")) errors.push("กรุณาเลือกผู้รับผิดชอบหลัก");
  return errors;
}

function itemDataFromForm(fd: FormData) {
  return {
    partName: str(fd, "part_name")!,
    partNo: str(fd, "part_no"),
    qty: num(fd, "qty"),
    partReceivedDate: date(fd, "part_received_date"),
    partLocationId: num(fd, "part_location"),
    testDetail: str(fd, "test_detail")!,
    planStart: date(fd, "plan_start"),
    planEnd: date(fd, "plan_end"),
    actualStart: date(fd, "actual_start"),
    actualEnd: date(fd, "actual_end"),
    ownerId: num(fd, "owner")!,
    finishedPartLocationId: num(fd, "finished_part_location"),
    rawDataLocation: str(fd, "raw_data_location"),
    remark: str(fd, "remark"),
  };
}

// ── สร้างใบรีเควสใหม่ (พร้อม item แรก) ──────────────────────

export async function createRequestWithItem(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const errors: string[] = [];
  if (!num(formData, "request_dept")) errors.push("กรุณาเลือกแผนกที่รีเควส");
  if (!str(formData, "requester")) errors.push("กรุณากรอกผู้รีเควส");
  if (!date(formData, "request_date")) errors.push("กรุณากรอกวันที่ได้ใบรีเควส");
  errors.push(...validateItemFields(formData));
  if (errors.length > 0) return { ok: false, errors };

  const requestDate = date(formData, "request_date")!;

  let createdRegisNo: string | null = null;
  for (let attempt = 0; attempt < 4 && !createdRegisNo; attempt++) {
    const { regisNo, seq } = await generateRegisNo(requestDate);
    try {
      await prisma.testRequest.create({
        data: {
          regisNo,
          seq,
          requestDeptId: num(formData, "request_dept")!,
          requester: str(formData, "requester")!,
          requestDate,
          remark: str(formData, "request_remark"),
          items: {
            create: {
              itemNo: 1,
              itemCode: buildItemCode(regisNo, 1),
              ...itemDataFromForm(formData),
              statusLogs: {
                create: { toStatus: "S1_RECEIVED", note: "สร้าง item" },
              },
            },
          },
        },
      });
      createdRegisNo = regisNo;
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 3) throw e;
    }
  }

  revalidatePath("/requests");
  revalidatePath("/");
  redirect(`/requests/${createdRegisNo}`);
}

// ── เพิ่ม item ในใบรีเควสเดิม ────────────────────────────────

export async function addItem(
  regisNo: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const errors = validateItemFields(formData);
  if (errors.length > 0) return { ok: false, errors };

  for (let attempt = 0; attempt < 4; attempt++) {
    const itemNo = await nextItemNo(regisNo);
    try {
      await prisma.testItem.create({
        data: {
          regisNo,
          itemNo,
          itemCode: buildItemCode(regisNo, itemNo),
          ...itemDataFromForm(formData),
          statusLogs: {
            create: { toStatus: "S1_RECEIVED", note: "สร้าง item" },
          },
        },
      });
      break;
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 3) throw e;
    }
  }

  revalidatePath(`/requests/${regisNo}`);
  revalidatePath("/requests");
  revalidatePath("/");
  return { ok: true, errors: [], saved: true };
}

// ── แก้ไขข้อมูล item ────────────────────────────────────────

export async function updateItemDetails(
  itemCode: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const errors = validateItemFields(formData);
  if (errors.length > 0) return { ok: false, errors };

  const current = await prisma.testItem.findUniqueOrThrow({
    where: { itemCode },
    include: { reports: true, partLocation: true, finishedPartLocation: true },
  });

  const data = itemDataFromForm(formData);

  // กันแก้ข้อมูลจนผิดกติกาของสถานะปัจจุบัน
  const invariantErrors = validateStatusRequirements(current.status, {
    partReceivedDate: data.partReceivedDate,
    partLocationId: data.partLocationId,
    finishedPartLocationId: data.finishedPartLocationId,
    rawDataLocation: data.rawDataLocation,
    reports: current.reports,
  });
  if (invariantErrors.length > 0) {
    return {
      ok: false,
      errors: invariantErrors.map((e) => `ขัดกับสถานะปัจจุบันของ item: ${e}`),
    };
  }

  // เก็บ chain of custody: log เฉพาะที่เก็บที่เปลี่ยนจริง
  const locLogs: {
    kind: "PART_LOCATION" | "FINISHED_LOCATION" | "RAW_DATA";
    fromName: string | null;
    toName: string | null;
  }[] = [];
  if (current.partLocationId !== data.partLocationId) {
    locLogs.push({
      kind: "PART_LOCATION",
      fromName: current.partLocation?.name ?? null,
      toName: await nameOfPartLocation(data.partLocationId),
    });
  }
  if (current.finishedPartLocationId !== data.finishedPartLocationId) {
    locLogs.push({
      kind: "FINISHED_LOCATION",
      fromName: current.finishedPartLocation?.name ?? null,
      toName: await nameOfFinishedLocation(data.finishedPartLocationId),
    });
  }
  if ((current.rawDataLocation ?? null) !== (data.rawDataLocation ?? null)) {
    locLogs.push({
      kind: "RAW_DATA",
      fromName: current.rawDataLocation,
      toName: data.rawDataLocation,
    });
  }

  await prisma.testItem.update({ where: { itemCode }, data });
  if (locLogs.length > 0) {
    await prisma.locationLog.createMany({
      data: locLogs.map((l) => ({ itemId: current.id, note: "แก้ผ่านฟอร์มข้อมูล item", ...l })),
    });
  }

  revalidatePath(`/items/${itemCode}`);
  revalidatePath(`/requests/${current.regisNo}`);
  revalidatePath("/requests");
  revalidatePath("/");
  return { ok: true, errors: [], saved: true };
}

// ── ย้ายที่เก็บชิ้นงาน (สแกน QR → เช็คอิน/เอาต์ chain of custody) ──

export async function moveLocation(
  itemCode: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const kind = str(formData, "kind"); // PART_LOCATION | FINISHED_LOCATION
  const locationId = num(formData, "location");
  const note = str(formData, "note");
  if (kind !== "PART_LOCATION" && kind !== "FINISHED_LOCATION") {
    return { ok: false, errors: ["ประเภทที่เก็บไม่ถูกต้อง"] };
  }
  if (!locationId) return { ok: false, errors: ["กรุณาเลือกที่เก็บปลายทาง"] };

  const current = await prisma.testItem.findUniqueOrThrow({
    where: { itemCode },
    include: { partLocation: true, finishedPartLocation: true },
  });

  if (kind === "PART_LOCATION") {
    const toName = await nameOfPartLocation(locationId);
    await prisma.testItem.update({
      where: { itemCode },
      data: { partLocationId: locationId },
    });
    await prisma.locationLog.create({
      data: {
        itemId: current.id,
        kind: "PART_LOCATION",
        fromName: current.partLocation?.name ?? null,
        toName,
        note,
      },
    });
  } else {
    const toName = await nameOfFinishedLocation(locationId);
    await prisma.testItem.update({
      where: { itemCode },
      data: { finishedPartLocationId: locationId },
    });
    await prisma.locationLog.create({
      data: {
        itemId: current.id,
        kind: "FINISHED_LOCATION",
        fromName: current.finishedPartLocation?.name ?? null,
        toName,
        note,
      },
    });
  }

  revalidatePath(`/items/${itemCode}`);
  revalidatePath(`/requests/${current.regisNo}`);
  return { ok: true, errors: [], saved: true };
}

// ── เปลี่ยนสถานะ item ───────────────────────────────────────

export async function changeItemStatus(itemCode: string, target: RequestStatus) {
  const item = await prisma.testItem.findUniqueOrThrow({
    where: { itemCode },
    include: { reports: { orderBy: { id: "desc" } } },
  });

  const errors = validateStatusRequirements(target, item);
  if (errors.length > 0) {
    return { ok: false as const, errors };
  }

  await prisma.testItem.update({
    where: { itemCode },
    data: {
      status: target,
      ...(target === "S9_HOLD" && item.status !== "S9_HOLD"
        ? { statusBeforeHold: item.status }
        : {}),
      ...(item.status === "S9_HOLD" && target !== "S9_HOLD"
        ? { statusBeforeHold: null }
        : {}),
      ...(target === "S4_TESTING" && !item.actualStart
        ? { actualStart: new Date() }
        : {}),
      ...(target === "S5_TEST_DONE" && !item.actualEnd
        ? { actualEnd: new Date() }
        : {}),
    },
  });

  if (target === "S7_SENT") {
    const sentReport = item.reports.find((r) => r.sentDate && r.reportUrl);
    if (sentReport && sentReport.status !== "SENT") {
      await prisma.report.update({
        where: { id: sentReport.id },
        data: { status: "SENT" },
      });
    }
  }

  // audit trail + แจ้งเตือน: บันทึกทุกครั้งที่สถานะเปลี่ยนจริง
  if (item.status !== target) {
    await prisma.statusLog.create({
      data: { itemId: item.id, fromStatus: item.status, toStatus: target },
    });
    await notifyStatusChange(item.id, item.itemCode, item.partName, target);
  }

  revalidatePath(`/items/${itemCode}`);
  revalidatePath(`/requests/${item.regisNo}`);
  revalidatePath("/requests");
  revalidatePath("/");
  return { ok: true as const, errors: [] as string[] };
}

// ── test runs ───────────────────────────────────────────────

export async function addTestRun(itemCode: string, formData: FormData) {
  const item = await prisma.testItem.findUniqueOrThrow({ where: { itemCode } });
  const last = await prisma.testRun.findFirst({
    where: { itemId: item.id },
    orderBy: { runNo: "desc" },
  });
  const runNo = (last?.runNo ?? 0) + 1;
  const resultRaw = str(formData, "result");

  await prisma.testRun.create({
    data: {
      itemId: item.id,
      runNo,
      startDate: date(formData, "start_date"),
      endDate: date(formData, "end_date"),
      loadingOwnerId: num(formData, "loading_owner"),
      testOwnerId: num(formData, "test_owner"),
      result:
        resultRaw && RESULT_VALUES.includes(resultRaw)
          ? (resultRaw as RunResult)
          : null,
      rawDataUrl: str(formData, "rawdata_url"),
      remark: str(formData, "remark"),
    },
  });

  revalidatePath(`/items/${itemCode}`);
}

// ── report ──────────────────────────────────────────────────

export async function upsertReport(itemCode: string, formData: FormData) {
  const item = await prisma.testItem.findUniqueOrThrow({ where: { itemCode } });
  const existing = await prisma.report.findFirst({
    where: { itemId: item.id },
    orderBy: { id: "desc" },
  });

  const statusRaw = str(formData, "status");
  const data = {
    status:
      statusRaw && REPORT_STATUS_VALUES.includes(statusRaw)
        ? (statusRaw as ReportStatus)
        : ("NOT_STARTED" as ReportStatus),
    sentDate: date(formData, "sent_date"),
    filePath: str(formData, "file_path"),
    reportUrl: str(formData, "report_url"),
    authorId: num(formData, "author"),
    approverId: num(formData, "approver"),
  };

  if (existing) {
    await prisma.report.update({ where: { id: existing.id }, data });
  } else {
    await prisma.report.create({ data: { itemId: item.id, ...data } });
  }

  revalidatePath(`/items/${itemCode}`);
}

// ── ไฟล์แนบ ─────────────────────────────────────────────────

type AttachScope =
  | { requestNo: string; itemId?: undefined }
  | { itemId: number; requestNo?: undefined };

async function revalidateForScope(scope: AttachScope) {
  if (scope.requestNo) {
    revalidatePath(`/requests/${scope.requestNo}`);
  } else if (scope.itemId) {
    const item = await prisma.testItem.findUnique({ where: { id: scope.itemId } });
    if (item) {
      revalidatePath(`/items/${item.itemCode}`);
      revalidatePath(`/requests/${item.regisNo}`);
    }
  }
}

export async function uploadAttachment(
  scope: AttachScope,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const kindRaw = str(formData, "kind");
  const kind: AttachmentKind =
    kindRaw && KIND_VALUES.includes(kindRaw)
      ? (kindRaw as AttachmentKind)
      : "OTHER";
  const label = str(formData, "label");
  const url = str(formData, "url");
  const file = formData.get("file");

  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !url) {
    return { ok: false, errors: ["กรุณาเลือกไฟล์ หรือใส่ลิงก์"] };
  }

  if (hasFile) {
    const fileObj = file as File;
    const err = validateUpload(fileObj);
    if (err) return { ok: false, errors: [err] };
    const stored = await storeUploadedFile(fileObj);
    await prisma.attachment.create({
      data: {
        requestNo: scope.requestNo,
        itemId: scope.itemId,
        kind,
        label,
        ...stored,
      },
    });
  } else {
    await prisma.attachment.create({
      data: {
        requestNo: scope.requestNo,
        itemId: scope.itemId,
        kind,
        label,
        url,
      },
    });
  }

  await revalidateForScope(scope);
  return { ok: true, errors: [], saved: true };
}

export async function deleteAttachment(id: number) {
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return;
  if (att.storedName) await deleteStoredFile(att.storedName);
  await prisma.attachment.delete({ where: { id } });

  if (att.requestNo) revalidatePath(`/requests/${att.requestNo}`);
  if (att.itemId) {
    const item = await prisma.testItem.findUnique({ where: { id: att.itemId } });
    if (item) {
      revalidatePath(`/items/${item.itemCode}`);
      revalidatePath(`/requests/${item.regisNo}`);
    }
  }
}

// ── แจ้งเตือน (mark read) ───────────────────────────────────

export async function markNotificationRead(id: number) {
  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  await prisma.notification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

// ── master data (แผนก / ทีม / ที่เก็บ) ──────────────────────

type MasterKind = "department" | "member" | "partLocation" | "finishedLocation";

export async function addMaster(
  kind: MasterKind,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name = str(formData, "name");
  if (!name) return { ok: false, errors: ["กรุณากรอกชื่อ"] };
  const role = str(formData, "role");

  try {
    if (kind === "department") {
      await prisma.department.create({ data: { name } });
    } else if (kind === "member") {
      await prisma.member.create({ data: { name, role } });
    } else if (kind === "partLocation") {
      await prisma.partLocation.create({ data: { name } });
    } else {
      await prisma.finishedLocation.create({ data: { name } });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: ["มีชื่อนี้อยู่แล้ว"] };
    throw e;
  }

  revalidatePath("/master");
  return { ok: true, errors: [], saved: true };
}

export async function renameMaster(kind: MasterKind, id: number, formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  const role = str(formData, "role");

  try {
    if (kind === "department") {
      await prisma.department.update({ where: { id }, data: { name } });
    } else if (kind === "member") {
      await prisma.member.update({ where: { id }, data: { name, role } });
    } else if (kind === "partLocation") {
      await prisma.partLocation.update({ where: { id }, data: { name } });
    } else {
      await prisma.finishedLocation.update({ where: { id }, data: { name } });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return;
    throw e;
  }
  revalidatePath("/master");
}

export async function setDepartmentSla(id: number, formData: FormData) {
  const raw = str(formData, "sla_days");
  const days = raw ? Number(raw) : NaN;
  await prisma.department.update({
    where: { id },
    data: { slaDays: Number.isFinite(days) && days > 0 ? Math.floor(days) : null },
  });
  revalidatePath("/master");
  revalidatePath("/analytics");
}

export async function toggleMasterActive(
  kind: MasterKind,
  id: number,
  active: boolean
) {
  if (kind === "department") {
    await prisma.department.update({ where: { id }, data: { active } });
  } else if (kind === "member") {
    await prisma.member.update({ where: { id }, data: { active } });
  } else if (kind === "partLocation") {
    await prisma.partLocation.update({ where: { id }, data: { active } });
  } else {
    await prisma.finishedLocation.update({ where: { id }, data: { active } });
  }
  revalidatePath("/master");
  revalidatePath("/requests/new");
}
