"use client";

import { cn } from "@/lib/utils";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

type ToastType = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (message: string, options?: { type?: ToastType; action?: ToastItem["action"]; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

const icons: Record<ToastType, ReactNode> = {
  info: <Info className="h-4 w-4 text-[var(--qc-info)]" />,
  success: <CheckCircle2 className="h-4 w-4 text-[var(--qc-success)]" />,
  warning: <AlertTriangle className="h-4 w-4 text-[var(--qc-warning)]" />,
  error: <XCircle className="h-4 w-4 text-[var(--qc-danger)]" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options?: { type?: ToastType; action?: ToastItem["action"]; duration?: number }) => {
      const id = nextId++;
      const duration = options?.duration ?? 4000;
      setToasts((prev) => [...prev, { id, type: options?.type ?? "info", message, action: options?.action }]);
      setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 rounded-[var(--radius-panel)] border border-[var(--border-1)] bg-[var(--bg-2)] px-3.5 py-2.5",
              "shadow-[var(--shadow-float)] min-w-[260px] max-w-[380px]",
              "animate-in slide-in-from-right-full fade-in-0 duration-200"
            )}
          >
            {icons[t.type]}
            <span className="flex-1 text-[var(--font-sm)] text-[var(--text-1)]">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  removeToast(t.id);
                }}
                className="shrink-0 text-[var(--font-xs)] font-medium text-[var(--qc-accent)] hover:text-[var(--qc-accent-hover)] transition-colors"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
