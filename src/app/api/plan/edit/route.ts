import { NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

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
  return `你是「启程」的计划编辑助手。用户对当前计划有修改意见，你要理解他的意图并输出修改后的完整计划。

## 规则

1. 先用 1-2 句话说明你做了什么修改、为什么。
2. 输出修改后的完整计划 JSON（格式和生成时一样）。
3. 如果用户的修改会产生连锁影响（比如改时间导致后面任务要调整），主动说明。
4. 保持双层语言、用户原话引用等规则不变。
5. 不要问用户问题，直接按他说的做，做完解释。

## 输出格式

<对用户说的话：解释你改了什么、为什么、有什么连锁影响>

|||PLAN|||
{完整的修改后计划 JSON，格式同生成时}`;
}

export async function POST(req: NextRequest) {
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
