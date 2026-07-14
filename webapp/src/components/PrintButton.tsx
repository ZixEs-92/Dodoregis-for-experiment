"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary btn-sm">
      พิมพ์
    </button>
  );
}
