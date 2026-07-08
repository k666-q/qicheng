"use client";

// 星核探索的交互卡片库：每种刺激对应一种卡片形态。
// 阻塞型卡片（预测/测验/闪存/空白/总结）完成交互后调用 onComplete，页面才允许继续推进。

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Segment } from "@/lib/stimulus/types";

function Md({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div
      className={`text-[14px] leading-relaxed text-white/80 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-white [&_em]:text-indigo-200 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-400/40 [&_blockquote]:pl-3 [&_blockquote]:text-white/60 ${className}`}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

function CardShell({
  children,
  accent = "border-white/10",
  className = "",
}: {
  children: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={`animate-slide-up rounded-2xl border ${accent} bg-[#13131d]/90 backdrop-blur-xl p-5 shadow-xl shadow-black/30 ${className}`}
    >
      {children}
    </div>
  );
}

function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wider ${className}`}>
      {children}
    </span>
  );
}

/* ---------- 开场钩子 ---------- */
export function HookCard({ seg }: { seg: Segment }) {
  return (
    <CardShell accent="border-indigo-400/30" className="bg-gradient-to-br from-indigo-950/80 to-[#13131d]/90">
      <Tag className="bg-indigo-500/20 text-indigo-300 mb-3">✦ 探索开始</Tag>
      <Md content={seg.content} className="text-[16px] [&_p]:text-white/90 font-medium" />
    </CardShell>
  );
}

/* ---------- 讲解段（半答案：在悬念处停） ---------- */
export function TeachCard({ seg }: { seg: Segment }) {
  return (
    <CardShell>
      <Md content={seg.content} />
    </CardShell>
  );
}

/* ---------- 预测卡：先猜后讲 ---------- */
export function PredictCard({ seg, onComplete, initialCompleted = false }: { seg: Segment; onComplete: () => void; initialCompleted?: boolean }) {
  const [picked, setPicked] = useState<string | null>(initialCompleted ? (seg.answer || "A") : null);
  const revealed = picked !== null;
  const correct = revealed && picked === seg.answer;

  function pick(label: string) {
    if (revealed) return;
    setPicked(label);
    onComplete();
  }

  return (
    <CardShell accent="border-purple-400/30">
      <Tag className="bg-purple-500/20 text-purple-300 mb-3">🔮 先猜，再揭晓</Tag>
      {seg.question && <p className="text-[15px] font-medium text-white/90 mb-3">{seg.question}</p>}
      {seg.content && <Md content={seg.content} className="mb-3" />}
      <div className="space-y-2">
        {(seg.options || []).map((opt) => {
          const isPicked = picked === opt.label;
          const isAnswer = revealed && opt.label === seg.answer;
          return (
            <button
              key={opt.label}
              onClick={() => pick(opt.label)}
              disabled={revealed}
              className={`w-full text-left rounded-xl border px-4 py-2.5 text-[13px] transition-all ${
                isAnswer
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                  : isPicked
                    ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
                    : revealed
                      ? "border-white/5 bg-white/[0.02] text-white/30"
                      : "border-white/10 bg-white/5 text-white/75 hover:border-purple-400/40 hover:bg-purple-500/10"
              }`}
            >
              <span className="mr-2 font-semibold">{opt.label}</span>
              {opt.text}
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="mt-3 animate-slide-up rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <p className={`text-[12px] font-medium mb-1 ${correct ? "text-emerald-300" : "text-amber-300"}`}>
            {correct ? "猜中了——你的直觉已经在工作" : "猜错了，正好。预测失败 = 学习开始"}
          </p>
          {seg.why && <Md content={seg.why} className="text-[13px]" />}
        </div>
      )}
    </CardShell>
  );
}

/* ---------- 闪存卡（缺失刺激）：限时显示后封存 ---------- */
export function FlashCard({ seg, onComplete, initialSealed = false }: { seg: Segment; onComplete: () => void; initialSealed?: boolean }) {
  const total = seg.flashSeconds || 20;
  const [left, setLeft] = useState(initialSealed ? 0 : total);
  const [sealed, setSealed] = useState(initialSealed);
  const doneRef = useRef(initialSealed);

  useEffect(() => {
    if (sealed) return;
    const timer = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(timer);
          setSealed(true);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [sealed]);

  // 封存后通知父组件（独立 effect 避免在 setState 更新器内触发父级状态更新）
  useEffect(() => {
    if (sealed && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  }, [sealed, onComplete]);

  function sealNow() {
    if (sealed) return;
    setSealed(true);
  }

  const pct = (left / total) * 100;

  return (
    <CardShell accent={sealed ? "border-white/10" : "border-amber-400/40"}>
      <div className="flex items-center justify-between mb-3">
        <Tag className="bg-amber-500/20 text-amber-300">⚡ 记住它——它马上会消失</Tag>
        {!sealed && (
          <span className="text-[11px] font-mono text-amber-300/90 tabular-nums">{left}s</span>
        )}
      </div>
      {!sealed ? (
        <>
          <div className="h-1 rounded-full bg-white/10 mb-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <Md content={seg.content} className="text-[15px] [&_p]:text-amber-100" />
          <button
            onClick={sealNow}
            className="mt-4 w-full rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-200 hover:bg-amber-500/20 transition-colors"
          >
            记住了，提前封存 →
          </button>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center">
          <p className="text-[13px] text-white/40">🔒 已封存。它会在你意想不到的时刻回来。</p>
        </div>
      )}
    </CardShell>
  );
}

/* ---------- 空白卡：点击揭示 ---------- */
export function BlankCard({ seg, onComplete, initialCompleted = false }: { seg: Segment; onComplete: () => void; initialCompleted?: boolean }) {
  const [revealed, setRevealed] = useState(initialCompleted);

  function reveal() {
    if (revealed) return;
    setRevealed(true);
    onComplete();
  }

  return (
    <CardShell accent="border-sky-400/30">
      <Tag className="bg-sky-500/20 text-sky-300 mb-3">▢ 这里有一步空白</Tag>
      {seg.stem && <Md content={seg.stem} className="mb-3" />}
      {!revealed ? (
        <button
          onClick={reveal}
          className="w-full rounded-xl border border-sky-400/30 bg-sky-500/5 px-4 py-5 text-[13px] text-sky-200/80 hover:bg-sky-500/15 transition-colors"
        >
          先在心里想想这一步是什么，然后点击揭示
        </button>
      ) : (
        <div className="animate-slide-up rounded-xl bg-sky-500/10 border border-sky-400/30 px-4 py-3">
          <Md content={seg.hidden || ""} className="[&_p]:text-sky-100" />
        </div>
      )}
    </CardShell>
  );
}

/* ---------- 挑战题（对抗 + 错误纠正 + 差一点） ---------- */
export function QuizCard({ seg, onComplete, initialCompleted = false }: { seg: Segment; onComplete: (firstTryCorrect: boolean) => void; initialCompleted?: boolean }) {
  const [attempts, setAttempts] = useState<string[]>(initialCompleted ? [seg.answer || "A"] : []);
  const [solved, setSolved] = useState(initialCompleted);
  const failed = !solved && attempts.length >= 2;
  const finished = solved || failed;

  function pick(label: string) {
    if (finished) return;
    const next = [...attempts, label];
    setAttempts(next);
    if (label === seg.answer) {
      setSolved(true);
      onComplete(next.length === 1);
    } else if (next.length >= 2) {
      onComplete(false);
    }
  }

  const showHint = !solved && attempts.length === 1 && !!seg.hint;

  return (
    <CardShell accent="border-rose-400/30">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <Tag className="bg-rose-500/20 text-rose-300">⚔️ 挑战</Tag>
        {seg.taunt && <span className="text-[11px] text-rose-300/80 italic">{seg.taunt}</span>}
      </div>
      {seg.question && <p className="text-[15px] font-medium text-white/90 mb-3">{seg.question}</p>}
      {seg.content && <Md content={seg.content} className="mb-3" />}
      <div className="space-y-2">
        {(seg.options || []).map((opt) => {
          const wasTried = attempts.includes(opt.label);
          const isAnswer = opt.label === seg.answer;
          const showAsCorrect = finished && isAnswer;
          const showAsWrong = wasTried && !isAnswer;
          return (
            <button
              key={opt.label}
              onClick={() => pick(opt.label)}
              disabled={finished || wasTried}
              className={`w-full text-left rounded-xl border px-4 py-2.5 text-[13px] transition-all ${
                showAsCorrect
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                  : showAsWrong
                    ? "border-rose-400/40 bg-rose-500/10 text-rose-300/70 line-through"
                    : finished
                      ? "border-white/5 bg-white/[0.02] text-white/30"
                      : "border-white/10 bg-white/5 text-white/75 hover:border-rose-400/40 hover:bg-rose-500/10"
              }`}
            >
              <span className="mr-2 font-semibold">{opt.label}</span>
              {opt.text}
            </button>
          );
        })}
      </div>
      {showHint && (
        <div className="mt-3 animate-slide-up rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
          <p className="text-[11px] font-medium text-amber-300 mb-1">差一点。先别看答案——想想：</p>
          <p className="text-[13px] text-amber-100/90">{seg.hint}</p>
        </div>
      )}
      {finished && (
        <div className="mt-3 animate-slide-up rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <p className={`text-[12px] font-medium mb-1 ${solved ? "text-emerald-300" : "text-white/50"}`}>
            {solved && attempts.length === 1
              ? "一次命中。你已经甩开了那群会犯错的人"
              : solved
                ? "纠正成功——从错误里学到的，记得最牢"
                : "这道题的坑你现在踩过了，下次它骗不到你"}
          </p>
          {seg.why && <Md content={seg.why} className="text-[13px]" />}
        </div>
      )}
    </CardShell>
  );
}

/* ---------- 猎人刺激：捕获一条规律 ---------- */
export function HuntCard({ seg }: { seg: Segment }) {
  return (
    <div className="animate-slide-up rounded-xl border border-emerald-400/30 bg-gradient-to-r from-emerald-950/60 to-[#13131d]/80 px-4 py-3 flex items-start gap-3">
      <span className="text-lg leading-none mt-0.5">🎯</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-emerald-300 tracking-wider">
          关键规律已捕获 {seg.huntIndex ? `· ${seg.huntIndex}` : ""}
        </p>
        <Md content={seg.content} className="mt-1 text-[13px] [&_p]:text-emerald-100/90" />
      </div>
    </div>
  );
}

/* ---------- 时间炸弹引爆：回忆闪存内容 ---------- */
export function RecallCard({
  seg,
  flashContent,
  onComplete,
  initialCompleted = false,
}: {
  seg: Segment;
  flashContent?: string;
  onComplete: () => void;
  initialCompleted?: boolean;
}) {
  const [revealed, setRevealed] = useState(initialCompleted);

  function reveal() {
    if (revealed) return;
    setRevealed(true);
    onComplete();
  }

  return (
    <CardShell accent="border-orange-400/40">
      <Tag className="bg-orange-500/20 text-orange-300 mb-3">💣 时间炸弹引爆</Tag>
      <Md content={seg.content} className="text-[15px] [&_p]:text-white/90 mb-3" />
      {!revealed ? (
        <button
          onClick={reveal}
          className="w-full rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-[13px] text-orange-200 hover:bg-orange-500/20 transition-colors"
        >
          在心里默背出来，再点击对照
        </button>
      ) : (
        <div className="animate-slide-up rounded-xl bg-orange-500/10 border border-orange-400/30 px-4 py-3">
          <p className="text-[11px] text-orange-300/80 mb-1.5">刚才封存的内容：</p>
          <Md content={flashContent || "（以你刚才记住的为准）"} className="[&_p]:text-orange-100" />
        </div>
      )}
    </CardShell>
  );
}

/* ---------- 自我总结 / 造物主输入 ---------- */
export function InputCard({
  seg,
  mode,
  onSubmit,
  disabled,
  initialSubmitted,
}: {
  seg: Segment;
  mode: "summary" | "create";
  onSubmit: (text: string) => void;
  disabled?: boolean;
  /** 会话恢复时已提交过，不允许重复提交 */
  initialSubmitted?: boolean;
}) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(initialSubmitted ?? false);

  function submit() {
    const t = text.trim();
    if (!t || submitted) return;
    setSubmitted(true);
    onSubmit(t);
  }

  const isCreate = mode === "create";

  return (
    <CardShell accent={isCreate ? "border-fuchsia-400/40" : "border-indigo-400/40"}>
      <Tag className={`mb-3 ${isCreate ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-indigo-500/20 text-indigo-300"}`}>
        {isCreate ? "👑 造物主时刻" : "✍️ 用你的话说"}
      </Tag>
      <Md content={seg.content} className="mb-3 text-[15px] [&_p]:text-white/90" />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitted || disabled}
        rows={isCreate ? 5 : 3}
        placeholder={isCreate ? "在这里设计你的题目，包括选项和你埋的坑…" : "不用完美，说出你理解的版本就行…"}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-white/85 placeholder:text-white/25 focus:outline-none focus:border-indigo-400/50 resize-none disabled:opacity-50"
      />
      {!submitted && (
        <button
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-[13px] font-medium text-white hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-30"
        >
          {isCreate ? "提交我的题目" : "就这么说"}
        </button>
      )}
      {submitted && <p className="mt-3 text-center text-[12px] text-white/35">已提交，引导者正在阅读…</p>}
    </CardShell>
  );
}

