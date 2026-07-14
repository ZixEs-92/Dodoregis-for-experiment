# Data Model — Dodoregis

> อัปเดต 2026-07-13: เปลี่ยนเป็นโครงสร้าง **1 ใบรีเควส → หลาย item** (แต่ละ item มีแผน/สถานะ/รีพอร์ทของตัวเอง)

รูปแบบเลข: ใบรีเควส `TR-YYMM-###` รันต่อเนื่องต่อเดือน · item `TR-YYMM-###-NN` (เช่น TR-2607-001-01)

## test_requests (หัวใบรีเควส — 1 แถวต่อ 1 ใบ, ข้อมูลที่ item ใช้ร่วมกัน)

| field | type | required | หมายเหตุ |
|---|---|---|---|
| regis_no | text, PK | ✓ | ระบบออกให้อัตโนมัติ |
| request_dept | FK master (dept) | ✓ | แผนกที่รีเควส |
| requester | text | ✓ | ชื่อ + ช่องทางติดต่อ |
| request_date | date | ✓ | วันที่ได้ใบรีเควส |
| remark | text | | หมายเหตุรวมของใบ |
| folder_url | url | | โฟลเดอร์งานใน Drive |

## test_items (1 แถวต่อ 1 ชิ้นงานที่ต้องทดสอบ — workflow อยู่ที่นี่)

| field | type | required | หมายเหตุ |
|---|---|---|---|
| id | PK | ✓ | |
| regis_no | FK test_requests | ✓ | ใบรีเควสที่สังกัด |
| item_no | integer | ✓ | 1..N ภายในใบ |
| item_code | text, unique | ✓ | `TR-YYMM-###-NN` ใช้เป็น QR/URL/ชื่อไฟล์ |
| part_name | text | ✓ | ชื่อชิ้นงาน/รุ่น Lamp |
| part_no | text | | |
| qty | integer | | จำนวนพาร์ท |
| part_received_date | date | | ว่าง = ยังไม่ได้รับพาร์ท |
| part_location | FK master (location) | | ตำแหน่งเก็บพาร์ท |
| test_detail | long text | ✓ | รายละเอียดเทส/มาตรฐาน (ต่าง item ต่างกันได้) |
| plan_start / plan_end | date | | plan จบใช้คำนวณ overdue |
| actual_start / actual_end | date | | ระบบเติมให้ตอนเปลี่ยนสถานะ |
| status | enum 10 ค่า | ✓ | workflow แยกต่อ item — ดู CLAUDE.md |
| status_before_hold | enum | | จำสถานะก่อน Hold เพื่อ resume |
| owner | FK master (member) | ✓ | ผู้รับผิดชอบหลักของ item |
| finished_part_location | FK master (location) | | ที่เก็บชิ้นงานหลังเสร็จ |
| raw_data_location | text | | ที่เก็บ raw data (ใช้ตอนปิดงาน) |
| remark | text | | "make รีพอร์ตเลย" = urgent flag |

## test_runs (1 แถวต่อการเทส 1 ครั้ง — ผูกกับ item)

| field | type | required | หมายเหตุ |
|---|---|---|---|
| id | PK | ✓ | |
| item_id | FK test_items | ✓ | |
| run_no | integer | ✓ | 1, 2, 3 … (retest) |
| start_date / end_date | date | | |
| loading_owner / test_owner | FK master (member) | | |
| result | enum | | Pass / Fail / Conditional Pass |
| rawdata_url | url/text | | ลิงก์โฟลเดอร์ raw data |
| remark | text | | |

## reports (1 รีพอร์ทต่อ item)

| field | type | required | หมายเหตุ |
|---|---|---|---|
| id | PK | ✓ | |
| item_id | FK test_items | ✓ | |
| status | enum | ✓ | ยังไม่เริ่ม / กำลังทำ / รออนุมัติ / ส่งแล้ว |
| sent_date | date | | |
| file_path | text | | ที่อยู่ไฟล์ (โฟลเดอร์กลาง) |
| report_url | url | | ลิงก์เปิดจากมือถือได้ |
| author / approver | FK master (member) | | |

