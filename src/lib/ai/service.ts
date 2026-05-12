import OpenAI from "openai";
import { z } from "zod";
import type { AICallResult, AIServiceCallOptions } from "./types";

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

const DEFAULT_MODEL = process.env.AI_MODEL || "deepseek-chat";
const MAX_RETRIES = 1;

export async function callAI<T>(
  options: AIServiceCallOptions,
  schema: z.ZodType<T>
): Promise<AICallResult<T>> {
  const {
    systemPrompt,
    userMessage,
    promptVersion,
    model = DEFAULT_MODEL,
    maxTokens = 2000,
    temperature = 0.7,
  } = options;

  const start = Date.now();
  let raw = "";
  let tokensUsed = 0;
  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ];

      if (attempt > 0) {
        messages.push({
          role: "user",
          content:
            "请严格按照 JSON 格式输出，不要包含任何 markdown 标记或额外文字。",
        });
      }

      const response = await getClient().chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        response_format: { type: "json_object" },
      });

      raw = response.choices[0]?.message?.content ?? "";
      tokensUsed = response.usage?.total_tokens ?? 0;

      const jsonParsed = JSON.parse(raw);
      const validated = schema.parse(jsonParsed);

      return {
        success: true,
        parsed: validated,
        raw,
        promptVersion,
        model,
        tokensUsed,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      lastError =
        err instanceof Error ? err.message : "Unknown parsing error";
    }
  }

  return {
    success: false,
    parsed: null,
    raw,
    error: lastError,
    promptVersion,
    model,
    tokensUsed,
    durationMs: Date.now() - start,
  };
}
