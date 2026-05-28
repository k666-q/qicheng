export type MilestoneType =
  | "first_words"
  | "first_doubt"
  | "first_action"
  | "first_result"
  | "first_share"
  | "overcame_block"
  | "stage_complete"
  | "mood_shift"
  | "comeback";

export type Milestone = {
  id: string;
  type: MilestoneType;
  title: string;
  content: string;
  user_quote?: string;
  created_at: string;
  stage?: number;
  context?: Record<string, unknown>;
};

export const MILESTONE_LABELS: Record<MilestoneType, { emoji: string; label: string }> = {
  first_words: { emoji: "💬", label: "第一次说出想法" },
  first_doubt: { emoji: "🤔", label: "第一次犹豫" },
  first_action: { emoji: "⚡", label: "第一次动手" },
  first_result: { emoji: "🎉", label: "第一个成果" },
  first_share: { emoji: "📤", label: "第一次分享" },
  overcame_block: { emoji: "🧱", label: "克服了一个卡点" },
  stage_complete: { emoji: "🏁", label: "阶段完成" },
  mood_shift: { emoji: "🌤️", label: "情绪转好" },
  comeback: { emoji: "🔄", label: "回来继续了" },
};
