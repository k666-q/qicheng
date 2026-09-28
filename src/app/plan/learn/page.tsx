"use client";

// 计划驱动的学习页：复用星核探索组件，但归属于 /plan 路由。
// 返回逻辑固定回到 /plan/detail，SideRail 自动高亮"计划"。

import { Suspense } from "react";
import { NodeLearnContent } from "@/components/learn/NodeLearnCore";

function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg-0)] text-[var(--text-3)] text-[var(--font-sm)]">
      正在接近这颗星…
    </div>
  );
}

export default function PlanLearnPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NodeLearnContent overrideReturnPath="/plan/detail" />
    </Suspense>
  );
}
