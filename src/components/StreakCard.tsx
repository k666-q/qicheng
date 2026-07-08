"use client";

import { useEffect, useState } from "react";
import { getStreak, isStreakBroken, canRepair, repairStreak, type StreakData } from "@/lib/habit/streak";

export function StreakCard() {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [broken, setBroken] = useState(false);
  const [repairable, setRepairable] = useState(false);
  const [repaired, setRepaired] = useState(false);

  useEffect(() => {
    const s = getStreak();
    setStreak(s);
    setBroken(isStreakBroken());
    setRepairable(canRepair());
  }, []);

  if (!streak || streak.total_completed === 0) return null;

  function handleRepair() {
    const result = repairStreak();
    if (result) {
      setStreak(result);
      setBroken(false);
      setRepairable(false);
      setRepaired(true);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] backdrop-blur-md p-4 mb-6 shadow-[0_0_20px_rgba(100,150,255,0.04)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-white/45">连续记录</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-semibold text-white/90">{streak.count}</span>
            <span className="text-xs text-white/35">天</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/35">最长 {streak.longest} 天</p>
          <p className="text-xs text-white/35">累计完成 {streak.total_completed} 个</p>
        </div>
      </div>

      {/* Streak broken + repair */}
      {broken && repairable && !repaired && (
        <div className="mt-3 rounded-xl bg-amber-500/[0.07] border border-amber-400/20 p-3">
          <p className="text-xs text-white/70">
            连续记录断了。还有一次修复机会——完成今天的任务，记录恢复。
          </p>
          <button
            onClick={handleRepair}
            className="mt-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-3 py-1.5 text-xs text-white hover:from-indigo-400 hover:to-purple-400 transition-all"
          >
            修复记录
          </button>
        </div>
      )}

      {repaired && (
        <div className="mt-3 rounded-xl bg-emerald-500/[0.07] border border-emerald-400/20 p-3">
          <p className="text-xs text-emerald-300">记录已修复 ✓ 继续保持。</p>
        </div>
      )}

      {broken && !repairable && !repaired && (
        <div className="mt-3 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
          <p className="text-xs text-white/55">
            中断了也没关系。从今天开始新的记录，之前的经验不会消失。
          </p>
        </div>
      )}
    </div>
  );
}
