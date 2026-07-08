"use client";

// 回响通知：到期的跨时间刺激（记忆重构/种子/认知债务）浮现在宇宙页与计划页。
// 点击展开 → 自检式回忆卡：在心里回答 → "想起来了"销账，或去重温这颗星。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDueEchoes, resolveEcho, type Echo, type EchoKind } from "@/lib/stimulus/echo";

const KIND_META: Record<EchoKind, { icon: string; label: string }> = {
  memory: { icon: "💭", label: "记忆回响" },
  seed: { icon: "🌱", label: "种子发芽了" },
  debt: { icon: "🧾", label: "认知欠条到期" },
};

export function EchoNotice({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const router = useRouter();
  const [due, setDue] = useState<Echo[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Echo | null>(null);

  useEffect(() => {
    setDue(getDueEchoes());
  }, []);

  if (due.length === 0) return null;

  const dark = variant === "dark";

  const panelCls = dark
    ? "border-white/10 bg-[#13131d]/95 text-white/85 shadow-black/50"
    : "border-stone-200 bg-white text-stone-700 shadow-stone-300/40";
  const subTextCls = dark ? "text-white/40" : "text-stone-400";
  const itemCls = dark
    ? "border-white/10 bg-white/5 hover:bg-white/10"
    : "border-stone-100 bg-stone-50 hover:bg-stone-100";

  function handleResolve(echo: Echo) {
    resolveEcho(echo.id);
    setDue(getDueEchoes());
    setActive(null);
  }

  function handleRevisit(echo: Echo) {
    resolveEcho(echo.id);
    router.push(`/universe/learn?node=${encodeURIComponent(echo.nodeId)}`);
  }

  return (
    <>
      {/* 悬浮入口 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border px-4 py-2.5 shadow-xl backdrop-blur-xl transition-all hover:scale-105 ${panelCls}`}
      >
        <span className="relative">
          🔔
          <span className="absolute -right-1.5 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
            {due.length}
          </span>
        </span>
        <span className="text-xs font-medium">回响</span>
      </button>

      {/* 列表 */}
      {open && !active && (
        <div className={`fixed bottom-20 right-6 z-40 w-[320px] animate-slide-up rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${panelCls}`}>
          <p className="text-xs font-semibold mb-1">来自过去的你</p>
          <p className={`text-[11px] mb-3 ${subTextCls}`}>这些是你探索时埋下的回响，现在到期了</p>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {due.map((echo) => {
              const meta = KIND_META[echo.kind];
              return (
                <button
                  key={echo.id}
                  onClick={() => setActive(echo)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${itemCls}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{meta.icon}</span>
                    <span className="text-[11px] font-medium">{meta.label}</span>
                    <span className={`ml-auto text-[10px] ${subTextCls}`}>{echo.nodeName}</span>
                  </div>
                  <p className={`mt-1 text-[11px] leading-relaxed line-clamp-2 ${subTextCls}`}>{echo.prompt}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 回忆卡 */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-5" onClick={() => setActive(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-[420px] animate-slide-up rounded-2xl border p-6 shadow-2xl ${panelCls}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{KIND_META[active.kind].icon}</span>
              <div>
                <p className="text-sm font-semibold">{KIND_META[active.kind].label}</p>
                <p className={`text-[11px] ${subTextCls}`}>来自「{active.nodeName}」</p>
              </div>
            </div>
            <p className="text-[14px] leading-relaxed mb-2">{active.prompt}</p>
            <p className={`text-[11px] mb-4 ${subTextCls}`}>
              {active.kind === "seed"
                ? "三天过去了，它发酵得怎么样？在心里组织一遍你的答案。"
                : active.kind === "debt"
                  ? "是时候把欠的\u201c为什么\u201d还上了。"
                  : "先在心里回答，不要去查。"}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleResolve(active)}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:from-emerald-500 hover:to-teal-500 transition-all"
              >
                {active.kind === "debt" ? "我已经想明白为什么了" : "我想起来了 ✓"}
              </button>
              <button
                onClick={() => handleRevisit(active)}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm transition-colors ${itemCls}`}
              >
                {active.kind === "debt" ? "去把这笔债还了（重新探索）→" : "有点模糊，去重温这颗星 →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