/* ---------- 反馈卡 ---------- */
export function FeedbackCard({ seg }: { seg: Segment }) {
  return (
    <CardShell accent="border-indigo-400/20">
      <Tag className="bg-indigo-500/20 text-indigo-300 mb-3">🪞 引导者的回应</Tag>
      <Md content={seg.content} />
    </CardShell>
  );
}

/* ---------- 成长收尾：获得思维 + 徽章 + 认知增益 ---------- */
export function GainCard({
  seg,
  cognitionGains,
  abilityPoints,
}: {
  seg: Segment;
  cognitionGains?: { name: string; color: string; gain: number }[];
  abilityPoints?: number;
}) {
  return (
    <CardShell
      accent="border-amber-400/40"
      className="bg-gradient-to-br from-amber-950/50 via-[#13131d]/90 to-[#13131d]/90 text-center"
    >
      <p className="text-[11px] tracking-[0.3em] text-amber-300/70 mb-3">YOU LEVELED UP</p>
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/30 to-orange-500/20 border border-amber-400/40 shadow-lg shadow-amber-500/20 animate-pulse-glow">
        <span className="text-2xl">🏅</span>
      </div>
      {seg.gainName && (
        <p className="text-lg font-semibold text-amber-200 mb-1">你刚获得：{seg.gainName}</p>
      )}
      <Md content={seg.content} className="mb-3 [&_p]:text-white/70" />
      {cognitionGains && cognitionGains.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
          {cognitionGains.map((g) => (
            <span
              key={g.name}
              className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
              style={{ borderColor: `${g.color}55`, color: g.color, background: `${g.color}15` }}
            >
              {g.name} +{g.gain}
            </span>
          ))}
        </div>
      )}
      {typeof abilityPoints === "number" && (
        <p className="text-[11px] text-white/35">能力点累计 {abilityPoints}</p>
      )}
    </CardShell>
  );
}

