"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatBubbleGroup } from "@/components/onboarding/ChatBubble";
import { MoodCheckin } from "@/components/mood/MoodCheckin";
import { SoftUpgrade } from "@/components/SoftUpgrade";
import { trackEvent } from "@/lib/profile/events";
import { recordDailyCompletion } from "@/lib/habit/streak";
import { loadGraph, getLearnedNodeIds, markLearned, getStoredPlanScope } from "@/lib/universe/store";
import { getTaskNodeIds } from "@/lib/universe/plan-link";
import type { PlanTask, TaskBreakdown } from "@/lib/plan/types";
import { saveSessionItem, loadSessionItem } from "@/lib/plan/store";
import { taskChatKey, loadTaskChat, saveTaskChat } from "@/lib/storage/session-store";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { TaskFlowMap } from "@/components/learn/TaskFlowMap";
import { AnchorHUD } from "@/components/learn/AnchorHUD";
import { DeriveCard } from "@/components/learn/DeriveCard";
import {
  initialFlowState,
  resolvePhase,
  type AnchorCard,
  type DeriveLine,
  type DeriveSequence,
  type TaskFlowPhase,
  type TaskFlowState,
} from "@/lib/learn/depth-types";
import { getAnchorCard, saveAnchorCard } from "@/lib/learn/anchor-store";

type ChatMessage = { role: "ai" | "user"; content: string };

/** 读 SSE 流并累计文本 */
async function readStream(res: Response): Promise<string> {
  if (!res.ok || !res.body) return "";
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
        if (event.type === "text") accumulated += event.content;
      } catch { /* ignore */ }
    }
  }
  return accumulated;
}

/** 从 AI 输出中提取 JSON（容错：格式跑偏时返回 null） */
function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

/** 深潜序列校验与清洗：check 不合法则降级为无检查的普通行 */
function sanitizeDive(raw: unknown): DeriveSequence | null {
  if (!raw || typeof raw !== "object") return null;
  const seq = raw as DeriveSequence;
  if (!Array.isArray(seq.lines) || seq.lines.length === 0) return null;
  const kind = seq.kind === "code" || seq.kind === "derivation" ? seq.kind : "logic";
  const lines: DeriveLine[] = seq.lines
    .filter((l) => l && typeof l.content === "string" && l.content.trim())
    .map((l) => {
      const line: DeriveLine = {
        content: String(l.content),
        explain: typeof l.explain === "string" ? l.explain : "",
        rule: typeof l.rule === "string" && l.rule.trim() ? l.rule : undefined,
      };
      const c = l.check;
      if (
        c &&
        typeof c.question === "string" &&
        Array.isArray(c.options) &&
        c.options.length >= 2 &&
        typeof c.answer === "number" &&
        c.answer >= 0 &&
        c.answer < c.options.length
      ) {
        line.check = {
          kind: c.kind === "predict" || c.kind === "blank" || c.kind === "counterfactual" ? c.kind : "predict",
          question: c.question,
          options: c.options.map(String),
          answer: c.answer,
          hint: typeof c.hint === "string" ? c.hint : "再想想哪一步的假设可能不成立。",
          why: typeof c.why === "string" ? c.why : "",
        };
      }
      return line;
    });
  if (lines.length === 0) return null;
  return {
    title: typeof seq.title === "string" ? seq.title : "逐行深潜",
    intro: typeof seq.intro === "string" ? seq.intro : "",
    kind,
    lines,
  };
}

export default function TaskDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#050510] text-white/40">加载中...</div>}>
      <TaskDetailContent />
    </Suspense>
  );
}

