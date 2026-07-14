# แผนปรับปรุง webapp — ส่งต่อสำหรับรอบถัดไป

> ผลการตรวจงาน prototype (Next.js 16 + Prisma 7 + SQLite) และรอบ redesign ตาม `DESIGN-airtable.md`
> ตรวจเมื่อ 2026-07-13 — ทุกข้อด้านล่างผ่านการยืนยันจริงแล้ว (รันโค้ด/วัดค่า) ไม่ใช่การคาดเดา

## ✅ สถานะ: ทำเสร็จแล้ว (2026-07-13 รอบเดียวกัน)

- **P1 ครบทั้ง 4 ข้อ** — commit `21fd27f`
- **P2 ครบทั้ง 6 ข้อ (5–10) + P3 ข้อ 13/14 + แก้หน้าเปล่าท้าย label (ข้อ 12 บางส่วน)** — commit `32df59f`
- Verify แล้ว: functional test 10 ข้อบน actions ผ่านหมด (validation / invariant / hold memory / auto-fill / report sync), tsc + eslint ผ่าน, ทุก route 200
- **ยังไม่ได้ทำ (เหลือใน backlog):** ข้อ 11 (ฟิลด์ลิงก์รูปถ่าย), ข้อ 12 ส่วน layout A4 หลายดวงต่อแผ่น, ข้อ 13 ส่วน favicon/logo
- หมายเหตุเพิ่มเติมที่แก้แถม: ค่า default วันที่ในฟอร์มงานใหม่เดิมใช้ UTC (ผิดวันช่วงก่อน 7 โมงเช้า) — แก้เป็น Asia/Bangkok แล้ว

## สรุปผลตรวจ: สิ่งที่ทำครบตาม spec แล้ว

- ครบทั้ง 5 หน้าตาม prompt 01 (dashboard / requests+filter / new / detail+stepper+QR / labels) — ทุก route ตอบ 200, 404 ทำงานถูก
- ออกเลข TR-YYMM-### อัตโนมัติ, validation บังคับกรอกตามกติกา CLAUDE.md (ทดสอบจริงแล้ว: เข้าสถานะ 3 โดยไม่มีวันที่รับพาร์ทถูก block พร้อม error ไทย)
- Seed 8 งานครบทุกสถานะ, งานด่วน "make รีพอร์ต" ขึ้นแถบแดง, ไฟล์เก็บเป็นลิงก์เท่านั้น
- Design token ตาม DESIGN-airtable.md compile ลง CSS จริง (ตรวจแล้ว: `#181d26`, `border-radius: 12px`)
- typecheck + lint ผ่าน

## ปัญหาที่พบ — เรียงตามความสำคัญ

### P1 — กระทบผู้ใช้จริง ควรแก้ก่อน

**1. สี status chip 3 คู่ contrast ไม่ผ่าน WCAG (วัดจริงแล้ว)**
ไฟล์: `webapp/src/lib/workflow.ts` (STATUS_COLOR) + token ใน `globals.css`

| สถานะ | คู่สีปัจจุบัน | Contrast | เกณฑ์ |
|---|---|---|---|
| S2_WAIT_PART | `text-mustard` on `yellow-soft` | 2.05:1 | ❌ ต้อง ≥4.5 |
| S6_REPORTING | `text-mustard` on `mustard-soft` | 1.93:1 | ❌ |
| S9_HOLD | `white` on `mustard` | 2.25:1 | ❌ |

แนวทาง: เพิ่ม token สีเข้ม เช่น `--color-mustard-deep: #7a5a12` (ประมาณนี้ — คำนวณให้ผ่าน 4.5:1 ก่อนใช้) ใช้เป็น text ของ S2/S6 และเปลี่ยน S9 เป็น `bg-mustard text-ink` หรือ `bg-mustard-soft text-mustard-deep`
สคริปต์วัด contrast ใช้ซ้ำได้ (node inline):
```js
function lum(hex){const c=hex.replace('#','');const[r,g,b]=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b}
function ratio(a,b){const[l1,l2]=[lum(a),lum(b)].sort((x,y)=>y-x);return(l1+.05)/(l2+.05)}
```

**2. ฟอนต์ Inter ไม่มีอักษรไทย — UI ไทยทั้งแอปตกไป fallback font**
ไฟล์: `webapp/src/app/layout.tsx` (โหลด `Inter` subsets latin เท่านั้น)
แนวทาง: โหลด `Noto_Sans_Thai` (หรือ `IBM_Plex_Sans_Thai_Looped`) จาก `next/font/google` ควบคู่ Inter แล้วตั้ง font stack เป็น `var(--font-inter), var(--font-thai), ...` ใน `globals.css` (`--font-sans`) — ตัวเลขและอังกฤษยังเป็น Inter, ไทยได้ฟอนต์ที่ตั้งใจเลือก น้ำหนัก 400/500/600 ให้ตรงกับที่ใช้อยู่

