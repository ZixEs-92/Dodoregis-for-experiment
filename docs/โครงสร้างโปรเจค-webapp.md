# โครงสร้างโปรเจค webapp + คู่มือมาทำต่อ

> อัปเดต 2026-07-16 · เขียนไว้เผื่อกลับมาทำต่อ

## สถานะล่าสุด

- ✅ Prototype ครบ + redesign สไตล์ Airtable · **multi-item**, **master data** (`/master`), **ไฟล์แนบ**
- ✅ **โมเดล 2 ชั้น**: ใบรีเควสมี **สถานะรวม (rollup: รอเริ่ม/กำลังดำเนินการ/เสร็จ + progress X/Y)** คำนวณจาก item · item มีสถานะของตัวเอง — โชว์สอดคล้องทุกหน้า (`lib/rollup.ts`)
- ✅ **หน้า hub ใบรีเควส** `/requests/[regis]` = การ์ด item + สถานะรวม + **QR ระดับใบ** (QR ชี้มาที่นี่) · `/labels?regis=` ออก label ระดับใบ
- ✅ **QR ระดับ item** — โชว์บนหน้า item เอง (สแกนเปิดงานนั้นตรง) + ปุ่ม "พิมพ์ label item นี้" · หน้าใบมีปุ่ม "พิมพ์ QR ทุก item" (`/labels?ids=`)
- ✅ **หน้า item เป็นแท็บ** (`Tabs.tsx`): ภาพรวม/รายละเอียดเทส/ความคืบหน้า/รีพอร์ท/ไฟล์แนบ/ที่เก็บ&ประวัติ — ลดความรก
- ✅ **ชื่อการทดสอบ** (`testName` + `testTitle()` fallback จาก test_detail) แยก item ที่ชื่อชิ้นงานซ้ำกัน
- ✅ **ตารางงานรายสัปดาห์** `/schedule` — คน × วัน (จ–อา) + แผง "วันนี้ใครทำอะไร" + กดดูรายคน
- ✅ หน้ารายการงานสลับ **ตามสถานะ/ตามใบรีเควส** + ย่อ/ขยาย + badge สถานะรวม + ลิงก์ "เปิดใบ/เพิ่ม item"
- ✅ Dashboard: Loading รายบุคคล (วันนี้/สัปดาห์/ทั้งหมด) + on-time% + aging buckets + การ์ดสถานะรวมใบ
- ✅ **audit trail** (`status_logs`) + **chain of custody** (`location_logs`) → timeline หน้า item
- ✅ **TAT/SLA** (เป้าต่อแผนกที่ `/master`) · **แจ้งเตือน** (`/notifications` + bell + `npm run notify` ส่งออก webhook/LINE)
- ✅ **LINE OA** — หน้า `/settings/line` (คู่มือ + ทดสอบส่งจริง) · `lib/line.ts`
- ✅ **`/analytics`** — throughput, on-time%, lead time, retest/pass, แยกแผนก, คอขวด, aging WIP, CFD
- ✅ **`/reports` + `/api/export`** — สรุปงานรายปี/เดือน แยกแผนก/ผู้รีเควส/ผู้รับผิดชอบ + ดาวน์โหลด CSV (UTF-8 BOM)
- ✅ groundwork ฟีเจอร์ 5-7 (schema พร้อม): equipment, test_methods, requester portal token
- 📦 **ทั้งโปรเจครวมเป็น 1 git repo ที่ระดับบน → GitHub: https://github.com/ZixEs-92/Dodoregis-for-experiment** (branch main)
- 🌐 `APP_BASE_URL` ตั้งเป็น LAN IP แล้ว (`http://172.20.10.8:3000`) เพื่อให้สแกน QR จากมือถือได้ — IP นี้เปลี่ยนได้ ต้องแก้ตาม
- DB จริงอยู่ที่ `webapp/dev.db` · ไฟล์อัปโหลด `webapp/uploads/` · `.env` (ทั้งหมดไม่ขึ้น git)

## ▶️ ทำต่อ / จุดที่คุยค้าง (อัปเดต 2026-07-31)

