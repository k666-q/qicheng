"use client";

// 消息式笔记面板：像发消息一样记笔记，零 Markdown 门槛。
// 深色宇宙风格：毛玻璃卡片 + 微光边框。

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  loadAllNotes,
  getNotesForNode,
  addNote,
  deleteNote,
  replaceNodeNotesWithSummary,
  type MessageNote,
} from "@/lib/notes/message-notes";
import {
  hasNotesDirectory,
  pickNotesDirectory,
  restoreNotesDirectory,
} from "@/lib/notes/fs-provider";

type Props = {
  subjectName: string;
  nodeName: string;
  nodeId: string;
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function MessageNotePanel({ subjectName, nodeName, nodeId }: Props) {
  const [notes, setNotes] = useState<MessageNote[]>([]);
  const [input, setInput] = useState("");
  const [organizing, setOrganizing] = useState(false);
  const [summaryPreview, setSummaryPreview] = useState<string | null>(null);
  const [hasDir, setHasDir] = useState(true); // 默认 true 避免闪烁
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotes(getNotesForNode(nodeId));
    restoreNotesDirectory().then((ok) => setHasDir(ok || hasNotesDirectory()));
  }, [nodeId]);

  // 其他组件（如卡片摘录）添加笔记后刷新
  useEffect(() => {
    const onUpdate = () => setNotes(getNotesForNode(nodeId));
    window.addEventListener("qc-notes-updated", onUpdate);
    return () => window.removeEventListener("qc-notes-updated", onUpdate);
  }, [nodeId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [notes.length, summaryPreview]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    addNote({ content: text, nodeId, nodeName, subjectName });
    setInput("");
    setNotes(getNotesForNode(nodeId));
  }, [input, nodeId, nodeName, subjectName]);

  const handleDelete = useCallback((id: string) => {
    deleteNote(id);
    setNotes(getNotesForNode(nodeId));
  }, [nodeId]);

  // AI 一键整理：碎片 → 结构化整理稿（先预览，再选择替换或另存）
  const handleOrganize = useCallback(async () => {
    if (organizing) return;
    const fragments = getNotesForNode(nodeId).filter((n) => n.kind !== "ai_summary");
    if (fragments.length === 0) return;
    setOrganizing(true);
    try {
      const combined = fragments
        .map((n) => (n.kind === "excerpt" ? `[摘录] ${n.content}` : n.content))
        .join("\n");
      const res = await fetch("/api/format-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: combined, nodeName }),
      });
      const data = await res.json();
      if (data.formatted) setSummaryPreview(data.formatted);
    } catch { /* ignore */ }
    setOrganizing(false);
  }, [organizing, nodeId, nodeName]);

  const applySummary = useCallback((mode: "replace" | "append") => {
    if (!summaryPreview) return;
    if (mode === "replace") {
      replaceNodeNotesWithSummary(nodeId, {
        content: summaryPreview,
        nodeId,
        nodeName,
        subjectName,
      });
    } else {
      addNote({ content: summaryPreview, nodeId, nodeName, subjectName, kind: "ai_summary" });
    }
    setSummaryPreview(null);
    setNotes(getNotesForNode(nodeId));
  }, [summaryPreview, nodeId, nodeName, subjectName]);

  const fragmentCount = notes.filter((n) => n.kind !== "ai_summary").length;

  return (
    <div className="flex h-full flex-col">
      {/* 笔记流 */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-cosmic">
        {notes.length === 0 && !summaryPreview && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="text-2xl opacity-30">✏️</div>
            <p className="text-[12px] text-white/35">灵感随手记，像发消息一样</p>
            <p className="text-[11px] text-white/20">在下方输入，回车即记录 · 也可以在左侧卡片上点「摘录」</p>
          </div>
        )}

        {notes.map((note) => (
          <div
            key={note.id}
            className={`group relative rounded-2xl border px-3.5 py-2.5 backdrop-blur-md transition-all ${
              note.kind === "ai_summary"
                ? "border-violet-400/20 bg-violet-500/[0.06] shadow-[0_0_18px_rgba(139,92,246,0.08)]"
                : note.kind === "excerpt"
                  ? "border-amber-400/15 bg-amber-500/[0.04]"
                  : "border-white/[0.07] bg-white/[0.04] shadow-[0_0_15px_rgba(100,150,255,0.05)]"
            }`}
          >
            {note.kind === "ai_summary" ? (
              <div className="prose-chat text-[12.5px] leading-relaxed text-white/80">
                <ReactMarkdown>{note.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-white/80">
                {note.content}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              {note.kind === "ai_summary" && (
                <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-1.5 py-px text-[9px] text-violet-300">
                  ✦ AI 整理
                </span>
              )}
              {note.kind === "excerpt" && (
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-1.5 py-px text-[9px] text-amber-300/80">
                  摘录
                </span>
              )}
              <span className="text-[10px] text-white/25">{formatTime(note.createdAt)}</span>
              <button
                onClick={() => handleDelete(note.id)}
                title="删除这条笔记"
                className="ml-auto rounded p-0.5 text-white/0 transition-colors hover:bg-white/10 hover:text-white/60 group-hover:text-white/30"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {/* AI 整理预览卡 */}
        {summaryPreview && (
          <div className="rounded-2xl border border-violet-400/30 bg-[#12101f]/90 p-4 shadow-[0_0_25px_rgba(139,92,246,0.15)] backdrop-blur-xl animate-slide-up">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-violet-300">
              ✦ AI 帮你整理好了，怎么处理？
            </p>
            <div className="prose-chat max-h-64 overflow-y-auto scrollbar-cosmic text-[12.5px] leading-relaxed text-white/80">
              <ReactMarkdown>{summaryPreview}</ReactMarkdown>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => applySummary("replace")}
                className="flex-1 rounded-lg bg-violet-500/25 px-3 py-1.5 text-[11px] font-medium text-violet-200 transition-colors hover:bg-violet-500/40"
              >
                替换原笔记
              </button>
              <button
                onClick={() => applySummary("append")}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 transition-colors hover:bg-white/10"
              >
                保存为新版本
              </button>
              <button
                onClick={() => setSummaryPreview(null)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/40 transition-colors hover:bg-white/5"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-2 border-t border-white/5 px-3 pt-2.5">
        <button
          onClick={handleOrganize}
          disabled={organizing || fragmentCount === 0}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors ${
            organizing
              ? "border border-violet-400/30 bg-violet-500/20 text-violet-300"
              : "border border-white/10 bg-white/5 text-white/50 hover:border-violet-400/20 hover:bg-violet-500/10 hover:text-violet-300 disabled:opacity-30"
          }`}
        >
          {organizing ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
              整理中…
            </>
          ) : (
            <>✦ AI 帮我整理</>
          )}
        </button>
        <span className="text-[10px] text-white/25">{fragmentCount} 条碎片</span>
        <div className="flex-1" />
        {!hasDir && (
          <button
            onClick={async () => setHasDir(await pickNotesDirectory())}
            title="选择一个本地文件夹，笔记会同步备份为可读文本"
            className="rounded px-2 py-1 text-[10px] text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
          >
            备份到本地目录
          </button>
        )}
      </div>

      {/* 输入区：像发消息一样 */}
      <div className="px-3 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2 rounded-xl border border-white/10 bg-[#0a0a12]/80 p-1.5 focus-within:border-amber-400/30 transition-colors"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="记点什么…（回车发送，Shift+回车换行）"
            rows={Math.min(4, Math.max(1, input.split("\n").length))}
            className="flex-1 resize-none bg-transparent px-2.5 py-1.5 text-[12px] leading-relaxed text-white/85 placeholder:text-white/25 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-500/35 disabled:opacity-30"
          >
            记录
          </button>
        </form>
      </div>
    </div>
  );
}
