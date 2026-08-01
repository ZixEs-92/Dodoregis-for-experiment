"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * ศูนย์กลางการตอบกลับผู้ใช้ — toast (แจ้งผลสำเร็จ/ผิดพลาด) และกล่องยืนยัน
 * ใช้แทน window.confirm ที่เป็นกล่องของเบราว์เซอร์ (กดพลาดง่ายบนมือถือ)
 */

// ── Toast ───────────────────────────────────────────────────

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

const ToastCtx = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  // ถ้าเรียกนอก provider ให้เงียบไว้ ดีกว่าทำหน้าพัง
  return ctx ?? (() => {});
}

/**
 * เด้ง toast อัตโนมัติเมื่อ server action คืน saved: true
 * ใช้กับฟอร์มที่ใช้ useActionState เพื่อไม่ต้องเขียน effect ซ้ำทุกที่
 */
export function useToastOnSaved(
  state: { ok: boolean; saved?: boolean; errors: string[] },
  message = "บันทึกเรียบร้อยแล้ว",
) {
  const toast = useToast();
  const seen = useRef(false);
  useEffect(() => {
    if (state.ok && state.saved === true) {
      if (!seen.current) {
        seen.current = true;
        toast(message, "success");
      }
    } else {
      seen.current = false;
    }
  }, [state.ok, state.saved, message, toast]);
}

const TONE_STYLE: Record<ToastTone, string> = {
  success: "bg-forest text-white",
  error: "bg-coral text-white",
  info: "bg-ink text-white",
};
const TONE_ICON: Record<ToastTone, string> = {
  success: "✓",
  error: "!",
  info: "i",
};

// ── กล่องยืนยัน ─────────────────────────────────────────────

type ConfirmOptions = {
  title: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = การกระทำที่ย้อนกลับยาก ปุ่มยืนยันจะเป็นสีเตือน */
  danger?: boolean;
};

const ConfirmCtx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  return ctx ?? (async () => true);
}

type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void };

export default function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const nextId = useRef(1);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
  }, []);

  const close = useCallback(
    (ok: boolean) => {
      setPending((p) => {
        p?.resolve(ok);
        return null;
      });
      restoreFocusTo.current?.focus?.();
    },
    [],
  );

  // เปิดกล่องแล้วโฟกัสปุ่มยืนยัน + ปิดด้วย Esc
  useEffect(() => {
    if (!pending) return;
    confirmBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, close]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={showToast}>
        {children}

        {/* toast — ลอยเหนือแถบเมนูล่างบนมือถือ */}
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:items-end sm:px-6 sm:pb-6"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg px-4 py-3 text-[14px] shadow-lg ${TONE_STYLE[t.tone]}`}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 text-[12px] font-bold">
                {TONE_ICON[t.tone]}
              </span>
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                aria-label="ปิดข้อความ"
                onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))}
                className="shrink-0 opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* กล่องยืนยัน */}
        {pending && (
          <div
            className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-0 sm:place-items-center sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) close(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              className="w-full max-w-md rounded-t-lg bg-canvas p-5 sm:rounded-lg sm:p-6"
            >
              <h2 id="confirm-title" className="text-[17px] font-semibold text-ink">
                {pending.title}
              </h2>
              {pending.detail && (
                <p className="mt-2 text-[14px] text-muted">{pending.detail}</p>
              )}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => close(false)} className="btn-secondary btn-sm">
                  {pending.cancelLabel ?? "ยกเลิก"}
                </button>
                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={() => close(true)}
                  className={
                    pending.danger
                      ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-coral px-6 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
                      : "btn-primary btn-sm"
                  }
                >
                  {pending.confirmLabel ?? "ยืนยัน"}
                </button>
              </div>
            </div>
          </div>
        )}
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}
