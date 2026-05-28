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

    // Find next task from plan
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

  async function sendChat() {
    if (!input.trim() || chatLoading || !task || !planContext) return;
    const msg = input.trim();
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

  if (!task) return null;

  const DIFFICULTY_LABELS: Record<number, string> = { 1: "轻松", 2: "简单", 3: "适中", 4: "挑战", 5: "硬核" };

  return (
    <div className="flex h-screen bg-stone-50">
      {/* Left: Task breakdown */}
      <div className="flex-1 overflow-y-auto border-r border-stone-200">
        <header className="border-b border-stone-100 px-6 py-4">
          <button
            onClick={() => router.back()}
            className="text-xs text-stone-400 hover:text-stone-600 mb-2 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回计划
          </button>
          <h1 className="text-lg font-semibold text-stone-800">{task.title_plain}</h1>
          <p className="text-xs text-stone-400 mt-1">{task.title_professional}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-stone-500">~{task.estimated_minutes} 分钟</span>
            <span className="text-xs text-stone-500">难度：{DIFFICULTY_LABELS[task.difficulty] || "适中"}</span>
            {planContext && <span className="text-xs text-stone-400">{planContext.stageName}</span>}
          </div>
        </header>

        <div className="px-6 py-6">
          {breakdownLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
              <p className="mt-3 text-sm text-stone-500">正在拆解任务...</p>
            </div>
          ) : breakdown ? (
            <div className="space-y-6">
              {/* Steps */}
              <div>
                <h2 className="text-sm font-semibold text-stone-700 mb-3">执行步骤</h2>
                <div className="space-y-3">
                  {breakdown.steps.map((step) => (
                    <div key={step.order} className="flex gap-3 rounded-lg border border-stone-100 p-4 hover:border-stone-200 transition-colors">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[11px] font-medium text-white">
                        {step.order}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-stone-800">{step.title}</p>
                        <p className="text-xs text-stone-500 mt-1 leading-relaxed">{step.description}</p>
                        <span className="inline-block mt-1.5 text-[11px] text-stone-400">~{step.estimated_minutes} 分钟</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              {breakdown.tips && breakdown.tips.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-stone-700 mb-2">💡 小贴士</h2>
                  <ul className="space-y-1.5">
                    {breakdown.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-stone-600 flex gap-2">
                        <span className="text-stone-400">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resources */}
              {breakdown.resources && breakdown.resources.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-stone-700 mb-2">📚 推荐资源</h2>
                  <ul className="space-y-1.5">
                    {breakdown.resources.map((res, i) => (
                      <li key={i} className="text-xs text-stone-600 flex gap-2">
                        <span className="text-stone-400">→</span>
                        {res}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-500">拆解失败，可以在右侧直接问我。</p>
          )}
        </div>

        {/* Task completion + soft upgrade */}
        <div className="border-t border-stone-100 px-6 py-4">
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
              className="w-full rounded-lg bg-stone-800 px-4 py-3 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
            >
              ✓ 完成这个任务
            </button>
          ) : (
            <div>
              <p className="text-sm text-emerald-700 font-medium">完成了 ✓</p>
              <SoftUpgrade
                nextTaskName={nextTask?.title_plain}
                nextTaskMinutes={nextTask?.estimated_minutes}
                onAccept={() => {
                  if (nextTask && planContext) {
                    sessionStorage.setItem("qicheng_current_task", JSON.stringify(nextTask));
                    window.location.reload();
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Mood check-in at bottom */}
        <div className="border-t border-stone-100 px-6 py-3">
          <MoodCheckin />
        </div>
      </div>

      {/* Right: AI Chat */}
      <div className="w-[420px] flex flex-col max-lg:hidden">
        <div className="border-b border-stone-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-stone-700">AI 助手</h2>
          <p className="text-[11px] text-stone-400 mt-0.5">有什么不清楚的，随时问我</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 && !streamingText && !chatLoading && (
            <div className="text-center py-8">
              <p className="text-xs text-stone-400 mb-3">你可以问我：</p>
              <div className="space-y-1.5">
                {["这一步具体怎么开始？", "有什么好的学习资源？", "我卡住了，能给个提示吗？"].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="block w-full text-left rounded-lg border border-stone-100 px-3 py-2 text-xs text-stone-600 hover:bg-stone-50 hover:border-stone-200 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatBubbleGroup key={i} role={msg.role} content={msg.content} />
          ))}

          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-stone-100 text-stone-800 whitespace-pre-wrap">
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
              <div className="bg-stone-100 rounded-2xl px-4 py-2.5 text-sm text-stone-400 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                思考中...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Resource results */}
        {resourceResults.length > 0 && (
          <div className="border-t border-stone-100 px-5 py-3 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-stone-500">📚 推荐资源</p>
              <button onClick={() => setResourceResults([])} className="text-xs text-stone-400 hover:text-stone-600">✕</button>
            </div>
            <div className="space-y-2">
              {resourceResults.map((r, i) => (
                <div key={i} className="rounded-lg border border-stone-100 p-2.5">
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
        )}

        <div className="border-t border-stone-100 px-5 py-3">
          <div className="flex gap-2 mb-2">
            <button
              onClick={searchResource}
              disabled={searchingResource || chatLoading}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] text-stone-500 hover:text-stone-700 hover:border-stone-300 transition-colors disabled:opacity-50"
            >
              {searchingResource ? "搜索中..." : "🔍 搜索学习资源"}
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="问问这个任务怎么做..."
              disabled={chatLoading}
              className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={chatLoading || !input.trim()}
              className="rounded-lg bg-stone-800 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              发送
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
