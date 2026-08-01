# Dodoregis — ระบบลงทะเบียนและติดตามงานทดสอบ (Test Request Registration & Tracking)

ไฟล์นี้คือ context หลักของโปรเจค อ่านก่อนทำงานทุกครั้ง

## เป้าหมาย
ระบบลง regis งานทดสอบสำหรับทีมวิศวกรทดสอบ 1–10 คน ติดตามงานตั้งแต่รับใบรีเควสจนส่งรีพอร์ท
ใช้ได้ทั้งคอมและมือถือ มี QR ติดชิ้นงาน (Lamp) สแกนแล้วเห็นรายละเอียดงาน สถานะ ที่เก็บชิ้นงาน และที่เก็บ raw data

## สถานะปัจจุบันของโปรเจค
- แผนโปรเจคฉบับเต็ม: `docs/แผนโปรเจค_ระบบลงทะเบียนติดตามงานทดสอบ.docx`
- Data model ละเอียด: `docs/data-model.md` (อัปเดตเป็นโครงสร้าง multi-item + logs/notifications แล้ว)
- Phase 1 (Google Sheets + AppSheet) มี template พร้อมใช้แล้ว: `template/` (xlsx + Apps Script)
- **Phase 2: Web app พัฒนาแล้ว** ที่ `webapp/` (Next.js 16 + SQLite/Prisma 7 + Tailwind) — ครบ: โมเดล 2 ชั้น (ใบมีสถานะรวม rollup + item มีสถานะเอง), หน้า item แบบแท็บ, QR ระดับใบ **+ ระดับ item**, ชื่อการทดสอบ (testName), multi-item, master data, ไฟล์แนบ, audit/location logs, TAT/SLA, แจ้งเตือน (in-app + webhook/LINE + หน้า `/settings/line`), `/schedule` (ตารางงานสัปดาห์), `/analytics` (คอขวด/CFD/aging), `/reports` + `/api/export` (CSV รายปี/เดือน), **auth (login/session + role guards ฝั่ง server ทุก action, viewer ดูอย่างเดียวไม่ต้องล็อกอิน)**, **หน้าสแกน QR ในแอป `/scan`**
  - **UX รอบใหญ่ (ส.ค. 2026):** หน้าแรกแยกตามบทบาท, แผงเปลี่ยนสถานะแบบปุ่มหลัก+dropdown, toast/กล่องยืนยันในแอป, แถบเมนูล่างมือถือ, `/settings` รวมตั้งค่า, **บอร์ดคัมบัง `/board`**, **คำสั่งด่วน Ctrl+K**, ชุดไอคอน SVG, PWA
  - เริ่มรัน: `cd webapp && npm run dev` · คู่มือ/โครงสร้าง: `docs/โครงสร้างโปรเจค-webapp.md` · README: `webapp/README.md`
  - **GitHub (repo เดียวทั้งโปรเจค):** https://github.com/ZixEs-92/Dodoregis-for-experiment (branch main) · `.env`/`dev.db`/`uploads/` ไม่ขึ้น git
  - สไลด์นำเสนอผู้บริหาร: `docs/Dodoregis-นำเสนอผู้บริหาร.pptx`
- **Phase 3 (auth + requester portal) — ✅ เสร็จครบ:** login/session + role guards ฝั่ง server ทุก action + ซ่อน UI ตาม role · จัดการผู้ใช้ `/settings/users` (admin) · requester portal (ownerId nullable, แผนกล็อกฝั่ง server, เห็นเฉพาะแผนกตัวเอง) · คิวรอวางแผน `/planning` (admin มอบหมาย + ลงวันที่ · item ไม่มีเจ้าของเดินหน้าเกินสถานะ 2 ไม่ได้) · **หน้าแรก = หน้า login** (ประตูทางเข้า: สแกน QR/ดูรายการงานได้ไม่ต้องล็อกอิน) → อ้างอิง `docs/แผน-auth-user-แผนกเพิ่มงานเอง.md`
- **รอบ UX + โครงสร้างข้อมูล (ส.ค. 2026):** หน้าแรกแยกตามบทบาท · แถบเมนูเหลือ 4 อัน (เครื่องมือ admin รวมที่ `/admin`) · ตารางงานเป็นปฏิทินรายเดือน กดเจาะรายสัปดาห์ · บอร์ดงานแนวตั้ง `/board` · คำสั่งด่วน Ctrl+K · toast/กล่องยืนยันในแอป · ชิ้นงานย้ายไปอยู่ระดับใบ (หลายรุ่น) แล้วรายการทดสอบติ๊กเลือกรุ่น · **CSV ส่งออก 8 แบบ (detail 51 คอลัมน์)**
- ขั้นถัดไปอื่น (backlog): **สำรอง dev.db อัตโนมัติ** (ยังไม่มี — เสี่ยงสุด), เปิด groundwork equipment/test method, ตั้ง cron แจ้งเตือนจริง, deploy จริง (Cloudflare Tunnel + โดเมนบริษัท) — รวมทั้งหมดใน `docs/โครงสร้างโปรเจค-webapp.md`

