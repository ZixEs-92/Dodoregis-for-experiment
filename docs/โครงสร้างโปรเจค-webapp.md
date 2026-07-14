# โครงสร้างโปรเจค webapp + คู่มือมาทำต่อ

> อัปเดต 2026-07-14 · เขียนไว้เผื่อกลับมาทำต่อ

## สถานะล่าสุด

- ✅ Prototype ครบ + redesign สไตล์ Airtable · โครงสร้าง **multi-item**, **master data** (`/master`), **ไฟล์แนบ**
- ✅ หน้ารายการงานสลับ **ตามสถานะ/ตามใบรีเควส** + ย่อ/ขยายได้ · dashboard มี **Loading รายบุคคล** (วันนี้/สัปดาห์นี้/ทั้งหมด)
- ✅ **audit trail** (`status_logs`) + **chain of custody** (`location_logs`) → timeline บนหน้า item
- ✅ **TAT/SLA** (เป้าต่อแผนกที่ `/master`, แสดง lead time บนหน้า item)
- ✅ **แจ้งเตือน** — ศูนย์ในแอป (`/notifications` + bell) + `npm run notify` ส่งออก webhook/LINE
- ✅ **`/analytics`** — throughput, on-time%, lead time, retest/pass rate, แยกตามแผนก, คอขวด, aging WIP, CFD
- ✅ groundwork ฟีเจอร์ 5-7 (schema พร้อม): equipment, test_methods, requester portal token
- DB จริงอยู่ที่ `webapp/dev.db` · ไฟล์อัปโหลดอยู่ `webapp/uploads/` (ทั้งคู่ไม่ขึ้น git)

## เริ่มรันเพื่อทำต่อ

```bash
cd webapp
npm run dev        # เปิด http://localhost:3000  (ข้อมูลที่กรอกไว้ยังอยู่ครบ)
```

> ⚠️ **อย่ารัน `npx prisma db seed` หรือ `npx prisma migrate reset`** ถ้าเริ่มกรอกข้อมูลจริงแล้ว — สองคำสั่งนี้จะล้างข้อมูลของจริงทิ้ง

## คำสั่งที่ใช้บ่อย

| คำสั่ง (ในโฟลเดอร์ webapp) | ทำอะไร |
|---|---|
| `npm run dev` | รัน dev server |
| `npm run notify` | สแกนงานเลย/ใกล้กำหนด → แจ้งเตือนในแอป + ส่งออก (ตั้ง cron เช้า) |
| `npm run db:clear` | **ลบงานทั้งหมด** (ใบรีเควส/item/runs/report/ไฟล์แนบ/log/แจ้งเตือน) เก็บ master data ไว้ — ใช้เริ่มใหม่ |
| `npx prisma studio` | เปิด GUI แก้/ลบข้อมูลในตาราง (ถ้าเปิด :5555 ไม่ได้ ใช้ `npm run db:clear` แทน) |
| `npx prisma db seed` | ใส่ข้อมูล**ตัวอย่าง** 5 ใบกลับเข้าไป (ลบงานเดิมก่อน) — ใช้ตอนอยากได้ตัวอย่างเทสระบบ |
| `npx tsc --noEmit` | ตรวจ type |
| `npm run lint` | ตรวจ lint |
| `npx prisma migrate dev --name <ชื่อ>` | สร้าง migration หลังแก้ `schema.prisma` |

## แผนผังไฟล์สำคัญ

