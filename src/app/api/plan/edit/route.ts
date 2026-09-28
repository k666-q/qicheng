import { NextRequest } from "next/server";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";
import { z } from "zod";
import OpenAI from "openai";
import { buildFullPersonaPrompt } from "@/lib/ai/persona";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  currentPlan: z.record(z.string(), z.unknown()),
  userRequest: z.string(),
});

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

function buildSystemPrompt(): string {
  const sceneInstructions = `## 当前场景：计划编辑

**重要：本场景不使用 |||SPLIT||| 分条规则。** 你需要输出说明文字 + |||PLAN||| + 完整JSON。不要把JSON拆成多条消息。

用户对当前计划有修改意见，你要理解他的意图并输出修改后的完整计划。

## 规则

1. 先用 1-2 句话说明你做了什么修改、为什么。
2. 输出修改后的完整计划 JSON（格式和生成时一样：stages → weeks → days → tasks）。
3. 如果用户的修改会产生连锁影响（比如改时间导致后面任务要调整），主动说明并重新按天分配。
4. 保持双层语言、精力曲线原则、用户原话引用等规则不变。
5. 不要问用户问题，直接按他说的做，做完解释。
6. 修改后仍然要按天分配，考虑每天的精力状态。

## 输出格式

<对用户说的话：解释你改了什么、为什么、有什么连锁影响>

|||PLAN|||
{完整的修改后计划 JSON，结构：title, domain, total_weeks, stages[{name, why, duration, weeks[{week_number, theme, days[{day, energy_note?, tasks[{title_plain, title_professional, estimated_minutes, difficulty, day_label}]}], outcome}], outcome}], first_step}`;

  return buildFullPersonaPrompt(sceneInstructions);
}

export async function POST(req: NextRequest) {
  const limited = rateLimitGuard(req, "plan-edit", POLICIES.heavy);
  if (limited) return limited;
  try {
    const body = await req.json();
    const parsed = RequestSchema.parse(body);

    const client = getClient();
    const model = process.env.AI_MODEL || "deepseek-chat";

    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: `## 当前计划\n${JSON.stringify(parsed.currentPlan, null, 2)}\n\n## 用户修改请求\n${parsed.userRequest}`,
        },
      ],
      max_tokens: 4000,
      temperature: 0.7,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", content: err instanceof Error ? err.message : "Stream error" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
