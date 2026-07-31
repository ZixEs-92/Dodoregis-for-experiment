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
  - เริ่มรัน: `cd webapp && npm run dev` · คู่มือ/โครงสร้าง: `docs/โครงสร้างโปรเจค-webapp.md` · README: `webapp/README.md`
  - **GitHub (repo เดียวทั้งโปรเจค):** https://github.com/ZixEs-92/Dodoregis-for-experiment (branch main) · `.env`/`dev.db`/`uploads/` ไม่ขึ้น git
  - สไลด์นำเสนอผู้บริหาร: `docs/Dodoregis-นำเสนอผู้บริหาร.pptx`
- **Phase 3 (auth + requester portal) — ✅ เสร็จครบ:** login/session + role guards ฝั่ง server ทุก action + ซ่อน UI ตาม role · จัดการผู้ใช้ `/settings/users` (admin) · requester portal (ownerId nullable, แผนกล็อกฝั่ง server, เห็นเฉพาะแผนกตัวเอง) · คิวรอวางแผน `/planning` (admin มอบหมาย + ลงวันที่ · item ไม่มีเจ้าของเดินหน้าเกินสถานะ 2 ไม่ได้) · **หน้าแรก = หน้า login** (ประตูทางเข้า: สแกน QR/ดูรายการงานได้ไม่ต้องล็อกอิน) → อ้างอิง `docs/แผน-auth-user-แผนกเพิ่มงานเอง.md`
- ขั้นถัดไปอื่น (backlog): เปิด groundwork equipment/test method, ตั้ง cron แจ้งเตือนจริง, deploy/เข้าถึงมือถือ (ดูเอกสารแผนใน `docs/`) — รวมทั้งหมดใน `docs/โครงสร้างโปรเจค-webapp.md`

## Data Model (สรุป — ฉบับเต็มดู docs/data-model.md)
4 ตาราง เชื่อมด้วย `regis_no` รูปแบบ `TR-YYMM-###` (เช่น TR-2607-015):
1. **test_requests** — 1 แถวต่อ 1 งาน: แผนกที่รีเควส, ผู้รีเควส, วันที่ได้ใบรีเควส, ชื่อชิ้นงาน/รุ่น Lamp, part no., จำนวนพาร์ท, วันที่รับพาร์ท, ตำแหน่งเก็บพาร์ท, รายละเอียดเทส/มาตรฐาน, plan เริ่ม/plan จบ, เริ่มจริง/จบจริง, สถานะ, ผู้รับผิดชอบหลัก, ที่เก็บชิ้นงานหลังเสร็จ, remark, ลิงก์โฟลเดอร์งาน
2. **test_runs** — 1 แถวต่อการเทส 1 ครั้ง (รองรับ retest): regis_no, ครั้งที่, วันเริ่ม/จบ, ผู้รับผิดชอบ loading, ผู้รับผิดชอบเทส, ผลเทส (Pass/Fail/Conditional Pass), ลิงก์ raw data, remark
3. **reports** — regis_no, สถานะรีพอร์ท, วันที่ส่ง, ที่อยู่ไฟล์, ลิงก์, ผู้จัดทำ, ผู้อนุมัติ
4. **master_data** — แผนก, รายชื่อทีม, ตำแหน่งจัดเก็บ, ค่าสถานะต่างๆ

## สถานะงาน (workflow — ห้ามเปลี่ยนชื่อโดยไม่อัปเดตทุกที่)
`1-รับใบรีเควส → 2-รอรับพาร์ท → 3-รับพาร์ทแล้ว/รอคิวเทส → 4-กำลังเทส → 5-เทสเสร็จ → 6-กำลังทำรีพอร์ท → 7-ส่งรีพอร์ทแล้ว → 8-ปิดงาน` (+ `9-Hold`, `10-Cancel` ได้ทุกจุด)

กติกาบังคับกรอก: เข้าสถานะ 3 ต้องมีวันที่รับพาร์ท+ตำแหน่งเก็บ | เข้า 7 ต้องมีวันที่ส่ง+ลิงก์รีพอร์ท | เข้า 8 ต้องมีที่เก็บชิ้นงาน+ที่เก็บ raw data

## การจัดเก็บไฟล์ (ห้ามเก็บไฟล์ใน database — เก็บลิงก์เท่านั้น)
โฟลเดอร์กลาง (Google Drive): `TestLab/ปี/TR-YYMM-###_รุ่น/` แบ่งเป็น `01_Request` (ใบรีเควส+email), `02_Photos`, `03_RawData/Run1..N`, `04_Report/Draft|Final`
- ไฟล์เล็ก (รูป, PDF) อัปโหลดเข้าระบบได้ / raw data ใหญ่เก็บโฟลเดอร์กลาง ใส่ลิงก์
- ทุกไฟล์ตั้งชื่อขึ้นต้นด้วย regis_no

## QR
1 งาน = 1 QR เป็นลิงก์เปิดหน้ารายละเอียดงานนั้นโดยตรง พิมพ์ label ~50×25 มม. (QR + regis_no + รุ่น) ติดชิ้นงาน/กล่อง/จุดจัดเก็บ

## กติกาสำคัญ
- ห้ามลบ record — ใช้สถานะ 10-Cancel
- Remark "make รีพอร์ตเลย" = งานด่วน ให้ flag สีแดงบน dashboard
- UI/ข้อความเป็นภาษาไทย, code/ชื่อตัวแปรเป็นอังกฤษ
