# แผน + วิเคราะห์ความเป็นไปได้: deploy Dodoregis บน Railway (ฟรี)

> อัปเดต 2026-07-14 · อ้างอิงราคา/สเปค Railway ณ กลางปี 2026 (ราคาปรับได้ ตรวจซ้ำก่อนใช้จริง)

## สรุปผู้บริหาร (TL;DR)

- **เทคนิค: ทำได้จริง** ✅ — Railway รองรับ Next.js standalone + SQLite บน persistent volume + cron ครบ
- **"ฟรี" แบบรัน 24/7: ทำไม่ได้จริง** ⚠️ — Railway ยกเลิก free tier ตลอดชีพไปแล้ว เหลือ **Trial $5 ครั้งเดียว (30 วัน)** และ **Free plan $1/เดือน** (ไม่พอรันเว็บตลอดเวลา)
- **ค่าใช้จ่ายจริงที่ควรวางแผน: ~$5/เดือน (Hobby plan)** สำหรับทีม 1–10 คน
- **กับดักใหญ่สุด: ข้อมูลหาย** — ถ้าไม่ตั้ง volume, `dev.db` + ไฟล์อัปโหลดจะถูกล้างทุกครั้งที่ deploy/restart · และ volume ของ Trial จะถูกลบ 30 วันหลังเครดิตหมด

---

## 1. Railway ให้อะไรบ้าง (ฟรี)

| แผน | ได้อะไร | เหมาะกับ |
|---|---|---|
| **Free Trial** | เครดิต **$5 ครั้งเดียว** หมดอายุใน 30 วัน · ไม่ต้องใส่บัตร (ยืนยันผ่าน GitHub) | ลองใช้ / เดโม 2–4 สัปดาห์ |
| **Free plan** (หลัง trial) | เครดิต **$1/เดือน** (ไม่ทบไปเดือนหน้า) · 1 vCPU, 0.5 GB RAM, 1 project | งานเล็กมากที่ไม่รัน 24/7 |
| **Hobby** | **$5/เดือน** รวมเครดิตใช้งาน $5 · ใช้เกินจ่ายตามจริง | ใช้งานจริงเล็ก ๆ ← **แนะนำสำหรับเรา** |

**เหตุผลที่ Free plan ($1/เดือน) รัน Dodoregis ตลอดเวลาไม่ได้:** เว็บเซิร์ฟเวอร์ที่รัน 24/7 ที่ ~0.5 GB RAM กินเครดิตเกิน $1 ภายในไม่กี่วัน พอเครดิตหมด service จะถูกหยุดจนถึงเดือนถัดไป → เว็บล่มเป็นส่วนใหญ่ของเดือน

---

## 2. ความเป็นไปได้ทางเทคนิค (feasibility)

| ประเด็น | สถานะ | หมายเหตุ |
|---|---|---|
| Next.js 16 (standalone) | ✅ | Railway มี guide สำหรับ Next.js โดยตรง |
| Prisma 7 + better-sqlite3 (native) | ✅ (ต้องตั้ง build) | native module ต้อง compile ตอน build — ปกติ Nixpacks ทำได้ อาจต้องระบุ Node เวอร์ชัน |
| SQLite ไฟล์เดียว | ✅ ผ่าน **volume** | mount volume ที่ `/data` แล้วชี้ `dev.db` ไปที่นั่น |
| ไฟล์อัปโหลด (`uploads/`) | ⚠️ ต้องแก้ | ต้องย้ายไป volume ด้วย ไม่งั้นหายทุก deploy |
| Cron `npm run notify` | ✅ | Railway มี cron schedule (หรือทำเป็น service แยกตั้งเวลา) |
| QR code (APP_BASE_URL) | ✅ ต้องตั้ง env | ตั้งเป็นโดเมนสาธารณะของ Railway |
| หลายผู้ใช้พร้อมกัน (1–10 คน) | ✅ | SQLite + WAL รับไหวสบายที่สเกลนี้ |

---

## 3. ข้อจำกัดสำคัญ (limitations)

1. **Filesystem เป็น ephemeral** — เขียนไฟล์นอก volume จะหายทุก deploy/restart · **ต้องใช้ volume** สำหรับ `dev.db` และ `uploads/`
2. **1 service = 1 volume, single replica เท่านั้น** — พอ mount volume แล้ว **scale หลาย instance ไม่ได้** (SQLite เป็น single-writer อยู่แล้ว จึงไม่กระทบที่สเกลนี้ แต่ปิดทางโตแนวนอน)
3. **เขียนไฟล์ตอน build ไม่ลง volume** — migration/สร้าง db ต้องทำตอน **release/start** ไม่ใช่ตอน build
4. **Trial: volume ถูกลบ 30 วันหลังเครดิตหมด** → ต้องอัปเกรดก่อน ไม่งั้น**ข้อมูลหาย**
5. **IOPS cap 3,000 read / 3,000 write** ต่อ volume — เกินพอสำหรับสเกลนี้
6. **volume mount เป็น root** — ถ้า image รันด้วย non-root user ต้องตั้ง permission เพิ่ม
7. **RAM 0.5 GB บน Free** — `next build` อาจตึง (แต่ Railway build แยก environment ช่วยได้บ้าง)
8. **SQLite = single-writer** — เขียนพร้อมกันจะเข้าคิว (fine ที่ 1–10 คน) · ถ้าโตกว่านี้ควรย้ายเป็น Postgres

---

## 4. สิ่งที่ต้องแก้ในโค้ดก่อน deploy

