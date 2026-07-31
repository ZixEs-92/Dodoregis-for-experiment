# แผน: ระบบผู้ใช้ + สิทธิ์ ให้แผนกเพิ่มงานเอง / Admin วางแผน

> เอกสารแผน (Phase 3) · อัปเดต 2026-07-31 — **3a (auth core) + 3b (บังคับสิทธิ์) ทำแล้ว** · เหลือ 3e (หน้าจัดการผู้ใช้), 3c (พอร์ทัล requester), 3d (คิววางแผน)
> เป้าหมาย: ให้ **แต่ละแผนกล็อกอินเข้ามาเพิ่มงานทดสอบ (ใบรีเควส) ได้เอง** แล้ว **Admin เป็นคนลงแผน** (มอบหมายผู้รับผิดชอบ + วันที่ plan + รายละเอียด/วิธีทดสอบ)

## สรุปการตัดสินใจ (ยืนยันกับผู้ใช้แล้ว)
| หัวข้อ | เลือก |
|--------|-------|
| การล็อกอิน | **บัญชีในระบบ** (username/password, เข้ารหัสด้วย bcrypt) — admin สร้าง/รีเซ็ตให้ ไม่ต้องพึ่ง IT |
| บทบาท (roles) | **4 บทบาท**: Admin · Engineer · Requester · Viewer |
| การมองเห็นของ requester | **เฉพาะงานแผนกตัวเอง** |
| การ "ดู" ข้อมูล (viewer) | **เปิดให้ทุกคน ไม่ต้องล็อกอิน** (อ่านอย่างเดียว · เหมาะกับสแกน QR หน้างาน) — ล็อกอินเฉพาะตอนสร้าง/แก้ |

**ความคืบหน้า (2026-07-31): 3a + 3b ทำแล้ว** — login/session (bcrypt + jose cookie 8ชม.), 4 roles, กันสิทธิ์ฝั่ง server ทุก action (`src/lib/guard.ts`) + page guard + ซ่อน UI ตาม role (viewer อ่านอย่างเดียว) · สร้าง user: `npm run create-user -- <user> <pass> <ROLE> "<ชื่อ>"` · **ลำดับถัดไป: 3e (หน้าจัดการผู้ใช้) → 3c (พอร์ทัล requester, ownerId nullable) → 3d (คิววางแผน)**

---

## 1. บทบาท (Roles) และสิทธิ์

| การทำงาน | Admin | Engineer | Requester | Viewer |
|----------|:-----:|:--------:|:---------:|:------:|
| เพิ่มใบรีเควส + item (ฟอร์มย่อ) | ✔ | ✔ | ✔ (แผนกตัวเอง) | — |
| แก้ใบ/ item ก่อน admin รับ (ยังไม่มอบหมาย) | ✔ | ✔ | ✔ (ของตัวเอง) | — |
| **มอบหมายผู้รับผิดชอบ + ลงวันที่ plan** | ✔ | — | — | — |
| ตั้งรายละเอียด/วิธีทดสอบ (test plan) | ✔ | ✔ | — | — |
| เปลี่ยนสถานะงาน (workflow) | ✔ | ✔ | — | — |
| บันทึก Test Run / ผลเทส / รีพอร์ท | ✔ | ✔ | — | — |
| ย้ายที่เก็บ (chain of custody) | ✔ | ✔ | — | — |
| จัดการ master data (แผนก/ทีม/ตำแหน่ง) | ✔ | — | — | — |
| **จัดการผู้ใช้ (สร้าง/รีเซ็ตรหัส/ปิดบัญชี)** | ✔ | — | — | — |
| ดู dashboard / วิเคราะห์ / รายงาน / export | ✔ | ✔ | เฉพาะแผนกตัวเอง | ✔ (อ่านอย่างเดียว) |

> หลักการ: **บังคับสิทธิ์ที่ฝั่ง server ทุกจุด** (ทุก server action + ทุกหน้า) — การซ่อนปุ่มบน UI เป็นแค่ความสะดวก ไม่ใช่การป้องกัน

