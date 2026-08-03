# แผน: เพิ่มขั้นอนุมัติใบรีเควส + จัดระเบียบสิทธิ์ทั้งระบบ

> **สถานะ: แผนพร้อมลงมือ — ยังไม่เขียนโค้ด** · ร่าง 3 ส.ค. 2026
> เอกสารนี้เขียนให้ละเอียดพอที่จะส่งต่อให้คนอื่น (หรือ AI ตัวอื่น) ลงมือเขียนโค้ดได้เลย
> ต่อยอดจาก Phase 3 (auth + requester portal) และ commit `a501582` (ล็อกทุกหน้า + ปิดรู API)

---

## ส่วนที่ 1 — ผลวิเคราะห์ route ปัจจุบัน

ก่อนเพิ่มของใหม่ ผมไล่ดู route ทั้ง 24 เส้นกับตัวกันสิทธิ์ทุกจุด นี่คือสิ่งที่เจอ

### 🔴 F1 — ผู้ขอแก้ใบที่ "อนุมัติแล้ว" ได้ (ทำให้การอนุมัติไม่มีความหมาย)

`assertCanEditRequest()` ใน `webapp/src/app/actions.ts` เช็คแค่ว่า *เป็นใบของแผนกตัวเองไหม*
ไม่ได้ดูสถานะใด ๆ ฟังก์ชันนี้เป็นประตูของ `addItem` · `addRequestPart` · `deleteRequestPart` · `uploadAttachment`

แปลว่าถ้าไม่แก้ **ผู้ขอจะเพิ่มรายการทดสอบใหม่หรือเปลี่ยนรุ่น Lamp ในใบที่หัวหน้าเซ็นผ่านไปแล้วได้**
= เซ็นอนุมัติงาน A แล้วเนื้องานกลายเป็น B ทีหลัง

**นี่คือช่องโหว่ที่ต้องปิดพร้อมกับ flow อนุมัติ ไม่ใช่ปิดทีหลัง**

### 🔴 F2 — `isDeptScoped()` ผูกกับ role `REQUESTER` ตรง ๆ

```ts
// webapp/src/lib/roles.ts (ปัจจุบัน)
export function isDeptScoped(role, userDeptId) {
  return role === "REQUESTER" && userDeptId != null;
}
```

พอเพิ่ม role `DEPT_HEAD` เข้ามา เงื่อนไขนี้จะเป็น false ทันที →
**หัวหน้าแผนกจะเห็นงานของทุกแผนกทั้งระบบ** ซึ่งขัดกับที่คุณสั่งไว้ว่า "ดูงานของแผนกตัวเองได้"

ใช้อยู่ 5 จุด: `layout.tsx` · `requests/page.tsx` · `board/page.tsx` · `notifications/page.tsx` · `api/search/route.ts`

### 🟠 F3 — `canEditTests()` ถูกใช้ปน 2 ความหมาย

| ใช้ที่ | ความหมายที่ต้องการจริง ๆ |
|---|---|
| `items/[code]`, `board`, `notifications`, `requests/[regis]` | **"แก้ผลเทสได้"** |
| `analytics`, `reports`, `labels`, `api/export`, `guardPageTeam` | **"เป็นทีมแลป เห็นได้ทุกแผนก"** |

ตอนนี้สองอย่างนี้เป็นคนกลุ่มเดียวกันเลยไม่มีปัญหา แต่ `LAB_HEAD` คือคนที่
**เห็นได้ทุกแผนก แต่ไม่ควรไปแก้ผลเทส** → ถ้าไม่แยกฟังก์ชันก่อน จะเลือกไม่ได้ว่าจะให้สิทธิ์อันไหน

### 🟡 F4 — `markNotificationRead()` กันแค่ "ล็อกอินแล้ว"

`webapp/src/app/actions.ts` — ผู้ขอเดา id แล้วกดอ่านแจ้งเตือนของแผนกอื่นได้
ผลกระทบต่ำ (แค่ธง read) แต่อยู่ในไฟล์เดียวกับที่กำลังจะแก้อยู่แล้ว ปิดไปพร้อมกันเลย

### 🟡 F5 — ผู้ขอ/หัวหน้าแผนกไม่มีทางดูสรุปงานของแผนกตัวเองเลย

`/analytics` และ `/reports` ปิดเฉพาะทีมแลป (ถูกต้องแล้ว เพราะเป็น KPI ภายใน)
แต่แปลว่าหัวหน้าแผนกตอบคำถาม "แผนกฉันส่งงานไปกี่ใบ ค้างกี่ใบ" ไม่ได้เลย

