export type AICallResult<T = Record<string, unknown>> = {
  success: boolean;
  parsed: T | null;
  raw: string;
  error?: string;
  promptVersion: string;
  model: string;
  tokensUsed: number;
  durationMs: number;
};

export type PromptType =
  | "onboarding"
  | "draft"
  | "plan"
  | "task_deep_dive"
  | "profile";

export type AIServiceCallOptions = {
  promptType: PromptType;
  promptVersion: string;
  systemPrompt: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};
