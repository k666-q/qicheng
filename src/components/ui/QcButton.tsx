"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "sm" | "icon";

interface QcButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--qc-accent)] text-white hover:bg-[var(--qc-accent-hover)] shadow-[0_0_12px_rgba(124,108,240,0.15)]",
  secondary:
    "bg-[var(--bg-2)] border border-[var(--border-1)] text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text-1)]",
  ghost:
    "text-[var(--text-2)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)]",
  danger:
    "bg-[rgba(248,113,113,0.1)] text-[var(--qc-danger)] hover:bg-[rgba(248,113,113,0.2)]",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-8 px-3 gap-1.5 text-[var(--font-sm)]",
  sm: "h-7 px-2.5 gap-1 text-[var(--font-xs)]",
  icon: "h-8 w-8 justify-center",
};

export const QcButton = forwardRef<HTMLButtonElement, QcButtonProps>(
  ({ variant = "secondary", size = "default", loading, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--radius-control)] font-medium transition-all select-none focus-ring",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        `transition-[background,color,border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease)]`,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  )
);

QcButton.displayName = "QcButton";