**ข้อเสนอ: ยกไป backlog** ไม่ทำรอบนี้ (ทำเป็นหน้าสรุปเฉพาะแผนกทีหลัง) — จดไว้กันลืม

### 🟡 F6 — สแกน QR ของแผนกอื่นแล้วได้ 404 เปล่า ๆ

ถูกต้องเชิงความปลอดภัย (ไม่บอกว่ามีใบนั้นอยู่) แต่หน้างานจะงงว่าสติกเกอร์เสีย
**ข้อเสนอ:** หน้า `/scan` ตรวจก่อนพาไป ถ้าไม่มีสิทธิ์ให้ขึ้นข้อความ
"งานนี้ไม่ใช่ของแผนกคุณ — ติดต่อทีมแลป" แทนการเด้งเข้า 404

### ✅ ที่ตรวจแล้วสมเหตุสมผลดี ไม่ต้องแตะ

- `/labels` เฉพาะทีมแลป — พิมพ์สติกเกอร์เป็นงานแลป ✔
- `deleteAttachment` เฉพาะ ADMIN/ENGINEER — ผู้ขอแนบได้แต่ลบไม่ได้ ✔
- `VIEWER` เห็นได้ทุกแผนก — คนสแกน QR หน้าชั้นวางเจอชิ้นงานปนกันทุกแผนกอยู่แล้ว ✔
- `/planning` กันงานที่ยังไม่มีเจ้าของไม่ให้เดินเกินสถานะ 2 ✔ (จะใช้กลไกเดียวกันกับการอนุมัติ)
- `proxy.ts` เป็นตาข่ายชั้นนอก + guard รายหน้า ✔

---

## ส่วนที่ 2 — โครงสร้าง role ใหม่

### 2.1 เพิ่ม 2 role (ตามที่ตกลง: สร้างบัญชีแยกสำหรับหัวหน้า)

```prisma
enum UserRole {
  ADMIN
  LAB_HEAD    // ใหม่ — หัวหน้าแผนกทดสอบ (อนุมัติชั้น 2)
  ENGINEER
  DEPT_HEAD   // ใหม่ — หัวหน้าแผนกผู้ขอ (อนุมัติชั้น 1)
  REQUESTER
  VIEWER
}
```

> **ทำไมเปลี่ยนใจจาก "ติ๊กเพิ่มบน user เดิม" มาเป็น role ใหม่:**
> เดิมผมเลี่ยง role เพราะกลัวหัวหน้าแลปที่เป็นวิศวกรอยู่แล้วจะเสียสิทธิ์วิศวกรไป
> พอผู้ใช้ยืนยันว่า **จะสร้างบัญชีแยกสำหรับหัวหน้าโดยเฉพาะ** ปัญหานั้นหายไป
> และ role ตรงไปตรงมากว่ามาก (เห็นในหน้าจัดการผู้ใช้ทันทีว่าใครเป็นอะไร)

**`DEPT_HEAD` ต้องผูก `departmentId`** (บังคับเหมือน REQUESTER) เพราะเขาอนุมัติ/เห็นเฉพาะแผนกตัวเอง
**`LAB_HEAD` ไม่ต้องผูกแผนก** — ดูทั้งแลป

ตั้งได้หลายคนต่อ role/แผนก **ใครเซ็นก่อนก็ผ่าน** (กันงานค้างตอนหัวหน้าลา)

### 2.2 ตารางสิทธิ์ (แหล่งความจริงเดียว — `webapp/src/lib/roles.ts`)

| ความสามารถ | ADMIN | LAB_HEAD | ENGINEER | DEPT_HEAD | REQUESTER | VIEWER |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| เห็นงานทุกแผนก | ✅ | ✅ | ✅ | ❌ แผนกตัวเอง | ❌ แผนกตัวเอง | ✅ |
| ลงงานใหม่ | ✅ | ✅ | ✅ | ✅ แผนกตัวเอง | ✅ แผนกตัวเอง | ❌ |
| **อนุมัติชั้น 1 (แผนก)** | ✅ แทนได้ | ❌ | ❌ | ✅ แผนกตัวเอง | ❌ | ❌ |
| **อนุมัติชั้น 2 (แลป)** | ✅ แทนได้ | ✅ | ❌ | ❌ | ❌ | ❌ |
| แก้สถานะ/ผลเทส/รีพอร์ท | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| วางแผน/มอบหมายงาน | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ดู analytics/reports/labels | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| จัดการ master data / ผู้ใช้ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**2 ช่องที่ผมตัดสินใจเอง — ทักได้ถ้าไม่ใช่:**
- `LAB_HEAD` **วางแผน/มอบหมายงานได้** — หัวหน้าแลปคือคนที่รู้ว่าใครว่าง การให้เซ็นรับงานแล้วมอบหมายต่อไม่ได้ดูขัดกับความจริง
- `LAB_HEAD` **แก้ผลเทสไม่ได้** — ตรงตามที่คุณบอก ("อนุมัติได้ ดูงานทั้งหมดได้") ถ้าอยากให้แก้ด้วยเปลี่ยนบรรทัดเดียว

