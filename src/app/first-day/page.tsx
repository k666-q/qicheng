"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatBubbleGroup } from "@/components/onboarding/ChatBubble";
import { saveMilestone } from "@/lib/milestones/store";
import { trackEvent } from "@/lib/profile/events";

type ChatMessage = { role: "ai" | "user"; content: string };

export default function FirstDayPage() {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [goal, setGoal] = useState("");
  const [domain, setDomain] = useState("");
  const [completed, setCompleted] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const draftStr = sessionStorage.getItem("qicheng_draft") || localStorage.getItem("qicheng_draft_backup");
    if (!draftStr) {
      router.replace("/plan");
      return;
    }

    const draft = JSON.parse(draftStr);
    const g = draft.goal || "学习新技能";
    const d = draft.domain || "general_learning";
    setGoal(g);
    setDomain(d);

    sendToAI("我准备好了，今天我想做点什么", [], g, d);
  }, [router]);

  const sendToAI = useCallback(async (userMsg: string, history: ChatMessage[], g: string, d: string) => {
    setLoading(true);
    setStreamingText("");

    const newMessages: ChatMessage[] = [...history, { role: "user", content: userMsg }];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/first-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: g,
          domain: d,
          userMessage: userMsg,
          history: newMessages,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages([...newMessages, { role: "ai", content: "出了点问题，请重试。" }]);
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

    setLoading(false);
  }, []);

  function handleSend() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    sendToAI(msg, messages, goal, domain);
  }

  function handleComplete() {
    setCompleted(true);

    const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content);
    const resultMsg = userMessages.length > 1 ? userMessages[userMessages.length - 1] : userMessages[0];

    saveMilestone("first_action", "完成了第一天的行动", resultMsg || "第一天体验完成", {
      user_quote: resultMsg,
      stage: 1,
      context: { goal, domain },
    });

    saveMilestone("first_result", "拿到了第一个成果", `在「${goal}」的第一天，迈出了第一步`, {
      stage: 1,
      context: { goal, domain, messages_count: messages.length },
    });

    trackEvent("task_completed", { title_plain: "第一天体验", domain });
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-stone-50 via-white to-stone-50/80">
      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        <header className="border-b border-stone-100/80 px-6 py-4 backdrop-blur-sm bg-white/70">
          <button
            onClick={() => router.push("/plan")}
            className="text-xs text-stone-400 hover:text-stone-600 mb-2 flex items-center gap-1 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回计划
          </button>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-stone-900 flex items-center justify-center text-white text-[10px] font-bold">D1</div>
            <div>
              <h1 className="text-sm font-semibold text-stone-800">第一天 · 从今天开始</h1>
              <p className="text-[11px] text-stone-400">
                做完一件小事，你就已经开始了
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.map((msg, i) => (
            <ChatBubbleGroup key={i} role={msg.role} content={msg.content} />
          ))}

          {streamingText && (
            <div className="space-y-1.5">
              {streamingText.split("|||SPLIT|||").map((part, i, arr) => (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-stone-100 text-stone-800 whitespace-pre-wrap">
                    {part.trim()}
                    {i === arr.length - 1 && (
                      <span className="inline-flex items-center ml-1.5 gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && !streamingText && (
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

        <div className="border-t border-stone-100 px-6 py-4">
          {completed ? (
            <div className="text-center">
              <p className="text-sm text-stone-600 mb-3">
                第一天完成 ✓ 这个记录已经保存了。
              </p>
              <button
                onClick={() => router.push("/plan")}
                className="rounded-lg bg-stone-800 px-6 py-3 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
              >
                回到我的计划
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="说说你做了什么..."
                  disabled={loading}
                  className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
                >
                  发送
                </button>
              </form>
              {messages.length >= 4 && (
                <button
                  onClick={handleComplete}
                  className="mt-3 w-full rounded-lg border border-stone-200 px-4 py-2 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
                >
                  我今天完成了，记录这一刻
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: motivation panel */}
      <div className="w-[320px] border-l border-stone-200 bg-white px-6 py-6 max-lg:hidden overflow-y-auto">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">今天的意义</h2>

        <div className="space-y-4">
          <div className="rounded-lg bg-stone-50 p-4">
            <p className="text-xs font-medium text-stone-500 mb-1">⚡ 物质层面</p>
            <p className="text-sm text-stone-700">做完一件事，手上多一个"东西"——一段代码、一条记录、一张截图。</p>
          </div>

          <div className="rounded-lg bg-stone-50 p-4">
            <p className="text-xs font-medium text-stone-500 mb-1">🤝 社交层面</p>
            <p className="text-sm text-stone-700">给一个人看。不需要解释，就说"我开始了"。一旦有人知道，放弃的成本就高了。</p>
          </div>

          <div className="rounded-lg bg-stone-50 p-4">
            <p className="text-xs font-medium text-stone-500 mb-1">📖 叙事层面</p>
            <p className="text-sm text-stone-700">今天是你故事的第一页。4 周后你会回来看这个记录，然后说："当初连这都不会。"</p>
          </div>
        </div>

        <div className="mt-6 p-4 border border-stone-100 rounded-lg">
          <p className="text-xs text-stone-400 italic leading-relaxed">
            "伟大都以渺小启程。<br />今天不需要完美，只需要开始。"
          </p>
        </div>
      </div>
    </div>
  );
}
