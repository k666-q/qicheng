import { createClient } from "@/lib/supabase/server";
import type { AICallResult, AIServiceCallOptions } from "./types";

export async function logPromptRun<T>(
  options: AIServiceCallOptions,
  result: AICallResult<T>,
  context?: { userId?: string; projectId?: string }
) {
  try {
    const supabase = await createClient();

    await supabase.from("prompt_runs").insert({
      user_id: context?.userId ?? null,
      project_id: context?.projectId ?? null,
      prompt_type: options.promptType,
      prompt_version: options.promptVersion,
      input: {
        system_prompt: options.systemPrompt.slice(0, 500),
        user_message: options.userMessage.slice(0, 1000),
      },
      raw_output: result.raw,
      parsed_output: result.parsed,
      parse_success: result.success,
      model: result.model,
      tokens_used: result.tokensUsed,
      duration_ms: result.durationMs,
    });
  } catch {
    console.error("[logPromptRun] failed to log, skipping");
  }
}
