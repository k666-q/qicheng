"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from "recharts";
import type { PredictedEmotionCurve, EmotionPhase } from "@/lib/plan/types";
import { getEventsByType } from "@/lib/profile/events";

type ChartPoint = {
  week: number;
  predicted: number;
  actual?: number;
  label?: string;
};

export default function CurvePage() {
  const router = useRouter();
  const [curve, setCurve] = useState<PredictedEmotionCurve | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [currentPhase, setCurrentPhase] = useState<EmotionPhase | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadCurve = useCallback(() => {
    const stored = localStorage.getItem("qicheng_emotion_curve");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PredictedEmotionCurve;
        // 检查周数是否与计划匹配
        const planStr = sessionStorage.getItem("qicheng_plan");
        if (planStr) {
          const plan = JSON.parse(planStr);
          if (parsed.curve_points.length < plan.total_weeks) {
            // 周数不匹配，需要重新生成
            localStorage.removeItem("qicheng_emotion_curve");
            return false;
          }
        }
        setCurve(parsed);
        buildChartData(parsed);
        setLoading(false);
        return true;
      } catch { /* fall through */ }
    }
    return false;
  }, []);

  const generateCurve = useCallback(async () => {
    const planStr = sessionStorage.getItem("qicheng_plan");
    if (!planStr) {
      setLoading(false);
      return;
    }

    setGenerating(true);
    try {
      const plan = JSON.parse(planStr);
      const res = await fetch("/api/plan/emotion-curve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planTitle: plan.title,
          domain: plan.domain,
          totalWeeks: plan.total_weeks,
          stages: plan.stages.map((s: { name: string; duration: string }) => ({
            name: s.name,
            duration: s.duration,
          })),
        }),
      });

      const data = await res.json();
      if (data.success && data.curve) {
        localStorage.setItem("qicheng_emotion_curve", JSON.stringify(data.curve));
        setCurve(data.curve);
        buildChartData(data.curve);
      }
    } catch { /* ignore */ }
    setGenerating(false);
    setLoading(false);
  }, []);

  function buildChartData(curveData: PredictedEmotionCurve) {
    const moodEvents = getEventsByType("emotion_checkin");

    const moodByWeek: Record<number, number[]> = {};
    const planStartStr = localStorage.getItem("qicheng_plan_start");
    const planStart = planStartStr ? new Date(planStartStr) : new Date();

    for (const event of moodEvents) {
      const eventDate = new Date(event.created_at);
      const diffDays = Math.floor((eventDate.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
      const week = Math.floor(diffDays / 7) + 1;
      if (week > 0) {
        if (!moodByWeek[week]) moodByWeek[week] = [];
        const moodMap: Record<string, number> = { "😫": 2, "😐": 4, "🙂": 7, "💪": 9 };
        const val = moodMap[event.event_data.mood as string] || 5;
        moodByWeek[week].push(val);
      }
    }

    const points: ChartPoint[] = curveData.curve_points.map((p) => {
      const actualArr = moodByWeek[p.week];
      const actual = actualArr ? Math.round(actualArr.reduce((a, b) => a + b, 0) / actualArr.length) : undefined;
      return { week: p.week, predicted: p.predicted, actual, label: p.label };
    });

    setChartData(points);

    if (!planStartStr) {
      localStorage.setItem("qicheng_plan_start", new Date().toISOString());
    }

    const now = new Date();
    const diffWeeks = Math.floor((now.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
    const phase = curveData.phases.find(p => diffWeeks >= p.week_start && diffWeeks <= p.week_end);
    setCurrentPhase(phase || null);
  }

  useEffect(() => {
    if (!loadCurve()) {
      generateCurve();
    }
  }, [loadCurve, generateCurve]);

  if (loading || generating) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-stone-500">{generating ? "正在生成你的情绪预测曲线..." : "加载中..."}</p>
        </div>
      </div>
    );
  }

  if (!curve) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="text-center max-w-sm">
          <p className="text-stone-600 mb-4">还没有计划数据，先完成引导对话生成计划吧。</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white hover:bg-stone-700"
          >
            回到首页
          </button>
        </div>
      </div>
    );
  }

  const phaseColors: Record<string, string> = {
    "新手兴奋期": "bg-emerald-50 border-emerald-200 text-emerald-800",
    "黑暗期": "bg-stone-100 border-stone-300 text-stone-800",
    "突破期": "bg-blue-50 border-blue-200 text-blue-800",
    "成熟期": "bg-amber-50 border-amber-200 text-amber-800",
  };

  const hasActual = chartData.some(d => d.actual !== undefined);

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/plan")}
          className="text-sm text-stone-400 hover:text-stone-600 mb-6 flex items-center gap-1"
        >
          ← 回到计划
        </button>

        <h1 className="text-xl font-semibold text-stone-800 mb-2">情绪曲线</h1>
        <p className="text-sm text-stone-500 mb-8">
          学习不是一条直线。提前知道低谷会来，是对抗它最好的武器。
        </p>

        {/* Current Phase Banner */}
        {currentPhase && (
          <div className={`rounded-lg border p-4 mb-8 ${phaseColors[currentPhase.name] || "bg-stone-50 border-stone-200"}`}>
            <p className="text-sm font-medium">当前阶段：{currentPhase.name}</p>
            {currentPhase.message && (
              <p className="text-xs mt-1 opacity-80">{currentPhase.message}</p>
            )}
          </div>
        )}

        {/* Chart */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 mb-8">
          <div className="flex items-center gap-4 mb-4 text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-stone-400 rounded" style={{ borderStyle: "dashed" }} /> 预测曲线
            </span>
            {hasActual && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 rounded" /> 你的实际
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12, fill: "#78716c" }}
                tickFormatter={(v) => `第${v}周`}
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 12, fill: "#78716c" }}
                tickFormatter={(v) => {
                  const labels: Record<number, string> = { 2: "低落", 5: "平稳", 8: "高涨" };
                  return labels[v] || "";
                }}
                ticks={[2, 5, 8]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload as ChartPoint;
                  return (
                    <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm text-xs">
                      <p className="font-medium text-stone-800">第 {data.week} 周</p>
                      {data.label && <p className="text-stone-500">{data.label}</p>}
                      <p className="text-stone-600 mt-1">预测情绪：{data.predicted}/10</p>
                      {data.actual !== undefined && (
                        <p className="text-emerald-600">实际情绪：{data.actual}/10</p>
                      )}
                    </div>
                  );
                }}
              />

              {/* Dark period highlight */}
              {curve.phases
                .filter(p => p.name === "黑暗期")
                .map((p, i) => (
                  <ReferenceLine
                    key={i}
                    x={p.week_start}
                    stroke="#d6d3d1"
                    strokeDasharray="4 4"
                    label={{ value: "黑暗期", position: "top", fontSize: 10, fill: "#a8a29e" }}
                  />
                ))}

              <Area
                type="monotone"
                dataKey="predicted"
                stroke="none"
                fill="#f5f5f4"
                fillOpacity={0.5}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#a8a29e"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: "#a8a29e" }}
                name="预测"
              />
              {hasActual && (
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#10b981" }}
                  connectNulls={false}
                  name="实际"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Phases */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-stone-600">四个阶段</h2>
          {curve.phases.map((phase, i) => (
            <div
              key={i}
              className={`rounded-lg border p-4 ${phaseColors[phase.name] || "bg-stone-50 border-stone-200"} ${
                currentPhase?.name === phase.name ? "ring-2 ring-stone-400" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{phase.name}</span>
                <span className="text-xs opacity-60">第 {phase.week_start}-{phase.week_end} 周</span>
              </div>
              <p className="text-xs opacity-70">{phase.system_behavior}</p>
              {phase.message && (
                <p className="text-xs mt-2 italic opacity-80">"{phase.message}"</p>
              )}
            </div>
          ))}
        </div>

        {/* Mood History */}
        <div className="mt-8">
          <h2 className="text-sm font-medium text-stone-600 mb-3">情绪打卡记录</h2>
          <MoodHistory />
        </div>
      </div>
    </div>
  );
}

function MoodHistory() {
  const events = getEventsByType("emotion_checkin");

  if (events.length === 0) {
    return (
      <p className="text-xs text-stone-400">还没有打卡记录。在任务页面完成每日情绪打卡后，这里会出现你的记录。</p>
    );
  }

  const recent = events.slice(-14);

  return (
    <div className="flex flex-wrap gap-2">
      {recent.map((e, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <span className="text-lg">{e.event_data.mood as string}</span>
          <span className="text-[10px] text-stone-400">
            {new Date(e.created_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
          </span>
        </div>
      ))}
    </div>
  );
}
