"use client";

import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

export const QcInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-8 w-full rounded-[var(--radius-control)] border border-[var(--border-1)] bg-[var(--bg-3)] px-2.5",
        "text-[var(--font-base)] text-[var(--text-1)] placeholder:text-[var(--text-3)]",
        "transition-[border-color,box-shadow] duration-[var(--dur-fast)]",
        "focus:border-[var(--qc-accent)] focus:shadow-[0_0_0_2px_var(--qc-accent-muted)] focus:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);

QcInput.displayName = "QcInput";
