import { NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { buildFullPersonaPrompt } from "@/lib/ai/persona";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  task: z.object({
    title_plain: z.string(),
    title_professional: z.string(),
    estimated_minutes: z.number(),
    difficulty: z.number(),
    day_label: z.string().optional(),
  }),
  planContext: z.object({
    title: z.string(),
    domain: z.string(),
    stageName: z.string(),
    weekTheme: z.string().optional(),
  }),
  history: z.array(z.object({
    role: z.enum(["user", "ai"]),
    content: z.string(),
  })).default([]),
  userMessage: z.string(),
  mode: z.enum(["breakdown", "chat"]).default("chat"),
});

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

function buildBreakdownPrompt(): string {
  const sceneInstructions = `## 当前场景：任务拆解

**重要：本场景不使用 |||SPLIT||| 分条规则。** 直接输出严格JSON，不要加其他文字。

用户点开了计划中的一个具体任务，你要把它拆解成可立刻执行的步骤。

## 规则

1. 把任务拆解成 3-6 个具体步骤，每步都是"坐下来就能开始做"的粒度
2. 每步说清楚：做什么、怎么做、预计多久
3. 语言通俗有画面感，不要堆术语
4. 给 1-2 个实用 tips（比如常见坑、省时间的技巧）
5. 推荐 2-3 个学习资源（见下方资源规则）

## ⚠️ 资源推荐规则（绝对禁止编造链接）

你不能给出任何具体的 URL/网址。AI 生成的链接几乎都是假的，会严重损害用户信任。

正确做法：
- 给出「平台 + 搜索关键词」，让用户自己搜
- 格式：「在 [平台] 搜索 [关键词]」
- 示例：
  - "在 B站 搜索「Flexbox 布局 20分钟入门」"
  - "在 MDN 搜索「CSS Grid」（官方文档，中文版）"
  - "在 YouTube 搜索「React hooks explained」"
  - "微信读书/豆瓣 搜《JavaScript高级程序设计》第6章"

禁止：
- 编造任何 http/https 开头的链接
- 给出你不确定是否存在的具体页面地址
- 用 "xxx.com/xxx" 这种格式

## 输出格式（严格 JSON，不要输出其他内容）

{
  "steps": [
    {"order": 1, "title": "步骤名称", "description": "具体做什么、怎么做", "estimated_minutes": 15}
  ],
  "tips": ["实用建议1", "实用建议2"],
  "resources": ["在 B站 搜索「关键词」", "在 平台 搜索「关键词」"]
}`;

  return buildFullPersonaPrompt(sceneInstructions);
}

function buildChatPrompt(task: z.infer<typeof RequestSchema>["task"], planContext: z.infer<typeof RequestSchema>["planContext"]): string {
  const sceneInstructions = `## 当前场景：任务陪伴对话

用户正在执行计划中的一个具体任务，可能有疑问需要你帮忙。

## 当前任务信息
- 通俗名称：${task.title_plain}
- 专业内容：${task.title_professional}
- 预计时间：${task.estimated_minutes} 分钟
- 所属计划：${planContext.title}
- 当前阶段：${planContext.stageName}

## 回答原则

1. 先确认用户卡在哪里，然后给出具体可操作的建议
2. 如果用户问的问题太大，帮他拆成小问题一个个解决
3. 用通俗语言解释概念，可以用类比和例子
4. 如果用户完全不知道从哪开始，给他一个"第一步就做这个"的明确指引

## 格式要求

**必须使用 Markdown 格式回复**，充分利用：
- **## 标题** 来分隔不同模块（知识点、操作步骤、练习题等）
- **加粗** 标注核心概念和重点
- \`代码\` 标注命令、代码片段
- 有序列表和无序列表让内容清晰
- > 引用块 用于答案解析
- --- 分隔不同板块

讲解知识时要**足够细致**，假设用户是零基础。用生活化类比解释抽象概念。

出选择题时，格式如下：
**第 N 题（难度）**
题目...
- A) ...
- B) ...
- C) ...
- D) ...
> 答案：X
> 解析：...

## 资源推荐规则

当用户问"有没有推荐的视频/教程/资源"时：
- 不要自己编造 URL，告诉用户你会帮他搜索真实资源
- 回复类似：「我帮你搜一下相关视频，稍等」或「让我找找看最适合你现在阶段的教程」
- 同时在回复中说明推荐的搜索关键词，方便用户自己也能找
- 用户界面上有「搜索资源」按钮，你可以提示用户点击它来获取真实有效的视频链接`;

  return buildFullPersonaPrompt(sceneInstructions);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.parse(body);

    const client = getClient();
    const model = process.env.AI_MODEL || "deepseek-chat";

    const isBreakdown = parsed.mode === "breakdown";

    const systemPrompt = isBreakdown
      ? buildBreakdownPrompt()
      : buildChatPrompt(parsed.task, parsed.planContext);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    if (isBreakdown) {
      messages.push({
        role: "user",
        content: `请拆解这个任务：\n通俗名称：${parsed.task.title_plain}\n专业内容：${parsed.task.title_professional}\n预计总时间：${parsed.task.estimated_minutes} 分钟\n所属计划：${parsed.planContext.title}\n阶段：${parsed.planContext.stageName}`,
      });
    } else {
      for (const msg of parsed.history) {
        messages.push({
          role: msg.role === "ai" ? "assistant" : "user",
          content: msg.content,
        });
      }
      messages.push({ role: "user", content: parsed.userMessage });
    }

    const stream = await client.chat.completions.create({
      model,
      messages,
      max_tokens: isBreakdown ? 2000 : 4000,
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
