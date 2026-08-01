"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateRegisNo, buildItemCode, nextItemNo } from "@/lib/regisNo";
import { validateStatusRequirements } from "@/lib/workflow";
import { notifyStatusChange, notifyNewRequest } from "@/lib/notifications";
import { sendLinePush, LineResult } from "@/lib/line";
import {
  storeUploadedFile,
  validateUpload,
  deleteStoredFile,
} from "@/lib/uploads";
import {
  ensureUser,
  ensureCreateRequest,
  ensureEditTests,
  ensurePlanManage,
} from "@/lib/guard";
import { getCurrentUser } from "@/lib/auth";
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
  // หมายเหตุ: ผู้รับผิดชอบไม่บังคับแล้ว (Phase 3c) — งานที่ยังไม่มอบหมายจะเข้าคิวรอ admin วางแผน
  return errors;
}

/** ผู้ใช้เริ่มกรอกรายการทดสอบแรกหรือยัง (ใบรีเควสสร้างโดยไม่มี item ก็ได้) */
function hasItemInput(fd: FormData): boolean {
  return Boolean(
    str(fd, "part_name") ||
      str(fd, "test_detail") ||
      str(fd, "test_name") ||
      str(fd, "part_no"),
  );
}

function itemDataFromForm(fd: FormData) {
  return {
    partName: str(fd, "part_name")!,
    partNo: str(fd, "part_no"),
    testName: str(fd, "test_name"),
    qty: num(fd, "qty"),
    partReceivedDate: date(fd, "part_received_date"),
    partLocationId: num(fd, "part_location"),
    testDetail: str(fd, "test_detail")!,
    planStart: date(fd, "plan_start"),
    planEnd: date(fd, "plan_end"),
    actualStart: date(fd, "actual_start"),
    actualEnd: date(fd, "actual_end"),
    ownerId: num(fd, "owner"), // nullable — ยังไม่มอบหมายได้ (Phase 3c)
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
  const denied = await ensureCreateRequest();
  if (denied) return { ok: false, errors: [denied] };
  const user = (await getCurrentUser())!;

  // requester ถูกล็อกให้ลงงานของแผนกตัวเองเสมอ (บังคับฝั่ง server ไม่เชื่อค่าจากฟอร์ม)
  const isRequester = user.role === "REQUESTER";
  if (isRequester && !user.departmentId) {
    return { ok: false, errors: ["บัญชีของคุณยังไม่ผูกกับแผนก — แจ้งผู้ดูแลระบบให้ตั้งค่าก่อน"] };
  }
  const deptId = isRequester ? user.departmentId! : num(formData, "request_dept");

  // รายการทดสอบ (item) ไม่บังคับตอนสร้างใบ — เพิ่มทีหลังได้ทั้งผู้ขอและ admin
  const withItem = hasItemInput(formData);

  const errors: string[] = [];
  if (!deptId) errors.push("กรุณาเลือกแผนกที่รีเควส");
  if (!str(formData, "requester")) errors.push("กรุณากรอกชื่อผู้ขอทดสอบ");
  if (!str(formData, "test_object")) errors.push("กรุณากรอกสิ่งที่ส่งมาทดสอบ (test object)");
  if (!date(formData, "request_date")) errors.push("กรุณากรอกวันที่ได้ใบรีเควส");
  if (withItem) errors.push(...validateItemFields(formData));
  if (errors.length > 0) return { ok: false, errors };

  const requestDate = date(formData, "request_date")!;
  const itemData = itemDataFromForm(formData);
  const createNote = itemData.ownerId ? "สร้าง item" : "สร้าง item (รอวางแผน/มอบหมาย)";

  let createdRegisNo: string | null = null;
  for (let attempt = 0; attempt < 4 && !createdRegisNo; attempt++) {
    const { regisNo, seq } = await generateRegisNo(requestDate);
    try {
      await prisma.testRequest.create({
        data: {
          regisNo,
          seq,
          requestDeptId: deptId!,
          requester: str(formData, "requester")!,
          requesterEmail: str(formData, "requester_email"),
          requesterPhone: str(formData, "requester_phone"),
          testObject: str(formData, "test_object"),
          purpose: str(formData, "purpose"),
          requestDate,
          remark: str(formData, "request_remark"),
          createdById: user.id,
          ...(withItem
            ? {
                items: {
                  create: {
                    itemNo: 1,
                    itemCode: buildItemCode(regisNo, 1),
                    ...itemData,
                    statusLogs: {
                      create: { toStatus: "S1_RECEIVED", note: createNote, changedBy: user.displayName },
                    },
                  },
                },
              }
            : {}),
        },
      });
      createdRegisNo = regisNo;
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 3) throw e;
    }
  }

  // แจ้งเตือน admin: มีใบใหม่เข้ามา (ทั้งกรณีมี item รอวางแผน และกรณีที่ยังไม่มีรายการทดสอบ)
  if (createdRegisNo) {
    const created = await prisma.testRequest.findUnique({
      where: { regisNo: createdRegisNo },
      include: { requestDept: true, items: { orderBy: { itemNo: "asc" }, take: 1 } },
    });
    const firstItem = created?.items[0];
    const needsNotice = !withItem || !itemData.ownerId;
    if (created && needsNotice) {
      await notifyNewRequest({
        itemId: firstItem?.id ?? null,
        regisNo: created.regisNo,
        subject: firstItem?.partName ?? created.testObject ?? "—",
        deptName: created.requestDept.name,
        requester: created.requester,
        needsItems: !withItem,
      }).catch(() => {});
    }
  }

  revalidatePath("/requests");
  revalidatePath("/planning");
  revalidatePath("/");
  redirect(`/requests/${createdRegisNo}`);
}

