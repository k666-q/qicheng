"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ReturnBanner } from "@/components/ReturnBanner";
import { DarkPeriodWarning } from "@/components/DarkPeriodWarning";
import { ProgressCompare } from "@/components/ProgressCompare";
import { StreakCard } from "@/components/StreakCard";
import { MiniEmotionCurve } from "@/components/MiniEmotionCurve";
import { getCardByStage, saveStageCard } from "@/lib/cards/store";
import type { GeneratedPlan, PlanStage, PlanTask } from "@/lib/plan/types";
import type { StageCard as StageCardType } from "@/lib/cards/types";

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
  const router = useRouter();
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
      <div className="flex h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-white">
        <div className="text-center animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-stone-600 text-sm">{error}</p>
          <a href="/" className="mt-4 inline-block text-sm text-stone-400 hover:text-stone-600 transition-colors">← 回到首页</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50/80 via-white to-stone-50/50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-stone-100/80 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white text-xs font-bold shadow-sm">启</div>
            <div>
              <h1 className="text-base font-semibold text-stone-800">
                {plan?.title || "生成计划中..."}
              </h1>
              {plan && (
                <p className="text-[11px] text-stone-400 mt-0.5">
                  {plan.total_weeks} 周 · {plan.stages.length} 阶段 · {plan.stages.reduce((sum, s) => sum + getAllTasks(s).length, 0)} 任务
                </p>
              )}
            </div>
          </div>
          {plan && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/cards")}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 hover:text-stone-700 hover:border-stone-300 hover:shadow-sm transition-all"
              >
                🃏 卡片集
              </button>
              <span className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs text-white font-medium">
                {plan.domain === "programming_app" ? "编程" :
                 plan.domain === "visual_design" ? "设计" :
                 plan.domain === "data_analysis" ? "数据" :
                 plan.domain === "exam_prep" ? "备考" :
                 plan.domain === "language" ? "语言" :
                 plan.domain === "product_business" ? "产品" : "学习"}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Return banner for users coming back after absence */}
        {!loading && plan && <ReturnBanner />}
        {!loading && plan && <DarkPeriodWarning />}

        {/* Emotion curve inline */}
        {!loading && plan && <MiniEmotionCurve />}

        {/* Stats section */}
        {!loading && plan && (
          <div className="mb-6 space-y-4">
            <ProgressCompare />
            <StreakCard />
          </div>
        )}

        {/* Edit section - below progress */}
        {!loading && plan && <PlanEditBox editMessage={editMessage} setEditMessage={setEditMessage} editLoading={editLoading} handleEditRequest={handleEditRequest} />}

        {/* Loading / Streaming state */}
        {loading && (
          <div className="mb-8 animate-fade-in">
            {streamingText ? (
              <div className="rounded-2xl bg-white border border-stone-100 p-6 shadow-sm">
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-block w-0.5 h-4 ml-0.5 bg-stone-900 animate-pulse rounded-full" />
                </p>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-stone-100 mb-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
                </div>
                <p className="text-sm text-stone-500">正在为你生成专属计划...</p>
                <p className="text-xs text-stone-400 mt-1">通常需要 10-20 秒</p>
              </div>
            )}
          </div>
        )}

        {/* Intro */}
        {!loading && introText && (
          <div className="mb-8 rounded-2xl bg-white border border-stone-100 p-6 shadow-sm">
            <p className="text-sm text-stone-600 leading-relaxed">{introText}</p>
          </div>
        )}

        {/* Plan stages */}
        {plan && (
          <div className="space-y-6">
            {plan.stages.map((stage, i) => (
              <StageCard key={i} stage={stage} stageIndex={i} planTitle={plan.title} planDomain={plan.domain} />
            ))}
          </div>
        )}

        {/* First step CTA */}
        {plan && (
          <div className="mt-10 text-center">
            <button
              onClick={() => router.push("/first-day")}
              className="rounded-lg bg-stone-800 px-8 py-4 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
            >
              开始第一步：{plan.first_step.task_name}
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

      </main>
    </div>
  );
}

