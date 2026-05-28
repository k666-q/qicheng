export type UserProfile = {
  id: string;
  user_id: string;
  goal: string | null;
  domain: string | null;
  starting_point: string | null;
  motivation: string | null;
  time_budget: string | null;
  preferred_difficulty: "light" | "standard" | "intense";
  struggle_patterns: string[];
  completed_count: number;
  current_streak: number;
  longest_streak: number;
  last_active_at: string | null;
  corrections: Record<string, string>;
};

export type MoodLevel = "struggling" | "okay" | "good" | "great";

export const MOOD_OPTIONS: { value: MoodLevel; emoji: string; label: string }[] = [
  { value: "struggling", emoji: "😫", label: "很挣扎" },
  { value: "okay", emoji: "😐", label: "还好" },
  { value: "good", emoji: "🙂", label: "不错" },
  { value: "great", emoji: "💪", label: "很有劲" },
];
