"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

/**
 * หน้าสแกน QR ภายในแอป (ทดลอง / เพิ่มเติม — ไม่กระทบ QR เดิมหรือหน้าอื่น)
 *
 * แนวคิด: QR ที่มีอยู่ฝัง "URL เต็ม" (เช่น http://host/items/TR-2607-001-01)
 * หน้านี้อ่าน QR แล้วดึงเฉพาะ "path" (/items/... หรือ /requests/...) มา navigate
 * ภายในแอป → ใช้ได้แม้โดเมน/URL ของแอปจะเปลี่ยน โดยไม่ต้องพิมพ์ QR ใหม่
 *
 * ถอด QR: ใช้ BarcodeDetector ถ้ามี (Android/Chrome) — เร็วกว่า
 *         ถ้าไม่มี (iPhone/Safari) fallback มาใช้ jsQR อ่านจาก canvas
 * เปิดกล้องด้วย getUserMedia เหมือนกันทั้งคู่ (ต้องเป็น https หรือ localhost)
 */

/** แปลงข้อความที่สแกนได้ → path ภายในแอป (คืน null ถ้าไม่ใช่ของ Dodoregis) */
export function resolveTarget(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;

  // 1) มี /items/<code> หรือ /requests/<code> อยู่ในข้อความ (ครอบคลุม URL เต็มของเดิม)
  const seg = raw.match(/\/(items|requests)\/([^/?#\s]+)/i);
  if (seg) {
    const kind = seg[1].toLowerCase();
    const code = decodeURIComponent(seg[2]);
    return `/${kind}/${encodeURIComponent(code)}`;
  }

  // 2) เป็น URL เต็ม → ใช้เฉพาะ pathname (เผื่อ path อื่นในแอป)
  try {
    const u = new URL(raw);
    if (u.pathname && u.pathname !== "/") return u.pathname + u.search;
  } catch {
    /* ไม่ใช่ URL — ไปต่อ */
  }

  // 3) เก็บแค่รหัสล้วน: item = TR-YYMM-###-##, request = TR-YYMM-###
  const code = raw.toUpperCase();
  if (/^TR-\d{4}-\d{3}-\d{1,}$/.test(code)) return `/items/${encodeURIComponent(code)}`;
  if (/^TR-\d{4}-\d{3}$/.test(code)) return `/requests/${encodeURIComponent(code)}`;

  return null;
}

type DetectedBarcode = { rawValue: string };
type Detector = { detect: (src: CanvasImageSource) => Promise<DetectedBarcode[]> };
type DetectorCtor = new (opts?: { formats?: string[] }) => Detector;

function getDetectorCtor(): DetectorCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { BarcodeDetector?: DetectorCtor };
  return w.BarcodeDetector ?? null;
}

type Phase = "idle" | "starting" | "scanning" | "found" | "error";

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  /** อ่าน QR จากเฟรมกล้องปัจจุบัน คืน rawValue หรือ null (เลือก decoder ตอน start) */
  const scanFrameRef = useRef<(() => Promise<string | null>) | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string>("");
  const [cameraSupported, setCameraSupported] = useState<boolean>(true);
  const [manual, setManual] = useState<string>("");

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    scanFrameRef.current = null;
  }, []);

  const goTo = useCallback(
    (target: string) => {
      stopCamera();
      setPhase("found");
      setMsg("พบแล้ว — กำลังเปิด…");
      router.push(target);
    },
    [router, stopCamera],
  );

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      setPhase("error");
      setMsg("เปิดกล้องไม่ได้ (ต้องเปิดผ่าน https หรือ localhost) — กรอกรหัสด้านล่างแทนได้");
      return;
    }

    setPhase("starting");
    setMsg("กำลังเปิดกล้อง…");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch {
      setPhase("error");
      setMsg("ไม่ได้รับอนุญาตให้ใช้กล้อง หรือเปิดกล้องไม่สำเร็จ — กด Allow แล้วลองใหม่ หรือกรอกรหัสด้านล่าง");
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* iOS บางทีต้องรอ metadata — ปล่อยให้ loop เช็ค readyState เอง */
    }

    // เลือก decoder: BarcodeDetector ถ้ามี (เร็วกว่า) ไม่งั้น jsQR
    const Ctor = getDetectorCtor();
    if (Ctor) {
      const det = new Ctor({ formats: ["qr_code"] });
      scanFrameRef.current = async () => {
        const v = videoRef.current;
        if (!v || v.readyState < 2) return null;
        const codes = await det.detect(v);
        return codes.length ? codes[0].rawValue : null;
      };
    } else {
      scanFrameRef.current = async () => {
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas || v.readyState < 2 || !v.videoWidth) return null;
        // ย่อภาพลงเพื่อความเร็ว (jsQR อ่านได้สบายที่ ~640px)
        const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
        const w = Math.max(1, Math.round(v.videoWidth * scale));
        const h = Math.max(1, Math.round(v.videoHeight * scale));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(v, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        return code ? code.data : null;
      };
    }

    setPhase("scanning");
    setMsg("เล็ง QR ให้อยู่ในกรอบ");

    const tick = async () => {
      const fn = scanFrameRef.current;
      if (!fn) return;
      try {
        const raw = await fn();
        if (raw) {
          const target = resolveTarget(raw);
          if (target) {
            goTo(target);
            return;
          }
          setMsg(`อ่าน QR ได้ แต่ไม่ใช่ของ Dodoregis: ${raw.slice(0, 60)}`);
        }
      } catch {
        /* เฟรมนี้อ่านไม่ได้ — ลองเฟรมถัดไป */
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [goTo]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const target = resolveTarget(manual);
    if (target) {
      goTo(target);
    } else {
      setMsg("รูปแบบรหัสไม่ถูกต้อง — เช่น TR-2607-001-01 (item) หรือ TR-2607-001 (ใบรีเควส)");
    }
  }

  const live = phase === "scanning" || phase === "starting";

  return (
    <div className="max-w-md mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-ink">สแกน QR</h1>
        <Link href="/" className="text-[13px] text-link hover:underline">
          ← กลับหน้าหลัก
        </Link>
      </div>

      <p className="text-[13px] text-muted -mt-2">
        เปิดกล้องแล้วเล็ง QR บนชิ้นงาน ระบบจะพาไปหน้ารายละเอียดให้เอง
        (ใช้ได้แม้ที่อยู่เว็บจะเปลี่ยน)
      </p>

      <div className="card p-3 flex flex-col gap-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-dark">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${live ? "opacity-100" : "opacity-0"}`}
          />
          <canvas ref={canvasRef} className="hidden" />
          {!live && (
            <div className="absolute inset-0 grid place-items-center text-center px-6">
              <span className="text-[13px] text-white/70">
                {phase === "found" ? "กำลังเปิดหน้างาน…" : "กล้องยังไม่เปิด"}
              </span>
            </div>
          )}
          {live && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-2/3 w-2/3 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}
        </div>

        {phase === "idle" || phase === "error" ? (
          <button type="button" onClick={startCamera} className="btn-primary w-full">
            เปิดกล้องสแกน
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setPhase("idle");
              setMsg("");
            }}
            className="btn-secondary w-full"
          >
            หยุดกล้อง
          </button>
        )}

        {msg && (
          <p className={`text-[13px] ${phase === "error" ? "text-coral" : "text-muted"}`}>
            {msg}
          </p>
        )}
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="label-text">กรอกรหัสเอง (ถ้าสแกนไม่ได้)</span>
          <span className="text-[12px] text-muted">
            พิมพ์ regis_no หรือรหัส item เช่น TR-2607-001-01
          </span>
        </div>
        <form onSubmit={submitManual} className="flex gap-2">
          <input
            className="input flex-1"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="TR-2607-001-01"
            inputMode="text"
            autoCapitalize="characters"
          />
          <button type="submit" className="btn-primary shrink-0">
            เปิด
          </button>
        </form>
        {!cameraSupported && (
          <p className="text-[12px] text-muted">
            อุปกรณ์นี้เปิดกล้องในแอปไม่ได้ แต่ QR เดิมยังใช้กล้องมือถือปกติสแกนได้ตามเดิม
          </p>
        )}
      </div>
    </div>
  );
}
