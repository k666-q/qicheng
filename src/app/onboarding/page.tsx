"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatBubbleGroup } from "@/components/onboarding/ChatBubble";
import { OptionButtons } from "@/components/onboarding/OptionButtons";
import { saveMilestone } from "@/lib/milestones/store";
import { trackEvent } from "@/lib/profile/events";
import type { ConversationMessage, DraftPlan } from "@/lib/onboarding/types";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { upsertPlanFromMirror } from "@/lib/plan/plans-store";

const META_SEPARATOR = "|||META|||";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="cyber-cursor flex h-screen items-center justify-center bg-[#050510] font-mono text-cyan-300/50">加载中...</div>}>
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
  const [showModifyOptions, setShowModifyOptions] = useState(false);

  const [uploadedDoc, setUploadedDoc] = useState<{ filename: string; textContent: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

      // AI 标记完成 — 前端二次校验五要素
      const hasFiveEssentials = !!(
        newDraft.goal &&
        newDraft.starting_point &&
        (newDraft.time_budget || newDraft.rhythm) &&
        newDraft.stages && (newDraft.stages as unknown[]).length >= 2
      );
      if (complete && hasFiveEssentials) {
        setIsComplete(true);
        sessionStorage.setItem("qicheng_draft", JSON.stringify(newDraft));
        localStorage.setItem("qicheng_draft_backup", JSON.stringify(newDraft));
        const summary = newMessages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("; ");
        sessionStorage.setItem("qicheng_summary", summary);

        const firstUserMsg = newMessages.find((m) => m.role === "user")?.content || "";
        saveMilestone("first_words", "说出了想做的事", firstUserMsg, {
          user_quote: firstUserMsg,
          stage: 0,
          context: { goal: newDraft.goal, domain: newDraft.domain },
        });
        trackEvent("onboarding_complete", { goal: newDraft.goal, domain: newDraft.domain });
      }
    } catch {
      setStreamingText("");
      setMessages([...newMessages, { role: "ai", content: "网络出了点问题，请稍后再试。" }]);
    }

    setLoading(false);
  }, []);

  // 恢复上次未完成的草稿对话
  useEffect(() => {
    if (initialized.current) return;
    const savedSession = sessionStorage.getItem("qc_onboarding_session");
    if (savedSession && !initialInput) {
      try {
        const session = JSON.parse(savedSession);
        if (session.messages?.length > 0 && !session.isComplete) {
          setMessages(session.messages);
          setDraft(session.draft || {});
          setCurrentOptions(session.options || null);
          initialized.current = true;
          return;
        }
      } catch { /* ignore */ }
    }
    if (!initialInput) return;
    initialized.current = true;
    sendToAI(initialInput, [], {});
  }, [initialInput, sendToAI]);

  // 自动保存对话草稿
  useEffect(() => {
    if (messages.length === 0) return;
    sessionStorage.setItem("qc_onboarding_session", JSON.stringify({
      messages,
      draft,
      options: currentOptions,
      isComplete,
    }));
  }, [messages, draft, currentOptions, isComplete]);

  function handleSend(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading || isComplete) return;
    setInput("");

    let fullMsg = msg;
    if (uploadedDoc) {
      fullMsg = `[用户上传了文件: ${uploadedDoc.filename}，用户说明: ${msg}]\n\n以下是文件内容：\n${uploadedDoc.textContent}`;
      setUploadedDoc(null);
    }

    sendToAI(fullMsg, messages, draft);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload-doc", { method: "POST", body: formData });
      const data = await res.json();

      if (!data.success) {
        setMessages((prev) => [...prev, { role: "ai", content: `文件上传失败：${data.error}` }]);
      } else {
        setUploadedDoc({ filename: data.filename, textContent: data.textContent });
      }
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "文件上传出了问题，请重试。" }]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!initialInput) {
    router.replace("/");
    return null;
  }

  return (
    <div className="flex h-screen bg-[#050510]">
      <CosmicBackground />
      <CyberOverlay />
      {/* Left: Chat */}
      <div className="relative z-10 flex flex-1 flex-col">
        <div className="border-b border-cyan-400/15 px-6 py-4 backdrop-blur-xl bg-[#0a0a14]/60">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/plan")}
              title="返回计划档案馆"
              className="flex h-7 w-7 shrink-0 items-center justify-center border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 transition-all"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-7 h-7 border border-cyan-400/40 bg-cyan-400/10 flex items-center justify-center text-cyan-300 text-xs font-bold shadow-[0_0_12px_rgba(34,211,238,0.25)]">N</div>
            <div>
              <h1 className="cyber-glitch text-sm font-semibold text-white/90" data-text="引导对话">引导对话</h1>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/40">init_sequence // profile_setup</p>
              <p className="text-[11px] text-white/35">
                {isComplete ? "✓ 信息收集完成" : "聊聊你想做的事"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
          {messages.map((msg, i) => (
            <ChatBubbleGroup key={i} role={msg.role} content={msg.content} />
          ))}

          {/* Streaming AI message */}
          {streamingText && (
            <div className="space-y-2">
              {streamingText.split("|||SPLIT|||").map((part, i, arr) => (
                <div key={i} className="flex justify-start">
                  <div className="cyber-panel max-w-[80%] px-5 py-3 text-[15px] leading-relaxed backdrop-blur-xl text-white/85 whitespace-pre-wrap">
                    {part.trim()}
                    {i === arr.length - 1 && (
                      <span className="inline-flex items-center ml-1.5 gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce [animation-delay:300ms]" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && !streamingText && (
            <div className="flex justify-start">
              <div className="cyber-panel backdrop-blur-xl px-5 py-3 text-[15px] font-mono text-cyan-300/60 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="cyber-cursor">思考中...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
          {/* Extra bottom padding for floating input */}
          <div className="h-20" />
        </div>

        {/* Floating input area - positioned higher, not at bottom edge */}
        <div className="px-8 pb-12">
          <div className="cyber-panel cyber-corner bg-[#0d0d18]/90 backdrop-blur-xl shadow-xl shadow-black/40 p-4">
          {isComplete && !showModifyOptions ? (
            <div className="space-y-3">
              <p className="text-xs text-white/35 text-center">
                这是初步草图，生成后会为你精确布局每一步
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModifyOptions(true)}
                  className="flex-1 border border-fuchsia-400/25 bg-fuchsia-500/[0.06] px-4 py-3 text-sm font-medium text-fuchsia-100/70 hover:border-fuchsia-400/50 hover:bg-fuchsia-500/15 transition-all"
                >
                  我想调整一下
                </button>
                <button
                  onClick={() => {
                    upsertPlanFromMirror(); // 归档当前计划，避免被新计划覆盖丢失
                    router.push("/plan/detail?regenerate=1");
                  }}
                  className="flex-1 border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm font-medium font-mono text-cyan-200 hover:bg-cyan-400/20 transition-all shadow-[0_0_16px_rgba(34,211,238,0.15)]"
                >
                  直接生成计划
                </button>
              </div>
            </div>
          ) : isComplete && showModifyOptions ? (
            <div className="space-y-3">
              <p className="text-xs text-white/45">想调整哪部分？</p>
              <div className="flex flex-wrap gap-2">
                {getModifyOptions(draft).map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setIsComplete(false);
                      setShowModifyOptions(false);
                      sendToAI(opt, messages, draft);
                    }}
                    className="border border-cyan-400/25 bg-cyan-400/[0.05] px-3 py-1.5 font-mono text-xs text-cyan-100/70 hover:bg-cyan-400/15 hover:border-cyan-400/60 transition-all"
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  upsertPlanFromMirror();
                  router.push("/plan/detail?regenerate=1");
                }}
                className="w-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium font-mono text-cyan-200 hover:bg-cyan-400/20 transition-all shadow-[0_0_16px_rgba(34,211,238,0.15)]"
              >
                不改了，生成计划
              </button>
            </div>
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
              {uploadedDoc && (
                <div className="mb-2 flex items-center gap-2 font-mono text-xs text-cyan-200/60 border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="truncate">{uploadedDoc.filename} 已解析</span>
                  <button onClick={() => setUploadedDoc(null)} className="ml-auto text-cyan-300/40 hover:text-cyan-200">✕</button>
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.txt,.pdf,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || uploading || isComplete}
                  title="上传需求文档"
                  className="border border-cyan-400/20 bg-cyan-400/[0.03] p-2.5 text-cyan-300/40 hover:text-cyan-200 hover:border-cyan-400/50 transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <svg className="w-4.5 h-4.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  )}
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={currentOptions ? "或者直接说..." : "说说你想做什么..."}
                  disabled={loading}
                  className="flex-1 border border-cyan-400/20 bg-cyan-400/[0.03] px-3 py-2.5 text-[15px] text-white/85 placeholder:text-white/25 focus:border-cyan-400/50 focus:shadow-[0_0_16px_rgba(34,211,238,0.1)] focus:outline-none disabled:opacity-50 transition-all"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="border border-cyan-400/40 bg-cyan-400/10 px-5 py-2.5 text-sm font-medium font-mono text-cyan-200 hover:bg-cyan-400/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(34,211,238,0.15)]"
                >
                  发送
                </button>
              </form>
              {/* 一键生成按钮 — 信息不足时提示缺什么 */}
              {messages.filter(m => m.role === "user").length >= 2 && !loading && (() => {
                const missing: string[] = [];
                if (!draft.goal) missing.push("目标");
                if (!draft.starting_point) missing.push("当前水平");
                if (!draft.time_budget) missing.push("时间安排");
                const canGenerate = missing.length === 0;
                return (
                  <div className="mt-3 pt-3 border-t border-cyan-400/10">
                    <button
                      onClick={() => {
                        if (!canGenerate) return;
                        setIsComplete(true);
                        sessionStorage.setItem("qicheng_draft", JSON.stringify(draft));
                        localStorage.setItem("qicheng_draft_backup", JSON.stringify(draft));
                        trackEvent("onboarding_early_generate", { rounds: messages.filter(m => m.role === "user").length });
                      }}
                      disabled={!canGenerate}
                      className={`group w-full flex items-center justify-center gap-2 border px-4 py-2.5 font-mono text-sm transition-all ${
                        canGenerate
                          ? "border-cyan-400/25 bg-cyan-400/[0.05] text-cyan-100/70 hover:border-cyan-400/60 hover:bg-cyan-400/15 hover:text-cyan-50"
                          : "border-white/10 bg-white/[0.02] text-white/25 cursor-not-allowed"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${canGenerate ? "bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" : "bg-white/20"}`} />
                      <span>{canGenerate ? "直接生成计划" : `还需要了解：${missing.join("、")}`}</span>
                      {canGenerate && (
                        <svg className="w-3.5 h-3.5 text-cyan-300/40 group-hover:text-cyan-200 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })()}
            </>
          )}
          </div>
        </div>
      </div>

      {/* Right: Live Draft Plan */}
      <div className="relative z-10 w-[380px] overflow-y-auto border-l border-cyan-400/15 bg-[#0a0a14]/50 backdrop-blur-xl px-6 py-6 max-lg:hidden">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
          <h2 className="cyber-neon font-mono text-xs font-semibold text-cyan-300/80 uppercase tracking-wider">
            实时草图
          </h2>
        </div>
        <p className="text-[11px] text-white/35 mb-4">
          你说的每句话都在变成计划
        </p>
        <div className="cyber-dataline mb-5" />

        <div className="space-y-4">
          {draft.goal && (
            <DraftSection icon="🎯" title="目标">
              <p className="text-sm text-white/85">{draft.goal}</p>
              {draft.domain && (
                <span className="mt-1 inline-block border border-cyan-400/25 bg-cyan-400/[0.05] px-2.5 py-0.5 font-mono text-xs text-cyan-200/70">
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
              <p className="text-sm text-white/85">{draft.starting_point}</p>
            </DraftSection>
          )}

          {(draft.time_budget || draft.rhythm) && (
            <DraftSection icon="⏰" title="节奏">
              {draft.time_budget && <p className="text-sm text-white/85">{draft.time_budget}</p>}
              {draft.rhythm && <p className="text-xs text-white/45 mt-1">{draft.rhythm}</p>}
            </DraftSection>
          )}

          {draft.stages && draft.stages.length > 0 && (
            <DraftSection icon="🗺️" title="阶段规划">
              <div className="space-y-2.5">
                {draft.stages.map((stage, i) => (
                  <div key={i} className="cyber-panel p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white/85">{stage.name}</span>
                      <span className="text-xs text-white/35">{stage.duration}</span>
                    </div>
                    <p className="mt-1 text-xs text-white/55">{stage.outcome}</p>
                  </div>
                ))}
              </div>
            </DraftSection>
          )}

          {draft.first_week_focus && (
            <DraftSection icon="🚀" title="第一周重点">
              <p className="text-sm text-white/85">{draft.first_week_focus}</p>
            </DraftSection>
          )}

          {draft.risk && (
            <DraftSection icon="⚠️" title="风险预警">
              <p className="text-sm text-white/75">{draft.risk}</p>
            </DraftSection>
          )}

          {draft.motivation && (
            <DraftSection icon="💡" title="核心动力">
              <p className="text-sm text-white/75">{draft.motivation}</p>
            </DraftSection>
          )}
        </div>

        {!draft.goal && !loading && (
          <div className="mt-10 text-center text-white/25">
            <p className="text-3xl">📝</p>
            <p className="mt-2 text-sm">开始聊，草图会自动生长</p>
          </div>
        )}

        {isComplete && (
          <div className="cyber-panel cyber-corner mt-6 p-4 text-center">
            <p className="cyber-neon text-sm font-medium text-cyan-100">草图已完成</p>
            <p className="mt-1 text-xs text-white/50">点击左侧「生成我的计划」进入下一步</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getModifyOptions(draft: DraftPlan): string[] {
  const options: string[] = [];

  if (draft.stages && draft.stages.length > 0) {
    options.push("调整阶段安排");
  }
  if (draft.time_budget) {
    options.push("时间其实没那么多");
    options.push("时间可以更多一点");
  } else {
    options.push("补充一下我的时间安排");
  }
  if (draft.goal) {
    options.push("目标想再聚焦一些");
  }
  if (!draft.starting_point) {
    options.push("说说我现在的基础");
  }
  if (draft.stages && draft.stages.length > 0) {
    options.push("第一周任务想换个方向");
  }
  options.push("其他想法");

  return options.slice(0, 5);
}

function DraftSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-500">
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/45 mb-1.5">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  );
}
