"use client";

// 未来自我 / 存在刺激：低频出现的"低语"。
// 不推知识，只增加身份连接与方向感。每 3 天最多出现一次。

import { useEffect, useState } from "react";

const WHISPERS = [
  // 未来自我刺激
  "三年后的你，会感谢今天理解这些概念的你。",
  "未来那个更强版本的你，正在等这些节点一颗颗亮起。",
  "你现在点亮的每颗星，都是未来的你回头时的路标。",
  // 存在刺激
  "你最近一直在学很多东西。但你有没有想过：你真正想解决的问题是什么？",
  "你学会了很多技能。但哪些技能真正改变了你？",
  "如果今天是人生最后一年，你还会学习现在这些东西吗？",
];

const WHISPER_KEY = "qicheng_whisper_last";
const WHISPER_INTERVAL = 3 * 24 * 60 * 60 * 1000;

function shouldWhisper(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = parseInt(localStorage.getItem(WHISPER_KEY) || "0", 10);
    return Date.now() - last > WHISPER_INTERVAL;
  } catch {
    return false;
  }
}

export function FutureWhisper({ variant }: { variant: "dark" | "light" }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldWhisper()) return;
    const showTimer = setTimeout(() => {
      setText(WHISPERS[Math.floor(Math.random() * WHISPERS.length)]);
      localStorage.setItem(WHISPER_KEY, String(Date.now()));
    }, 25000); // 等用户沉浸一会儿再低语
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!text) return;
    const hideTimer = setTimeout(() => setText(null), 14000);
    return () => clearTimeout(hideTimer);
  }, [text]);

  if (!text) return null;

  const dark = variant === "dark";

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 animate-slide-up px-5 w-full max-w-[480px]">
      <div
        onClick={() => setText(null)}
        className={`cursor-pointer rounded-2xl border px-5 py-3.5 text-center shadow-2xl backdrop-blur-xl ${
          dark
            ? "border-indigo-400/20 bg-[#13131d]/90 text-indigo-100/90 shadow-indigo-950/50"
            : "border-indigo-100 bg-white/95 text-stone-600 shadow-indigo-100/50"
        }`}
      >
        <p className="text-[10px] tracking-[0.25em] mb-1.5 opacity-50">✦ 一句低语</p>
        <p className="text-[13px] leading-relaxed italic">{text}</p>
      </div>
    </div>
  );
}