function TaskDetailContent() {
  const router = useRouter();

  const [task, setTask] = useState<PlanTask | null>(null);
  const [planContext, setPlanContext] = useState<{ title: string; domain: string; stageName: string; weekTheme?: string } | null>(null);
  const [breakdown, setBreakdown] = useState<TaskBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [completed, setCompleted] = useState(false);
  const [nextTask, setNextTask] = useState<PlanTask | null>(null);
  const [searchingResource, setSearchingResource] = useState(false);
  const [resourceResults, setResourceResults] = useState<{ title: string; url: string; reason: string }[]>([]);
  const [universeToast, setUniverseToast] = useState<string | null>(null);

  // ── 深化系统状态 ──
  const [flow, setFlow] = useState<TaskFlowState>(initialFlowState());
  const [anchor, setAnchor] = useState<AnchorCard | null>(null);
  const [anchorLoading, setAnchorLoading] = useState(false);
  const [dives, setDives] = useState<Record<number, DeriveSequence>>({});
  const [activeDive, setActiveDive] = useState<number | null>(null);
  const [diveLoadingOrder, setDiveLoadingOrder] = useState<number | null>(null);
  const [showFlowMap, setShowFlowMap] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // 任务锚定的知识宇宙节点（星核探索入口）
  const anchoredNodeId = useMemo(() => {
    if (!task) return null;
    try {
      const graph = loadGraph();
      const ids = getTaskNodeIds(task, graph.nodes, getStoredPlanScope());
      return ids.length > 0 ? ids[0] : null;
    } catch {
      return null;
    }
  }, [task]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const taskStr = loadSessionItem("qicheng_current_task");
    const contextStr = loadSessionItem("qicheng_task_context");

    if (!taskStr || !contextStr) {
      router.replace("/plan/detail");
      return;
    }

    const t = JSON.parse(taskStr) as PlanTask;
    const c = JSON.parse(contextStr);
    setTask(t);
    setPlanContext(c);

    try {
      const planStr = loadSessionItem("qicheng_plan");
      if (planStr) {
        const plan = JSON.parse(planStr);
        const allTasks: PlanTask[] = [];
        for (const stage of plan.stages) {
          if (stage.weeks) {
            for (const week of stage.weeks) {
              for (const day of week.days) {
                for (const tk of day.tasks) allTasks.push(tk);
              }
            }
          } else if (stage.tasks) {
            for (const tk of stage.tasks) allTasks.push(tk);
          }
        }
        const idx = allTasks.findIndex(
          (x) => x.title_plain === t.title_plain && x.title_professional === t.title_professional
        );
        if (idx >= 0 && idx < allTasks.length - 1) {
          setNextTask(allTasks[idx + 1]);
        }
      }
    } catch { /* ignore */ }

    // 恢复深化系统状态：锚点卡 + 流程 + 深潜缓存
    const savedAnchor = getAnchorCard(taskChatKey(t));
    if (savedAnchor) setAnchor(savedAnchor);

    // 恢复该任务此前的拆解与对话记录，有拆解就不再重复请求
    const saved = loadTaskChat(taskChatKey(t));
    let restoredFlow: TaskFlowState | null = null;
    if (saved) {
      if (Array.isArray(saved.messages) && saved.messages.length > 0) {
        setMessages(saved.messages as ChatMessage[]);
      }
      if (saved.flow && typeof saved.flow === "object") {
        restoredFlow = { ...initialFlowState(), ...(saved.flow as TaskFlowState) };
        if (savedAnchor) restoredFlow.anchorDone = true;
        setFlow(restoredFlow);
      }
      if (saved.dives && typeof saved.dives === "object") {
        const restored: Record<number, DeriveSequence> = {};
        for (const [k, v] of Object.entries(saved.dives)) {
          const seq = sanitizeDive(v);
          if (seq) restored[Number(k)] = seq;
        }
        setDives(restored);
      }
    }
    if (!restoredFlow && savedAnchor) {
      setFlow((prev) => ({ ...prev, anchorDone: true }));
    }
    // 第一屏：任务未完成时先展示流程全景
    setShowFlowMap(true);

    // 锚点缺失则提取（不阻塞拆解）
    if (!savedAnchor) fetchAnchor(t, c);

    if (saved?.breakdown) {
      setBreakdown(saved.breakdown as TaskBreakdown);
      setBreakdownLoading(false);
      setFlow((prev) => ({ ...prev, breakdownDone: true }));
      return;
    }
    fetchBreakdown(t, c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // 拆解/对话/流程/深潜持久化（流式进行中不存）
  useEffect(() => {
    if (!task || chatLoading || breakdownLoading) return;
    if (!breakdown && messages.length === 0 && !anchor) return;
    saveTaskChat({
      taskKey: taskChatKey(task),
      breakdown,
      messages,
      flow,
      dives,
    });
  }, [task, breakdown, messages, chatLoading, breakdownLoading, flow, dives, anchor]);

  // 流程环节自动推导（用于流程图高亮与恢复定位）
  useEffect(() => {
    setFlow((prev) => {
      const phase = resolvePhase(prev, completed);
      return prev.phase === phase ? prev : { ...prev, phase };
    });
  }, [completed, anchor, breakdown, dives, flow.anchorDone, flow.breakdownDone, flow.challengeDone, flow.artifactDone]);

  /** 提取锚点卡（严格 JSON，失败自动重试一次） */
  const fetchAnchor = useCallback(async (t: PlanTask, ctx: { title: string; domain: string; stageName: string }) => {
    setAnchorLoading(true);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("/api/task-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: t, planContext: ctx, history: [], userMessage: "", mode: "anchor" }),
        });
        const text = await readStream(res);
        const parsed = extractJson<{ essence: string; when: string; core: string; invariant: string }>(text);
        if (parsed?.essence && parsed?.when && parsed?.core && parsed?.invariant) {
          const card: AnchorCard = { ...parsed, createdAt: Date.now() };
          saveAnchorCard(taskChatKey(t), card);
          setAnchor(card);
          setFlow((prev) => ({ ...prev, anchorDone: true }));
          break;
        }
      } catch { /* ignore, retry */ }
    }
    setAnchorLoading(false);
  }, []);

  /** 为某一步生成逐行深潜序列（缓存，失败自动重试一次） */
  const fetchDive = useCallback(
    async (step: { order: number; title: string; description: string }) => {
      if (!task || !planContext) return;
      if (dives[step.order]) {
        setActiveDive(step.order);
        return;
      }
      setDiveLoadingOrder(step.order);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch("/api/task-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task,
              planContext,
              history: [],
              userMessage: "",
              mode: "deepdive",
              step,
            }),
          });
          const text = await readStream(res);
          const seq = sanitizeDive(extractJson(text));
          if (seq) {
            setDives((prev) => ({ ...prev, [step.order]: seq }));
            setFlow((prev) => ({
              ...prev,
              diveStates: {
                ...prev.diveStates,
                [step.order]: prev.diveStates[step.order] ?? {
                  current: 0,
                  total: seq.lines.length,
                  stuckCount: 0,
                  done: false,
                },
              },
            }));
            setActiveDive(step.order);
            break;
          }
        } catch { /* ignore, retry */ }
      }
      setDiveLoadingOrder(null);
    },
    [task, planContext, dives]
  );

  /** 深潜中「没懂」→ 就这一行请求 AI 展开（独立请求，不进聊天记录） */
  const expandDiveLine = useCallback(
    async (line: DeriveLine, lineIndex: number): Promise<string | null> => {
      if (!task || !planContext) return null;
      try {
        const res = await fetch("/api/task-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task,
            planContext,
            history: [],
            userMessage: `我正在逐行深潜，卡在第 ${lineIndex + 1} 行没看懂。请**只针对这一行**，把它拆得更细来解释（可以拆成 2-3 个更小的步骤），用类比和画面感，不超过 150 字，纯文本不要用标题：\n\n这一行的内容：${line.content}\n原本的解释：${line.explain}`,
            mode: "chat",
          }),
        });
        const text = await readStream(res);
        return text || null;
      } catch {
        return null;
      }
    },
    [task, planContext]
  );

  const fetchBreakdown = useCallback(async (t: PlanTask, ctx: { title: string; domain: string; stageName: string }) => {
    setBreakdownLoading(true);
    try {
      const res = await fetch("/api/task-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: t,
          planContext: ctx,
          history: [],
          userMessage: "",
          mode: "breakdown",
        }),
      });

      const accumulated = await readStream(res);
      const parsed = extractJson<TaskBreakdown>(accumulated);
      if (parsed) {
        setBreakdown(parsed);
        setFlow((prev) => ({ ...prev, breakdownDone: true }));
      }
    } catch { /* ignore */ }
    setBreakdownLoading(false);
  }, []);

  async function searchResource() {
    if (!task) return;
    setSearchingResource(true);
    setResourceResults([]);
    try {
      const res = await fetch("/api/search-resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `${task.title_professional} 教程`,
          taskContext: `${task.title_plain}（${task.title_professional}）`,
        }),
      });
      const data = await res.json();
      if (data.success && data.recommendations?.length > 0) {
        setResourceResults(data.recommendations);
      } else {
        setResourceResults([{ title: "未找到结果", url: "", reason: `尝试在 B站搜索「${task.title_professional}」` }]);
      }
    } catch {
      setResourceResults([{ title: "搜索失败", url: "", reason: "网络问题，请稍后重试" }]);
    }
    setSearchingResource(false);
  }

  async function sendChat(customMsg?: string) {
    const msg = customMsg || input.trim();
    if (!msg || chatLoading || !task || !planContext) return;
    // Track help request once per task (on first message)
    if (messages.length === 0) {
      trackEvent("task_help_requested", { title_plain: task.title_plain });
    }
    setInput("");
    setChatLoading(true);
    setStreamingText("");

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/task-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          planContext,
          history: newMessages,
          userMessage: msg,
          mode: "chat",
        }),
      });

      if (!res.ok || !res.body) {
        setMessages([...newMessages, { role: "ai", content: "出了点问题，请重试。" }]);
        setChatLoading(false);
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
              setStreamingText(accumulated);
            }
          } catch { /* ignore */ }
        }
      }

      setStreamingText("");
      setMessages([...newMessages, { role: "ai", content: accumulated }]);
    } catch {
      setStreamingText("");
      setMessages([...newMessages, { role: "ai", content: "网络问题，请重试。" }]);
    }

    setChatLoading(false);
  }

  function handleStepClick(step: { order: number; title: string; description: string }) {
    if (chatLoading || !task) return;
    const prompt = `请用"探索式"的方式带我搞懂「${step.title}」这一步。**不要写成试卷或教科书**，按下面的节奏来（使用 Markdown）：

## 开场（真相钩子）

不要说"我们来学习X"。用这一步知识能解释的一个**反直觉现象或切身问题**开场（一两句话），让我产生"我必须搞懂"的冲动。

## 先猜一猜 🔮

在讲解之前，先抛 1 个预测问题让我猜（给 2-3 个看起来都合理的选项）。然后写一行：
> 心里选好了再往下看——

接着揭晓答案并顺势讲解。

## 探索讲解

- 分成 2-3 个**短段落**，每段不超过 5 行，段与段之间用 --- 分隔，每段结尾留一个小悬念
- 用画面感和类比讲，禁止堆术语；术语第一次出现必须用人话翻译
- 每揭示一个关键规律，单独标一行：**🎯 规律捕获：xxx（一句话）**
- 如果需要实操（装环境/敲命令/写代码），给出具体步骤和 \`命令\`，标注最容易踩的坑

## 挑战时刻 ⚔️

出 2 道挑战题（不叫"练习题"）：
- 每道题先写一句对抗文案，如"**约 75% 的初学者会在这里栽跟头**"（数字要合理）
- 选项里要埋一个最常见的错误想法
- 答案和解析放在引用块里，并提醒我"先自己选，再展开看"
- 解析重点讲"**为什么错的那个选项那么诱人**"

## 收尾（你刚获得什么）

不要总结知识点清单。用一两句话告诉我：完成这一步后我**获得了什么思维/能力**（比如"你现在拥有了 X 视角，以后看到 Y 你会下意识想到 Z"），以及一个值得带着睡觉的小问题。

## 🎬 B站推荐搜索

给 2 个精准搜索关键词：搜索：「关键词」（理由）

---

背景信息：这是「${task.title_plain}」任务的第 ${step.order} 步。
步骤描述：${step.description}
所属阶段：${planContext?.stageName || ""}`;

    sendChat(prompt);
  }

  /** 挑战验证：围绕锚点出题 */
  function startChallenge() {
    if (chatLoading || !task) return;
    const anchorPart = anchor
      ? `\n\n这个知识的锚点（出题必须围绕它）：\n- 本质：${anchor.essence}\n- 用时核心：${anchor.core}\n- 不可脱离：${anchor.invariant}`
      : "";
    const prompt = `我已经学完了「${task.title_plain}」（${task.title_professional}），现在进入挑战验证环节。请出 3 道阶梯递进的挑战题（用 Markdown）：

- 第 1 题基础应用，第 2 题变式，第 3 题必须考「不可脱离的底线」——设计一个**违反了锚点不变量**的场景让我识别哪里错了
- 每题带对抗文案（如"约 70% 的人栽在这"，数字合理）
- 选项里埋最诱人的错误想法
- 答案解析放引用块，提醒我先选再看，解析讲"为什么错的选项那么诱人"${anchorPart}`;
    setShowFlowMap(false);
    setFlow((prev) => ({ ...prev, challengeDone: true }));
    sendChat(prompt);
  }

  /** 产出成果：定义交付物 + 验收方式 */
  function startArtifact() {
    if (chatLoading || !task) return;
    const prompt = `任务「${task.title_plain}」（${task.title_professional}）接近完成，现在进入产出环节。请：

1. 给我定义一个 15-30 分钟能完成的**最小产出物**（编程=一段能跑的代码；数学=一道完整推导；其他=一段能讲给别人听的输出），要具体到"做什么、做成什么样算合格"
2. 告诉我做完后**把产出粘贴到这个聊天框**，你会帮我验收：指出做对了什么、哪里还有缺口
3. 语气像师傅布置出师作品，不要客套`;
    setShowFlowMap(false);
    setFlow((prev) => ({ ...prev, artifactDone: true }));
    sendChat(prompt);
  }

  /** 流程图环节点击 */
  function handlePhaseClick(phase: TaskFlowPhase) {
    if (phase === "anchor") {
      setShowFlowMap(false);
      if (!anchor && !anchorLoading && task && planContext) fetchAnchor(task, planContext);
      return;
    }
    if (phase === "breakdown" || phase === "deepdive") {
      // 拆解/深潜都在右侧步骤面板操作
      setShowFlowMap(false);
      return;
    }
    if (phase === "challenge") { startChallenge(); return; }
    if (phase === "artifact") { startArtifact(); return; }
    setShowFlowMap(false);
  }

  const diveSummary = (() => {
    const states = Object.values(flow.diveStates);
    if (states.length === 0) return undefined;
    const doneCount = states.filter((d) => d.done).length;
    const active = activeDive !== null ? flow.diveStates[activeDive] : null;
    const linePart = active && !active.done ? ` · ${active.current}/${active.total} 行` : "";
    return `${doneCount}/${states.length} 步完成${linePart}`;
  })();

  if (!task) return null;

  const DIFFICULTY_LABELS: Record<number, string> = { 1: "轻松", 2: "简单", 3: "适中", 4: "挑战", 5: "硬核" };
  const DIFFICULTY_COLORS: Record<number, string> = {
    1: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20",
    2: "bg-sky-500/15 text-sky-300 border border-sky-400/20",
    3: "bg-amber-500/15 text-amber-300 border border-amber-400/20",
    4: "bg-orange-500/15 text-orange-300 border border-orange-400/20",
    5: "bg-red-500/15 text-red-300 border border-red-400/20",
  };

  return (
    <div className="flex h-screen bg-[#050510]">
      <CosmicBackground />
      <CyberOverlay />
      {/* Left: AI Chat - main area */}
      <div className="relative z-10 flex flex-1 flex-col">
        {/* Header */}
        <div className="relative border-b border-cyan-400/[0.12] px-6 py-4 backdrop-blur-sm bg-[#0a0a14]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="w-7 h-7 border border-cyan-400/20 bg-cyan-400/[0.06] flex items-center justify-center text-cyan-300/60 hover:bg-cyan-400/15 hover:text-cyan-200 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="cyber-glitch text-base font-semibold text-white/90" data-text={task.title_plain}>{task.title_plain}</h1>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/40">daily_ops // mission_log</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[11px] tracking-wider text-cyan-200/50">{task.title_professional}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 font-mono font-medium tracking-wider ${DIFFICULTY_COLORS[task.difficulty] || DIFFICULTY_COLORS[3]}`}>
                    {DIFFICULTY_LABELS[task.difficulty] || "适中"}
                  </span>
                  <span className="font-mono text-[10px] text-fuchsia-300/40">~{task.estimated_minutes}min</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
            {anchoredNodeId && (
              <button
                onClick={() => router.push(`/universe/learn?node=${encodeURIComponent(anchoredNodeId)}`)}
                className="border border-indigo-400/40 bg-indigo-400/10 px-3.5 py-2 font-mono text-xs tracking-widest text-indigo-300 hover:bg-indigo-400/20 transition-colors"
                title="进入沉浸式 AI 引导探索，学透这个任务背后的知识节点"
              >
                ✦ 星核探索
              </button>
            )}
            {/* Complete button in header */}
            {!completed ? (
              <button
                onClick={() => {
                  const graph = loadGraph();
                  const beforeLearned = getLearnedNodeIds(graph.nodes);
                  setCompleted(true);
                  recordDailyCompletion();
                  // 直接点亮任务锚定的知识宇宙节点
                  const nodeIds = getTaskNodeIds(task, graph.nodes, getStoredPlanScope());
                  for (const id of nodeIds) markLearned(id);
                  trackEvent("task_completed", {
                    title_plain: task?.title_plain,
                    title_professional: task?.title_professional,
                    difficulty: task?.difficulty,
                    node_ids: nodeIds,
                  });
                  setTimeout(() => {
                    const afterLearned = getLearnedNodeIds(graph.nodes);
                    const newNodes = [...afterLearned].filter((id) => !beforeLearned.has(id));
                    if (newNodes.length > 0) {
                      const names = newNodes.map((id) => graph.nodes.find((n) => n.id === id)?.name).filter(Boolean);
                      setUniverseToast(names.length > 0 ? names.join("、") : null);
                      setTimeout(() => setUniverseToast(null), 6000);
                    }
                  }, 300);
                }}
                className="border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-xs tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-colors"
              >
                ✓ 完成任务
              </button>
            ) : (
              <span className="text-xs text-emerald-300 font-mono font-medium tracking-widest bg-emerald-500/15 border border-emerald-400/20 px-3 py-1.5">已完成 ✓</span>
            )}
            </div>
          </div>

          {/* 迷你流程轨：全程知道自己在任务的哪个环节 */}
          <div className="mt-2.5 flex items-center gap-3">
            <TaskFlowMap flow={flow} completed={completed} compact onPhaseClick={handlePhaseClick} />
            <button
              onClick={() => setShowFlowMap(true)}
              className="font-mono text-[10px] tracking-widest text-cyan-300/50 hover:text-cyan-200 transition-colors"
            >
              流程全景 ⌕
            </button>
            {diveSummary && (
              <span className="font-mono text-[10px] text-fuchsia-300/50">深潜 {diveSummary}</span>
            )}
          </div>
          <div className="cyber-dataline absolute inset-x-0 bottom-0 h-px" />
        </div>

        {/* 锚点卡 HUD：常驻右上角 */}
        {(anchor || anchorLoading) && (
          <div className="absolute right-4 top-[132px] z-20 max-lg:top-[150px]">
            {anchor ? (
              <AnchorHUD anchor={anchor} />
            ) : (
              <div className="cyber-panel px-3 py-2 font-mono text-[10px] tracking-widest text-amber-300/50 cyber-cursor">
                提取锚点中...
              </div>
            )}
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
          {/* Initial AI guidance messages */}
          {messages.length === 0 && !streamingText && !chatLoading && (
            <div className="space-y-4">
              <div className="flex justify-start">
                <div className="cyber-panel max-w-[78%] px-5 py-3 text-[15px] leading-relaxed text-white/70">
                  有什么不清楚的，随时问我
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[78%] space-y-2">
                  <p className="font-mono text-xs tracking-wider text-cyan-300/40 mb-2">你可以问我：</p>
                  {["这一步具体怎么开始？", "有什么好的学习资源？", "我卡住了，能给个提示吗？"].map((q) => (
                    <button
                      key={q}
                      onClick={() => sendChat(q)}
                      className="block w-full text-left border border-cyan-400/[0.15] bg-cyan-400/[0.04] px-4 py-2.5 text-sm text-white/70 hover:bg-cyan-400/10 hover:border-cyan-400/30 hover:text-cyan-100 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatBubbleGroup key={i} role={msg.role} content={msg.content} />
          ))}

          {/* Streaming */}
          {streamingText && (
            <div className="flex justify-start">
              <div className="cyber-panel max-w-[78%] px-5 py-3 text-[15px] leading-relaxed text-white/70 whitespace-pre-wrap">
                {streamingText}
                <span className="inline-flex items-center ml-1.5 gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}

          {chatLoading && !streamingText && (
            <div className="flex justify-start">
              <div className="cyber-panel px-5 py-3 text-[15px] text-cyan-200/50 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                思考中...
              </div>
            </div>
          )}

          {/* Resource results inline */}
          {resourceResults.length > 0 && (
            <div className="flex justify-start">
              <div className="cyber-panel cyber-corner max-w-[78%] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono text-xs font-medium tracking-wider text-cyan-200/70">📚 为你找到的资源</p>
                  <button onClick={() => setResourceResults([])} className="text-xs text-fuchsia-300/40 hover:text-fuchsia-300">✕</button>
                </div>
                <div className="space-y-2">
                  {resourceResults.map((r, i) => (
                    <div key={i} className="border border-cyan-400/[0.12] bg-cyan-400/[0.03] p-2.5">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-white/90 hover:text-cyan-300 hover:underline">
                          {r.title}
                        </a>
                      ) : (
                        <p className="text-xs font-medium text-white/70">{r.title}</p>
                      )}
                      <p className="text-[11px] text-white/50 mt-0.5">{r.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
          <div className="h-20" />
        </div>

        {/* Floating input area */}
        <div className="px-8 pb-8">
          <div className="cyber-panel cyber-corner p-4">
            {/* Soft upgrade after completion */}
            {completed && nextTask && (
              <div className="mb-3 pb-3 border-b border-cyan-400/[0.12]">
                <SoftUpgrade
                  nextTaskName={nextTask.title_plain}
                  nextTaskMinutes={nextTask.estimated_minutes}
                  onAccept={() => {
                    if (nextTask && planContext) {
                      saveSessionItem("qicheng_current_task", JSON.stringify(nextTask));
                      window.location.reload();
                    }
                  }}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={searchResource}
                disabled={searchingResource || chatLoading}
                className="border border-cyan-400/30 bg-cyan-400/[0.06] px-3 py-1.5 font-mono text-[11px] tracking-wider text-cyan-200/80 hover:bg-cyan-400/15 transition-colors disabled:opacity-50"
              >
                {searchingResource ? "搜索中..." : "🔍 搜索学习资源"}
              </button>
              <MoodCheckin />
            </div>

            {/* Input form */}
            <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2 items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="问问这个任务怎么做..."
                disabled={chatLoading}
                className="flex-1 bg-transparent px-3 py-2.5 text-[15px] text-white/90 placeholder:text-cyan-200/25 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={chatLoading || !input.trim()}
                className="border border-cyan-400/40 bg-cyan-400/10 px-5 py-2.5 font-mono text-sm tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                发送
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Right: Task breakdown panel */}
      <div className="relative z-10 w-[380px] overflow-y-auto border-l border-cyan-400/[0.12] bg-[#0a0a14]/40 backdrop-blur-xl px-6 py-6 max-lg:hidden">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
          <h2 className="font-mono text-xs font-semibold text-cyan-200/60 uppercase tracking-[0.25em]">
            任务拆解
          </h2>
        </div>
        <p className="font-mono text-[11px] tracking-wider text-fuchsia-300/40 mb-4">
          {planContext?.stageName || "执行步骤与提示"}
        </p>
        <div className="cyber-dataline mb-5 h-px w-full" />

        {breakdownLoading ? (
          <div className="text-center py-12">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400/80" />
            <p className="cyber-cursor mt-3 font-mono text-xs text-cyan-300/40">正在拆解任务...</p>
          </div>
        ) : breakdown ? (
          <div className="space-y-5">
            {/* Steps */}
            <div>
              <div className="flex items-center gap-1.5 font-mono text-xs font-medium tracking-wider text-cyan-200/60 mb-3">
                <span>📋</span>
                <span>执行步骤</span>
              </div>
              <p className="font-mono text-[10px] text-cyan-300/35 mb-2">点击步骤 → 左侧生成详细讲解与练习题</p>
              <div className="space-y-2.5">
                {breakdown.steps.map((step) => {
                  const dstate = flow.diveStates[step.order];
                  const isDiveLoading = diveLoadingOrder === step.order;
                  return (
                    <div key={step.order} className="cyber-panel flex gap-3 p-3.5 transition-all group">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-cyan-400/30 bg-cyan-400/10 font-mono text-[10px] font-medium text-cyan-200 mt-0.5 transition-colors group-hover:bg-cyan-400/25">
                        {String(step.order).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => handleStepClick(step)}
                          disabled={chatLoading}
                          className="block w-full text-left disabled:opacity-50"
                        >
                          <p className="text-sm font-medium text-white/90 group-hover:text-cyan-200 transition-colors">{step.title}</p>
                          <p className="text-[11px] text-white/50 mt-1 leading-relaxed">{step.description}</p>
                        </button>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-mono text-[10px] text-fuchsia-300/40">~{step.estimated_minutes} 分钟</span>
                          <button
                            onClick={() => handleStepClick(step)}
                            disabled={chatLoading}
                            className="font-mono text-[10px] text-cyan-300/50 hover:text-cyan-200 transition-colors disabled:opacity-40"
                          >
                            讲解 →
                          </button>
                          <button
                            onClick={() => fetchDive(step)}
                            disabled={isDiveLoading || diveLoadingOrder !== null}
                            title="逐行深潜：一行行推进，懂了才继续"
                            className={`border px-2 py-0.5 font-mono text-[10px] tracking-wider transition-all disabled:opacity-40 ${
                              dstate?.done
                                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                                : "border-fuchsia-400/30 bg-fuchsia-400/[0.06] text-fuchsia-300/80 hover:bg-fuchsia-400/15"
                            }`}
                          >
                            {isDiveLoading ? "生成中..." : dstate?.done ? "✓ 深潜完成" : dstate ? `深潜 ${dstate.current}/${dstate.total}` : "⌄ 深潜"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tips */}
            {breakdown.tips && breakdown.tips.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-medium tracking-wider text-cyan-200/60 mb-2">
                  <span>💡</span>
                  <span>小贴士</span>
                </div>
                <div className="pl-5 space-y-1.5">
                  {breakdown.tips.map((tip, i) => (
                    <p key={i} className="text-[11px] text-white/70 leading-relaxed flex gap-1.5">
                      <span className="text-cyan-400/50 shrink-0">▸</span>
                      <span>{tip}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Resources */}
            {breakdown.resources && breakdown.resources.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-medium tracking-wider text-cyan-200/60 mb-2">
                  <span>📚</span>
                  <span>推荐资源</span>
                </div>
                <div className="pl-5 space-y-1.5">
                  {breakdown.resources.map((res, i) => (
                    <p key={i} className="text-[11px] text-white/70 leading-relaxed flex gap-1.5">
                      <span className="text-fuchsia-400/50 shrink-0">→</span>
                      <span>{res}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-white/35">
            <p className="text-2xl">🔧</p>
            <p className="mt-2 text-xs">拆解失败，可以直接问 AI</p>
          </div>
        )}
      </div>

      {/* 第一屏：任务流程全景图 */}
      {showFlowMap && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowFlowMap(false)} />
          <div className="cyber-panel cyber-corner relative w-full max-w-lg max-h-[86vh] overflow-y-auto p-6 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/50">MISSION FLOW // 任务流程</p>
                <h2 className="mt-1 text-lg font-semibold text-white/90">{task.title_plain}</h2>
                <p className="mt-0.5 font-mono text-[11px] text-cyan-200/40">{task.title_professional}</p>
              </div>
              <button onClick={() => setShowFlowMap(false)} className="text-white/40 hover:text-white/80 transition-colors">✕</button>
            </div>

            {/* 锚点卡预览 */}
            <div className="mt-4 border border-amber-400/20 bg-amber-400/[0.04] p-3">
              {anchor ? (
                <>
                  <p className="font-mono text-[9px] tracking-[0.25em] text-amber-300/70">◈ 锚点 · 最不能脱离的东西</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/75">{anchor.invariant}</p>
                </>
              ) : anchorLoading ? (
                <p className="cyber-cursor font-mono text-[11px] text-amber-300/50">正在提取这个知识的锚点...</p>
              ) : (
                <p className="font-mono text-[11px] text-white/40">锚点提取失败，点击下方「锚点提取」环节重试</p>
              )}
            </div>

            <div className="cyber-dataline my-4 h-px" />
            <TaskFlowMap flow={flow} completed={completed} diveSummary={diveSummary} onPhaseClick={handlePhaseClick} />

            <button
              onClick={() => setShowFlowMap(false)}
              className="mt-4 w-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 font-mono text-xs tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-all"
            >
              {completed ? "回顾任务 →" : "继续任务 →"}
            </button>
          </div>
        </div>
      )}

      {/* 逐行深潜卡 */}
      {activeDive !== null && dives[activeDive] && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setActiveDive(null)} />
          <div className="relative w-full max-w-2xl max-h-[88vh] flex">
            <DeriveCard
              sequence={dives[activeDive]}
              initialCurrent={flow.diveStates[activeDive]?.current ?? 0}
              initialStuck={flow.diveStates[activeDive]?.stuckCount ?? 0}
              onProgress={(current, stuckCount, done) => {
                setFlow((prev) => ({
                  ...prev,
                  diveStates: {
                    ...prev.diveStates,
                    [activeDive]: {
                      current,
                      total: dives[activeDive].lines.length,
                      stuckCount,
                      done,
                    },
                  },
                }));
              }}
              onExpandLine={expandDiveLine}
              onClose={() => setActiveDive(null)}
            />
          </div>
        </div>
      )}

      {/* Universe node lit toast */}
      {universeToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-[slide-up_0.3s_ease-out]">
          <div className="cyber-panel cyber-corner flex items-center gap-3 px-5 py-3">
            <span className="text-lg">✨</span>
            <div>
              <p className="text-xs font-medium text-white/90">知识宇宙点亮了新节点</p>
              <p className="text-[11px] text-cyan-300 mt-0.5">{universeToast}</p>
            </div>
            <button
              onClick={() => router.push("/universe")}
              className="ml-2 border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 font-mono text-[11px] font-medium tracking-wider text-cyan-200 hover:bg-cyan-400/20 transition-colors"
            >
              去看看
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
