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
INSERT INTO "new_test_items" ("actual_end", "actual_start", "created_at", "finished_part_location_id", "id", "item_code", "item_no", "owner_id", "part_location_id", "part_name", "part_no", "part_received_date", "plan_end", "plan_start", "qty", "raw_data_location", "regis_no", "remark", "status", "status_before_hold", "test_detail", "test_method_id", "test_name", "updated_at") SELECT "actual_end", "actual_start", "created_at", "finished_part_location_id", "id", "item_code", "item_no", "owner_id", "part_location_id", "part_name", "part_no", "part_received_date", "plan_end", "plan_start", "qty", "raw_data_location", "regis_no", "remark", "status", "status_before_hold", "test_detail", "test_method_id", "test_name", "updated_at" FROM "test_items";
DROP TABLE "test_items";
ALTER TABLE "new_test_items" RENAME TO "test_items";
CREATE UNIQUE INDEX "test_items_item_code_key" ON "test_items"("item_code");
CREATE UNIQUE INDEX "test_items_regis_no_item_no_key" ON "test_items"("regis_no", "item_no");
CREATE TABLE "new_test_requests" (
    "regis_no" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "request_dept_id" INTEGER NOT NULL,
    "requester" TEXT NOT NULL,
    "request_date" DATETIME NOT NULL,
    "remark" TEXT,
    "folder_url" TEXT,
    "public_token" TEXT,
    "created_by_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "test_requests_request_dept_id_fkey" FOREIGN KEY ("request_dept_id") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_test_requests" ("created_at", "folder_url", "public_token", "regis_no", "remark", "request_date", "request_dept_id", "requester", "seq", "updated_at") SELECT "created_at", "folder_url", "public_token", "regis_no", "remark", "request_date", "request_dept_id", "requester", "seq", "updated_at" FROM "test_requests";
DROP TABLE "test_requests";
ALTER TABLE "new_test_requests" RENAME TO "test_requests";
CREATE UNIQUE INDEX "test_requests_public_token_key" ON "test_requests"("public_token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

