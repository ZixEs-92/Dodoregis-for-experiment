# Prompt 01 — สร้าง Web App Prototype

คัดลอกข้อความด้านล่างไปวางใน Claude Code (เปิด CLI ในโฟลเดอร์นี้ก่อน เพื่อให้อ่าน CLAUDE.md ได้):

---

อ่าน CLAUDE.md และ docs/data-model.md แล้วสร้าง web app ระบบ regis งานทดสอบใน `webapp/` ตาม spec:

**Stack:** Next.js (App Router) + SQLite (ผ่าน Prisma) + Tailwind — รันได้ทันทีด้วย `npm run dev` ไม่ต้องพึ่ง service ภายนอก

**หน้าที่ต้องมี:**
1. `/` Dashboard — การ์ดสรุป: งานทั้งหมด, เลยกำหนด plan จบ (สีแดง), ครบกำหนดใน 7 วัน (สีเหลือง), ตารางนับตามสถานะ, workload ต่อคน
2. `/requests` — รายการงานทั้งหมด ค้นหา + filter ตามสถานะ/แผนก/ผู้รับผิดชอบ, แถวงานด่วน (remark มี "make รีพอร์ต") ขึ้นแถบแดง
3. `/requests/new` — ฟอร์มลงงานใหม่ ออกเลข TR-YYMM-### อัตโนมัติ
4. `/requests/[regis_no]` — รายละเอียดงาน: ข้อมูลครบทุกฟิลด์, ตาราง test runs (เพิ่ม run ได้), ส่วนรีพอร์ท, ปุ่มเปลี่ยนสถานะแบบ stepper ตาม workflow พร้อม validation บังคับกรอกตามกติกาใน CLAUDE.md, แสดง QR ของหน้านี้ (ใช้ lib `qrcode`)
5. `/labels?ids=...` — หน้าพิมพ์ QR label 50×25 มม. (CSS @page) เลือกหลายงานพิมพ์ทีเดียว

**ข้อกำหนด:**
- Mobile-first responsive — หน้าหลักใช้บนมือถือสะดวก (ปุ่มใหญ่, ตาราง scroll ได้)
- UI ภาษาไทย, seed ข้อมูลตัวอย่าง 8 งานหลากสถานะ + master data ตาม docs/data-model.md
- ไฟล์แนบเก็บเป็นลิงก์ (url field) ไม่อัปโหลดไฟล์เข้า db
- เขียน README วิธีรันใน webapp/

ทำเสร็จแล้วรัน dev server ทดสอบ แล้วสรุปสั้นๆ ว่าทำอะไรไปบ้าง

---

## Prompt ต่อยอด (ใช้หลังจาก prototype รันได้)
- "เพิ่ม authentication แบบง่าย (รายชื่อทีมจาก master_data + PIN) และเก็บ log ว่าใครเปลี่ยนสถานะเมื่อไหร่ (audit trail)"
- "เพิ่มระบบแจ้งเตือน: สรุปงานเลยกำหนด/ใกล้ครบกำหนดทุกเช้า ส่งเข้า LINE Notify หรือ email"
- "เพิ่มหน้า KPI รายเดือน: lead time เฉลี่ย, % ส่งตรง plan, จำนวน retest พร้อมกราฟ"
- "ย้ายจาก SQLite เป็น Supabase (Postgres + Storage + Auth) เพื่อใช้งานจริงหลายเครื่อง"
