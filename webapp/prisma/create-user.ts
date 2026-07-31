// สร้าง/แก้ไขบัญชีผู้ใช้ (Phase 3 auth)
// ใช้งาน: npx tsx prisma/create-user.ts <username> <password> [role] [displayName...]
//   role: ADMIN | ENGINEER | REQUESTER | VIEWER  (ค่าเริ่มต้น ADMIN)
// ตัวอย่าง: npx tsx prisma/create-user.ts admin "P@ssw0rd" ADMIN "ผู้ดูแลระบบ"
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["ADMIN", "ENGINEER", "REQUESTER", "VIEWER"] as const;
type Role = (typeof VALID_ROLES)[number];

const [, , username, password, roleArg, ...nameParts] = process.argv;

if (!username || !password) {
  console.error(
    "ใช้งาน: npx tsx prisma/create-user.ts <username> <password> [role] [displayName...]",
  );
  process.exit(1);
}

const role = (roleArg ?? "ADMIN").toUpperCase();
if (!VALID_ROLES.includes(role as Role)) {
  console.error(`role ต้องเป็นหนึ่งใน: ${VALID_ROLES.join(", ")}`);
  process.exit(1);
}
const displayName = nameParts.join(" ").trim() || username;

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, role: role as Role, displayName, active: true },
    create: { username, passwordHash, role: role as Role, displayName },
  });
  console.log(`✔ บันทึกผู้ใช้: ${user.username} (${user.role}) — ${user.displayName}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
