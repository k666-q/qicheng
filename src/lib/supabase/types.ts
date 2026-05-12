export type Profile = {
  id: string;
  display_name: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  title: string;
  domain: string | null;
  status: "draft" | "active" | "paused" | "completed";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PromptRun = {
  id: string;
  user_id: string | null;
  project_id: string | null;
  prompt_type: string;
  prompt_version: string;
  input: Record<string, unknown>;
  raw_output: string | null;
  parsed_output: Record<string, unknown> | null;
  parse_success: boolean;
  model: string | null;
  tokens_used: number | null;
  duration_ms: number | null;
  created_at: string;
};
