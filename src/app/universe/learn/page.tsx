"use client";

// 星核探索（大宇宙入口）：核心逻辑在 components/learn/NodeLearnCore.tsx，
// 本文件只负责路由挂载与 Suspense 边界。计划入口见 /plan/learn。

import { Suspense } from "react";
import { NodeLearnContent } from "@/components/learn/NodeLearnCore";

export default function NodeLearnPage() {
  return (
    <Suspense
      fallback={<div className="flex h-screen items-center justify-center bg-[var(--bg-0)] text-[var(--text-3)] text-[var(--font-sm)]">正在接近这颗星…</div>}
    >
      <NodeLearnContent />
    </Suspense>
  );
}
