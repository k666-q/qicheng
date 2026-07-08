"use client";

// 计划小宇宙：每份计划专属的独立星图页面。
// 任务 = 星，阶段 = 星座。从计划档案馆/计划详情进入，与主知识宇宙完全独立。

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KnowledgeUniverse } from "@/components/universe/KnowledgeUniverse";
import { TimelineSlider } from "@/components/universe/TimelineSlider";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { buildPlanStarMap, getCompletedStarIds, syncStarCompletions } from "@/lib/universe/plan-star-map";
import { loadSmallUniverses, ensureSmallUniverseForPlan, type SmallUniverse } from "@/lib/universe/small-universe";
import { loadPlans, getActivePlanId } from "@/lib/plan/plans-store";
import { loadSessionItem } from "@/lib/plan/store";
import type { GeneratedPlan } from "@/lib/plan/types";
import type { KnowledgeNode, NodeStatus } from "@/lib/universe/types";

export default function PlanUniversePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#050510] font-mono text-cyan-300/40">加载中...</div>}>
      <PlanUniverseContent />
    </Suspense>
  );
}

function PlanUniverseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryPlanId = searchParams.get("planId");

  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [universe, setUniverse] = useState<SmallUniverse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [resolvedPlanId, setResolvedPlanId] = useState<string | null>(null);

  useEffect(() => {
    const targetId = queryPlanId || getActivePlanId();
    let found: GeneratedPlan | null = null;
    let foundId: string | null = null;

    if (targetId) {
      const stored = loadPlans().find((p) => p.id === targetId);
      if (stored) {
        found = stored.plan;
        foundId = stored.id;
      }
    }
    // 兜底：镜像里的当前计划（旧数据未入仓库的情况）
    if (!found) {
      try {
        const raw = loadSessionItem("qicheng_plan");
        if (raw) {
          const p = JSON.parse(raw) as GeneratedPlan;
          if (p?.title && (!targetId || targetId === `plan_${p.title}`)) {
            found = p;
            foundId = `plan_${p.title}`;
          }
        }
      } catch { /* ignore */ }
    }

    if (found && foundId) {
      setPlan(found);
      setResolvedPlanId(foundId);
      // 保证该计划的小宇宙记录存在并对齐（不改变全局活跃计划）
      const { starIds } = buildPlanStarMap(found);
      if (starIds.length > 0) {
        ensureSmallUniverseForPlan(foundId, found.title, starIds);
        syncStarCompletions(foundId, found);
      }
      setUniverse(loadSmallUniverses().find((u) => u.planId === foundId) || null);
    }
    setLoaded(true);
  }, [queryPlanId]);

  const starMap = useMemo(() => (plan ? buildPlanStarMap(plan) : null), [plan]);
  const completedStarIds = useMemo(
    () => (plan ? getCompletedStarIds(plan) : new Set<string>()),
    [plan]
  );

  // 时间流回放
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineVisibleIds, setTimelineVisibleIds] = useState<Set<string> | null>(null);
  const handleTimelineChange = useCallback((ids: Set<string>) => setTimelineVisibleIds(ids), []);
  const handleTimelineClose = useCallback(() => {
    setTimelineOpen(false);
    setTimelineVisibleIds(null);
  }, []);

  // 星详情面板
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);

  const displayGraph = useMemo(() => {
    if (!starMap) return { subjects: [], nodes: [], edges: [] };
    if (timelineVisibleIds !== null) {
      const visible = new Set(
        starMap.graph.nodes.filter((n) => timelineVisibleIds.has(n.id)).map((n) => n.id)
      );
      return {
        ...starMap.graph,
        nodes: starMap.graph.nodes.filter((n) => visible.has(n.id)),
        edges: starMap.graph.edges.filter((e) => visible.has(e.source) && visible.has(e.target)),
      };
    }
    return starMap.graph;
  }, [starMap, timelineVisibleIds]);

  const statuses = useMemo(() => {
    const map = new Map<string, NodeStatus>();
    if (starMap) {
      for (const id of starMap.starIds) {
        map.set(id, completedStarIds.has(id) ? "learned" : "available");
      }
    }
    return map;
  }, [starMap, completedStarIds]);

  const expandedSubjects = useMemo(
    () => new Set(starMap?.graph.subjects.map((s) => s.id) ?? []),
    [starMap]
  );
  const alwaysVisibleIds = useMemo(() => new Set(starMap?.starIds ?? []), [starMap]);

  const progress = useMemo(() => {
    const total = starMap?.starIds.length ?? 0;
    const completed = starMap ? starMap.starIds.filter((id) => completedStarIds.has(id)).length : 0;
    return { total, completed, ratio: total > 0 ? completed / total : 0 };
  }, [starMap, completedStarIds]);

  if (!loaded) {
    return <div className="flex h-screen items-center justify-center bg-[#050510] font-mono text-cyan-300/40">加载中...</div>;
  }

  if (!plan || !starMap || starMap.starIds.length === 0) {
    return (
      <div className="relative flex h-screen flex-col items-center justify-center bg-[#050510] overflow-hidden">
        <CosmicBackground />
        <CyberOverlay />
        <div className="cyber-panel cyber-corner relative z-10 max-w-md p-8 text-center">
          <p className="font-mono text-xs tracking-widest text-cyan-300/60">PLAN UNIVERSE</p>
          <h1 className="mt-2 text-lg font-semibold text-white/90">还没有可展示的小宇宙</h1>
          <p className="mt-3 text-sm text-white/50">
            {plan ? "这份计划还没有任务，先去完善计划。" : "未找到对应的计划，先去创建或选择一份计划。"}
          </p>
          <button
            onClick={() => router.push("/plan")}
            className="mt-6 border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-xs tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-all"
          >
            ← 返回星际档案馆
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#050510] md:pl-[var(--siderail-width)] transition-[padding] duration-200">
      <CosmicBackground />
      <CyberOverlay />

      {/* Graph canvas */}
      <div className="absolute inset-0 z-[1]">
        <KnowledgeUniverse
          graph={displayGraph}
          statuses={statuses}
          expandedSubjects={expandedSubjects}
          alwaysVisibleIds={alwaysVisibleIds}
          selectedNodeId={selectedNode?.id ?? null}
          highlightSubjectId={null}
          onSubjectToggle={() => {}}
          onKnowledgeSelect={(node) => setSelectedNode(node)}
          onBackgroundClick={() => setSelectedNode(null)}
          planRouteIds={timelineVisibleIds === null ? starMap.starIds : undefined}
        />
      </div>

      {/* Header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-6 pt-5">
        <div className="cyber-panel cyber-corner pointer-events-auto flex items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => router.push("/plan")}
            className="flex items-center gap-1 text-white/50 hover:text-white/90 transition-colors"
            title="返回星际档案馆"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-widest text-cyan-300/60">PLAN UNIVERSE · 计划小宇宙</p>
            <h1 className="truncate max-w-[260px] text-sm font-semibold text-white/90">{plan.title}</h1>
          </div>
        </div>

        {/* 星座图例：阶段配色 */}
        <div className="cyber-panel pointer-events-auto hidden max-w-sm flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 md:flex">
          {starMap.graph.subjects.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-[10px] text-white/55">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.color}` }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* 进度 + 时间流 */}
      <div className="pointer-events-none absolute inset-x-0 top-[76px] z-10 flex justify-center px-6">
        <div className="cyber-panel cyber-corner pointer-events-auto flex items-center gap-3 px-4 py-2.5 shadow-lg">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
          <div className="flex items-center gap-2">
            <span className="block h-[3px] w-32 rounded-full bg-white/10 overflow-hidden">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-all duration-500"
                style={{ width: `${progress.ratio * 100}%` }}
              />
            </span>
            <span className="text-[10px] text-cyan-300/80 shrink-0">
              {progress.completed}/{progress.total} 已点亮
            </span>
          </div>
          {universe && universe.timeline.some((e) => e.action === "completed") && (
            <button
              onClick={() => setTimelineOpen(true)}
              title="回放这个小宇宙的构建历程"
              className="ml-1 flex items-center gap-1.5 border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1.5 font-mono text-[11px] tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-all shrink-0"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              时间流
            </button>
          )}
        </div>
      </div>

      {/* 时间流回放滑块 */}
      {timelineOpen && universe && (
        <TimelineSlider
          events={universe.timeline}
          onTimeChange={handleTimelineChange}
          onClose={handleTimelineClose}
        />
      )}

      {/* 星详情面板 */}
      {selectedNode && (
        <div className="absolute inset-0 z-20">
          <div className="absolute inset-0" onClick={() => setSelectedNode(null)} />
          {(() => {
            const star = starMap.stars.find((s) => s.id === selectedNode.id);
            const stage = starMap.graph.subjects.find((s) => s.id === selectedNode.subjectId);
            const done = completedStarIds.has(selectedNode.id);
            return (
              <div className="absolute right-6 top-1/2 w-[340px] max-w-[calc(100vw-48px)] -translate-y-1/2">
                <div className="cyber-panel cyber-corner p-5 shadow-2xl shadow-black/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] tracking-widest text-cyan-300/70">
                        {stage?.name ?? "阶段"} · 星
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-white/90 leading-snug">
                        {selectedNode.name}
                      </h3>
                      {selectedNode.plain_name && selectedNode.plain_name !== selectedNode.name && (
                        <p className="mt-1 text-xs text-white/45">{selectedNode.plain_name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="shrink-0 text-white/40 hover:text-white/80 transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] tracking-widest ${
                        done
                          ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                          : "border-white/15 bg-white/[0.03] text-white/50"
                      }`}
                    >
                      {done ? "已点亮" : "未点亮"}
                    </span>
                    {star && (
                      <span className="border border-white/15 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] tracking-widest text-white/50">
                        难度 {star.task.difficulty}/10
                      </span>
                    )}
                    {star && star.task.estimated_minutes > 0 && (
                      <span className="border border-white/15 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] tracking-widest text-white/50">
                        约 {star.task.estimated_minutes} 分钟
                      </span>
                    )}
                  </div>

                  {selectedNode.description && (
                    <p className="mt-3 text-xs leading-relaxed text-white/55">{selectedNode.description}</p>
                  )}

                  <button
                    onClick={() => router.push(
                      `/universe/learn?node=${selectedNode.id}&planId=${resolvedPlanId}&from=plan`
                    )}
                    className="mt-4 w-full border border-indigo-400/40 bg-indigo-400/10 px-3 py-2 font-mono text-xs tracking-widest text-indigo-200 hover:bg-indigo-400/20 transition-all"
                  >
                    ✦ 开始学习
                  </button>
                  <button
                    onClick={() => router.push("/plan/detail")}
                    className="mt-2 w-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 font-mono text-xs tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-all"
                  >
                    去计划里完成这个任务 →
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
