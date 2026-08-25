# Dodoregis (Google Apps Script) — วิธี deploy frontend

## ก่อนใช้งาน

1. ตั้งค่า backend ให้เสร็จก่อน (ดู `gas-backend/README-deploy.md`) จะได้ลิงก์ `.../exec`
2. เปิดไฟล์ `api.js` แก้บรรทัดแรก:
   ```js
   var API_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
   ```
   ใส่ลิงก์จริงที่ได้จาก backend

## โฮสต์ผ่าน GitHub Pages (แนะนำ — ฟรี, ไม่มี iframe ครอบ)

**ขั้นตอนนี้เป็นการเปิดสิทธิ์ hosting สาธารณะให้ไฟล์ในโฟลเดอร์นี้ — ต้องให้ผู้ใช้กดยืนยันเองก่อนเปิดจริง (ไม่ใช่สิ่งที่ Claude เปิดให้อัตโนมัติ)**

1. เข้า repo บน GitHub → **Settings → Pages**
2. หัวข้อ "Build and deployment" → Source: **Deploy from a branch**
3. Branch: เลือก `main` และโฟลเดอร์ `/gas-frontend` (หรือถ้า GitHub ให้เลือกแค่ `/root`/`/docs` ให้เลือก `/root` แล้วไปตั้งค่า custom path เพิ่ม หรือย้ายไฟล์ไป `/docs/gas-frontend` แทนตามที่ GitHub รองรับ)
4. Save → รอ 1-2 นาที จะได้ลิงก์ประมาณ `https://<username>.github.io/<repo>/gas-frontend/index.html`
5. เปิดลิงก์นั้นทดสอบ (ทั้งเดสก์ทอปและ Safari บน iPhone)

## หรือทดสอบเร็วๆ ก่อนโดยไม่เปิด GitHub Pages

ใช้ CodePen แบบเดียวกับตอน spike (ไม่ต้องตั้งค่าอะไรเพิ่ม) — เปิด https://codepen.io/pen/ วางเนื้อหาแต่ละไฟล์ลง HTML/CSS/JS panel ตามชนิดไฟล์ (ต้องรวมทุกหน้าไว้ในไฟล์เดียวถ้าจะทดสอบผ่าน CodePen ซึ่งไม่สะดวกเท่า GitHub Pages สำหรับหลายหน้า — เหมาะกับทดสอบเร็วๆ หน้าเดียว เช่น `index.html` ก่อนเท่านั้น)

## Golden path ที่ต้องทดสอบให้ครบก่อนใช้งานจริง

1. เปิด `index.html` → login ด้วย `admin` / `admin123`
2. สร้างใบรีเควสใหม่ที่ `requests.html` (ใส่รุ่นอย่างน้อย 1 รุ่น)
3. เปิดใบที่สร้าง (`request.html`) → เพิ่มรายการทดสอบ 1 รายการ
4. เปิดรายการทดสอบ (`item.html`) → ลองเปลี่ยนสถานะไปเรื่อยๆ 1→8 (ลองข้ามสถานะ 3/7/8 โดยไม่กรอกช่องบังคับดูว่า error ขึ้นถูกไหม)
5. เช็คว่า QR code ขึ้นในหน้า item
6. เปิด `scan.html` บนมือถือ สแกน QR ที่ปริ๊นต์/สกรีนช็อตจากข้อ 5 → ต้องพาไปหน้า item ถูกใบ
7. ทำซ้ำข้อ 1-6 บน **Safari บน iPhone จริง** อย่างน้อยหนึ่งรอบ (จุดที่เคยมีปัญหาตอน spike)