/* ---------- 巨人/文明彩蛋 ---------- */
export function GiantCard({ seg }: { seg: Segment }) {
  return (
    <CardShell accent="border-white/15" className="bg-gradient-to-br from-[#1a1a2e]/90 to-[#13131d]/90">
      <Tag className="bg-white/10 text-white/60 mb-3">📜 与巨人见面</Tag>
      <div className="border-l-2 border-white/20 pl-4">
        <Md content={seg.content} className="[&_p]:text-white/75 italic" />
      </div>
    </CardShell>
  );
}

/* ---------- 种子（多巴胺延迟） ---------- */
export function SeedCard({ seg }: { seg: Segment }) {
  return (
    <CardShell accent="border-lime-400/30">
      <Tag className="bg-lime-500/20 text-lime-300 mb-3">🌱 一颗种子</Tag>
      <Md content={seg.content} className="[&_p]:text-lime-100/85" />
      <p className="mt-3 text-[11px] text-white/35">先不要回答。三天后，它会以"回响"的形式回来找你。</p>
    </CardShell>
  );
}

/* ---------- 认知欠条 ---------- */
export function DebtCard({ seg }: { seg: Segment }) {
  return (
    <CardShell accent="border-red-400/30" className="bg-gradient-to-br from-red-950/40 to-[#13131d]/90">
      <Tag className="bg-red-500/20 text-red-300 mb-3">🧾 认知欠条</Tag>
      <Md content={seg.content} className="[&_p]:text-red-100/85" />
      <p className="mt-3 text-[11px] text-white/35">这笔债记在这颗星上了。两天后回响会来催你还。</p>
    </CardShell>
  );
}

