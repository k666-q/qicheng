"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLACEHOLDERS = [
  "比如：我想学视频剪辑，做出第一条vlog",
  "比如：我想用Python做数据分析",
  "比如：我想从零开始学画画",
  "比如：我想做一个自己的小产品",
  "比如：我想系统学一下投资理财",
];

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [placeholderIdx] = useState(() => Math.floor(Math.random() * PLACEHOLDERS.length));
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    const encoded = encodeURIComponent(input.trim());
    router.push(`/onboarding?q=${encoded}`);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-white to-stone-50" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-stone-100/50 to-transparent blur-3xl" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-xl px-6 text-center">
        {/* Logo mark */}
        <div className="animate-fade-in">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-stone-900 text-white text-lg font-bold mb-8 shadow-lg shadow-stone-900/10">
            启
          </div>
        </div>

        {/* Headline */}
        <h1 className="animate-slide-up text-4xl font-bold tracking-tight text-stone-900 text-balance">
          把想法变成行动
        </h1>
        <p className="mt-4 text-lg text-stone-500 animate-slide-up [animation-delay:100ms] opacity-0">
          告诉我你想做什么，我帮你把它变成一份清晰的计划
        </p>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-12 animate-slide-up [animation-delay:200ms] opacity-0">
          <div className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={PLACEHOLDERS[placeholderIdx]}
              className="w-full rounded-xl border border-stone-200 bg-white px-5 py-4 text-base text-stone-800 shadow-sm shadow-stone-100 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all duration-200 group-hover:border-stone-300 group-hover:shadow-md"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    进入中
                  </span>
                ) : "开始"}
              </button>
            </div>
          </div>
        </form>

        {/* Philosophy hint */}
        <p className="mt-16 text-xs text-stone-400 animate-breathe">
          伟大都以渺小启程
        </p>
      </div>
    </main>
  );
}
