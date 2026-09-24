"use client";

// Minimal toast stack for the /admin/bots controls (#139 phase A). An aria-live region, no new
// dependency (the shadcn toast would pull in sonner). Every control outcome lands here:
// "Applied — takes effect …", conflicts ("Changed by X at HH:MM — refreshed") and errors.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastTone = "ok" | "warn" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

const Ctx = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

const TONE: Record<ToastTone, { cls: string; Icon: typeof Info }> = {
  ok: { cls: "border-emerald-500/40", Icon: CheckCircle2 },
  warn: { cls: "border-amber-500/50", Icon: AlertTriangle },
  error: { cls: "border-red-500/60", Icon: AlertTriangle },
  info: { cls: "border-border", Icon: Info },
};
const ICON_CLS: Record<ToastTone, string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-red-400",
  info: "text-muted-foreground",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "error" || t.tone === "warn" ? 12000 : 6000);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:w-96"
      >
        {items.map((t) => {
          const { cls, Icon } = TONE[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex w-full gap-2.5 rounded-lg border bg-popover px-3 py-2.5 text-sm shadow-lg ${cls}`}
            >
              <Icon size={16} className={`mt-0.5 shrink-0 ${ICON_CLS[t.tone]}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t.title}</div>
                {t.body && <div className="mt-0.5 break-words text-xs text-muted-foreground">{t.body}</div>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="-m-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
