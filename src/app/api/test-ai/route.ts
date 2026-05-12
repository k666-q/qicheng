import { NextResponse } from "next/server";
import { z } from "zod";
import { callAI, logPromptRun } from "@/lib/ai";

export const dynamic = "force-dynamic";

const TestSchema = z.object({
  message: z.string(),
  confidence: z.number(),
});

export async function GET() {
  try {
    const options = {
      promptType: "onboarding" as const,
      promptVersion: "v1.0-test",
      systemPrompt: "你是启程的 AI 助手。请用 JSON 格式回复。",
      userMessage: '用户说：我想学编程。请返回 JSON：{ "message": "你的回复", "confidence": 0到1之间的数字 }',
      maxTokens: 200,
    };

    const result = await callAI(options, TestSchema);

    await logPromptRun(options, result);

    return NextResponse.json({
      success: result.success,
      parsed: result.parsed,
      model: result.model,
      tokensUsed: result.tokensUsed,
      durationMs: result.durationMs,
      error: result.error,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
