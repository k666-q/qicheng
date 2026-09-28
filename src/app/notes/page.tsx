"use client";

// 笔记本：全局笔记浏览页。
// 时间线浏览 + 按学科/节点筛选 + 关键词搜索 + 一键跳转回学习节点。
// 深色宇宙风格：星空背景 + 毛玻璃卡片 + 微光边框。

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { loadAllNotes, deleteNote, type MessageNote } from "@/lib/notes/message-notes";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { EmptyState } from "@/components/ui/EmptyState";

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return "今天";
  if (same(d, yesterday)) return "昨天";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<MessageNote[]>([]);
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

  useEffect(() => {
    setNotes(loadAllNotes());
  }, []);

  const subjects = useMemo(() => {
    const set = new Set(notes.map((n) => n.subjectName));
    return [...set].sort();
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => (subjectFilter ? n.subjectName === subjectFilter : true))
      .filter(
        (n) =>
          !q ||
          n.content.toLowerCase().includes(q) ||
          n.nodeName.toLowerCase().includes(q) ||
          n.subjectName.toLowerCase().includes(q)
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [notes, query, subjectFilter]);

  // 按天分组（时间线）
  const grouped = useMemo(() => {
    const groups: { label: string; items: MessageNote[] }[] = [];
    for (const note of filtered) {
      const label = dayLabel(note.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(note);
      } else {
        groups.push({ label, items: [note] });
      }
    }
    return groups;
  }, [filtered]);

  const handleDelete = (id: string) => {
    deleteNote(id);
    setNotes(loadAllNotes());
  };

  return (
    <div className="relative min-h-screen bg-[#050510] md:pl-[var(--siderail-width)] transition-[padding] duration-200">
      <CosmicBackground />
      <CyberOverlay />

      {/* 顶栏 */}
      <header className="sticky top-0 z-20 border-b border-cyan-400/15 bg-[#050510]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3.5">
          <button
            onClick={() => router.push("/universe")}
            title="返回星图"
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 transition-colors hover:bg-cyan-400/20"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="cyber-glitch text-sm font-semibold text-white/90" data-text="✦ 我的笔记本">✦ 我的笔记本</h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/40">neural_notes // memory_bank</p>
            <p className="text-[11px] text-white/35"><span className="cyber-neon text-cyan-300">{notes.length}</span> 条笔记 · 记录你的每一次探索</p>
          </div>
          <div className="flex-1" />
          {/* 搜索框 */}
          <div className="flex w-52 items-center border border-cyan-400/20 bg-white/[0.04] px-3 py-2 backdrop-blur-md focus-within:border-cyan-400/50 transition-colors max-sm:w-36">
            <svg className="h-3.5 w-3.5 shrink-0 text-white/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索笔记…"
              className="ml-2 w-full bg-transparent text-xs text-white/80 outline-none placeholder:text-white/25"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-white/30 hover:text-white/60">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 学科筛选 */}
        {subjects.length > 0 && (
          <div className="mx-auto flex max-w-3xl items-center gap-1.5 overflow-x-auto px-5 pb-3 scrollbar-cosmic">
            <button
              onClick={() => setSubjectFilter(null)}
              className={`shrink-0 border px-3 py-1 font-mono text-[11px] tracking-wider transition-all ${
                subjectFilter === null
                  ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                  : "border-cyan-400/15 bg-white/[0.03] text-white/45 hover:bg-cyan-400/10 hover:text-cyan-200/80"
              }`}
            >
              全部
            </button>
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => setSubjectFilter(subjectFilter === s ? null : s)}
                className={`shrink-0 border px-3 py-1 font-mono text-[11px] tracking-wider transition-all ${
                  subjectFilter === s
                    ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                    : "border-cyan-400/15 bg-white/[0.03] text-white/45 hover:bg-cyan-400/10 hover:text-cyan-200/80"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* 时间线内容 */}
      <main className="relative z-10 mx-auto max-w-3xl px-5 py-6 pb-6">
        {grouped.length === 0 && (
          notes.length === 0 ? (
            <EmptyState
              icon="✏️"
              title="还没有笔记"
              description="在学习页探索知识时，随手将关键内容摘录到笔记。你的所有笔记都会汇聚到这里。"
              actionLabel="去星图开始探索"
              actionHref="/universe"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <p className="text-sm text-white/45">没有匹配的笔记，换个关键词试试</p>
            </div>
          )
        )}

        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.label}>
              {/* 时间线日期标记 */}
              <div className="mb-3 flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                <h2 className="font-mono text-[12px] font-medium tracking-wider text-cyan-200/70">{group.label}</h2>
                <div className="cyber-dataline h-px flex-1" />
              </div>

              <div className="space-y-3 pl-4 border-l border-cyan-400/[0.12] ml-[2.5px]">
                {group.items.map((note) => (
                  <article
                    key={note.id}
                    className={`group relative cyber-panel cyber-corner p-4 transition-all ${
                      note.kind === "ai_summary"
                        ? "shadow-[0_0_18px_rgba(232,121,249,0.07)]"
                        : note.kind === "excerpt"
                          ? "shadow-[0_0_15px_rgba(251,191,36,0.05)]"
                          : "shadow-[0_0_15px_rgba(34,211,238,0.05)]"
                    }`}
                  >
                    {note.kind === "ai_summary" ? (
                      <div className="prose-chat text-sm leading-relaxed text-white/80">
                        <ReactMarkdown>{note.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                        {note.content}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {note.kind === "ai_summary" && (
                        <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-px text-[9px] text-violet-300">
                          ✦ AI 整理
                        </span>
                      )}
                      {note.kind === "excerpt" && (
                        <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-px text-[9px] text-amber-300/80">
                          摘录
                        </span>
                      )}
                      <button
                        onClick={() => router.push(`/universe/learn?node=${encodeURIComponent(note.nodeId)}&from=${encodeURIComponent("/notes")}`)}
                        title={`回到「${note.nodeName}」继续学习`}
                        className="flex items-center gap-1 border border-cyan-400/20 bg-white/[0.04] px-2 py-px font-mono text-[10px] text-white/50 transition-all hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-300"
                      >
                        <span className="h-1 w-1 rounded-full bg-cyan-400/70" />
                        {note.subjectName} · {note.nodeName} →
                      </button>
                      <span className="font-mono text-[10px] text-cyan-300/30">
                        {new Date(note.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <button
                        onClick={() => handleDelete(note.id)}
                        title="删除这条笔记"
                        className="ml-auto rounded p-1 text-white/0 transition-colors hover:bg-white/10 hover:text-white/60 group-hover:text-white/25"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

    </div>
  );
}
