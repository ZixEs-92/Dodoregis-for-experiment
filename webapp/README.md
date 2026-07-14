# Dodoregis Web App

ระบบลงทะเบียนและติดตามงานทดสอบ (Test Request Registration & Tracking) — Prototype

Stack: **Next.js (App Router) + SQLite (Prisma) + Tailwind CSS**. รันได้ทันทีในเครื่อง ไม่ต้องพึ่ง service ภายนอก

## เริ่มต้นใช้งาน

```bash
npm install
npx prisma migrate dev   # สร้างฐานข้อมูล SQLite (dev.db) ตาม schema
npx prisma db seed       # (ทางเลือก) ใส่ master data + งานตัวอย่าง
npm run dev              # เปิด http://localhost:3000
```

ถ้ารันครั้งแรกและเคยตั้ง DB ไว้แล้ว แค่ `npm run dev` พอ

## คำสั่งจัดการข้อมูล

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รัน dev server (ข้อมูลที่กรอกไว้ยังอยู่) |
| `npm run notify` | สแกนงานเลย/ใกล้กำหนด → สร้างแจ้งเตือนในแอป + ส่งออกภายนอก (ตั้ง cron เช้าทุกวัน) |
| `npm run db:clear` | **ลบงานทั้งหมด** (ใบรีเควส/item/runs/report/ไฟล์แนบ/log/แจ้งเตือน) เก็บ master data ไว้ — ใช้เริ่มกรอกของจริง |
| `npx prisma db seed` | ใส่งาน**ตัวอย่าง**กลับเข้าไป (ลบงานเดิมก่อน · master data ถูก upsert) |
| `npx prisma studio` | เปิด GUI ดู/แก้/ลบข้อมูลในตาราง |

> ⚠️ **ข้อมูลที่กรอกในเว็บบันทึกลง `dev.db` จริงและถาวร** — อย่ารัน `npx prisma db seed` หรือ `npx prisma migrate reset` หลังเริ่มกรอกของจริง เพราะจะล้างข้อมูลทิ้ง

📄 โครงสร้างไฟล์ทั้งหมด + คู่มือมาทำต่อ ดูที่ `../docs/โครงสร้างโปรเจค-webapp.md`

## โครงสร้าง: ใบรีเควส → item

1 ใบรีเควส (`TR-YYMM-###`) มีได้หลาย **item** (ชิ้นงานที่ต้องทดสอบ) — แต่ละ item = `TR-YYMM-###-NN`
มี **แผน / สถานะ / test runs / รีพอร์ท แยกกันของตัวเอง** และ QR ของแต่ละ item ต่างหาก

## หน้าที่มีในระบบ

| หน้า | คำอธิบาย |
|---|---|
| `/` | แดชบอร์ด — นับเป็นราย item: งานทั้งหมด / เลยกำหนด (แดง) / ครบกำหนดใน 7 วัน (เหลือง) / นับตามสถานะ / workload ต่อคน + **Loading รายบุคคล** (list งานจริงแยกตามคน สลับ วันนี้/สัปดาห์นี้/ทั้งหมด) |
| `/requests` | รายการงาน สลับมุมมอง **ตามสถานะ / ตามใบรีเควส**, แต่ละส่วน **ย่อ/ขยายได้** (ปุ่มย่อ-ขยายทั้งหมด), ค้นหา + filter ตามสถานะ/แผนก/ผู้รับผิดชอบ, งานด่วนขึ้นแถบแดง, เลือกหลาย item เพื่อพิมพ์ label |
| `/requests/new` | ฟอร์มลงใบรีเควสใหม่ + item แรก ออกเลข `TR-YYMM-###` ให้อัตโนมัติ |
| `/requests/[regis_no]` | ภาพรวมใบรีเควส: ข้อมูลหัวใบ, รายการ item ทั้งหมด, เพิ่ม item, ไฟล์แนบระดับใบรีเควส (email/ใบรีเควส) |
| `/items/[item_code]` | รายละเอียด item ครบ: TAT/SLA, แก้ไขข้อมูล, stepper เปลี่ยนสถานะ (validation), ย้ายที่เก็บ (chain of custody), Test Runs (retest), รีพอร์ท, ไฟล์แนบ, QR, **ประวัติกิจกรรม (audit trail)** |
| `/analytics?range=month\|30d\|all` | วิเคราะห์/KPI — throughput, ส่งตรง plan %, lead time, retest/pass rate, แยกตามแผนก, **คอขวด (เวลาเฉลี่ยในแต่ละสถานะ)**, aging WIP, **CFD 14 วัน** |
| `/notifications` | ศูนย์แจ้งเตือน — งานเลย/ใกล้กำหนด + เปลี่ยนสถานะ (bell ใน NavBar มี badge จำนวนยังไม่อ่าน) |
| `/settings/line` | ตั้งค่า + คู่มือผูก **LINE OA** (Messaging API) + ปุ่ม**ทดสอบส่งจริง** (dry-run ถ้ายังไม่ตั้ง token) |
| `/master` | ตั้งค่า master data — เพิ่ม/แก้ชื่อ/ปิดใช้งาน แผนก·ทีมงาน·ตำแหน่งเก็บ + **เป้า SLA/TAT ต่อแผนก** |
| `/labels?ids=CODE,CODE` | หน้าพิมพ์ QR label 50×25 มม. (ต่อ item · กด "พิมพ์") |
| `/api/attachments/[id]` | เปิด/ดาวน์โหลดไฟล์แนบ (รูป/PDF เปิด inline, ลิงก์ redirect) |

