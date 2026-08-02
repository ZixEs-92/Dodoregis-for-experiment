# แผนทดลองเอา Dodoregis ขึ้น Railway (Free plan)

> เขียน 2026-08-02 · สำหรับ "ลองดูว่าทำได้ไหม" ไม่ใช่ย้ายระบบจริง
> ข้อสรุปราคา/ทางเลือกอื่น ดู [แผน-ย้ายไป-nas-cloudflare.md](แผน-ย้ายไป-nas-cloudflare.md)

---

# ✅ ผลจริง — ทำแล้ว 2026-08-02 (ขึ้นได้ ใช้งานได้)

**URL:** `https://dodoregis-for-experiment-production.up.railway.app`
**บัญชี admin บนนั้น:** `admin` (รหัสคนละตัวกับในเครื่อง — ตั้งใหม่ให้แข็งแรงเพราะเปิดสู่อินเทอร์เน็ต)
**แผนที่ใช้จริง:** บัญชีอยู่ในช่วง **Trial ($5 / 30 วัน)** ไม่ใช่ Free ($1/เดือน) → พอ trial หมดจะเจอเพดานตามที่คำนวณไว้ในตารางด้านล่าง

### 🎯 ข้อสอบหลักผ่าน
สร้าง user → สั่ง deploy ใหม่ → **user ยังอยู่** ⇒ **volume เก็บข้อมูลข้าม deploy ได้จริง**
แปลว่าทางนี้ใช้งานจริงได้ ถ้ายอมจ่าย Hobby $5/เดือน · ไม่ต้องย้ายไป Postgres

### กับดักที่เจอจริง (นอกเหนือจากที่เขียนไว้ล่วงหน้า)

| # | อาการ | สาเหตุ | ทางแก้ |
|---|---|---|---|
| 1 | build ตายใน 2 วิ "could not determine how to build" | repo root ไม่มี package.json | Root Directory = `/webapp` |
| 2 | `Can't resolve @/generated/prisma/client` | `src/generated/prisma` อยู่ใน .gitignore — เครื่อง clone ใหม่ไม่มี | เพิ่ม `"postinstall": "prisma generate"` |
| 3 | push แล้วเงียบ ไม่มี deploy | **Auto deploy ปิดอยู่โดยปริยาย** | Settings → Source → Enable |
| 4 | ขึ้น "Online" แต่เข้าเว็บ **502 ตลอด** | Railway ยัด `PORT=8080` (ไม่โผล่ในหน้า Variables) แต่ domain ตั้งไว้ที่ 3000 | แก้ target port ของ domain เป็น **8080** |
| 5 | ตาราง `users` ไม่มีในฐานข้อมูล ทั้งที่ log บอกว่า migrate สำเร็จ | 🔴 **Pre-deploy command รันก่อน volume ถูก mount** — ตารางถูกสร้างในดิสก์ชั่วคราวแล้วโดน volume ทับ | ย้าย migrate ไปไว้ใน **start command**: `npx prisma migrate deploy && npm run start` |

> ข้อ 5 คือกับดักที่อันตรายที่สุด และ**ไม่มีในแผนตอนแรก** — ถ้าไม่เจอตอนทดลอง จะไปเจอตอนย้ายข้อมูลจริงซึ่งแก้ยากกว่ามาก

### ค่าตั้งสุดท้ายที่ใช้งานได้
- Root Directory `/webapp` · Auto deploy: on (branch `main`)
- Start command: `npx prisma migrate deploy && npm run start` · **ไม่มี pre-deploy**
- Volume `/data` · Domain → port **8080**
- Variables: `DATABASE_URL=file:/data/dev.db` · `UPLOAD_DIR=/data/uploads` · `AUTH_SECRET` · `QR_MODE=code` · `TZ=Asia/Bangkok`

