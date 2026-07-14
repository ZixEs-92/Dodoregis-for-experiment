export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24 text-muted">
      <span className="inline-block w-5 h-5 border-2 border-hairline border-t-ink rounded-full animate-spin mr-3" />
      <span className="text-[14px]">กำลังโหลด...</span>
    </div>
  );
}
