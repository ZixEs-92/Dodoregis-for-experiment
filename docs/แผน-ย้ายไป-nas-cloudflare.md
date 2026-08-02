# แผนย้าย Dodoregis ไปรันบน NAS + เปิดผ่าน Cloudflare Tunnel

> เขียน 2026-08-02 · เป้าหมาย: เข้าได้ 24 ชม. โดยไม่ต้องเปิดคอมทิ้งไว้ · ลิงก์ไม่เปลี่ยน · ข้อมูลไม่ออกนอกบริษัท

## สรุปคำตอบสั้น

**ทำได้ครับ และน่าจะเป็นทางที่ดีที่สุดสำหรับงานนี้** — แต่ "ได้หรือไม่ได้" ขึ้นกับ NAS รุ่นไหนล้วน ๆ

| NAS ที่ใช้ | รันได้ไหม | วิธี |
|---|---|---|
| **Synology x86** (DS2xx+/9xx+/RS ที่มี Container Manager) | ✅ ได้ | Docker |
| **QNAP** ที่มี Container Station | ✅ ได้ | Docker |
| **Windows Server / เครื่องพีซีที่ทำหน้าที่เป็น file server** | ✅ ได้ ง่ายที่สุด | ติดตั้ง Node + cloudflared ตรง ๆ เหมือนเครื่องปัจจุบัน |
| **TrueNAS / unRAID / Proxmox** | ✅ ได้ | Docker / LXC |
| **Synology รุ่น J-series (DS120j, DS220j) หรือ ARM รุ่นเล็ก** | ❌ ไม่ได้ | ไม่รองรับ Docker |
| **HDD ที่เสียบหลังเราเตอร์ / NAS ราคาถูกที่แชร์ไฟล์อย่างเดียว** | ❌ ไม่ได้ | รันโปรแกรมไม่ได้เลย |

> **ยังตอบไม่ได้ว่า `EVA-NAS02` เป็นแบบไหน** — ตอนเขียนนี้เครื่องไม่ได้ต่อเน็ตบริษัท (มีแต่ IP 169.254.x) เลย resolve ชื่อไม่เจอ ต้องทำ **Phase 0** ก่อน

### ทำไมทางนี้ดีกว่า Railway สำหรับงานนี้

| | NAS + Cloudflare | Railway Hobby |
|---|---|---|
| ค่าใช้จ่าย | ~350฿/ปี (แค่ค่าโดเมน) | ~2,100฿/ปี |
| เปิดคอมทิ้งไหม | **ไม่ต้อง** NAS เปิด 24 ชม.อยู่แล้ว | ไม่ต้อง |
| ลิงก์คงที่ | ✅ | ✅ |
| ข้อมูลงานทดสอบอยู่ที่ | **เซิร์ฟเวอร์บริษัท** | เซิร์ฟเวอร์ต่างประเทศ |
| ใกล้ไฟล์ raw data (`\\EVA-NAS02\EVA-Shared`) | **อยู่เครื่องเดียวกัน** | คนละที่ |
| แบ็กอัป | ใช้ snapshot/Hyper Backup ของ NAS ได้เลย | ต้องทำเอง |

---

## ⚠️ ข้อควรระวังที่สำคัญที่สุด — SQLite ห้ามวางบน network share

`dev.db` **ต้องอยู่บนดิสก์ในตัว NAS เอง** (volume ของ Docker) เท่านั้น
**ห้าม** วางไว้บน SMB/CIFS/NFS share แล้วให้แอปเปิดข้ามเน็ตเวิร์ก — การล็อกไฟล์ของ SQLite ทำงานไม่ถูกต้องบน network share และ **ทำให้ฐานข้อมูลพังถาวรได้**

(ไฟล์ raw data ก้อนใหญ่ที่อยู่บน share ไม่เกี่ยว — ระบบเก็บแค่ "พาธ" เป็นข้อความ ไม่ได้เปิดไฟล์)

---

## Phase 0 — ระบุก่อนว่า NAS เป็นอะไร (ทำตอนอยู่ที่บริษัท)