---

## 2. Flow หลัก (สองขั้น: แผนกกรอก → Admin วางแผน)

```
[Requester/แผนก]  ── ล็อกอิน ──►  เพิ่มงานใหม่ (ฟอร์มย่อ)
     กรอกเฉพาะที่รู้: ชื่อชิ้นงาน/รุ่น, part no., จำนวน,
     ชื่อการทดสอบ, รายละเอียด/มาตรฐานที่ต้องการ, วันที่อยากได้ผล,
     แนบใบรีเควส/email  ──►  บันทึก
                                   │
                                   ▼
     สร้าง TestRequest + TestItem  →  สถานะ = 1-รับใบรีเควส
     owner = (ยังไม่มอบหมาย) · plan ว่าง
                                   │
                                   ▼
[Admin]  เห็น "คิวรอวางแผน" (item สถานะ S1 ที่ยังไม่มอบหมาย)
     กด "มอบหมาย & วางแผน":
       - เลือกผู้รับผิดชอบ (Member)
       - ลง plan เริ่ม / plan จบ
       - ปรับ/ยืนยันรายละเอียดเทส + เลือก test method
       - เลื่อนสถานะ → 2-รอรับพาร์ท / 3-รับพาร์ทแล้ว
                                   │
                                   ▼
[Engineer]  ทำงานตาม workflow เดิม (รับพาร์ท → เทส → รีพอร์ท → ปิดงาน)
[Requester] ติดตามสถานะงานแผนกตัวเอง (อ่านอย่างเดียว) + รับแจ้งเตือน
```

จุดสำคัญ: **ไม่ต้องเพิ่มสถานะใหม่** — ใช้สถานะ `1-รับใบรีเควส` ที่มีอยู่แทน "รับเข้าระบบแล้ว รอ admin วางแผน" คิวรอวางแผน = item ที่ `status = S1_RECEIVED และ ownerId เป็น null`

---

## 3. การเปลี่ยนแปลง Schema (Prisma)

### 3.1 โมเดลใหม่: `User`
```prisma
enum UserRole { ADMIN ENGINEER REQUESTER VIEWER }

model User {
  id           Int       @id @default(autoincrement())
  username     String    @unique
  passwordHash String    @map("password_hash")
  displayName  String    @map("display_name")
  role         UserRole  @default(REQUESTER)

  // requester ผูกกับแผนก (ใช้ทั้ง auto-fill ตอนเพิ่มงาน และ filter การมองเห็น)
  department   Department? @relation(fields: [departmentId], references: [id])
  departmentId Int?        @map("department_id")

  // engineer/admin ที่รับงานจริง ผูกกับ Member เดิม (เพื่อมอบหมาย/ลง changedBy)
  member       Member?   @relation(fields: [memberId], references: [id])
  memberId     Int?      @unique @map("member_id")

  active      Boolean   @default(true)
  lastLoginAt DateTime? @map("last_login_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@map("users")
}
```
+ เพิ่ม reverse relation ใน `Department` (`users User[]`) และ `Member` (`user User?`)

### 3.2 แก้ `TestItem.ownerId` ให้เป็น nullable
- เดิม `ownerId Int` (บังคับ) → เปลี่ยนเป็น `ownerId Int?` เพราะงานที่แผนกเพิ่งกรอกยัง "ไม่มอบหมาย"
- **กติกาบังคับ (ระดับ logic):** ห้ามเลื่อนพ้นสถานะ `S1_RECEIVED` ถ้ายังไม่มี `ownerId`
- ⚠️ **ผลกระทบต่อเนื่อง (ต้องแก้ทุกที่ที่ถือว่า owner ไม่ null):**
  - `dashboard` — Workload/Loading ต่อคน (`page.tsx`)
  - `schedule` / `WeeklySchedule.tsx`
  - `item/[item_code]` header + Info (`item.owner.name`)
  - `requests/[regis_no]` การ์ด item
  - `GroupedRequests.tsx`, `report.ts` (byOwner)
  - → แสดง "ยังไม่มอบหมาย" เมื่อ owner เป็น null