### 2.3 ฟังก์ชันสิทธิ์ที่ต้องมี (แทนของเดิม)

```ts
// webapp/src/lib/roles.ts — ปลอดภัยสำหรับ import ฝั่ง client (type-only import เท่านั้น)

const ALL_DEPT_ROLES: UserRole[] = ["DEPT_HEAD", "REQUESTER"];

/** เห็นได้เฉพาะแผนกตัวเอง — แก้ F2: ต้องรวม DEPT_HEAD ไม่ใช่แค่ REQUESTER */
export function isDeptScoped(role, userDeptId): boolean {
  return role != null && ALL_DEPT_ROLES.includes(role) && userDeptId != null;
}

/** แก้สถานะ/ลงผลเทส/รีพอร์ท — แก้ F3: ความหมายแคบลง ไม่รวม LAB_HEAD */
export function canEditTests(role): boolean {
  return hasRole(role, "ADMIN", "ENGINEER");
}

/** ทีมแลป: เห็นได้ทุกแผนก + เข้า analytics/reports/labels/export — ใหม่ (แก้ F3) */
export function canViewLabWide(role): boolean {
  return hasRole(role, "ADMIN", "LAB_HEAD", "ENGINEER");
}

/** วางแผน/มอบหมาย */
export function canPlanWork(role): boolean {
  return hasRole(role, "ADMIN", "LAB_HEAD");
}

/** จัดการระบบ (master data, ผู้ใช้, ตั้งค่า) — เดิมชื่อ canPlanAndManage แต่แยกความหมายแล้ว */
export function canManageSystem(role): boolean {
  return hasRole(role, "ADMIN");
}

export function canCreateRequest(role): boolean {
  return hasRole(role, "ADMIN", "LAB_HEAD", "ENGINEER", "DEPT_HEAD", "REQUESTER");
}

/** อนุมัติชั้น 1 — ต้องเป็นแผนกเดียวกับใบ (admin ข้ามได้ = override) */
export function canApproveDept(role, userDeptId, requestDeptId): boolean {
  if (role === "ADMIN") return true;
  return role === "DEPT_HEAD" && userDeptId != null && userDeptId === requestDeptId;
}

/** อนุมัติชั้น 2 */
export function canApproveLab(role): boolean {
  return hasRole(role, "ADMIN", "LAB_HEAD");
}
```

> ⚠️ `canPlanAndManage` เดิมถูกเรียกอยู่ 7 จุด (guard.ts ×3, NavBar, BottomNav ×2, CommandPalette ×2, notifications)
> ต้องไล่เปลี่ยนให้ครบว่าจุดไหนหมายถึง `canPlanWork` จุดไหนหมายถึง `canManageSystem`

---

## ส่วนที่ 3 — Flow อนุมัติ

```
requester / dept_head ลงใบรีเควส
      │
      ▼
┌──────────────────────────┐
│ รออนุมัติ — หัวหน้าแผนก   │   ← ปิด/เปิดชั้นนี้ได้จากหน้าตั้งค่า
└──────────────────────────┘
      │ approve                  │ reject + เหตุผล (บังคับ)
      ▼                          └──────────────────┐
┌──────────────────────────┐                        │
│ รออนุมัติ — หัวหน้าแลป    │                        │
└──────────────────────────┘                        │
      │ approve                  │ reject           │
      ▼                          └──────────────────┤
┌──────────────────────────┐                        ▼
│ อนุมัติแล้ว → เข้าคิววางแผน │              ┌──────────────────┐
└──────────────────────────┘              │ ตีกลับ — รอผู้ขอ   │
      │                                   │ แก้แล้วส่งใหม่      │
      ▼                                   └──────────────────┘
 สถานะ 1→8 เดิม (ไม่แตะ)                            │
                                    ส่งใหม่ = เริ่มอนุมัติใหม่ทั้ง 2 ชั้น
```

### 3.1 กติกาที่ตกลงแล้ว

