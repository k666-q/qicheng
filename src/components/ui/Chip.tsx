"use client";

import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
}

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(
  ({ active, className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center h-[22px] px-2 rounded-[var(--radius-control)] text-[var(--font-xs)] font-medium transition-colors duration-[var(--dur-fast)]",
        active
          ? "bg-[var(--qc-accent-muted)] text-[var(--qc-accent)]"
          : "bg-[var(--bg-2)] text-[var(--text-3)] hover:text-[var(--text-2)]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
);

Chip.displayName = "Chip";