### 3.3 เก็บ "ใครสร้าง" + `desiredDueDate`
```prisma
model TestRequest {
  // ...ของเดิม...
  createdBy    User?  @relation(fields: [createdById], references: [id])
  createdById  Int?   @map("created_by_id")
}
model TestItem {
  // ...ของเดิม...
  requestedDueDate DateTime? @map("requested_due_date") // วันที่แผนก "อยากได้ผล" (ต่างจาก planEnd ของ admin)
}
```

### 3.4 เติม `changedBy` จาก session
- ทุก server action ที่เขียน `StatusLog` / `LocationLog` (และ audit จุดอื่น) ให้ใส่ `changedBy = session.displayName` (ช่องมีอยู่แล้วใน schema)

> **Migration ใช้สูตร Prisma 7 (ตามที่บันทึกไว้):** หยุด dev server → `prisma migrate diff --from-migrations ./prisma/migrations --to-schema ./prisma/schema.prisma --script` เขียนลงไฟล์ migration → `prisma migrate deploy && prisma generate` · การเพิ่มคอลัมน์ nullable/ตารางใหม่เป็น additive ปลอดภัยกับ data เดิม · **ทดสอบบนสำเนา dev.db ก่อน**

---

## 4. Auth — วิธี implement (Next.js 16)

- **เข้ารหัสรหัสผ่าน:** `bcryptjs` (pure-JS ไม่ต้อง build native บน Windows) cost 10–12
- **Session:** cookie แบบ signed JWT ด้วย `jose` (HS256) — เก็บ `{ userId, role, deptId, displayName }`
  - `httpOnly`, `sameSite=lax`, `secure` (เฉพาะ prod/https), อายุ ~8 ชม. (rolling)
  - ทำงานได้ทั้ง server component และ middleware (jose รันบน edge ได้ — ต่างจาก bcrypt ที่รันเฉพาะ node)
- **`middleware.ts`:** กันทุกเส้นทางยกเว้น `/login` (+ portal สาธารณะถ้ามี) → ถ้าไม่มี session ที่ถูกต้อง redirect ไป `/login`
- **helper:** `getSession()` (อ่าน+ตรวจ cookie) · `requireRole([...])` เรียกใน server action/หน้า
- **login/logout:** server action → ตรวจ `bcrypt.compare` กับ `passwordHash` → set/clear cookie
- **ทางเลือกที่หนักกว่า:** Auth.js v5 (next-auth) credentials provider — ฟีเจอร์เยอะแต่ overkill สำหรับทีมเล็กภายใน · **แนะนำ jose + bcryptjs**

### Security ที่ต้องมี
- แฮชรหัสผ่านเสมอ (ห้ามเก็บ plaintext)
- บังคับ authorization ที่ server ทุก action (ไม่เชื่อ UI)
- rate-limit login (กันเดารหัส) — เริ่มแบบง่าย (นับ fail ต่อ username/IP)
- รหัสผ่าน reset โดย admin (ภายใน ไม่ต้องพึ่ง email)

---

## 5. UI / หน้าจอที่ต้องเพิ่ม-แก้

**ใหม่**
- `/login` + ปุ่ม logout ใน NavBar (โชว์ชื่อผู้ใช้ + บทบาท)
- `/settings/users` — จัดการผู้ใช้ (สร้าง/แก้บทบาท/ผูกแผนกหรือ Member/รีเซ็ตรหัส/ปิดบัญชี) — Admin เท่านั้น
- **คิวรอวางแผน** (Admin) — ส่วนบน dashboard หรือ `/queue`: item สถานะ S1 ที่ยังไม่มอบหมาย + ปุ่ม "มอบหมาย & วางแผน" (ฟอร์มตั้ง owner + planStart/planEnd + test method → เลื่อนสถานะ)
- **มุมมอง Requester** — หน้าแผนกตัวเอง: รายการงานของแผนก + สถานะ, ฟอร์มเพิ่มงานแบบย่อ (แผนกล็อกอัตโนมัติ), หน้า item แบบอ่านอย่างเดียว (ไม่มี stepper/แก้ plan; ยังแนบไฟล์/ใส่ remark ได้)