| # | เรื่อง | สรุป |
|---|---|---|
| 1 | ชั้น 1 | หัวหน้าแผนกของผู้ขอ — เฉพาะใบแผนกตัวเอง |
| 2 | ชั้น 2 | หัวหน้าแลป — ตั้งได้หลายคน ใครเซ็นก่อนก็ผ่าน |
| 3 | reject | ตีกลับให้แก้ แล้วส่งใหม่ได้ (ไม่ปิดใบ) + **บังคับกรอกเหตุผล** |
| 4 | reject ชั้น 2 | กลับไปหาผู้ขอ **เริ่มใหม่ทั้ง 2 ชั้น** |
| 5 | แลปคีย์ใบเอง | ADMIN/LAB_HEAD/ENGINEER ลงใบ = อนุมัติอัตโนมัติ |
| 6 | ระหว่างรออนุมัติ | ทีมแลปเห็นได้ แต่อยู่ **กล่องแยก** ไม่ปนกับงานที่รับจริง |
| 7 | ชั้นหัวหน้าแผนก | **ปิด/เปิดได้จากหน้าตั้งค่า** ไม่ต้องแก้โค้ด (เผื่อเลิกใช้ทีหลัง) |
| 8 | admin | กด "อนุมัติแทน" ได้ทุกชั้น พร้อมบันทึกว่าใครกดแทน |

### 3.2 State machine

**สถานะเริ่มต้นตอนสร้างใบ**

| ผู้สร้าง | เงื่อนไข | เริ่มที่ |
|---|---|---|
| REQUESTER | ชั้นแผนกเปิด + แผนกมีหัวหน้าอย่างน้อย 1 คน | `PENDING_DEPT` |
| REQUESTER | ชั้นแผนกปิด **หรือ** แผนกยังไม่มีหัวหน้า | `PENDING_LAB` |
| DEPT_HEAD | (ไม่ต้องเซ็นอนุมัติตัวเอง) | `PENDING_LAB` |
| ADMIN / LAB_HEAD / ENGINEER | — | `APPROVED` + log `AUTO_APPROVE` |

**การเปลี่ยนสถานะ**

| จาก | ทำอะไร | ใครทำได้ | ไปเป็น |
|---|---|---|---|
| `PENDING_DEPT` | อนุมัติ | `canApproveDept()` | `PENDING_LAB` |
| `PENDING_DEPT` | ตีกลับ + เหตุผล | `canApproveDept()` | `REJECTED` |
| `PENDING_LAB` | อนุมัติ | `canApproveLab()` | `APPROVED` |
| `PENDING_LAB` | ตีกลับ + เหตุผล | `canApproveLab()` | `REJECTED` |
| `REJECTED` | ส่งใหม่ | ผู้ขอของแผนกนั้น / ADMIN | `PENDING_DEPT` (หรือ `PENDING_LAB` ตามกติกาข้างบน) + `resubmitCount++` |
| `APPROVED` | — | ไม่ย้อนกลับ | — |

> ยกเลิกงานยังใช้สถานะ `10-Cancel` ที่ระดับ item เหมือนเดิม ไม่เพิ่มทางยกเลิกใหม่

### 3.3 กติกาที่ผูกกับส่วนอื่น (**สำคัญ — นี่คือส่วนที่ปิดช่องโหว่ F1**)

1. ใบที่ยังไม่ `APPROVED` → รายการทดสอบในใบ **เดินสถานะเกิน `1-รับใบรีเควส` ไม่ได้**
   (ใส่ใน `changeItemStatus` ที่เดียวกับกติกา "ไม่มีเจ้าของห้ามเกินสถานะ 2")
2. **`assertCanEditRequest()` ต้องเช็คสถานะเพิ่ม:**
   - `PENDING_DEPT` / `REJECTED` → ผู้ขอแก้ได้ (เพิ่ม/ลบรายการทดสอบ, แก้รุ่น Lamp, แก้ข้อมูลใบ)
   - `PENDING_LAB` → ผู้ขอ **แก้ไม่ได้แล้ว** (หัวหน้าแผนกเซ็นไปแล้ว จะแก้ต้องให้ตีกลับก่อน)
   - `APPROVED` → เฉพาะ ADMIN/ENGINEER แก้ได้ (แลปรับงานแล้ว เป็นของแลป)
   - **แนบไฟล์ยกเว้น** — แนบได้ทุกสถานะ (หัวหน้าอาจขอเอกสารเพิ่มก่อนเซ็น) ลบยังเป็น ADMIN/ENGINEER
3. `/planning` แสดงเฉพาะใบ `APPROVED`
4. `/board` ไม่แสดงใบที่ยังไม่ `APPROVED` (บอร์ด = งานที่รับแล้ว)
5. Dashboard / analytics / CSV นับเฉพาะ `APPROVED` — ใบรออนุมัติมีกล่องของตัวเอง

---

## ส่วนที่ 4 — โครงสร้างข้อมูล