รันใน PowerShell:
```powershell
# 1) IP ของ NAS
Resolve-DnsName EVA-NAS02

# 2) เปิดพอร์ตอะไรอยู่บ้าง — บอกยี่ห้อได้เลย
5000/5001 = Synology DSM · 8080 = QNAP · 3389 = Windows Server · 22 = SSH (Linux)
foreach ($p in 22,80,443,445,3389,5000,5001,8080) {
  "port $p : " + (Test-NetConnection EVA-NAS02 -Port $p -InformationLevel Quiet)
}

# 3) ระบบปฏิบัติการที่แชร์ไฟล์ออกมา
net view \\EVA-NAS02
```

**ข้อมูลที่ต้องได้ก่อนไปต่อ:**
- [ ] ยี่ห้อ/รุ่น NAS (ดูที่ตัวเครื่อง หรือหน้า login ของ DSM/QNAP)
- [ ] CPU เป็น x86_64 หรือ ARM (`uname -m` ถ้า ssh เข้าได้)
- [ ] RAM เท่าไร — **ต้องเหลือให้แอปอย่างน้อย 512 MB** (แนะนำ 1 GB)
- [ ] มี Container Manager / Container Station / Docker ไหม
- [ ] เรามีสิทธิ์ admin บน NAS ไหม หรือต้องขอ IT
- [ ] **IT อนุญาตให้ NAS ต่อออกอินเทอร์เน็ตไหม** (Cloudflare Tunnel ต่อขาออก port 443 — ปกติผ่าน firewall ได้ แต่ควรขออนุญาตก่อน)

---

## Phase 1 — เตรียมแอปให้รันใน Docker

### 1.1 แก้โค้ด 1 จุด (เหมือนแผน Railway)
`webapp/src/lib/uploads.ts:7` — ให้ path ไฟล์แนบตั้งค่าได้:
```ts
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
```

### 1.2 เปิด standalone output
`webapp/next.config.ts` เพิ่ม `output: "standalone"` → ได้ image เล็กลงมาก (ไม่ต้องยก `node_modules` ทั้งก้อนขึ้น NAS)

### 1.3 `webapp/Dockerfile`
```dockerfile
# ---------- build ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
# better-sqlite3 เป็น native module — ต้องมีเครื่องมือ build เผื่อไม่มี prebuild
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---------- run ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# ต้องมีไว้รัน migrate ตอนสตาร์ท
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

> **ต้องทดสอบ:** standalone จะ trace ไฟล์ `.node` ของ better-sqlite3 มาให้ครบไหม ถ้าไม่ครบ ให้ตัด standalone ออกแล้วใช้ image เต็ม (ใหญ่ขึ้นแต่ชัวร์กว่า)

### 1.4 `docker-compose.yml` (วางบน NAS)
```yaml
services:
  dodoregis:
    image: dodoregis:latest
    container_name: dodoregis
    restart: unless-stopped          # NAS รีบูต/อัปเดตแล้วขึ้นเอง
    environment:
      DATABASE_URL: "file:/data/dev.db"
      UPLOAD_DIR: "/data/uploads"
      AUTH_SECRET: "<สุ่มยาว ๆ 64 ตัว>"
      TZ: "Asia/Bangkok"
    volumes:
      - /volume1/docker/dodoregis/data:/data      # ← ดิสก์ในตัว NAS เท่านั้น
    expose:
      - "3000"                        # ไม่ต้อง publish ออก LAN ก็ได้ ให้ tunnel คุยภายใน

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: dodoregis-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CF_TUNNEL_TOKEN}
    depends_on: [dodoregis]
```

**ทำไม cloudflared อยู่ใน compose เดียวกัน:** สองคอนเทนเนอร์เห็นกันผ่านชื่อ `dodoregis` → ตั้ง tunnel ให้ชี้ `http://dodoregis:3000` ได้เลย ไม่ต้องเปิดพอร์ตออก LAN

