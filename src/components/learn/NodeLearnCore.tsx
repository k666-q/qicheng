"use client";

// 星核探索核心组件：节点级 AI 刺激引导学习（/universe/learn 与 /plan/learn 共用）。
// 流式解析标记协议 → 单卡推进（连续悬念）→ 总结后收尾 → 点亮节点回星图庆祝。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { loadGraph, getLearnedNodeIds, markLearned } from "@/lib/universe/store";
import { completeTask, buildTaskId } from "@/lib/plan/completion";
import { PageGuide } from "@/components/ui/PageGuide";
import { loadDeepNodes, getAllLoadedDeepNodes } from "@/lib/universe/deep-loader";
import type { KnowledgeNode } from "@/lib/universe/types";
import { getPlanRoute } from "@/lib/universe/plan-link";
import { resolveUniverseForPlan, completeNodeInUniverse, ensureSmallUniverseForPlan } from "@/lib/universe/small-universe";
import { getActivePlanId, loadPlans } from "@/lib/plan/plans-store";
import { buildPlanStarMap, getCompletedStarIds, stageTasks } from "@/lib/universe/plan-star-map";
import { markDailyComplete } from "@/lib/plan/daily-scheduler";
import { loadSessionItem } from "@/lib/plan/store";
import type { GeneratedPlan } from "@/lib/plan/types";
import { nodeDimGains } from "@/lib/universe/cognition";
import { composeScript, recordHookUsed } from "@/lib/stimulus/engine";
import { parseSegments, validateScript, issuesToInstruction } from "@/lib/stimulus/protocol";
import { cycleDef, type CycleNumber } from "@/lib/learn/cycles";
import {
  nextCycleOf,
  memoryFor,
  recordCycleComplete,
  addStickingPoint,
  addDebt,
  getMasteryMap,
} from "@/lib/universe/mastery";
import { diagnoseGap } from "@/lib/learn/gap-diagnosis";
import { addEcho } from "@/lib/stimulus/echo";
import { awardBadge, getAbilityPoints } from "@/lib/stimulus/rewards";
import { trackEvent } from "@/lib/profile/events";
import {
  loadExploreSession,
  saveExploreSession,
  clearExploreSession,
} from "@/lib/storage/session-store";
import type { ExploreScript, Segment } from "@/lib/stimulus/types";
import { CorrectFeedback, ComboCounter } from "@/components/stimulus/CorrectFeedback";
import { MessageNotePanel } from "@/components/notes/MessageNotePanel";
import { ResizableDivider, useResizablePanel } from "@/components/ui/ResizableDivider";
import { addNote } from "@/lib/notes/message-notes";
import {
  HookCard,
  TeachCard,
  PredictCard,
  FlashCard,
  BlankCard,
  QuizCard,
  HuntCard,
  RecallCard,
  InputCard,
  FeedbackCard,
  GainCard,
  GiantCard,
  SeedCard,
  DebtCard,
  CodeCard,
  DeriveCard,
  LayerDoneCard,
  StickCard,
  GapCard,
} from "@/components/stimulus/StimulusCards";

/** 阻塞型卡片：完成交互前不能继续推进 */
const BLOCKING_TYPES = new Set(["predict", "quiz", "flash", "blank", "recall", "ask_summary", "create"]);

function parseStarId(id: string): { stageIndex: number; taskIndex: number } | null {
  const m = id.match(/^star_s(\d+)_t(\d+)$/);
  if (!m) return null;
  return { stageIndex: parseInt(m[1]), taskIndex: parseInt(m[2]) };
}

const DOMAIN_SUBJECT_MAP: Record<string, string> = {
  programming_app: "编程", programming: "编程", design: "设计",
  math: "数学", music: "音乐", language: "语言", science: "科学",
  business: "商业", art: "艺术", writing: "写作", fitness: "健身",
};

/** 简易星空背景（轻量，无星云） */
function MiniStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const stars: { x: number; y: number; r: number; phase: number; speed: number }[] = [];

    function resize() {
      const cv = canvasRef.current;
      if (!cv) return;
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 140; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.3 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.8,
      });
    }

    let t = 0;
    function draw() {
      const cv = canvasRef.current;
      if (!cv || !ctx) return;
      t += 0.016;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const s of stars) {
        const alpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(s.phase + t * s.speed));
        ctx.beginPath();
        ctx.arc(s.x * cv.width, s.y * cv.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" />;
}

type ChatTurn = { role: "user" | "ai"; content: string };

/** Manim 动画视频缓存 key */
function manimCacheKey(nodeId: string) {
  return `manim_${nodeId}`;
}
function loadCachedVideo(nodeId: string): string | null {
  try {
    const raw = localStorage.getItem(manimCacheKey(nodeId));
    if (!raw) return null;
    const { url, ts } = JSON.parse(raw);
    if (Date.now() - ts > 7 * 24 * 3600 * 1000) {
      localStorage.removeItem(manimCacheKey(nodeId));
      return null;
    }
    return url;
  } catch { return null; }
}
function saveCachedVideo(nodeId: string, url: string) {
  try {
    localStorage.setItem(manimCacheKey(nodeId), JSON.stringify({ url, ts: Date.now() }));
  } catch { /* quota */ }
}

