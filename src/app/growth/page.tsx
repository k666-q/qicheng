"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMilestones, getGrowthContrast } from "@/lib/milestones/store";
import { MILESTONE_LABELS } from "@/lib/milestones/types";
import type { Milestone } from "@/lib/milestones/types";

export default function GrowthPage() {
  const router = useRouter();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [contrast, setContrast] = useState<{ then: Milestone | null; now: Milestone | null }>({ then: null, now: null });

  useEffect(() => {
    setMilestones(getMilestones());
    setContrast(getGrowthContrast());
  }, []);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays} 天前`;
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-800">成长回顾</h1>
            <p className="text-xs text-stone-400 mt-0.5">每一步都算数</p>
          </div>
          <button onClick={() => router.back()} className="text-xs text-stone-400 hover:text-stone-600">
            返回
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {/* Growth contrast */}
        {contrast.then && contrast.now && contrast.then.id !== contrast.now.id && (
          <div className="mb-8 rounded-lg border border-stone-200 bg-white p-6">
            <p className="text-xs font-medium text-stone-500 mb-4">起点 vs 现在</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-stone-50 p-4">
                <p className="text-[11px] text-stone-400 mb-1">{formatDate(contrast.then.created_at)} · 起点</p>
                <p className="text-sm text-stone-700 italic">
                  {contrast.then.user_quote ? `"${contrast.then.user_quote.slice(0, 80)}"` : contrast.then.content}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4">
                <p className="text-[11px] text-emerald-600 mb-1">{formatDate(contrast.now.created_at)} · 最近</p>
                <p className="text-sm text-stone-700">
                  {contrast.now.content}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {milestones.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-sm text-stone-500">还没有记录。完成第一天体验后，你的成长故事就开始了。</p>
            <button
              onClick={() => router.push("/first-day")}
              className="mt-4 rounded-lg bg-stone-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
            >
              开始第一天
            </button>
          </div>
        )}

        {/* Timeline */}
        {milestones.length > 0 && (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-stone-200" />

            <div className="space-y-6">
              {[...milestones].reverse().map((m) => {
                const meta = MILESTONE_LABELS[m.type];
                return (
                  <div key={m.id} className="relative pl-10">
                    <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-white border-2 border-stone-300" />
                    <div className="rounded-lg border border-stone-100 bg-white p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{meta.emoji}</span>
                        <span className="text-xs font-medium text-stone-700">{m.title}</span>
                        <span className="text-[11px] text-stone-400 ml-auto">{formatDate(m.created_at)}</span>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">{m.content}</p>
                      {m.user_quote && (
                        <p className="mt-2 text-[11px] text-stone-400 italic border-l-2 border-stone-200 pl-2">
                          "{m.user_quote.slice(0, 100)}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