function getAllTasks(stage: PlanStage): { task: PlanTask; dayLabel?: string; weekNumber?: number }[] {
  if (stage.weeks && stage.weeks.length > 0) {
    const items: { task: PlanTask; dayLabel?: string; weekNumber?: number }[] = [];
    for (const week of stage.weeks) {
      for (const day of week.days) {
        for (const task of day.tasks) {
          items.push({ task, dayLabel: day.day, weekNumber: week.week_number });
        }
      }
    }
    return items;
  }
  if (stage.tasks && stage.tasks.length > 0) {
    return stage.tasks.map((task) => ({ task, dayLabel: task.day_label }));
  }
  return [];
}

function StageCard({ stage, stageIndex, planTitle, planDomain }: { stage: PlanStage; stageIndex: number; planTitle: string; planDomain: string }) {
  const [expanded, setExpanded] = useState(stageIndex === 0);
  const [stageCompleted, setStageCompleted] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const router = useRouter();
  const allTasks = getAllTasks(stage);

  useEffect(() => {
    const card = getCardByStage(stageIndex);
    if (card) setStageCompleted(true);
  }, [stageIndex]);

  function checkProgressAndConfirm() {
    const completedEvents = JSON.parse(localStorage.getItem("qicheng_profile_events") || "[]");
    const taskCompletedCount = completedEvents.filter(
      (e: { event_type: string }) => e.event_type === "task_completed"
    ).length;

    const completionRate = allTasks.length > 0 ? taskCompletedCount / allTasks.length : 0;

    if (completionRate >= 0.6) {
      doGenerateCard();
    } else {
      const funnyMessages = [
        `🤔 嗯…我看了一下记录，这个阶段 ${allTasks.length} 个任务里你点完成的好像还不太够。\n\n当然，也许你是在别的地方默默努力了——毕竟不是所有进步都被记录。\n\n确定要领这张卡片吗？`,
        `👀 说实话啊，按我这边的数据，你好像还有一些任务没做。\n\n但我也知道数据不代表一切——也许你是那种"做了但不打卡"的人？\n\n真的完成了的话，我信你。`,
        `🕵️ 我翻了一下笔记本…你这个阶段的完成率似乎有点"写意派"。\n\n不过话说回来，如果你觉得自己真的掌握了，谁需要一个一个打勾呢？\n\n确认完成？`,
        `📊 数据显示你可能还有些任务在路上。不过数据也经常说谎——\n\n比如它不知道你可能在洗澡的时候想通了一个概念。\n\n你确定这个阶段可以收工了？`,
      ];
      setConfirmMessage(funnyMessages[Math.floor(Math.random() * funnyMessages.length)]);
      setShowConfirm(true);
    }
  }

  async function doGenerateCard() {
    setShowConfirm(false);
    setGeneratingCard(true);
    try {
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageName: stage.name,
          stageIndex,
          stageOutcome: stage.outcome,
          tasksCompleted: allTasks.length,
          days: Math.round(allTasks.length * 2),
          userQuotes: [],
          emotionData: [],
        }),
      });
      const data = await res.json();

      const card: StageCardType = {
        id: `stage_${stageIndex}_${Date.now()}`,
        stage_index: stageIndex,
        stage_name: stage.name,
        date_range: `${new Date(Date.now() - allTasks.length * 2 * 86400000).toLocaleDateString("zh-CN")} - ${new Date().toLocaleDateString("zh-CN")}`,
        summary: data.summary || stage.outcome,
        user_quote: data.user_quote || "坚持到了这一步",
        emotion_data: [],
        stats: { days: Math.round(allTasks.length * 2), tasks_completed: allTasks.length },
        created_at: new Date().toISOString(),
      };

      saveStageCard(card);
      setStageCompleted(true);
    } catch { /* ignore */ }
    setGeneratingCard(false);
  }

  function openTask(task: PlanTask) {
    sessionStorage.setItem("qicheng_current_task", JSON.stringify(task));
    sessionStorage.setItem("qicheng_task_context", JSON.stringify({
      title: planTitle,
      domain: planDomain,
      stageName: stage.name,
    }));
    router.push("/plan/task");
  }

  const weekGroups: { weekNumber: number; tasks: { task: PlanTask; dayLabel?: string }[] }[] = [];
  if (stage.weeks && stage.weeks.length > 0) {
    for (const week of stage.weeks) {
      const weekTasks: { task: PlanTask; dayLabel?: string }[] = [];
      for (const day of week.days) {
        for (const task of day.tasks) {
          weekTasks.push({ task, dayLabel: day.day });
        }
      }
      if (weekTasks.length > 0) {
        weekGroups.push({ weekNumber: week.week_number, tasks: weekTasks });
      }
    }
  }

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
            <p className="text-xs text-stone-400">{stage.duration} · {allTasks.length} 个任务</p>
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
          <div className="mb-5">
            <p className="text-xs font-medium text-stone-500 mb-1">为什么这样安排</p>
            <p className="text-sm text-stone-700 leading-relaxed">{stage.why}</p>
          </div>

          {/* Tasks - grouped by week if available */}
          <div className="mb-4">
            <p className="text-xs font-medium text-stone-500 mb-3">任务</p>

            {weekGroups.length > 0 ? (
              <div className="space-y-5">
                {weekGroups.map((group) => {
                  const weekMeta = stage.weeks?.find((w) => w.week_number === group.weekNumber);
                  return (
                    <div key={group.weekNumber}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-stone-600 bg-stone-100 rounded px-2 py-0.5">
                          第 {group.weekNumber} 周
                        </span>
                        {weekMeta?.theme && <span className="text-xs text-stone-400">{weekMeta.theme}</span>}
                      </div>
                      <div className="space-y-2">
                        {group.tasks.map(({ task, dayLabel }, ti) => (
                          <TaskRow key={ti} task={task} index={ti + 1} dayLabel={dayLabel} stageIndex={stageIndex} onClick={() => openTask(task)} />
                        ))}
                      </div>
                      {weekMeta?.outcome && (
                        <p className="mt-2 ml-8 text-xs text-stone-400">✓ {weekMeta.outcome}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {allTasks.map(({ task, dayLabel }, i) => (
                  <TaskRow key={i} task={task} index={i + 1} dayLabel={dayLabel} stageIndex={stageIndex} onClick={() => openTask(task)} />
                ))}
              </div>
            )}
          </div>

          {/* Outcome */}
          <div className="rounded-md bg-stone-50 p-3">
            <p className="text-xs font-medium text-stone-500 mb-1">🎯 阶段成果</p>
            <p className="text-sm text-stone-700">{stage.outcome}</p>
          </div>

          {/* Stage completion */}
          <div className="mt-4">
            {stageCompleted ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 font-medium">⛰️ 已完成</span>
                <button
                  onClick={() => router.push("/cards")}
                  className="text-xs text-stone-400 hover:text-stone-600 underline"
                >
                  查看卡片
                </button>
              </div>
            ) : (
              <button
                onClick={checkProgressAndConfirm}
                disabled={generatingCard}
                className="w-full rounded-lg border border-stone-200 px-4 py-2.5 text-xs text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-colors disabled:opacity-50"
              >
                {generatingCard ? "正在生成阶段卡片..." : "✓ 标记此阶段完成"}
              </button>
            )}
          </div>

          {/* Progress confirm modal */}
          {showConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirm(false)}>
              <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{confirmMessage}</p>
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={doGenerateCard}
                    className="flex-1 rounded-lg bg-stone-800 px-4 py-2.5 text-xs text-white hover:bg-stone-700 transition-colors"
                  >
                    确实完成了，给我卡片
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="rounded-lg border border-stone-200 px-4 py-2.5 text-xs text-stone-500 hover:border-stone-300 transition-colors"
                  >
                    我再做做
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getDisplayMinutes(actual: number): number {
  if (actual <= 15) return actual;
  if (actual <= 30) return Math.round(actual * 0.7);
  if (actual <= 60) return Math.round(actual * 0.55);
  return Math.round(actual * 0.5);
}

function getTaskCompletedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const arr = JSON.parse(localStorage.getItem("qicheng_tasks_completed") || "[]");
    return new Set(arr);
  } catch { return new Set(); }
}

function toggleTaskCompleted(taskId: string, completed: boolean) {
  const set = getTaskCompletedSet();
  if (completed) {
    set.add(taskId);
  } else {
    set.delete(taskId);
  }
  localStorage.setItem("qicheng_tasks_completed", JSON.stringify([...set]));
}

function TaskRow({ task, index, dayLabel, onClick, stageIndex }: { task: PlanTask; index: number; dayLabel?: string; onClick: () => void; stageIndex: number }) {
  const displayMin = getDisplayMinutes(task.estimated_minutes);
  const taskId = `s${stageIndex}_t${index}_${task.title_plain.slice(0, 10)}`;
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setCompleted(getTaskCompletedSet().has(taskId));
  }, [taskId]);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !completed;
    setCompleted(next);
    toggleTaskCompleted(taskId, next);
    if (next) {
      const { trackEvent } = require("@/lib/profile/events");
      trackEvent("task_completed", { taskId, title: task.title_plain, stageIndex });
    }
  }

  return (
    <div className="w-full flex items-start gap-3 rounded-md border border-stone-100 p-3 hover:border-stone-300 hover:bg-stone-50 transition-colors text-left group">
      {/* Completion checkbox with index */}
      <button
        onClick={handleToggle}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-medium transition-all ${
          completed
            ? "bg-stone-800 border-stone-800 text-white"
            : "border-stone-200 text-stone-400 hover:border-stone-400"
        }`}
      >
        {completed ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          index
        )}
      </button>

      {/* Task content - clickable */}
      <button onClick={onClick} className="flex-1 min-w-0 text-left">
        <p className={`text-sm group-hover:text-stone-900 transition-colors ${completed ? "text-stone-400 line-through" : "text-stone-800"}`}>
          {task.title_plain}
        </p>
        <p className="text-xs text-stone-400 mt-0.5">{task.title_professional}</p>
      </button>

      <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
        <div className="flex items-center gap-1.5">
          {dayLabel && (
            <span className="text-[10px] text-stone-400 bg-stone-50 rounded px-1 py-0.5">{dayLabel}</span>
          )}
          <DifficultyBadge difficulty={task.difficulty} />
          <span className="text-[11px] text-stone-400">{displayMin}min</span>
        </div>
      </div>
      <button onClick={onClick} className="shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-stone-300 group-hover:text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

const DIFFICULTY_MAP: Record<number, { label: string; color: string }> = {
  1: { label: "轻松", color: "bg-emerald-50 text-emerald-600" },
  2: { label: "简单", color: "bg-sky-50 text-sky-600" },
  3: { label: "适中", color: "bg-amber-50 text-amber-600" },
  4: { label: "挑战", color: "bg-orange-50 text-orange-600" },
  5: { label: "硬核", color: "bg-red-50 text-red-600" },
};

function DifficultyBadge({ difficulty }: { difficulty: number }) {
  const d = DIFFICULTY_MAP[difficulty] || DIFFICULTY_MAP[3];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${d.color}`}>
      {d.label}
    </span>
  );
}