**เพิ่งทำเสร็จ (session 2026-07-31):**
- ✅ **หน้าสแกน QR ในแอป** `/scan` — เปิดกล้องอ่าน QR แล้วเด้งเข้าหน้างาน (BarcodeDetector บน Android / jsQR บน iPhone) · อ่าน QR เดิมได้โดยตัดโดเมนทิ้ง → ใช้ได้แม้ URL เปลี่ยน (กล้องต้องเปิดผ่าน https/localhost)
- ✅ **คู่มือ deploy Cloudflare** `docs/Dodoregis-คู่มือ-Cloudflare.pptx` (14 สไลด์: Tunnel + Access)
- ✅ **Phase 3a (auth core):** โมเดล `User` + enum `UserRole`, login/logout, session (jose cookie 8ชม. + bcrypt), `lib/auth.ts` + `lib/roles.ts`, หน้า `/login`, script `npm run create-user`, NavBar โชว์ผู้ใช้/logout
- ✅ **Phase 3b (บังคับสิทธิ์):** `lib/guard.ts` กันฝั่ง server ทุก action (16 ตัว) + page guard (`/requests/new`→login, `/master` `/settings/line`→admin) + ซ่อน UI ตาม role (viewer อ่านอย่างเดียว)

**การตัดสินใจใหม่ (2026-07-31):** การ "ดู" เปิดให้ทุกคน (ไม่ต้องล็อกอิน) → viewer = คนที่ยังไม่ล็อกอิน (เหมาะกับสแกน QR หน้างาน) · ล็อกอินเฉพาะตอนสร้าง/แก้ · ทำหน้าจัดการผู้ใช้ (3e) ก่อน 3c

**เสร็จเพิ่ม (session เดียวกัน): 3e + 3c + ปรับ UX**
- ✅ **3e จัดการผู้ใช้** `/settings/users` (admin) — สร้างบัญชี (requester ต้องเลือกแผนก, engineer ผูกรายชื่อทีมได้), ตั้งรหัสใหม่, เปิด/ปิดบัญชี (ห้ามปิดตัวเอง) · เข้าจากหน้า /master
- ✅ **3c requester portal** — `TestItem.ownerId` เป็น nullable + `TestRequest.createdById` (migration `nullable_owner_created_by`) · ทุกจุดแสดง "ยังไม่มอบหมาย" (dashboard/รายการ/ใบ/item/ตารางงาน "⏳ ยังไม่มอบหมาย"/analytics/report/แจ้งเตือน) · requester: แผนกถูกล็อกฝั่ง server, ไม่เห็นช่อง owner/plan (admin วางแผนให้), หน้า `/` + `/requests` เห็นเฉพาะแผนกตัวเอง · `changedBy` ใน log เติมจาก session แล้ว
- ✅ **UX**: หน้า login เป็นประตูทางเข้า (การ์ดสแกน QR + เข้าดูไม่ล็อกอิน อยู่เหนือฟอร์ม), NavBar มีปุ่ม 📷 สแกน, เมนู "ตั้งค่าระบบ" เห็นเฉพาะ admin, login รองรับ `?next=` พากลับหน้าเดิม

- ✅ **3d คิวรอวางแผน `/planning`** (admin) — list งานที่ยังไม่มอบหมาย (ใบเก่าสุดก่อน), ฟอร์ม inline มอบหมาย owner (โชว์คิวงานเปิดของแต่ละคน) + ลงวันที่ plan → `planItem` action + ลง audit log · กติกาใหม่: item ที่ยังไม่มอบหมายเปลี่ยนสถานะได้แค่ 1–2/Hold/Cancel · เมนู "วางแผน" ใน NavBar + แบนเนอร์ ⏳ บนแดชบอร์ด (admin)
- ✅ **หน้าแรก = login**: เข้า `/` โดยไม่ล็อกอิน → เด้งไปหน้า login (ประตูทางเข้า: สแกน QR / ดูรายการงาน / ล็อกอิน) · หน้าดูงานอื่น (items/requests/scan/labels) ยังเปิดให้ดูโดยไม่ล็อกอินสำหรับ QR flow

**🎉 Phase 3 (auth + requester portal) ครบทุก sub-phase แล้ว (3a/3b/3c/3d/3e)**