// ── เพิ่ม item ในใบรีเควสเดิม ────────────────────────────────

export async function addItem(
  regisNo: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const denied = await ensureCreateRequest();
  if (denied) return { ok: false, errors: [denied] };
  const user = (await getCurrentUser())!;

  // requester เพิ่ม item ได้เฉพาะใบของแผนกตัวเอง
  if (user.role === "REQUESTER") {
    const req = await prisma.testRequest.findUnique({ where: { regisNo } });
    if (!req || req.requestDeptId !== user.departmentId) {
      return { ok: false, errors: ["เพิ่มรายการได้เฉพาะใบรีเควสของแผนกตัวเอง"] };
    }
  }

  const errors = validateItemFields(formData);
  if (errors.length > 0) return { ok: false, errors };
  const itemData = itemDataFromForm(formData);
  const createNote = itemData.ownerId ? "สร้าง item" : "สร้าง item (รอวางแผน/มอบหมาย)";

  for (let attempt = 0; attempt < 4; attempt++) {
    const itemNo = await nextItemNo(regisNo);
    try {
      await prisma.testItem.create({
        data: {
          regisNo,
          itemNo,
          itemCode: buildItemCode(regisNo, itemNo),
          ...itemData,
          statusLogs: {
            create: { toStatus: "S1_RECEIVED", note: createNote, changedBy: user.displayName },
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
  const denied = await ensureEditTests();
  if (denied) return { ok: false, errors: [denied] };
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

  const editor = await getCurrentUser();
  await prisma.testItem.update({ where: { itemCode }, data });
  if (locLogs.length > 0) {
    await prisma.locationLog.createMany({
      data: locLogs.map((l) => ({
        itemId: current.id,
        note: "แก้ผ่านฟอร์มข้อมูล item",
        changedBy: editor?.displayName ?? null,
        ...l,
      })),
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
  const denied = await ensureEditTests();
  if (denied) return { ok: false, errors: [denied] };
  const mover = await getCurrentUser();
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
        changedBy: mover?.displayName ?? null,
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
        changedBy: mover?.displayName ?? null,
      },
    });
  }

  revalidatePath(`/items/${itemCode}`);
  revalidatePath(`/requests/${current.regisNo}`);
  return { ok: true, errors: [], saved: true };
}

// ── เปลี่ยนสถานะ item ───────────────────────────────────────

export async function changeItemStatus(itemCode: string, target: RequestStatus) {
  const denied = await ensureEditTests();
  if (denied) return { ok: false as const, errors: [denied] };
  const item = await prisma.testItem.findUniqueOrThrow({
    where: { itemCode },
    include: { reports: { orderBy: { id: "desc" } } },
  });

  // งานที่ยังไม่มอบหมายผู้รับผิดชอบ ห้ามเดินหน้าเกินสถานะ 2 (ยกเว้น Hold/Cancel)
  const UNASSIGNED_OK: RequestStatus[] = ["S1_RECEIVED", "S2_WAIT_PART", "S9_HOLD", "S10_CANCEL"];
  if (!item.ownerId && !UNASSIGNED_OK.includes(target)) {
    return {
      ok: false as const,
      errors: ["item นี้ยังไม่มอบหมายผู้รับผิดชอบ — ให้ admin วางแผน (มอบหมาย + ลงวันที่) ก่อนเริ่มงาน"],
    };
  }

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
    const editor = await getCurrentUser();
    await prisma.statusLog.create({
      data: {
        itemId: item.id,
        fromStatus: item.status,
        toStatus: target,
        changedBy: editor?.displayName ?? null,
      },
    });
    await notifyStatusChange(item.id, item.itemCode, item.partName, target);
  }

  revalidatePath(`/items/${itemCode}`);
  revalidatePath(`/requests/${item.regisNo}`);
  revalidatePath("/requests");
  revalidatePath("/");
  return { ok: true as const, errors: [] as string[] };
}

// ── วางแผนงาน (Phase 3d — admin มอบหมายผู้รับผิดชอบ + ลงวันที่ plan) ──

export async function planItem(
  itemCode: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const denied = await ensurePlanManage();
  if (denied) return { ok: false, errors: [denied] };
  const planner = (await getCurrentUser())!;

  const ownerId = num(formData, "owner");
  const planStart = date(formData, "plan_start");
  const planEnd = date(formData, "plan_end");

  const errors: string[] = [];
  if (!ownerId) errors.push("กรุณาเลือกผู้รับผิดชอบ");
  if (planStart && planEnd && planStart.getTime() > planEnd.getTime()) {
    errors.push("Plan เริ่มต้องไม่เกิน Plan จบ");
  }
  if (errors.length > 0) return { ok: false, errors };

  const item = await prisma.testItem.findUniqueOrThrow({
    where: { itemCode },
    include: { owner: true },
  });
  const newOwner = await prisma.member.findUnique({ where: { id: ownerId! } });
  if (!newOwner) return { ok: false, errors: ["ไม่พบผู้รับผิดชอบที่เลือก"] };

  await prisma.testItem.update({
    where: { itemCode },
    data: {
      ownerId: ownerId!,
      ...(planStart ? { planStart } : {}),
      ...(planEnd ? { planEnd } : {}),
    },
  });

  // audit trail: ลง log ว่าวางแผนโดยใคร (สถานะเดิม ไม่เปลี่ยน)
  const planParts = [
    `มอบหมาย ${newOwner.name}`,
    planStart || planEnd
      ? `แผน ${planStart ? planStart.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) : "?"} – ${planEnd ? planEnd.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) : "?"}`
      : null,
  ].filter(Boolean);
  await prisma.statusLog.create({
    data: {
      itemId: item.id,
      fromStatus: item.status,
      toStatus: item.status,
      note: `วางแผน: ${planParts.join(" · ")}`,
      changedBy: planner.displayName,
    },
  });

  revalidatePath("/planning");
  revalidatePath(`/items/${itemCode}`);
  revalidatePath(`/requests/${item.regisNo}`);
  revalidatePath("/requests");
  revalidatePath("/");
  return { ok: true, errors: [], saved: true };
}

/** วางแผนหลายรายการพร้อมกัน (มอบหมายคนเดียวกัน + วันที่ชุดเดียวกัน) */
export async function planItemsBulk(
  itemCodes: string[],
  ownerId: number,
  planStartRaw: string | null,
  planEndRaw: string | null
): Promise<ActionResult & { count?: number }> {
  const denied = await ensurePlanManage();
  if (denied) return { ok: false, errors: [denied] };
  if (itemCodes.length === 0) return { ok: false, errors: ["ยังไม่ได้เลือกรายการ"] };

  const planner = (await getCurrentUser())!;
  const owner = await prisma.member.findUnique({ where: { id: ownerId } });
  if (!owner) return { ok: false, errors: ["ไม่พบผู้รับผิดชอบที่เลือก"] };

  const toDate = (v: string | null) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+07:00`) : null;
  const planStart = toDate(planStartRaw);
  const planEnd = toDate(planEndRaw);
  if (planStart && planEnd && planStart.getTime() > planEnd.getTime()) {
    return { ok: false, errors: ["Plan เริ่มต้องไม่เกิน Plan จบ"] };
  }

  const items = await prisma.testItem.findMany({ where: { itemCode: { in: itemCodes } } });
  await prisma.testItem.updateMany({
    where: { itemCode: { in: itemCodes } },
    data: {
      ownerId,
      ...(planStart ? { planStart } : {}),
      ...(planEnd ? { planEnd } : {}),
    },
  });

  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) : "?";
  const note = `วางแผน: มอบหมาย ${owner.name}${
    planStart || planEnd ? ` · แผน ${fmt(planStart)} – ${fmt(planEnd)}` : ""
  }`;
  await prisma.statusLog.createMany({
    data: items.map((it) => ({
      itemId: it.id,
      fromStatus: it.status,
      toStatus: it.status,
      note,
      changedBy: planner.displayName,
    })),
  });

  revalidatePath("/planning");
  revalidatePath("/requests");
  revalidatePath("/board");
  revalidatePath("/");
  return { ok: true, errors: [], saved: true, count: items.length };
}

// ── test runs ───────────────────────────────────────────────

export async function addTestRun(itemCode: string, formData: FormData) {
  const denied = await ensureEditTests();
  if (denied) throw new Error(denied);
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
  const denied = await ensureEditTests();
  if (denied) throw new Error(denied);
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
  const denied = await ensureEditTests();
  if (denied) return { ok: false, errors: [denied] };
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
  const denied = await ensureEditTests();
  if (denied) throw new Error(denied);
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
  const denied = await ensureUser();
  if (denied) throw new Error(denied);
  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const denied = await ensureUser();
  if (denied) throw new Error(denied);
  await prisma.notification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

// ── ทดสอบส่ง LINE OA (หน้า demo /settings/line) ─────────────

export type LineTestState = {
  ran: boolean;
  result: LineResult | null;
  errors: string[];
};

export async function sendLineTest(
  _prev: LineTestState,
  formData: FormData
): Promise<LineTestState> {
  const denied = await ensurePlanManage();
  if (denied) return { ran: false, result: null, errors: [denied] };
  const message = str(formData, "message") ?? "🔔 ทดสอบแจ้งเตือนจาก Dodoregis";
  const token = str(formData, "token") ?? undefined; // override ชั่วคราว (ไม่บันทึก)
  const to = str(formData, "to") ?? undefined;
  const result = await sendLinePush(message, { token, to });
  return { ran: true, result, errors: [] };
}

// ── master data (แผนก / ทีม / ที่เก็บ) ──────────────────────

type MasterKind = "department" | "member" | "partLocation" | "finishedLocation";

export async function addMaster(
  kind: MasterKind,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const denied = await ensurePlanManage();
  if (denied) return { ok: false, errors: [denied] };
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
  const denied = await ensurePlanManage();
  if (denied) throw new Error(denied);
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
  const denied = await ensurePlanManage();
  if (denied) throw new Error(denied);
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
  const denied = await ensurePlanManage();
  if (denied) throw new Error(denied);
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
