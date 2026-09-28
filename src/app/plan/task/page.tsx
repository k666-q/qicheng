"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { MessageNotePanel } from "@/components/notes/MessageNotePanel";
import { trackEvent } from "@/lib/profile/events";
import { recordDailyCompletion } from "@/lib/habit/streak";
import { loadGraph, getLearnedNodeIds, markLearned, getStoredPlanScope } from "@/lib/universe/store";
import { getTaskNodeIds } from "@/lib/universe/plan-link";
import type { PlanTask, TaskBreakdown } from "@/lib/plan/types";
import { saveSessionItem, loadSessionItem } from "@/lib/plan/store";
import { taskChatKey, loadTaskChat, saveTaskChat } from "@/lib/storage/session-store";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { DeriveCard } from "@/components/learn/DeriveCard";
import { ResizableDivider, useResizablePanel } from "@/components/ui/ResizableDivider";
import {
  initialFlowState,
  type AnchorCard,
  type DeriveLine,
  type DeriveSequence,
  type TaskFlowState,
} from "@/lib/learn/depth-types";
import { getAnchorCard, saveAnchorCard } from "@/lib/learn/anchor-store";

type ChatMessage = { role: "ai" | "user"; content: string };

// ─── 教学卡片类型 ───
type TeachCard = {
  type: "HOOK" | "TEACH" | "KEY" | "QUIZ" | "TIP" | "SUMMARY";
  content: string;
};

function parseTeachCards(raw: string): TeachCard[] {
  const cleaned = raw.replace(/\|\|\|SPLIT\|\|\|/g, "\n");
  const regex = /\[\[(HOOK|TEACH|KEY|QUIZ|TIP|SUMMARY)\]\]/g;
  const cards: TeachCard[] = [];
  const matches: { type: string; index: number }[] = [];

  let m;
  while ((m = regex.exec(cleaned)) !== null) {
    matches.push({ type: m[1], index: m.index + m[0].length });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? cleaned.lastIndexOf("[[", matches[i + 1].index) : cleaned.length;
    const content = cleaned.slice(start, end).trim();
    if (content) {
      cards.push({ type: matches[i].type as TeachCard["type"], content });
    }
  }

  if (cards.length === 0 && cleaned.trim()) {
    cards.push({ type: "TEACH", content: cleaned.trim() });
  }
  return cards;
}

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

