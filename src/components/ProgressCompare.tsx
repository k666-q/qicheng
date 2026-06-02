"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEventsByType } from "@/lib/profile/events";

type ProgressData = {
  userPercent: number;
  avgPercent: number;
  userTasks: number;
  totalTasks: number;
  daysSinceStart: number;
  currentStage: string;
  totalStages: number;
  currentStageIdx: number;
  stageProgress: { name: string; tasks: number; completed: number }[];
};

const ENCOURAGEMENTS: Record<string, string[]> = {
  early: [
    "每个大神的第一天，都跟你现在一样",
    "进度条动了，说明你比昨天的自己更强了",
    "别看进度少，起步本身就是最难的一步",
    "72% 的人在第一周都觉得进度慢",
    "种子刚埋下去，不代表没在生长",
    "今天做了一点，明天就不是从零开始",
    "万事开头难，你已经在路上了",
    "第一步永远最重，你已经迈出去了",
    "不必快，但不要停",
    "每一小步都在缩短终点的距离",
    "刚开始觉得慢是正常的，你在蓄力",
    "从0到1，比从1到100更难",
    "现在做的每件事，未来的你会感谢",
    "开始就赢了一半",
    "你在做90%的人只想不做的事",
    "这条路，走着走着就顺了",
    "起点低不代表终点低",
    "你的进度不需要跟任何人比",
    "慢慢来，比较快",
    "第一周的坚持，是后面所有成长的地基",
    "这种不确定感会过去的",
    "你比你觉得的更适合做这件事",
    "方向对了，慢一点也没关系",
    "今天的努力，是明天的轻松",
    "连开始都不愿意的人，永远到不了终点",
  ],
  middle: [
    "你已经超过了大多数中途放弃的人",
    "65% 的人在这个阶段选择了退出——你还在",
    "半路最容易动摇，但你已经走到这了",
    "回头看看第一天的自己，变化比你以为的大",
    "坚持到这里的人，最后几乎都做完了",
    "进度在增长，你可能自己还没感觉到",
    "你正在穿越最难的那段路",
    "中间的枯燥感是正常的，扛过去就好了",
    "不是越来越难，是你越来越强了",
    "回头看看来时的路，你走了很远了",
    "平台期不是停滞，是积累",
    "现在放弃，之前的努力全白费了",
    "你离转折点可能只差一两天",
    "这个阶段的感觉会过去，但能力不会",
    "保持节奏，不需要加速",
    "已经走了一半了，为什么不走完呢",
    "你在做一件值得骄傲的事",
    "累了就慢一点，但别停下",
    "此刻的坚持，决定最终的结果",
    "你正在变成那个你想成为的人",
    "中途的人最容易低估自己走过的路",
    "困难是暂时的，能力是永久的",
    "再坚持一下，突破就在前面",
    "这段路每个成功的人都走过",
    "你已经证明了自己可以坚持",
  ],
  late: [
    "终点已经在视野里了",
    "到这里的人几乎没有放弃的——包括你",
    "剩下的路比走过的短多了",
    "4周前的你想象不到现在的自己",
    "最后一段路，享受冲刺的感觉",
    "快完成了。你是真正做到最后的少数人",
    "胜利就在眼前，最后再推一把",
    "你做到了大多数人做不到的事",
    "回想第一天的犹豫，现在是不是觉得值了",
    "最后几步，送给自己一个完美收官",
    "这份坚持本身就是最好的证明",
    "快到终点了，别在最后松懈",
    "你即将加入那极少数完成全程的人",
    "结局已经写好了，你只需要走到那一页",
    "冲刺阶段，把最好的状态留在最后",
    "未来的你会为今天的自己鼓掌",
    "还剩一点点了，咬咬牙就到了",
    "你已经是这条路上走得最远的人之一",
    "终点线在向你靠近",
    "这不是结束，是一个新起点的开始",
    "完成的那一刻，所有辛苦都会变成骄傲",
    "最后的坚持，价值最大",
    "你已经证明了自己——现在去拿属于你的结果",
    "还记得开始时的不确定吗？看看现在的你",
    "快到了，别让最后一公里打败你",
  ],
};

const STAGE_COLORS = ["#10b981", "#f59e0b", "#6366f1", "#ec4899", "#14b8a6"];

function getEncouragementPool(percent: number): string[] {
  if (percent <= 0.35) return ENCOURAGEMENTS.early;
  if (percent <= 0.7) return ENCOURAGEMENTS.middle;
  return ENCOURAGEMENTS.late;
}

function getSimulatedAvg(totalTasks: number, daysSinceStart: number, userCompleted: number): number {
  if (userCompleted === 0) return 0;
  if (daysSinceStart <= 1) return 0;
  const avgRate = 0.85 + Math.random() * 0.1;
  const simulated = Math.round(userCompleted * avgRate);
  return Math.min(simulated, totalTasks);
}

