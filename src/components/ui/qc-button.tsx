"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const qcButtonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "font-medium select-none transition-all",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)]",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--qc-accent)] text-white",
          "hover:bg-[var(--qc-accent-hover)]",
          "shadow-[0_0_12px_rgba(124,108,240,0.15)]",
        ].join(" "),
        secondary: [
          "bg-[var(--bg-2)] text-[var(--text-2)] border border-[var(--border-1)]",
          "hover:bg-[var(--bg-3)] hover:text-[var(--text-1)]",
        ].join(" "),
        ghost: [
          "text-[var(--text-2)]",
          "hover:bg-[var(--bg-2)] hover:text-[var(--text-1)]",
        ].join(" "),
        danger: [
          "bg-[var(--qc-danger)]/10 text-[var(--qc-danger)]",
          "hover:bg-[var(--qc-danger)]/20",
        ].join(" "),
      },
      size: {
        sm: "h-7 px-2.5 text-[var(--font-xs)] rounded-[var(--radius-control)]",
        md: "h-8 px-3 text-[var(--font-sm)] rounded-[var(--radius-control)]",
        lg: "h-9 px-4 text-[var(--font-base)] rounded-[var(--radius-control)]",
        icon: "h-8 w-8 rounded-[var(--radius-control)]",
        "icon-sm": "h-7 w-7 rounded-[var(--radius-control)]",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

export interface QcButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof qcButtonVariants> {
  loading?: boolean;
}

export const QcButton = forwardRef<HTMLButtonElement, QcButtonProps>(
  ({ variant, size, loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(qcButtonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
QcButton.displayName = "QcButton";

export { qcButtonVariants };