```
webapp/
├─ prisma/
│  ├─ schema.prisma        โครงสร้าง DB 6 ตาราง (ดู docs/data-model.md)
│  ├─ seed.ts              ข้อมูลตัวอย่าง (npx prisma db seed)
│  ├─ clear.ts             ล้างงานเก็บ master (npm run db:clear)
│  ├─ notify.ts            สคริปต์แจ้งเตือน standalone (npm run notify · ตั้ง cron)
│  └─ migrations/          ประวัติ migration
├─ uploads/                ไฟล์แนบที่อัปโหลด (ไม่ขึ้น git)
├─ dev.db                  ฐานข้อมูล SQLite จริง (ไม่ขึ้น git)
└─ src/
   ├─ app/
   │  ├─ layout.tsx        โครงหน้า + โหลดฟอนต์ Inter/Noto Thai + NavBar
   │  ├─ page.tsx          / — แดชบอร์ด (นับราย item)
   │  ├─ loading.tsx       loading UI ระหว่างเปลี่ยนหน้า
   │  ├─ actions.ts        ⭐ server actions ทั้งหมด (สร้าง/แก้/เปลี่ยนสถานะ/อัปโหลด/master)
   │  ├─ requests/
   │  │  ├─ page.tsx           /requests — รายการจัดกลุ่มตามใบรีเควส
   │  │  ├─ new/page.tsx       /requests/new — ลงใบใหม่ + item แรก
   │  │  └─ [regis_no]/page.tsx  ภาพรวมใบรีเควส + รายการ item + ไฟล์แนบระดับใบ
   │  ├─ items/[item_code]/page.tsx  ⭐ รายละเอียด item (TAT/แก้/stepper/ย้ายที่เก็บ/runs/report/ไฟล์แนบ/QR/timeline)
   │  ├─ analytics/page.tsx   ⭐ /analytics — KPI + คอขวด + aging WIP + CFD (ช่วง month/30d/all)
   │  ├─ notifications/page.tsx  /notifications — ศูนย์แจ้งเตือน (generate on load + mark read)
   │  ├─ master/page.tsx      /master — จัดการ dropdown (แผนก/ทีม/ที่เก็บ) + เป้า SLA
   │  ├─ labels/page.tsx      /labels — พิมพ์ QR label 50×25mm ต่อ item
   │  └─ api/attachments/[id]/route.ts  เสิร์ฟ/เปิดไฟล์แนบ
   ├─ components/         UI ย่อย (ฟอร์ม, GroupedRequests, LoadingBoard, MoveLocationForm, ActivityTimeline, SlaSettings, NavBar+bell)
   └─ lib/
      ├─ prisma.ts        Prisma client (ต้องใช้ผ่าน better-sqlite3 adapter)
      ├─ workflow.ts      ⭐ สถานะ 10 ค่า, สี/สีทึบกราฟ, validation, overdue/urgent, label ที่เก็บ
      ├─ tat.ts           lead time + SLA status (TAT)
      ├─ analytics.ts     ⭐ time-in-status (คอขวด), aging, CFD replay
      ├─ notifications.ts / notify-external.ts  สร้างแจ้งเตือน + ส่งออก webhook/LINE
      ├─ regisNo.ts       ออกเลข TR-YYMM-### และ item code -NN
      ├─ uploads.ts       จัดการไฟล์อัปโหลดบนดิสก์ (server เท่านั้น)
      ├─ qr.ts            สร้าง QR (รองรับ APP_BASE_URL)
      ├─ date.ts / format.ts  ฟอร์แมตวันที่/ขนาดไฟล์
```

## จุดที่ต้องรู้ก่อนแก้ (สำคัญ)

- **Next.js 16 + Prisma 7 มี breaking changes** — อ่าน docs ใน `webapp/node_modules/next/dist/docs/` ก่อนเขียน (บังคับใน `webapp/AGENTS.md`)
- Prisma 7 **ต้อง**สร้าง client ผ่าน adapter: `new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })` — `new PrismaClient()` เปล่า throw ทันที
- `params` / `searchParams` ในหน้า page เป็น **Promise** ต้อง await
- แก้ dropdown ไม่ต้องแก้โค้ด — เข้าหน้า `/master` เพิ่ม/แก้/ปิดใช้งานได้เลย
- workflow แยกต่อ item: สถานะ/แผน/รีพอร์ท อยู่ที่ตาราง `test_items` ไม่ใช่ `test_requests`

## Backlog (ยังไม่ได้ทำ — เลือกทำต่อได้)

1. **Authentication** — ล็อกอิน + role · ปลดล็อก `changed_by` ใน log (ตอนนี้ audit trail เก็บแล้วแต่ไม่รู้ว่าใครทำ) + "งานของฉัน"
2. **เปิดใช้ groundwork ฟีเจอร์ 5-7** (schema พร้อมแล้ว):
   - **Equipment** — หน้าจัดการเครื่อง + เลือกเครื่องตอนบันทึก test run + เตือนวันสอบเทียบ (calibration_due)
   - **Test method library** — หน้าคลัง method + เลือกใส่ test_detail อัตโนมัติ
   - **Requester portal** — หน้าอ่านอย่างเดียวด้วย `public_token` ให้แผนกที่รีเควสเช็คสถานะเอง
3. **ตั้งค่าช่องทางแจ้งเตือนจริง** — ใส่ `NOTIFY_WEBHOOK_URL` หรือ LINE token ใน `.env` + ตั้ง cron รัน `npm run notify` เช้าทุกวัน
4. **ปุ่มลบจริงในเว็บ** สำหรับ admin (ตอนนี้ลบผ่าน `npm run db:clear` หรือ Prisma Studio)
5. **ย้าย SQLite → Supabase/Postgres** เพื่อใช้หลายเครื่องพร้อมกัน · auto-generate report (CoA)
6. label แบบพิมพ์ลง A4 หลายดวง/แผ่น, favicon/logo, รูปถ่ายชิ้นงานแบบ gallery
7. หน้า not-found คืน HTTP 404 จริง (ตอนนี้คืน 200 เพราะ loading.tsx stream)

> ✅ ทำแล้ว: audit trail (status/location logs), แจ้งเตือน (in-app + external), หน้า KPI/analytics (คอขวด/CFD/aging)

ดูรายละเอียดบั๊กที่แก้ไปแล้วใน `docs/แผนปรับปรุง-webapp.md`