**แก้**
- `NavBar` — เมนูตามบทบาท (requester เห็นเมนูย่อ: หน้าแผนกฉัน / เพิ่มงาน)
- ฟอร์มเพิ่มงาน — แยก 2 เวอร์ชัน: requester (ฟิลด์ย่อ) vs admin/engineer (ครบ)
- ทุกหน้า/ฟอร์ม — ปิดปุ่มแก้ไขสำหรับ Viewer (อ่านอย่างเดียว)
- ตัวกรองการมองเห็น requester: `where requestDeptId == session.deptId`

---

## 6. Seed / เริ่มใช้ครั้งแรก
- สร้าง admin คนแรกด้วยสคริปต์ `prisma/seed-admin.ts` (npm script `seed:admin`) อ่าน `ADMIN_USERNAME` / `ADMIN_PASSWORD` จาก env (เลี่ยง interactive)
- Backfill data เดิม: `createdById = null`, `ownerId` ของเดิมยังอยู่ครบ (nullable เป็น additive)

---

## 7. แบ่งเฟสย่อยการ implement (ทำทีละก้อน commit ได้)
| เฟส | เนื้อหา | หมายเหตุ |
|-----|---------|----------|
| **3a** | Auth core: โมเดล User, login/logout, session (jose), middleware, seed admin, wire `changedBy` | ยังไม่เปลี่ยน workflow — แค่ "ใครทำ" ถูกบันทึก |
| **3b** | Roles & guards: enum, ตารางสิทธิ์, เมนูตามบทบาท, guard action/หน้า, Viewer อ่านอย่างเดียว | |
| **3c** | Requester portal: มองเห็นเฉพาะแผนก, ฟอร์มเพิ่มงานย่อ, `ownerId` nullable + handle "ยังไม่มอบหมาย" | ก้อนที่กระทบหลายหน้าสุด |
| **3d** | คิวรอวางแผนของ Admin + ฟอร์ม "มอบหมาย & วางแผน" → เลื่อนสถานะ | หัวใจของโจทย์ |
| **3e** | หน้าจัดการผู้ใช้ + รีเซ็ตรหัส | |

**ความเสี่ยง/แรงงานหลัก:** ข้อ 3.2 (`ownerId` nullable) กระจายหลายหน้า — งานปานกลาง · ที่เหลือตรงไปตรงมา

---

## 8. ค่า default ที่ผมเลือกให้ (ปรับได้)
- `bcryptjs` + session cookie (jose) อายุ 8 ชม.
- Requester แก้งานได้เฉพาะช่วงยัง S1 + ยังไม่มอบหมาย · หลัง admin รับแล้ว = อ่านอย่างเดียว (ยังแนบไฟล์/remark ได้)
- Engineer เห็น item ทุกงาน (ทีมเล็ก) — ไม่จำกัดเฉพาะงานที่มอบหมาย
- `requestedDueDate` (แผนกอยากได้ผลวันไหน) แยกจาก `planEnd` (admin ลงจริง)

---

## 9. เชื่อมโยง
- ต่อยอด groundwork ที่มีใน schema: `Member.role`, `changedBy` ใน log, `publicToken` (ถ้าจะทำ portal ดูสถานะแบบไม่ต้องล็อกอินเพิ่มทีหลัง)
- เกี่ยวกับ deploy/เข้าถึงมือถือ: ดู `docs/แผน-เข้าถึงจากมือถือ-ฟรี.md`, `docs/แผน-cloudflare-tunnel-access.md` (ต้องมี auth ก่อนเปิดออกนอกองค์กร)
