"use client";

// 锚点卡 HUD：学习全程常驻的微缩本质卡，点击展开四字段。

import { useState } from "react";
import type { AnchorCard } from "@/lib/learn/depth-types";

const FIELDS: { key: keyof Pick<AnchorCard, "essence" | "when" | "core" | "invariant">; label: string; color: string }[] = [
  { key: "essence", label: "本质", color: "text-cyan-300" },
  { key: "when", label: "何时用", color: "text-indigo-300" },
  { key: "core", label: "用时核心", color: "text-fuchsia-300" },
  { key: "invariant", label: "不可脱离", color: "text-amber-300" },
];

type Props = {
  anchor: AnchorCard;
  /** 默认展开（如锚点提取环节刚完成时） */
  defaultOpen?: boolean;
};

export function AnchorHUD({ anchor, defaultOpen }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="锚点卡：这个知识最不能脱离什么"
        className="cyber-panel flex items-center gap-2 px-3 py-2 text-left transition-all hover:border-amber-400/40"
      >
        <span className="text-amber-300">◈</span>
        <span className="max-w-[220px] truncate text-[11px] text-white/60">{anchor.essence}</span>
        <svg className="h-3 w-3 shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="cyber-panel cyber-corner w-[300px] max-w-[80vw] p-4 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.25em] text-amber-300/80">
          <span>◈</span> ANCHOR // 锚点卡
        </p>
        <button onClick={() => setOpen(false)} className="text-white/35 hover:text-white/70 transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
      <div className="cyber-dataline mt-2 mb-3 h-px" />
      <div className="space-y-2.5">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <p className={`font-mono text-[9px] tracking-[0.2em] ${f.color} opacity-70`}>{f.label}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/75">{anchor[f.key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
