"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ReturnBanner } from "@/components/ReturnBanner";
import { DarkPeriodWarning } from "@/components/DarkPeriodWarning";
import { ProgressCompare } from "@/components/ProgressCompare";
import { StreakCard } from "@/components/StreakCard";
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
                {plan.total_weeks} 周 · {plan.stages.length} 个阶段 · {plan.stages.reduce((sum, s) => sum + getAllTasks(s).length, 0)} 个任务
              </p>
            )}
          </div>
          {plan && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/cards")}
                className="rounded-full bg-stone-50 border border-stone-200 px-3 py-1 text-xs text-stone-500 hover:text-stone-700 hover:border-stone-300 transition-colors"
              >
                🃏 卡片集
              </button>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                {plan.domain === "programming_app" ? "编程 / 开发" :
                 plan.domain === "visual_design" ? "视觉设计" :
                 plan.domain === "data_analysis" ? "数据分析" :
                 plan.domain === "exam_prep" ? "备考突击" :
                 plan.domain === "language" ? "语言学习" :
                 plan.domain === "product_business" ? "产品 / 副业" : "学习计划"}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Return banner for users coming back after absence */}
        {!loading && plan && <ReturnBanner />}
        {!loading && plan && <DarkPeriodWarning />}
        {!loading && plan && <StreakCard />}
        {!loading && plan && <ProgressCompare />}

        {/* Emotion Curve Entry */}
        {!loading && plan && (
          <button
            onClick={() => router.push("/plan/curve")}
            className="mb-6 flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600 hover:border-stone-300 hover:text-stone-800 transition-colors w-full"
          >
            <span className="text-base">📈</span>
            <span>查看情绪曲线</span>
            <span className="ml-auto text-xs text-stone-400">预测 vs 实际</span>
          </button>
        )}

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
                          <TaskRow key={ti} task={task} index={ti + 1} dayLabel={dayLabel} onClick={() => openTask(task)} />
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
                  <TaskRow key={i} task={task} index={i + 1} dayLabel={dayLabel} onClick={() => openTask(task)} />
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

function TaskRow({ task, index, dayLabel, onClick }: { task: PlanTask; index: number; dayLabel?: string; onClick: () => void }) {
  const displayMin = getDisplayMinutes(task.estimated_minutes);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 rounded-md border border-stone-100 p-3 hover:border-stone-300 hover:bg-stone-50 transition-colors text-left group"
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-stone-200 text-[10px] text-stone-400 group-hover:border-stone-400 group-hover:text-stone-600">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-800 group-hover:text-stone-900">{task.title_plain}</p>
        <p className="text-xs text-stone-400 mt-0.5">{task.title_professional}</p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
        <div className="flex items-center gap-1.5">
          {dayLabel && (
            <span className="text-[10px] text-stone-400 bg-stone-50 rounded px-1 py-0.5">{dayLabel}</span>
          )}
          <DifficultyBadge difficulty={task.difficulty} />
          <span className="text-[11px] text-stone-400">{displayMin}min</span>
        </div>
      </div>
      <svg className="w-4 h-4 text-stone-300 group-hover:text-stone-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
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