**3. QR ฝัง host จาก request header — สแกนจากมือถือไม่ได้ถ้าพิมพ์ label จากเครื่องที่เปิด localhost**
ไฟล์: `webapp/src/lib/qr.ts`
นี่คือฟีเจอร์หลักของระบบ (QR ติดชิ้นงาน) — ถ้าพิมพ์ label ตอนเปิดเว็บผ่าน `localhost:3000` QR จะชี้ localhost ซึ่งมือถือเปิดไม่ได้
แนวทาง: เพิ่ม env `APP_BASE_URL` — ถ้าตั้งไว้ให้ใช้ก่อน host header เสมอ, เพิ่มลง `.env` พร้อมคอมเมนต์ และเขียนเตือนใน README ว่าก่อนพิมพ์ label จริงให้ตั้งเป็น URL ที่มือถือเข้าถึงได้ (LAN IP หรือโดเมนจริง)

**4. งานที่ plan จบ "วันนี้" ถูกนับเป็นเลยกำหนดตั้งแต่เที่ยงคืน**
ไฟล์: `webapp/src/lib/workflow.ts` — `isOverdue` / `isDueSoon`
`planEnd` เก็บเป็น 00:00 ของวันนั้น แล้วเทียบ `planEnd.getTime() < Date.now()` → เลยกำหนดทันทีที่เข้าวันครบกำหนด และหลุดจากการ์ด "ครบกำหนดใน 7 วัน" ด้วย
แนวทาง: เทียบกับสิ้นวัน (`planEnd + 1 วัน`) ใน `isOverdue` และให้ `isDueSoon` นับตั้งแต่วันนี้ถึง +7 วันแบบ date-based ให้สอดคล้องกัน

### P2 — ความถูกต้อง/ความทนทาน

**5. Server actions ไม่มี server-side validation**
ไฟล์: `webapp/src/app/actions.ts` — `createTestRequest`/`updateRequestDetails` ใช้ non-null assertion (`num(formData,"request_dept")!`) ถ้า POST ขาดฟิลด์ (เช่นกดจาก client ที่ JS ยังไม่โหลด หรือยิงตรง) จะ crash เป็น error page แทน error message
แนวทาง: validate แล้ว return `{ ok:false, errors:[] }` แบบเดียวกับ `changeStatus` + แสดงผลผ่าน `useActionState` ฝั่งฟอร์ม

**6. แก้ข้อมูลย้อนหลังทำให้ผิด invariant ของสถานะได้**
`updateRequestDetails` ยอมให้เคลียร์วันที่รับพาร์ท/ตำแหน่งเก็บ ทั้งที่งานอยู่สถานะ 3 ขึ้นไปแล้ว (กติกาบอกว่าฟิลด์พวกนี้ต้องมีก่อนเข้าสถานะ)
แนวทาง: ใน `updateRequestDetails` เรียก `validateStatusTransition(current status, ข้อมูลใหม่)` ก่อน save — ถ้าข้อมูลใหม่ทำให้สถานะปัจจุบันผิดกติกา ให้ block พร้อมข้อความ

**7. ออกเลข regis_no มี race condition**
ไฟล์: `webapp/src/lib/regisNo.ts` — `findFirst` แล้วค่อย `create` แยกกัน ถ้าสองคนกดบันทึกพร้อมกันได้ seq ซ้ำ → PK ชนกัน โยน error ดิบ
แนวทาง: จับ Prisma error `P2002` แล้ว retry (2-3 ครั้ง) หรือครอบด้วย `$transaction` — สำหรับทีม 1-10 คนวิธี retry ง่ายและพอ

**8. Stepper กระโดดข้ามสถานะได้อิสระทุกทิศทาง**
ไฟล์: `webapp/src/components/StatusStepper.tsx`
กดสถานะไหนก็ได้เลย รวมถึงถอยหลังหลายขั้น — spec บอก "stepper ตาม workflow"
แนวทาง: ปุ่มหลักคือ "ไปขั้นถัดไป" (ใหญ่ ชัด) ส่วนการ jump ข้ามขั้น/ถอยหลังให้มี confirm ก่อน, Hold/Cancel กดได้ทุกจุดตามเดิม และควรจำสถานะก่อน Hold ไว้ (เพิ่มฟิลด์ `statusBeforeHold` ใน schema) เพื่อให้ resume กลับถูกขั้น

