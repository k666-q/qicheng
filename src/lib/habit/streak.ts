/**
 * 连续记录与修复机制
 * 存储在 localStorage 中
 */

const STREAK_KEY = "qicheng_streak";
const REPAIR_KEY = "qicheng_streak_repair";

export type StreakData = {
  count: number;
  last_active_date: string; // YYYY-MM-DD
  longest: number;
  repair_available: boolean;
  total_completed: number;
};

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export function getStreak(): StreakData {
  if (typeof window === "undefined") {
    return { count: 0, last_active_date: "", longest: 0, repair_available: true, total_completed: 0 };
  }
  try {
    const stored = localStorage.getItem(STREAK_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { count: 0, last_active_date: "", longest: 0, repair_available: true, total_completed: 0 };
}

function saveStreak(data: StreakData) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

export function recordDailyCompletion(): StreakData {
  const streak = getStreak();
  const today = getToday();
  const yesterday = getYesterday();

  if (streak.last_active_date === today) {
    streak.total_completed++;
    saveStreak(streak);
    return streak;
  }

  if (streak.last_active_date === yesterday) {
    streak.count++;
  } else if (streak.last_active_date && streak.last_active_date !== today) {
    // Streak broken
    streak.count = 1;
    streak.repair_available = true;
  } else {
    streak.count = 1;
  }

  streak.last_active_date = today;
  streak.total_completed++;
  if (streak.count > streak.longest) streak.longest = streak.count;
  saveStreak(streak);
  return streak;
}

export function repairStreak(): StreakData | null {
  const streak = getStreak();
  if (!streak.repair_available) return null;

  const today = getToday();
  const yesterday = getYesterday();

  if (streak.last_active_date !== today && streak.last_active_date !== yesterday) {
    // Can repair: restore count + 1
    streak.count = streak.count + 1;
    streak.last_active_date = today;
    streak.repair_available = false;
    saveStreak(streak);
    return streak;
  }
  return null;
}

export function isStreakBroken(): boolean {
  const streak = getStreak();
  if (!streak.last_active_date) return false;
  const today = getToday();
  const yesterday = getYesterday();
  return streak.last_active_date !== today && streak.last_active_date !== yesterday;
}

export function canRepair(): boolean {
  return isStreakBroken() && getStreak().repair_available;
}