### 1.5 สร้าง image
NAS ส่วนใหญ่ build เองช้า/RAM ไม่พอ → **build บนคอมแล้วยกไฟล์ไป**
```powershell
cd webapp
docker build -t dodoregis:latest .
docker save dodoregis:latest -o dodoregis.tar
# ก๊อป dodoregis.tar ขึ้น NAS แล้วบน NAS สั่ง:  docker load -i dodoregis.tar
```
> ถ้า NAS เป็น **ARM64** ต้อง build ข้ามสถาปัตยกรรม:
> `docker buildx build --platform linux/arm64 -t dodoregis:latest --load .`

---

## Phase 2 — ย้ายข้อมูลจริงขึ้น NAS (ทำครั้งเดียว ต้องระวังที่สุด)

**หลักการ: ตอนย้าย ต้องไม่มีใครใช้งานทั้งสองฝั่ง และต้องมีทางถอยเสมอ**

1. **ปิดแอปในเครื่องก่อน** (SQLite ต้องไม่ถูกเปิดค้าง ไม่งั้นก๊อปได้ไฟล์ที่ไม่สมบูรณ์)
2. สำรองไว้ 2 ชุด:
   ```powershell
   Copy-Item webapp\dev.db "dev.db.before-nas-$(Get-Date -f yyyyMMdd)"
   Compress-Archive webapp\uploads "uploads-before-nas.zip"
   ```
3. ก๊อป `dev.db` + `uploads/` ไปวางที่ `/volume1/docker/dodoregis/data/` บน NAS
4. `docker compose up -d` แล้วเข้าเว็บเช็ค **ก่อนจะเชื่อ**:
   - จำนวนใบรีเควสตรงกับของเดิม
   - เปิดไฟล์แนบเดิมได้ (ทดสอบ path `UPLOAD_DIR` จริง)
   - ล็อกอินได้ทุกบัญชี
5. **ประกาศให้ทีมทราบว่าตัวจริงย้ายไปอยู่ NAS แล้ว** — จากนี้ห้ามเปิดแอปในเครื่องตัวเองแก้ข้อมูลอีก (จะกลายเป็นข้อมูล 2 ก้อนที่รวมกลับไม่ได้)
6. เปลี่ยนชื่อ `webapp\dev.db` ในเครื่องเป็น `dev.db.retired-YYYYMMDD` กันเผลอ

---

## Phase 3 — Cloudflare Tunnel แบบลิงก์ถาวร

ต่างจาก quick tunnel ที่ใช้ทดลองอยู่ตอนนี้ (`xxx.trycloudflare.com` เปลี่ยนทุกครั้งที่รีสตาร์ท) — **Named Tunnel ลิงก์คงที่ตลอดไป**

1. ต้องมีโดเมนใน Cloudflare (โดเมนบริษัท หรือซื้อใหม่ ~$10/ปี) และย้าย nameserver มาที่ Cloudflare
2. Zero Trust → **Networks → Tunnels → Create a tunnel** → เลือก **Cloudflared** → ตั้งชื่อ `dodoregis`
3. Cloudflare จะให้ **token** มา → เอาไปใส่ `CF_TUNNEL_TOKEN` ใน compose (ไม่ต้องใช้ config.yml ให้ยุ่ง)
4. หน้า **Public Hostname** ตั้ง:
   - Subdomain `dodoregis` · Domain `บริษัท.com`
   - Service **HTTP** → `dodoregis:3000`
5. `docker compose up -d` → เปิด `https://dodoregis.บริษัท.com` จากมือถือนอกออฟฟิศ

### Phase 3.5 — กั้นด้วย Cloudflare Access (ต้องทำ)
แอปนี้ **เปิดให้ดูโดยไม่ต้องล็อกอินโดยตั้งใจ** (เพื่อสแกน QR แล้วเปิดดูได้เลย) → ถ้าเปิดสู่อินเทอร์เน็ตดิบ ๆ ใครได้ลิงก์ก็เห็นงานทดสอบทั้งหมด

Zero Trust → **Access → Applications → Add** → Self-hosted → โดเมนข้างบน → Policy: อนุญาตเฉพาะอีเมล/โดเมนอีเมลบริษัท (ฟรีถึง 50 คน)