**9. เปลี่ยนสถานะแล้วไม่ auto-fill วันที่จริง**
เข้าสถานะ 4-กำลังเทส ควรตั้ง `actualStart` ถ้ายังว่าง, เข้า 5-เทสเสร็จ ตั้ง `actualEnd`, เข้า 7 ควร sync report status เป็น "ส่งแล้ว" — ลดการกรอกซ้ำและข้อมูลตกหล่น
ไฟล์: `webapp/src/app/actions.ts` — `changeStatus`

**10. งานทั้งหมดยังไม่ถูก commit**
git repo ใน `webapp/` มีแค่ initial commit ของ create-next-app — งานทั้ง prototype และ redesign ค้างอยู่ใน working tree
แนวทาง: **commit ก่อนเริ่มแก้อะไร** (แนะนำแยก 2 commit: prototype / redesign ถ้าแยกได้ หรือรวมก็ได้) เพื่อให้มีจุด rollback

### P3 — เสริมถ้ามีเวลา

11. **รูปถ่ายชิ้นงาน** — data model มีฟิลด์ photos (รูปตอนรับพาร์ท/หลังเทส) ยังไม่ได้ implement — ทำเป็นลิสต์ลิงก์รูป (ยึดกติกาเก็บลิงก์ ไม่อัปโหลดเข้า db)
12. **หน้า labels** — เพิ่ม option พิมพ์ลงกระดาษ A4 หลายดวงต่อแผ่น (ตอนนี้ @page 50×25มม. เหมาะกับเครื่องพิมพ์ label โดยตรงเท่านั้น) และเช็คหน้าเปล่าท้ายชุดจาก `page-break-after: always`
13. **Empty state / loading.tsx** — เพิ่ม loading UI ระหว่างเปลี่ยนหน้า และ favicon/logo แทนของ default
14. **`<title>` รายหน้า** — ใส่ `generateMetadata` ที่หน้า detail ให้ title เป็นเลขงาน (ช่วยตอน bookmark/แชร์ลิงก์จาก QR)

## สิ่งที่ตั้งใจให้ต่างจาก DESIGN-airtable.md (ไม่ต้องแก้)

- เพิ่ม hover state ทั้งที่ design doc ไม่ระบุ (นโยบาย no-hover ของ doc เป็นข้อจำกัดการ extract ไม่ใช่ข้อห้ามของแอป) — แอปที่ใช้งานจริงควรมี hover feedback
- ปุ่ม padding แนวตั้ง 12px (doc ระบุ 16px) — จงใจให้กระชับขึ้นเพราะเป็น app UI ไม่ใช่ marketing page
- ใช้เลข status เต็ม (S1–S10) เป็น enum ใน Prisma แทน master table statuses — เพราะ workflow ผูก logic validation ในโค้ด

## ลำดับการทำที่แนะนำ

1. Commit งานปัจจุบันทั้งหมดก่อน (ข้อ 10)
2. P1 ทั้ง 4 ข้อ (สี → ฟอนต์ → QR base URL → วันครบกำหนด)
3. P2 ตามลำดับ 5→9
4. P3 เลือกตามเวลา
5. ทุกข้อ verify ด้วย: `npx tsc --noEmit` + `npm run lint` + เปิดหน้าเว็บจริงทดสอบ flow ที่แก้ (dev server: `npm run dev` ใน `webapp/`)

## ข้อมูลแวดล้อมที่ต้องรู้ก่อนแก้

- **Next.js 16 / Prisma 7 มี breaking changes จากที่โมเดลรู้จัก** — `webapp/AGENTS.md` บังคับให้อ่าน docs ใน `node_modules/next/dist/docs/` ก่อนเขียนโค้ด อย่าข้าม
- Prisma 7 ใช้ generator `prisma-client` (ESM, output ที่ `src/generated/prisma/`) และ**ต้อง**สร้าง client ผ่าน driver adapter: `new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })` — `new PrismaClient()` เปล่าจะ throw ทันที
- `params`/`searchParams` ใน page เป็น **Promise** ต้อง await
- DB จริงอยู่ที่ `webapp/dev.db` (ไฟล์เดียว ยืนยันแล้ว), seed รันซ้ำได้ (`npx prisma db seed` — reset งานตัวอย่าง, upsert master data)
- Dev server มักเปิดค้างอยู่ที่ port 3000 — เช็คก่อน start ซ้ำ
