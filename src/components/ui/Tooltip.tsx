"use client";

import { cn } from "@/lib/utils";
import { useState, useRef, useCallback, type ReactNode } from "react";

interface TooltipProps {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
  children: ReactNode;
  className?: string;
}

const sidePositions: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

export function Tooltip({ content, side = "top", delay = 400, children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  const show = useCallback(() => {
    timer.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  }, []);

  return (
    <span className={cn("relative inline-flex", className)} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-50 whitespace-nowrap rounded-[var(--radius-control)] bg-[var(--bg-3)] px-2 py-1",
            "text-[var(--font-xs)] text-[var(--text-1)] pointer-events-none",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            sidePositions[side]
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
