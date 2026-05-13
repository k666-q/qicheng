"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatBubble } from "@/components/onboarding/ChatBubble";
import { OptionButtons } from "@/components/onboarding/OptionButtons";
import type { ConversationMessage, DraftPlan } from "@/lib/onboarding/types";

const META_SEPARATOR = "|||META|||";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-stone-50 text-stone-400">加载中...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialInput = searchParams.get("q") || "";

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState<DraftPlan>({});
  const [currentOptions, setCurrentOptions] = useState<string[] | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  const sendToAI = useCallback(async (userMsg: string, history: ConversationMessage[], currentDraft: DraftPlan) => {
    setLoading(true);
    setCurrentOptions(null);
    setStreamingText("");

    const newMessages: ConversationMessage[] = [...history, { role: "user", content: userMsg }];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: userMsg,
          history: newMessages.map((m) => ({ role: m.role, content: m.content })),
          currentDraft: currentDraft,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages([...newMessages, { role: "ai", content: "抱歉，遇到了问题。能重新说一下吗？" }]);
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
          const payload = line.slice(6);

          try {
            const event = JSON.parse(payload);
            if (event.type === "text") {
              accumulated += event.content;
              const metaIdx = accumulated.indexOf(META_SEPARATOR);
              if (metaIdx === -1) {
                setStreamingText(accumulated);
              } else {
                setStreamingText(accumulated.slice(0, metaIdx).trim());
              }
            }
          } catch {
            // ignore parse errors for partial chunks
          }
        }
      }

      // Parse final result
      const metaIdx = accumulated.indexOf(META_SEPARATOR);
      let aiMessage = accumulated.trim();
      let options: string[] | null = null;
      let complete = false;
      let newDraft = currentDraft;

      if (metaIdx !== -1) {
        aiMessage = accumulated.slice(0, metaIdx).trim();
        const metaStr = accumulated.slice(metaIdx + META_SEPARATOR.length).trim();

        try {
          const meta = JSON.parse(metaStr);
          options = meta.options || null;
          complete = meta.is_complete || false;
          if (meta.draft_plan) {
            newDraft = meta.draft_plan;
          }
        } catch {
          // meta parse failed, use message as-is
        }
      }

      setStreamingText("");
      setMessages([...newMessages, { role: "ai", content: aiMessage, options }]);
      setCurrentOptions(options);
      setDraft(newDraft);

      if (complete) {
        setIsComplete(true);
        sessionStorage.setItem("qicheng_draft", JSON.stringify(newDraft));
        const summary = newMessages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("; ");
        sessionStorage.setItem("qicheng_summary", summary);
      }
    } catch {
      setStreamingText("");
      setMessages([...newMessages, { role: "ai", content: "网络出了点问题，请稍后再试。" }]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialized.current || !initialInput) return;
    initialized.current = true;
    sendToAI(initialInput, [], {});
  }, [initialInput, sendToAI]);

  function handleSend(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading || isComplete) return;
    setInput("");
    sendToAI(msg, messages, draft);
  }

  if (!initialInput) {
    router.replace("/");
    return null;
  }

  return (
    <div className="flex h-screen bg-stone-50">
      {/* Left: Chat */}
      <div className="flex flex-1 flex-col border-r border-stone-200">
        <div className="border-b border-stone-100 px-6 py-4">
          <h1 className="text-lg font-semibold text-stone-800">启程 · 引导对话</h1>
          <p className="text-xs text-stone-400 mt-0.5">
            {isComplete ? "引导完成 ✓" : "对话进行中..."}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} />
          ))}

          {/* Streaming AI message */}
          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-stone-100 text-stone-800">
                {streamingText}
                <span className="inline-block w-1 h-4 ml-0.5 bg-stone-400 animate-pulse" />
              </div>
            </div>
          )}

          {loading && !streamingText && (
            <div className="flex justify-start">
              <div className="bg-stone-100 rounded-2xl px-4 py-2.5 text-sm text-stone-400 animate-pulse">
                正在思考...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="border-t border-stone-100 px-6 py-4">
          {isComplete ? (
            <button
              onClick={() => router.push("/plan")}
              className="w-full rounded-lg bg-stone-800 px-4 py-3 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
            >
              生成我的计划
            </button>
          ) : (
            <>
              {currentOptions && currentOptions.length > 0 && !loading && (
                <div className="mb-3">
                  <OptionButtons
                    options={currentOptions}
                    onSelect={(opt) => handleSend(opt)}
                    disabled={loading}
                  />
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={currentOptions ? "或者直接说..." : "输入你的想法..."}
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
            </>
          )}
        </div>
      </div>

      {/* Right: Live Draft Plan */}
      <div className="w-[400px] overflow-y-auto border-l border-stone-100 bg-white px-6 py-6 max-lg:hidden">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
          计划草图
        </h2>
        <p className="text-xs text-stone-400 mt-1 mb-5">
          随着对话推进，你的计划在这里逐渐成型
        </p>

        <div className="space-y-4">
          {draft.goal && (
            <DraftSection icon="🎯" title="目标">
              <p className="text-sm text-stone-800">{draft.goal}</p>
              {draft.domain && (
                <span className="mt-1 inline-block rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">
                  {draft.domain === "programming_app" ? "编程 / App" :
                   draft.domain === "visual_design" ? "视觉设计" :
                   draft.domain === "data_analysis" ? "数据分析" :
                   draft.domain === "product_business" ? "产品 / 副业" : draft.domain}
                </span>
              )}
            </DraftSection>
          )}

          {draft.starting_point && (
            <DraftSection icon="📍" title="起点">
              <p className="text-sm text-stone-800">{draft.starting_point}</p>
            </DraftSection>
          )}

          {(draft.time_budget || draft.rhythm) && (
            <DraftSection icon="⏰" title="节奏">
              {draft.time_budget && <p className="text-sm text-stone-800">{draft.time_budget}</p>}
              {draft.rhythm && <p className="text-xs text-stone-500 mt-1">{draft.rhythm}</p>}
            </DraftSection>
          )}

          {draft.stages && draft.stages.length > 0 && (
            <DraftSection icon="🗺️" title="阶段规划">
              <div className="space-y-2.5">
                {draft.stages.map((stage, i) => (
                  <div key={i} className="rounded-md border border-stone-100 bg-stone-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-stone-800">{stage.name}</span>
                      <span className="text-xs text-stone-400">{stage.duration}</span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600">{stage.outcome}</p>
                  </div>
                ))}
              </div>
            </DraftSection>
          )}

          {draft.first_week_focus && (
            <DraftSection icon="🚀" title="第一周重点">
              <p className="text-sm text-stone-800">{draft.first_week_focus}</p>
            </DraftSection>
          )}

          {draft.risk && (
            <DraftSection icon="⚠️" title="风险预警">
              <p className="text-sm text-stone-700">{draft.risk}</p>
            </DraftSection>
          )}

          {draft.motivation && (
            <DraftSection icon="💡" title="核心动力">
              <p className="text-sm text-stone-700">{draft.motivation}</p>
            </DraftSection>
          )}
        </div>

        {!draft.goal && !loading && (
          <div className="mt-10 text-center text-stone-300">
            <p className="text-3xl">📝</p>
            <p className="mt-2 text-sm">开始聊，草图会自动生长</p>
          </div>
        )}

        {isComplete && (
          <div className="mt-6 rounded-lg border-2 border-stone-800 bg-stone-800 p-4 text-center">
            <p className="text-sm font-medium text-white">草图已完成</p>
            <p className="mt-1 text-xs text-stone-300">点击左侧「生成我的计划」进入下一步</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DraftSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-500">
      <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-1.5">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  );
}
