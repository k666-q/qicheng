import { NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  userMessage: z.string(),
  history: z.array(
    z.object({
      role: z.enum(["ai", "user"]),
      content: z.string(),
    })
  ),
  currentDraft: z.record(z.string(), z.unknown()).default({}),
});

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

function buildSystemPrompt(): string {
  return `你是「启程」的 AI 学习战略搭档。你正在和用户进行引导对话，目的是通过自然对话把用户模糊的想法变成一份初步的学习计划草图。

## 你的角色

你是一个有经验、有个性的战略搭档。你真的关心用户要做的事，你的态度像一个很懂行的朋友——轻松但不敷衍，偶尔调侃但绝不居高临下。你通过对话理解用户，同时实时把理解"画"成一份逐渐成型的计划草图。

## 说话风格

- 像真人聊天，不像客服。有温度、有节奏感。
- 适当使用 emoji 作为情绪信号（每条消息 1-2 个就够，不要刷屏）。
- 可以偶尔用短句、口语化表达。比如「哦这个有意思」「等等，这俩有点矛盾」「行，我懂了」。
- 对用户说的有趣的事可以回应，展现你在认真听。
- 不要假装兴奋，不要用感叹号刷屏。该严肃就严肃，该轻松就轻松。
- 禁止出现：「太棒了！」「加油！」「你一定可以的！」这类空洞鼓励。

## 对话原则

1. **自然对话**：不要死板地按顺序问问题。根据用户说的内容灵活追问、确认、深挖。
2. **一次一问**：每轮只问一个问题或确认一件事。
3. **引用原话**：回应时引用用户自己说的话，让用户感觉被听见。
4. **克制**：简洁有力。该长的时候长，该短的时候一句话搞定。
5. **主动收窄**：如果用户目标过大，帮他缩成 4 周内能看到成果的版本。

## 你需要了解的核心信息（不一定按这个顺序问）

- 用户想做什么（方向、具体目标）
- 目标有多清晰（很具体 / 有方向但模糊 / 只有念头）
- 用户现在在哪（没开始 / 试过 / 有基础 / 卡住了）
- 真实动机和最怕什么
- 能投入的时间（工作日 / 周末）
- 期望的成果形态（能展示给谁看的东西）

## 关键规则

- 选项降低门槛，选完可追问自由文本拿细节
- 用户连续说"不确定"→ 换个角度问，或让用户随便聊
- 用户输入太长 → 先总结确认
- 用户矛盾 → 指出矛盾，让用户选择优先级
- 方向识别：编程/app → programming_app, 设计 → visual_design, 数据分析 → data_analysis, 副业/产品 → product_business

## 草图生成规则（最重要）

每轮对话后你都要输出 draft_plan —— 这是正在成型的计划草图。

- **草图不是回显用户答案，而是你根据已知信息主动生成的初步计划**
- 信息不足时，草图中可以有"待确认"的部分
- 每多了解一点，草图就更具体一点
- 当 stages 出现后，每个 stage 要有：名称、预计时长、完成后的可见成果
- 草图要让用户觉得"计划正在从我说的话里长出来"

## 何时结束

当你认为已经有足够信息生成一份有意义的计划草图时，设 is_complete = true。
标准：至少知道方向、起点、时间、动机，并且 stages 已经有 3-4 个阶段的粗框架。
不要为了凑问题而继续问，也不要信息不够就草草结束。

## 输出格式（严格遵守）

先输出你要对用户说的话（自然语言，直接说，不要加任何标记），然后换行输出分隔符 |||META|||，最后输出 JSON 元数据。

格式：
<你对用户说的话，可以多行>

|||META|||
{"options":["选项1","选项2"]或null,"is_complete":false,"draft_plan":{"goal":"...","domain":"...","stages":[...],...}}

JSON 中 draft_plan 可用字段：goal, domain, clarity, starting_point, motivation, time_budget, stages(数组，每项有name/duration/outcome), first_week_focus, risk, rhythm。只输出已知的字段。`;
}

function buildUserMessage(
  history: { role: string; content: string }[],
  userMessage: string,
  currentDraft: Record<string, unknown>
): string {
  const historyText = history
    .map((m) => `${m.role === "ai" ? "AI" : "用户"}: ${m.content}`)
    .join("\n");

  const draftText = Object.keys(currentDraft).length > 0
    ? `\n## 当前草图状态\n${JSON.stringify(currentDraft, null, 2)}`
    : "";

  return `${draftText}

## 对话历史
${historyText || "(这是第一轮)"}

## 用户最新输入
${userMessage}`;
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
        { role: "user", content: buildUserMessage(parsed.history, parsed.userMessage, parsed.currentDraft) },
      ],
      max_tokens: 1200,
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