export function ProgressCompare() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [encouragement, setEncouragement] = useState("");
  const [encouragementIdx, setEncouragementIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const poolRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const nextEncouragement = useCallback(() => {
    if (poolRef.current.length === 0) return;
    setFade(false);
    setTimeout(() => {
      setEncouragementIdx(prev => {
        const next = (prev + 1) % poolRef.current.length;
        setEncouragement(poolRef.current[next]);
        return next;
      });
      setFade(true);
    }, 200);
  }, []);

  useEffect(() => {
    const planStr = sessionStorage.getItem("qicheng_plan");
    const startStr = localStorage.getItem("qicheng_plan_start");
    if (!planStr) return;

    try {
      const plan = JSON.parse(planStr);
      let totalTasks = 0;
      const stageProgress: { name: string; tasks: number; completed: number }[] = [];

      for (const stage of plan.stages) {
        let stageTasks = 0;
        if (stage.weeks) {
          for (const week of stage.weeks) {
            for (const day of week.days) {
              stageTasks += day.tasks?.length || 0;
            }
          }
        } else if (stage.tasks) {
          stageTasks = stage.tasks.length;
        }
        stageProgress.push({ name: stage.name, tasks: stageTasks, completed: 0 });
        totalTasks += stageTasks;
      }

      const completed = getEventsByType("task_completed");
      const userTasks = completed.length;
      const userPercent = totalTasks > 0 ? userTasks / totalTasks : 0;

      // Distribute completed tasks across stages
      let remaining = userTasks;
      for (const sp of stageProgress) {
        const done = Math.min(remaining, sp.tasks);
        sp.completed = done;
        remaining -= done;
        if (remaining <= 0) break;
      }

      const startDate = startStr ? new Date(startStr) : new Date();
      const daysSinceStart = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const avgTasks = getSimulatedAvg(totalTasks, daysSinceStart, userTasks);
      const avgPercent = totalTasks > 0 ? avgTasks / totalTasks : 0;

      let currentStage = plan.stages?.[0]?.name || "第一阶段";
      let currentStageIdx = 0;
      let taskCounter = 0;
      for (let si = 0; si < plan.stages.length; si++) {
        const sp = stageProgress[si];
        if (userTasks <= taskCounter + sp.tasks) {
          currentStage = plan.stages[si].name;
          currentStageIdx = si;
          break;
        }
        taskCounter += sp.tasks;
      }

      const pool = getEncouragementPool(userPercent);
      poolRef.current = pool;
      const startIdx = Math.floor(Math.random() * pool.length);
      setEncouragementIdx(startIdx);
      setEncouragement(pool[startIdx]);

      setData({ userPercent, avgPercent, userTasks, totalTasks, daysSinceStart, currentStage, totalStages: plan.stages.length, currentStageIdx, stageProgress });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(nextEncouragement, 10000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [nextEncouragement]);

  if (!data || data.totalTasks === 0) return null;

  const userPct = Math.round(data.userPercent * 100);
  const avgPct = Math.round(data.avgPercent * 100);

  return (
    <div className="rounded-2xl border border-stone-100 bg-gradient-to-br from-white via-white to-stone-50/50 p-6 shadow-sm overflow-hidden relative">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-stone-50 to-transparent rounded-bl-full opacity-60" />

      <div className="relative">
        {/* Top: Stage progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-600">学习旅程</span>
            <span className="text-xs text-stone-400">
              {data.currentStageIdx + 1}/{data.totalStages} 阶段
            </span>
          </div>
          <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-stone-100">
            {data.stageProgress.map((stage, i) => {
              const stageWidth = (stage.tasks / data.totalTasks) * 100;
              const fillPercent = stage.tasks > 0 ? (stage.completed / stage.tasks) * 100 : 0;
              return (
                <div
                  key={i}
                  className="relative h-full rounded-full overflow-hidden"
                  style={{ width: `${stageWidth}%`, background: `${STAGE_COLORS[i % STAGE_COLORS.length]}20` }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{
                      width: `${fillPercent}%`,
                      background: STAGE_COLORS[i % STAGE_COLORS.length],
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* Stage labels */}
          <div className="flex mt-1.5 gap-1">
            {data.stageProgress.map((stage, i) => {
              const stageWidth = (stage.tasks / data.totalTasks) * 100;
              const isActive = i === data.currentStageIdx;
              return (
                <span
                  key={i}
                  className={`text-[9px] truncate ${isActive ? "font-medium text-stone-600" : "text-stone-300"}`}
                  style={{ width: `${stageWidth}%` }}
                >
                  {stage.name.replace(/^第.阶段[：:]?\s*/, "")}
                </span>
              );
            })}
          </div>
        </div>

        {/* Middle: Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="text-center p-3 rounded-xl bg-stone-50/80">
            <p className="text-2xl font-bold text-stone-800 tabular-nums">{userPct}%</p>
            <p className="text-[10px] text-stone-400 mt-1">总进度</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-stone-50/80">
            <p className="text-2xl font-bold text-stone-800 tabular-nums">
              {data.userTasks}<span className="text-sm text-stone-300">/{data.totalTasks}</span>
            </p>
            <p className="text-[10px] text-stone-400 mt-1">已完成</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-stone-50/80">
            <p className="text-2xl font-bold text-stone-800 tabular-nums">
              {data.daysSinceStart}<span className="text-sm text-stone-300 ml-0.5">天</span>
            </p>
            <p className="text-[10px] text-stone-400 mt-1">已学习</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-stone-50/80">
            <p className="text-2xl font-bold text-stone-400 tabular-nums">{avgPct}%</p>
            <p className="text-[10px] text-stone-400 mt-1">同期平均</p>
          </div>
        </div>

        {/* Bottom: Encouragement */}
        <p
          onClick={nextEncouragement}
          className={`text-[13px] text-stone-400 leading-relaxed cursor-pointer select-none hover:text-stone-500 transition-all duration-200 text-center ${fade ? "opacity-100" : "opacity-0"}`}
        >
          「{encouragement}」
        </p>
      </div>
    </div>
  );
}
