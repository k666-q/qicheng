"use client";

import { useEffect, useState } from "react";
import {
  getTodayRemaining,
  getDailyPlanProgress,
  rebalancePlan,
} from "@/lib/plan/daily-scheduler";
import type { KnowledgeNode } from "@/lib/universe/types";

type Props = {
  nodeById: Map<string, KnowledgeNode>;
  onNodeClick: (nodeId: string) => void;
};

export function TodayPanel({ nodeById, onNodeClick }: Props) {
  const [remaining, setRemaining] = useState<string[]>([]);
  const [progress, setProgress] = useState({ totalNodes: 0, completedNodes: 0, daysLeft: 0, todayCount: 0, todayDone: 0 });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    rebalancePlan();
    setRemaining(getTodayRemaining());
    setProgress(getDailyPlanProgress());
  }, []);

  if (progress.totalNodes === 0) return null;

  const ratio = progress.totalNodes > 0 ? progress.completedNodes / progress.totalNodes : 0;

  return (
    <div className={`fixed left-[calc(var(--siderail-width,56px)+12px)] bottom-5 z-30 transition-all ${collapsed ? "w-auto" : "w-72"}`}>
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-[#12121a]/90 backdrop-blur-xl px-3 py-2 text-[11px] text-cyan-200 hover:bg-cyan-500/10 transition-all shadow-lg"
        >
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          今日 {remaining.length} 个待学
        </button>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#12121a]/90 backdrop-blur-xl p-4 shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white/80">今日学习</h3>
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
              <span>总进度 {progress.completedNodes}/{progress.totalNodes}</span>
              <span>剩余 {progress.daysLeft} 天</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
          </div>

          {/* Today's stats */}
          <div className="flex items-center gap-2 text-[11px] text-white/50 mb-3">
            <span className="text-cyan-300">{progress.todayDone}/{progress.todayCount}</span>
            <span>已完成</span>
            {remaining.length > 0 && (
              <span className="ml-auto text-amber-300/70">{remaining.length} 个待学</span>
            )}
          </div>

          {/* Node list */}
          {remaining.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-cosmic">
              {remaining.slice(0, 5).map((nodeId) => {
                const node = nodeById.get(nodeId);
                if (!node) return null;
                return (
                  <button
                    key={nodeId}
                    onClick={() => onNodeClick(nodeId)}
                    className="w-full flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/60 shrink-0" />
                    <span className="text-[12px] text-white/70 truncate">{node.name}</span>
                  </button>
                );
              })}
              {remaining.length > 5 && (
                <p className="text-[10px] text-white/30 text-center pt-1">
                  还有 {remaining.length - 5} 个...
                </p>
              )}
            </div>
          )}

          {remaining.length === 0 && (
            <div className="text-center py-2">
              <span className="text-lg">🎉</span>
              <p className="text-[12px] text-emerald-300/80 mt-1">今日任务已全部完成！</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
