export type DraftStage = {
  name: string;
  duration: string;
  outcome: string;
};

export type DraftPlan = {
  goal?: string;
  domain?: string;
  clarity?: string;
  starting_point?: string;
  motivation?: string;
  time_budget?: string;
  stages?: DraftStage[];
  first_week_focus?: string;
  risk?: string;
  rhythm?: string;
};

export type ConversationMessage = {
  role: "ai" | "user";
  content: string;
  options?: string[] | null;
};

export type OnboardingAPIResponse = {
  ai_message: string;
  options: string[] | null;
  is_complete: boolean;
  draft_plan: DraftPlan;
  thinking?: string;
};

export type OnboardingState = {
  messages: ConversationMessage[];
  draft: DraftPlan;
  isComplete: boolean;
};
