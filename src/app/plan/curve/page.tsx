"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from "recharts";
import type { PredictedEmotionCurve, EmotionPhase } from "@/lib/plan/types";
import { getEventsByType } from "@/lib/profile/events";
import { loadSessionItem } from "@/lib/plan/store";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";

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
        const planStr = loadSessionItem("qicheng_plan");
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
    const planStr = loadSessionItem("qicheng_plan");
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
      <div className="flex h-screen items-center justify-center bg-[#050510]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-400/20 border-t-cyan-400/80 rounded-full animate-spin mx-auto mb-3" />
          <p className="cyber-cursor font-mono text-sm text-cyan-300/50">{generating ? "正在生成你的情绪预测曲线..." : "加载中..."}</p>
        </div>
      </div>
    );
  }

  if (!curve) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050510]">
        <div className="text-center max-w-sm">
          <p className="text-white/70 mb-4">还没有计划数据，先完成引导对话生成计划吧。</p>
          <button
            onClick={() => router.push("/")}
            className="border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-sm tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-colors"
          >
            回到首页
          </button>
        </div>
      </div>
    );
  }

  const phaseColors: Record<string, string> = {
    "新手兴奋期": "bg-emerald-500/15 border-emerald-400/20 text-emerald-300",
    "黑暗期": "bg-fuchsia-500/10 border-fuchsia-400/20 text-fuchsia-300",
    "突破期": "bg-cyan-500/10 border-cyan-400/20 text-cyan-300",
    "成熟期": "bg-amber-500/15 border-amber-400/20 text-amber-300",
  };

  const hasActual = chartData.some(d => d.actual !== undefined);

  return (
    <div className="min-h-screen bg-[#050510] py-8 px-4 pb-6 md:pl-[var(--siderail-width)] transition-[padding] duration-200">
      <CosmicBackground />
      <CyberOverlay />
      <div className="relative z-10 max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/plan/detail")}
          className="font-mono text-sm tracking-wider text-cyan-300/50 hover:text-cyan-200 mb-6 flex items-center gap-1 transition-colors"
        >
          ← 回到计划
        </button>

        <h1 className="cyber-glitch text-xl font-semibold text-white/90" data-text="情绪曲线">情绪曲线</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/40">emotion_curve // forecast</p>
        <p className="mt-2 text-sm text-white/50 mb-6">
          学习不是一条直线。提前知道低谷会来，是对抗它最好的武器。
        </p>
        <div className="cyber-dataline mb-8 h-px w-full" />

        {/* Current Phase Banner */}
        {currentPhase && (
          <div className={`border p-4 mb-8 ${phaseColors[currentPhase.name] || "bg-cyan-400/[0.04] border-cyan-400/15 text-white/70"}`}>
            <p className="text-sm font-medium"><span className="font-mono text-[10px] tracking-[0.25em] opacity-50 mr-2">CURRENT_PHASE</span>当前阶段：{currentPhase.name}</p>
            {currentPhase.message && (
              <p className="text-xs mt-1 opacity-80">{currentPhase.message}</p>
            )}
          </div>
        )}

        {/* Chart */}
        <div className="cyber-panel cyber-corner p-6 mb-8">
          <div className="flex items-center gap-4 mb-4 font-mono text-xs tracking-wider text-cyan-200/50">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-cyan-400/60" style={{ borderStyle: "dashed" }} /> 预测曲线
            </span>
            {hasActual && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-400" /> 你的实际
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12, fill: "rgba(255,255,255,0.4)" }}
                tickFormatter={(v) => `第${v}周`}
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 12, fill: "rgba(255,255,255,0.4)" }}
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
                    <div className="bg-[#0a0e1a] border border-cyan-400/30 p-3 shadow-[0_0_16px_rgba(34,211,238,0.15)] text-xs">
                      <p className="font-mono font-medium text-cyan-200">第 {data.week} 周</p>
                      {data.label && <p className="text-white/50">{data.label}</p>}
                      <p className="text-cyan-300/80 mt-1">预测情绪：{data.predicted}/10</p>
                      {data.actual !== undefined && (
                        <p className="text-emerald-300">实际情绪：{data.actual}/10</p>
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
                    stroke="rgba(232,121,249,0.35)"
                    strokeDasharray="4 4"
                    label={{ value: "黑暗期", position: "top", fontSize: 10, fill: "rgba(232,121,249,0.6)" }}
                  />
                ))}

              <Area
                type="monotone"
                dataKey="predicted"
                stroke="none"
                fill="rgba(34,211,238,0.08)"
                fillOpacity={0.5}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="rgba(34,211,238,0.55)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: "rgba(34,211,238,0.55)" }}
                name="预测"
              />
              {hasActual && (
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#34d399" }}
                  connectNulls={false}
                  name="实际"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Phases */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-cyan-200/70"><span className="font-mono text-[10px] tracking-[0.25em] text-fuchsia-300/40 mr-2">PHASES</span>四个阶段</h2>
          {curve.phases.map((phase, i) => (
            <div
              key={i}
              className={`border p-4 ${phaseColors[phase.name] || "bg-cyan-400/[0.04] border-cyan-400/15 text-white/70"} ${
                currentPhase?.name === phase.name ? "ring-2 ring-cyan-400/40" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium"><span className="font-mono text-[10px] opacity-40 mr-1.5">{String(i + 1).padStart(2, "0")}</span>{phase.name}</span>
                <span className="font-mono text-xs opacity-60">第 {phase.week_start}-{phase.week_end} 周</span>
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
          <h2 className="text-sm font-medium text-cyan-200/70 mb-3"><span className="font-mono text-[10px] tracking-[0.25em] text-fuchsia-300/40 mr-2">CHECKIN_LOG</span>情绪打卡记录</h2>
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
      <p className="text-xs text-white/35">还没有打卡记录。在任务页面完成每日情绪打卡后，这里会出现你的记录。</p>
    );
  }

  const recent = events.slice(-14);

  return (
    <div className="flex flex-wrap gap-2">
      {recent.map((e, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <span className="text-lg">{e.event_data.mood as string}</span>
          <span className="text-[10px] text-white/35">
            {new Date(e.created_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
          </span>
        </div>
      ))}
    </div>
  );
}
