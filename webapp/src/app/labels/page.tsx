import { prisma } from "@/lib/prisma";
import { generateQrDataUrl } from "@/lib/qr";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "พิมพ์ QR Label — Dodoregis" };

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const sp = await searchParams;
  const ids = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const items = await prisma.testItem.findMany({
    where: { itemCode: { in: ids } },
  });
  // keep the order the user selected
  const ordered = ids
    .map((id) => items.find((it) => it.itemCode === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));

  const labels = await Promise.all(
    ordered.map(async (it) => ({
      itemCode: it.itemCode,
      partName: it.partName,
      qr: await generateQrDataUrl(`/items/${it.itemCode}`, 160),
    }))
  );

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

      {labels.length === 0 && (
        <p className="no-print text-muted">ไม่พบงานที่เลือก</p>
      )}

      <div className="label-sheet">
        {labels.map((l) => (
          <div className="label" key={l.itemCode}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.qr} alt={l.itemCode} className="label-qr" />
            <div className="label-text">
              <div className="label-regis">{l.itemCode}</div>
              <div className="label-part">{l.partName}</div>
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
