import { NextRequest } from "next/server";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";
import { z } from "zod";
import OpenAI from "openai";
import { buildFullPersonaPrompt } from "@/lib/ai/persona";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  stageName: z.string(),
  stageIndex: z.number(),
  stageOutcome: z.string(),
  tasksCompleted: z.number(),
  days: z.number(),
  userQuotes: z.array(z.string()).default([]),
  emotionData: z.array(z.number()).default([]),
});

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

function buildSystemPrompt(): string {
  const sceneInstructions = `## 当前场景：阶段卡片生成

**重要：本场景不使用 |||SPLIT||| 分条规则。直接输出严格 JSON，不要加其他文字。**

用户刚刚完成了计划中的一个阶段。你要为他生成一张成就卡片的文案。

## 规则

1. summary：一句话总结他在这个阶段做到了什么（具体、有画面感、第二人称）
   - 好："从完全不会到有一个真实在线的页面"
   - 差："完成了第一阶段的学习"（太空洞）
2. 如果有用户原话，挑一句最有故事感的作为 user_quote
3. 如果没有用户原话，根据阶段信息推测一句可能的心路历程作为 user_quote

## 输出格式（严格 JSON）

{
  "summary": "一句话成就总结",
  "user_quote": "用户的话或推测的心路历程"
}`;

  return buildFullPersonaPrompt(sceneInstructions);
}

export async function POST(req: NextRequest) {
  const limited = rateLimitGuard(req, "cards-generate", POLICIES.llm);
  if (limited) return limited;
  try {
    const body = await req.json();
    const parsed = RequestSchema.parse(body);

    const client = getClient();
    const model = process.env.AI_MODEL || "deepseek-chat";

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: `阶段名称：${parsed.stageName}\n预期成果：${parsed.stageOutcome}\n完成任务数：${parsed.tasksCompleted}\n持续天数：${parsed.days}\n用户在这个阶段说过的话：${parsed.userQuotes.length > 0 ? parsed.userQuotes.join(" / ") : "无记录"}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return Response.json({ success: false, error: "AI 未返回有效 JSON" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return Response.json({ success: true, ...result });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
