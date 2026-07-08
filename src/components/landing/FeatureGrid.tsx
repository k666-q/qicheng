"use client";

import { useState } from "react";

const FEATURES = [
  {
    icon: "\u{1F9E0}",
    title: "刺激式学习引擎",
    desc: "30+ 种心理学刺激机制组合——预测、对抗、限时记忆、猎人规律、认知欠条——让你忘记自己在学习。",
    accent: "border-cyan-400/20 hover:border-cyan-400/40 hover:shadow-[0_0_25px_rgba(34,211,238,0.08)]",
  },
  {
    icon: "\u{1F4CA}",
    title: "布鲁姆六层深度",
    desc: "从记忆到创造，每个知识点按 6 层认知目标分层教学，AI 根据你的掌握程度自动推进。",
    accent: "border-indigo-400/20 hover:border-indigo-400/40 hover:shadow-[0_0_25px_rgba(99,102,241,0.08)]",
  },
  {
    icon: "\u{1F680}",
    title: "AI 学习规划",
    desc: "告诉 AI 你的目标，它帮你拆解成阶段和任务，生成专属的学习路线和知识宇宙。",
    accent: "border-violet-400/20 hover:border-violet-400/40 hover:shadow-[0_0_25px_rgba(139,92,246,0.08)]",
  },
  {
    icon: "\u{1F30C}",
    title: "知识宇宙星图",
    desc: "33 个学科、400+ 知识节点构成的 3D 星图。学完一个知识点，就点亮一颗星。",
    accent: "border-blue-400/20 hover:border-blue-400/40 hover:shadow-[0_0_25px_rgba(59,130,246,0.08)]",
  },
  {
    icon: "\u{1F3AC}",
    title: "Manim 动态可视化",
    desc: "AI 实时生成数学动画——让抽象概念在你眼前动起来。",
    accent: "border-emerald-400/20 hover:border-emerald-400/40 hover:shadow-[0_0_25px_rgba(52,211,153,0.08)]",
  },
  {
    icon: "\u{1F4DD}",
    title: "学习笔记 & 卡片",
    desc: "一键摘录、AI 整理、阶段成就卡——你的学习过程自动沉淀为知识资产。",
    accent: "border-amber-400/20 hover:border-amber-400/40 hover:shadow-[0_0_25px_rgba(251,191,36,0.08)]",
  },
];

export function FeatureGrid() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {FEATURES.map((f, i) => (
        <div
          key={f.title}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className={`group relative rounded-2xl border bg-[#0c0c18]/80 backdrop-blur-md p-6 transition-all duration-500 ${f.accent} ${
            hovered === i ? "-translate-y-1" : ""
          }`}
        >
          <div className="text-3xl mb-4">{f.icon}</div>
          <h3 className="text-sm font-bold text-white/90 tracking-wide mb-2">{f.title}</h3>
          <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
          {/* corner decoration */}
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden rounded-tr-2xl pointer-events-none">
            <div className="absolute top-0 right-0 w-px h-8 bg-gradient-to-b from-white/10 to-transparent" />
            <div className="absolute top-0 right-0 h-px w-8 bg-gradient-to-l from-white/10 to-transparent" />
          </div>
        </div>
      ))}
    </div>
  );
}