**รอบ UX (2026-08-01) — รีวิวทั้งระบบแล้วปรับ 2 ระยะ**
- 📄 เอกสารรีวิว (artifact): เส้นทางการกดของ 4 บทบาท + 24 ประเด็น + แผนลงมือ
- **ระยะ A/B:** หน้าแรกแยกตามบทบาท (requester เห็นงานแผนกตัวเอง · engineer เห็น "งานของฉัน" · admin เห็นภาพรวม) · แผงเปลี่ยนสถานะจาก 14 ปุ่มเหลือ 3 ตัวควบคุม (ปุ่มหลักเป็นคำกริยา + dropdown + เมนู ⋯) พร้อมบอกเงื่อนไขก่อนกด · toast + กล่องยืนยันในดีไซน์แอป (เลิกใช้ `window.confirm`) · แถบเมนูล่างมือถือ 5 ช่อง + ปุ่มลอย "สแกนชิ้นต่อไป" · `/settings` รวมหน้าตั้งค่า · หน้า item 6 แท็บ → 3 · มุมมองด่วนใน `/requests` · แถบเลือกหลายรายการโผล่เมื่อเลือก · focus ring + aria-label + ปุ่มขั้นต่ำ 44px
- **ระยะ C:** ชุดไอคอน SVG (`components/ui/Icon.tsx`) แทน emoji · **บอร์ดคัมบัง `/board`** ลากการ์ดข้ามคอลัมน์เปลี่ยนสถานะ (มือถือใช้เมนูในการ์ด) · **แถบคำสั่งด่วน Ctrl/⌘+K** ค้นงาน+กระโดดหน้า (API `/api/search`) · มอบหมายหลายรายการรวดเดียวในคิววางแผน · แจ้งเตือน admin เมื่อมีงานใหม่เข้าคิว · ร่างอัตโนมัติในฟอร์มลงงาน (localStorage) · **PWA** ติดตั้งลงหน้าจอมือถือได้ (`app/manifest.ts` + `public/icon.svg`)

**งานถัดไป (เลือกได้):** deploy จริง (Cloudflare Tunnel + โดเมน — มีคู่มือ pptx แล้ว), เปิด groundwork equipment/test method, cron แจ้งเตือน, requester แก้งานตัวเองก่อนถูกมอบหมาย
- หมายเหตุ: Next streaming `redirect()` ส่ง client-side meta-refresh (200 ไม่ใช่ 307) — เทสด้วย curl จะไม่เห็นการ redirect ต้องเปิด browser จริง · React แทรก `<!-- -->` ระหว่างตัวแปรใน SSR HTML — grep ข้อความจากหน้าเว็บต้อง match แบบหลวม

**เรื่องที่ค้าง (2): ทำให้ "ที่เก็บ raw data" กดเปิดโฟลเดอร์ได้จริง**
- สถานะตอนนี้: ช่อง raw data ถ้าใส่ **http/https = เป็นลิงก์กดได้** · ถ้าเป็น path เครื่อง/UNC (`\\EVA-NAS02\EVA-Shared`) = แสดง text + **ปุ่มคัดลอก** (เอาไปวางใน File Explorer)
- ข้อจำกัด: เบราว์เซอร์บล็อก `file://`/UNC เสมอ (แม้อยู่ในเน็ตองค์กร/VPN) → ต้องมีชั้น http(s) ครอบถึงจะกดเปิดได้
- ผู้ใช้บอกว่า NAS `\\EVA-NAS02` **รันอยู่บน server บริษัท** · ยังไม่ตอบ: **(1) server OS อะไร (Windows Server/Linux/NAS OS)** · **(2) จะโฮสต์เว็บแอปที่ไหน (เครื่องนี้/server เดียวกับ NAS/ที่อื่น)**
- ทางเลือกที่เสนอไป (รอผู้ใช้เลือก):
  1. **Windows Server → IIS** ชี้ virtual directory ไปที่แชร์ → ได้ https link (ง่ายสุดถ้าเป็น Windows)
  2. ลง **Filebrowser/Nextcloud** บน server → https link + login
  3. เข้าจากนอกไม่ต้อง VPN → **Cloudflare Tunnel** ครอบ server (ดู `docs/แผน-cloudflare-tunnel-access.md`)
  4. **ให้แอป Dodoregis เสิร์ฟไฟล์เอง** (ถ้าโฮสต์แอปบน server เดียวกับ NAS) — เพิ่ม route proxy อ่านไฟล์จากแชร์ → ลิงก์กดเปิด/ดาวน์โหลดในแอป (เป็นงาน dev · ผมเสนอทำให้ได้)
  5. **SharePoint/OneDrive sync** (ถ้ามี M365) — universal สุด กดได้ทุกที่ไม่ต้อง VPN
