"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getEvents, getEventsByType } from "@/lib/profile/events";
import type { MoodLevel } from "@/lib/profile/types";
import { MOOD_OPTIONS } from "@/lib/profile/types";

type ProfileItem = {
  key: string;
  label: string;
  value: string | null;
  icon: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileItem[]>([]);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [stats, setStats] = useState({ completed: 0, streak: 0, moodTrend: "" });

  useEffect(() => {
    buildProfile();
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
        value: savedCorrections.goal || draft.goal || null,
        icon: "🎯",
      },
      {
        key: "starting_point",
        label: "我从哪里开始",
        value: savedCorrections.starting_point || draft.starting_point || null,
        icon: "📍",
      },
      {
        key: "struggle",
        label: "我最容易卡在哪里",
        value: savedCorrections.struggle || inferStruggle(events) || null,
        icon: "🧱",
      },
      {
        key: "task_capacity",
        label: "我每天适合多大任务",
        value: savedCorrections.task_capacity || inferCapacity(events) || null,
        icon: "⏱️",
      },
      {
        key: "recent",
        label: "我最近完成了什么",
        value: completedTasks.length > 0
          ? (completedTasks[completedTasks.length - 1].event_data.title_plain as string) || `共完成 ${completedTasks.length} 个任务`
          : null,
        icon: "✅",
      },
    ];

    setProfile(items);

    const recentMoods = moodEvents.slice(-7);
    let moodTrend = "暂无数据";
    if (recentMoods.length >= 3) {
      const moodScores: Record<string, number> = { struggling: 1, okay: 2, good: 3, great: 4 };
      const avg = recentMoods.reduce((sum, e) => sum + (moodScores[e.event_data.mood as string] || 2), 0) / recentMoods.length;
      moodTrend = avg >= 3 ? "状态不错 🙂" : avg >= 2 ? "比较平稳 😐" : "有些吃力 😫";
    }

    setStats({
      completed: completedTasks.length,
      streak: calcStreak(completedTasks.map((e) => e.created_at)),
      moodTrend,
    });
  }

  function inferStruggle(events: { event_type: string; event_data: Record<string, unknown> }[]): string | null {
    const helpEvents = events.filter((e) => e.event_type === "task_help_requested");
    if (helpEvents.length === 0) return "还没有足够数据";
    const types = helpEvents.map((e) => e.event_data.help_type as string);
    const whyCount = types.filter((t) => t === "why").length;
    const howCount = types.filter((t) => t === "how").length;
    if (whyCount > howCount) return "偏理论理解——经常想搞清「为什么」";
    if (howCount > whyCount) return "偏实操执行——经常需要「怎么做」的指引";
    return "理论和实操都需要帮助";
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

  function calcStreak(dates: string[]): number {
    if (dates.length === 0) return 0;
    const days = [...new Set(dates.map((d) => new Date(d).toDateString()))].sort().reverse();
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < days.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      if (new Date(days[i]).toDateString() === expected.toDateString()) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
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

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-800">我的画像</h1>
            <p className="text-xs text-stone-400 mt-0.5">系统对你的理解，随时可以修正</p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            返回
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg bg-white border border-stone-200 p-4 text-center">
            <p className="text-2xl font-semibold text-stone-800">{stats.completed}</p>
            <p className="text-xs text-stone-500 mt-1">完成任务</p>
          </div>
          <div className="rounded-lg bg-white border border-stone-200 p-4 text-center">
            <p className="text-2xl font-semibold text-stone-800">{stats.streak}</p>
            <p className="text-xs text-stone-500 mt-1">连续天数</p>
          </div>
          <div className="rounded-lg bg-white border border-stone-200 p-4 text-center">
            <p className="text-sm font-medium text-stone-800 mt-1">{stats.moodTrend}</p>
            <p className="text-xs text-stone-500 mt-1">近期状态</p>
          </div>
        </div>

        {/* Profile items */}
        <div className="space-y-3">
          {profile.map((item) => (
            <div key={item.key} className="rounded-lg bg-white border border-stone-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="text-xs text-stone-500">{item.label}</p>
                    <p className="text-sm text-stone-800 mt-0.5">
                      {item.value || <span className="text-stone-400 italic">暂无数据</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => startEdit(item.key, item.value)}
                  className="text-[11px] text-stone-400 hover:text-stone-600 border border-stone-200 rounded px-2 py-0.5 hover:border-stone-300 transition-colors"
                >
                  不准确
                </button>
              </div>

              {editingKey === item.key && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="输入你认为正确的描述"
                    className="flex-1 rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-800 focus:border-stone-400 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={saveCorrection}
                    className="rounded bg-stone-800 px-3 py-1.5 text-xs text-white hover:bg-stone-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingKey(null)}
                    className="rounded border border-stone-200 px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-stone-400">
          这些数据只用来让你的计划更贴合你，你可以随时修正
        </p>
      </main>
    </div>
  );
}
