"use client";

import { useState } from "react";

const SUBJECTS = [
  { name: "编程", color: "from-cyan-400/20 to-cyan-400/5 border-cyan-400/25 text-cyan-300" },
  { name: "数据科学", color: "from-blue-400/20 to-blue-400/5 border-blue-400/25 text-blue-300" },
  { name: "数学", color: "from-indigo-400/20 to-indigo-400/5 border-indigo-400/25 text-indigo-300" },
  { name: "物理", color: "from-violet-400/20 to-violet-400/5 border-violet-400/25 text-violet-300" },
  { name: "经济学", color: "from-emerald-400/20 to-emerald-400/5 border-emerald-400/25 text-emerald-300" },
  { name: "心理学", color: "from-pink-400/20 to-pink-400/5 border-pink-400/25 text-pink-300" },
  { name: "英语", color: "from-amber-400/20 to-amber-400/5 border-amber-400/25 text-amber-300" },
  { name: "化学", color: "from-lime-400/20 to-lime-400/5 border-lime-400/25 text-lime-300" },
  { name: "生物", color: "from-green-400/20 to-green-400/5 border-green-400/25 text-green-300" },
  { name: "天文学", color: "from-purple-400/20 to-purple-400/5 border-purple-400/25 text-purple-300" },
  { name: "设计", color: "from-rose-400/20 to-rose-400/5 border-rose-400/25 text-rose-300" },
  { name: "人工智能", color: "from-cyan-400/20 to-cyan-400/5 border-cyan-400/25 text-cyan-300" },
  { name: "哲学", color: "from-slate-400/20 to-slate-400/5 border-slate-400/25 text-slate-300" },
  { name: "金融", color: "from-yellow-400/20 to-yellow-400/5 border-yellow-400/25 text-yellow-300" },
  { name: "法学", color: "from-red-400/20 to-red-400/5 border-red-400/25 text-red-300" },
  { name: "医学", color: "from-teal-400/20 to-teal-400/5 border-teal-400/25 text-teal-300" },
  { name: "历史", color: "from-orange-400/20 to-orange-400/5 border-orange-400/25 text-orange-300" },
  { name: "文学", color: "from-fuchsia-400/20 to-fuchsia-400/5 border-fuchsia-400/25 text-fuchsia-300" },
  { name: "音乐", color: "from-pink-400/20 to-pink-400/5 border-pink-400/25 text-pink-300" },
  { name: "建筑", color: "from-stone-400/20 to-stone-400/5 border-stone-400/25 text-stone-300" },
  { name: "管理", color: "from-sky-400/20 to-sky-400/5 border-sky-400/25 text-sky-300" },
  { name: "营销", color: "from-amber-400/20 to-amber-400/5 border-amber-400/25 text-amber-300" },
  { name: "电气工程", color: "from-blue-400/20 to-blue-400/5 border-blue-400/25 text-blue-300" },
  { name: "机械工程", color: "from-zinc-400/20 to-zinc-400/5 border-zinc-400/25 text-zinc-300" },
  { name: "社会学", color: "from-violet-400/20 to-violet-400/5 border-violet-400/25 text-violet-300" },
  { name: "教育学", color: "from-emerald-400/20 to-emerald-400/5 border-emerald-400/25 text-emerald-300" },
  { name: "政治学", color: "from-red-400/20 to-red-400/5 border-red-400/25 text-red-300" },
  { name: "地理", color: "from-lime-400/20 to-lime-400/5 border-lime-400/25 text-lime-300" },
  { name: "环境科学", color: "from-green-400/20 to-green-400/5 border-green-400/25 text-green-300" },
  { name: "传媒", color: "from-orange-400/20 to-orange-400/5 border-orange-400/25 text-orange-300" },
  { name: "语言学", color: "from-indigo-400/20 to-indigo-400/5 border-indigo-400/25 text-indigo-300" },
  { name: "艺术", color: "from-rose-400/20 to-rose-400/5 border-rose-400/25 text-rose-300" },
  { name: "体育科学", color: "from-cyan-400/20 to-cyan-400/5 border-cyan-400/25 text-cyan-300" },
];

export function SubjectCloud() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex flex-wrap justify-center gap-2.5 max-w-4xl mx-auto">
      {SUBJECTS.map((s, i) => (
        <div
          key={s.name}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className={`px-4 py-2 rounded-xl border bg-gradient-to-br text-xs font-medium tracking-wider cursor-default transition-all duration-300 ${s.color} ${
            hovered === i
              ? "scale-110 shadow-[0_0_20px_rgba(34,211,238,0.15)] -translate-y-0.5"
              : hovered !== null
                ? "opacity-40 scale-95"
                : "opacity-80"
          }`}
          style={{ animationDelay: `${i * 30}ms` }}
        >
          {s.name}
        </div>
      ))}
    </div>
  );
}
