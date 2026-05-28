"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStageCards } from "@/lib/cards/store";
import type { StageCard } from "@/lib/cards/types";

export default function CardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<StageCard[]>([]);
  const [totalStages, setTotalStages] = useState(0);
  const [shareTarget, setShareTarget] = useState<StageCard | null>(null);

  useEffect(() => {
    setCards(getStageCards());
    try {
      const planStr = sessionStorage.getItem("qicheng_plan");
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
    const text = `${card.summary}\n\n📊 ${card.stats.days} 天 · ${card.stats.tasks_completed} 个任务完成\n💬 "${card.user_quote}"\n\n—— 启程`;
    try {
      await navigator.clipboard.writeText(text);
      alert("已复制到剪贴板");
    } catch {
      alert("复制失败，请手动复制");
    }
    closeShare();
  }

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push("/plan")}
          className="text-sm text-stone-400 hover:text-stone-600 mb-6 flex items-center gap-1"
        >
          ← 回到计划
        </button>

        <h1 className="text-xl font-semibold text-stone-800 mb-2">旅程卡片</h1>
        <p className="text-sm text-stone-500 mb-8">
          每完成一个阶段，这里会多一张属于你的记忆。
        </p>

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
          <div className="text-center py-16">
            <p className="text-stone-400 text-sm">还没有卡片。完成计划中的第一个阶段后，你的第一张卡片就会出现在这里。</p>
          </div>
        )}
      </div>

      {/* Share modal */}
      {shareTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeShare}>
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-stone-800 mb-4">分享你的成就</h3>
            <div className="rounded-lg bg-stone-50 border border-stone-200 p-4 mb-4">
              <p className="text-sm text-stone-800 font-medium">{shareTarget.summary}</p>
              <p className="text-xs text-stone-500 mt-2">📊 {shareTarget.stats.days} 天 · {shareTarget.stats.tasks_completed} 个任务</p>
              <p className="text-xs text-stone-500 mt-1 italic">"{shareTarget.user_quote}"</p>
              <p className="text-[10px] text-stone-300 mt-3">—— 启程</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyShareText(shareTarget)}
                className="flex-1 rounded-lg bg-stone-800 px-4 py-2.5 text-xs text-white hover:bg-stone-700 transition-colors"
              >
                复制文字
              </button>
              <button
                onClick={closeShare}
                className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs text-stone-500 hover:border-stone-300 transition-colors"
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
        stroke="#78716c"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardItem({ card, onShare }: { card: StageCard; onShare: () => void }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 relative overflow-hidden">
      {/* Stage badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-800 px-3 py-1 text-xs text-white">
          ⛰️ 阶段 {card.stage_index + 1}
        </span>
        <span className="text-xs text-stone-400">{card.date_range}</span>
      </div>

      {/* Stage name */}
      <h3 className="text-base font-semibold text-stone-800 mb-1">{card.stage_name}</h3>

      {/* Summary */}
      <p className="text-sm text-stone-600 mb-4">{card.summary}</p>

      {/* User quote */}
      <div className="rounded-lg bg-stone-50 border-l-2 border-stone-300 px-4 py-2 mb-4">
        <p className="text-xs text-stone-500 italic">"{card.user_quote}"</p>
        <p className="text-[10px] text-stone-400 mt-1">—— 你当时说的</p>
      </div>

      {/* Stats + emotion curve */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-xs text-stone-500">
          <span>{card.stats.days} 天</span>
          <span>{card.stats.tasks_completed} 个任务</span>
        </div>
        <MiniEmotionCurve data={card.emotion_data} />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onShare}
          className="rounded-lg border border-stone-200 px-4 py-2 text-xs text-stone-600 hover:border-stone-300 hover:text-stone-800 transition-colors"
        >
          分享这张卡片
        </button>
        {card.result_url && (
          <a
            href={card.result_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-stone-200 px-4 py-2 text-xs text-stone-600 hover:border-stone-300 transition-colors"
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
    <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-6 text-center">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-stone-100 text-stone-400 text-sm mb-2">
        🔒
      </span>
      <p className="text-xs text-stone-400">阶段 {index + 1} · 待解锁</p>
    </div>
  );
}