- **พรุ่งนี้เริ่ม:** ถามผู้ใช้ 2 ข้อข้างบน → ถ้าเลือกข้อ 4 เขียน route ให้แอปเสิร์ฟไฟล์จากแชร์ · ถ้าเลือก IIS/Filebrowser เขียนคู่มือ setup

**Backlog อื่นที่ค้าง:** ดูหัวข้อ Backlog ด้านล่าง (auth เป็นข้อ 1, groundwork equipment/method/portal, deploy จริง)

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
│  ├─ schema.prisma        โครงสร้าง DB (test_requests/items/runs/reports/attachments + logs/notifications + master · ดู docs/data-model.md)
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
   │  ├─ items/[item_code]/page.tsx  ⭐ รายละเอียด item แบบ **แท็บ** (ภาพรวม/รายละเอียด/runs/report/ไฟล์/ประวัติ)
   │  ├─ schedule/page.tsx    ⭐ /schedule — ตารางงานรายสัปดาห์ (คน×วัน + วันนี้)
   │  ├─ analytics/page.tsx   ⭐ /analytics — KPI + คอขวด + aging WIP + CFD (ช่วง month/30d/all)
   │  ├─ reports/page.tsx     ⭐ /reports — สรุปรายปี/เดือน + ปุ่มดาวน์โหลด CSV
   │  ├─ notifications/page.tsx  /notifications — ศูนย์แจ้งเตือน (generate on load + mark read)
   │  ├─ settings/line/page.tsx  /settings/line — ผูก LINE OA + ทดสอบส่ง
   │  ├─ master/page.tsx      /master — dropdown (แผนก/ทีม/ที่เก็บ) + เป้า SLA
   │  ├─ labels/page.tsx      /labels — พิมพ์ QR label 50×25mm (?regis= ระดับใบ / ?ids= ระดับ item)
   │  ├─ api/attachments/[id]/route.ts  เสิร์ฟ/เปิดไฟล์แนบ
   │  └─ api/export/route.ts  ⭐ ดาวน์โหลด CSV (type=detail|dept|requester|owner|month)
   ├─ components/         Tabs, WeeklySchedule, GroupedRequests, LoadingBoard, MoveLocationForm,
   │                      ActivityTimeline, SlaSettings, LineTestForm, ฟอร์มต่างๆ, NavBar+bell
   └─ lib/
      ├─ prisma.ts        Prisma client (ต้องใช้ผ่าน better-sqlite3 adapter)
      ├─ workflow.ts      ⭐ สถานะ 10 ค่า, สี/สีทึบกราฟ, validation, overdue/urgent, label ที่เก็บ
      ├─ rollup.ts        ⭐ สถานะรวมใบรีเควส (phase + progress) จาก items
      ├─ tat.ts           lead time + SLA status (TAT)
      ├─ analytics.ts     ⭐ time-in-status (คอขวด), aging, CFD replay
      ├─ report.ts / csv.ts  ⭐ ดึง+สรุปข้อมูลรายงาน + สร้าง CSV (BOM)
      ├─ notifications.ts / notify-external.ts / line.ts  แจ้งเตือน + ส่งออก webhook/LINE
      ├─ regisNo.ts · uploads.ts · qr.ts · date.ts · format.ts (มี testTitle)
