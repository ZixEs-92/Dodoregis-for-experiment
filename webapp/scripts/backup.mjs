/**
 * สำรองข้อมูล Dodoregis — ฐานข้อมูล (dev.db) + ไฟล์แนบ (uploads/)
 *
 *   npm run backup                    เก็บลงโฟลเดอร์ default
 *   BACKUP_DIR=D:/Backup npm run backup
 *   BACKUP_KEEP=30 npm run backup     เก็บย้อนหลังกี่ชุด (default 14)
 *
 * ทำไมไม่ใช้ copy ไฟล์เฉย ๆ:
 *   SQLite เขียนข้อมูลลง dev.db + ไฟล์ -wal/-journal พร้อมกัน ถ้า copy ตอนแอปกำลังเขียน
 *   จะได้สำเนาที่ "ครึ่ง ๆ กลาง ๆ" เปิดไม่ขึ้น — ที่นี่ใช้คำสั่ง VACUUM INTO ของ SQLite
 *   ซึ่งเขียนสำเนาที่สมบูรณ์ออกมาให้ทั้งก้อน ทำตอนแอปรันอยู่ได้เลย ไม่ต้องปิดเซิร์ฟเวอร์
 */
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const WEBAPP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** อ่านค่าจาก .env แบบง่าย ๆ (ไม่พึ่ง dotenv เพื่อให้รันได้ทุกที่) */
function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const fileEnv = readEnvFile(path.join(WEBAPP_DIR, ".env"));
const env = { ...fileEnv, ...process.env };

/**
 * DATABASE_URL="file:./dev.db" → พาธจริง
 * อ้างอิงจากโฟลเดอร์ webapp/ เพราะแอปส่ง url นี้ให้ better-sqlite3 ตรง ๆ ผ่าน driver adapter
 * (src/lib/prisma.ts) ซึ่งมองพาธสัมพัทธ์จาก cwd ตอนรัน ไม่ใช่จากโฟลเดอร์ prisma/
 */
function resolveDbPath() {
  const url = env.DATABASE_URL ?? "file:./dev.db";
  const raw = url.replace(/^file:/, "");
  return path.isAbsolute(raw) ? raw : path.resolve(WEBAPP_DIR, raw);
}

const DB_PATH = resolveDbPath();
const UPLOAD_DIR = env.UPLOAD_DIR ?? path.join(WEBAPP_DIR, "uploads");
const BACKUP_DIR = env.BACKUP_DIR ?? path.join(WEBAPP_DIR, "backups");
const KEEP = Number(env.BACKUP_KEEP ?? 14);

/** 2026-08-03_153012 — เรียงตามชื่อแล้วได้ลำดับเวลาพอดี */
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}
const STAMP_RE = /^\d{4}-\d{2}-\d{2}_\d{6}$/;

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function dirSize(dir) {
  let total = 0;
  let files = 0;
  const walk = async (d) => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        total += (await stat(full)).size;
        files++;
      }
    }
  };
  await walk(dir);
  return { total, files };
}

/** โฟลเดอร์ของรอบนี้ — เก็บไว้เพื่อลบทิ้งถ้าทำไม่สำเร็จ จะได้ไม่เหลือชุดสำรองที่ไม่ครบ */
let dest = null;

async function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`✗ ไม่พบฐานข้อมูลที่ ${DB_PATH}`);
    process.exit(1);
  }

  const name = stamp();
  dest = path.join(BACKUP_DIR, name);
  if (existsSync(dest)) {
    console.error(`✗ มีโฟลเดอร์ ${dest} อยู่แล้ว — ข้ามรอบนี้`);
    process.exit(1);
  }
  await mkdir(dest, { recursive: true });

  // ── 1) ฐานข้อมูล ──
  const dbDest = path.join(dest, "dev.db");
  const src = new Database(DB_PATH, { readonly: true });
  try {
    // ต้องเป็น string literal ครอบด้วย single quote — double quote ใน SQLite = ชื่อคอลัมน์
    const literal = `'${dbDest.replace(/'/g, "''")}'`;
    // VACUUM INTO ต้องการให้ไฟล์ปลายทางยังไม่มี — ป้องกันการเขียนทับโดยไม่ตั้งใจในตัว
    src.exec(`VACUUM INTO ${literal}`);
  } finally {
    src.close();
  }

  // ── 2) ตรวจว่าสำเนาที่ได้เปิดได้จริงและข้อมูลครบ ──
  const copy = new Database(dbDest, { readonly: true });
  let integrity;
  let counts;
  try {
    integrity = copy.pragma("integrity_check", { simple: true });
    const one = (sql) => copy.prepare(sql).get().n;
    counts = {
      requests: one("SELECT COUNT(*) n FROM test_requests"),
      items: one("SELECT COUNT(*) n FROM test_items"),
      attachments: one("SELECT COUNT(*) n FROM attachments"),
      users: one("SELECT COUNT(*) n FROM users"),
    };
  } finally {
    copy.close();
  }
  if (integrity !== "ok") {
    console.error(`✗ สำเนาฐานข้อมูลไม่ผ่านการตรวจ (integrity_check = ${integrity})`);
    process.exit(1);
  }

  const dbSize = (await stat(dbDest)).size;

  // ── 3) ไฟล์แนบ ──
  let uploads = { total: 0, files: 0 };
  if (existsSync(UPLOAD_DIR)) {
    await cp(UPLOAD_DIR, path.join(dest, "uploads"), { recursive: true });
    uploads = await dirSize(path.join(dest, "uploads"));
  }

  await writeFile(
    path.join(dest, "manifest.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        source: { db: DB_PATH, uploads: UPLOAD_DIR },
        db: { bytes: dbSize, integrity, counts },
        uploads: { files: uploads.files, bytes: uploads.total },
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`✓ สำรองข้อมูลแล้ว → ${dest}`);
  console.log(
    `  ฐานข้อมูล ${mb(dbSize)} · ใบรีเควส ${counts.requests} · รายการทดสอบ ${counts.items}` +
      ` · ไฟล์แนบ ${counts.attachments} · ผู้ใช้ ${counts.users}`,
  );
  console.log(`  ไฟล์แนบที่ก๊อป ${uploads.files} ไฟล์ (${mb(uploads.total)})`);

  // ── 4) ลบชุดเก่าที่เกินจำนวนที่เก็บ (แตะเฉพาะโฟลเดอร์ที่ชื่อตรงรูปแบบวันที่เท่านั้น) ──
  const all = (await readdir(BACKUP_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && STAMP_RE.test(e.name))
    .map((e) => e.name)
    .sort();
  const old = all.slice(0, Math.max(0, all.length - KEEP));
  for (const o of old) {
    await rm(path.join(BACKUP_DIR, o), { recursive: true, force: true });
    console.log(`  ลบชุดเก่า ${o}`);
  }
  console.log(`  เก็บไว้ทั้งหมด ${all.length - old.length} ชุด (ตั้งไว้ ${KEEP})`);
}

main().catch(async (err) => {
  console.error("✗ สำรองข้อมูลไม่สำเร็จ:", err);
  if (dest && existsSync(dest)) {
    await rm(dest, { recursive: true, force: true });
    console.error(`  ลบชุดที่ทำค้างไว้ ${dest} แล้ว`);
  }
  process.exit(1);
});
