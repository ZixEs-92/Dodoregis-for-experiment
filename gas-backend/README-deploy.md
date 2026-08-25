# Dodoregis (Google Apps Script) — วิธี deploy backend

โฟลเดอร์นี้เป็นซอร์สโค้ดของ backend เก็บไว้ใน git เพื่อดูประวัติ/แก้ไขต่อได้ — Apps Script เองไม่รันโค้ดจาก git โดยตรง ต้อง **copy เนื้อหาไปวางใน Apps Script editor** ทีละไฟล์

## ครั้งแรก (สร้างโปรเจกต์ใหม่)

1. เปิด https://script.google.com/home → **New project**
2. ตั้งชื่อโปรเจกต์เป็น เช่น "Dodoregis GAS Backend" (คลิกที่ชื่อ "โครงการไม่มีชื่อ" มุมซ้ายบน)
3. ไฟล์ `Code.gs` ที่มีอยู่แล้ว → ลบโค้ดเดิมทั้งหมด → วางเนื้อหาจาก `Code.gs` ในโฟลเดอร์นี้
4. กด **+** ข้าง "Files" → เลือก **Script** → ตั้งชื่อ `Db` → วางเนื้อหาจาก `Db.gs`
5. ทำซ้ำแบบเดียวกันสำหรับ `Auth`, `Requests`, `Items`, `Runs`, `Reports`, `Setup` (ตั้งชื่อไฟล์ตรงกับชื่อในโฟลเดอร์นี้ ไม่ต้องใส่ `.gs` ตอนตั้งชื่อใน Apps Script)
6. บันทึก (Ctrl+S)

## รัน setup() ครั้งเดียว

1. ที่ toolbar ด้านบน จะมี dropdown เลือกฟังก์ชัน (ข้างปุ่ม "เรียกใช้/Run") → เลือก **setup**
2. กด **Run** → ครั้งแรกจะขึ้นขอ authorize สิทธิ์ (ปกติของ Apps Script ใหม่) → กด Authorize → เลือกบัญชี Google ของคุณ → ถ้าเจอ "Google hasn't verified this app" กด **Advanced** → **Go to (ชื่อโปรเจกต์) (unsafe)** ได้ (เป็นสคริปต์ของคุณเอง)
3. รันเสร็จแล้ว เปิด **View → Logs** (หรือ Ctrl+Enter) จะเห็นลิงก์สเปรดชีตฐานข้อมูลที่สร้างให้ใหม่ + ยืนยันว่าสร้างบัญชี admin เริ่มต้นแล้ว (username: `admin`, password: `admin123`)

## Deploy เป็น Web App

1. กด **Deploy** (มุมขวาบน) → **New deployment**
2. กดไอคอนเฟือง → เลือก **Web app**
3. **Execute as: Me**, **Who has access: Anyone**
4. กด **Deploy** → Authorize ตามปกติ → copy ลิงก์ **`.../exec`** ไว้ (ต้องเอาไปใส่ในไฟล์ `gas-frontend/api.js` ตัวแปร `API_URL`)

## อัปเดตโค้ดภายหลัง

แก้ไฟล์ `.gs` ในเครื่องนี้ก่อน แล้ว copy เนื้อหาไปวางทับในไฟล์เดิมบน Apps Script editor → บันทึก → **Deploy → Manage deployments** → กดไอคอนดินสอที่ deployment เดิม → เลือก version ใหม่ ("New version") → Deploy (ไม่ต้องสร้าง deployment ใหม่ ลิงก์ `.../exec` เดิมยังใช้ได้)

## หมายเหตุความปลอดภัย

- password เก็บเป็น SHA-256+salt (ไม่ใช่ bcrypt แบบระบบเดิม — Apps Script ไม่มี bcrypt ในตัว ยอมรับได้สำหรับ internal tool ทีมเล็ก)
- token ที่ออกให้ผู้ใช้ล็อกอินมีอายุ 8 ชั่วโมง เซ็นด้วย HMAC-SHA256 (secret สุ่มตอนรัน `setup()` เก็บใน Script Properties ไม่หลุดไปไหน)
- Web App ตั้งเป็น "Anyone" เข้าถึงได้ (จำเป็นเพื่อให้ frontend ที่โฮสต์แยกเรียกผ่าน fetch ได้ — ยืนยันแล้วว่าใช้ได้จริงบน Safari iPhone) แต่ทุก action ที่มีผลต่อข้อมูลต้องแนบ token ที่ผ่านการล็อกอินเท่านั้น