function PlanEditBox({ editMessage, setEditMessage, editLoading, handleEditRequest }: {
  editMessage: string;
  setEditMessage: (v: string) => void;
  editLoading: boolean;
  handleEditRequest: () => void;
}) {
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newImages: { file: File; preview: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        newImages.push({ file, preview: URL.createObjectURL(file) });
      }
    }
    setImages(prev => [...prev, ...newImages].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(idx: number) {
    setImages(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].preview);
      next.splice(idx, 1);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleEditRequest();
    setImages([]);
  }

  return (
    <div className="mb-6 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-stone-500 mb-3">
        想调整计划？直接说
      </p>

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-3">
          {images.map((img, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200">
              <img src={img.preview} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center"
              >
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 focus-within:border-stone-400 focus-within:bg-white transition-colors">
          {/* Photo button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 text-stone-400 hover:text-stone-600 transition-colors"
            title="添加图片"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zm16.5-13.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
          </button>
          <input
            type="text"
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
            placeholder="比如：第一周太难了 / 时间改成每天 15 分钟"
            disabled={editLoading}
            className="flex-1 bg-transparent text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-50"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          type="submit"
          disabled={editLoading || (!editMessage.trim() && images.length === 0)}
          className="rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-700 transition-colors disabled:opacity-50 shrink-0"
        >
          {editLoading ? "修改中..." : "修改"}
        </button>
      </form>
      {images.length < 3 && (
        <p className="text-[10px] text-stone-300 mt-2">可附图片辅助说明（最多 3 张）</p>
      )}
    </div>
  );
}
