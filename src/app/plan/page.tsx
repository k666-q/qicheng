"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { GeneratedPlan, PlanStage } from "@/lib/plan/types";

const PLAN_SEPARATOR = "|||PLAN|||";

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-stone-50 text-stone-400">加载中...</div>}>
      <PlanContent />
    </Suspense>
  );
}

function PlanContent() {
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [introText, setIntroText] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [versions, setVersions] = useState<{ plan: GeneratedPlan; description: string; time: string }[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const initialized = useRef(false);

  const generatePlan = useCallback(async () => {
    const draftStr = sessionStorage.getItem("qicheng_draft");
    const summaryStr = sessionStorage.getItem("qicheng_summary");

    if (!draftStr) {
      setError("没有找到草图数据，请先完成引导对话。");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: JSON.parse(draftStr),
          conversationSummary: summaryStr || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        setError("生成失败，请重试。");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              accumulated += event.content;
              const metaIdx = accumulated.indexOf(PLAN_SEPARATOR);
              if (metaIdx === -1) {
                setStreamingText(accumulated);
              } else {
                setStreamingText(accumulated.slice(0, metaIdx).trim());
              }
            }
          } catch { /* ignore */ }
        }
      }

      // Parse plan from accumulated text
      const metaIdx = accumulated.indexOf(PLAN_SEPARATOR);
      if (metaIdx !== -1) {
        const intro = accumulated.slice(0, metaIdx).trim();
        const planJson = accumulated.slice(metaIdx + PLAN_SEPARATOR.length).trim();
        setIntroText(intro);
        setStreamingText("");

        try {
          const parsed = JSON.parse(planJson) as GeneratedPlan;
          setPlan(parsed);
          sessionStorage.setItem("qicheng_plan", JSON.stringify(parsed));
        } catch {
          setError("计划解析失败，请重试。");
        }
      } else {
        setIntroText(accumulated);
        setError("计划生成不完整，请重试。");
      }
    } catch {
      setError("网络错误，请重试。");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const existingPlan = sessionStorage.getItem("qicheng_plan");
    if (existingPlan && !searchParams.get("regenerate")) {
      try {
        setPlan(JSON.parse(existingPlan));
        setLoading(false);
        return;
      } catch { /* fall through to generate */ }
    }

    generatePlan();
  }, [generatePlan, searchParams]);

  async function handleEditRequest() {
    if (!editMessage.trim() || editLoading || !plan) return;
    setEditLoading(true);

    try {
      const res = await fetch("/api/plan/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPlan: plan,
          userRequest: editMessage,
        }),
      });

      if (!res.ok || !res.body) {
        setEditLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") accumulated += event.content;
          } catch { /* ignore */ }
        }
      }

      const metaIdx = accumulated.indexOf(PLAN_SEPARATOR);
      if (metaIdx !== -1) {
        const planJson = accumulated.slice(metaIdx + PLAN_SEPARATOR.length).trim();
        const updated = JSON.parse(planJson) as GeneratedPlan;
        // Save current version before updating
        setVersions((prev) => [...prev, {
          plan: plan,
          description: editMessage,
          time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        }]);
        setPlan(updated);
        sessionStorage.setItem("qicheng_plan", JSON.stringify(updated));
        setIntroText(accumulated.slice(0, metaIdx).trim());
      }
    } catch { /* ignore */ }

    setEditMessage("");
    setEditLoading(false);
  }

  function rollbackToVersion(index: number) {
    const ver = versions[index];
    if (!ver) return;
    setPlan(ver.plan);
    sessionStorage.setItem("qicheng_plan", JSON.stringify(ver.plan));
    setShowVersions(false);
  }

  if (error && !plan) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="text-center">
          <p className="text-stone-600">{error}</p>
          <a href="/" className="mt-4 inline-block text-sm text-stone-500 underline">回到首页</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-800">
              {plan?.title || "生成计划中..."}
            </h1>
            {plan && (
              <p className="text-xs text-stone-400 mt-0.5">
                {plan.total_weeks} 周 · {plan.stages.length} 个阶段 · {plan.stages.reduce((sum, s) => sum + s.tasks.length, 0)} 个任务
              </p>
            )}
          </div>
          {plan && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
              {plan.domain === "programming_app" ? "编程 / App" :
               plan.domain === "visual_design" ? "视觉设计" :
               plan.domain === "data_analysis" ? "数据分析" : "产品 / 副业"}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Loading / Streaming state */}
        {loading && (
          <div className="mb-8">
            {streamingText ? (
              <div className="rounded-lg bg-white border border-stone-200 p-6">
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-block w-1 h-4 ml-0.5 bg-stone-400 animate-pulse" />
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
                <p className="mt-3 text-sm text-stone-500">正在为你生成个人计划...</p>
              </div>
            )}
          </div>
        )}

        {/* Intro */}
        {!loading && introText && (
          <div className="mb-8 rounded-lg bg-white border border-stone-200 p-6">
            <p className="text-sm text-stone-700 leading-relaxed">{introText}</p>
          </div>
        )}

        {/* Plan stages */}
        {plan && (
          <div className="space-y-6">
            {plan.stages.map((stage, i) => (
              <StageCard key={i} stage={stage} stageIndex={i} />
            ))}
          </div>
        )}

        {/* First step CTA */}
        {plan && (
          <div className="mt-10 text-center">
            <button className="rounded-lg bg-stone-800 px-8 py-4 text-sm font-medium text-white hover:bg-stone-700 transition-colors">
              {plan.first_step.task_name}
            </button>
            <p className="mt-2 text-xs text-stone-400">
              只需要 {plan.first_step.minutes} 分钟
            </p>
          </div>
        )}

        {/* Version history */}
        {plan && versions.length > 0 && (
          <div className="mt-8 text-right">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="text-xs text-stone-400 hover:text-stone-600 underline"
            >
              {showVersions ? "收起" : `历史版本 (${versions.length})`}
            </button>
            {showVersions && (
              <div className="mt-2 rounded-lg border border-stone-200 bg-white p-4 text-left">
                <p className="text-xs font-medium text-stone-500 mb-2">修改历史（点击回退）</p>
                <div className="space-y-2">
                  {versions.map((ver, i) => (
                    <button
                      key={i}
                      onClick={() => rollbackToVersion(i)}
                      className="w-full text-left rounded-md border border-stone-100 p-2 hover:bg-stone-50 transition-colors"
                    >
                      <span className="text-xs text-stone-400">{ver.time}</span>
                      <p className="text-sm text-stone-700 truncate">修改前：{ver.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit section */}
        {plan && (
          <div className="mt-12 border-t border-stone-200 pt-8">
            <p className="text-sm font-medium text-stone-600 mb-3">
              想调整计划？直接说
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleEditRequest(); }} className="flex gap-2">
              <input
                type="text"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                placeholder="比如：我觉得第一周太难了 / 我想把时间改成每天 15 分钟"
                disabled={editLoading}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={editLoading || !editMessage.trim()}
                className="rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                {editLoading ? "修改中..." : "修改"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

function StageCard({ stage, stageIndex }: { stage: PlanStage; stageIndex: number }) {
  const [expanded, setExpanded] = useState(stageIndex === 0);

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      {/* Stage header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-800 text-xs font-medium text-white">
            {stageIndex + 1}
          </span>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-stone-800">{stage.name}</h3>
            <p className="text-xs text-stone-400">{stage.duration} · {stage.tasks.length} 个任务</p>
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-6 py-4">
          {/* Why */}
          <div className="mb-4">
            <p className="text-xs font-medium text-stone-500 mb-1">为什么这样安排</p>
            <p className="text-sm text-stone-700 leading-relaxed">{stage.why}</p>
          </div>

          {/* Tasks */}
          <div className="mb-4">
            <p className="text-xs font-medium text-stone-500 mb-2">任务</p>
            <div className="space-y-2">
              {stage.tasks.map((task, i) => (
                <div key={i} className="flex items-start gap-3 rounded-md border border-stone-100 p-3 hover:border-stone-200 transition-colors cursor-pointer">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-stone-200 text-[10px] text-stone-400">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-800">{task.title_plain}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{task.title_professional}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs text-stone-400">{task.estimated_minutes}min</span>
                    <div className="mt-0.5 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, d) => (
                        <span key={d} className={`h-1 w-2 rounded-full ${d < task.difficulty ? "bg-stone-600" : "bg-stone-200"}`} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outcome */}
          <div className="rounded-md bg-stone-50 p-3">
            <p className="text-xs font-medium text-stone-500 mb-1">🎯 阶段成果</p>
            <p className="text-sm text-stone-700">{stage.outcome}</p>
          </div>
        </div>
      )}
    </div>
  );
}
