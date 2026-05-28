export type StageCard = {
  id: string;
  stage_index: number;
  stage_name: string;
  date_range: string; // "2026.6.1 - 6.28"
  summary: string; // AI 生成的一句话总结
  user_quote: string; // 用户在这个阶段说过的话
  emotion_data: number[]; // 每日情绪值数组 (1-10)
  stats: {
    days: number;
    tasks_completed: number;
  };
  result_url?: string; // 成果链接
  created_at: string;
};
