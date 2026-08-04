-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_request_parts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "regis_no" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "part_name" TEXT,
    "part_no" TEXT,
    "qty" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "request_parts_regis_no_fkey" FOREIGN KEY ("regis_no") REFERENCES "test_requests" ("regis_no") ON DELETE CASCADE ON UPDATE CASCADE
);
-- ย้าย name (คอลัมน์เดิม) -> model (แทนที่จะทิ้งข้อมูล ตาม diff อัตโนมัติของ Prisma) · part_name เป็นคอลัมน์ใหม่ ยังไม่มีข้อมูลต้นทาง เว้นว่างไว้ก่อน แล้ว backfill ด้วยมือด้านล่าง (มีแค่ 2 แถวจริงตอนนี้)
INSERT INTO "new_request_parts" ("created_at", "id", "model", "part_no", "qty", "regis_no", "sort_order") SELECT "created_at", "id", "name", "part_no", "qty", "regis_no", "sort_order" FROM "request_parts";
DROP TABLE "request_parts";
ALTER TABLE "new_request_parts" RENAME TO "request_parts";
CREATE INDEX "request_parts_regis_no_idx" ON "request_parts"("regis_no");
CREATE TABLE "new_test_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "regis_no" TEXT NOT NULL,
    "item_no" INTEGER NOT NULL,
    "item_code" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "part_name" TEXT,
    "part_no" TEXT,
    "qty" INTEGER,
    "test_name" TEXT,
    "part_received_date" DATETIME,
    "part_location_id" INTEGER,
    "test_detail" TEXT NOT NULL,
    "plan_start" DATETIME,
    "plan_end" DATETIME,
    "actual_start" DATETIME,
    "actual_end" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'S1_RECEIVED',
    "status_before_hold" TEXT,
    "owner_id" INTEGER,
    "finished_part_location_id" INTEGER,
    "raw_data_location" TEXT,
    "remark" TEXT,
    "test_method_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "test_items_regis_no_fkey" FOREIGN KEY ("regis_no") REFERENCES "test_requests" ("regis_no") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "test_items_part_location_id_fkey" FOREIGN KEY ("part_location_id") REFERENCES "PartLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_items_finished_part_location_id_fkey" FOREIGN KEY ("finished_part_location_id") REFERENCES "FinishedLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_items_test_method_id_fkey" FOREIGN KEY ("test_method_id") REFERENCES "test_methods" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- ย้าย part_name เดิม (ค่ารวม "P703 LED HL HG") -> model ใหม่ (คงความหมายเดิมไว้) · part_name ใหม่ (ความหมายใหม่ = แค่ชื่อชิ้นงาน) เว้นว่างไว้ก่อน backfill ด้วยมือด้านล่าง
INSERT INTO "new_test_items" ("actual_end", "actual_start", "created_at", "finished_part_location_id", "id", "item_code", "item_no", "model", "owner_id", "part_location_id", "part_no", "part_received_date", "plan_end", "plan_start", "qty", "raw_data_location", "regis_no", "remark", "status", "status_before_hold", "test_detail", "test_method_id", "test_name", "updated_at") SELECT "actual_end", "actual_start", "created_at", "finished_part_location_id", "id", "item_code", "item_no", "part_name", "owner_id", "part_location_id", "part_no", "part_received_date", "plan_end", "plan_start", "qty", "raw_data_location", "regis_no", "remark", "status", "status_before_hold", "test_detail", "test_method_id", "test_name", "updated_at" FROM "test_items";
DROP TABLE "test_items";
ALTER TABLE "new_test_items" RENAME TO "test_items";
CREATE UNIQUE INDEX "test_items_item_code_key" ON "test_items"("item_code");
CREATE UNIQUE INDEX "test_items_regis_no_item_no_key" ON "test_items"("regis_no", "item_no");
CREATE TABLE "new_test_requests" (
    "regis_no" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "request_dept_id" INTEGER NOT NULL,
    "requester" TEXT NOT NULL,
    "requester_email" TEXT,
    "requester_phone" TEXT,
    "request_date" DATETIME NOT NULL,
    "test_object" TEXT,
    "purpose" TEXT,
    "remark" TEXT,
    "folder_url" TEXT,
    "desired_date" DATETIME,
    "report_required" BOOLEAN NOT NULL DEFAULT true,
    "public_token" TEXT,
    "created_by_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "approval_status" TEXT NOT NULL DEFAULT 'APPROVED',
    "submitted_at" DATETIME,
    "resubmit_count" INTEGER NOT NULL DEFAULT 0,
    "dept_approved_by_id" INTEGER,
    "dept_approved_at" DATETIME,
    "lab_approved_by_id" INTEGER,
    "lab_approved_at" DATETIME,
    "rejected_stage" TEXT,
    "rejected_by_id" INTEGER,
    "rejected_at" DATETIME,
    "reject_reason" TEXT,
    CONSTRAINT "test_requests_request_dept_id_fkey" FOREIGN KEY ("request_dept_id") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_requests_dept_approved_by_id_fkey" FOREIGN KEY ("dept_approved_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_requests_lab_approved_by_id_fkey" FOREIGN KEY ("lab_approved_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_requests_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_test_requests" ("approval_status", "created_at", "created_by_id", "dept_approved_at", "dept_approved_by_id", "folder_url", "lab_approved_at", "lab_approved_by_id", "public_token", "purpose", "regis_no", "reject_reason", "rejected_at", "rejected_by_id", "rejected_stage", "remark", "request_date", "request_dept_id", "requester", "requester_email", "requester_phone", "resubmit_count", "seq", "submitted_at", "test_object", "updated_at") SELECT "approval_status", "created_at", "created_by_id", "dept_approved_at", "dept_approved_by_id", "folder_url", "lab_approved_at", "lab_approved_by_id", "public_token", "purpose", "regis_no", "reject_reason", "rejected_at", "rejected_by_id", "rejected_stage", "remark", "request_date", "request_dept_id", "requester", "requester_email", "requester_phone", "resubmit_count", "seq", "submitted_at", "test_object", "updated_at" FROM "test_requests";
DROP TABLE "test_requests";
ALTER TABLE "new_test_requests" RENAME TO "test_requests";
CREATE UNIQUE INDEX "test_requests_public_token_key" ON "test_requests"("public_token");
CREATE INDEX "test_requests_approval_status_idx" ON "test_requests"("approval_status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill: ข้อมูลจริงตอนนี้มีแค่ 2 request_parts (แก้มือได้ปลอดภัย) — model ตอนนี้ยังเป็นค่ารวมเดิม ต้องแยกเองเป็น model จริง + part_name
-- no-op ถ้ารันบน DB อื่นที่ค่า model ไม่ตรง (เช่น Railway trial ที่ไม่มีแถวพวกนี้)
UPDATE "request_parts" SET "model" = 'P703', "part_name" = 'LED HL HG' WHERE "id" = 1 AND "model" = 'P703 LED HL HG';
UPDATE "request_parts" SET "model" = '582D', "part_name" = 'LED HL' WHERE "id" = 2 AND "model" = '582D LED HL';
UPDATE "test_items" SET "model" = 'P703', "part_name" = 'LED HL HG' WHERE "item_code" IN ('TR-2607-001-01', 'TR-2607-001-02') AND "model" = 'P703 LED HL HG';
UPDATE "test_items" SET "model" = '582D', "part_name" = 'LED HL' WHERE "item_code" IN ('TR-2608-001-01', 'TR-2608-001-02') AND "model" = '582D LED HL';
