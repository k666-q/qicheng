"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStageCards } from "@/lib/cards/store";
import type { StageCard } from "@/lib/cards/types";
import { loadSessionItem } from "@/lib/plan/store";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<StageCard[]>([]);
  const [totalStages, setTotalStages] = useState(0);
  const [shareTarget, setShareTarget] = useState<StageCard | null>(null);

  useEffect(() => {
    setCards(getStageCards());
    try {
      const planStr = loadSessionItem("qicheng_plan");
      if (planStr) {
        const plan = JSON.parse(planStr);
        setTotalStages(plan.stages?.length || 0);
      }
    } catch { /* ignore */ }
  }, []);

  function handleShare(card: StageCard) {
    setShareTarget(card);
  }

  function closeShare() {
    setShareTarget(null);
  }

  async function copyShareText(card: StageCard) {
    const text = `${card.summary}\n\n📊 ${card.stats.days} 天 · ${card.stats.tasks_completed} 个任务完成\n💬 "${card.user_quote}"\n\n—— Nexiova`;
    try {
      await navigator.clipboard.writeText(text);
      alert("已复制到剪贴板");
    } catch {
      alert("复制失败，请手动复制");
    }
    closeShare();
  }

  return (
    <div className="min-h-screen bg-[#050510] py-8 px-4 pb-6 md:pl-[var(--siderail-width)] transition-[padding] duration-200">
      <CosmicBackground />
      <CyberOverlay />
      <div className="relative z-10 max-w-2xl mx-auto">
        <button
          onClick={() => router.push("/plan/detail")}
          className="border border-white/10 px-3 py-1.5 font-mono text-sm text-white/40 hover:bg-white/[0.06] hover:text-white/70 mb-6 flex items-center gap-1 transition-colors"
        >
          ← 回到计划
        </button>

        <h1 className="cyber-glitch text-xl font-semibold text-white/90" data-text="旅程卡片">旅程卡片</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/40">journey_cards // artifact_vault</p>
        <p className="text-sm text-white/45 mt-2 mb-6">
          每完成一个阶段，这里会多一张属于你的记忆。
        </p>
        <div className="cyber-dataline h-px w-full mb-8" />

        {/* Timeline */}
        <div className="space-y-6">
          {Array.from({ length: Math.max(totalStages, cards.length) }).map((_, i) => {
            const card = cards.find((c) => c.stage_index === i);
            if (card) {
              return <CardItem key={i} card={card} onShare={() => handleShare(card)} />;
            }
            return <LockedCard key={i} index={i} />;
          })}
        </div>

        {cards.length === 0 && totalStages === 0 && (
          <EmptyState
            icon="🃏"
            title="还没有卡片"
            description="每完成一个学习阶段，这里就会出现一张记录你成就的卡片。先去创建你的学习计划吧。"
            actionLabel="创建学习计划"
            actionHref="/universe?welcome=1"
            secondaryLabel="查看星图"
            secondaryHref="/universe"
          />
        )}
      </div>

      {/* Share modal */}
      {shareTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeShare}>
          <div className="cyber-panel cyber-corner max-w-sm w-full p-6 shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white/90 mb-3">分享你的成就</h3>
            <div className="cyber-dataline h-px w-full mb-4" />
            <div className="cyber-panel p-4 mb-4">
              <p className="text-sm text-white/85 font-medium">{shareTarget.summary}</p>
              <p className="text-xs text-white/45 mt-2">📊 <span className="cyber-neon text-cyan-300">{shareTarget.stats.days}</span> 天 · <span className="cyber-neon text-fuchsia-300">{shareTarget.stats.tasks_completed}</span> 个任务</p>
              <p className="text-xs text-white/45 mt-1 italic">"{shareTarget.user_quote}"</p>
              <p className="font-mono text-[10px] text-cyan-300/30 mt-3">—— Nexiova</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyShareText(shareTarget)}
                className="flex-1 border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 font-mono text-sm tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-colors"
              >
                复制文字
              </button>
              <button
                onClick={closeShare}
                className="border border-white/10 px-4 py-2.5 font-mono text-sm text-white/40 hover:bg-white/[0.06] transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniEmotionCurve({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const width = 120;
  const height = 32;
  const maxVal = 10;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => `${i * step},${height - (v / maxVal) * height}`).join(" ");

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke="rgba(34,211,238,0.6)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardItem({ card, onShare }: { card: StageCard; onShare: () => void }) {
  return (
    <div className="cyber-panel cyber-corner p-6 relative overflow-hidden">
      {/* Stage badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 border border-cyan-400/50 bg-cyan-400/15 px-3 py-1 font-mono text-xs tracking-wider text-cyan-200">
          ⛰️ 阶段 {card.stage_index + 1}
        </span>
        <span className="font-mono text-xs text-cyan-300/40">{card.date_range}</span>
      </div>

      {/* Stage name */}
      <h3 className="text-base font-semibold text-white/90 mb-1">{card.stage_name}</h3>

      {/* Summary */}
      <p className="text-sm text-white/60 mb-4">{card.summary}</p>

      {/* User quote */}
      <div className="bg-white/[0.04] border-l-2 border-fuchsia-400/40 px-4 py-2 mb-4">
        <p className="text-xs text-white/50 italic">"{card.user_quote}"</p>
        <p className="text-[10px] text-white/30 mt-1">—— 你当时说的</p>
      </div>

      {/* Stats + emotion curve */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-xs text-white/45">
          <span><span className="cyber-neon text-cyan-300">{card.stats.days}</span> 天</span>
          <span><span className="cyber-neon text-fuchsia-300">{card.stats.tasks_completed}</span> 个任务</span>
        </div>
        <MiniEmotionCurve data={card.emotion_data} />
      </div>

      <div className="cyber-dataline h-px w-full mb-4" />

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onShare}
          className="border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-sm tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-colors"
        >
          分享这张卡片
        </button>
        {card.result_url && (
          <a
            href={card.result_url}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/10 px-4 py-2 font-mono text-sm text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
          >
            查看成果 →
          </a>
        )}
      </div>
    </div>
  );
}

function LockedCard({ index }: { index: number }) {
  return (
    <div className="border border-dashed border-cyan-400/20 bg-white/[0.02] p-6 text-center">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] text-white/35 text-sm mb-2">
        🔒
      </span>
      <p className="font-mono text-xs tracking-wider text-cyan-300/40">阶段 {index + 1} · 待解锁</p>
    </div>
  );
}
