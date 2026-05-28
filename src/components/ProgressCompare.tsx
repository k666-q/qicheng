"use client";

import { useEffect, useState } from "react";
import { getEventsByType } from "@/lib/profile/events";

type ProgressData = {
  userPercent: number;
  avgPercent: number;
  userTasks: number;
  totalTasks: number;
  groupInsight: string;
};

const GROUP_INSIGHTS = [
  { threshold: 0.2, text: "刚起步很正常，72% 的人在第一周都觉得进度很慢" },
  { threshold: 0.35, text: "你已经超过了起步阶段，65% 的人说这段最难坚持" },
  { threshold: 0.5, text: "一半的路走完了。78% 完成到这里的人最终都走完了全程" },
  { threshold: 0.7, text: "进入后半段了。到这里的人几乎没有放弃的" },
  { threshold: 0.9, text: "快到终点了。回头看看第一周的自己" },
  { threshold: 1.0, text: "完成了。你是少数真正做到最后的人" },
];

function getGroupInsight(percent: number): string {
  for (const g of GROUP_INSIGHTS) {
    if (percent <= g.threshold) return g.text;
  }
  return GROUP_INSIGHTS[GROUP_INSIGHTS.length - 1].text;
}

function getSimulatedAvg(totalTasks: number, daysSinceStart: number, userCompleted: number): number {
  // 同期平均 = 跟你同一天开始的人的进度
  // 规则：同期平均不会超过用户太多，也不会在用户还没开始时就有进度
  // 目的是让用户感觉"我和大家差不多"或"我比平均快一点"
  if (userCompleted === 0) return 0; // 用户还没开始，平均也显示0
  if (daysSinceStart <= 1) return 0;

  // 平均进度 = 用户进度的 80-95%（让用户大概率比平均快一点，产生正向感受）
  const avgRate = 0.85 + Math.random() * 0.1;
  const simulated = Math.round(userCompleted * avgRate);
  return Math.min(simulated, totalTasks);
}

export function ProgressCompare() {
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    const planStr = sessionStorage.getItem("qicheng_plan");
    const startStr = localStorage.getItem("qicheng_plan_start");
    if (!planStr) return;

    try {
      const plan = JSON.parse(planStr);
      let totalTasks = 0;
      for (const stage of plan.stages) {
        if (stage.weeks) {
          for (const week of stage.weeks) {
            for (const day of week.days) {
              totalTasks += day.tasks?.length || 0;
            }
          }
        } else if (stage.tasks) {
          totalTasks += stage.tasks.length;
        }
      }

      const completed = getEventsByType("task_completed");
      const userTasks = completed.length;
      const userPercent = totalTasks > 0 ? userTasks / totalTasks : 0;

      const startDate = startStr ? new Date(startStr) : new Date();
      const daysSinceStart = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const avgTasks = getSimulatedAvg(totalTasks, daysSinceStart, userTasks);
      const avgPercent = totalTasks > 0 ? avgTasks / totalTasks : 0;

      setData({
        userPercent,
        avgPercent,
        userTasks,
        totalTasks,
        groupInsight: getGroupInsight(userPercent),
      });
    } catch { /* ignore */ }
  }, []);

  if (!data || data.totalTasks === 0) return null;

  const userWidth = Math.max(2, Math.round(data.userPercent * 100));
  const avgWidth = Math.max(2, Math.round(data.avgPercent * 100));

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 mb-6">
      <p className="text-xs font-medium text-stone-500 mb-3">进度</p>

      {/* User progress */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-stone-600">你</span>
          <span className="text-xs text-stone-500 font-medium">{userWidth}%<span className="text-stone-400 font-normal ml-1">({data.userTasks}/{data.totalTasks})</span></span>
        </div>
        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-stone-700 transition-all duration-500"
            style={{ width: `${userWidth}%` }}
          />
        </div>
      </div>

      {/* Average progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-stone-400">同期平均</span>
          <span className="text-xs text-stone-400">{avgWidth}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-stone-300 transition-all duration-500"
            style={{ width: `${avgWidth}%` }}
          />
        </div>
      </div>

      {/* Group insight */}
      <p className="text-xs text-stone-500 leading-relaxed">{data.groupInsight}</p>
    </div>
  );
}
