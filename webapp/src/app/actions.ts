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
  validateUploadBatch,
  deleteStoredFile,
} from "@/lib/uploads";
import {
  ensureUser,
  ensureCreateRequest,
  ensureEditTests,
  ensurePlanWork,
  ensureManageSystem,
} from "@/lib/guard";
import { getCurrentUser, toScope } from "@/lib/auth";
import { canAttachToRequest, canEditTests, canViewRequest, departmentFilter } from "@/lib/roles";
import {
  actionsFor,
  APPROVAL_LABEL,
  canEditRequestNow,
  initialApprovalStatus,
  nextStatusOnApprove,
  stageOf,
} from "@/lib/approval";
import { isDeptStageOn } from "@/lib/appSettings";
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

// ── ชิ้นงาน (RequestPart) ────────────────────────────────────

export type PartInput = { name: string; partNo?: string | null; qty?: number | null };
export type ItemInput = {
  testName?: string | null;
  testDetail: string;
  /** ตำแหน่งของชิ้นงานใน parts ที่ส่งมาด้วยกัน (ตอนสร้างใบใหม่) */
  partIdx?: number[];
  /** id ของชิ้นงานที่มีอยู่แล้ว (ตอนเพิ่ม item ในใบเดิม) */
  partIds?: number[];
  remark?: string | null;
  planStart?: string | null;
  planEnd?: string | null;
  ownerId?: number | null;
};

type PartLike = { name: string; partNo: string | null; qty: number | null };

/** สรุปชิ้นงานที่เลือก → เก็บลง item เป็น cache ให้ list/label/report ใช้ได้เร็ว */
function summarizeParts(parts: PartLike[]) {
  return {
    partName: parts.map((p) => p.name).join(" · ") || "—",
    partNo: parts.map((p) => p.partNo).filter(Boolean).join(" · ") || null,
    qty: parts.reduce((n, p) => n + (p.qty ?? 0), 0) || null,
  };
}

