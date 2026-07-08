"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

export const QcInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-8 w-full rounded-[var(--radius-control)] bg-[var(--bg-3)] px-3",
        "text-[var(--font-sm)] text-[var(--text-1)] placeholder:text-[var(--text-3)]",
        "border border-[var(--border-1)] outline-none transition-all duration-[var(--dur-fast)]",
        "focus:border-[var(--qc-accent)] focus:shadow-[0_0_0_2px_var(--qc-accent-muted)]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  )
);
QcInput.displayName = "QcInput";