> ⚠️ **ห้ามเอาสถานะอนุมัติไปแทรกในสถานะ 1–8** — 1–8 เป็นของ *รายการทดสอบ* และมีกติกาบังคับกรอกผูกอยู่หลายจุด
> การแทรกกลางลำดับจะพัง rollup / analytics / CSV / QR ทั้งชุด · สถานะอนุมัติอยู่ที่ **ระดับใบ** และเป็น **คนละแกน**

```prisma
enum ApprovalStatus {
  PENDING_DEPT   // รออนุมัติ — หัวหน้าแผนกผู้ขอ
  PENDING_LAB    // รออนุมัติ — หัวหน้าแลป
  APPROVED       // อนุมัติแล้ว → เข้าคิววางแผนได้
  REJECTED       // ถูกตีกลับ — รอผู้ขอแก้แล้วส่งใหม่
}

model TestRequest {
  // ...ของเดิมทั้งหมด ไม่แตะ...

  // default = APPROVED สำคัญมาก: ใบเก่าในระบบผ่านทันทีตอน migrate ไม่ต้องเขียนสคริปต์ backfill
  approvalStatus ApprovalStatus @default(APPROVED) @map("approval_status")
  submittedAt    DateTime?      @map("submitted_at")   // ส่งเข้าอนุมัติรอบล่าสุด (ใช้นับวันค้าง)
  resubmitCount  Int            @default(0) @map("resubmit_count")

  deptApprovedBy   User?     @relation("DeptApprover", fields: [deptApprovedById], references: [id])
  deptApprovedById Int?      @map("dept_approved_by_id")
  deptApprovedAt   DateTime? @map("dept_approved_at")

  labApprovedBy   User?     @relation("LabApprover", fields: [labApprovedById], references: [id])
  labApprovedById Int?      @map("lab_approved_by_id")
  labApprovedAt   DateTime? @map("lab_approved_at")

  rejectedStage String?   @map("rejected_stage")  // DEPT | LAB
  rejectedBy    User?     @relation("Rejecter", fields: [rejectedById], references: [id])
  rejectedById  Int?      @map("rejected_by_id")
  rejectedAt    DateTime? @map("rejected_at")
  rejectReason  String?   @map("reject_reason")

  approvalLogs ApprovalLog[]

  @@index([approvalStatus])
}

/** ประวัติการเซ็นทุกครั้ง — ห้ามลบ ใช้ตอบว่า "ใครเซ็น เมื่อไหร่ ตีกลับเพราะอะไร" */
model ApprovalLog {
  id      Int         @id @default(autoincrement())
  regisNo String      @map("regis_no")
  request TestRequest @relation(fields: [regisNo], references: [regisNo], onDelete: Cascade)
  stage   String      // DEPT | LAB
  action  String      // SUBMIT | APPROVE | REJECT | AUTO_APPROVE | OVERRIDE
  byId    Int?        @map("by_id")
  by      User?       @relation(fields: [byId], references: [id])
  reason  String?
  at      DateTime    @default(now())

  @@index([regisNo])
  @@map("approval_logs")
}

/** ค่าตั้งค่าที่แก้ได้ตอนรัน (ตอนนี้ทั้งระบบยังไม่มีตารางนี้ — LINE ใช้ .env ล้วน) */
model AppSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("app_settings")
}
```

**key ที่ใช้รอบนี้:** `approval.deptStage` = `"on"` / `"off"` (ค่าเริ่มต้นถ้าไม่มีแถว = `"on"`)
ปิดเมื่อไหร่ → ใบใหม่ข้ามไป `PENDING_LAB` · ใบที่ค้าง `PENDING_DEPT` อยู่ให้เลื่อนขึ้นชั้น 2 อัตโนมัติ

**`User` เพิ่มความสัมพันธ์ย้อนกลับ:**
```prisma
model User {
  // ...ของเดิม...
  deptApprovedRequests TestRequest[] @relation("DeptApprover")
  labApprovedRequests  TestRequest[] @relation("LabApprover")
  rejectedRequests     TestRequest[] @relation("Rejecter")
  approvalLogs         ApprovalLog[]
}
```

---

## ส่วนที่ 5 — ตาราง route เป้าหมาย (หลังทำเสร็จ)

