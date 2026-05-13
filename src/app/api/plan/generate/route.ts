import { NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  draft: z.record(z.string(), z.unknown()),
  conversationSummary: z.string().optional(),
});

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

function buildSystemPrompt(): string {
  return `你是「启程」的 AI 学习规划引擎。用户刚刚完成了引导对话，现在你要把草图变成一份正式的个人计划。

## 核心原则

1. **这是"这个人的计划"，不是课程大纲。** 每个安排都要和用户的具体情况挂钩。
2. **「为什么」是主角。** 先说为什么这么安排，任务是"为什么"的自然结果。
3. **双层语言。** 每个任务必须有"通俗语言"（用户看的，有画面感）和"专业备注"（锚定知识点）。
4. **成果可展示。** 每个阶段结束后用户能拿出一个东西给别人看，不能只是"学完了"。
5. **引用用户原话。** 在"为什么这样安排"中至少引用 1 句用户自己说过的话。

## 计划结构

生成 4 周计划，分 3-4 个阶段。每个阶段包含：

- **name**: 阶段名（简短有力，如"打地基"、"加功能"、"上线展示"）
- **why**: 为什么这样安排（引用用户原话 + 阶段目标 + 风险处理）
- **duration**: 预计时长（如"第 1-2 周"）
- **tasks**: 任务列表，每个任务有：
  - title_plain: 通俗描述（让用户知道在做什么，有画面感）
  - title_professional: 专业备注（技术知识点）
  - estimated_minutes: 预计时间（分钟）
  - difficulty: 难度 1-5
- **outcome**: 这个阶段结束后能展示的成果

## 双层语言示例

| 通俗语言 | 专业备注 |
|---------|---------|
| 让你的页面从白板变成有模样的东西 | CSS 核心布局与样式系统 |
| 让页面有真实能点击的功能 | JavaScript 事件与状态管理 |
| 让它真实存在于这个世界 | Vercel 部署与线上访问 |
| 让数据不再消失，关掉再打开还在 | 数据库基础与 CRUD 操作 |

规则：先写通俗语言，再写专业备注。不能先列技术词再翻译。

## 输出格式

先输出整个计划的自然语言介绍（2-3 句话，给用户看的），然后是分隔符和 JSON。

格式：
<对用户说的话：计划概览介绍，轻松自然，提到他的目标和第一步>

|||PLAN|||
{
  "title": "项目名称",
  "domain": "方向",
  "total_weeks": 4,
  "stages": [...],
  "first_step": {"task_name": "第一个任务的通俗名称", "minutes": 预计分钟数}
}`;
}

function buildUserMessage(draft: Record<string, unknown>, summary?: string): string {
  return `## 用户草图数据
${JSON.stringify(draft, null, 2)}

${summary ? `## 对话要点\n${summary}` : ""}

请基于以上信息生成完整的个人学习计划。`;
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
        { role: "user", content: buildUserMessage(parsed.draft, parsed.conversationSummary) },
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
