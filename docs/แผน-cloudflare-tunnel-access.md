# แผน + วิเคราะห์ความเป็นไปได้: Cloudflare Tunnel + Access

> อัปเดต 2026-07-14 · เป้าหมาย: ให้เข้า Dodoregis จากมือถือ/นอกออฟฟิศได้ (สแกน QR เปิดหน้างานได้) โดยแอปยังรันบนเครื่องในออฟฟิศ + มีหน้า login กั้น

## สรุปผู้บริหาร (TL;DR)

- **เป็นไปได้จริง และเข้ากับ workflow QR ของเราดีที่สุด** ✅ — สแกนสติกเกอร์ด้วยกล้องมือถือ → เปิด URL → login → เห็นหน้างาน (ทำงานบนเบราว์เซอร์ ไม่ต้องลงแอป)
- **เกือบฟรี:** Tunnel ฟรี 100% (unmetered) · Access (หน้า login) ฟรี **≤ 50 users** · จ่ายแค่ **ค่าโดเมน ~100–500 บาท/ปี**
- **แก้จุดอ่อนใหญ่ของแอปได้:** ได้ HTTPS อัตโนมัติ + มี login wall (email OTP) ชดเชยที่แอปยังไม่มี auth
- **กับดักหลัก:** เครื่องในออฟฟิศต้อง**เปิดค้าง + เน็ตเสถียร 24/7** (เป็น single point of failure) และ **ข้อมูล/แบ็กอัปยังเป็นภาระเราเอง**

---

## 1. สถาปัตยกรรม

```
[มือถือ/PC ที่ไหนก็ได้]
      │  https://dodoregis.<โดเมนคุณ>
      ▼
[Cloudflare edge]  ── Access (หน้า login: email OTP) ──►  ผ่านแล้วเท่านั้นถึงวิ่งต่อ
      ▲  (outbound-only tunnel — ไม่เปิดพอร์ต ไม่ต้องมี public IP)
      │
[เครื่องออฟฟิศ]  cloudflared  ──►  Next.js (localhost:3000)  ──►  SQLite dev.db + uploads/
```

- `cloudflared` เปิดการเชื่อมต่อ **ออกจากเครื่อง**ไปหา Cloudflare (ไม่ต้องเปิดพอร์ตที่ router / ไม่ต้องขอ public IP)
- Cloudflare ให้ **HTTPS + DDoS/WAF** ฟรีในตัว
- QR ฝัง `https://dodoregis.<โดเมน>/items/<code>` → `APP_BASE_URL` ตั้งเป็นโดเมนนี้

---

## 2. ความเป็นไปได้ (feasibility)

| ประเด็น | สถานะ | หมายเหตุ |
|---|---|---|
| เข้าจากนอกออฟฟิศ / มือถือทุกที่ | ✅ | ผ่านเบราว์เซอร์ ไม่ต้องลงแอป |
| สแกน QR สติกเกอร์ → เปิดหน้างาน | ✅ | ตรงกับ use case สุด (ดีกว่า Power Apps/Tailscale) |
| HTTPS สำหรับ QR | ✅ ฟรีอัตโนมัติ | แก้ปัญหา QR ต้องเป็น https |
| Login wall (แอปไม่มี auth) | ✅ Access email OTP | ล็อกอิน 1 ครั้งต่อ session |
| ไม่ต้องแก้โค้ดแอป | ✅ (เกือบ) | แค่ตั้ง `APP_BASE_URL` |
| ค่าใช้จ่าย | ~ค่าโดเมนปีละไม่กี่ร้อยบาท | Tunnel + Access ฟรี |

---

## 3. ต้องมีอะไรบ้าง

1. **โดเมน** (จำเป็นสำหรับ named tunnel + Access) — ซื้อโดเมนถูก ๆ แล้วย้าย nameserver มา Cloudflare (แผนฟรี) · *ถ้าไม่มีโดเมน ใช้ Quick Tunnel `trycloudflare.com` ได้แต่ URL เปลี่ยนทุกครั้ง + ตั้ง Access ไม่ได้ → ไม่เหมาะใช้จริง*
2. **บัญชี Cloudflare** (ฟรี) + เปิด Zero Trust org (ฟรี)
3. **`cloudflared`** ติดตั้งบนเครื่องออฟฟิศ (รันเป็น Windows service)
4. **เครื่องออฟฟิศเปิดค้าง** รันแอป (`npm run start`) + `cloudflared` ตลอด + เน็ตเสถียร
5. **รายชื่ออีเมลทีม** สำหรับ allowlist ใน Access

---

## 4. แผนปฏิบัติ (phased checklist)

**Phase 0 — เตรียมแอปให้รันแบบ production บนเครื่องออฟฟิศ**
- [ ] `npm run build` แล้วรันด้วย `npm run start` (เสถียรกว่า dev)
- [ ] ตั้ง `APP_BASE_URL=https://dodoregis.<โดเมน>` ใน `.env`
- [ ] ทำให้แอปเปิดอัตโนมัติเมื่อเปิดเครื่อง (Windows: NSSM / Task Scheduler / pm2-windows) — กันเครื่อง reboot แล้วดับ
- [ ] ตั้งแบ็กอัป `dev.db` + `uploads/` อัตโนมัติ (คัดลอกรายวัน)

**Phase 1 — โดเมน + Cloudflare**
- [ ] ซื้อโดเมน → เพิ่มเข้า Cloudflare (แผนฟรี) → เปลี่ยน nameserver
- [ ] เปิด Cloudflare Zero Trust (ฟรี)

