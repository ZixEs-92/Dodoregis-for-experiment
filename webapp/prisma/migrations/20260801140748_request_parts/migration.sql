-- CreateTable
CREATE TABLE "request_parts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "regis_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "part_no" TEXT,
    "qty" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "request_parts_regis_no_fkey" FOREIGN KEY ("regis_no") REFERENCES "test_requests" ("regis_no") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_RequestPartToTestItem" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_RequestPartToTestItem_A_fkey" FOREIGN KEY ("A") REFERENCES "request_parts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_RequestPartToTestItem_B_fkey" FOREIGN KEY ("B") REFERENCES "test_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "request_parts_regis_no_idx" ON "request_parts"("regis_no");

-- CreateIndex
CREATE UNIQUE INDEX "_RequestPartToTestItem_AB_unique" ON "_RequestPartToTestItem"("A", "B");

-- CreateIndex
CREATE INDEX "_RequestPartToTestItem_B_index" ON "_RequestPartToTestItem"("B");

