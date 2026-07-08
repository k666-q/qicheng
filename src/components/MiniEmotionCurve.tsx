"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, ReferenceLine
} from "recharts";
import type { PredictedEmotionCurve, GeneratedPlan, PlanTask } from "@/lib/plan/types";
import { getEventsByType } from "@/lib/profile/events";
import { loadSessionItem } from "@/lib/plan/store";

type TaskNode = {
  index: number;
  title: string;
  difficulty: number;
  emotion?: number;
  stage: string;
  stageIdx: number;
  week: number;
};

export function MiniEmotionCurve() {
  const router = useRouter();
  const [taskNodes, setTaskNodes] = useState<TaskNode[]>([]);
  const [stageBreaks, setStageBreaks] = useState<{ index: number; name: string }[]>([]);
  const [currentPhaseName, setCurrentPhaseName] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const buildTaskNodes = useCallback((plan: GeneratedPlan, curveData: PredictedEmotionCurve | null) => {
    const nodes: TaskNode[] = [];
    const breaks: { index: number; name: string }[] = [];
    let taskIndex = 0;
    let weekCounter = 0;

    for (let si = 0; si < plan.stages.length; si++) {
      const stage = plan.stages[si];
      const stageStartIdx = taskIndex;

      if (stage.weeks) {
        for (const week of stage.weeks) {
          weekCounter++;
          for (const day of week.days) {
            for (const task of day.tasks) {
              taskIndex++;
              nodes.push({
                index: taskIndex,
                title: task.title_plain,
                difficulty: task.difficulty || 5,
                stage: stage.name,
                stageIdx: si,
                week: weekCounter,
              });
            }
          }
        }
      } else if (stage.tasks) {
        weekCounter++;
        for (const task of stage.tasks) {
          taskIndex++;
          nodes.push({
            index: taskIndex,
            title: task.title_plain,
            difficulty: task.difficulty || 5,
            stage: stage.name,
            stageIdx: si,
            week: weekCounter,
          });
        }
      }

      if (stageStartIdx < taskIndex) {
        breaks.push({ index: stageStartIdx + 1, name: stage.name });
      }
    }

    // Map emotion curve onto task nodes by week
    if (curveData) {
      for (const node of nodes) {
        const curvePoint = curveData.curve_points.find(p => p.week === node.week);
        if (curvePoint) {
          node.emotion = curvePoint.predicted;
        }
      }
    }

    setTaskNodes(nodes);
    setStageBreaks(breaks);

    // Current phase
    if (curveData) {
      const planStartStr = localStorage.getItem("qicheng_plan_start");
      const planStart = planStartStr ? new Date(planStartStr) : new Date();
      const currentWeek = Math.floor((Date.now() - planStart.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
      const phase = curveData.phases.find(p => currentWeek >= p.week_start && currentWeek <= p.week_end);
      if (phase) setCurrentPhaseName(phase.name);
    }
  }, []);

  const loadAndBuild = useCallback(() => {
    const planStr = loadSessionItem("qicheng_plan");
    if (!planStr) { setLoading(false); return true; }

    const plan = JSON.parse(planStr) as GeneratedPlan;
    const stored = localStorage.getItem("qicheng_emotion_curve");

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PredictedEmotionCurve;
        if (parsed.curve_points.length < plan.total_weeks) {
          localStorage.removeItem("qicheng_emotion_curve");
          return false;
        }
        buildTaskNodes(plan, parsed);
        setLoading(false);
        return true;
      } catch { /* fall through */ }
    }
    return false;
  }, [buildTaskNodes]);

  const generateCurve = useCallback(async () => {
    const planStr = loadSessionItem("qicheng_plan");
    if (!planStr) { setLoading(false); return; }

    setGenerating(true);
    try {
      const plan = JSON.parse(planStr) as GeneratedPlan;
      const res = await fetch("/api/plan/emotion-curve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planTitle: plan.title,
          domain: plan.domain,
          totalWeeks: plan.total_weeks,
          stages: plan.stages.map((s) => ({ name: s.name, duration: s.duration })),
        }),
      });
      const data = await res.json();
      if (data.success && data.curve) {
        localStorage.setItem("qicheng_emotion_curve", JSON.stringify(data.curve));
        buildTaskNodes(plan, data.curve);
      } else {
        // No curve, still show difficulty
        buildTaskNodes(plan, null);
      }
    } catch {
      const planStr2 = loadSessionItem("qicheng_plan");
      if (planStr2) buildTaskNodes(JSON.parse(planStr2), null);
    }
    setGenerating(false);
    setLoading(false);
  }, [buildTaskNodes]);

  useEffect(() => {
    const loaded = loadAndBuild();
    if (!loaded) generateCurve();
  }, [loadAndBuild, generateCurve]);

  if (loading || generating) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] backdrop-blur-md p-6 mb-6">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
          {generating ? "正在生成曲线..." : "加载中..."}
        </div>
      </div>
    );
  }

  if (taskNodes.length === 0) return null;

  const hasEmotion = taskNodes.some(n => n.emotion !== undefined);

  // Prepare colors for stages
  const stageColors = ["#10b981", "#f59e0b", "#6366f1", "#ec4899", "#14b8a6"];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] backdrop-blur-md p-6 mb-6 shadow-[0_0_20px_rgba(100,150,255,0.05)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 text-[11px] text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="flex gap-0.5">
              {stageColors.slice(0, stageBreaks.length).map((c, i) => (
                <span key={i} className="w-2 h-2 rounded-full" style={{ background: c }} />
              ))}
            </span>
            任务难度
          </span>
          {hasEmotion && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0 border-t-2 border-dashed border-white/40" />
              情绪预测
            </span>
          )}
          <span className="text-white/20">|</span>
          <span className="text-white/35">{taskNodes.length} 个节点</span>
        </div>
        {currentPhaseName && (
          <span className="text-[11px] text-white/45 bg-white/[0.06] rounded-md px-2 py-0.5">
            {currentPhaseName}
          </span>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={taskNodes} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="index"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
            tickFormatter={(v) => `${v}`}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
            interval={Math.max(0, Math.floor(taskNodes.length / 10) - 1)}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }}
            tickFormatter={(v) => {
              const labels: Record<number, string> = { 2: "低", 5: "中", 8: "高" };
              return labels[v] || "";
            }}
            ticks={[2, 5, 8]}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0]?.payload as TaskNode;
              return (
                <div className="bg-[#12121a]/95 border border-white/10 rounded-lg p-2.5 shadow-xl backdrop-blur-xl text-[11px] max-w-[200px]">
                  <p className="font-medium text-white/80 truncate">#{data.index} {data.title}</p>
                  <p className="text-white/35 text-[10px]">{data.stage}</p>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-amber-300">难度：{data.difficulty}/10</p>
                    {data.emotion !== undefined && (
                      <p className="text-white/50">情绪：{data.emotion}/10</p>
                    )}
                  </div>
                </div>
              );
            }}
          />

          {/* Stage break reference lines */}
          {stageBreaks.map((brk, i) => (
            <ReferenceLine
              key={i}
              x={brk.index}
              stroke={stageColors[i % stageColors.length]}
              strokeWidth={1}
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={i === 0 ? undefined : { value: brk.name, position: "top", fontSize: 9, fill: stageColors[i % stageColors.length] }}
            />
          ))}

          {/* Difficulty line - dots colored by stage */}
          <Line
            type="monotone"
            dataKey="difficulty"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1.5}
            dot={(props: Record<string, unknown>) => {
              const cx = props.cx as number | undefined;
              const cy = props.cy as number | undefined;
              const idx = props.index as number;
              const node = props.payload as TaskNode;
              if (cx == null || cy == null) return <></>;
              const color = stageColors[node.stageIdx % stageColors.length];
              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill={color}
                  stroke="#12121a"
                  strokeWidth={1.5}
                />
              );
            }}
            activeDot={{ r: 5 }}
            name="难度"
          />

          {/* Emotion prediction line */}
          {hasEmotion && (
            <Line
              type="monotone"
              dataKey="emotion"
              stroke="#a8a29e"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
              name="情绪"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Stage labels at bottom */}
      <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
        {stageBreaks.map((brk, i) => {
          const start = brk.index;
          const end = i < stageBreaks.length - 1 ? stageBreaks[i + 1].index - 1 : taskNodes.length;
          const count = end - start + 1;
          return (
            <div
              key={i}
              className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[10px] text-white/50 whitespace-nowrap"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageColors[i % stageColors.length] }} />
              {brk.name}（{count}）
            </div>
          );
        })}
      </div>

      {/* Click to expand */}
      <button
        onClick={() => router.push("/plan/curve")}
        className="mt-3 w-full text-center text-[11px] text-white/35 hover:text-white/60 transition-colors"
      >
        查看完整阶段详情与情绪打卡 →
      </button>
    </div>
  );
}