function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as T; } catch { return null; }
}

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
      if (c && typeof c.question === "string" && Array.isArray(c.options) && c.options.length >= 2 && typeof c.answer === "number" && c.answer >= 0 && c.answer < c.options.length) {
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
  return { title: typeof seq.title === "string" ? seq.title : "逐行深潜", intro: typeof seq.intro === "string" ? seq.intro : "", kind, lines };
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

  // Center panel: step learning cards
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [teachCards, setTeachCards] = useState<TeachCard[]>([]);
  const [visibleCardIdx, setVisibleCardIdx] = useState(0);
  const [teachLoading, setTeachLoading] = useState(false);
  const [teachStreamText, setTeachStreamText] = useState("");

  // Right panel: chat + notes
  const [rightTab, setRightTab] = useState<"chat" | "notes">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [notes, setNotes] = useState("");

  const [completed, setCompleted] = useState(false);
  const [nextTask, setNextTask] = useState<PlanTask | null>(null);
  const [universeToast, setUniverseToast] = useState<string | null>(null);

  // Deep system
  const [flow, setFlow] = useState<TaskFlowState>(initialFlowState());
  const [anchor, setAnchor] = useState<AnchorCard | null>(null);
  const [dives, setDives] = useState<Record<number, DeriveSequence>>({});
  const [activeDive, setActiveDive] = useState<number | null>(null);
  const [diveLoadingOrder, setDiveLoadingOrder] = useState<number | null>(null);

  // Resizable panels
  const leftPanel = useResizablePanel("qc_task_left_w", 260, 200, 400);
  const rightPanel = useResizablePanel("qc_task_right_w", 320, 240, 480);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const anchoredNodeId = useMemo(() => {
    if (!task) return null;
    try {
      const graph = loadGraph();
      const ids = getTaskNodeIds(task, graph.nodes, getStoredPlanScope());
      return ids.length > 0 ? ids[0] : null;
    } catch { return null; }
  }, [task]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // ─── 初始化 ───
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

    // Find next task
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
        const idx = allTasks.findIndex((x) => x.title_plain === t.title_plain && x.title_professional === t.title_professional);
        if (idx >= 0 && idx < allTasks.length - 1) setNextTask(allTasks[idx + 1]);
      }
    } catch { /* ignore */ }

    // Restore anchor
    const savedAnchor = getAnchorCard(taskChatKey(t));
    if (savedAnchor) setAnchor(savedAnchor);

    // Restore session
    const saved = loadTaskChat(taskChatKey(t));
    if (saved) {
      if (Array.isArray(saved.messages) && saved.messages.length > 0) setMessages(saved.messages as ChatMessage[]);
      if (saved.flow && typeof saved.flow === "object") {
        const restoredFlow = { ...initialFlowState(), ...(saved.flow as TaskFlowState) };
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
    if (!saved?.flow && savedAnchor) setFlow((prev) => ({ ...prev, anchorDone: true }));

    // Fetch anchor if missing
    if (!savedAnchor) fetchAnchor(t, c);

    // Restore notes
    const savedNotes = localStorage.getItem(`qc_task_notes_${taskChatKey(t)}`);
    if (savedNotes) setNotes(savedNotes);

    // Fetch breakdown
    if (saved?.breakdown) {
      setBreakdown(saved.breakdown as TaskBreakdown);
      setBreakdownLoading(false);
      setFlow((prev) => ({ ...prev, breakdownDone: true }));
      return;
    }
    fetchBreakdown(t, c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Persist
  useEffect(() => {
    if (!task || chatLoading || breakdownLoading) return;
    if (!breakdown && messages.length === 0 && !anchor) return;
    saveTaskChat({ taskKey: taskChatKey(task), breakdown, messages, flow, dives });
  }, [task, breakdown, messages, chatLoading, breakdownLoading, flow, dives, anchor]);

  // Save notes
  useEffect(() => {
    if (!task || !notes) return;
    localStorage.setItem(`qc_task_notes_${taskChatKey(task)}`, notes);
  }, [task, notes]);

  // ─── Fetch functions ───
  const fetchAnchor = useCallback(async (t: PlanTask, ctx: { title: string; domain: string; stageName: string }) => {
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
      } catch { /* retry */ }
    }
  }, []);

  const fetchBreakdown = useCallback(async (t: PlanTask, ctx: { title: string; domain: string; stageName: string }) => {
    setBreakdownLoading(true);
    try {
      const res = await fetch("/api/task-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: t, planContext: ctx, history: [], userMessage: "", mode: "breakdown" }),
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

  const fetchStepTeach = useCallback(async (step: { order: number; title: string; description: string }) => {
    if (!task || !planContext) return;
    setTeachLoading(true);
    setTeachCards([]);
    setVisibleCardIdx(0);
    setTeachStreamText("");

    try {
      const res = await fetch("/api/task-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, planContext, history: [], userMessage: "", mode: "step-teach", step }),
      });

      if (!res.ok || !res.body) {
        setTeachLoading(false);
        return;
      }

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
              setTeachStreamText(accumulated);
            }
          } catch { /* ignore */ }
        }
      }

      const cards = parseTeachCards(accumulated);
      setTeachCards(cards);
      setVisibleCardIdx(0);
      setTeachStreamText("");
    } catch { /* ignore */ }
    setTeachLoading(false);
  }, [task, planContext]);

  const fetchDive = useCallback(async (step: { order: number; title: string; description: string }) => {
    if (!task || !planContext) return;
    if (dives[step.order]) { setActiveDive(step.order); return; }
    setDiveLoadingOrder(step.order);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("/api/task-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task, planContext, history: [], userMessage: "", mode: "deepdive", step }),
        });
        const text = await readStream(res);
        const seq = sanitizeDive(extractJson(text));
        if (seq) {
          setDives((prev) => ({ ...prev, [step.order]: seq }));
          setFlow((prev) => ({
            ...prev,
            diveStates: { ...prev.diveStates, [step.order]: prev.diveStates[step.order] ?? { current: 0, total: seq.lines.length, stuckCount: 0, done: false } },
          }));
          setActiveDive(step.order);
          break;
        }
      } catch { /* retry */ }
    }
    setDiveLoadingOrder(null);
  }, [task, planContext, dives]);

  const expandDiveLine = useCallback(async (line: DeriveLine, lineIndex: number): Promise<string | null> => {
    if (!task || !planContext) return null;
    try {
      const res = await fetch("/api/task-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task, planContext, history: [], mode: "chat",
          userMessage: `我正在逐行深潜，卡在第 ${lineIndex + 1} 行没看懂。请只针对这一行，把它拆得更细来解释，用类比和画面感，不超过 150 字：\n\n这一行的内容：${line.content}\n原本的解释：${line.explain}`,
        }),
      });
      return await readStream(res) || null;
    } catch { return null; }
  }, [task, planContext]);

  // Right panel chat
  async function sendChat(customMsg?: string) {
    const msg = customMsg || input.trim();
    if (!msg || chatLoading || !task || !planContext) return;
    setInput("");
    setChatLoading(true);
    setStreamingText("");

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/task-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, planContext, history: newMessages, userMessage: msg, mode: "chat" }),
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
        for (const line of text.split("\n\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") { accumulated += event.content; setStreamingText(accumulated); }
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

  function handleStepSelect(step: { order: number; title: string; description: string }) {
    setActiveStep(step.order);
    fetchStepTeach(step);
  }

  function handleComplete() {
    if (!task) return;
    const graph = loadGraph();
    const beforeLearned = getLearnedNodeIds(graph.nodes);
    setCompleted(true);
    recordDailyCompletion();
    const nodeIds = getTaskNodeIds(task, graph.nodes, getStoredPlanScope());
    for (const id of nodeIds) markLearned(id);
    trackEvent("task_completed", { title_plain: task.title_plain, title_professional: task.title_professional, difficulty: task.difficulty, node_ids: nodeIds });
    setTimeout(() => {
      const afterLearned = getLearnedNodeIds(graph.nodes);
      const newNodes = [...afterLearned].filter((id) => !beforeLearned.has(id));
      if (newNodes.length > 0) {
        const names = newNodes.map((id) => graph.nodes.find((n) => n.id === id)?.name).filter(Boolean);
        setUniverseToast(names.length > 0 ? names.join("、") : null);
        setTimeout(() => setUniverseToast(null), 6000);
      }
    }, 300);
  }

  if (!task) return null;

  const DIFFICULTY_LABELS: Record<number, string> = { 1: "轻松", 2: "简单", 3: "适中", 4: "挑战", 5: "硬核" };
  const DIFFICULTY_COLORS: Record<number, string> = {
    1: "text-emerald-300", 2: "text-sky-300", 3: "text-amber-300", 4: "text-orange-300", 5: "text-red-300",
  };

  return (
    <div className="flex h-screen bg-[#050510] md:pl-[var(--siderail-width)]">
      <CosmicBackground />
      <CyberOverlay />

      {/* ═══ Left: Steps Navigation ═══ */}
      <div className="relative z-10 flex flex-col border-r border-cyan-400/[0.12] bg-[#0a0a14]/60 backdrop-blur-xl max-md:hidden" style={{ width: leftPanel.size } as CSSProperties}>
        {/* Task header */}
        <div className="px-4 py-4 border-b border-cyan-400/[0.08]">
          <button
            onClick={() => router.push("/plan/detail")}
            className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-300/50 hover:text-cyan-200 transition-colors mb-2"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回计划
          </button>
          <h1 className="text-sm font-semibold text-white/90 leading-snug">{task.title_plain}</h1>
          <p className="font-mono text-[10px] text-cyan-200/40 mt-1">{task.title_professional}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-mono font-medium ${DIFFICULTY_COLORS[task.difficulty] || "text-amber-300"}`}>
              {DIFFICULTY_LABELS[task.difficulty] || "适中"}
            </span>
            <span className="font-mono text-[10px] text-white/30">~{task.estimated_minutes}min</span>
          </div>
        </div>

        {/* Anchor card mini */}
        {anchor && (
          <div className="px-4 py-3 border-b border-cyan-400/[0.08]">
            <p className="font-mono text-[9px] tracking-[0.2em] text-amber-300/60 mb-1">◈ 锚点</p>
            <p className="text-[11px] text-white/60 leading-relaxed">{anchor.invariant}</p>
          </div>
        )}

        {/* Steps list */}
        <div className="flex-1 overflow-y-auto scrollbar-cosmic px-3 py-3">
          {breakdownLoading ? (
            <div className="text-center py-8">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400/80" />
              <p className="mt-2 font-mono text-[10px] text-cyan-300/40">拆解任务中...</p>
            </div>
          ) : breakdown ? (
            <div className="space-y-1.5">
              {breakdown.steps.map((step) => {
                const isActive = activeStep === step.order;
                const dstate = flow.diveStates[step.order];
                return (
                  <button
                    key={step.order}
                    onClick={() => handleStepSelect(step)}
                    className={`w-full text-left px-3 py-2.5 rounded transition-all ${
                      isActive
                        ? "bg-cyan-400/10 border border-cyan-400/30"
                        : "hover:bg-white/[0.03] border border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-medium mt-0.5 ${
                        isActive ? "bg-cyan-400/20 text-cyan-200" : "bg-white/[0.06] text-white/40"
                      }`}>
                        {step.order}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] font-medium leading-snug ${isActive ? "text-cyan-100" : "text-white/70"}`}>
                          {step.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[9px] text-white/30">~{step.estimated_minutes}min</span>
                          {dstate?.done && <span className="text-[9px] text-emerald-400/70">✓</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Deep dive buttons */}
              {activeStep !== null && breakdown.steps.find(s => s.order === activeStep) && (
                <div className="mt-3 pt-3 border-t border-cyan-400/[0.08] space-y-2">
                  <button
                    onClick={() => {
                      const step = breakdown.steps.find(s => s.order === activeStep);
                      if (step) fetchDive(step);
                    }}
                    disabled={diveLoadingOrder !== null}
                    className="w-full text-left px-3 py-2 border border-fuchsia-400/20 bg-fuchsia-400/[0.04] rounded text-[11px] text-fuchsia-200/70 hover:bg-fuchsia-400/10 transition-all disabled:opacity-40"
                  >
                    {diveLoadingOrder === activeStep ? "生成中..." : "⌄ 逐行深潜"}
                  </button>
                  {anchoredNodeId && (
                    <button
                      onClick={() => router.push(`/plan/learn?node=${encodeURIComponent(anchoredNodeId)}`)}
                      className="w-full text-left px-3 py-2 border border-indigo-400/20 bg-indigo-400/[0.04] rounded text-[11px] text-indigo-200/70 hover:bg-indigo-400/10 transition-all"
                    >
                      ✦ 星核探索
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-white/30 text-[11px]">拆解失败</div>
          )}
        </div>

        {/* Complete button */}
        <div className="px-3 py-3 border-t border-cyan-400/[0.08]">
          {!completed ? (
            <button
              onClick={handleComplete}
              className="w-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 font-mono text-xs tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-all"
            >
              ✓ 完成任务
            </button>
          ) : (
            <div className="text-center">
              <span className="text-xs text-emerald-300 font-mono font-medium">已完成 ✓</span>
              {nextTask && (
                <button
                  onClick={() => {
                    saveSessionItem("qicheng_current_task", JSON.stringify(nextTask));
                    window.location.reload();
                  }}
                  className="mt-2 w-full border border-cyan-400/25 bg-cyan-400/[0.05] px-3 py-2 font-mono text-[11px] text-cyan-200/70 hover:bg-cyan-400/15 transition-all"
                >
                  下一个：{nextTask.title_plain} →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Left divider */}
      <ResizableDivider direction="horizontal" storageKey="qc_task_left_w" defaultSize={260} minSize={200} maxSize={400} side="left" onResize={leftPanel.onResize} />

      {/* ═══ Center: Card-based Learning ═══ */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Center header */}
        <div className="px-6 py-3 border-b border-cyan-400/[0.08] bg-[#0a0a14]/40 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              {activeStep !== null && breakdown ? (
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-cyan-400/15 font-mono text-[10px] text-cyan-200">{activeStep}</span>
                  <span className="text-sm font-medium text-white/85">{breakdown.steps.find(s => s.order === activeStep)?.title}</span>
                </div>
              ) : (
                <span className="text-sm text-white/50">选择左侧步骤开始学习</span>
              )}
            </div>
            {teachCards.length > 0 && (
              <span className="font-mono text-[10px] text-white/30">
                {visibleCardIdx + 1} / {teachCards.length}
              </span>
            )}
          </div>
        </div>

        {/* Cards content */}
        <div className="flex-1 overflow-y-auto scrollbar-cosmic px-6 py-6">
          {activeStep === null && !teachLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 border border-cyan-400/15 bg-cyan-400/[0.04] rounded-xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-cyan-300/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
              </div>
              <h2 className="text-base font-medium text-white/60 mb-2">选择步骤开始学习</h2>
              <p className="text-[12px] text-white/30 max-w-sm">
                从左侧选择一个步骤，AI 会用卡片式教学一步步带你搞懂
              </p>
            </div>
          )}

          {/* Teach loading */}
          {teachLoading && (
            <div className="space-y-4">
              {teachStreamText ? (
                <div className="cyber-panel p-5 text-[14px] leading-relaxed text-white/70 whitespace-pre-wrap">
                  {teachStreamText.slice(0, 200)}...
                  <div className="mt-3 flex items-center gap-2 text-cyan-300/50 text-[11px]">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400/80" />
                    正在生成教学内容...
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400/80" />
                    <p className="mt-3 font-mono text-xs text-cyan-300/40">正在为你准备教学卡片...</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rendered cards */}
          {!teachLoading && teachCards.length > 0 && (
            <div className="space-y-4 max-w-2xl mx-auto">
              {teachCards.slice(0, visibleCardIdx + 1).map((card, i) => (
                <TeachCardRenderer key={i} card={card} isLatest={i === visibleCardIdx} />
              ))}

              {/* Next card button */}
              {visibleCardIdx < teachCards.length - 1 && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => setVisibleCardIdx((v) => v + 1)}
                    className="border border-cyan-400/30 bg-cyan-400/[0.06] px-6 py-2.5 font-mono text-xs text-cyan-200/80 hover:bg-cyan-400/15 hover:border-cyan-400/50 transition-all"
                  >
                    继续 →
                  </button>
                </div>
              )}

              {visibleCardIdx === teachCards.length - 1 && (
                <div className="flex justify-center pt-4">
                  <span className="font-mono text-[11px] text-emerald-300/60">✓ 本步骤学习完成</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right divider */}
      <ResizableDivider direction="horizontal" storageKey="qc_task_right_w" defaultSize={320} minSize={240} maxSize={480} side="right" onResize={rightPanel.onResize} />

      {/* ═══ Right: Notes + AI Chat ═══ */}
      <div className="relative z-10 flex flex-col border-l border-[var(--border-1)] bg-[var(--bg-1)]/95 backdrop-blur-xl max-lg:hidden" style={{ width: rightPanel.size } as CSSProperties}>
        {/* Tab header — matches learn page */}
        <div className="flex items-center gap-1 border-b border-[var(--border-1)] px-3 py-2">
          <button
            onClick={() => setRightTab("notes")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[var(--font-xs)] font-medium transition-all ${
              rightTab === "notes"
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
            onClick={() => setRightTab("chat")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[var(--font-xs)] font-medium transition-all ${
              rightTab === "chat"
                ? "bg-[var(--qc-accent-muted)] text-[var(--qc-accent)]"
                : "text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)]"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            AI 答疑
            {messages.filter(m => m.role === "user").length > 0 && (
              <span className="rounded-full bg-[var(--qc-accent-muted)] px-1.5 text-[9px] text-[var(--qc-accent)]">{messages.filter(m => m.role === "user").length}</span>
            )}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setRightTab(rightTab === "notes" ? "chat" : "notes")}
            title="切换面板"
            className="rounded p-1.5 text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Notes tab — uses MessageNotePanel */}
        {rightTab === "notes" && task && (
          <MessageNotePanel
            subjectName={planContext?.domain || "general"}
            nodeName={task.title_plain}
            nodeId={`task_${task.title_professional}`}
          />
        )}

        {/* AI Chat tab — thread-based like learn page */}
        {rightTab === "chat" && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto scrollbar-cosmic px-4 py-4 space-y-4">
              {messages.length === 0 && !streamingText && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <div className="text-2xl opacity-30">💬</div>
                  <p className="text-[var(--font-sm)] text-[var(--text-3)]">探索途中有疑问？</p>
                  <p className="text-[var(--font-xs)] text-[var(--text-3)]/60">在下方输入你的问题，不会打断学习流程</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-[var(--radius-panel)] bg-[var(--qc-accent-muted)] border border-[var(--qc-accent)]/15 px-3.5 py-2 text-[var(--font-sm)] text-[var(--text-1)]">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-1)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[var(--font-sm)] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}

              {streamingText && (
                <div className="rounded-[var(--radius-panel)] border border-[var(--border-1)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[var(--font-sm)] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-flex ml-1 gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--qc-accent)] animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--qc-accent)] animate-bounce [animation-delay:150ms]" />
                  </span>
                </div>
              )}

              {chatLoading && !streamingText && (
                <div className="flex items-center gap-2 px-1 text-[var(--text-3)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--qc-accent)] animate-bounce" />
                  <span className="text-[var(--font-xs)]">思考中…</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="px-3 py-3 border-t border-[var(--border-1)]">
              <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="输入你的疑问…"
                  disabled={chatLoading}
                  className="flex-1 rounded-[var(--radius-control)] border border-[var(--border-1)] bg-[var(--bg-3)] px-3 py-2 text-[var(--font-sm)] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--qc-accent)] focus:outline-none disabled:opacity-50 transition-all"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !input.trim()}
                  className="rounded-[var(--radius-control)] bg-[var(--qc-accent-muted)] border border-[var(--qc-accent)]/20 px-3 py-2 text-[var(--font-xs)] font-medium text-[var(--qc-accent)] hover:bg-[var(--qc-accent)]/20 disabled:opacity-30 transition-all"
                >
                  发送
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Deep Dive Modal ═══ */}
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
                  diveStates: { ...prev.diveStates, [activeDive]: { current, total: dives[activeDive].lines.length, stuckCount, done } },
                }));
              }}
              onExpandLine={expandDiveLine}
              onClose={() => setActiveDive(null)}
            />
          </div>
        </div>
      )}

      {/* Universe toast */}
      {universeToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-5 py-3 rounded border border-cyan-400/20 bg-[#0a0a14]/90 backdrop-blur-xl">
            <span className="text-lg">✨</span>
            <div>
              <p className="text-xs font-medium text-white/90">知识宇宙点亮了新节点</p>
              <p className="text-[11px] text-cyan-300 mt-0.5">{universeToast}</p>
            </div>
            <button
              onClick={() => router.push("/universe")}
              className="ml-2 border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 font-mono text-[10px] text-cyan-200 hover:bg-cyan-400/20 transition-colors rounded"
            >
              去看看
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Teach Card Component ───
function TeachCardRenderer({ card, isLatest }: { card: TeachCard; isLatest: boolean }) {
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [showQuizResult, setShowQuizResult] = useState(false);

  const typeStyles: Record<string, { border: string; icon: string; label: string }> = {
    HOOK: { border: "border-amber-400/20", icon: "🪝", label: "HOOK" },
    TEACH: { border: "border-cyan-400/15", icon: "📖", label: "TEACH" },
    KEY: { border: "border-fuchsia-400/20", icon: "🎯", label: "KEY" },
    QUIZ: { border: "border-indigo-400/20", icon: "⚔️", label: "QUIZ" },
    TIP: { border: "border-emerald-400/20", icon: "💡", label: "TIP" },
    SUMMARY: { border: "border-violet-400/20", icon: "✨", label: "SUMMARY" },
  };

  const style = typeStyles[card.type] || typeStyles.TEACH;

  if (card.type === "QUIZ") {
    return <QuizCardRenderer content={card.content} style={style} isLatest={isLatest} quizAnswer={quizAnswer} setQuizAnswer={setQuizAnswer} showResult={showQuizResult} setShowResult={setShowQuizResult} />;
  }

  return (
    <div className={`border ${style.border} bg-[#0c0c1a]/60 rounded-lg p-5 ${isLatest ? "animate-fade-in" : ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{style.icon}</span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">{style.label}</span>
      </div>
      <div className="text-[14px] text-white/75 leading-relaxed whitespace-pre-wrap">
        {card.content}
      </div>
    </div>
  );
}

function QuizCardRenderer({
  content, style, isLatest, quizAnswer, setQuizAnswer, showResult, setShowResult,
}: {
  content: string; style: { border: string; icon: string; label: string }; isLatest: boolean;
  quizAnswer: string | null; setQuizAnswer: (v: string | null) => void;
  showResult: boolean; setShowResult: (v: boolean) => void;
}) {
  const lines = content.split("\n");
  const questionLines: string[] = [];
  const options: { label: string; text: string }[] = [];
  let correctAnswer = "";
  let explanation = "";

  let section: "question" | "options" | "answer" = "question";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^-\s*[A-D]\)/)) {
      section = "options";
      const match = trimmed.match(/^-\s*([A-D])\)\s*(.*)/);
      if (match) options.push({ label: match[1], text: match[2] });
    } else if (trimmed.startsWith("ANSWER:")) {
      section = "answer";
      correctAnswer = trimmed.replace("ANSWER:", "").trim();
    } else if (trimmed.startsWith("WHY:")) {
      explanation = trimmed.replace("WHY:", "").trim();
    } else if (section === "answer" && !trimmed.startsWith("ANSWER:") && trimmed) {
      explanation += "\n" + trimmed;
    } else if (section === "question") {
      questionLines.push(line);
    }
  }

  return (
    <div className={`border ${style.border} bg-[#0c0c1a]/60 rounded-lg p-5 ${isLatest ? "animate-fade-in" : ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{style.icon}</span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">{style.label}</span>
      </div>
      <div className="text-[14px] text-white/75 leading-relaxed mb-4 whitespace-pre-wrap">
        {questionLines.join("\n")}
      </div>

      <div className="space-y-2">
        {options.map((opt) => {
          const isSelected = quizAnswer === opt.label;
          const isCorrect = opt.label === correctAnswer;
          const showColor = showResult;
          return (
            <button
              key={opt.label}
              onClick={() => {
                if (showResult) return;
                setQuizAnswer(opt.label);
              }}
              className={`w-full text-left px-4 py-2.5 rounded border transition-all text-[13px] ${
                showColor && isCorrect
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  : showColor && isSelected && !isCorrect
                    ? "border-red-400/40 bg-red-400/10 text-red-200"
                    : isSelected
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.04] hover:border-white/20"
              }`}
            >
              <span className="font-mono font-medium mr-2">{opt.label})</span>
              {opt.text}
            </button>
          );
        })}
      </div>

      {quizAnswer && !showResult && (
        <button
          onClick={() => setShowResult(true)}
          className="mt-4 border border-cyan-400/30 bg-cyan-400/[0.06] px-4 py-2 rounded font-mono text-[11px] text-cyan-200/80 hover:bg-cyan-400/15 transition-all"
        >
          确认答案
        </button>
      )}

      {showResult && (
        <div className="mt-4 p-3 rounded border border-white/10 bg-white/[0.02]">
          <p className={`text-[12px] font-medium mb-1 ${quizAnswer === correctAnswer ? "text-emerald-300" : "text-red-300"}`}>
            {quizAnswer === correctAnswer ? "✓ 正确！" : `✗ 正确答案是 ${correctAnswer}`}
          </p>
          {explanation && (
            <p className="text-[12px] text-white/50 leading-relaxed">{explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
