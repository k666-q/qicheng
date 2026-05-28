"use client";

import { useEffect, useState } from "react";
import type { PredictedEmotionCurve } from "@/lib/plan/types";
import { getEventsByType } from "@/lib/profile/events";

export function DarkPeriodWarning() {
  const [warning, setWarning] = useState<{ message: string; daysUntil: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const curveStr = localStorage.getItem("qicheng_emotion_curve");
    const startStr = localStorage.getItem("qicheng_plan_start");
    if (!curveStr || !startStr) return;

    try {
      const curve = JSON.parse(curveStr) as PredictedEmotionCurve;
      const planStart = new Date(startStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
      const currentWeek = Math.floor(diffDays / 7) + 1;

      const darkPhase = curve.phases.find(p => p.name === "黑暗期" || p.name.includes("黑暗"));
      if (!darkPhase) return;

      const darkStartDay = (darkPhase.week_start - 1) * 7;
      const daysUntilDark = darkStartDay - diffDays;

      // 检查是否今天已经 dismiss 过
      const dismissKey = `qicheng_dark_warning_dismissed_${new Date().toDateString()}`;
      if (localStorage.getItem(dismissKey)) return;

      // 提前2天预警（黑暗期开始前14天到开始前0天）
      if (daysUntilDark > 0 && daysUntilDark <= 14 && currentWeek < darkPhase.week_start) {
        const msg = daysUntilDark <= 2
          ? `根据你的进度，大约 ${daysUntilDark} 天后进入最难的一段。我已经把那段的任务调轻了。你只需要出现就够了。`
          : `大约 ${daysUntilDark} 天后会进入一段相对困难的时期——这是所有人都经历过的。提前知道它会来，就是对抗它的武器。`;

        setWarning({ message: msg, daysUntil: daysUntilDark });
      }

      // 正在黑暗期中 + 连续低情绪
      if (currentWeek >= darkPhase.week_start && currentWeek <= darkPhase.week_end) {
        const recentMoods = getEventsByType("emotion_checkin").slice(-3);
        const lowCount = recentMoods.filter(e => e.event_data.mood === "😫").length;

        if (lowCount >= 2) {
          setWarning({
            message: "连续几天状态都不太好。今天的任务已经自动调轻了——做最轻松的那个就行，或者干脆歇一天。",
            daysUntil: 0,
          });
        }
      }
    } catch { /* ignore */ }
  }, []);

  if (!warning || dismissed) return null;

  const handleDismiss = () => {
    const dismissKey = `qicheng_dark_warning_dismissed_${new Date().toDateString()}`;
    localStorage.setItem(dismissKey, "true");
    setDismissed(true);
  };

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-50 p-4 mb-6">
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0">{warning.daysUntil <= 2 ? "⚡" : "🌊"}</span>
        <div className="flex-1">
          <p className="text-sm text-stone-700 leading-relaxed">{warning.message}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-stone-400 hover:text-stone-600 text-xs shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