## ไฟล์แนบ (อัปโหลด)

- ไฟล์อัปโหลดเก็บบนดิสก์ที่โฟลเดอร์ `webapp/uploads/` (gitignored) — **เก็บเฉพาะ metadata ใน DB** ตามกติกา
- รองรับรูป/PDF/Word/Excel/email/text ไม่เกิน 15MB · ไฟล์ใหญ่ (raw data) ให้ใช้ "แนบลิงก์" แทน
- เปิดดูผ่านเว็บได้ (`/api/attachments/[id]`) — รูป/PDF แสดง inline

## แจ้งเตือน (ส่งออกภายนอก)

`npm run notify` (ตั้ง cron เช้าทุกวัน) จะสร้างแจ้งเตือนในแอป และส่งออกภายนอกถ้าตั้ง env ไว้ (ดู `.env`):
- `NOTIFY_WEBHOOK_URL` — POST `{text}` เข้ากับ Slack / Discord / Teams / Telegram-bridge
- หรือ `LINE_CHANNEL_ACCESS_TOKEN` + `LINE_TO` — LINE Messaging API (LINE Notify ปิดบริการ เม.ย. 2025 แล้ว)

**ผูก LINE OA:** ทำที่หน้า `/settings/line` — มีคู่มือครบ (สร้าง Messaging API channel → ออก token → หา userId/groupId) + ปุ่มทดสอบส่ง (ยิงจริงถ้าตั้ง token แล้ว หรือ dry-run โชว์ payload ถ้ายัง)

การเปลี่ยนสถานะจะสร้างแจ้งเตือนแบบเรียลไทม์ในแอปเสมอ · bell ใน NavBar แสดงจำนวนที่ยังไม่อ่าน

## ประวัติ / audit trail

ทุกการเปลี่ยนสถานะเก็บใน `status_logs`, การย้ายที่เก็บเก็บใน `location_logs` — แสดงเป็น timeline บนหน้า item และใช้คำนวณคอขวด/aging/CFD ในหน้า `/analytics`

## Data model

ดู `../docs/data-model.md` — ตาราง `test_requests`, `test_items`, `test_runs`, `reports`, `attachments` และ master data (`Department`, `Member`, `PartLocation`, `FinishedLocation` + ฟิลด์ `active`) อยู่ใน `prisma/schema.prisma`

## กติกาบังคับกรอกตามสถานะ (validate ใน `src/lib/workflow.ts`)

- เข้าสถานะ **3-รับพาร์ทแล้ว** ต้องมีวันที่รับพาร์ท + ตำแหน่งเก็บพาร์ท
- เข้าสถานะ **7-ส่งรีพอร์ทแล้ว** ต้องมีรีพอร์ทที่มีวันที่ส่ง + ลิงก์รีพอร์ท
- เข้าสถานะ **8-ปิดงาน** ต้องมีที่เก็บชิ้นงานหลังเสร็จ + ที่เก็บ raw data

## ⚠️ ก่อนพิมพ์ QR label ใช้งานจริง

QR ฝัง URL เต็มของหน้ารายละเอียดงาน — ถ้าพิมพ์ตอนเปิดเว็บผ่าน `localhost` มือถือจะสแกนแล้วเปิดไม่ได้
ให้ตั้ง `APP_BASE_URL` ใน `.env` เป็น URL ที่มือถือเข้าถึงได้ก่อน (เช่น `http://192.168.1.10:3000` — LAN IP ของเครื่องที่รันเว็บ ดูได้จากบรรทัด "Network" ตอน `npm run dev`) แล้ว restart dev server

## หมายเหตุด้านเทคนิค

- ใช้ Next.js 16 + Prisma 7 (`prisma-client` generator แบบ ESM, ต้องใช้ driver adapter — โปรเจคนี้ใช้ `@prisma/adapter-better-sqlite3`)
- ไฟล์แนบทุกชนิดเก็บเป็น **ลิงก์ (url)** เท่านั้น ไม่มีการอัปโหลดไฟล์เข้า database
- QR code สร้างฝั่ง server ด้วย `qrcode` โดยอิงจาก host ของ request (ใช้ได้ทั้งตอนรันบนเครื่อง local และ deploy จริง)
- Mobile-first: ฟอร์ม/การ์ดจัดเรียงเป็นคอลัมน์เดียวบนจอมือถือ, ตารางเลื่อนแนวนอนได้ (`overflow-x-auto`)

## Prisma commands ที่ใช้บ่อย

```bash
npx prisma studio       # เปิด GUI ดู/แก้ข้อมูลในฐานข้อมูล
npx prisma generate     # สร้าง client ใหม่หลังแก้ schema.prisma
npx prisma migrate dev --name <ชื่อ migration>   # สร้าง migration ใหม่
```
