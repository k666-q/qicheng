"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMilestones, getGrowthContrast } from "@/lib/milestones/store";
import { MILESTONE_LABELS } from "@/lib/milestones/types";
import type { Milestone } from "@/lib/milestones/types";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { EmptyState } from "@/components/ui/EmptyState";

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
    <div className="min-h-screen bg-[#050510] md:pl-[var(--siderail-width)] transition-[padding] duration-200">
      <CosmicBackground />
      <CyberOverlay />
      <header className="relative z-10 border-b border-cyan-400/15 bg-[#0a0a14]/60 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            <h1 className="cyber-glitch text-lg font-semibold text-white/90" data-text="成长回顾">成长回顾</h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/40">growth_log // progress_scan</p>
            <p className="text-xs text-white/35 mt-0.5">每一步都算数</p>
          </div>
          <button onClick={() => router.push("/universe")} className="border border-white/10 px-3 py-1.5 font-mono text-xs text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors">
            返回
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-6 py-8 pb-6">
        {/* Growth contrast */}
        {contrast.then && contrast.now && contrast.then.id !== contrast.now.id && (
          <div className="mb-8 cyber-panel cyber-corner p-6">
            <p className="font-mono text-xs font-medium tracking-wider text-cyan-200/70 mb-3">起点 vs 现在</p>
            <div className="cyber-dataline h-px w-full mb-4" />
            <div className="grid grid-cols-2 gap-4">
              <div className="cyber-panel p-4">
                <p className="font-mono text-[11px] text-fuchsia-300/60 mb-1">{formatDate(contrast.then.created_at)} · 起点</p>
                <p className="text-sm text-white/70 italic">
                  {contrast.then.user_quote ? `"${contrast.then.user_quote.slice(0, 80)}"` : contrast.then.content}
                </p>
              </div>
              <div className="bg-emerald-500/[0.08] border border-emerald-400/20 p-4">
                <p className="text-[11px] text-emerald-300/80 mb-1">{formatDate(contrast.now.created_at)} · 最近</p>
                <p className="text-sm text-white/70">
                  {contrast.now.content}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {milestones.length === 0 && (
          <EmptyState
            icon="🌱"
            title="成长故事尚未开始"
            description="完成学习任务、点亮知识星、通过阶段挑战——每一步都会成为你的成长里程碑。"
            actionLabel="创建学习计划"
            actionHref="/universe?welcome=1"
            secondaryLabel="先探索宇宙"
            secondaryHref="/universe"
          />
        )}

        {/* Timeline */}
        {milestones.length > 0 && (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-cyan-400/20" />

            <div className="space-y-6">
              {[...milestones].reverse().map((m) => {
                const meta = MILESTONE_LABELS[m.type];
                return (
                  <div key={m.id} className="relative pl-10">
                    <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-[#12121a] border-2 border-cyan-400/60 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                    <div className="cyber-panel cyber-corner p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{meta.emoji}</span>
                        <span className="text-sm font-medium text-white/80">{m.title}</span>
                        <span className="font-mono text-[11px] text-cyan-300/40 ml-auto">{formatDate(m.created_at)}</span>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">{m.content}</p>
                      {m.user_quote && (
                        <p className="mt-2 text-[11px] text-white/40 italic border-l-2 border-fuchsia-400/30 pl-2">
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
