"use client";

// 逐行深潜卡：推导/代码一行行推进，懂了才放行下一行。
// - 行内检查点（预测/留空/反事实）答对才解锁
// - 「没懂」→ 就这一行请求 AI 展开更细的解释（递归下潜）
// - 进度实时上报给父级持久化

import { useState } from "react";
import type { DeriveSequence, DeriveLine } from "@/lib/learn/depth-types";

const KIND_LABEL: Record<DeriveSequence["kind"], string> = {
  derivation: "公式推导",
  code: "代码逐行",
  logic: "逻辑链",
};

const CHECK_KIND_LABEL = {
  predict: "预测一下",
  blank: "补全关键",
  counterfactual: "反事实拷问",
} as const;

type Props = {
  sequence: DeriveSequence;
  /** 恢复进度：已解锁到第几行（0-based） */
  initialCurrent?: number;
  initialStuck?: number;
  /** 进度变化（父级持久化） */
  onProgress: (current: number, stuckCount: number, done: boolean) => void;
  /** 「没懂」→ 请求 AI 就这一行展开，返回解释文本 */
  onExpandLine: (line: DeriveLine, lineIndex: number) => Promise<string | null>;
  onClose: () => void;
};

export function DeriveCard({ sequence, initialCurrent = 0, initialStuck = 0, onProgress, onExpandLine, onClose }: Props) {
  const [current, setCurrent] = useState(Math.min(initialCurrent, sequence.lines.length));
  const [stuckCount, setStuckCount] = useState(initialStuck);
  // 当前行的检查状态
  const [picked, setPicked] = useState<number | null>(null);
  const [checkPassed, setCheckPassed] = useState(false);
  const [wrongOnce, setWrongOnce] = useState(false);
  // 「没懂」展开的解释：lineIndex → text
  const [expansions, setExpansions] = useState<Record<number, string>>({});
  const [expandingIdx, setExpandingIdx] = useState<number | null>(null);

  const total = sequence.lines.length;
  const done = current >= total;
  const currentLine = done ? null : sequence.lines[current];
  const needCheck = !!currentLine?.check && !checkPassed;

  function advance() {
    const next = current + 1;
    setCurrent(next);
    setPicked(null);
    setCheckPassed(false);
    setWrongOnce(false);
    onProgress(next, stuckCount, next >= total);
  }

  function handlePick(idx: number) {
    if (!currentLine?.check || checkPassed) return;
    setPicked(idx);
    if (idx === currentLine.check.answer) {
      setCheckPassed(true);
    } else {
      setWrongOnce(true);
    }
  }

  async function handleExpand(lineIndex: number) {
    if (expandingIdx !== null) return;
    setExpandingIdx(lineIndex);
    const newStuck = stuckCount + 1;
    setStuckCount(newStuck);
    onProgress(current, newStuck, false);
    const text = await onExpandLine(sequence.lines[lineIndex], lineIndex);
    setExpansions((prev) => ({ ...prev, [lineIndex]: text || "展开失败，可以在下方聊天框直接问我。" }));
    setExpandingIdx(null);
  }

  const isCode = sequence.kind === "code";

  function renderLine(line: DeriveLine, idx: number, state: "revealed" | "current") {
    return (
      <div
        key={idx}
        className={`border p-3 transition-all ${
          state === "current"
            ? "border-cyan-400/40 bg-cyan-400/[0.05] shadow-[0_0_16px_rgba(34,211,238,0.12)]"
            : "border-white/[0.08] bg-white/[0.02]"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[10px] ${
              state === "current"
                ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                : "border-white/15 text-white/40"
            }`}
          >
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <pre
              className={`whitespace-pre-wrap break-words text-[13px] leading-relaxed ${
                isCode ? "font-mono text-emerald-100/90" : "text-white/90"
              }`}
            >
              {line.content}
            </pre>
            <p className={`mt-1.5 text-xs leading-relaxed ${state === "current" ? "text-white/65" : "text-white/45"}`}>
              {line.explain}
            </p>
            {line.rule && (
              <span className="mt-1.5 inline-block border border-indigo-400/25 bg-indigo-400/[0.06] px-1.5 py-px font-mono text-[10px] tracking-wider text-indigo-300/80">
                依据 · {line.rule}
              </span>
            )}
            {/* 递归展开的解释 */}
            {expansions[idx] && (
              <div className="mt-2 border-l-2 border-fuchsia-400/40 bg-fuchsia-400/[0.04] p-2.5">
                <p className="font-mono text-[9px] tracking-widest text-fuchsia-300/60 mb-1">再挖一层</p>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/70">{expansions[idx]}</p>
              </div>
            )}
            {expandingIdx === idx && (
              <p className="cyber-cursor mt-2 font-mono text-[11px] text-fuchsia-300/50">正在就这一行展开...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-panel cyber-corner flex max-h-full flex-col p-5">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/60">
            DEEP DIVE // {KIND_LABEL[sequence.kind]}
          </p>
          <h3 className="mt-1 text-base font-semibold text-white/90">{sequence.title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[11px] text-cyan-300/70">
            {Math.min(current, total)}/{total} 行
          </span>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">✕</button>
        </div>
      </div>
      {/* 行进度条 */}
      <div className="mt-2 h-0.5 w-full bg-white/[0.06]">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all duration-500"
          style={{ width: `${(Math.min(current, total) / Math.max(total, 1)) * 100}%` }}
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/55">{sequence.intro}</p>

      {/* 行序列 */}
      <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
        {sequence.lines.slice(0, current).map((line, idx) => renderLine(line, idx, "revealed"))}
        {currentLine && renderLine(currentLine, current, "current")}

        {/* 当前行的检查点 */}
        {currentLine?.check && (
          <div className="border border-fuchsia-400/30 bg-fuchsia-400/[0.04] p-3.5">
            <p className="font-mono text-[10px] tracking-widest text-fuchsia-300/80">
              ⚑ {CHECK_KIND_LABEL[currentLine.check.kind]}
            </p>
            <p className="mt-1.5 text-sm text-white/85">{currentLine.check.question}</p>
            <div className="mt-2.5 space-y-1.5">
              {currentLine.check.options.map((opt, i) => {
                const isPicked = picked === i;
                const isAnswer = i === currentLine.check!.answer;
                const showState = checkPassed || (isPicked && !isAnswer);
                return (
                  <button
                    key={i}
                    onClick={() => handlePick(i)}
                    disabled={checkPassed}
                    className={`block w-full border px-3 py-2 text-left text-xs transition-all ${
                      showState && isAnswer && checkPassed
                        ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                        : showState && isPicked && !isAnswer
                          ? "border-red-400/50 bg-red-400/10 text-red-200"
                          : "border-white/12 bg-white/[0.03] text-white/70 hover:border-cyan-400/30 hover:bg-cyan-400/[0.05]"
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-60 mr-1.5">{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {/* 答错引导（不给答案） */}
            {wrongOnce && !checkPassed && (
              <p className="mt-2 border-l-2 border-amber-400/50 pl-2.5 text-[11px] leading-relaxed text-amber-200/80">
                {currentLine.check.hint}
              </p>
            )}
            {/* 答对解析 */}
            {checkPassed && (
              <p className="mt-2 border-l-2 border-emerald-400/50 pl-2.5 text-[11px] leading-relaxed text-white/60">
                {currentLine.check.why}
              </p>
            )}
          </div>
        )}

        {/* 完成态 */}
        {done && (
          <div className="border border-cyan-400/30 bg-cyan-400/[0.05] p-4 text-center">
            <p className="text-sm text-cyan-200">✦ 深潜完成 — {total} 行全部推完</p>
            <p className="mt-1 text-[11px] text-white/45">
              {stuckCount > 0 ? `途中你在 ${stuckCount} 处停下来深挖过，这是真正在学的证据。` : "一路推到底，非常干净。"}
            </p>
          </div>
        )}
      </div>

      {/* 底部操作 */}
      {!done && currentLine && (
        <div className="mt-4 flex items-center gap-2 border-t border-cyan-400/[0.1] pt-3.5">
          <button
            onClick={advance}
            disabled={needCheck}
            title={needCheck ? "先通过上面的检查再继续" : undefined}
            className="flex-1 border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 font-mono text-xs tracking-widest text-cyan-200 transition-all hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {current === total - 1 ? "懂了，完成深潜 ✦" : "懂了，下一行 →"}
          </button>
          <button
            onClick={() => handleExpand(current)}
            disabled={expandingIdx !== null}
            className="border border-fuchsia-400/30 bg-fuchsia-400/[0.06] px-4 py-2.5 font-mono text-xs tracking-widest text-fuchsia-300/90 transition-all hover:bg-fuchsia-400/15 disabled:opacity-40"
          >
            没懂，再挖一层
          </button>
        </div>
      )}
      {done && (
        <button
          onClick={onClose}
          className="mt-4 w-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 font-mono text-xs tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-all"
        >
          返回任务 →
        </button>
      )}
    </div>
  );
}
