-- CreateTable
CREATE TABLE "approval_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "regis_no" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "by_id" INTEGER,
    "reason" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_logs_regis_no_fkey" FOREIGN KEY ("regis_no") REFERENCES "test_requests" ("regis_no") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "approval_logs_by_id_fkey" FOREIGN KEY ("by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_DepartmentHeads" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_DepartmentHeads_A_fkey" FOREIGN KEY ("A") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DepartmentHeads_B_fkey" FOREIGN KEY ("B") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
INSERT INTO "new_test_requests" ("created_at", "created_by_id", "folder_url", "public_token", "purpose", "regis_no", "remark", "request_date", "request_dept_id", "requester", "requester_email", "requester_phone", "seq", "test_object", "updated_at") SELECT "created_at", "created_by_id", "folder_url", "public_token", "purpose", "regis_no", "remark", "request_date", "request_dept_id", "requester", "requester_email", "requester_phone", "seq", "test_object", "updated_at" FROM "test_requests";
DROP TABLE "test_requests";
ALTER TABLE "new_test_requests" RENAME TO "test_requests";
CREATE UNIQUE INDEX "test_requests_public_token_key" ON "test_requests"("public_token");
CREATE INDEX "test_requests_approval_status_idx" ON "test_requests"("approval_status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "approval_logs_regis_no_idx" ON "approval_logs"("regis_no");

-- CreateIndex
CREATE UNIQUE INDEX "_DepartmentHeads_AB_unique" ON "_DepartmentHeads"("A", "B");

-- CreateIndex
CREATE INDEX "_DepartmentHeads_B_index" ON "_DepartmentHeads"("B");