> **ผลข้างเคียงที่ต้องยอมรับ:** คนสแกน QR จากมือถือจะต้องยืนยันอีเมลก่อนเข้า (จำได้ ~1 เดือน/เครื่อง) ถ้ารับไม่ได้ ทางเลือกคือให้เข้าจากในวง LAN บริษัทเท่านั้นแล้วไม่ต้องเปิดออกเน็ต

---

## Phase 4 — แบ็กอัป (ทำพร้อมกันเลย ค้างมานานแล้ว)

ข้อดีของการอยู่บน NAS คือใช้ของที่ NAS มีอยู่แล้วได้:
- **Snapshot ของ Btrfs** (Synology) ตั้งถ่ายวันละครั้ง เก็บ 30 วัน
- หรือ **Hyper Backup** ไปดิสก์ลูกที่สอง / cloud
- เพิ่มความชัวร์: cron ในคอนเทนเนอร์รัน `sqlite3 /data/dev.db ".backup /data/backup/dev-$(date +%F).db"` วันละครั้ง — วิธีนี้ได้ไฟล์ที่ consistent แม้แอปกำลังเขียนอยู่ (ต่างจากการ copy เฉย ๆ)

---

## Phase 5 — เช็คลิสต์ก่อนบอกว่าเสร็จ

- [ ] NAS รีบูตแล้วแอปขึ้นเอง (`restart: unless-stopped`) และลิงก์ยังเป็นตัวเดิม
- [ ] ล็อกอินได้ทุก role · ลงใบรีเควส + แนบไฟล์ + เปลี่ยนสถานะได้
- [ ] `/scan` เปิดกล้องได้จากมือถือ (https ผ่าน Cloudflare → ผ่าน)
- [ ] QR label เดิมที่ติดชิ้นงานอยู่ยังสแกนได้ (ต้องผ่าน เพราะ `QR_MODE=code` เก็บแค่รหัสงาน ไม่ผูก URL — **ไม่ต้องพิมพ์ label ใหม่**)
- [ ] CSV export ลิงก์ชี้โดเมนใหม่
- [ ] ทดสอบกู้คืน: ก๊อป backup ออกมากางในเครื่อง แล้วเปิดดูได้จริง (backup ที่ไม่เคยกู้ = ไม่มี backup)
- [ ] ทางถอย: ถ้าพัง → `docker compose down` + กลับไปรันในเครื่องด้วย `dev.db.before-nas-*`

---

## ความเสี่ยงที่ต้องรู้ล่วงหน้า

| ความเสี่ยง | ผลกระทบ | วิธีคุม |
|---|---|---|
| วาง `dev.db` บน network share | **DB พังถาวร** | ต้องเป็น local volume ของ NAS เท่านั้น |
| NAS แรมน้อย (2 GB และมีบริการอื่นอยู่) | แอปโดน OOM kill เป็นระยะ | จำกัด `mem_limit: 768m` แล้วเฝ้าดู |
| DSM/QNAP อัปเดตใหญ่ | คอนเทนเนอร์หายหรือไม่ขึ้น | มี compose file เก็บไว้ + สั่ง `up -d` ใหม่ได้ |
| IT ไม่อนุญาตให้ NAS ต่อออกเน็ต | ทำ tunnel ไม่ได้ | ใช้แค่ใน LAN + Tailscale บนมือถือแทน |
| ข้อมูล 2 ก้อน (เครื่อง + NAS) | ข้อมูลหายเงียบ ๆ | Phase 2 ข้อ 5–6 — เลิกใช้ก้อนในเครื่องเด็ดขาด |

---

## ขั้นตอนถัดไป

รอผล **Phase 0** — บอกผมว่า NAS เป็นยี่ห้อ/รุ่นอะไร มี Docker ไหม แล้วผมจะเขียน Dockerfile + compose ตัวจริงที่ตรงกับเครื่องนั้นให้ พร้อมทดสอบ build ในเครื่องก่อนยกขึ้น NAS

ระหว่างรอ ทำได้เลยโดยไม่ต้องรู้รุ่น NAS: **แก้ `UPLOAD_DIR` (Phase 1.1)** เพราะใช้ร่วมกันทั้งทาง Railway และทาง NAS
