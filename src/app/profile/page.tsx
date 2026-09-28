"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getEvents, getEventsByType } from "@/lib/profile/events";
import { getStreak } from "@/lib/habit/streak";
import { getCompletedCount } from "@/lib/plan/completion";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { CyberCore } from "@/components/profile/CyberCore";

type ProfileItem = {
  key: string;
  label: string;
  code: string;
  value: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileItem[]>([]);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [stats, setStats] = useState({ completed: 0, streak: 0, moodTrend: "" });
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    buildProfile();
    const timer = setTimeout(() => setScanned(true), 150);
    return () => clearTimeout(timer);
  }, []);

  function buildProfile() {
    const savedCorrections = JSON.parse(localStorage.getItem("qicheng_corrections") || "{}");
    setCorrections(savedCorrections);

    const draft = JSON.parse(sessionStorage.getItem("qicheng_draft") || localStorage.getItem("qicheng_draft_backup") || "{}");
    const events = getEvents();
    const completedTasks = getEventsByType("task_completed");
    const moodEvents = getEventsByType("emotion_checkin");

    const items: ProfileItem[] = [
      {
        key: "goal",
        label: "我想做什么",
        code: "TARGET",
        value: savedCorrections.goal || draft.goal || null,
      },
      {
        key: "starting_point",
        label: "我从哪里开始",
        code: "ORIGIN",
        value: savedCorrections.starting_point || draft.starting_point || null,
      },
      {
        key: "struggle",
        label: "我最容易卡在哪里",
        code: "BOTTLENECK",
        value: savedCorrections.struggle || inferStruggle(events) || null,
      },
      {
        key: "task_capacity",
        label: "我每天适合多大任务",
        code: "CAPACITY",
        value: savedCorrections.task_capacity || inferCapacity(events) || null,
      },
      {
        key: "recent",
        label: "我最近完成了什么",
        code: "RECENT_LOG",
        value: completedTasks.length > 0
          ? (completedTasks[completedTasks.length - 1].event_data.title_plain as string) || `共完成 ${completedTasks.length} 个任务`
          : null,
      },
    ];

    setProfile(items);

    const recentMoods = moodEvents.slice(-7);
    let moodTrend = "暂无数据";
    if (recentMoods.length >= 3) {
      const moodScores: Record<string, number> = { struggling: 1, okay: 2, good: 3, great: 4 };
      const avg = recentMoods.reduce((sum, e) => sum + (moodScores[e.event_data.mood as string] || 2), 0) / recentMoods.length;
      moodTrend = avg >= 3 ? "状态不错" : avg >= 2 ? "比较平稳" : "有些吃力";
    }

    setStats({
      completed: getCompletedCount(),
      streak: getStreak().count,
      moodTrend,
    });
  }

  function inferStruggle(events: { event_type: string; event_data: Record<string, unknown> }[]): string | null {
    const helpEvents = events.filter((e) => e.event_type === "task_help_requested");
    const completedCount = getCompletedCount();
    if (completedCount < 3) return "数据积累中，继续学习后会自动更新";
    if (helpEvents.length === 0) return "目前独立性很强，很少需要额外帮助";
    const ratio = helpEvents.length / Math.max(completedCount, 1);
    if (ratio > 0.5) return "学习中经常需要引导，建议多利用逐行深潜功能";
    if (ratio > 0.2) return "偶尔遇到困难点，整体节奏不错";
    return "独立完成率很高，可以尝试更高难度的内容";
  }

  function inferCapacity(events: { event_type: string; event_data: Record<string, unknown> }[]): string | null {
    const tierEvents = events.filter((e) => e.event_type === "task_tier_selected");
    if (tierEvents.length < 3) return "还在摸索中";
    const tiers = tierEvents.slice(-5).map((e) => e.event_data.tier as string);
    const lightCount = tiers.filter((t) => t === "light").length;
    if (lightCount >= 3) return "适合短平快（15分钟左右）";
    const intenseCount = tiers.filter((t) => t === "intense").length;
    if (intenseCount >= 3) return "精力充沛，可以挑战长任务";
    return "30分钟左右比较合适";
  }


  function startEdit(key: string, currentValue: string | null) {
    setEditingKey(key);
    setEditValue(currentValue || "");
  }

  function saveCorrection() {
    if (!editingKey) return;
    const newCorrections = { ...corrections, [editingKey]: editValue };
    setCorrections(newCorrections);
    localStorage.setItem("qicheng_corrections", JSON.stringify(newCorrections));
    setEditingKey(null);
    setEditValue("");
    buildProfile();
  }

  const statBlocks = [
    { label: "完成任务", code: "TASKS", value: String(stats.completed), accent: "text-cyan-300" },
    { label: "连续天数", code: "STREAK", value: String(stats.streak), accent: "text-fuchsia-300" },
    { label: "近期状态", code: "STATUS", value: stats.moodTrend, accent: "text-indigo-300" },
  ];

  return (
    <div className="min-h-screen bg-[#050510] overflow-hidden relative md:pl-[var(--siderail-width)] transition-[padding] duration-200">
      {/* 宇宙星云背景 + 赛博叠加层 */}
      <CosmicBackground />
      <CyberOverlay />

      {/* 顶栏 */}
      <header className="relative z-10 border-b border-cyan-400/10 bg-[#04040c]/70 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div>
            <h1
              className="cyber-glitch text-2xl font-semibold tracking-widest text-white/90"
              data-text="我的画像"
            >
              我的画像
            </h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/40">
              subject_profile // neural_scan
            </p>
          </div>
          <button
            onClick={() => router.push("/universe")}
            className="border border-cyan-400/20 px-4 py-1.5 font-mono text-sm tracking-widest text-cyan-300/60 hover:border-cyan-400/50 hover:text-cyan-200 transition-colors"
          >
            ← 返回
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-6">
        {/* 三维粒子数字核心 */}
        <div className="relative h-[300px] sm:h-[340px] -mx-6">
          <CyberCore className="absolute inset-0" />
          {/* 核心下方的身份标签 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center">
            <p className="font-mono text-sm uppercase tracking-[0.4em] text-cyan-300/50 cyber-cursor">
              数字画像同步中
            </p>
          </div>
        </div>

        {/* 数据流分隔线 */}
        <div className="cyber-dataline h-px w-full mb-6" />

        {/* 状态数据 HUD */}
        <div
          className={`grid grid-cols-3 gap-3 mb-8 transition-all duration-700 ${
            scanned ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          {statBlocks.map((s) => (
            <div key={s.code} className="cyber-panel cyber-corner p-5 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/30 mb-2">
                {s.code}
              </p>
              <p className={`cyber-neon text-2xl sm:text-3xl font-semibold ${s.accent}`}>
                {s.value}
              </p>
              <p className="mt-2 text-sm text-white/45">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 画像数据条目 */}
        <div className="space-y-3">
          {profile.map((item, idx) => (
            <div
              key={item.key}
              className={`cyber-panel cyber-corner p-4 transition-all duration-700 ${
                scanned ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
              }`}
              style={{ transitionDelay: `${150 + idx * 90}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-cyan-400/60">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fuchsia-300/40">
                      {item.code}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-white/45">{item.label}</p>
                  <p className="mt-1.5 text-base leading-relaxed text-white/90">
                    {item.value || <span className="italic text-white/25">暂无数据</span>}
                  </p>
                </div>
                <button
                  onClick={() => startEdit(item.key, item.value)}
                  className="shrink-0 border border-fuchsia-400/25 px-3 py-1.5 font-mono text-xs tracking-widest text-fuchsia-300/60 hover:border-fuchsia-400/60 hover:text-fuchsia-200 hover:shadow-[0_0_12px_rgba(232,121,249,0.15)] transition-all"
                >
                  校准
                </button>
              </div>

              {editingKey === item.key && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="输入你认为正确的描述"
                    className="flex-1 border border-cyan-400/20 bg-cyan-400/[0.03] px-3 py-2 text-base text-white/85 placeholder:text-white/25 focus:border-cyan-400/50 focus:outline-none focus:shadow-[0_0_16px_rgba(34,211,238,0.1)] transition-all"
                    autoFocus
                  />
                  <button
                    onClick={saveCorrection}
                    className="border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-sm tracking-widest text-cyan-200 hover:bg-cyan-400/20 transition-colors"
                  >
                    写入
                  </button>
                  <button
                    onClick={() => setEditingKey(null)}
                    className="border border-white/10 px-4 py-2 font-mono text-sm tracking-widest text-white/40 hover:bg-white/[0.06] transition-colors"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-center font-mono text-xs uppercase tracking-[0.25em] text-white/30">
          data_local_only // 这些数据只用来让计划更贴合你
        </p>
      </main>

    </div>
  );
}
