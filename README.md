# Dodoregis-for-experiment

ระบบลงทะเบียนและติดตามงานทดสอบ (Test Request Registration & Tracking) สำหรับทีมวิศวกรทดสอบ 1–10 คน

## โครงสร้าง

```
├── CLAUDE.md        ← context หลักของโปรเจค (Claude Code อ่านอัตโนมัติ)
├── docs/
│   ├── แผนโปรเจค_ระบบลงทะเบียนติดตามงานทดสอบ.docx   ← แผนฉบับเต็ม 8 หัวข้อ
│   ├── data-model.md                                  ← spec ตาราง/ฟิลด์ทั้งหมด
│   └── โครงสร้างโปรเจค-webapp.md                       ← คู่มือ + โครงสร้าง webapp + backlog
├── webapp/          ← Phase 2: Web app (Next.js + SQLite/Prisma + Tailwind) ★ ตัวหลัก
│   └── README.md                                       ← วิธีรัน + รายละเอียดฟีเจอร์
├── template/        ← Phase 1: Google Sheets (พร้อมใช้แล้ว)
│   ├── Template_ระบบRegis_งานทดสอบ.xlsx               ← อัปโหลดเข้า Google Sheets
│   └── Code.gs                                        ← Apps Script (เมนู regis อัตโนมัติ)
└── prompts/         ← prompt สำเร็จรูปที่ใช้สร้าง/ต่อยอด
```

## เริ่มยังไง

**Web app (Phase 2 — ตัวหลัก):**
```bash
cd webapp
npm install
npm run dev        # เปิด http://localhost:3000
```
ฟีเจอร์: multi-item, master data, ไฟล์แนบ, QR label, audit trail + chain of custody, TAT/SLA,
แจ้งเตือน (in-app + webhook/LINE), หน้า analytics (คอขวด/aging WIP/CFD) — รายละเอียดใน `webapp/README.md`

**Google Sheets (Phase 1 — ใช้เร็วใน ~15 นาที):** ทำตามชีท "อ่านก่อน" ใน xlsx — อัปโหลดเข้า Google Sheets + ติดตั้ง Code.gs