/** อ่าน JSON จากฟอร์ม (ฟิลด์ที่ซ่อนไว้) — คืน [] ถ้าพัง */
function jsonField<T>(fd: FormData, key: string): T[] {
  const raw = fd.get(key);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function toDateOrNull(v: string | null | undefined): Date | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+07:00`) : null;
}

/** id ชิ้นงานที่ติ๊กเลือกไว้ในฟอร์ม (checkbox ชื่อ part_ids) */
function partIdsFromForm(fd: FormData): number[] {
  return fd
    .getAll("part_ids")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** ฟิลด์ของ item ที่ไม่เกี่ยวกับชิ้นงาน (ชิ้นงานมาจากตาราง RequestPart แล้ว) */
function itemDataFromForm(fd: FormData) {
  return {
    testName: str(fd, "test_name"),
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

// ── ไฟล์แนบที่ส่งมาพร้อมฟอร์ม ───────────────────────────────

type PendingAttachment = { file: File; kind: AttachmentKind };

/**
 * อ่านไฟล์แนบที่ส่งมาพร้อมฟอร์ม — ฟิลด์ `files` กับ `file_kinds` เรียงคู่กันตามลำดับ
 * (จับคู่ก่อนกรองไฟล์ว่าง เพื่อไม่ให้ index เลื่อน)
 */
function attachmentsFromForm(fd: FormData): PendingAttachment[] {
  const kinds = fd.getAll("file_kinds").map(String);
  return fd
    .getAll("files")
    .map((f, i) => ({ f, kindRaw: kinds[i] }))
    .filter(({ f }) => f instanceof File && f.size > 0)
    .map(({ f, kindRaw }) => ({
      file: f as File,
      kind: (KIND_VALUES.includes(kindRaw) ? kindRaw : "OTHER") as AttachmentKind,
    }));
}

async function saveAttachments(
  list: PendingAttachment[],
  scope: { requestNo?: string; itemId?: number }
) {
  for (const { file, kind } of list) {
    const stored = await storeUploadedFile(file);
    await prisma.attachment.create({
      data: { requestNo: scope.requestNo, itemId: scope.itemId, kind, ...stored },
    });
  }
}

// ── สร้างใบรีเควสใหม่ (หลายชิ้นงาน + หลายรายการทดสอบ) ───────

export async function createRequest(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const denied = await ensureCreateRequest();
  if (denied) return { ok: false, errors: [denied] };
  const user = (await getCurrentUser())!;

  // requester ถูกล็อกให้ลงงานของแผนกตัวเองเสมอ, dept_head เลือกได้แต่ต้องเป็นแผนกที่ตัวเองคุม
  // (บังคับฝั่ง server ทั้งคู่ ไม่เชื่อค่าจากฟอร์ม)
  const isRequester = user.role === "REQUESTER";
  const isDeptHead = user.role === "DEPT_HEAD";
  if (isRequester && !user.departmentId) {
    return { ok: false, errors: ["บัญชีของคุณยังไม่ผูกกับแผนก — แจ้งผู้ดูแลระบบให้ตั้งค่าก่อน"] };
  }
  const headedDeptIds = user.headOfDepartments.map((d) => d.id);
  if (isDeptHead && headedDeptIds.length === 0) {
    return { ok: false, errors: ["บัญชีของคุณยังไม่ได้กำหนดให้คุมแผนกใด — แจ้งผู้ดูแลระบบให้ตั้งค่าก่อน"] };
  }
  let deptId: number | null;
  if (isRequester) {
    deptId = user.departmentId!;
  } else if (isDeptHead) {
    const requestedDeptId = num(formData, "request_dept");
    deptId = requestedDeptId && headedDeptIds.includes(requestedDeptId) ? requestedDeptId : null;
  } else {
    deptId = num(formData, "request_dept");
  }
  // ผู้ที่วางแผน/มอบหมายงานได้เท่านั้น ถึงจะลง owner+วันที่ตั้งแต่ตอนสร้างใบ
  const canPlan = canEditTests(user.role);

  const parts = jsonField<PartInput>(formData, "parts_json")
    .map((p) => ({
      name: (p.name ?? "").trim(),
      partNo: p.partNo?.trim() || null,
      qty: Number.isFinite(Number(p.qty)) && Number(p.qty) > 0 ? Number(p.qty) : null,
    }))
    .filter((p) => p.name);

  const itemInputs = jsonField<ItemInput>(formData, "items_json")
    .map((i) => ({
      testName: i.testName?.trim() || null,
      testDetail: (i.testDetail ?? "").trim(),
      partIdx: Array.isArray(i.partIdx) ? i.partIdx.filter((n) => Number.isInteger(n)) : [],
      remark: i.remark?.trim() || null,
      planStart: canPlan ? toDateOrNull(i.planStart) : null,
      planEnd: canPlan ? toDateOrNull(i.planEnd) : null,
      ownerId: canPlan && Number.isInteger(Number(i.ownerId)) && Number(i.ownerId) > 0 ? Number(i.ownerId) : null,
    }))
    .filter((i) => i.testDetail || i.testName || i.partIdx.length > 0);

  // ตรวจไฟล์แนบก่อนสร้างใบ — ถ้าไฟล์ไม่ผ่านจะได้ไม่เกิดใบค้างโดยไม่มีไฟล์
  const pendingFiles = attachmentsFromForm(formData);

  const errors: string[] = [];
  if (!deptId) errors.push("กรุณาเลือกแผนกที่รีเควส");
  if (!str(formData, "requester")) errors.push("กรุณากรอกชื่อผู้ขอทดสอบ");
  if (!str(formData, "test_object")) errors.push("กรุณากรอกสิ่งที่ส่งมาทดสอบ (test object)");
  if (!date(formData, "request_date")) errors.push("กรุณากรอกวันที่ได้ใบรีเควส");
  if (parts.length === 0) errors.push("กรุณาเพิ่มชิ้นงาน/รุ่น Lamp อย่างน้อย 1 รายการ");
  itemInputs.forEach((i, n) => {
    if (!i.testDetail) errors.push(`รายการทดสอบที่ ${n + 1}: กรุณากรอกรายละเอียดเทส/มาตรฐานอ้างอิง`);
    if (i.partIdx.length === 0) errors.push(`รายการทดสอบที่ ${n + 1}: กรุณาเลือกชิ้นงานที่จะทดสอบ`);
  });
  errors.push(...validateUploadBatch(pendingFiles.map((p) => p.file)));
  if (errors.length > 0) return { ok: false, errors };

  const requestDate = date(formData, "request_date")!;

  // สถานะอนุมัติเริ่มต้น (Phase 4c) — ADMIN/LAB_HEAD/ENGINEER คีย์เองอนุมัติอัตโนมัติ
  // REQUESTER รอหัวหน้าแผนกก่อน เว้นแต่ปิดชั้นนี้ไว้หรือแผนกยังไม่มีหัวหน้า (กันใบค้างไม่มีคนเซ็น)
  const deptHasHead =
    (await prisma.department.count({ where: { id: deptId!, heads: { some: {} } } })) > 0;
  const deptStageOn = await isDeptStageOn();
  const approvalStatus = initialApprovalStatus({
    creatorRole: user.role,
    deptStageOn,
    deptHasHead,
  });
  const submittedAt = approvalStatus === "APPROVED" ? null : new Date();

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
          approvalStatus,
          submittedAt,
          parts: {
            create: parts.map((p, idx) => ({ ...p, sortOrder: idx })),
          },
        },
      });
      createdRegisNo = regisNo;
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 3) throw e;
    }
  }
  if (!createdRegisNo) return { ok: false, errors: ["ออกเลขใบรีเควสไม่สำเร็จ ลองใหม่อีกครั้ง"] };

  await prisma.approvalLog.create({
    data: {
      regisNo: createdRegisNo,
      // AUTO_APPROVE ข้ามทั้ง 2 ชั้น — ลงเป็นชั้น LAB ไว้เป็นค่าปิดท้าย (ไม่มีชั้นจริงให้ลง)
      stage: stageOf(approvalStatus) ?? "LAB",
      action: approvalStatus === "APPROVED" ? "AUTO_APPROVE" : "SUBMIT",
      byId: user.id,
    },
  });

  // สร้างรายการทดสอบ พร้อมผูกชิ้นงานที่เลือก
  const createdParts = await prisma.requestPart.findMany({
    where: { regisNo: createdRegisNo },
    orderBy: { sortOrder: "asc" },
  });
  for (const [n, input] of itemInputs.entries()) {
    const chosen = input.partIdx
      .map((idx) => createdParts[idx])
      .filter((p): p is (typeof createdParts)[number] => Boolean(p));
    if (chosen.length === 0) continue;

    await prisma.testItem.create({
      data: {
        regisNo: createdRegisNo,
        itemNo: n + 1,
        itemCode: buildItemCode(createdRegisNo, n + 1),
        testName: input.testName,
        testDetail: input.testDetail,
        remark: input.remark,
        planStart: input.planStart,
        planEnd: input.planEnd,
        ownerId: input.ownerId,
        ...summarizeParts(chosen),
        parts: { connect: chosen.map((p) => ({ id: p.id })) },
        statusLogs: {
          create: {
            toStatus: "S1_RECEIVED",
            note: input.ownerId ? "สร้างรายการทดสอบ" : "สร้างรายการทดสอบ (รอวางแผน/มอบหมาย)",
            changedBy: user.displayName,
          },
        },
      },
    });
  }

  // ไฟล์แนบที่แนบมาพร้อมใบ (ใบรีเควสตัวจริง / อีเมลต้นเรื่อง / รูปชิ้นงาน)
  await saveAttachments(pendingFiles, { requestNo: createdRegisNo });

  // แจ้งเตือน admin: มีใบใหม่เข้ามา (ทั้งกรณีมีรายการรอวางแผน และกรณีที่ยังไม่มีรายการทดสอบ)
  {
    const created = await prisma.testRequest.findUnique({
      where: { regisNo: createdRegisNo },
      include: { requestDept: true, items: { orderBy: { itemNo: "asc" } } },
    });
    const firstItem = created?.items[0];
    const anyUnassigned = created?.items.some((i) => !i.ownerId) ?? false;
    if (created && (created.items.length === 0 || anyUnassigned)) {
      await notifyNewRequest({
        itemId: firstItem?.id ?? null,
        regisNo: created.regisNo,
        subject: created.testObject ?? firstItem?.partName ?? "—",
        deptName: created.requestDept.name,
        requester: created.requester,
        needsItems: created.items.length === 0,
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

  const editDenied = await assertCanEditRequestData(user, regisNo);
  if (editDenied) return { ok: false, errors: [editDenied] };

  const partIds = partIdsFromForm(formData);
  const errors: string[] = [];
  if (!str(formData, "test_detail")) errors.push("กรุณากรอกรายละเอียดเทส/มาตรฐานอ้างอิง");
  if (partIds.length === 0) errors.push("กรุณาเลือกชิ้นงานที่จะทดสอบอย่างน้อย 1 รายการ");
  if (errors.length > 0) return { ok: false, errors };

  // ชิ้นงานต้องเป็นของใบนี้เท่านั้น
  const chosen = await prisma.requestPart.findMany({ where: { id: { in: partIds }, regisNo } });
  if (chosen.length === 0) return { ok: false, errors: ["ไม่พบชิ้นงานที่เลือกในใบรีเควสนี้"] };

  const itemData = itemDataFromForm(formData);
  const createNote = itemData.ownerId ? "สร้างรายการทดสอบ" : "สร้างรายการทดสอบ (รอวางแผน/มอบหมาย)";

  for (let attempt = 0; attempt < 4; attempt++) {
    const itemNo = await nextItemNo(regisNo);
    try {
      await prisma.testItem.create({
        data: {
          regisNo,
          itemNo,
          itemCode: buildItemCode(regisNo, itemNo),
          ...itemData,
          ...summarizeParts(chosen),
          parts: { connect: chosen.map((p) => ({ id: p.id })) },
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

// ── ชิ้นงาน/รุ่น Lamp ในใบรีเควส ─────────────────────────────

type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * เช็คว่าแก้ "เนื้อใบ" (เพิ่ม/ลบรายการทดสอบ, แก้รุ่น Lamp) ได้ไหมตอนนี้ — ใช้ทั้ง assertCanEditRequest และ addItem
 * ทีมแลปแก้ได้เสมอ · ผู้ขอ/หัวหน้าแผนกแก้ได้เฉพาะก่อนหัวหน้าแผนกเซ็น (ปิดช่องโหว่ F1 — ดู canEditRequestNow)
 */
async function assertCanEditRequestData(
  user: SessionUser,
  regisNo: string,
): Promise<string | null> {
  if (canEditTests(user.role)) return null;
  const req = await prisma.testRequest.findUnique({ where: { regisNo } });
  if (!req) return "ไม่พบใบรีเควสนี้";
  if (!canEditRequestNow(toScope(user), req.requestDeptId, req.approvalStatus)) {
    if (!canViewRequest(toScope(user), req.requestDeptId)) {
      return "แก้ไขได้เฉพาะใบรีเควสในขอบเขตแผนกตัวเอง";
    }
    return `แก้ไขไม่ได้แล้ว — ใบนี้อยู่ในสถานะ "${APPROVAL_LABEL[req.approvalStatus]}"`;
  }
  return null;
}

/** ผู้ขอ/หัวหน้าแผนกแก้ได้เฉพาะใบในขอบเขตแผนกตัวเอง และก่อนหัวหน้าแผนกเซ็น */
async function assertCanEditRequest(regisNo: string): Promise<string | null> {
  const denied = await ensureCreateRequest();
  if (denied) return denied;
  const user = (await getCurrentUser())!;
  return assertCanEditRequestData(user, regisNo);
}

/**
 * เช็คสิทธิ์แนบไฟล์ — เช็คแค่ขอบเขตแผนก ไม่เช็คสถานะอนุมัติ (แนบได้ทุกสถานะ
 * หัวหน้าอาจขอเอกสารเพิ่มก่อนเซ็น — ข้อ 3.3.2 ในแผน) ลบยังคุมด้วย ensureEditTests แยกต่างหาก
 */
async function assertCanAttach(regisNo: string): Promise<string | null> {
  const denied = await ensureCreateRequest();
  if (denied) return denied;
  const user = (await getCurrentUser())!;
  const req = await prisma.testRequest.findUnique({ where: { regisNo } });
  if (!req || !canAttachToRequest(toScope(user), req.requestDeptId)) {
    return "แนบไฟล์ได้เฉพาะใบรีเควสในขอบเขตแผนกตัวเอง";
  }
  return null;
}

export async function addRequestPart(
  regisNo: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const denied = await assertCanEditRequest(regisNo);
  if (denied) return { ok: false, errors: [denied] };

  const name = str(formData, "name");
  if (!name) return { ok: false, errors: ["กรุณากรอกชื่อชิ้นงาน / รุ่น Lamp"] };

  const count = await prisma.requestPart.count({ where: { regisNo } });
  await prisma.requestPart.create({
    data: {
      regisNo,
      name,
      partNo: str(formData, "part_no"),
      qty: num(formData, "qty"),
      sortOrder: count,
    },
  });

  revalidatePath(`/requests/${regisNo}`);
  return { ok: true, errors: [], saved: true };
}

export async function deleteRequestPart(partId: number): Promise<ActionResult> {
  const part = await prisma.requestPart.findUnique({
    where: { id: partId },
    include: { items: { select: { itemCode: true } } },
  });
  if (!part) return { ok: false, errors: ["ไม่พบชิ้นงานนี้"] };

  const denied = await assertCanEditRequest(part.regisNo);
  if (denied) return { ok: false, errors: [denied] };

  if (part.items.length > 0) {
    return {
      ok: false,
      errors: [
        `ลบไม่ได้ — มีรายการทดสอบใช้ชิ้นงานนี้อยู่ (${part.items.map((i) => i.itemCode).join(", ")})`,
      ],
    };
  }

  await prisma.requestPart.delete({ where: { id: partId } });
  revalidatePath(`/requests/${part.regisNo}`);
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

  const current = await prisma.testItem.findUniqueOrThrow({
    where: { itemCode },
    include: { reports: true, partLocation: true, finishedPartLocation: true, parts: true },
  });

  const partIds = partIdsFromForm(formData);
  const errors: string[] = [];
  if (!str(formData, "test_detail")) errors.push("กรุณากรอกรายละเอียดเทส/มาตรฐานอ้างอิง");
  if (partIds.length === 0) errors.push("กรุณาเลือกชิ้นงานที่จะทดสอบอย่างน้อย 1 รายการ");
  if (errors.length > 0) return { ok: false, errors };

  // ชิ้นงานต้องเป็นของใบเดียวกับ item นี้
  const chosen = await prisma.requestPart.findMany({
    where: { id: { in: partIds }, regisNo: current.regisNo },
  });
  if (chosen.length === 0) return { ok: false, errors: ["ไม่พบชิ้นงานที่เลือกในใบรีเควสนี้"] };

  const data = { ...itemDataFromForm(formData), ...summarizeParts(chosen) };

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
  await prisma.testItem.update({
    where: { itemCode },
    data: { ...data, parts: { set: chosen.map((p) => ({ id: p.id })) } },
  });
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
    include: {
      reports: { orderBy: { id: "desc" } },
      request: { select: { approvalStatus: true } },
    },
  });

  // ใบที่ยังไม่ผ่านการอนุมัติ ห้ามเดินหน้าเกินสถานะ 1 (ยกเว้น Hold/Cancel) — ปิดช่องโหว่ F1
  const NOT_APPROVED_OK: RequestStatus[] = ["S1_RECEIVED", "S9_HOLD", "S10_CANCEL"];
  if (item.request.approvalStatus !== "APPROVED" && !NOT_APPROVED_OK.includes(target)) {
    return {
      ok: false as const,
      errors: [
        `ใบรีเควสนี้ยังไม่ผ่านการอนุมัติ (สถานะ: ${APPROVAL_LABEL[item.request.approvalStatus]}) — ต้องอนุมัติก่อนจึงจะเริ่มงานได้`,
      ],
    };
  }

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

// ── อนุมัติ/ตีกลับ/ส่งใหม่ ใบรีเควส (Phase 4c) ────────────────
// ทุก action: เช็คสิทธิ์ฝั่ง server → เช็คว่าสถานะปัจจุบันทำได้จริง → อัปเดต → เขียน ApprovalLog → revalidate

function approvalRevalidate(regisNo: string) {
  revalidatePath(`/requests/${regisNo}`);
  revalidatePath("/approvals");
  revalidatePath("/planning");
  revalidatePath("/requests");
  revalidatePath("/");
}

export async function approveRequest(regisNo: string): Promise<ActionResult> {
  const denied = await ensureUser();
  if (denied) return { ok: false, errors: [denied] };
  const user = (await getCurrentUser())!;
  const scope = toScope(user);

  const req = await prisma.testRequest.findUnique({ where: { regisNo } });
  if (!req) return { ok: false, errors: ["ไม่พบใบรีเควสนี้"] };

  const stage = stageOf(req.approvalStatus);
  if (!stage) return { ok: false, errors: [`ใบนี้ไม่ได้อยู่ระหว่างรออนุมัติ (สถานะ: ${APPROVAL_LABEL[req.approvalStatus]})`] };

  const { canApprove } = actionsFor(req.approvalStatus, scope, req.requestDeptId);
  if (!canApprove) return { ok: false, errors: ["ไม่มีสิทธิ์อนุมัติใบนี้"] };

  // admin เซ็นแทนหัวหน้าที่ควรเป็นคนเซ็นจริง ๆ เสมอ (บัญชี admin ไม่ใช่หัวหน้าแผนก/หัวหน้าแลปโดยตำแหน่ง) — บันทึกเป็น OVERRIDE
  const action = user.role === "ADMIN" ? "OVERRIDE" : "APPROVE";
  const nextStatus = nextStatusOnApprove(req.approvalStatus);

  await prisma.testRequest.update({
    where: { regisNo },
    data: {
      approvalStatus: nextStatus,
      ...(stage === "DEPT" ? { deptApprovedById: user.id, deptApprovedAt: new Date() } : {}),
      ...(stage === "LAB" ? { labApprovedById: user.id, labApprovedAt: new Date() } : {}),
    },
  });
  await prisma.approvalLog.create({ data: { regisNo, stage, action, byId: user.id } });

  approvalRevalidate(regisNo);
  return { ok: true, errors: [], saved: true };
}

export async function rejectRequest(
  regisNo: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await ensureUser();
  if (denied) return { ok: false, errors: [denied] };
  const user = (await getCurrentUser())!;
  const scope = toScope(user);

  const reason = str(formData, "reason");
  if (!reason) return { ok: false, errors: ["กรุณากรอกเหตุผลที่ตีกลับ"] };

  const req = await prisma.testRequest.findUnique({ where: { regisNo } });
  if (!req) return { ok: false, errors: ["ไม่พบใบรีเควสนี้"] };

  const stage = stageOf(req.approvalStatus);
  if (!stage) return { ok: false, errors: [`ใบนี้ไม่ได้อยู่ระหว่างรออนุมัติ (สถานะ: ${APPROVAL_LABEL[req.approvalStatus]})`] };

  const { canReject } = actionsFor(req.approvalStatus, scope, req.requestDeptId);
  if (!canReject) return { ok: false, errors: ["ไม่มีสิทธิ์ตีกลับใบนี้"] };

  const action = user.role === "ADMIN" ? "OVERRIDE" : "REJECT";

  await prisma.testRequest.update({
    where: { regisNo },
    data: {
      approvalStatus: "REJECTED",
      rejectedStage: stage,
      rejectedById: user.id,
      rejectedAt: new Date(),
      rejectReason: reason,
    },
  });
  await prisma.approvalLog.create({ data: { regisNo, stage, action, byId: user.id, reason } });

  approvalRevalidate(regisNo);
  return { ok: true, errors: [], saved: true };
}

/** ผู้ขอ/หัวหน้าแผนกของแผนกนั้น (หรือ admin) ส่งใบที่ถูกตีกลับใหม่ — เริ่มอนุมัติใหม่ทั้ง 2 ชั้นเสมอ */
export async function resubmitRequest(regisNo: string): Promise<ActionResult> {
  const denied = await ensureUser();
  if (denied) return { ok: false, errors: [denied] };
  const user = (await getCurrentUser())!;
  const scope = toScope(user);

  const req = await prisma.testRequest.findUnique({ where: { regisNo } });
  if (!req) return { ok: false, errors: ["ไม่พบใบรีเควสนี้"] };
  if (req.approvalStatus !== "REJECTED") {
    return { ok: false, errors: ["ส่งใหม่ได้เฉพาะใบที่ถูกตีกลับ"] };
  }

  const { canResubmit } = actionsFor(req.approvalStatus, scope, req.requestDeptId);
  if (!canResubmit) return { ok: false, errors: ["ไม่มีสิทธิ์ส่งใบนี้ใหม่"] };

  const deptHasHead =
    (await prisma.department.count({ where: { id: req.requestDeptId, heads: { some: {} } } })) > 0;
  const deptStageOn = await isDeptStageOn();
  const newStatus = deptStageOn && deptHasHead ? "PENDING_DEPT" : "PENDING_LAB";

  await prisma.testRequest.update({
    where: { regisNo },
    data: {
      approvalStatus: newStatus,
      submittedAt: new Date(),
      resubmitCount: { increment: 1 },
      rejectedStage: null,
      rejectedById: null,
      rejectedAt: null,
      rejectReason: null,
      deptApprovedById: null,
      deptApprovedAt: null,
      labApprovedById: null,
      labApprovedAt: null,
    },
  });
  await prisma.approvalLog.create({
    data: { regisNo, stage: stageOf(newStatus)!, action: "SUBMIT", byId: user.id },
  });

  approvalRevalidate(regisNo);
  return { ok: true, errors: [], saved: true };
}

// ── วางแผนงาน (Phase 3d — admin มอบหมายผู้รับผิดชอบ + ลงวันที่ plan) ──

export async function planItem(
  itemCode: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const denied = await ensurePlanWork();
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
  const denied = await ensurePlanWork();
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
  // ผู้ขอทดสอบแนบไฟล์เองได้ (เขาเป็นคนถืออีเมล/ใบรีเควส/รูปชิ้นงาน) แนบได้ทุกสถานะอนุมัติ
  // แต่เฉพาะใบของแผนกตัวเอง — assertCanAttach บังคับให้ · viewer ถูกปัดตกตั้งแต่ ensureCreateRequest
  const regisNo =
    scope.requestNo ??
    (
      await prisma.testItem.findUnique({
        where: { id: scope.itemId! },
        select: { regisNo: true },
      })
    )?.regisNo;
  if (!regisNo) return { ok: false, errors: ["ไม่พบใบรีเควสของไฟล์แนบนี้"] };
  const denied = await assertCanAttach(regisNo);
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
  const user = (await getCurrentUser())!;
  const deptFilter = departmentFilter(toScope(user));
  // ปิด F4: ผู้ขอ/หัวหน้าแผนกเดา id แจ้งเตือนของแผนกอื่นแล้วกดอ่านไม่ได้
  const notif = await prisma.notification.findUnique({
    where: { id },
    include: { item: { select: { request: { select: { requestDeptId: true } } } } },
  });
  if (!notif) return;
  if (deptFilter && (!notif.item || !deptFilter.in.includes(notif.item.request.requestDeptId))) {
    throw new Error("ไม่มีสิทธิ์เข้าถึงแจ้งเตือนนี้");
  }
  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const denied = await ensureUser();
  if (denied) throw new Error(denied);
  const user = (await getCurrentUser())!;
  const deptFilter = departmentFilter(toScope(user));
  await prisma.notification.updateMany({
    where: {
      readAt: null,
      ...(deptFilter ? { item: { request: { requestDeptId: deptFilter } } } : {}),
    },
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
  const denied = await ensureManageSystem();
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
  const denied = await ensureManageSystem();
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
  const denied = await ensureManageSystem();
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
  const denied = await ensureManageSystem();
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
  const denied = await ensureManageSystem();
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