## Data Model (สรุป — ฉบับเต็มดู `webapp/prisma/schema.prisma`)
เลขงาน `TR-YYMM-###` (ใบ) · `TR-YYMM-###-NN` (รายการทดสอบ) — **โครงสร้าง 3 ชั้น:**

```
test_requests (ใบรีเควส)   ใครขอ (ชื่อ/อีเมล/เบอร์) · วันที่รับใบ · test_object (ส่งอะไรมา) · purpose (ทำไม) · แผนก · created_by
   ├─ request_parts        ชิ้นงาน/รุ่น Lamp ที่ส่งมา — 1 ใบมีได้หลายรุ่น (ชื่อรุ่น · part_no · จำนวน)
   └─ test_items           รายการทดสอบ — 1 ใบมีได้หลายรายการ · แต่ละรายการมี สถานะ/แผน/ผู้รับผิดชอบ/รีพอร์ท/QR ของตัวเอง
         ↕ (หลาย-ต่อ-หลาย) เลือกว่าทดสอบรุ่นไหนบ้าง — part_name/part_no/qty ใน item เป็น cache ที่สรุปจากรุ่นที่เลือก
         ├─ test_runs      1 แถวต่อการเทส 1 ครั้ง (รองรับ retest): วันเริ่ม/จบ · ผู้ loading · ผู้เทส · ผล (Pass/Fail/Conditional) · ลิงก์ raw data
         ├─ reports        สถานะรีพอร์ท · วันที่ส่ง · ที่อยู่ไฟล์ · ลิงก์ · ผู้จัดทำ · ผู้อนุมัติ
         ├─ status_logs / location_logs   audit trail (changed_by มาจาก session)
         └─ notifications  แจ้งเตือนงานเลย/ใกล้กำหนด/เปลี่ยนสถานะ/ใบใหม่เข้าคิว
```

**master data:** `Department` (มี sla_days) · `Member` (รายชื่อทีม) · `PartLocation` · `FinishedLocation`
**ผู้ใช้:** `users` (username/bcrypt · role ADMIN/ENGINEER/REQUESTER/VIEWER · ผูก department สำหรับ requester, member สำหรับ engineer)
**groundwork ยังไม่ wire UI:** `equipment` · `test_methods`
**ไฟล์แนบ:** `attachments` เก็บ metadata — ไฟล์จริงอยู่ที่ `webapp/uploads/`, raw data ก้อนใหญ่เก็บเป็นลิงก์/พาธเท่านั้น

## สถานะงาน (workflow — ห้ามเปลี่ยนชื่อโดยไม่อัปเดตทุกที่)
`1-รับใบรีเควส → 2-รอรับพาร์ท → 3-รับพาร์ทแล้ว/รอคิวเทส → 4-กำลังเทส → 5-เทสเสร็จ → 6-กำลังทำรีพอร์ท → 7-ส่งรีพอร์ทแล้ว → 8-ปิดงาน` (+ `9-Hold`, `10-Cancel` ได้ทุกจุด)

กติกาบังคับกรอก: เข้าสถานะ 3 ต้องมีวันที่รับพาร์ท+ตำแหน่งเก็บ | เข้า 7 ต้องมีวันที่ส่ง+ลิงก์รีพอร์ท | เข้า 8 ต้องมีที่เก็บชิ้นงาน+ที่เก็บ raw data

## การจัดเก็บไฟล์ (ห้ามเก็บไฟล์ใน database — เก็บลิงก์เท่านั้น)
โฟลเดอร์กลาง (Google Drive): `TestLab/ปี/TR-YYMM-###_รุ่น/` แบ่งเป็น `01_Request` (ใบรีเควส+email), `02_Photos`, `03_RawData/Run1..N`, `04_Report/Draft|Final`
- ไฟล์เล็ก (รูป, PDF) อัปโหลดเข้าระบบได้ / raw data ใหญ่เก็บโฟลเดอร์กลาง ใส่ลิงก์
- ทุกไฟล์ตั้งชื่อขึ้นต้นด้วย regis_no

## QR
1 งาน = 1 QR (มีทั้งระดับใบและระดับ item) พิมพ์ label ~50×25 มม. (QR + regis_no + รุ่น) ติดชิ้นงาน/กล่อง/จุดจัดเก็บ
**ค่าเริ่มต้น `QR_MODE=code`: QR เก็บ "รหัสงาน" ล้วน (เช่น `TR-2607-001-01`) ไม่ผูกกับ URL → ย้ายเซิร์ฟเวอร์/เปลี่ยนโดเมนไม่ต้องพิมพ์ label ใหม่** สแกนผ่านหน้า `/scan` ในแอป (อ่านได้ทั้งรหัสล้วนและ URL เต็มของ label เก่า) · ถ้ามีโดเมนถาวรแล้วสลับเป็น `QR_MODE=url` ได้เพื่อให้กล้องมือถือปกติสแกนเปิดได้เลย (ดู `webapp/README.md`)

## กติกาสำคัญ
- ห้ามลบ record — ใช้สถานะ 10-Cancel
- Remark "make รีพอร์ตเลย" = งานด่วน ให้ flag สีแดงบน dashboard
- UI/ข้อความเป็นภาษาไทย, code/ชื่อตัวแปรเป็นอังกฤษ
