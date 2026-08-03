import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { guardPageTeam } from "@/lib/guard";
import { generateQrDataUrl, qrMode } from "@/lib/qr";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "พิมพ์ QR Label — Dodoregis" };

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; regis?: string }>;
}) {
  await guardPageTeam("/labels");
  const sp = await searchParams;
  const regisList = (sp.regis ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ids = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  let labels: { code: string; part: string; qr: string }[] = [];

  if (regisList.length > 0) {
    // QR ระดับใบรีเควส (ชี้ไปหน้า hub /requests/[regis])
    const requests = await prisma.testRequest.findMany({
      where: { regisNo: { in: regisList } },
      include: { items: { orderBy: { itemNo: "asc" }, take: 1 } },
    });
    const ordered = regisList
      .map((r) => requests.find((req) => req.regisNo === r))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
    labels = await Promise.all(
      ordered.map(async (req) => ({
        code: req.regisNo,
        part: req.items[0]?.partName ?? `${req.regisNo}`,
        qr: await generateQrDataUrl(`/requests/${req.regisNo}`, 160),
      }))
    );
  } else {
    // QR ระดับ item (ชี้ไปหน้า item)
    const items = await prisma.testItem.findMany({ where: { itemCode: { in: ids } } });
    const ordered = ids
      .map((id) => items.find((it) => it.itemCode === id))
      .filter((it): it is NonNullable<typeof it> => Boolean(it));
    labels = await Promise.all(
      ordered.map(async (it) => ({
        code: it.itemCode,
        part: it.partName,
        qr: await generateQrDataUrl(`/items/${it.itemCode}`, 160),
      }))
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-medium text-ink sm:text-[26px]">
            พิมพ์ QR Label ({labels.length})
          </h1>
          <p className="text-[14px] text-muted mt-0.5">ขนาดฉลาก 50×25 มม.</p>
        </div>
        <PrintButton />
      </div>

      {qrMode() === "code" ? (
        <div className="no-print card p-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="text-ink font-medium">📷 QR นี้เก็บ &quot;รหัสงาน&quot; ไม่ใช่ลิงก์</span>
          <span className="text-muted">
            — พิมพ์ครั้งเดียวใช้ได้ตลอด ถึงจะย้ายเซิร์ฟเวอร์/เปลี่ยนโดเมนก็ไม่ต้องพิมพ์ใหม่ ·
            สแกนที่หน้า
          </span>
          <Link href="/scan" className="text-link hover:underline">สแกน QR ในแอป</Link>
        </div>
      ) : (
        <div className="no-print card p-4 text-[13px] text-muted">
          🔗 QR นี้เก็บ URL เต็ม (กล้องมือถือปกติสแกนแล้วเปิดได้เลย) —
          ถ้าที่อยู่เว็บเปลี่ยน label ที่พิมพ์ไปแล้วจะชี้ที่อยู่เก่า
        </div>
      )}

      {labels.length === 0 && (
        <p className="no-print text-muted">ไม่พบงานที่เลือก</p>
      )}

      <div className="label-sheet">
        {labels.map((l) => (
          <div className="label" key={l.code}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.qr} alt={l.code} className="label-qr" />
            <div className="label-text">
              <div className="label-regis">{l.code}</div>
              <div className="label-part">{l.part}</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .label-sheet {
          display: flex;
          flex-wrap: wrap;
          gap: 3mm;
        }
        .label {
          width: 50mm;
          height: 25mm;
          border: 1px dashed #9297a0;
          display: flex;
          align-items: center;
          gap: 2mm;
          padding: 2mm;
          box-sizing: border-box;
          page-break-inside: avoid;
        }
        .label-qr {
          width: 20mm;
          height: 20mm;
          flex-shrink: 0;
        }
        .label-text {
          overflow: hidden;
          font-family: Arial, Helvetica, sans-serif;
        }
        .label-regis {
          font-size: 9pt;
          font-weight: 600;
          color: #181d26;
          white-space: nowrap;
        }
        .label-part {
          font-size: 7pt;
          line-height: 1.2;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }

        @media print {
          @page {
            size: 50mm 25mm;
            margin: 0;
          }
          .label {
            border: none;
            width: 50mm;
            height: 25mm;
            break-after: page;
          }
          .label:last-child {
            break-after: auto; /* กันหน้าเปล่าท้ายชุด */
          }
        }
      `}</style>
    </div>
  );
}
