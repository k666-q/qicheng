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
  mode: z.enum(["breakdown", "chat", "anchor", "deepdive"]).default("chat"),
  /** deepdive 模式：要深潜的步骤信息 */
  step: z.object({
    order: z.number(),
    title: z.string(),
    description: z.string(),
  }).optional(),
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

function buildAnchorPrompt(): string {
  return `你是一名学习本质提炼专家。用户给你一个学习任务，你要提取这个任务背后知识的「锚点卡」——学完之后细节都可以忘，但这四样东西必须留下。

## 四个字段（普适于任何学科）

1. **essence 本质**：这个知识最关键的是什么。一句话点破，有洞察力，不是定义复读。（例：导数的本质是"用无限逼近取代平均"的瞬时变化率）
2. **when 何时用**：什么信号出现时该想起它。写成"凡是…的时候"的触发条件。（例：凡是问"变化快慢"的地方）
3. **core 用时核心**：真正使用它时，脑子里必须端着的那个操作要领。（例：先确认"对谁求变化、在哪一点"）
4. **invariant 不可脱离**：底线/不变量，一旦违反必错的东西。（例：极限必须存在，不可导点不能硬求；递归必须有终止条件）

## 要求

- 每个字段 1-2 句话，中文，具体、可操作，禁止空话套话（如"要多练习""理解很重要"）
- 站在这个任务的具体知识内容上提炼，不是对"学习"本身提炼

## 输出格式（严格 JSON，不要输出任何其他内容）

{"essence": "...", "when": "...", "core": "...", "invariant": "..."}`;
}

function buildDeepDivePrompt(domain: string): string {
  const styleGuide =
    domain === "programming_app"
      ? `## 深潜形态：代码逐行（kind = "code"）

选取这一步最核心的一段代码（10-16 行以内的关键算法/功能实现，不是整个文件）。
组织方式：**按功能模块顺序**——intro 里先说这段代码分几块、各自干嘛，然后逐行推进。
- content：一行或紧密相关的一小组代码（保留缩进）
- explain：这行为什么存在、在整体里扮演什么角色（人话，有画面感）
- rule：涉及的语言机制/惯用法（如"闭包捕获""哨兵值"），没有就省略`
      : domain === "exam_prep" || domain === "general_learning"
        ? `## 深潜形态：推导链或逻辑链（数学类内容用 kind = "derivation"，其他用 "logic"）

数学/物理类：选取这一步最核心的公式推导，从前提到结论，每行一步变换。
- content：这一步变换后的式子（可用 LaTeX 语法如 $x^2$）
- explain：这一步做了什么、为什么这样做
- rule：用的变换规则（如"两边同除以 n""链式法则"）

非公式类：把核心结论拆成因果/论证链，每行一个环节。
- content：这个环节的陈述
- explain：它如何从上一环节推出来
- rule：依据（定义/事实/常识），没有就省略`
        : `## 深潜形态：逻辑链（kind = "logic"）

把这一步的核心方法/结论拆成从前提到结论的因果链，每行一个环节。
- content：这个环节的陈述（一句话）
- explain：它为什么成立、如何从上一环节推出来
- rule：依据，没有就省略`;

  return `你是「Nexiova」的深潜引导者。用户点开了任务中的一个步骤，要求「逐行深潜」——不整段灌输，而是一行一行推进，每行都要真正理解才继续。

${styleGuide}

## 行内检查点（防假点头，关键）

每 2-3 行在该行上挂一个 check（不是每行都有，全序列 2-4 个）：
- kind 三选一：
  - "predict"：预测下一行/下一步该干什么
  - "blank"：把这一行的关键部分挖空让用户补全
  - "counterfactual"：问"如果删掉/跳过这一行，会坏在哪"
- question：题干
- options：2-4 个选项，必须埋一个最诱人的常见错误
- answer：正确选项下标（0 开始的数字）
- hint：答错时的引导，禁止直接给答案，引导他想"哪一步出了问题"
- why：揭示后的解析，重点讲"为什么错的选项那么诱人"

## 写作铁律

- 行数 6-14 行，粒度："坐下来能逐行点头"的大小
- explain 全程第二人称、有画面感，禁止教科书腔
- 所有内容真实准确，公式/代码必须正确

## 输出格式（严格 JSON，不要输出任何其他内容）

{
  "title": "深潜对象名称",
  "intro": "整体在干嘛、分几块（1-2 句）",
  "kind": "derivation | code | logic",
  "lines": [
    {"content": "...", "explain": "...", "rule": "...", "check": {"kind": "predict", "question": "...", "options": ["...", "..."], "answer": 0, "hint": "...", "why": "..."}},
    {"content": "...", "explain": "..."}
  ]
}`;
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
- **## 标题** 来分隔不同模块
- **加粗** 标注核心概念和重点
- \`代码\` 标注命令、代码片段
- 有序列表和无序列表让内容清晰
- > 引用块 用于答案解析
- --- 分隔不同板块

## 讲解风格（刺激式，禁止试卷腔）

讲解知识时假设用户是聪明的零基础者，并遵守：
1. **先猜后讲**：讲一个新概念前，先抛一个让他猜的问题（预测失败 = 学习开始）。
2. **真相钩子**：能用"为什么XX会这样？"开场的，绝不用"我们来学习XX"。
3. **短段悬念**：每段不超过 5 行，在"接下来呢？"的地方停一下再继续。
4. **规律标记**：每揭示一个关键规律，单独标一行 **🎯 规律捕获：xxx**。
5. **类比优先**：术语第一次出现必须用人话或类比翻译。

出题时（不叫"练习题"，叫"挑战"）：
- 题前加一句对抗文案，如"**约 70% 的人会在这里栽跟头**"（数字合理可信）
- 选项里埋一个最诱人的常见错误
- 答案解析放引用块，提醒"先自己选再看"；解析重点讲"为什么错的选项那么诱人"
**第 N 题（难度）**
题目...
- A) ...
- B) ...
- C) ...
- D) ...
> 答案：X
> 解析：...
- 用户答错时不要直接给答案，先引导他想"哪一步可能出错"（错误纠正式追问）。

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

    const mode = parsed.mode;

    const systemPrompt =
      mode === "breakdown"
        ? buildBreakdownPrompt()
        : mode === "anchor"
          ? buildAnchorPrompt()
          : mode === "deepdive"
            ? buildDeepDivePrompt(parsed.planContext.domain)
            : buildChatPrompt(parsed.task, parsed.planContext);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    const taskInfo = `通俗名称：${parsed.task.title_plain}\n专业内容：${parsed.task.title_professional}\n预计总时间：${parsed.task.estimated_minutes} 分钟\n所属计划：${parsed.planContext.title}（领域 ${parsed.planContext.domain}）\n阶段：${parsed.planContext.stageName}`;

    if (mode === "breakdown") {
      messages.push({ role: "user", content: `请拆解这个任务：\n${taskInfo}` });
    } else if (mode === "anchor") {
      messages.push({ role: "user", content: `请提取这个学习任务的锚点卡：\n${taskInfo}` });
    } else if (mode === "deepdive") {
      const step = parsed.step;
      messages.push({
        role: "user",
        content: `请为这个步骤生成逐行深潜序列：\n${taskInfo}\n\n当前步骤（第 ${step?.order ?? 1} 步）：${step?.title ?? parsed.task.title_plain}\n步骤描述：${step?.description ?? ""}`,
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
      max_tokens: mode === "breakdown" ? 2000 : mode === "anchor" ? 600 : mode === "deepdive" ? 4000 : 4000,
      temperature: mode === "anchor" || mode === "deepdive" ? 0.4 : 0.7,
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