1. **ทำ path อัปโหลดให้ตั้งผ่าน env** — `src/lib/uploads.ts` ตอนนี้ hardcode `process.cwd()/uploads` → เพิ่ม `UPLOAD_DIR` env (ตั้งเป็น `/data/uploads` บน Railway)
2. **DATABASE_URL** → `file:/data/dev.db` (ชี้เข้า volume) — โค้ดอ่านจาก env อยู่แล้ว ✅
3. **start command** ให้รัน migration ก่อนเสมอ: `npx prisma migrate deploy && npm run start` (อย่าใส่ตอน build)
4. **`next.config`** เปิด `output: "standalone"` (ลดขนาด image / RAM)
5. ตั้ง env: `APP_BASE_URL=https://<ชื่อ>.up.railway.app`, `LINE_*` / `NOTIFY_WEBHOOK_URL` (ถ้าใช้)
6. Railway ต้องรู้ว่าโค้ดอยู่โฟลเดอร์ย่อย → ตั้ง **Root Directory = `webapp`**

---

## 5. ขั้นตอน deploy (แผนปฏิบัติ)

**Phase 0 — เตรียมโค้ด (ในเครื่อง)**
- [ ] เพิ่ม `UPLOAD_DIR` env ใน `uploads.ts`
- [ ] เปิด `output: "standalone"` ใน `next.config.ts`
- [ ] เพิ่ม script `start` ที่ migrate ก่อน start
- [ ] ทดสอบ build จริง `npm run build` ผ่าน

**Phase 1 — Railway**
- [ ] สมัคร Railway (เชื่อม GitHub เพื่อ verify) → New Project → Deploy from GitHub repo
- [ ] ตั้ง **Root Directory = `webapp`**
- [ ] เพิ่ม **Volume** mount ที่ `/data`
- [ ] ตั้ง env: `DATABASE_URL=file:/data/dev.db`, `UPLOAD_DIR=/data/uploads`, `APP_BASE_URL=...`, LINE/webhook
- [ ] Deploy → ดู log ให้ migrate deploy สำเร็จ

**Phase 2 — cron แจ้งเตือน**
- [ ] เพิ่ม cron (schedule เช่น `0 1 * * *` = 08:00 ไทย เพราะ Railway ใช้ UTC) รัน `npm run notify`

**Phase 3 — ตรวจรับ**
- [ ] เปิดโดเมน → ลงงานทดสอบ → พิมพ์ QR (เช็ค base URL ถูก) → restart 1 ครั้งดูว่าข้อมูลไม่หาย

---

## 6. ประมาณการค่าใช้จ่าย

| ช่วง | ต้นทุน | หมายเหตุ |
|---|---|---|
| ทดลอง 30 วันแรก | **ฟรี** (เครดิต Trial $5) | พอสำหรับ 1 service เล็ก ~1 เดือน |
| ใช้จริงต่อเนื่อง | **~$5/เดือน (Hobby)** | web service เล็ก + cron + volume เล็ก |
| ถ้าโต/ต้องการเสถียร | $10–20/เดือน | RAM/vCPU มากขึ้น หรือย้าย Postgres |

---

## 7. ทางเลือกอื่น (ถ้าอยากฟรีจริง)

- **Fly.io** — มี free allowance + volume (เหมาะกับ SQLite มาก) แต่ตั้งค่ายากกว่า
- **Render** — free web service **แต่ sleep เมื่อไม่มีคนใช้ + ไม่มี persistent disk บน free** → SQLite ไม่รอด (ต้องจ่ายถึงจะมี disk)
- **รันบนเครื่อง/เซิร์ฟเวอร์ในออฟฟิศเอง (LAN)** — **ฟรีจริง + ข้อมูลอยู่ในองค์กร** เหมาะกับงาน internal lab ที่ไม่ต้องเข้าจากนอกออฟฟิศ (ตอนนี้ก็รันแบบนี้ด้วย `npm run dev` + `APP_BASE_URL` เป็น LAN IP อยู่แล้ว) ← **คุ้มสุดสำหรับ use case นี้**
- **ย้าย DB เป็น Postgres** (Railway/Supabase/Neon free) — ปลดล็อก scale + ไม่ต้องพึ่ง volume แต่ต้องแก้ adapter (Prisma รองรับอยู่แล้ว เปลี่ยน datasource)

---

## 8. คำแนะนำ

1. **Internal lab ใช้ในออฟฟิศ:** รันบนเครื่อง/เซิร์ฟเวอร์ LAN เอง = ฟรีจริง + เร็ว + ข้อมูลไม่ออกนอกองค์กร (แนะนำที่สุด)
2. **ถ้าต้องเข้าจากนอกออฟฟิศ/มือถือข้ามเครือข่าย:** Railway **Hobby $5/เดือน** + volume คุ้มและเสถียรกว่าดิ้นรนกับ free
3. **อยากลองก่อนตัดสินใจ:** ใช้ Trial $5 deploy จริง 2–4 สัปดาห์ แต่ **ห้ามลืม** ว่าข้อมูล volume จะถูกลบหลังเครดิตหมด — อย่าเพิ่งใช้เก็บข้อมูลจริงจนกว่าจะอัปเกรด

---

**Sources:**
- [Railway Pricing Plans (Docs)](https://docs.railway.com/pricing/plans) · [Free Trial (Docs)](https://docs.railway.com/pricing/free-trial)
- [Railway Volumes reference (Docs)](https://docs.railway.com/volumes/reference) · [Deploy Next.js (Railway Guide)](https://docs.railway.com/guides/nextjs)
- [Railway Free Tier 2026 (Kuberns)](https://kuberns.com/blogs/railway-free-tier/)
