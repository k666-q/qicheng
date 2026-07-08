"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ReturnBanner } from "@/components/ReturnBanner";
import { DarkPeriodWarning } from "@/components/DarkPeriodWarning";
import { ProgressCompare } from "@/components/ProgressCompare";
import { StreakCard } from "@/components/StreakCard";
import { MiniEmotionCurve } from "@/components/MiniEmotionCurve";
import { getCardByStage, saveStageCard } from "@/lib/cards/store";
import { loadGraph, getLearnedNodeIds, markLearned, getStoredPlanScope } from "@/lib/universe/store";
import { getTaskNodeIds, getPlanRoute } from "@/lib/universe/plan-link";
import { ensureSmallUniverseForPlan } from "@/lib/universe/small-universe";
import { buildPlanStarMap, syncStarCompletions } from "@/lib/universe/plan-star-map";
import { ensureDailyPlan } from "@/lib/plan/daily-scheduler";
import type { KnowledgeGraph, KnowledgeNode } from "@/lib/universe/types";
import type { GeneratedPlan, PlanStage, PlanTask } from "@/lib/plan/types";
import { saveSessionItem, loadSessionItem } from "@/lib/plan/store";
import { upsertPlanFromMirror } from "@/lib/plan/plans-store";
import type { StageCard as StageCardType } from "@/lib/cards/types";
import { EchoNotice } from "@/components/stimulus/EchoNotice";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { PageGuide } from "@/components/ui/PageGuide";

let _graphCache: KnowledgeGraph | null = null;
function getGraph(): KnowledgeGraph {
  if (!_graphCache) _graphCache = loadGraph();
  return _graphCache;
}
function getGraphNodes(): KnowledgeNode[] {
  return getGraph().nodes;
}

const PLAN_SEPARATOR = "|||PLAN|||";

/** 计划生成/修改/加载后，自动创建或同步对应的小宇宙（星图：任务=星）+ 日级计划（幂等） */
function syncSmallUniverseWithPlan(plan: GeneratedPlan) {
  try {
    const planId = `plan_${plan.title}`;
    const { starIds } = buildPlanStarMap(plan);
    if (starIds.length > 0) {
      ensureSmallUniverseForPlan(planId, plan.title, starIds);
      syncStarCompletions(planId, plan);
    }
    // 日级计划仍基于大宇宙锚定链路（学习页/今日面板用），锚不上则跳过
    const route = getPlanRoute(plan, getGraph());
    if (route.nodeIds.length > 0) {
      ensureDailyPlan(planId, route.nodeIds, Math.max(7, (plan.total_weeks || 1) * 7));
    }
  } catch { /* ignore */ }
}

/** 任务勾选变化后，把完成状态同步到活跃计划的星图（点亮/熄灭星） */
function syncStarsAfterToggle() {
  try {
    const raw = loadSessionItem("qicheng_plan");
    if (!raw) return;
    const plan = JSON.parse(raw) as GeneratedPlan;
    if (plan?.title) syncStarCompletions(`plan_${plan.title}`, plan);
  } catch { /* ignore */ }
}

