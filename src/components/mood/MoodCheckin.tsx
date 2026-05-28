"use client";

import { useState, useEffect } from "react";
import { trackEvent, getEventsByType } from "@/lib/profile/events";
import { MOOD_OPTIONS } from "@/lib/profile/types";
import type { MoodLevel } from "@/lib/profile/types";

export function MoodCheckin() {
  const [todayMood, setTodayMood] = useState<MoodLevel | null>(null);
  const [justChecked, setJustChecked] = useState(false);

  useEffect(() => {
    const today = new Date().toDateString();
    const moods = getEventsByType("emotion_checkin");
    const todayEntry = moods.find((e) => new Date(e.created_at).toDateString() === today);
    if (todayEntry) {
      setTodayMood(todayEntry.event_data.mood as MoodLevel);
    }
  }, []);

  function handleSelect(mood: MoodLevel) {
    setTodayMood(mood);
    setJustChecked(true);
    trackEvent("emotion_checkin", { mood });
    setTimeout(() => setJustChecked(false), 2000);
  }

  if (todayMood && !justChecked) {
    const selected = MOOD_OPTIONS.find((m) => m.value === todayMood);
    return (
      <div className="flex items-center gap-2 text-xs text-stone-400">
        <span>{selected?.emoji}</span>
        <span>今天的状态：{selected?.label}</span>
      </div>
    );
  }

  if (justChecked) {
    return (
      <div className="text-xs text-stone-500 animate-in fade-in">
        记录了 ✓
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-stone-400">今天感觉怎么样？</span>
      <div className="flex gap-1">
        {MOOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            title={option.label}
            className="rounded-full p-1.5 hover:bg-stone-100 transition-colors text-lg"
          >
            {option.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
