# Prompt 02 — ปรับแต่ง/ต่อยอดระบบ Google Sheets (Phase 1)

ใช้เมื่ออยากแก้ template หรือเพิ่มความสามารถให้ Apps Script (`template/Code.gs`)

---

## แก้ template xlsx
อ่าน CLAUDE.md และ docs/data-model.md แล้วแก้ template/Template_ระบบRegis_งานทดสอบ.xlsx:
- [ระบุสิ่งที่ต้องการ เช่น "เพิ่มคอลัมน์ X ในชีท TestRequests พร้อม dropdown", "เพิ่ม conditional formatting: สถานะ 4-กำลังเทส = เหลือง, 8-ปิดงาน = เขียว, งานเลย plan จบ = แดงทั้งแถว"]
- ห้ามทำสูตร Dashboard เดิมพัง — ตรวจสูตรหลังแก้ทุกครั้ง

## เพิ่มความสามารถ Apps Script
อ่าน template/Code.gs แล้วเพิ่มฟังก์ชัน:
- "แจ้งเตือนอัตโนมัติ: time-driven trigger ทุกเช้า 8:00 สแกน TestRequests หา งานเลย plan จบ + ครบกำหนดใน 3 วัน แล้วส่ง email สรุปถึงผู้รับผิดชอบแต่ละคน"
- "เมื่อเปลี่ยนสถานะเป็น 7-ส่งรีพอร์ทแล้ว (onEdit) ให้ตรวจว่ามีวันที่ส่ง+ลิงก์รีพอร์ทในชีท Reports หรือยัง ถ้าไม่มีให้เด้งเตือนและ revert สถานะ"
- "ฟังก์ชัน export QR label ทั้งหมดของงานที่เลือกเป็น Google Doc ขนาด label 50×25 มม. พร้อมสั่งพิมพ์"
- "เก็บ audit log: ทุกครั้งที่แก้คอลัมน์สถานะ ให้บันทึก ใคร-เมื่อไหร่-จากอะไรเป็นอะไร ลงชีท AuditLog"

## เชื่อม AppSheet
แนะนำขั้นตอนตั้งค่า AppSheet จากชีทนี้ให้เหมาะกับงานหน้า lab:
- view หลัก 3 อัน: งานของฉัน (filter owner = user), งานทั้งหมด (group by สถานะ), สแกน QR
- ให้แก้ได้เฉพาะฟิลด์สถานะ/วันที่/remark จากมือถือ ฟิลด์อื่น read-only