### ยังไม่ได้ทำ
- ยังไม่ได้ย้ายข้อมูลจริงขึ้น (ตั้งใจ — ดูเหตุผลข้อ D)
- ยังไม่มี master data (แผนก/สมาชิก/ที่เก็บ) บนนั้น → ต้องกรอกเองถ้าจะทดสอบ flow เต็ม
- ยังไม่ได้เปิด App Sleeping → ยังไม่ได้วัดค่าใช้จ่ายจริงแบบ 8 ชม./วัน

---

## สรุปคำตอบสั้น

| คำถาม | คำตอบ |
|---|---|
| Deploy ขึ้น Railway ได้ไหม | **ได้** — แต่ต้องแก้โค้ด 3 จุดก่อน (ข้อ A ด้านล่าง) |
| Free plan ($1/เดือน) พอไหม | **ทดลองได้สบาย** (ทดลอง 1–2 วันใช้ไม่ถึง $0.10) · **ใช้งานจริงไม่พอ** — เครดิตหมดกลางเดือนแล้วแอปดับ |
| ข้อมูลจริงย้ายขึ้นได้ไหม | **รอบทดลองอย่าย้าย** — ให้เริ่มจากฐานข้อมูลว่าง (เหตุผลข้อ D) |

**สิ่งที่ต้องพิสูจน์ให้ได้ในรอบทดลอง = ไฟล์ไม่หายตอน deploy ใหม่** ถ้าข้อนี้ผ่าน แปลว่าทางนี้ใช้ได้จริงเมื่ออัปเป็น Hobby $5/เดือน ถ้าไม่ผ่าน = ทางตัน ต้องย้ายไป Postgres

---

## A. ต้องแก้โค้ดก่อน 3 จุด (สำคัญที่สุด)

Railway **ลบไฟล์ทั้งหมดในคอนเทนเนอร์ทุกครั้งที่ deploy ใหม่** ตอนนี้ทั้ง `dev.db` และ `uploads/` เขียนลงโฟลเดอร์โปรเจคตรง ๆ → ถ้าไม่แก้ **ทุกครั้งที่ push งานทั้งหมดหายเกลี้ยง**

ทางแก้: ผูก **Volume** ของ Railway ไว้ที่ `/data` แล้วให้ทั้ง DB และไฟล์แนบไปอยู่ในนั้น

### A1 — `webapp/src/lib/uploads.ts` (บรรทัด 7)
```ts
// เดิม (ฮาร์ดโค้ด)
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// ใหม่ — อ่านจาก env ได้ ถ้าไม่ตั้งก็เหมือนเดิมทุกประการ (รันในเครื่องไม่กระทบ)
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
```

### A2 — ตัวแปรแวดล้อมบน Railway
| ตัวแปร | ค่า | หมายเหตุ |
|---|---|---|
| `DATABASE_URL` | `file:/data/dev.db` | ชี้เข้า volume |
| `UPLOAD_DIR` | `/data/uploads` | ชี้เข้า volume |
| `AUTH_SECRET` | สุ่มใหม่ ไม่ใช้ตัวเดียวกับในเครื่อง | **ห้าม commit** |
| `QR_MODE` | ไม่ต้องตั้ง (default = `code`) | QR ไม่ผูก URL อยู่แล้ว → label เดิมใช้ได้ต่อ |
| `APP_BASE_URL` | ปล่อยว่าง | ระบบใช้ host จริงจาก request แล้ว |

### A3 — รัน migration ตอน deploy
ตั้ง **Pre-deploy command** (หรือ start command นำหน้า):
```bash
npx prisma migrate deploy
```
ครั้งแรกจะสร้างตารางทั้ง 18 ตารางในไฟล์ `/data/dev.db` ให้เอง

> ⚠️ A1 เป็นการแก้โค้ดจริง ต้อง commit เข้า repo — แต่เป็นการแก้แบบ *ไม่กระทบการรันในเครื่อง* (ไม่ตั้ง env ก็ทำงานเหมือนเดิม)