## attachments (ไฟล์แนบ — metadata เท่านั้น, ไฟล์อยู่บนดิสก์/ลิงก์)

| field | type | required | หมายเหตุ |
|---|---|---|---|
| id | PK | ✓ | |
| request_no | FK test_requests | | แนบระดับใบ (email/ใบรีเควส) — nullable |
| item_id | FK test_items | | แนบระดับ item (รูป/สเปค) — nullable |
| kind | enum | | REQUEST_DOC / EMAIL / PHOTO / TEST_SPEC / OTHER |
| label | text | | คำอธิบาย |
| file_name / stored_name / mime_type / size_bytes | | | กรณีอัปโหลดไฟล์ (stored_name = ชื่อบนดิสก์) |
| url | url | | กรณีเป็นลิงก์ภายนอก |

## status_logs (audit trail — 1 แถวต่อการเปลี่ยนสถานะ 1 ครั้ง)

| field | type | หมายเหตุ |
|---|---|---|
| item_id | FK test_items | |
| from_status / to_status | enum | from_status = null คือสถานะแรกตอนสร้าง item |
| changed_by | text | ชื่อผู้เปลี่ยน (รอ auth — ตอนนี้ optional) |
| note | text | |
| changed_at | datetime | ใช้คำนวณเวลาในแต่ละสถานะ (คอขวด/aging/CFD) |

## location_logs (chain of custody — ประวัติการย้ายที่เก็บ)

| field | type | หมายเหตุ |
|---|---|---|
| item_id | FK test_items | |
| kind | enum | PART_LOCATION / FINISHED_LOCATION / RAW_DATA |
| from_name / to_name | text | เก็บชื่อ ณ ตอนย้าย (snapshot) |
| changed_by / note / changed_at | | |

## notifications (ศูนย์แจ้งเตือนในแอป)

| field | type | หมายเหตุ |
|---|---|---|
| kind | text | OVERDUE / DUE_SOON / STATUS_CHANGE |
| level | enum | INFO / WARNING / CRITICAL |
| message | text | |
| item_id | FK test_items | nullable |
| dedupe_key | text unique | กันสร้างซ้ำ (เช่น `OVERDUE:<id>:<yyyy-mm-dd>`) |
| read_at | datetime | null = ยังไม่อ่าน |

## Groundwork (schema พร้อม — ยังไม่เปิดใช้ UI: ฟีเจอร์ 5-7)
- **equipment** — เครื่องทดสอบ (name, code, type, location, calibration_due, active) · เชื่อม test_runs.equipment_id
- **test_methods** — คลัง method (code, name, standard, default_detail, active) · เชื่อม test_items.test_method_id
- **Department.sla_days** — เป้า lead time (วัน) สำหรับ TAT/SLA (แก้ที่ `/master`)
- **TestRequest.public_token** — token สำหรับ requester portal (อ่านอย่างเดียว)

## master_data (มีฟิลด์ `active` — ปิดใช้งานแทนการลบ, แก้ผ่านหน้า `/master`)
- departments: R&D, QA, Production, Engineering, Purchasing
- members: รายชื่อทีม + role
- part_locations: ชั้น A-1…, ห้อง Test 1…
- finished_locations: ชั้นงานเสร็จ B-1…, คืนแผนกผู้รีเควส, ทิ้ง/ทำลาย
- statuses: 10 ค่าตาม workflow / results: 3 ค่า / report_statuses: 4 ค่า

## Dashboard ที่ต้องมี
- นับงานแยกตามสถานะ | งานเลยกำหนด plan_end (ไม่นับ 8-ปิดงาน, 10-Cancel) | ครบกำหนดใน 7 วัน
- Workload ต่อคน (owner + loading_owner ของงานที่ยังไม่ปิด)
- KPI รายเดือน: lead time เฉลี่ย (request_date → sent_date), % ส่งตรง plan, จำนวน retest
