"use client";

import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

type PanelVariant = "surface" | "float" | "inset";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant;
}

const variantStyles: Record<PanelVariant, string> = {
  surface: "bg-[var(--bg-1)] border border-[var(--border-1)] rounded-[var(--radius-panel)]",
  float:
    "bg-[var(--bg-2)] border border-[var(--border-1)] rounded-[var(--radius-panel)] shadow-[var(--shadow-float)]",
  inset: "bg-[var(--bg-0)] border border-[var(--border-1)] rounded-[var(--radius-panel)]",
};

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ variant = "surface", className, children, ...props }, ref) => (
    <div ref={ref} className={cn(variantStyles[variant], className)} {...props}>
      {children}
    </div>
  )
);

Panel.displayName = "Panel";