---

## B. ขั้นตอนทำจริง (เรียงตามลำดับ)

### B1 · เตรียมฝั่ง repo
1. แก้ A1 แล้ว commit + push ขึ้น GitHub (`ZixEs-92/Dodoregis-for-experiment`)
2. Repo เป็น monorepo — โค้ดแอปอยู่ในโฟลเดอร์ย่อย `webapp/` ต้องบอก Railway ว่า **Root Directory = `webapp`** (ไม่งั้นมันหา package.json ไม่เจอ)
3. ปักเวอร์ชัน Node — Next 16 ต้องการ **Node ≥ 20.9** สร้างไฟล์ `webapp/.nvmrc` เนื้อหา `22` (หรือตั้ง env `NIXPACKS_NODE_VERSION=22`)

### B2 · สร้างโปรเจคบน Railway
1. หน้า Railway ที่เปิดไว้ → **New Project → Deploy from GitHub repo**
2. เลือก repo → Railway จะขอสิทธิ์เข้าถึง (repo ส่วนตัวก็ได้)
3. เข้า **Settings → Source → Root Directory** ใส่ `webapp`
4. **Settings → Deploy → Pre-deploy Command** ใส่ `npx prisma migrate deploy`
5. Start command ปล่อยให้ Railway ใช้ `npm run start` (Next อ่านตัวแปร `PORT` ที่ Railway ยัดให้เอง ไม่ต้องแก้)

### B3 · สร้าง Volume (ขั้นตอนที่ห้ามลืม)
1. คลิกที่ service → แท็บ **Variables** ข้าง ๆ จะมี **+ Volume**
2. Mount path = **`/data`** · ขนาด free plan = 0.5 GB (พอ — ตอนนี้ DB 184 KB + ไฟล์แนบ 0.2 MB)
3. ใส่ตัวแปรตามตาราง A2

### B4 · Deploy แล้วดู log
ดูให้ครบ 3 ท่อน:
- `prisma migrate deploy` ขึ้น `migrations applied` ไม่ error
- `next build` ผ่าน (ระวังข้อ C1)
- `✓ Ready` แล้ว Railway ออก URL `xxx.up.railway.app` ให้

### B5 · เปิด public domain
Settings → Networking → **Generate Domain**

---

## C. จุดที่มีโอกาสพังจริง (เรียงตามความน่าจะเป็น)

| # | ปัญหา | อาการ | ทางแก้ |
|---|---|---|---|
| C1 | **Build กิน RAM เกินโควตา free (0.5 GB)** | build ตาย `killed` / exit 137 | ลองใหม่ 1–2 รอบ · ถ้ายังไม่ผ่าน = ต้อง Hobby (build ของ Next+Turbopack กินหลาย GB ตอน peak) |
| C2 | **`better-sqlite3` คอมไพล์ไม่ผ่าน** | error node-gyp / `Could not locate the bindings file` | ปักเป็น Node 22 (มี prebuild) แทน Node 24 |
| C3 | **ลืมสร้าง volume** | deploy แรกใช้ได้ · deploy ที่สองข้อมูลหายหมด | นี่คือกับดักหลัก — เช็ค `/data` ก่อนกรอกข้อมูลใด ๆ |
| C4 | `AUTH_SECRET` ไม่ได้ตั้ง | หน้า login พังทันที (`AUTH_SECRET ไม่ได้ตั้งค่าใน .env`) | ตั้งใน Variables |
| C5 | Root Directory ไม่ได้ตั้ง | build fail "no package.json" | Settings → Source |

---

## D. ⚠️ ห้ามเอาข้อมูลจริงขึ้นในรอบทดลอง

เหตุผล 3 ข้อ:

1. **แอปเปิดให้ดูโดยไม่ต้องล็อกอิน** (ตั้งใจไว้แบบนั้น เพื่อให้สแกน QR แล้วเปิดดูได้เลย) → ใครได้ URL ไปก็เห็นงานทดสอบทั้งหมด ชื่อผู้ขอ อีเมล เบอร์โทร สเปคชิ้นงาน ครบ
2. **ยังไม่มีการสำรองข้อมูลอัตโนมัติ** ถ้าเผลอทำ volume หาย = หายจริง
3. **เอาขึ้นแล้วจะมีฐานข้อมูล 2 ก้อน** (ในเครื่อง + บนคลาวด์) แก้คนละที่แล้วรวมกลับไม่ได้ ต้องเลือกก้อนเดียวเป็นตัวจริงเสมอ

รอบทดลองให้ทำแบบนี้แทน:
- ปล่อยฐานข้อมูลว่าง แล้วสร้าง user + ใบรีเควสปลอม 2–3 ใบด้วยมือ
- สร้าง admin บน Railway ด้วย `npx tsx prisma/create-user.ts admin <รหัส> ADMIN` (รันผ่าน Railway CLI: `railway run`)

ถ้าจะย้ายจริงทีหลัง ค่อยว่ากันเรื่องการอัป `dev.db` ขึ้น volume (ต้องใช้ Railway CLI + สคริปต์ครั้งเดียว — ยุ่งกว่าที่คิด เพราะไม่มีปุ่มอัปโหลดไฟล์)

---

## E. เช็คลิสต์ทดสอบหลัง deploy (ไล่ตามนี้)

- [ ] เปิด URL ได้ · หน้า login ขึ้น
- [ ] ล็อกอิน admin ได้
- [ ] ลงใบรีเควสใหม่ + **แนบไฟล์ 1 ไฟล์**
- [ ] **push commit เปล่า ๆ ให้ Railway deploy ใหม่ → กลับมาดูว่าใบรีเควสกับไฟล์แนบยังอยู่** ← **ข้อนี้คือหัวใจ**
- [ ] เปิด `/scan` จากมือถือ → กล้องเปิดได้ (Railway ให้ https มาแล้ว จึงควรผ่าน — ต่างจาก LAN http ที่กล้องถูกบล็อก)
- [ ] ดาวน์โหลด CSV จาก `/reports` → ลิงก์ในไฟล์ชี้มาที่โดเมน Railway ไม่ใช่ IP เก่า
- [ ] ดู **Usage** ใน Railway ว่าใช้เครดิตไปเท่าไร (เทียบกับที่ประเมิน ~$3/เดือนถ้ารัน 24 ชม.)
- [ ] เปิด **Settings → Serverless (App Sleeping)** แล้วดูว่าหลับจริงไหมหลังไม่มีคนเข้า 10 นาที

## F. เก็บกวาดหลังทดลอง

ถ้าตัดสินใจไม่ใช้ Railway: **ลบ project ทิ้ง** (ไม่งั้น volume ยังกินเครดิต $0.075/เดือนไปเรื่อย ๆ) และถอนสิทธิ์ Railway ออกจาก GitHub

## G. ตัดสินใจจากผลทดลอง

| ผล | แปลว่า |
|---|---|
| ทุกข้อผ่าน | ทางนี้ใช้ได้ → อยากเข้าได้ 24 ชม. โดยไม่เปิดคอม ก็อัป Hobby $5/เดือน |
| C1 build ไม่ผ่านบน free | ต้อง Hobby ตั้งแต่ต้น ทดลองฟรีไม่ได้ |
| ข้อมูลหายตอน deploy รอบสอง | volume ไม่ทำงาน → ต้องเปลี่ยนไป Postgres (งานใหญ่ ~1–2 วัน) |

**ทางเลือกที่ถูกกว่าและข้อมูลไม่ออกนอกบริษัท:** เอาแอปไปรันบน NAS + Cloudflare Tunnel → [แผน-ย้ายไป-nas-cloudflare.md](แผน-ย้ายไป-nas-cloudflare.md)
