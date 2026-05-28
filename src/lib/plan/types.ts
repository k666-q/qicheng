export type PlanTask = {
  id?: string;
  title_plain: string;
  title_professional: string;
  estimated_minutes: number;
  difficulty: number;
  day_label: string;
  reason?: string;
};

export type TaskBreakdown = {
  steps: TaskStep[];
  tips?: string[];
  resources?: string[];
};

export type TaskStep = {
  order: number;
  title: string;
  description: string;
  estimated_minutes: number;
};

export type PlanWeek = {
  week_number: number;
  theme: string;
  days: PlanDay[];
  outcome: string;
};

export type PlanDay = {
  day: string;
  energy_note?: string;
  tasks: PlanTask[];
};

export type PlanStage = {
  name: string;
  why: string;
  weeks?: PlanWeek[];
  tasks?: PlanTask[];
  outcome: string;
  duration: string;
};

export type EmotionPhase = {
  name: string;
  week_start: number;
  week_end: number;
  emotion_level: number; // 1-10, 10=最高涨
  system_behavior: string;
  message?: string;
};

export type EmotionCurvePoint = {
  week: number;
  predicted: number; // 1-10
  label?: string;
};

export type PredictedEmotionCurve = {
  phases: EmotionPhase[];
  curve_points: EmotionCurvePoint[];
};

export type GeneratedPlan = {
  title: string;
  domain: string;
  total_weeks: number;
  stages: PlanStage[];
  first_step: {
    task_name: string;
    minutes: number;
  };
  emotion_curve?: PredictedEmotionCurve;
};

export type PlanVersion = {
  version: number;
  stages: PlanStage[];
  change_description?: string;
  created_at: string;
};
