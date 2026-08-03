-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "item_id" INTEGER,
    "regis_no" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "test_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_regis_no_fkey" FOREIGN KEY ("regis_no") REFERENCES "test_requests" ("regis_no") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notifications" ("created_at", "dedupe_key", "id", "item_id", "kind", "level", "message", "read_at") SELECT "created_at", "dedupe_key", "id", "item_id", "kind", "level", "message", "read_at" FROM "notifications";
DROP TABLE "notifications";
ALTER TABLE "new_notifications" RENAME TO "notifications";
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
CREATE INDEX "notifications_read_at_idx" ON "notifications"("read_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

