"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-control)] bg-[var(--bg-2)] animate-pulse",
        className
      )}
    />
  );
}

export function SkeletonLine({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-3.5 w-full", className)} />;
}

export function SkeletonBlock({ className }: SkeletonProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <SkeletonLine className="w-3/4" />
      <SkeletonLine />
      <SkeletonLine className="w-5/6" />
    </div>
  );
}
