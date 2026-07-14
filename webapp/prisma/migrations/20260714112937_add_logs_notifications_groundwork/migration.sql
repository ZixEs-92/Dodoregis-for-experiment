-- AlterTable
ALTER TABLE "Department" ADD COLUMN "sla_days" INTEGER;

-- AlterTable
ALTER TABLE "test_requests" ADD COLUMN "public_token" TEXT;

-- CreateTable
CREATE TABLE "status_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "item_id" INTEGER NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "changed_by" TEXT,
    "note" TEXT,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "status_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "test_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "location_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "item_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "from_name" TEXT,
    "to_name" TEXT,
    "changed_by" TEXT,
    "note" TEXT,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "location_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "test_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "item_id" INTEGER,
    "dedupe_key" TEXT NOT NULL,
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "test_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT,
    "location" TEXT,
    "calibration_due" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "test_methods" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "standard" TEXT,
    "default_detail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_test_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "regis_no" TEXT NOT NULL,
    "item_no" INTEGER NOT NULL,
    "item_code" TEXT NOT NULL,
    "part_name" TEXT NOT NULL,
    "part_no" TEXT,
    "qty" INTEGER,
    "part_received_date" DATETIME,
    "part_location_id" INTEGER,
    "test_detail" TEXT NOT NULL,
    "plan_start" DATETIME,
    "plan_end" DATETIME,
    "actual_start" DATETIME,
    "actual_end" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'S1_RECEIVED',
    "status_before_hold" TEXT,
    "owner_id" INTEGER NOT NULL,
    "finished_part_location_id" INTEGER,
    "raw_data_location" TEXT,
    "remark" TEXT,
    "test_method_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "test_items_regis_no_fkey" FOREIGN KEY ("regis_no") REFERENCES "test_requests" ("regis_no") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "test_items_part_location_id_fkey" FOREIGN KEY ("part_location_id") REFERENCES "PartLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_items_finished_part_location_id_fkey" FOREIGN KEY ("finished_part_location_id") REFERENCES "FinishedLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_items_test_method_id_fkey" FOREIGN KEY ("test_method_id") REFERENCES "test_methods" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_test_items" ("actual_end", "actual_start", "created_at", "finished_part_location_id", "id", "item_code", "item_no", "owner_id", "part_location_id", "part_name", "part_no", "part_received_date", "plan_end", "plan_start", "qty", "raw_data_location", "regis_no", "remark", "status", "status_before_hold", "test_detail", "updated_at") SELECT "actual_end", "actual_start", "created_at", "finished_part_location_id", "id", "item_code", "item_no", "owner_id", "part_location_id", "part_name", "part_no", "part_received_date", "plan_end", "plan_start", "qty", "raw_data_location", "regis_no", "remark", "status", "status_before_hold", "test_detail", "updated_at" FROM "test_items";
DROP TABLE "test_items";
ALTER TABLE "new_test_items" RENAME TO "test_items";
CREATE UNIQUE INDEX "test_items_item_code_key" ON "test_items"("item_code");
CREATE UNIQUE INDEX "test_items_regis_no_item_no_key" ON "test_items"("regis_no", "item_no");
CREATE TABLE "new_test_runs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "item_id" INTEGER NOT NULL,
    "run_no" INTEGER NOT NULL,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "loading_owner_id" INTEGER,
    "test_owner_id" INTEGER,
    "result" TEXT,
    "equipment_id" INTEGER,
    "rawdata_url" TEXT,
    "remark" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_runs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "test_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "test_runs_loading_owner_id_fkey" FOREIGN KEY ("loading_owner_id") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_runs_test_owner_id_fkey" FOREIGN KEY ("test_owner_id") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_runs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_test_runs" ("created_at", "end_date", "id", "item_id", "loading_owner_id", "rawdata_url", "remark", "result", "run_no", "start_date", "test_owner_id") SELECT "created_at", "end_date", "id", "item_id", "loading_owner_id", "rawdata_url", "remark", "result", "run_no", "start_date", "test_owner_id" FROM "test_runs";
DROP TABLE "test_runs";
ALTER TABLE "new_test_runs" RENAME TO "test_runs";
CREATE UNIQUE INDEX "test_runs_item_id_run_no_key" ON "test_runs"("item_id", "run_no");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "status_logs_item_id_idx" ON "status_logs"("item_id");

-- CreateIndex
CREATE INDEX "location_logs_item_id_idx" ON "location_logs"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_read_at_idx" ON "notifications"("read_at");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_name_key" ON "equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "test_methods_code_key" ON "test_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "test_methods_name_key" ON "test_methods"("name");

-- CreateIndex
CREATE UNIQUE INDEX "test_requests_public_token_key" ON "test_requests"("public_token");

