"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatBubbleGroup } from "@/components/onboarding/ChatBubble";
import { MoodCheckin } from "@/components/mood/MoodCheckin";
import { SoftUpgrade } from "@/components/SoftUpgrade";
import { trackEvent } from "@/lib/profile/events";
import { recordDailyCompletion } from "@/lib/habit/streak";
import type { PlanTask, TaskBreakdown } from "@/lib/plan/types";

type ChatMessage = { role: "ai" | "user"; content: string };

export default function TaskDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-stone-50 text-stone-400">加载中...</div>}>
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

  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const taskStr = sessionStorage.getItem("qicheng_current_task");
    const contextStr = sessionStorage.getItem("qicheng_task_context");

    if (!taskStr || !contextStr) {
      router.replace("/plan");
      return;
    }

    const t = JSON.parse(taskStr) as PlanTask;
    const c = JSON.parse(contextStr);
    setTask(t);
    setPlanContext(c);

    try {
      const planStr = sessionStorage.getItem("qicheng_plan");
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

    fetchBreakdown(t, c);
  }, [router]);

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

      if (!res.ok || !res.body) {
        setBreakdownLoading(false);
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

      const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as TaskBreakdown;
        setBreakdown(parsed);
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
    const prompt = `请详细讲解「${step.title}」这一步。

要求格式如下（使用 Markdown）：

## 📖 核心知识点

用通俗易懂的方式，**逐个**讲解这一步涉及的关键概念。每个概念：
- 给出**一句话定义**（加粗）
- 用**生活化类比**或**实际例子**解释清楚
- 如果有易混淆的点，用对比说明

要求：讲得足够细，让完全零基础的人也能理解。

## 🔧 实操指南

如果这一步需要安装软件、配置环境、写代码或搭建项目：
- 给出**详细的操作步骤**（每步一条命令或操作）
- 用 \`代码块\` 标注命令
- 标注可能遇到的坑和解决方法

如果不需要安装/操作，这一节可以改为"动手建议"（比如：拿纸笔画、手写推演等）。

## 📝 阶梯练习

给出 3 道由浅入深的选择题：

**第 1 题（入门）**
题目描述
- A) 选项一
- B) 选项二
- C) 选项三
- D) 选项四

> 答案：X  
> 解析：为什么选这个...

**第 2 题（进阶）**
...（同样格式）

**第 3 题（挑战）**
...（同样格式）

## 🎬 B站推荐搜索

给出 2 个精准的 B站搜索关键词，格式：
- 搜索：「关键词1」（推荐理由）
- 搜索：「关键词2」（推荐理由）

---

背景信息：这是「${task.title_plain}」任务的第 ${step.order} 步。
步骤描述：${step.description}
所属阶段：${planContext?.stageName || ""}`;

    sendChat(prompt);
  }

  if (!task) return null;

  const DIFFICULTY_LABELS: Record<number, string> = { 1: "轻松", 2: "简单", 3: "适中", 4: "挑战", 5: "硬核" };
  const DIFFICULTY_COLORS: Record<number, string> = {
    1: "bg-emerald-50 text-emerald-600",
    2: "bg-sky-50 text-sky-600",
    3: "bg-amber-50 text-amber-600",
    4: "bg-orange-50 text-orange-600",
    5: "bg-red-50 text-red-600",
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-stone-50 via-white to-stone-50/80">
      {/* Left: AI Chat - main area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-stone-100/80 px-6 py-4 backdrop-blur-sm bg-white/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-sm font-semibold text-stone-800">{task.title_plain}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-stone-400">{task.title_professional}</span>
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${DIFFICULTY_COLORS[task.difficulty] || DIFFICULTY_COLORS[3]}`}>
                    {DIFFICULTY_LABELS[task.difficulty] || "适中"}
                  </span>
                  <span className="text-[10px] text-stone-400">~{task.estimated_minutes}min</span>
                </div>
              </div>
            </div>
            {/* Complete button in header */}
            {!completed ? (
              <button
                onClick={() => {
                  setCompleted(true);
                  recordDailyCompletion();
                  trackEvent("task_completed", {
                    title_plain: task?.title_plain,
                    title_professional: task?.title_professional,
                    difficulty: task?.difficulty,
                  });
                }}
                className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-800 transition-all shadow-sm"
              >
                ✓ 完成任务
              </button>
            ) : (
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 rounded-xl px-3 py-1.5">已完成 ✓</span>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
          {/* Initial AI guidance messages */}
          {messages.length === 0 && !streamingText && !chatLoading && (
            <div className="space-y-4">
              <div className="flex justify-start">
                <div className="max-w-[78%] rounded-2xl px-5 py-3 text-[15px] leading-relaxed bg-white border border-stone-100 text-stone-700 shadow-sm">
                  有什么不清楚的，随时问我
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[78%] space-y-2">
                  <p className="text-xs text-stone-400 mb-2">你可以问我：</p>
                  {["这一步具体怎么开始？", "有什么好的学习资源？", "我卡住了，能给个提示吗？"].map((q) => (
                    <button
                      key={q}
                      onClick={() => sendChat(q)}
                      className="block w-full text-left rounded-xl border border-stone-100 bg-white px-4 py-2.5 text-[13px] text-stone-600 hover:bg-stone-50 hover:border-stone-200 hover:shadow-sm transition-all"
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
              <div className="max-w-[78%] rounded-2xl px-5 py-3 text-[15px] leading-relaxed bg-white border border-stone-100 text-stone-700 shadow-sm whitespace-pre-wrap">
                {streamingText}
                <span className="inline-flex items-center ml-1.5 gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}

          {chatLoading && !streamingText && (
            <div className="flex justify-start">
              <div className="bg-white border border-stone-100 rounded-2xl px-5 py-3 text-[15px] text-stone-400 flex items-center gap-2 shadow-sm">
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
              <div className="max-w-[78%] rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-stone-600">📚 为你找到的资源</p>
                  <button onClick={() => setResourceResults([])} className="text-xs text-stone-300 hover:text-stone-500">✕</button>
                </div>
                <div className="space-y-2">
                  {resourceResults.map((r, i) => (
                    <div key={i} className="rounded-lg border border-stone-100 bg-stone-50 p-2.5">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-stone-800 hover:text-blue-600 hover:underline">
                          {r.title}
                        </a>
                      ) : (
                        <p className="text-xs font-medium text-stone-600">{r.title}</p>
                      )}
                      <p className="text-[11px] text-stone-400 mt-0.5">{r.reason}</p>
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
          <div className="rounded-2xl border border-stone-200/60 bg-white/95 backdrop-blur-xl shadow-xl shadow-stone-300/30 p-4 ring-1 ring-stone-100/50">
            {/* Soft upgrade after completion */}
            {completed && nextTask && (
              <div className="mb-3 pb-3 border-b border-stone-100">
                <SoftUpgrade
                  nextTaskName={nextTask.title_plain}
                  nextTaskMinutes={nextTask.estimated_minutes}
                  onAccept={() => {
                    if (nextTask && planContext) {
                      sessionStorage.setItem("qicheng_current_task", JSON.stringify(nextTask));
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
                className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px] text-stone-500 hover:text-stone-700 hover:border-stone-300 hover:shadow-sm transition-all disabled:opacity-50"
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
                className="flex-1 bg-transparent px-3 py-2.5 text-[15px] text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={chatLoading || !input.trim()}
                className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
              >
                发送
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Right: Task breakdown panel */}
      <div className="w-[380px] overflow-y-auto border-l border-stone-100/60 bg-gradient-to-b from-white to-stone-50/50 px-6 py-6 max-lg:hidden">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            任务拆解
          </h2>
        </div>
        <p className="text-[11px] text-stone-400 mb-5">
          {planContext?.stageName || "执行步骤与提示"}
        </p>

        {breakdownLoading ? (
          <div className="text-center py-12">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
            <p className="mt-3 text-xs text-stone-400">正在拆解任务...</p>
          </div>
        ) : breakdown ? (
          <div className="space-y-5">
            {/* Steps */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-3">
                <span>📋</span>
                <span>执行步骤</span>
              </div>
              <p className="text-[10px] text-stone-400 mb-2">点击步骤 → 左侧生成详细讲解与练习题</p>
              <div className="space-y-2.5">
                {breakdown.steps.map((step) => (
                  <button
                    key={step.order}
                    onClick={() => handleStepClick(step)}
                    disabled={chatLoading}
                    className="w-full text-left flex gap-3 rounded-xl border border-stone-100 bg-stone-50/50 p-3.5 hover:border-amber-200 hover:bg-amber-50/30 hover:shadow-sm transition-all group disabled:opacity-50"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-800 group-hover:bg-amber-600 text-[10px] font-medium text-white mt-0.5 transition-colors">
                      {step.order}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-stone-800 group-hover:text-amber-800 transition-colors">{step.title}</p>
                      <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">{step.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-stone-400">~{step.estimated_minutes} 分钟</span>
                        <span className="text-[10px] text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">点击展开 →</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tips */}
            {breakdown.tips && breakdown.tips.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-2">
                  <span>💡</span>
                  <span>小贴士</span>
                </div>
                <div className="pl-5 space-y-1.5">
                  {breakdown.tips.map((tip, i) => (
                    <p key={i} className="text-[11px] text-stone-600 leading-relaxed flex gap-1.5">
                      <span className="text-stone-300 shrink-0">•</span>
                      <span>{tip}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Resources */}
            {breakdown.resources && breakdown.resources.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-2">
                  <span>📚</span>
                  <span>推荐资源</span>
                </div>
                <div className="pl-5 space-y-1.5">
                  {breakdown.resources.map((res, i) => (
                    <p key={i} className="text-[11px] text-stone-600 leading-relaxed flex gap-1.5">
                      <span className="text-stone-300 shrink-0">→</span>
                      <span>{res}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-stone-300">
            <p className="text-2xl">🔧</p>
            <p className="mt-2 text-xs">拆解失败，可以直接问 AI</p>
          </div>
        )}
      </div>
    </div>
  );
}