export function CodeCard({ seg, onComplete }: { seg: Segment; onComplete?: () => void }) {
  const [revealedLines, setRevealedLines] = useState<Set<number>>(new Set());
  const lines = seg.codeLines || [];
  const allRevealed = revealedLines.size >= lines.length;

  useEffect(() => {
    if (allRevealed && onComplete) onComplete();
  }, [allRevealed, onComplete]);

  return (
    <CardShell accent="border-emerald-400/30" className="bg-gradient-to-br from-emerald-950/30 to-[#13131d]/90">
      <Tag className="bg-emerald-500/20 text-emerald-300 mb-3">
        {seg.codeLang ? `</> ${seg.codeLang}` : "</> 代码深潜"}
      </Tag>
      <div className="space-y-0.5 font-mono text-xs">
        {lines.map((l, idx) => {
          const revealed = revealedLines.has(idx);
          return (
            <div
              key={idx}
              className={`flex items-start gap-2 rounded px-2 py-1 transition-all cursor-pointer ${
                revealed
                  ? "bg-emerald-400/5 border-l-2 border-emerald-400/40"
                  : "bg-white/[0.02] border-l-2 border-white/10 hover:bg-white/[0.05]"
              }`}
              onClick={() => setRevealedLines((s) => new Set([...s, idx]))}
            >
              <span className="w-5 shrink-0 text-right text-white/25">{l.line}</span>
              <span className="text-cyan-200/90 whitespace-pre-wrap break-all">{l.code}</span>
              {revealed && l.comment && (
                <span className="ml-auto shrink-0 text-[10px] text-emerald-300/70 max-w-[40%] text-right">
                  {l.comment}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {!allRevealed && (
        <p className="mt-3 text-center text-[10px] text-white/30">
          点击每一行展开注释（{revealedLines.size}/{lines.length}）
        </p>
      )}
      {allRevealed && (
        <p className="mt-3 text-center text-[10px] text-emerald-300/50">全部展开 — 逐行理解完成</p>
      )}
    </CardShell>
  );
}

export function DeriveCard({ seg, onComplete }: { seg: Segment; onComplete?: () => void }) {
  const [revealedSteps, setRevealedSteps] = useState<Set<number>>(new Set());
  const steps = seg.deriveSteps || [];
  const allRevealed = revealedSteps.size >= steps.length;

  useEffect(() => {
    if (allRevealed && onComplete) onComplete();
  }, [allRevealed, onComplete]);

  return (
    <CardShell accent="border-violet-400/30" className="bg-gradient-to-br from-violet-950/30 to-[#13131d]/90">
      <Tag className="bg-violet-500/20 text-violet-300 mb-3">∫ 公式推导</Tag>
      <div className="space-y-2">
        {steps.map((s, idx) => {
          const revealed = revealedSteps.has(idx);
          return (
            <div
              key={idx}
              className={`rounded px-3 py-2 transition-all cursor-pointer ${
                revealed
                  ? "bg-violet-400/10 border border-violet-400/30"
                  : "bg-white/[0.02] border border-white/10 hover:bg-white/[0.05]"
              }`}
              onClick={() => setRevealedSteps((prev) => new Set([...prev, idx]))}
            >
              <p className="text-xs text-white/80 font-medium">Step {idx + 1}: {s.step}</p>
              {revealed && (
                <>
                  <p className="mt-1 text-sm text-violet-200 font-mono">{s.formula}</p>
                  <p className="mt-1 text-[11px] text-violet-300/70">{s.why}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
      {!allRevealed && (
        <p className="mt-3 text-center text-[10px] text-white/30">
          点击展开每一步推导（{revealedSteps.size}/{steps.length}）
        </p>
      )}
    </CardShell>
  );
}

export function LayerDoneCard({ seg, onComplete }: { seg: Segment; onComplete?: () => void }) {
  const [claimed, setClaimed] = useState(false);
  return (
    <CardShell accent="border-amber-400/30" className="bg-gradient-to-br from-amber-950/30 to-[#13131d]/90">
      <Tag className="bg-amber-500/20 text-amber-300 mb-3">✓ 本层完成</Tag>
      <Md content={seg.content} className="[&_p]:text-amber-100/85" />
      {!claimed && (
        <button
          onClick={() => { setClaimed(true); onComplete?.(); }}
          className="mt-4 w-full border border-amber-400/40 bg-amber-400/10 px-3 py-2 font-mono text-xs tracking-widest text-amber-200 hover:bg-amber-400/20 transition-all"
        >
          确认完成，进入下一层
        </button>
      )}
      {claimed && (
        <p className="mt-3 text-center text-[10px] text-amber-300/60">已确认 — 层级进度已保存</p>
      )}
    </CardShell>
  );
}
