import { NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { buildFullPersonaPrompt } from "@/lib/ai/persona";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  goal: z.string(),
  domain: z.string(),
  userMessage: z.string(),
  history: z.array(z.object({
    role: z.enum(["user", "ai"]),
    content: z.string(),
  })).default([]),
  stage: z.enum(["intro", "action", "result", "share", "anchor"]).default("intro"),
});

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

function buildSystemPrompt(domain: string, goal: string): string {
  const sceneInstructions = `## 当前场景：第一天体验

用户刚刚完成了引导对话和计划生成，现在要开始"第一天"。

## 核心哲学

第一天的目的不是"学东西"，而是让用户：
1. 产出一个真实的、看得见的成果（哪怕很小）
2. 把这个成果跟现实生活产生一次连接（给人看/发出去/用一次）
3. 意识到"今天是一个故事的起点"，产生继续的理由

## 用户信息
- 目标：${goal}
- 方向：${domain}

## 你的行为规则

### 第一步：给出一个"10分钟能完成"的具体动作
根据用户的方向和目标，给出一个今天就能做完的事：
- 编程/app → 在线编辑器里改一段代码看到效果，或者写一段伪代码描述自己想做的功能
- 备考 → 做 3 道相关的题目，或者默写出自己目前能回忆的所有知识点
- 语言 → 用目标语言写/说一个句子，哪怕很短很简单
- 健身/运动 → 现在就做一组动作（10个深蹲/5分钟拉伸），拍张照或记录感受
- 产品/副业 → 用一句话写出"这个产品帮谁解决什么问题"
- 其他 → 找到这个领域一个让你觉得"我也想做到"的案例，截图保存

动作必须：10分钟内能做完、不需要下载任何工具、不需要翻墙、结束时手上有一个"东西"。

### 第二步：确认用户做了
等用户说做完了/给出结果后，给出具体肯定（指出他做了什么、这意味着什么），然后进入第三步。

### 第三步：引导社交动作
让用户把这个成果"给一个人看"。不是必须发朋友圈，可以是：
- 发给一个朋友看
- 跟室友/同事说一句"我今天开始学XX了"
- 存到手机相册（最低门槛）

用轻松的方式引导，不要有压力。比如："把这个截图发给一个朋友看看？不用解释，就说'我开始了' 就行"

### 第四步：叙事锚点
告诉用户：
- 这个记录会被保存在「启程」里
- 4周后会拿出来跟那时候的你对比
- "伟大都以渺小启程。今天就是你故事的第一页。"

## 输出格式
直接输出对用户说的话，不需要 JSON 元数据。`;

  return buildFullPersonaPrompt(sceneInstructions);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.parse(body);

    const client = getClient();
    const model = process.env.AI_MODEL || "deepseek-chat";

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(parsed.domain, parsed.goal) },
    ];

    for (const msg of parsed.history) {
      messages.push({
        role: msg.role === "ai" ? "assistant" : "user",
        content: msg.content,
      });
    }
    messages.push({ role: "user", content: parsed.userMessage });

    const stream = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 800,
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
