-- CreateTable
CREATE TABLE "Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "PartLocation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "FinishedLocation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "test_requests" (
    "regis_no" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "request_dept_id" INTEGER NOT NULL,
    "requester" TEXT NOT NULL,
    "request_date" DATETIME NOT NULL,
    "remark" TEXT,
    "folder_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "test_requests_request_dept_id_fkey" FOREIGN KEY ("request_dept_id") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_items" (
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "test_items_regis_no_fkey" FOREIGN KEY ("regis_no") REFERENCES "test_requests" ("regis_no") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "test_items_part_location_id_fkey" FOREIGN KEY ("part_location_id") REFERENCES "PartLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_items_finished_part_location_id_fkey" FOREIGN KEY ("finished_part_location_id") REFERENCES "FinishedLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "item_id" INTEGER NOT NULL,
    "run_no" INTEGER NOT NULL,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "loading_owner_id" INTEGER,
    "test_owner_id" INTEGER,
    "result" TEXT,
    "rawdata_url" TEXT,
    "remark" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_runs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "test_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "test_runs_loading_owner_id_fkey" FOREIGN KEY ("loading_owner_id") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "test_runs_test_owner_id_fkey" FOREIGN KEY ("test_owner_id") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reports" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "item_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "sent_date" DATETIME,
    "file_path" TEXT,
    "report_url" TEXT,
    "author_id" INTEGER,
    "approver_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reports_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "test_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reports_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reports_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "request_no" TEXT,
    "item_id" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "label" TEXT,
    "file_name" TEXT,
    "stored_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "url" TEXT,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_request_no_fkey" FOREIGN KEY ("request_no") REFERENCES "test_requests" ("regis_no") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attachments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "test_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Member_name_key" ON "Member"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PartLocation_name_key" ON "PartLocation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FinishedLocation_name_key" ON "FinishedLocation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "test_items_item_code_key" ON "test_items"("item_code");

-- CreateIndex
CREATE UNIQUE INDEX "test_items_regis_no_item_no_key" ON "test_items"("regis_no", "item_no");

-- CreateIndex
CREATE UNIQUE INDEX "test_runs_item_id_run_no_key" ON "test_runs"("item_id", "run_no");