export function NodeLearnContent({ overrideReturnPath }: { overrideReturnPath?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const nodeId = searchParams.get("node") || "";
  const urlPlanId = searchParams.get("planId");
  const urlFrom = searchParams.get("from");
  const isStarNode = nodeId.startsWith("star_");

  // 计算返回路径：优先使用 overrideReturnPath（/plan/learn 传入），其次 from 参数，最后根据上下文决定
  const computedReturnPath = overrideReturnPath
    || (urlFrom ? decodeURIComponent(urlFrom) : null)
    || (pathname.startsWith("/plan") ? "/plan/detail" : "/universe");

  const graph = useMemo(() => loadGraph(), []);

  // star_ 节点：从计划数据构造临时 KnowledgeNode
  const [planNode, setPlanNode] = useState<KnowledgeNode | null>(null);
  const starPlanRef = useRef<{ planId: string; plan: GeneratedPlan } | null>(null);

  useEffect(() => {
    if (!isStarNode || !nodeId) return;
    const pid = urlPlanId || getActivePlanId();
    if (!pid) return;

    const stored = loadPlans().find((p) => p.id === pid);
    if (!stored) return;

    const parsed = parseStarId(nodeId);
    if (!parsed) return;
    const stage = stored.plan.stages[parsed.stageIndex];
    if (!stage) return;
    const tasks = stageTasks(stage);
    const task = tasks[parsed.taskIndex];
    if (!task) return;

    starPlanRef.current = { planId: pid, plan: stored.plan };
    const { starIds } = buildPlanStarMap(stored.plan);
    ensureSmallUniverseForPlan(pid, stored.plan.title, starIds);

    setPlanNode({
      id: nodeId,
      subjectId: stored.plan.domain || "general",
      name: task.title_professional || task.title_plain,
      plain_name: task.title_plain,
      description: task.reason || task.title_plain,
      difficulty: task.difficulty || 5,
      keywords: [],
    });
  }, [isStarNode, nodeId, urlPlanId]);

  // 先从静态图找，找不到则动态加载 deep 节点（Tier 1/2 在 deep/ 文件夹）
  const [deepNode, setDeepNode] = useState<KnowledgeNode | null>(null);
  const staticNode = useMemo(
    () => (isStarNode ? null : graph.nodes.find((n) => n.id === nodeId) || null),
    [graph, nodeId, isStarNode]
  );

  useEffect(() => {
    if (isStarNode || staticNode || !nodeId) return;
    let cancelled = false;

    // 1) 先查 deep-loader 内存缓存（用户在宇宙页下钻时已加载过）
    const cached = getAllLoadedDeepNodes();
    const fromCache = cached.nodes.find((n) => n.id === nodeId);
    if (fromCache) { setDeepNode(fromCache); return; }

    // 2) 缓存未命中 → 遍历 Tier 0 动态加载
    (async () => {
      const tier0Ids = graph.nodes.filter((n) => n.hasChildren).map((n) => n.id);
      for (const parentId of tier0Ids) {
        const data = await loadDeepNodes(parentId);
        if (!data) continue;
        const found = data.nodes.find((n) => n.id === nodeId);
        if (found) { if (!cancelled) setDeepNode(found); return; }
        // Tier 2
        for (const t1 of data.nodes.filter((n) => n.hasChildren)) {
          const t2 = await loadDeepNodes(t1.id);
          if (!t2) continue;
          const found2 = t2.nodes.find((n) => n.id === nodeId);
          if (found2) { if (!cancelled) setDeepNode(found2); return; }
        }
      }
      if (!cancelled) setDeepNode(null);
    })();
    return () => { cancelled = true; };
  }, [isStarNode, staticNode, nodeId, graph.nodes]);

  const node = staticNode || planNode || deepNode;
  const subject = useMemo(() => {
    if (!node) return undefined;
    if (isStarNode) {
      const domainName = DOMAIN_SUBJECT_MAP[node.subjectId] || node.subjectId;
      return { id: node.subjectId, name: domainName, color: "#22d3ee", description: "", category: "其他" as const };
    }
    return graph.subjects.find((s) => s.id === node.subjectId);
  }, [graph, node, isStarNode]);

  // deep 节点加载完成标记（避免加载中误显示"未找到"）
  const [deepSearchDone, setDeepSearchDone] = useState(!!staticNode);
  useEffect(() => {
    if (isStarNode || staticNode || deepNode) { setDeepSearchDone(true); return; }
    const timer = setTimeout(() => setDeepSearchDone(true), 5000);
    return () => clearTimeout(timer);
  }, [isStarNode, staticNode, deepNode]);

  // Preview phase: show node context before diving in
  const [showPreview, setShowPreview] = useState(true);

  const [script, setScript] = useState<ExploreScript | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);

  // ═══ 多周目 ═══
  // 本次进入的周目号：来自 URL ?cycle=（回炉时可指定），否则由掌握度推算下一周目。star_ 节点固定 1。
  const urlCycle = Number(searchParams.get("cycle") || 0);
  const cycle: CycleNumber = useMemo(() => {
    if (!node || isStarNode) return 1;
    if (urlCycle >= 1 && urlCycle <= 4) return urlCycle as CycleNumber;
    return nextCycleOf(node.id, getLearnedNodeIds(graph.nodes));
  }, [node, isStarNode, urlCycle, graph.nodes]);
  const cycleInfo = cycleDef(cycle);
  // 小助理跨周目记忆（第 2 周目起发给模型）
  const memory = useMemo(() => {
    if (!node || isStarNode) return undefined;
    const learned = getLearnedNodeIds(graph.nodes);
    const m = memoryFor(node.id, learned);
    const neighborIds = new Set<string>();
    for (const e of graph.edges) {
      if (e.source === node.id) neighborIds.add(e.target);
      if (e.target === node.id) neighborIds.add(e.source);
    }
    const neighborLearned = [...neighborIds]
      .filter((id) => learned.has(id))
      .map((id) => graph.nodes.find((n) => n.id === id)?.name)
      .filter((n): n is string => !!n)
      .slice(0, 6);
    return { ...m, neighborLearned };
  }, [node, isStarNode, graph]);
  // 本周目答题统计（GAIN 时写入 CycleRecord）
  const quizStatsRef = useRef<{ total: number; firstTry: number; wrong: string[]; summary: string; startedAt: number }>({
    total: 0, firstTry: 0, wrong: [], summary: "", startedAt: Date.now(),
  });
  // 输出校验重试计数（每阶段最多 1 次）
  const retriedRef = useRef<Set<string>>(new Set());
  // 缺口诊断：同一节点只弹一次
  const gapShownRef = useRef(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [completedIdx, setCompletedIdx] = useState<Set<number>>(new Set());
  const [streaming, setStreaming] = useState(false);
  const [phase, setPhase] = useState<"explore" | "closing" | "done">("explore");
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  // 先修关系软提示
  const [prereqWarning, setPrereqWarning] = useState<{ name: string; id: string }[] | null>(null);
  useEffect(() => {
    if (!node || isStarNode) return;
    const learned = getLearnedNodeIds(graph.nodes);
    const prereqEdges = graph.edges.filter((e) => e.type === "prerequisite" && e.target === nodeId);
    const unmet = prereqEdges
      .filter((e) => !learned.has(e.source))
      .map((e) => graph.nodes.find((n) => n.id === e.source))
      .filter((n): n is typeof n & { id: string; name: string } => !!n)
      .map((n) => ({ id: n!.id, name: n!.name }));
    if (unmet.length > 0) setPrereqWarning(unmet);
  }, [node, nodeId, graph, isStarNode]);

  // Manim 动画视频状态
  const [manimVideoUrl, setManimVideoUrl] = useState<string | null>(null);
  const [manimLoading, setManimLoading] = useState(false);
  const [manimError, setManimError] = useState<string | null>(null);
  const [showManimPanel, setShowManimPanel] = useState(false);

  // 右侧常驻工具面板：默认展开，Tab 切换 笔记 / AI 答疑（笔记默认激活）
  const [panelOpen, setPanelOpen] = useState(true);
  const [sideTab, setSideTab] = useState<"notes" | "qa">("notes");
  const learnRightPanel = useResizablePanel("qc_learn_right_w", 380, 280, 500);
  const [excerptToast, setExcerptToast] = useState(false);

  // 答对连击计数
  const [comboCount, setComboCount] = useState(0);
  const [showComboFeedback, setShowComboFeedback] = useState(false);

  // 自由提问线程（独立于主推进队列，不打乱探索节奏）。text 为原始回答文本，用于持久化。
  const [chatThreads, setChatThreads] = useState<{ q: string; text: string; segs: Segment[] }[]>([]);

  // 流式累计文本（explore 与 closing 各自累计，段落列表拼接）
  const exploreTextRef = useRef("");
  const closingTextRef = useRef(""); // closing 阶段原始文本（持久化用）
  const extraSegmentsRef = useRef<Segment[]>([]); // closing 段
  const historyRef = useRef<ChatTurn[]>([]);
  const startedRef = useRef(false);
  const restoredRef = useRef(false); // 本次进入是否从存档恢复
  const sideEffectsRef = useRef<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // 缺口诊断卡的插入位置（运行时合成，不进协议文本）
  const gapInsertRef = useRef<{ afterIdx: number; seg: Segment } | null>(null);

  const rebuildSegments = useCallback(() => {
    const base = parseSegments(exploreTextRef.current).segments;
    const all = [...base, ...extraSegmentsRef.current];
    const g = gapInsertRef.current;
    if (g) all.splice(Math.min(g.afterIdx + 1, all.length), 0, g.seg);
    setSegments(all);
  }, []);

  /** 调用流式接口，返回累计文本；onText 在每次增量后回调 */
  const callStream = useCallback(
    async (
      callPhase: "explore" | "closing" | "chat",
      userMessage: string,
      onText: (accumulated: string) => void,
      retryInstruction?: string
    ): Promise<string | null> => {
      if (!node || !script) return null;
      const res = await fetch("/api/node-learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node: {
            id: node.id,
            name: node.name,
            plain_name: node.plain_name,
            description: node.description,
            difficulty: node.difficulty,
            keywords: node.keywords,
            subjectName: subject?.name,
          },
          script,
          phase: callPhase,
          history: historyRef.current,
          userMessage,
          cycle: script.cycle || cycle,
          memory,
          retryInstruction,
        }),
      });
      if (!res.ok || !res.body) return null;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              accumulated += event.content;
              onText(accumulated);
            }
          } catch {
            /* ignore */
          }
        }
      }
      return accumulated;
    },
    [node, script, subject, cycle, memory]
  );

  /** explore / closing 阶段：段落进入主推进队列 */
  const streamPhase = useCallback(
    async (callPhase: "explore" | "closing", userMessage: string, retryInstruction?: string) => {
      setStreaming(true);
      setError(null);
      try {
        const accumulated = await callStream(callPhase, userMessage, (acc) => {
          if (callPhase === "explore") {
            exploreTextRef.current = acc;
          } else {
            extraSegmentsRef.current = [
              ...extraSegmentsRef.current.filter((s) => !s._tmp),
              ...parseSegments(acc).segments.map((s) => ({ ...s, _tmp: true })),
            ];
          }
          rebuildSegments();
        }, retryInstruction);

        if (accumulated === null) {
          setError("引导者失联了，请重试");
          setStreaming(false);
          return;
        }

        // §4 输出校验：explore 阶段结构不合格 → 带纠错说明重试一次
        if (callPhase === "explore" && script && !retriedRef.current.has("explore")) {
          const c = (script.cycle || cycle) as CycleNumber;
          const issues = validateScript(parseSegments(accumulated).segments, {
            cycle: c,
            minQuestions: c === 4 ? 1 : Math.max(1, script.quizCount),
            requireSummary: c !== 4,
            requireDeepDive: cycleDef(c).script.requireDeepDive,
            requireCreate: cycleDef(c).script.requireCreate,
          });
          if (issues.length > 0) {
            retriedRef.current.add("explore");
            trackEvent("script_invalid", { node_id: node?.id, cycle: c, issues: issues.map((i) => i.code) });
            exploreTextRef.current = "";
            extraSegmentsRef.current = [];
            setSegments([]);
            setVisibleCount(0);
            setStreaming(false);
            await streamPhaseRef.current?.("explore", "", issuesToInstruction(issues));
            return;
          }
        }

        // 固化本轮段落与对话历史
        if (callPhase === "explore") {
          exploreTextRef.current = accumulated;
        } else {
          closingTextRef.current += accumulated;
          extraSegmentsRef.current = [
            ...extraSegmentsRef.current.filter((s) => !s._tmp),
            ...parseSegments(accumulated).segments,
          ];
        }
        if (userMessage) historyRef.current.push({ role: "user", content: userMessage });
        historyRef.current.push({ role: "ai", content: accumulated });
        rebuildSegments();
      } catch {
        setError("网络问题，请重试");
      }
      setStreaming(false);
    },
    [callStream, rebuildSegments, script, cycle, node]
  );
  // 让 streamPhase 内部可以递归调用自身（校验失败重试）
  const streamPhaseRef = useRef<typeof streamPhase | null>(null);
  streamPhaseRef.current = streamPhase;

  // 初始化：尝试恢复存档，否则组剧本 + 启动探索
  useEffect(() => {
    if (!node || startedRef.current) return;

    // 有存档 → 跳过预览直接恢复；但存档属于别的周目（上周目已完成 / 指定回炉）→ 丢弃，重新开始
    let saved = loadExploreSession(node.id);
    if (saved && saved.exploreText && (saved.script?.cycle ?? 1) !== cycle) {
      clearExploreSession(node.id);
      saved = null;
    }
    if (saved && saved.exploreText) {
      setShowPreview(false);
      startedRef.current = true;
    } else if (showPreview) {
      return; // 等待用户确认预览后再开始
    } else {
      startedRef.current = true;
    }

    if (saved && saved.exploreText) {
      // 从存档恢复：原始协议文本重新解析，进度与对话原样回放
      restoredRef.current = true;
      exploreTextRef.current = saved.exploreText;
      closingTextRef.current = saved.closingText || "";
      extraSegmentsRef.current = saved.closingText
        ? parseSegments(saved.closingText).segments
        : [];
      historyRef.current = saved.history || [];
      // 已经看过的段落不再重复触发副作用（点亮/回响/徽章）
      for (let i = 0; i < saved.visibleCount; i++) sideEffectsRef.current.add(i);
      setScript(saved.script);
      setPhase(saved.phase === "done" ? "closing" : saved.phase);
      setCompletedIdx(new Set(saved.completedIdx));
      setChatThreads(
        (saved.chatThreads || []).map((t) => ({
          q: t.q,
          text: t.text,
          segs: parseSegments(t.text).segments,
        }))
      );
      const base = parseSegments(saved.exploreText).segments;
      setSegments([...base, ...extraSegmentsRef.current]);
      setVisibleCount(Math.max(1, saved.visibleCount));
      return;
    }

    const s = composeScript(node, cycle);
    setScript(s);
    quizStatsRef.current = { total: 0, firstTry: 0, wrong: [], summary: "", startedAt: Date.now() };
    recordHookUsed(s.hookId);
    trackEvent("node_explored", { node_id: node.id, node_name: node.name, hook: s.hookId, cycle });
    trackEvent("cycle_started", { node_id: node.id, cycle });
  }, [node, graph, showPreview, cycle]);

  // 初始化 Manim 视频缓存（一次性迁移：清除 v2 prompt 重写之前的所有旧缓存）
  useEffect(() => {
    if (!nodeId) return;
    // 一次性清除所有旧 manim 缓存（只执行一次）
    const migrationKey = "manim_cache_v2_cleared";
    if (!localStorage.getItem(migrationKey)) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("manim_")) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(migrationKey, "1");
    }
    // 正常读取缓存
    const cached = loadCachedVideo(nodeId);
    if (cached) setManimVideoUrl(cached);
  }, [nodeId]);

  // 生成 Manim 原理动画
  const handleGenerateManim = useCallback(async () => {
    if (!node || manimLoading) return;
    setManimLoading(true);
    setManimError(null);
    setShowManimPanel(true);
    try {
      const res = await fetch("/api/manim-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: node.id,
          name: node.name,
          description: node.description,
          keywords: node.keywords,
          subjectName: subject?.name,
        }),
      });
      const data = await res.json();
      console.log("[manim-debug] API response:", JSON.stringify({ status: res.status, isFallback: data.isFallback, videoUrl: data.videoUrl?.slice(0, 80), _v: data._v, error: data.error }));
      if (!res.ok || data.error) {
        setManimError(data.error || "生成失败，请稍后重试");
      } else if (data.videoUrl) {
        setManimVideoUrl(data.videoUrl);
        if (!data.isFallback) {
          saveCachedVideo(node.id, data.videoUrl);
        }
      }
    } catch {
      setManimError("网络错误，无法连接渲染服务");
    }
    setManimLoading(false);
  }, [node, subject, manimLoading]);

  // script 就绪后启动 explore 流
  useEffect(() => {
    if (script && segments.length === 0 && !streaming && phase === "explore" && exploreTextRef.current === "") {
      streamPhase("explore", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);

  // 自动显示第一张卡
  useEffect(() => {
    if (visibleCount === 0 && segments.length > 0 && (segments.length > 1 || !streaming)) {
      setVisibleCount(1);
    }
  }, [segments, streaming, visibleCount]);

  // 滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount, segments.length, streaming, chatThreads]);

  const markComplete = useCallback((idx: number, correct = true) => {
    setCompletedIdx((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
    if (correct) {
      setComboCount((c) => c + 1);
      setShowComboFeedback(true);
      setTimeout(() => setShowComboFeedback(false), 1500);
    } else {
      setComboCount(0);
    }
  }, []);

  // 收尾段落的副作用：点亮节点 / 发徽章 / 回响入队
  useEffect(() => {
    if (!node) return;
    for (let i = 0; i < visibleCount && i < segments.length; i++) {
      if (sideEffectsRef.current.has(i)) continue;
      const seg = segments[i];
      if (seg.type === "gain") {
        sideEffectsRef.current.add(i);
        if (!isStarNode) {
          // 多周目：写入周目记录（内部会同步 markLearned，等级只升不降）
          const st = quizStatsRef.current;
          const c = (script?.cycle || cycle) as CycleNumber;
          const ratio = st.total > 0 ? st.firstTry / st.total : 1;
          const passed = restoredRef.current
            ? true
            : ratio >= cycleInfo.pass.minFirstTryRatio && st.summary.length >= cycleInfo.pass.minSummaryChars;
          recordCycleComplete(node.id, {
            cycle: c,
            startedAt: st.startedAt,
            completedAt: Date.now(),
            quizTotal: st.total,
            quizFirstTry: st.firstTry,
            wrongOptions: st.wrong,
            summary: st.summary || undefined,
            // 第 1 周目永远通过（初见只求建立直觉）；其余周目按门槛
            passed: c === 1 || passed,
          });
          trackEvent("cycle_completed", { node_id: node.id, cycle: c, passed: c === 1 || passed, first_try_ratio: ratio });
          markLearned(node.id);
          markDailyComplete(node.id);
        }
        completeNodeInUniverse(node.id);
        if (isStarNode && starPlanRef.current) {
          const parsed = parseStarId(node.id);
          if (parsed) {
            const st = starPlanRef.current.plan.stages[parsed.stageIndex];
            if (st) {
              const t = stageTasks(st)[parsed.taskIndex];
              if (t) {
                completeTask({
                  taskId: buildTaskId(parsed.stageIndex, parsed.taskIndex, t.title_plain),
                  titlePlain: t.title_plain,
                  titleProfessional: t.title_professional,
                  domain: starPlanRef.current.plan.domain,
                  nodeIds: [node.id],
                  source: "learn_page",
                });
              }
            }
          }
        }
        if (seg.gainName) {
          awardBadge({ name: seg.gainName, nodeId: node.id, nodeName: node.name });
        }
        addEcho({
          nodeId: node.id,
          nodeName: node.name,
          kind: "memory",
          prompt: `还记得「${node.name}」吗？用一句话说出它的核心。`,
        });
      } else if (seg.type === "seed") {
        sideEffectsRef.current.add(i);
        addEcho({ nodeId: node.id, nodeName: node.name, kind: "seed", prompt: seg.content });
      } else if (seg.type === "debt") {
        sideEffectsRef.current.add(i);
        addEcho({ nodeId: node.id, nodeName: node.name, kind: "debt", prompt: seg.content });
        if (!isStarNode) addDebt(node.id, seg.content.slice(0, 80));
      } else if (seg.type === "stick") {
        sideEffectsRef.current.add(i);
        if (!isStarNode) addStickingPoint(node.id, seg.content);
      } else if (seg.type === "layer_done") {
        sideEffectsRef.current.add(i);
        // C6: 层完成时持久化进度
        try {
          const { markLayerPassed, getSpecProgress, initSpecProgress } = require("@/lib/learn/spec-store");
          let progress = getSpecProgress(node.id);
          if (!progress) {
            progress = initSpecProgress(node.id);
          }
          const currentLayerIdx = progress.passedLayers?.length || 0;
          const cachedSpec = require("@/lib/learn/spec-store").getCachedSpec(node.id);
          if (cachedSpec && cachedSpec.layers[currentLayerIdx]) {
            markLayerPassed(node.id, cachedSpec.layers[currentLayerIdx].id);
          }
        } catch { /* spec-store not available */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCount, segments, node]);

  // 进度持久化：每次推进/作答/对话结束后保存（流式中不存，保证存的是完整文本）
  useEffect(() => {
    if (!node || !script || streaming || chatBusy) return;
    if (!exploreTextRef.current) return;
    saveExploreSession({
      nodeId: node.id,
      script,
      exploreText: exploreTextRef.current,
      closingText: closingTextRef.current,
      history: historyRef.current,
      chatThreads: chatThreads.map((t) => ({ q: t.q, text: t.text })),
      visibleCount,
      completedIdx: [...completedIdx],
      phase,
      updatedAt: Date.now(),
    });
  }, [node, script, streaming, chatBusy, visibleCount, completedIdx, phase, chatThreads, segments.length]);

  // 重新探索：清掉存档并整页重载（重新组剧本、换新钩子）
  const handleRestart = useCallback(() => {
    if (!node) return;
    clearExploreSession(node.id);
    window.location.reload();
  }, [node]);

  // 总结/造物主提交 → 收尾阶段
  const handleSubmitInput = useCallback(
    (text: string) => {
      quizStatsRef.current.summary = text.trim();
      setPhase("closing");
      streamPhase("closing", text);
    },
    [streamPhase]
  );

  // §3 缺口诊断：第 2 周目起，QUIZ 两次都错 → 回溯前置 → 插入 GAP 卡
  const handleQuizFail = useCallback(
    (quizIdx: number, wrongLabels: string[]) => {
      if (!node) return;
      quizStatsRef.current.wrong.push(...wrongLabels.map((l) => `Q${quizIdx}:${l}`));
      if (isStarNode || cycle < 2 || gapShownRef.current) return;
      const diag = diagnoseGap(node.id, cycle, graph, getMasteryMap(graph.nodes));
      if (diag.kind !== "gap") return;
      gapShownRef.current = true;
      const p = diag.primary;
      const gapSeg: Segment = {
        type: "gap",
        content: `这道题的坑，根源可能不在「${node.name}」本身。你在前置知识「${p.node.name}」上目前是第 ${p.currentLevel} 级，而第 ${cycle} 周目需要它至少到第 ${p.requiredLevel} 级。${
          diag.others.length ? `另外「${diag.others.map((o) => o.node.name).join("」「")}」也偏弱。` : ""
        }先回炉再回来，这颗星会好走很多。`,
        gapNodeId: p.node.id,
        gapNodeName: p.node.name,
        gapCycle: p.suggestedCycle,
      };
      trackEvent("gap_diagnosed", { node_id: node.id, cycle, gap_node: p.node.id, distance: p.distance });
      // 插在当前 quiz 卡后面；不进持久化文本，刷新后消失（诊断是一次性的）
      gapInsertRef.current = { afterIdx: quizIdx, seg: gapSeg };
      rebuildSegments();
    },
    [node, isStarNode, cycle, graph, rebuildSegments]
  );

  // 自由提问（探索途中，独立线程渲染）
  const handleChat = useCallback(async () => {
    const q = chatInput.trim();
    if (!q || chatBusy || streaming) return;
    setChatInput("");
    setChatBusy(true);
    setChatThreads((prev) => [...prev, { q, text: "", segs: [] }]);
    try {
      const accumulated = await callStream("chat", q, (acc) => {
        const segs = parseSegments(acc).segments;
        setChatThreads((prev) => {
          const next = [...prev];
          next[next.length - 1] = { q, text: acc, segs };
          return next;
        });
      });
      if (accumulated !== null) {
        historyRef.current.push({ role: "user", content: q });
        historyRef.current.push({ role: "ai", content: accumulated });
      }
    } catch {
      /* ignore */
    }
    setChatBusy(false);
  }, [chatInput, chatBusy, streaming, callStream]);


  // 当前可见段落与推进判定
  const shown = segments.slice(0, visibleCount);
  const lastShownIdx = Math.min(visibleCount, segments.length) - 1;
  const lastShown = lastShownIdx >= 0 ? segments[lastShownIdx] : null;
  const lastBlocked = lastShown && BLOCKING_TYPES.has(lastShown.type) && !completedIdx.has(lastShownIdx);
  const nextReady =
    visibleCount < segments.length && (visibleCount < segments.length - 1 || !streaming);
  const canAdvance = !lastBlocked && nextReady;
  const allShown = visibleCount >= segments.length && !streaming;
  const hasGain = segments.some((s) => s.type === "gain");
  const sessionDone = allShown && phase === "closing" && (hasGain || segments.length > 3);
  const waitingSummary = lastShown?.type === "ask_summary" || lastShown?.type === "create";

  // 安全网：流结束 + 所有段落已显示 + 仍在 explore → 自动进入 closing
  useEffect(() => {
    if (allShown && phase === "explore" && segments.length > 0 && !streaming) {
      const timer = setTimeout(() => {
        setPhase("closing");
        streamPhase("closing", "");
      }, 800);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allShown, phase, segments.length, streaming]);

  // 跳过计时器：BLOCKING 段落超过 15 秒未完成时显示跳过按钮
  const [skipVisible, setSkipVisible] = useState(false);
  useEffect(() => {
    if (lastBlocked && !streaming) {
      setSkipVisible(false);
      const timer = setTimeout(() => setSkipVisible(true), 15000);
      return () => clearTimeout(timer);
    }
    setSkipVisible(false);
  }, [lastBlocked, lastShownIdx, streaming]);

  // 猎人进度
  const huntTotal = script?.huntCount || 0;
  const huntFound = shown.filter((s) => s.type === "hunt").length;

  // 最近一张 flash 的内容（供 recall 对照）
  function flashContentBefore(idx: number): string | undefined {
    for (let i = idx - 1; i >= 0; i--) {
      if (segments[i].type === "flash") return segments[i].content;
    }
    return undefined;
  }

  const cognitionGains = node ? nodeDimGains(node).map((g) => ({
    name: g.dim.name,
    color: g.dim.color,
    gain: g.gain,
  })) : [];

  // 计划内下一个节点（学完后可直接跳转）
  // 优先读活跃小宇宙的学习链路；无小宇宙时回退到当前计划链路。
  // 节点查找覆盖 deep 节点（Tier 1/2）。
  const nextPlanNode = useMemo(() => {
    try {
      if (isStarNode) {
        const pid = urlPlanId || starPlanRef.current?.planId || getActivePlanId();
        if (!pid) return null;
        const stored = loadPlans().find((p) => p.id === pid);
        if (!stored) return null;
        const sm = buildPlanStarMap(stored.plan);
        const completed = getCompletedStarIds(stored.plan);
        const curIdx = sm.starIds.indexOf(nodeId);
        if (curIdx < 0) return null;
        for (let i = curIdx + 1; i < sm.starIds.length; i++) {
          if (!completed.has(sm.starIds[i])) {
            return sm.graph.nodes.find((n) => n.id === sm.starIds[i]) || null;
          }
        }
        return null;
      }

      const deep = getAllLoadedDeepNodes();
      const byId = new Map([...graph.nodes, ...deep.nodes].map((n) => [n.id, n]));
      const learned = getLearnedNodeIds(graph.nodes);

      // 1) 活跃计划对应的小宇宙内：按小宇宙节点顺序找下一个未完成节点
      const su = resolveUniverseForPlan(getActivePlanId());
      if (su && su.nodeIds.includes(nodeId)) {
        const currentIdx = su.nodeIds.indexOf(nodeId);
        const isDone = (id: string) => Boolean(su.completions[id]) || learned.has(id);
        for (let i = currentIdx + 1; i < su.nodeIds.length; i++) {
          if (!isDone(su.nodeIds[i])) {
            const n = byId.get(su.nodeIds[i]);
            if (n) return n;
          }
        }
        return null;
      }

      // 2) 兜底：当前计划链路（修复：原先误读 qc_plan_versions）
      const raw = loadSessionItem("qicheng_plan");
      if (!raw) return null;
      const plan = JSON.parse(raw) as GeneratedPlan;
      const route = getPlanRoute(plan, graph);
      const currentIdx = route.nodeIds.indexOf(nodeId);
      if (currentIdx < 0) return null;
      for (let i = currentIdx + 1; i < route.nodeIds.length; i++) {
        if (!learned.has(route.nodeIds[i])) {
          const n = byId.get(route.nodeIds[i]);
          if (n) return n;
        }
      }
      return null;
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, nodeId, sessionDone, isStarNode, urlPlanId]);

  // 从教学卡片一键摘录到笔记
  const handleExcerpt = useCallback((content: string) => {
    if (!node || !subject || !content.trim()) return;
    addNote({
      content: content.trim(),
      nodeId: node.id,
      nodeName: node.name,
      subjectName: subject.name,
      kind: "excerpt",
    });
    window.dispatchEvent(new Event("qc-notes-updated"));
    setPanelOpen(true);
    setSideTab("notes");
    setExcerptToast(true);
    setTimeout(() => setExcerptToast(false), 1800);
  }, [node, subject]);

  const sidePanelOpen = panelOpen;

  if (!node && !deepSearchDone) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[var(--bg-0)] text-[var(--text-3)] gap-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-1)] border-t-[var(--text-2)]" />
        <p className="text-[var(--font-sm)]">正在加载知识节点…</p>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[var(--bg-0)] text-[var(--text-3)] gap-4">
        <p className="text-[var(--font-sm)]">没有找到这颗星。</p>
        <button onClick={() => router.push("/universe")} className="rounded-[var(--radius-control)] border border-[var(--border-1)] px-4 py-2 text-[var(--font-sm)] text-[var(--text-2)] hover:bg-[var(--bg-2)] transition-colors">
          返回星图
        </button>
      </div>
    );
  }

  // ═══ Preview Phase: 链路预览过渡层 ═══
  if (showPreview) {
    const prereqEdges = graph.edges.filter((e) => e.type === "prerequisite" && e.target === nodeId);
    const nextEdges = graph.edges.filter((e) => e.type === "prerequisite" && e.source === nodeId);
    const learned = getLearnedNodeIds(graph.nodes);

    const prereqNodes = prereqEdges
      .map((e) => graph.nodes.find((n) => n.id === e.source))
      .filter((n): n is KnowledgeNode => !!n);
    const nextNodes = nextEdges
      .map((e) => graph.nodes.find((n) => n.id === e.target))
      .filter((n): n is KnowledgeNode => !!n);

    const allPrereqLearned = prereqNodes.every((n) => learned.has(n.id));

    return (
      <div className="relative h-screen overflow-hidden bg-[var(--bg-0)] flex flex-col md:pl-[var(--siderail-width)]">
        <MiniStarfield />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(76,29,149,0.18),transparent_60%),radial-gradient(ellipse_at_70%_80%,rgba(30,58,138,0.15),transparent_60%)]" />

        {/* 顶栏 */}
        <header className="relative z-10 flex items-center border-b border-[var(--border-1)] bg-[var(--bg-0)]/70 backdrop-blur-xl px-5 py-3">
          <button
            onClick={() => router.push(computedReturnPath)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--border-1)] bg-[var(--bg-2)] text-[var(--text-2)] hover:bg-[var(--bg-3)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="ml-3 font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase">链路预览</span>
        </header>

        {/* 预览内容 */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-xl animate-fade-in">
            {/* 当前节点 */}
            <div className="text-center mb-8">
              {subject && (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: subject.color }} />
                  <span className="font-mono text-[11px] text-white/40">{subject.name}</span>
                </div>
              )}
              <h1 className="text-2xl font-bold text-white/90">{node.name}</h1>
              {node.plain_name && node.plain_name !== node.name && (
                <p className="text-sm text-white/40 mt-1">{node.plain_name}</p>
              )}
              {node.description && (
                <p className="text-[13px] text-white/50 mt-3 max-w-md mx-auto leading-relaxed">{node.description}</p>
              )}
              {/* 多周目：本次周目 */}
              {!isStarNode && (
                <div className="mt-4 inline-flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((c) => {
                      const d = cycleDef(c);
                      const done = (memory?.level || 0) >= c;
                      const current = c === cycle;
                      return (
                        <span
                          key={c}
                          title={`第 ${c} 周目 · ${d.name} · ${d.goal}`}
                          className={`h-2 w-2 rounded-full transition-all ${current ? "scale-150 ring-2 ring-offset-1 ring-offset-black/40" : ""}`}
                          style={{
                            background: done || current ? d.visual.tint : "rgba(255,255,255,0.12)",
                            boxShadow: current ? `0 0 10px ${d.visual.tint}` : undefined,
                            ["--tw-ring-color" as string]: d.visual.tint,
                          }}
                        />
                      );
                    })}
                  </div>
                  <span
                    className="font-mono text-[10px] tracking-[0.15em] px-2.5 py-1 rounded border"
                    style={{ color: cycleInfo.visual.tint, borderColor: `${cycleInfo.visual.tint}40`, background: `${cycleInfo.visual.tint}14` }}
                  >
                    第 {cycle} 周目 · {cycleInfo.name}
                  </span>
                  <p className="text-[11px] text-white/45 max-w-sm">{cycleInfo.goal}</p>
                  <p className="text-[10px] text-white/30">你的向导：{cycleInfo.persona.role}</p>
                  {memory && memory.stickingPoints.length > 0 && (
                    <p className="mt-1 text-[11px] text-white/50 italic max-w-sm">📌 上次记下：{memory.stickingPoints[0]}</p>
                  )}
                </div>
              )}
              {isStarNode && learned.has(node.id) && (
                <span className="inline-block mt-3 font-mono text-[10px] text-emerald-300/70 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded">已学习 ✓</span>
              )}
            </div>

            {/* 前置节点 */}
            {prereqNodes.length > 0 && (
              <div className="mb-6">
                <p className="font-mono text-[10px] tracking-[0.15em] text-white/30 mb-2 text-center">前置知识</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {prereqNodes.map((pn) => {
                    const isLearned = learned.has(pn.id);
                    return (
                      <button
                        key={pn.id}
                        onClick={() => router.push(`${pathname}?node=${encodeURIComponent(pn.id)}${urlFrom ? `&from=${urlFrom}` : ""}`)}
                        className={`px-3 py-1.5 rounded border text-[12px] transition-all ${
                          isLearned
                            ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/70"
                            : "border-amber-400/20 bg-amber-400/[0.06] text-amber-200/70 hover:bg-amber-400/10"
                        }`}
                      >
                        {isLearned ? "✓ " : "○ "}{pn.name}
                      </button>
                    );
                  })}
                </div>
                {!allPrereqLearned && (
                  <p className="text-center text-[11px] text-amber-300/50 mt-2">
                    有前置知识未学习，建议先完成
                  </p>
                )}
              </div>
            )}

            {/* 连接线视觉 */}
            {(prereqNodes.length > 0 || nextNodes.length > 0) && (
              <div className="flex items-center justify-center gap-3 my-4 text-white/15">
                {prereqNodes.length > 0 && <span className="font-mono text-[10px]">{prereqNodes.length} 前置</span>}
                <span>→</span>
                <span className="font-mono text-[11px] text-cyan-300/60 font-medium">{node.name}</span>
                <span>→</span>
                {nextNodes.length > 0 && <span className="font-mono text-[10px]">{nextNodes.length} 后续</span>}
              </div>
            )}

            {/* 后续节点 */}
            {nextNodes.length > 0 && (
              <div className="mb-8">
                <p className="font-mono text-[10px] tracking-[0.15em] text-white/30 mb-2 text-center">学完后解锁</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {nextNodes.slice(0, 5).map((nn) => (
                    <span key={nn.id} className="px-3 py-1.5 rounded border border-white/10 bg-white/[0.02] text-[12px] text-white/40">
                      {nn.name}
                    </span>
                  ))}
                  {nextNodes.length > 5 && (
                    <span className="px-3 py-1.5 text-[12px] text-white/25">+{nextNodes.length - 5} 更多</span>
                  )}
                </div>
              </div>
            )}

            {/* 开始按钮 */}
            <div className="flex justify-center">
              <button
                onClick={() => setShowPreview(false)}
                className="border border-cyan-400/40 bg-cyan-400/10 px-8 py-3 font-mono text-sm tracking-widest text-cyan-200 hover:bg-cyan-400/20 hover:border-cyan-400/60 transition-all shadow-[0_0_20px_rgba(34,211,238,0.1)]"
              >
                {cycle === 1 ? "开始探索 →" : cycle === 2 ? "开始精读 →" : cycle === 3 ? "开始贯通 →" : "开始守护 →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[var(--bg-0)] flex">
      <PageGuide
        storageKey="qc_guide_learn"
        steps={[
          { title: "欢迎进入星核探索", description: "AI 会用一系列互动卡片引导你学习这个知识点。点击选项、填空、回忆——每一步都在强化你的理解。" },
          { title: "卡片推进", description: "完成当前卡片后，点击「继续探索」推进到下一张。有些卡片需要先回答问题才能继续。" },
          { title: "一键摘录", description: "鼠标悬停在讲解卡上，右上角会出现「摘录」按钮，一键将关键内容存入笔记。" },
          { title: "右侧面板", description: "右上角的按钮可以打开侧面板，查看本节点的知识脉络和下一步学习路线。" },
        ]}
      />
      {/* 主内容区：面板打开时自动收窄 */}
      <div className={`relative flex-1 min-w-0 flex flex-col h-screen overflow-hidden transition-all duration-300 ${sidePanelOpen ? "mr-0" : ""}`}>
      {/* 背景 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(76,29,149,0.18),transparent_60%),radial-gradient(ellipse_at_70%_80%,rgba(30,58,138,0.15),transparent_60%)]" />
      <MiniStarfield />

      {/* 顶栏 */}
      <header className="relative z-10 flex items-center justify-between border-b border-[var(--border-1)] bg-[var(--bg-0)]/70 backdrop-blur-xl px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(
              isStarNode
                ? `/plan/universe${urlPlanId ? `?planId=${urlPlanId}` : ""}`
                : computedReturnPath
            )}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-1)] bg-[var(--bg-2)] text-[var(--text-2)] hover:bg-[var(--bg-3)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {subject && (
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject.color }} />
              )}
              <h1 className="truncate text-[var(--font-base)] font-semibold text-[var(--text-1)]">{node.name}</h1>
              {!isStarNode && (
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] tracking-wider border"
                  style={{ color: cycleInfo.visual.tint, borderColor: `${cycleInfo.visual.tint}40`, background: `${cycleInfo.visual.tint}14` }}
                  title={cycleInfo.goal}
                >
                  {cycle}周目 · {cycleInfo.name}
                </span>
              )}
            </div>
            <p className="text-[var(--font-xs)] text-[var(--text-3)] truncate">{node.plain_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={manimVideoUrl ? () => setShowManimPanel(v => !v) : handleGenerateManim}
          disabled={manimLoading}
          title={manimVideoUrl ? "查看原理动画" : "AI 生成学术级原理动画（约 30-90 秒）"}
          className="rounded-[var(--radius-control)] border border-[var(--border-1)] bg-[var(--bg-2)] px-3 py-1.5 text-[var(--font-xs)] font-medium text-[var(--text-2)] hover:bg-[var(--bg-3)] transition-colors disabled:opacity-40"
        >
          {manimLoading ? "渲染中…" : manimVideoUrl ? "▶ 原理动画" : "生成原理动画"}
        </button>
        {segments.length > 0 && (
          <button
            onClick={handleRestart}
            title="清除本次探索记录，重新开始"
            className="rounded-[var(--radius-control)] border border-[var(--border-1)] px-3 py-1.5 text-[var(--font-xs)] text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)] transition-colors"
          >
            ↺ 重新探索
          </button>
        )}
        <ComboCounter combo={comboCount} />
        {huntTotal > 0 && (
          <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5">
            <span className="text-[var(--font-xs)] font-medium text-emerald-300">
              规律 {huntFound}/{huntTotal}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: huntTotal }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i < huntFound ? "bg-emerald-400" : "bg-[var(--bg-3)]"}`}
                />
              ))}
            </div>
          </div>
        )}
        </div>
      </header>

      {/* 先修关系软提示 */}
      {prereqWarning && prereqWarning.length > 0 && (
        <div className="relative z-20 mx-auto max-w-[680px] px-5 pt-4">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 backdrop-blur-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0">💡</span>
              <div className="flex-1">
                <p className="text-[12px] text-amber-200/80 mb-2">
                  建议先了解以下概念，会让「{node?.name}」更容易理解：
                </p>
                <div className="flex flex-wrap gap-2">
                  {prereqWarning.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => router.push(`${pathname}?node=${encodeURIComponent(p.id)}${urlFrom ? `&from=${urlFrom}` : ""}`)}
                      className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200 hover:bg-amber-500/20 transition-colors"
                    >
                      {p.name} →
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPrereqWarning(null)}
                  className="mt-2 text-[10px] text-white/30 hover:text-white/50 transition-colors"
                >
                  我了解，继续学习
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manim 视频面板 - 内嵌在卡片流顶部 */}

      {/* 答对反馈特效 */}
      {showComboFeedback && <CorrectFeedback combo={comboCount} />}

      {/* 卡片流 */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[680px] px-5 py-8 space-y-4 pb-44">

          {/* Manim 原理动画（内嵌卡片） — 不用 cyber-panel 的 clip-path，否则 video 控件不可点击 */}
          {showManimPanel && (
            <div className="relative rounded-[var(--radius-panel)] border border-[var(--border-1)] bg-[var(--bg-1)]/85 backdrop-blur-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[var(--font-sm)] font-medium text-[var(--text-1)]">原理动画</h3>
                <button
                  onClick={() => setShowManimPanel(false)}
                  className="rounded-[var(--radius-control)] p-1 text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)] transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {manimLoading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-7 w-7 rounded-full border-2 border-[var(--qc-accent)]/30 border-t-[var(--qc-accent)] animate-spin" />
                  <p className="text-[var(--font-sm)] text-[var(--text-3)]">AI 正在为你绘制原理动画…</p>
                  <p className="text-[var(--font-xs)] text-[var(--text-3)]/60">预计需要 30-90 秒，请耐心等待</p>
                </div>
              )}
              {manimError && (
                <div className="text-center py-4 space-y-2">
                  <p className="text-[var(--font-sm)] text-[var(--qc-danger)]">{manimError}</p>
                  <button
                    onClick={handleGenerateManim}
                    className="rounded-[var(--radius-control)] border border-[var(--border-1)] px-3 py-1.5 text-[var(--font-xs)] text-[var(--text-3)] hover:bg-[var(--bg-2)] transition-colors"
                  >
                    重试
                  </button>
                </div>
              )}
              {manimVideoUrl && !manimLoading && (
                <div className="space-y-2">
                  <video
                    src={manimVideoUrl}
                    controls
                    playsInline
                    className="relative z-10 w-full rounded-[var(--radius-panel)] bg-black"
                    style={{ maxHeight: "320px" }}
                  />
                  <button
                    onClick={() => { setManimVideoUrl(null); if (node) localStorage.removeItem(manimCacheKey(node.id)); handleGenerateManim(); }}
                    disabled={manimLoading}
                    className="rounded-[var(--radius-control)] border border-[var(--border-1)] px-3 py-1.5 text-[var(--font-xs)] text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)] transition-colors"
                  >
                    重新生成
                  </button>
                </div>
              )}
              {!manimVideoUrl && !manimLoading && !manimError && (
                <div className="flex flex-col items-center py-6 gap-2">
                  <p className="text-[var(--font-xs)] text-[var(--text-3)]">点击顶部按钮生成原理动画</p>
                </div>
              )}
            </div>
          )}
          {shown.map((seg, i) => {
            const key = `${seg.type}_${i}`;
            let card: React.ReactNode = null;
            switch (seg.type) {
              case "hook":
                card = <HookCard seg={seg} />;
                break;
              case "teach":
                card = <TeachCard seg={seg} />;
                break;
              case "predict":
                card = <PredictCard seg={seg} onComplete={() => markComplete(i)} initialCompleted={completedIdx.has(i)} />;
                break;
              case "flash":
                card = <FlashCard seg={seg} onComplete={() => markComplete(i)} initialSealed={completedIdx.has(i)} />;
                break;
              case "blank":
                card = <BlankCard seg={seg} onComplete={() => markComplete(i)} initialCompleted={completedIdx.has(i)} />;
                break;
              case "quiz":
                card = (
                  <QuizCard
                    seg={seg}
                    hintPolicy={cycleInfo.script.hintPolicy}
                    onComplete={(firstTry) => {
                      if (!completedIdx.has(i)) {
                        quizStatsRef.current.total += 1;
                        if (firstTry) quizStatsRef.current.firstTry += 1;
                      }
                      markComplete(i);
                    }}
                    onFail={(wrong) => handleQuizFail(i, wrong)}
                    initialCompleted={completedIdx.has(i)}
                  />
                );
                break;
              case "stick":
                card = <StickCard seg={seg} />;
                break;
              case "gap":
                card = (
                  <GapCard
                    seg={seg}
                    onGo={(gid) => {
                      const back = encodeURIComponent(`${pathname}?node=${encodeURIComponent(node.id)}${urlFrom ? `&from=${urlFrom}` : ""}`);
                      router.push(`${pathname}?node=${encodeURIComponent(gid)}&cycle=${seg.gapCycle || 1}&from=${back}`);
                    }}
                    onDismiss={() => setVisibleCount((v) => Math.min(v + 1, segments.length))}
                  />
                );
                break;
              case "hunt":
                card = <HuntCard seg={seg} />;
                break;
              case "recall":
                card = <RecallCard seg={seg} flashContent={flashContentBefore(i)} onComplete={() => markComplete(i)} />;
                break;
              case "ask_summary":
                card = (
                  <InputCard
                    seg={seg}
                    mode="summary"
                    initialSubmitted={completedIdx.has(i)}
                    onSubmit={(t) => {
                      markComplete(i);
                      handleSubmitInput(t);
                    }}
                    disabled={streaming}
                  />
                );
                break;
              case "create":
                card = (
                  <InputCard
                    seg={seg}
                    mode="create"
                    initialSubmitted={completedIdx.has(i)}
                    onSubmit={(t) => {
                      markComplete(i);
                      handleSubmitInput(t);
                    }}
                    disabled={streaming}
                  />
                );
                break;
              case "feedback":
                card = <FeedbackCard seg={seg} />;
                break;
              case "gain":
                card = <GainCard seg={seg} cognitionGains={cognitionGains} abilityPoints={getAbilityPoints()} />;
                break;
              case "giant":
                card = <GiantCard seg={seg} />;
                break;
              case "seed":
                card = <SeedCard seg={seg} />;
                break;
              case "debt":
                card = <DebtCard seg={seg} />;
                break;
              case "code":
                card = <CodeCard seg={seg} onComplete={() => markComplete(i)} />;
                break;
              case "derive":
                card = <DeriveCard seg={seg} onComplete={() => markComplete(i)} />;
                break;
              case "layer_done":
                card = <LayerDoneCard seg={seg} onComplete={() => markComplete(i)} />;
                break;
              default:
                card = null;
            }
            if (!card) return null;

            // 可摘录的讲解型卡片：悬停显示「摘录」按钮，一键存入笔记
            // flash 类型封存后（已 complete）不可再摘录——限时记忆的意义就在于逼迫你当下记住
            const isFlashSealed = seg.type === "flash" && completedIdx.has(i);
            const excerptable = ["hook", "teach", "flash", "hunt", "feedback", "giant", "seed", "debt", "stick"].includes(seg.type) && seg.content?.trim() && !isFlashSealed;
            return (
              <div key={key} className="group/card relative">
                {card}
                {excerptable && (
                  <button
                    onClick={() => handleExcerpt(seg.content)}
                    title="把这段内容摘录到笔记"
                    className="absolute -right-2 -top-2 z-10 flex items-center gap-1 rounded-full border border-amber-400/25 bg-[#13131d]/95 px-2 py-1 text-[10px] text-amber-300/90 opacity-0 shadow-lg backdrop-blur transition-opacity hover:bg-amber-500/15 group-hover/card:opacity-100"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    摘录
                  </button>
                )}
              </div>
            );
          })}

          {/* 答疑对话已移至右侧面板 */}

          {/* 加载/错误状态 */}
          {streaming && !canAdvance && (
            <div className="flex items-center gap-2.5 px-2 py-3 text-[var(--text-3)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--qc-accent)] animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--qc-accent)] animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--qc-accent)] animate-bounce [animation-delay:300ms]" />
              <span className="text-[var(--font-sm)]">{segments.length === 0 ? "引导者正在接近这颗星…" : "正在生成…"}</span>
            </div>
          )}
          {error && (
            <div className="rounded-[var(--radius-panel)] border border-[var(--qc-danger)]/30 bg-[var(--qc-danger)]/10 px-4 py-3 text-center">
              <p className="text-[var(--font-sm)] text-[var(--qc-danger)] mb-2">{error}</p>
              <button
                onClick={() => {
                  if (phase === "explore" && exploreTextRef.current === "") streamPhase("explore", "");
                }}
                className="rounded-[var(--radius-control)] border border-[var(--qc-danger)]/30 px-3 py-1.5 text-[var(--font-xs)] text-[var(--qc-danger)] hover:bg-[var(--qc-danger)]/15"
              >
                重试
              </button>
            </div>
          )}

          {/* 推进按钮 */}
          {canAdvance && !sessionDone && (
            <button
              onClick={() => setVisibleCount((v) => v + 1)}
              className="group mx-auto block rounded-[var(--radius-control)] bg-[var(--qc-accent)] px-7 py-2.5 text-[var(--font-sm)] font-medium text-white hover:bg-[var(--qc-accent-hover)] transition-all animate-breathe"
            >
              继续探索 <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          )}
          {lastBlocked && !streaming && (
            <div className="text-center space-y-2">
              <p className="text-[var(--font-xs)] text-[var(--text-3)]">
                {waitingSummary ? "在上方输入你的想法，或跳过继续 ↑" : "完成上面的挑战才能继续 ↑"}
              </p>
              {(skipVisible || waitingSummary) && (
                <button
                  onClick={() => {
                    markComplete(lastShownIdx, false);
                    if (waitingSummary) handleSubmitInput("");
                  }}
                  className="rounded-[var(--radius-control)] border border-[var(--border-1)] px-3 py-1.5 text-[var(--font-xs)] text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)] transition-all"
                >
                  跳过继续 →
                </button>
              )}
            </div>
          )}

          {/* 会话完成 */}
          {sessionDone && (
            <div className="animate-slide-up text-center pt-2 space-y-4">
              {!isStarNode && cycle < 4 && (
                <div
                  className="mx-auto max-w-md rounded-[var(--radius-panel)] border px-5 py-4 text-left"
                  style={{ borderColor: `${cycleDef(cycle + 1).visual.tint}40`, background: `${cycleDef(cycle + 1).visual.tint}0f` }}
                >
                  <p className="font-mono text-[10px] tracking-[0.15em] text-white/40">第 {cycle} 周目完成</p>
                  <p className="mt-1 text-[13px] text-white/80">
                    下一周目「{cycleDef(cycle + 1).name}」：{cycleDef(cycle + 1).goal}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">建议隔一天再来——间隔本身就是记忆的一部分。</p>
                  <button
                    onClick={() => {
                      clearExploreSession(node.id);
                      router.push(`${pathname}?node=${encodeURIComponent(node.id)}&cycle=${cycle + 1}${urlFrom ? `&from=${urlFrom}` : ""}`);
                      setTimeout(() => window.location.reload(), 50);
                    }}
                    className="mt-3 rounded-[var(--radius-control)] border px-4 py-2 font-mono text-xs tracking-widest transition-all hover:brightness-125"
                    style={{ color: cycleDef(cycle + 1).visual.tint, borderColor: `${cycleDef(cycle + 1).visual.tint}60`, background: `${cycleDef(cycle + 1).visual.tint}1a` }}
                  >
                    现在就开始第 {cycle + 1} 周目 →
                  </button>
                </div>
              )}
              {nextPlanNode && (
                <button
                  onClick={() => router.push(
                    isStarNode
                      ? `/universe/learn?node=${nextPlanNode.id}&planId=${urlPlanId || starPlanRef.current?.planId || ""}`
                      : `${pathname}?node=${nextPlanNode.id}${urlFrom ? `&from=${urlFrom}` : ""}`
                  )}
                  className="rounded-[var(--radius-control)] bg-[var(--qc-accent)] px-8 py-3 text-[var(--font-sm)] font-medium text-white hover:bg-[var(--qc-accent-hover)] transition-all"
                >
                  继续下一个：{nextPlanNode.name} →
                </button>
              )}
              <button
                onClick={() => router.push(
                  isStarNode
                    ? `/plan/universe${urlPlanId ? `?planId=${urlPlanId}` : ""}`
                    : computedReturnPath
                )}
                className={`rounded-[var(--radius-control)] px-8 py-3 text-[var(--font-sm)] font-medium text-[var(--text-1)] transition-all ${nextPlanNode ? "border border-[var(--border-1)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)]" : "bg-[var(--qc-accent)] text-white hover:bg-[var(--qc-accent-hover)]"}`}
              >
                {isStarNode ? "返回计划小宇宙" : "返回星图，看这颗星亮起"}
              </button>
              <p className="text-[var(--font-xs)] text-[var(--text-3)]">
                {isStarNode ? "完成记录已同步到你的计划小宇宙" : "回响系统已记下今天的探索，它们会在合适的时刻回来"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 面板收起时的贴边展开按钮 */}
      {!panelOpen && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col">
          <button
            onClick={() => { setSideTab("notes"); setPanelOpen(true); }}
            className="group flex items-center gap-1 rounded-l-[var(--radius-control)] border border-r-0 border-[var(--border-1)] bg-[var(--bg-1)]/80 backdrop-blur px-2 py-3 text-[var(--text-3)] hover:bg-amber-500/10 hover:text-amber-300 transition-all"
            title="打开笔记"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => { setSideTab("qa"); setPanelOpen(true); }}
            className="group flex items-center gap-1 rounded-l-[var(--radius-control)] border border-r-0 border-[var(--border-1)] bg-[var(--bg-1)]/80 backdrop-blur px-2 py-3 text-[var(--text-3)] hover:bg-[var(--qc-accent-muted)] hover:text-[var(--qc-accent)] transition-all mt-1"
            title="打开 AI 答疑"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </button>
        </div>
      )}

      {/* 摘录成功提示 */}
      {excerptToast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center">
          <div className="rounded-full border border-[var(--border-1)] bg-[var(--bg-2)] px-4 py-2 text-[var(--font-xs)] text-[var(--text-1)] backdrop-blur-xl shadow-[var(--shadow-float)] animate-slide-up">
            ✓ 已摘录到笔记
          </div>
        </div>
      )}
      </div>{/* 关闭主内容区 */}

      {/* 右侧常驻工具面板：Tab 切换 笔记 / AI 答疑（窄屏变为抽屉浮层） */}
      {panelOpen && node && subject && (
        <ResizableDivider direction="horizontal" storageKey="qc_learn_right_w" defaultSize={380} minSize={280} maxSize={500} side="right" onResize={learnRightPanel.onResize} />
      )}
      {panelOpen && node && subject && (
        <aside className="shrink-0 h-screen flex flex-col border-l border-[var(--border-1)] bg-[var(--bg-1)]/95 backdrop-blur-xl shadow-[var(--shadow-float)] max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:w-[min(380px,90vw)]" style={{ width: learnRightPanel.size }}>
          {/* Tab 栏 */}
          <div className="flex items-center gap-1 border-b border-[var(--border-1)] px-3 py-2">
            <button
              onClick={() => setSideTab("notes")}
              className={`flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-1.5 text-[var(--font-xs)] font-medium transition-all ${
                sideTab === "notes"
                  ? "bg-amber-500/15 text-amber-200"
                  : "text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)]"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              笔记
            </button>
            <button
              onClick={() => setSideTab("qa")}
              className={`flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-1.5 text-[var(--font-xs)] font-medium transition-all ${
                sideTab === "qa"
                  ? "bg-[var(--qc-accent-muted)] text-[var(--qc-accent)]"
                  : "text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)]"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              AI 答疑
              {chatThreads.length > 0 && (
                <span className="rounded-full bg-[var(--qc-accent-muted)] px-1.5 text-[9px] text-[var(--qc-accent)]">{chatThreads.length}</span>
              )}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setPanelOpen(false)}
              title="收起面板"
              className="rounded-[var(--radius-control)] p-1.5 text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 笔记 Tab */}
          {sideTab === "notes" && (
            <MessageNotePanel subjectName={subject.name} nodeName={node.name} nodeId={node.id} />
          )}

          {/* AI 答疑 Tab */}
          {sideTab === "qa" && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {chatThreads.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                    <div className="text-2xl opacity-30">💬</div>
                    <p className="text-[var(--font-sm)] text-[var(--text-3)]">探索途中有疑问？</p>
                    <p className="text-[var(--font-xs)] text-[var(--text-3)]/60">在下方输入你的问题，不会打断学习流程</p>
                  </div>
                )}
                {chatThreads.map((thread, ti) => (
                  <div key={`qa_${ti}`} className="space-y-3">
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-[var(--radius-panel)] bg-[var(--qc-accent-muted)] border border-[var(--qc-accent)]/15 px-3.5 py-2 text-[var(--font-sm)] text-[var(--text-1)]">
                        {thread.q}
                      </div>
                    </div>
                    {thread.segs.map((seg, si) => (
                      <div key={`qa_${ti}_${si}`} className="rounded-[var(--radius-panel)] border border-[var(--border-1)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[var(--font-sm)] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">
                        {seg.content}
                      </div>
                    ))}
                    {chatBusy && ti === chatThreads.length - 1 && thread.segs.length === 0 && (
                      <div className="flex items-center gap-2 px-1 text-[var(--text-3)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--qc-accent)] animate-bounce" />
                        <span className="text-[var(--font-xs)]">思考中…</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-[var(--border-1)] px-3 py-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleChat();
                  }}
                  className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-1)] bg-[var(--bg-3)] p-1.5 focus-within:border-[var(--qc-accent)]/40 transition-colors"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="输入你的疑问…"
                    disabled={chatBusy || streaming}
                    className="flex-1 bg-transparent px-2.5 py-1.5 text-[var(--font-sm)] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={chatBusy || streaming || !chatInput.trim()}
                    className="rounded-[var(--radius-control)] bg-[var(--qc-accent)] px-3 py-1.5 text-[var(--font-xs)] font-medium text-white hover:bg-[var(--qc-accent-hover)] transition-colors disabled:opacity-30"
                  >
                    发送
                  </button>
                </form>
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