export default function PlanDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#050510] font-mono text-cyan-300/40">加载中...</div>}>
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
          saveSessionItem("qicheng_plan", JSON.stringify(parsed));
          saveSessionItem("qicheng_plan_intro", intro);
          // 新计划不继承上一个计划的版本历史
          saveSessionItem("qicheng_plan_versions", "[]");
          setVersions([]);
          syncSmallUniverseWithPlan(parsed);
          upsertPlanFromMirror();
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

    const existingPlan = loadSessionItem("qicheng_plan");
    if (existingPlan && !searchParams.get("regenerate")) {
      try {
        const parsed = JSON.parse(existingPlan) as GeneratedPlan;
        setPlan(parsed);
        syncSmallUniverseWithPlan(parsed);
        upsertPlanFromMirror();
        // 恢复生成时的开场白与历史版本
        const savedIntro = loadSessionItem("qicheng_plan_intro");
        if (savedIntro) setIntroText(savedIntro);
        try {
          const savedVersions = loadSessionItem("qicheng_plan_versions");
          if (savedVersions) setVersions(JSON.parse(savedVersions));
        } catch { /* ignore */ }
        setLoading(false);
        return;
      } catch { /* fall through to generate */ }
    }

    // 无活跃计划且不是生成流程 → 回档案馆
    if (!existingPlan && !searchParams.get("regenerate") && !sessionStorage.getItem("qicheng_draft")) {
      router.replace("/plan");
      return;
    }

    generatePlan();
  }, [generatePlan, searchParams, router]);

  // 历史版本持久化
  useEffect(() => {
    if (versions.length > 0) {
      saveSessionItem("qicheng_plan_versions", JSON.stringify(versions));
    }
  }, [versions]);

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
        saveSessionItem("qicheng_plan", JSON.stringify(updated));
        syncSmallUniverseWithPlan(updated);
        const newIntro = accumulated.slice(0, metaIdx).trim();
        setIntroText(newIntro);
        saveSessionItem("qicheng_plan_intro", newIntro);
        upsertPlanFromMirror();
      }
    } catch { /* ignore */ }

    setEditMessage("");
    setEditLoading(false);
  }

  function rollbackToVersion(index: number) {
    const ver = versions[index];
    if (!ver) return;
    setPlan(ver.plan);
    saveSessionItem("qicheng_plan", JSON.stringify(ver.plan));
    syncSmallUniverseWithPlan(ver.plan);
    upsertPlanFromMirror();
    setShowVersions(false);
  }

  if (error && !plan) {
    return (
      <div className="relative flex h-screen items-center justify-center bg-[#050510]">
        <CosmicBackground />
        <CyberOverlay />
        <div className="relative z-10 text-center animate-fade-in">
          <div className="w-10 h-10 border border-red-400/30 bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-red-300/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-white/60 text-sm">{error}</p>
          <a href="/" className="mt-4 inline-block text-sm font-mono text-cyan-300/60 hover:text-cyan-200 transition-colors">← 回到首页</a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#050510] md:pl-[var(--siderail-width)] transition-[padding] duration-200">
      <CosmicBackground />
      <CyberOverlay />
      <PageGuide
        storageKey="qc_guide_plan_detail"
        steps={[
          { title: "这是你的学习计划", description: "AI 根据你的目标生成了分阶段的学习路线。每个阶段包含若干具体任务。" },
          { title: "勾选完成任务", description: "点击任务左侧的勾选框标记完成。所有任务完成后可以生成阶段总结卡。" },
          { title: "进入深度学习", description: "点击任意任务可以进入 AI 引导的深度学习流程，在那里你会体验到刺激式学习。" },
          { title: "修改计划", description: "底部输入框可以向 AI 提出修改请求，比如「把第二阶段拆得更细一些」。" },
        ]}
      />
      {/* 回响通知（到期的记忆/种子/欠条） */}
      <EchoNotice variant="dark" />
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-cyan-400/15 bg-[#050510]/70 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/plan")}
              title="返回档案馆"
              className="flex h-8 w-8 items-center justify-center border border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-300/60 hover:bg-cyan-400/15 hover:text-cyan-200 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-8 h-8 border border-cyan-400/40 bg-cyan-400/10 flex items-center justify-center text-cyan-200 text-xs font-bold shadow-[0_0_12px_rgba(34,211,238,0.25)]">N</div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/40">mission_dossier // active_plan</p>
              <h1 className="text-base font-semibold cyber-neon text-cyan-300">
                {plan?.title || "生成计划中..."}
              </h1>
              {plan && (
                <p className="text-[11px] font-mono text-white/35 mt-0.5">
                  {plan.total_weeks} 周 · {plan.stages.length} 阶段 · {plan.stages.reduce((sum, s) => sum + getAllTasks(s).length, 0)} 任务
                </p>
              )}
            </div>
          </div>
          {plan && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/plan/universe")}
                title="查看这份计划的专属小宇宙"
                className="flex items-center gap-1.5 border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 font-mono text-xs tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-all"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                我的小宇宙
              </button>
              <span className="border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-mono tracking-widest text-fuchsia-300">
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
        <div className="cyber-dataline h-px w-full absolute bottom-0 left-0" />
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 py-8 pb-6">
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
            <UniverseProgressCard />
          </div>
        )}

        {/* Edit section - below progress */}
        {!loading && plan && <PlanEditBox editMessage={editMessage} setEditMessage={setEditMessage} editLoading={editLoading} handleEditRequest={handleEditRequest} />}

        {/* Loading / Streaming state */}
        {loading && (
          <div className="mb-8 animate-fade-in">
            {streamingText ? (
              <div className="cyber-panel cyber-corner p-6">
                <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-block w-0.5 h-4 ml-0.5 bg-cyan-400 animate-pulse" />
                </p>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 border border-cyan-400/25 bg-cyan-400/[0.05] mb-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
                </div>
                <p className="text-sm text-white/50">正在为你生成专属计划...</p>
                <p className="text-xs font-mono text-cyan-300/40 mt-1">通常需要 10-20 秒</p>
              </div>
            )}
          </div>
        )}

        {/* Intro */}
        {!loading && introText && (
          <div className="mb-8 cyber-panel cyber-corner p-6">
            <p className="text-sm text-white/65 leading-relaxed">{introText}</p>
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
              className="border border-cyan-400/40 bg-cyan-400/10 px-8 py-4 font-mono text-sm tracking-widest text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.15)] hover:bg-cyan-400/20 transition-colors"
            >
              开始第一步：{plan.first_step.task_name}
            </button>
            <p className="mt-2 text-xs font-mono text-cyan-300/40">
              只需要 {plan.first_step.minutes} 分钟
            </p>
          </div>
        )}

        {/* Version history */}
        {plan && versions.length > 0 && (
          <div className="mt-8 text-right">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="text-xs font-mono text-cyan-300/60 hover:text-cyan-200 underline"
            >
              {showVersions ? "收起" : `历史版本 (${versions.length})`}
            </button>
            {showVersions && (
              <div className="mt-2 cyber-panel cyber-corner p-4 text-left">
                <p className="text-xs font-mono text-cyan-300/50 mb-2">修改历史（点击回退）</p>
                <div className="space-y-2">
                  {versions.map((ver, i) => (
                    <button
                      key={i}
                      onClick={() => rollbackToVersion(i)}
                      className="w-full text-left border border-cyan-400/15 p-2 hover:bg-cyan-400/[0.06] transition-colors"
                    >
                      <span className="text-xs font-mono text-cyan-300/40">{ver.time}</span>
                      <p className="text-sm text-white/70 truncate">修改前：{ver.description}</p>
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
      // 计算真实数据
      const completedSet = getCompletedTasksForStage();
      const realCompleted = completedSet.size;
      const planStartStr = localStorage.getItem("qc_plan_start_date");
      const planStart = planStartStr ? new Date(planStartStr) : new Date(Date.now() - 7 * 86400000);
      const realDays = Math.max(1, Math.round((Date.now() - planStart.getTime()) / 86400000));

      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageName: stage.name,
          stageIndex,
          stageOutcome: stage.outcome,
          tasksCompleted: realCompleted,
          days: realDays,
          userQuotes: [],
          emotionData: [],
        }),
      });
      const data = await res.json();

      const card: StageCardType = {
        id: `stage_${stageIndex}_${Date.now()}`,
        stage_index: stageIndex,
        stage_name: stage.name,
        date_range: `${planStart.toLocaleDateString("zh-CN")} - ${new Date().toLocaleDateString("zh-CN")}`,
        summary: data.summary || stage.outcome,
        user_quote: data.user_quote || "坚持到了这一步",
        emotion_data: [],
        stats: { days: realDays, tasks_completed: realCompleted },
        created_at: new Date().toISOString(),
      };

      saveStageCard(card);
      setStageCompleted(true);

      // D5: 阶段完成里程碑自动触发
      try {
        const { saveMilestone, getMilestonesByType } = await import("@/lib/milestones/store");
        const existing = getMilestonesByType("stage_complete");
        const alreadyHas = existing.some((m) => m.stage === stageIndex);
        if (!alreadyHas) {
          saveMilestone("stage_complete", `完成了「${stage.name}」`, `用了 ${realDays} 天，完成了 ${realCompleted} 个任务`, { stage: stageIndex });
        }
        const { trackEvent } = await import("@/lib/profile/events");
        trackEvent("stage_completed", { stageIndex, stageName: stage.name });
      } catch { /* milestone save error */ }
    } catch { /* ignore */ }
    setGeneratingCard(false);
  }

  function getCompletedTasksForStage(): Set<string> {
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("qicheng_tasks_completed") || "[]");
      const stagePrefix = `s${stageIndex}_`;
      return new Set(arr.filter((id) => id.startsWith(stagePrefix)));
    } catch { return new Set(); }
  }

  function openTask(task: PlanTask) {
    saveSessionItem("qicheng_current_task", JSON.stringify(task));
    saveSessionItem("qicheng_task_context", JSON.stringify({
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
    <div className="cyber-panel cyber-corner">
      {/* Stage header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-cyan-400/[0.04] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center border border-cyan-400/40 bg-cyan-400/10 font-mono text-xs text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
            {stageIndex + 1}
          </span>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white/85">{stage.name}</h3>
            <p className="text-xs font-mono text-cyan-300/40">{stage.duration} · {allTasks.length} 个任务</p>
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-white/35 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-cyan-400/15 px-6 py-4">
          {/* Why */}
          <div className="mb-5">
            <p className="text-xs font-mono text-cyan-300/50 mb-1">为什么这样安排</p>
            <p className="text-sm text-white/70 leading-relaxed">{stage.why}</p>
          </div>

          {/* Tasks - grouped by week if available */}
          <div className="mb-4">
            <p className="text-xs font-mono text-cyan-300/50 mb-3">任务</p>

            {weekGroups.length > 0 ? (
              <div className="space-y-5">
                {weekGroups.map((group) => {
                  const weekMeta = stage.weeks?.find((w) => w.week_number === group.weekNumber);
                  return (
                    <div key={group.weekNumber}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-cyan-200/80 bg-cyan-500/10 border border-cyan-400/25 px-2 py-0.5">
                          第 {group.weekNumber} 周
                        </span>
                        {weekMeta?.theme && <span className="text-xs text-white/35">{weekMeta.theme}</span>}
                      </div>
                      <div className="space-y-2">
                        {group.tasks.map(({ task, dayLabel }, ti) => (
                          <TaskRow key={ti} task={task} index={ti + 1} dayLabel={dayLabel} stageIndex={stageIndex} onClick={() => openTask(task)} />
                        ))}
                      </div>
                      {weekMeta?.outcome && (
                        <p className="mt-2 ml-8 text-xs text-white/35">✓ {weekMeta.outcome}</p>
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
          <div className="border border-fuchsia-400/20 bg-fuchsia-500/[0.05] p-3">
            <p className="text-xs font-mono text-fuchsia-300/60 mb-1">🎯 阶段成果</p>
            <p className="text-sm text-white/70">{stage.outcome}</p>
          </div>

          {/* Stage completion */}
          <div className="mt-4">
            {stageCompleted ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-medium">⛰️ 已完成</span>
                <button
                  onClick={() => router.push("/cards")}
                  className="text-xs font-mono text-cyan-300/60 hover:text-cyan-200 underline"
                >
                  查看卡片
                </button>
              </div>
            ) : (
              <button
                onClick={checkProgressAndConfirm}
                disabled={generatingCard}
                className="w-full border border-cyan-400/25 px-4 py-2.5 text-xs font-mono tracking-widest text-cyan-300/70 hover:bg-cyan-400/10 hover:border-cyan-400/50 transition-colors disabled:opacity-50"
              >
                {generatingCard ? "正在生成阶段卡片..." : "✓ 标记此阶段完成"}
              </button>
            )}
          </div>

          {/* Progress confirm modal */}
          {showConfirm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowConfirm(false)}>
              <div className="cyber-panel cyber-corner max-w-sm w-full p-6 shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{confirmMessage}</p>
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={doGenerateCard}
                    className="flex-1 border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-xs font-mono tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-colors"
                  >
                    确实完成了，给我卡片
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="border border-white/10 px-4 py-2.5 text-xs font-mono text-white/40 hover:bg-white/[0.06] transition-colors"
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
  const router = useRouter();
  const displayMin = getDisplayMinutes(task.estimated_minutes);
  const taskId = `s${stageIndex}_t${index}_${task.title_plain.slice(0, 10)}`;
  const [completed, setCompleted] = useState(false);

  // 任务锚定的知识宇宙节点（限定在计划学科域内，AI node_ids 优先，关键词匹配兜底）
  const nodeIds = useMemo(() => {
    try {
      return getTaskNodeIds(task, getGraphNodes(), getStoredPlanScope());
    } catch {
      return [];
    }
  }, [task]);

  useEffect(() => {
    setCompleted(getTaskCompletedSet().has(taskId));
  }, [taskId]);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !completed;
    setCompleted(next);
    toggleTaskCompleted(taskId, next);
    // 点亮/熄灭小宇宙里对应的星（记录时间戳，供时间流回放）
    syncStarsAfterToggle();
    if (next) {
      // 直接点亮关联的知识宇宙节点
      for (const id of nodeIds) markLearned(id);
      const { trackEvent } = require("@/lib/profile/events");
      trackEvent("task_completed", {
        taskId,
        title: task.title_plain,
        title_plain: task.title_plain,
        title_professional: task.title_professional,
        stageIndex,
        node_ids: nodeIds,
      });
    }
  }

  function handleOpen() {
    const { trackEvent } = require("@/lib/profile/events");
    trackEvent("task_clicked", { title_plain: task.title_plain, stageIndex });
    onClick();
  }

  return (
    <div className="w-full flex items-start gap-3 cyber-panel cyber-corner p-3 text-left group">
      {/* Completion checkbox with index */}
      <button
        onClick={handleToggle}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] font-mono transition-all ${
          completed
            ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-300"
            : "border-cyan-400/25 text-cyan-300/50 hover:border-cyan-400/60"
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
      <button onClick={handleOpen} className="flex-1 min-w-0 text-left">
        <p className={`text-sm group-hover:text-white transition-colors ${completed ? "text-white/35 line-through" : "text-white/80"}`}>
          {task.title_plain}
        </p>
        <p className="text-xs text-white/35 mt-0.5">{task.title_professional}</p>
      </button>

      <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
        <div className="flex items-center gap-1.5">
          {dayLabel && (
            <span className="text-[10px] font-mono text-cyan-300/50 bg-cyan-400/[0.06] border border-cyan-400/15 px-1 py-0.5">{dayLabel}</span>
          )}
          <DifficultyBadge difficulty={task.difficulty} />
          <span className="text-[11px] font-mono text-cyan-300/40">{displayMin}min</span>
        </div>
      </div>
      {nodeIds.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/universe?focus=${nodeIds[0]}`);
          }}
          title="在知识宇宙中查看此知识点"
          className="shrink-0 mt-0.5 text-cyan-400/60 hover:text-cyan-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </button>
      )}
      <button onClick={handleOpen} className="shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-white/20 group-hover:text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

const DIFFICULTY_MAP: Record<number, { label: string; color: string }> = {
  1: { label: "轻松", color: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20" },
  2: { label: "简单", color: "bg-sky-500/15 text-sky-300 border border-sky-400/20" },
  3: { label: "适中", color: "bg-amber-500/15 text-amber-300 border border-amber-400/20" },
  4: { label: "挑战", color: "bg-orange-500/15 text-orange-300 border border-orange-400/20" },
  5: { label: "硬核", color: "bg-red-500/15 text-red-300 border border-red-400/20" },
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
    <div className="mb-6 cyber-panel cyber-corner p-5">
      <p className="text-xs font-mono text-cyan-300/50 mb-3">
        想调整计划？直接说
      </p>

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-3">
          {images.map((img, i) => (
            <div key={i} className="relative w-16 h-16 overflow-hidden border border-cyan-400/25">
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
        <div className="flex-1 flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/[0.03] px-3 py-2 focus-within:border-cyan-400/50 transition-colors">
          {/* Photo button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 text-cyan-300/40 hover:text-cyan-200 transition-colors"
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
            className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 focus:outline-none disabled:opacity-50"
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
          className="border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 font-mono text-sm tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-colors disabled:opacity-40 shrink-0"
        >
          {editLoading ? "修改中..." : "修改"}
        </button>
      </form>
      {images.length < 3 && (
        <p className="text-[10px] font-mono text-cyan-300/30 mt-2">可附图片辅助说明（最多 3 张）</p>
      )}
    </div>
  );
}

function UniverseProgressCard() {
  const router = useRouter();
  const [stats, setStats] = useState<{ learned: number; total: number } | null>(null);

  useEffect(() => {
    try {
      const graph = loadGraph();
      const learnedIds = getLearnedNodeIds(graph.nodes);
      setStats({ learned: learnedIds.size, total: graph.nodes.length });
    } catch { /* ignore */ }
  }, []);

  if (!stats) return null;

  const pct = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;

  return (
    <button
      onClick={() => router.push("/universe")}
      className="w-full cyber-panel cyber-corner p-4 text-left transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center border border-indigo-400/30 bg-indigo-500/15 text-indigo-300 group-hover:bg-indigo-500/25 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/80">知识宇宙</p>
            <p className="text-[11px] font-mono text-cyan-300/40">已点亮 {stats.learned} / {stats.total} 个知识点</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] font-mono cyber-neon text-cyan-300">{pct}%</span>
          <svg className="h-3.5 w-3.5 text-white/25 group-hover:text-cyan-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </button>
  );
}
