export function FormErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="bg-coral-soft border border-coral/30 text-coral rounded-lg p-3.5 text-[13px]">
      <ul className="list-disc list-inside flex flex-col gap-0.5">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

export function FormSaved({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="bg-forest-soft border border-forest/20 text-forest rounded-lg px-3.5 py-2.5 text-[13px] font-medium">
      ✓ บันทึกเรียบร้อยแล้ว
    </div>
  );
}
