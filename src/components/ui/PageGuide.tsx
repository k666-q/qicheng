"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

export type GuideStep = {
  target?: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
};

type Props = {
  storageKey: string;
  steps: GuideStep[];
};

export function PageGuide({ storageKey, steps }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) {
        setTimeout(() => setVisible(true), 1200);
      }
    } catch {}
  }, [storageKey]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(storageKey, "1"); } catch {}
  }, [storageKey]);

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!visible || steps.length === 0) return null;

  const current = steps[step];

  return (
    <div
      className="fixed z-[200] bottom-6 left-1/2 -translate-x-1/2 w-[92vw] max-w-lg animate-slide-up"
      style={{ pointerEvents: "auto" }}
    >
      <div className="rounded-2xl border border-cyan-400/15 bg-[#0a0a16]/85 backdrop-blur-2xl px-5 py-4 shadow-[0_-4px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(34,211,238,0.06)]">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 border border-cyan-400/20">
            <svg className="h-4 w-4 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-cyan-100 tracking-wide">{current.title}</h3>
              <span className="text-[10px] text-white/25 font-mono shrink-0">{step + 1}/{steps.length}</span>
            </div>
            <p className="text-xs text-white/45 leading-relaxed">{current.description}</p>
          </div>

          {/* Close */}
          <button
            onClick={dismiss}
            className="shrink-0 mt-0.5 p-1 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Bottom bar */}
        <div className="mt-3 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-5 h-1.5 bg-cyan-400/60"
                    : i < step
                      ? "w-1.5 h-1.5 bg-cyan-400/30"
                      : "w-1.5 h-1.5 bg-white/10"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={dismiss} className="text-[11px] text-white/20 hover:text-white/40 transition-colors">
              跳过
            </button>
            <button
              onClick={next}
              className="px-4 py-1.5 text-[11px] font-medium text-black bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg shadow-[0_0_12px_rgba(34,211,238,0.15)] hover:opacity-90 transition-opacity"
            >
              {step < steps.length - 1 ? "下一步" : "开始使用"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
