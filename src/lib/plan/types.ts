export type PlanTask = {
  title_plain: string;
  title_professional: string;
  description?: string;
  estimated_minutes: number;
  difficulty: number;
};

export type PlanStage = {
  name: string;
  why: string;
  tasks: PlanTask[];
  outcome: string;
  duration: string;
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
};

export type PlanVersion = {
  version: number;
  stages: PlanStage[];
  change_description?: string;
  created_at: string;
};