| Route | ADMIN | LAB_HEAD | ENGINEER | DEPT_HEAD | REQUESTER | VIEWER | ไม่ล็อกอิน |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `/login` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/` | ✅ | ✅ | ✅ | ✅ แผนก | ✅ แผนก | ✅ | ❌ |
| `/scan` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/requests` | ✅ | ✅ | ✅ | ✅ แผนก | ✅ แผนก | ✅ | ❌ |
| `/requests/[regis]` | ✅ | ✅ | ✅ | ✅ แผนก | ✅ แผนก | ✅ | ❌ |
| `/items/[code]` | ✅ | ✅ | ✅ | ✅ แผนก | ✅ แผนก | ✅ | ❌ |
| `/requests/new` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/board` | ✅ | ✅ | ✅ | ✅ แผนก | ✅ แผนก | ✅ | ❌ |
| `/schedule` | ✅ | ✅ | ✅ | ✅ แผนก | ✅ แผนก | ✅ | ❌ |
| `/notifications` | ✅ | ✅ | ✅ | ✅ แผนก | ✅ แผนก | ✅ | ❌ |
| **`/approvals`** 🆕 | ✅ | ✅ | ❌ | ✅ แผนก | ❌ | ❌ | ❌ |
| `/analytics` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/reports` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/labels` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/planning` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/master` `/admin` `/settings` `/settings/*` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **`/settings/approvals`** 🆕 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/search` | ✅ | ✅ | ✅ | ✅ แผนก | ✅ แผนก | ✅ | ❌ 401 |
| `/api/export` | ✅ | ✅ | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 401 |
| `/api/attachments/[id]` | ✅ | ✅ | ✅ | ✅ แผนก | ✅ แผนก | ✅ | ❌ 401 |

"แผนก" = เห็นเฉพาะงานของแผนกตัวเอง · ใบของแผนกอื่นตอบ 404 (ไม่บอกว่ามีอยู่)

---

## ส่วนที่ 6 — รายการงานสำหรับคนเขียนโค้ด

### เฟส 4a — โครงสร้างข้อมูล (ไม่กระทบการใช้งานเดิมเลย)

1. **สำรองข้อมูลก่อน:** `cd webapp && npm run backup`
2. **หยุด dev server ก่อน migrate** (มัน lock `dev.db`)
3. `webapp/prisma/schema.prisma` — เพิ่ม `LAB_HEAD` + `DEPT_HEAD` ใน enum `UserRole`,
   enum `ApprovalStatus`, ฟิลด์ใน `TestRequest`, model `ApprovalLog`, model `AppSetting`, relation ย้อนกลับใน `User`
4. สร้าง migration (Prisma 7 ที่นี่รัน `migrate dev` ไม่ได้ — non-interactive):
   ```bash
   TS=$(date +%Y%m%d%H%M%S); DIR="prisma/migrations/${TS}_approval_flow"; mkdir -p "$DIR"
   npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema ./prisma/schema.prisma --script > "$DIR/migration.sql"
   npx prisma migrate deploy && npx prisma generate
   ```
5. **ตรวจ `migration.sql` ด้วยตาก่อน deploy** — ต้องเป็น `CREATE TABLE` / `ALTER TABLE ADD COLUMN` เท่านั้น
   ถ้าเห็น `DROP` หรือ redefine ตาราง `test_requests` ให้หยุดแล้วดูใหม่ (ข้อมูลจริงอยู่ในนั้น)

### เฟส 4b — สิทธิ์ (แก้ F2 + F3 · ยังไม่มี flow อนุมัติ)

6. `webapp/src/lib/roles.ts` — เขียนฟังก์ชันตามส่วนที่ 2.3 · เพิ่ม `ROLE_LABEL` ของ 2 role ใหม่
   (`LAB_HEAD` = "หัวหน้าแผนกทดสอบ", `DEPT_HEAD` = "หัวหน้าแผนก")
7. ไล่แก้ทุกจุดที่เรียก `canPlanAndManage` (7 จุด) ให้เป็น `canPlanWork` หรือ `canManageSystem` ตามความหมาย
8. ไล่แก้ `canEditTests` 8 จุด — จุดที่แปลว่า "ทีมแลป เห็นได้ทุกแผนก" เปลี่ยนเป็น `canViewLabWide`
   (`analytics` · `reports` · `labels` · `api/export` · `guard.ts: guardPageTeam`)
9. `webapp/src/lib/guard.ts` — `guardPageTeam` ใช้ `canViewLabWide`, เพิ่ม `guardPagePlan` (canPlanWork), `guardPageApprove`
10. `webapp/src/app/settings/users/` — รองรับ 2 role ใหม่ (DEPT_HEAD บังคับเลือกแผนก เหมือน REQUESTER)
11. **ตรวจก่อนไปต่อ:** สร้างผู้ใช้ทดสอบทั้ง 6 role แล้วไล่เปิดทุก route ตามตารางส่วนที่ 5

### เฟส 4c — flow อนุมัติ (หัวใจ)

12. `webapp/src/lib/approval.ts` (ไฟล์ใหม่) — logic ล้วน ไม่แตะ DB:
    - `initialApprovalStatus({ creatorRole, deptStageOn, deptHasHead })`
    - `nextStatusOnApprove(current)` / `stageOf(current)`
    - `canActOn(status, user, requestDeptId)` → `{ canApprove, canReject, canResubmit, canEdit }`
    - `APPROVAL_LABEL` / `APPROVAL_COLOR` (ต้อง client-safe เหมือน `workflow.ts`)
13. `webapp/src/app/actions.ts`:
    - `createRequest` — กำหนด `approvalStatus` เริ่มต้น + เขียน `ApprovalLog` (`SUBMIT` หรือ `AUTO_APPROVE`)
    - **`assertCanEditRequest` — เพิ่มเงื่อนไขสถานะตามข้อ 3.3.2 (ปิด F1)**
    - `changeItemStatus` — บล็อกถ้าใบยังไม่ `APPROVED` (ข้อความบอกว่ารออนุมัติจากใคร)
    - `markNotificationRead` / `markAllNotificationsRead` — จำกัดตามแผนก (ปิด F4)
    - **ใหม่:** `approveRequest(regisNo)` · `rejectRequest(regisNo, formData)` (บังคับเหตุผล) · `resubmitRequest(regisNo)`
      ทุกตัวต้อง: เช็คสิทธิ์ฝั่ง server → เช็คว่าสถานะปัจจุบันทำได้จริง → อัปเดต → เขียน `ApprovalLog` → `revalidatePath`
14. `webapp/src/app/approvals/page.tsx` (ใหม่) — คิวใบที่ *ตัวเองต้องเซ็น* เรียงค้างนานสุดขึ้นก่อน
    + อนุมัติ/ตีกลับได้จากในลิสต์ + แสดง "ค้างมา N วัน"
15. `webapp/src/components/ApprovalPanel.tsx` (ใหม่) — แถบบนหน้าใบ: สถานะปัจจุบัน · ใครเซ็นแล้ว · เหตุผลที่ตีกลับ · ปุ่มตามสิทธิ์ · ไทม์ไลน์จาก `ApprovalLog`
16. `webapp/src/app/requests/[regis_no]/page.tsx` — ใส่ `ApprovalPanel` ไว้บนสุด + ซ่อนฟอร์มแก้ไขตามสถานะ

### เฟส 4d — ทำให้ภาพไม่สับสน

17. `webapp/src/app/page.tsx` + `webapp/src/components/home/` — **กล่อง "รออนุมัติ" แยกต่างหาก**
    (ไม่ปนกับการ์ดงานปกติตามที่ผู้ใช้ขอ) · requester เห็นใบตัวเองที่ค้าง · แลปเห็นใบที่ยังไม่ถึงมือ · ผู้อนุมัติเห็นตัวเลขที่ต้องเซ็น
18. `webapp/src/app/planning/page.tsx` — กรอง `approvalStatus: "APPROVED"`
19. `webapp/src/app/board/page.tsx` — กรองใบที่ยังไม่อนุมัติออก
20. `webapp/src/app/requests/page.tsx` — เพิ่มตัวกรองสถานะอนุมัติ + ป้ายสีบนแถว
21. `NavBar` / `BottomNav` / `CommandPalette` — เมนู "รออนุมัติ" + ตัวเลขค้าง (เฉพาะคนที่เซ็นได้)
22. `webapp/src/app/settings/approvals/page.tsx` (ใหม่) — สวิตช์เปิด/ปิดชั้นหัวหน้าแผนก + รายชื่อผู้อนุมัติทั้งหมด
    + **เตือนถ้าแผนกไหนยังไม่มีหัวหน้า**

### เฟส 4e — แจ้งเตือน

23. `webapp/src/lib/notifications.ts` — เพิ่ม 5 เหตุการณ์:

| เหตุการณ์ | เตือนใคร |
|---|---|
| ส่งใบใหม่ / ส่งใหม่หลังแก้ | หัวหน้าแผนกนั้น (หรือหัวหน้าแลป ถ้าชั้นแผนกปิด) |
| หัวหน้าแผนกอนุมัติ | หัวหน้าแลปทุกคน |
| หัวหน้าแลปอนุมัติ | ผู้ขอ + คนที่วางแผนงาน |
| ตีกลับ | ผู้ขอ (พร้อมเหตุผล) |
| **ค้างรออนุมัติเกิน N วัน** | ผู้อนุมัติที่ค้าง + admin — เตือนซ้ำรายวัน |

> ตัวสุดท้ายห้ามข้าม — 2 ชั้นแปลว่างานจะช้าลงถ้ามีคนลืมเซ็น ถ้าไม่มีตัวจี้ ระบบนี้จะกลายเป็นคอขวดแทน

---

## ส่วนที่ 7 — ตรวจงานก่อนปิด

**ข้อมูลจริงอยู่ใน `webapp/dev.db` — ห้ามทิ้งข้อมูลทดสอบไว้ ห้ามแก้แถวจริง**
สร้างผู้ใช้/ใบทดสอบได้ แต่ต้องลบให้หมดและตรวจว่าจำนวนแถวกลับเท่าเดิม

- [ ] `npx tsc --noEmit` และ `npm run lint` ผ่าน
- [ ] `npm run build` ผ่าน
- [ ] ผู้ใช้ครบ 6 role เปิดทุก route ตามตารางส่วนที่ 5 ได้ผลตรง (รวม 404 ของแผนกอื่น)
- [ ] requester ลงใบใหม่ → ขึ้น `PENDING_DEPT` และ **ไม่โผล่ใน `/planning` `/board`**
- [ ] **หัวหน้าแผนกอนุมัติ → ผู้ขอเพิ่มรายการทดสอบไม่ได้แล้ว** (นี่คือข้อพิสูจน์ว่า F1 ปิดจริง)
- [ ] หัวหน้าแลปอนุมัติ → ใบเข้า `/planning`
- [ ] ตีกลับโดยไม่กรอกเหตุผล → ต้องไม่ผ่าน
- [ ] ตีกลับจากชั้น 2 → ส่งใหม่แล้วกลับไปเริ่มชั้น 1
- [ ] ปิดสวิตช์ชั้นแผนก → ใบใหม่ไป `PENDING_LAB` เลย และใบที่ค้างชั้น 1 เลื่อนขึ้น
- [ ] admin กดอนุมัติแทนได้ และมีบันทึกใน `ApprovalLog`
- [ ] ใบเก่าที่มีอยู่ยังเป็น `APPROVED` และทำงานได้ปกติทุกอย่าง
- [ ] ลบข้อมูลทดสอบหมด + จำนวนแถวกลับเท่าเดิม

---

## ส่วนที่ 8 — ความเสี่ยง

| ความเสี่ยง | ทางแก้ที่อยู่ในแผนแล้ว |
|---|---|
| งานด่วนค้างเพราะไม่มีคนเซ็น | ตั้งผู้อนุมัติได้หลายคน + เตือนซ้ำรายวัน + admin กดแทนได้ |
| ชั้นหัวหน้าแผนกใช้ไม่เวิร์ก อยากถอด | เป็นสวิตช์ตั้งแต่แรก ปิดได้ไม่ต้องแก้โค้ด |
| **หลัง migrate ยังไม่มีใครเป็นหัวหน้า → ใบใหม่ค้างทันที** | ระบบข้ามไปชั้น 2 ให้อัตโนมัติถ้าแผนกไม่มีหัวหน้า + แบนเนอร์เตือน admin |
| คนใช้งงว่าใบอยู่ไหน | แถบสถานะบนหน้าใบ + กล่องแยกหน้าแรก + ไทม์ไลน์ว่าใครเซ็นเมื่อไหร่ |
| ใบถูกตีกลับแล้วเงียบหาย | นับ `resubmitCount` + รายงานใบ `REJECTED` ที่ค้างนานให้ admin |
| migration ทำข้อมูลจริงพัง | `npm run backup` ก่อน + ตรวจ `migration.sql` ด้วยตาว่าเป็น additive ล้วน |

---

## ภาคผนวก — งานที่ทำเสร็จแล้ว (commit `a501582`)

รอบก่อนหน้าปิดช่องโหว่ที่ต้องปิดก่อน deploy ไปแล้ว:
- `webapp/src/proxy.ts` — ตาข่ายกันสิทธิ์ชั้นนอก (Next 16 เปลี่ยนชื่อจาก `middleware.ts` → `proxy.ts`)
- ทุกหน้าต้องล็อกอิน เหลือ `/login` หน้าเดียวที่เปิด (ยิงทดสอบ 18 route แล้วเด้ง `/login` ครบ)
- ปิดรู `/api/export` · `/api/attachments/[id]` · `/api/search` (เดิมเปิดโล่ง ใครมี URL ก็โหลดข้อมูลทั้งปี/ไฟล์แนบทุกใบได้)
- `npm run backup` — สแนปช็อต DB (`VACUUM INTO`) + `uploads/` + เก็บย้อนหลังตามจำนวนที่ตั้ง
- guard รวมเป็นชุดเดียว (`guardPageUser` / `guardPageTeam` / `guardPageAdmin`)

**ยังค้าง:** การล็อก 100% แปลว่า **คนที่สแกน QR ต้องมี account** — ยังไม่ได้สร้างบัญชีให้คนกลุ่มนี้ (ใช้ role `VIEWER`)