**Phase 2 — Tunnel**
- [ ] ติดตั้ง `cloudflared` บนเครื่อง → `cloudflared tunnel login`
- [ ] สร้าง named tunnel → เพิ่ม public hostname `dodoregis.<โดเมน>` ชี้ไป `http://localhost:3000`
- [ ] ติดตั้ง `cloudflared` เป็น **service** (`cloudflared service install`) ให้รันตลอด

**Phase 3 — Access (หน้า login)**
- [ ] Zero Trust → Access → Add application (self-hosted) = `dodoregis.<โดเมน>`
- [ ] Policy: allow เฉพาะอีเมลทีม (หรือทั้งโดเมนบริษัท) · วิธี login = **Email OTP** (ไม่ต้องมี IdP) หรือ Google
- [ ] ตั้ง **session duration ยาว ๆ** (เช่น 7–30 วัน) เพื่อลดการ login ซ้ำตอนสแกน QR

**Phase 4 — QR + ตรวจรับ**
- [ ] พิมพ์ QR ใหม่ให้ชี้โดเมนสาธารณะ (จาก `APP_BASE_URL`)
- [ ] ทดสอบสแกนจากมือถือที่ปิด Wi-Fi ออฟฟิศ → login → เปิดหน้างานได้
- [ ] ทดสอบ reboot เครื่อง → แอป + tunnel กลับมาเองอัตโนมัติ

---

## 5. ข้อจำกัด / ความเสี่ยง

1. **เครื่องออฟฟิศต้องเปิด + เน็ตเสถียร 24/7** — เครื่อง sleep/รีบูต/เน็ตหลุด = เว็บล่ม (single point of failure) → ต้องตั้ง auto-start + ปิด sleep + สำรองเน็ต
2. **ต้องมีโดเมน** (~ปีละไม่กี่ร้อยบาท) — ไม่ฟรี 100% (แต่ถูกมาก)
3. **ข้อมูล/แบ็กอัปเป็นภาระเราเอง** — `dev.db` + `uploads/` อยู่บนเครื่อง ต้องตั้งสำรองเอง
4. **Access กับการสแกน QR = ต้อง login** — คนที่สแกนต้องอยู่ใน allowlist และ login (มี session cookie) · **คนนอก/vendor สแกนไม่ได้** เว้นแต่เพิ่มเข้า policy หรือส่ง one-time PIN → เหมาะกับทีมภายใน ไม่เหมาะให้บุคคลทั่วไปสแกน
5. **Access ฟรี ≤ 50 users** — เกินนั้น ~$7/user/เดือน (ทีม lab ไม่ถึงอยู่แล้ว)
6. **SQLite single-writer** — เขียนพร้อมกันเข้าคิว (ไหวที่ 1–10 คน แต่ปิดทาง scale) — ไม่เกี่ยว Cloudflare แต่เป็นข้อจำกัดของ setup รวม
7. **แอปยังไม่มี auth ในตัว** — ถ้าวันไหนปิด Access (เช่นอยาก public) จะไม่มีอะไรกั้นเลย → ควรทำ auth ในแอป (backlog) เป็นชั้นที่สอง
8. **latency เพิ่มเล็กน้อย** จากวิ่งผ่าน edge (Cloudflare มี PoP ที่กรุงเทพฯ — ปกติไม่รู้สึก)
9. **ToS ฟรีของ Cloudflare** จำกัดการเสิร์ฟไฟล์มีเดียใหญ่จำนวนมาก (วิดีโอ) — แอปเราเป็น HTML/รูป/PDF เล็ก ไม่ติด

---

## 6. ค่าใช้จ่าย

| รายการ | ต้นทุน |
|---|---|
| Cloudflare Tunnel | ฟรี (unmetered) |
| Cloudflare Access (login wall) | ฟรี ≤ 50 users |
| โดเมน | ~100–500 บาท/ปี (ค่าเดียวที่ต้องจ่าย) |
| Hosting | ฟรี (เครื่องออฟฟิศ) + ค่าไฟ |
| **รวม** | **~ปีละไม่กี่ร้อยบาท** |

---

## 7. เหมาะ / ไม่เหมาะ

- **เหมาะ:** lab ภายในที่มีเครื่องเปิดค้างได้ อยากเข้าจากนอกออฟฟิศ + สแกน QR จากเบราว์เซอร์ + มี login กั้น โดยจ่ายน้อยสุด
- **ไม่เหมาะถ้า:** เครื่องเปิดค้าง 24/7 ไม่ได้ / อยากได้ cloud จัดการให้แบบไม่ต้องดูแล (→ Railway Hobby หรือย้าย Vercel+Postgres) / ต้องให้บุคคลทั่วไปสแกน QR แบบไม่ต้อง login (→ ต้องทำ auth ในแอปแล้วปิด Access)

---

## 8. เทียบกับตัวเลือกอื่นสั้น ๆ
- **LAN:** ฟรีสุด แต่เข้าได้เฉพาะในออฟฟิศ
- **Tailscale:** ฟรี ปลอดภัยสุด แต่ทุกมือถือต้องลงแอป + สแกน QR โดยคนนอก tailnet ไม่ได้
- **Cloudflare Tunnel + Access:** จ่ายค่าโดเมนนิดเดียว แลกกับ **สแกน QR จากเบราว์เซอร์ได้ทุกที่ + มี login** ← สมดุลดีสุดถ้าต้องเข้าจากนอกออฟฟิศ
- **Railway Hobby ($5/เดือน):** ถ้าไม่อยากพึ่งเครื่องออฟฟิศเปิดค้าง

---

## Sources
- [Cloudflare Tunnel (docs)](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) · [Tunnels FAQ](https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/)
- [Cloudflare Access / Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/)