```

## จุดที่ต้องรู้ก่อนแก้ (สำคัญ)

- **Next.js 16 + Prisma 7 มี breaking changes** — อ่าน docs ใน `webapp/node_modules/next/dist/docs/` ก่อนเขียน (บังคับใน `webapp/AGENTS.md`)
- Prisma 7 **ต้อง**สร้าง client ผ่าน adapter: `new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })` — `new PrismaClient()` เปล่า throw ทันที
- `params` / `searchParams` ในหน้า page เป็น **Promise** ต้อง await
- แก้ dropdown ไม่ต้องแก้โค้ด — เข้าหน้า `/master` เพิ่ม/แก้/ปิดใช้งานได้เลย
- workflow แยกต่อ item: สถานะ/แผน/รีพอร์ท อยู่ที่ตาราง `test_items` ไม่ใช่ `test_requests`

## Backlog (ยังไม่ได้ทำ — เลือกทำต่อได้)

1. **Auth + requester portal** — 📄 `docs/แผน-auth-user-แผนกเพิ่มงานเอง.md` · **3a (auth core) + 3b (บังคับสิทธิ์) ทำแล้ว** · เหลือ 3e หน้าจัดการผู้ใช้ → 3c พอร์ทัล requester (ownerId nullable) → 3d คิววางแผน · ยังต้องปลดล็อก `changed_by` จาก session
2. **เปิดใช้ groundwork ฟีเจอร์ 5-7** (schema พร้อมแล้ว):
   - **Equipment** — หน้าจัดการเครื่อง + เลือกเครื่องตอนบันทึก test run + เตือนวันสอบเทียบ (calibration_due)
   - **Test method library** — หน้าคลัง method + เลือกใส่ test_detail อัตโนมัติ
   - **Requester portal** — หน้าอ่านอย่างเดียวด้วย `public_token` ให้แผนกที่รีเควสเช็คสถานะเอง
3. **ตั้งค่าช่องทางแจ้งเตือนจริง** — ใส่ `NOTIFY_WEBHOOK_URL` หรือ LINE token ใน `.env` + ตั้ง cron รัน `npm run notify` เช้าทุกวัน
4. **ปุ่มลบจริงในเว็บ** สำหรับ admin (ตอนนี้ลบผ่าน `npm run db:clear` หรือ Prisma Studio)
5. **ย้าย SQLite → Supabase/Postgres** เพื่อใช้หลายเครื่องพร้อมกัน · auto-generate report (CoA)
6. label แบบพิมพ์ลง A4 หลายดวง/แผ่น, favicon/logo, รูปถ่ายชิ้นงานแบบ gallery
7. หน้า not-found คืน HTTP 404 จริง (ตอนนี้คืน 200 เพราะ loading.tsx stream)

> ✅ ทำแล้ว: โมเดล 2 ชั้น (rollup) + QR ระดับใบ **+ QR ระดับ item**, หน้า item แบบแท็บ, ชื่อการทดสอบ (testName),
> ตารางงานรายสัปดาห์ (`/schedule`), รายงาน+export CSV (`/reports`), หน้า LINE OA (`/settings/line`),
> audit/location logs, แจ้งเตือน, analytics (คอขวด/CFD/aging), รวม repo + push GitHub,
> **สไลด์นำเสนอผู้บริหาร (`docs/Dodoregis-นำเสนอผู้บริหาร.pptx`)**, **auth Phase 3a+3b (login/session + role guards ฝั่ง server, viewer อ่านอย่างเดียว)**, **หน้าสแกน QR ในแอป `/scan`**, **คู่มือ deploy Cloudflare (`docs/Dodoregis-คู่มือ-Cloudflare.pptx`)**

## Deployment / เข้าถึงจากมือถือ (มีเอกสารแผนแล้ว ยังไม่ได้ทำจริง)

- `docs/แผน-เข้าถึงจากมือถือ-ฟรี.md` · `docs/แผน-cloudflare-tunnel-access.md` · `docs/แผน-deploy-railway.md`
- สรุป: **LAN** = ฟรีสุดสำหรับใช้ในออฟฟิศ (ตอนนี้ตั้ง `APP_BASE_URL` เป็น LAN IP แล้ว) · **Tailscale** ฟรีสำหรับทีมนอกออฟฟิศ ·
  **Cloudflare Tunnel + Access** (เสียแค่ค่าโดเมน) ถ้าอยากสแกน QR จากที่ไหนก็ได้ + มี login · **Railway** ไม่ฟรีจริง (~$5/เดือน)
- ถ้าเปิด public ต้องทำ **auth** ในแอปก่อน (อยู่ใน backlog ข้อ 1) · ยังไม่ตั้ง firewall port 3000 (ถ้ามือถือเข้าไม่ได้ให้เปิด)

ดูรายละเอียดบั๊กที่แก้ไปแล้วใน `docs/แผนปรับปรุง-webapp.md`
