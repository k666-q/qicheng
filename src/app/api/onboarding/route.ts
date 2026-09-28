import { NextRequest } from "next/server";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";
import { z } from "zod";
import OpenAI from "openai";
import { buildFullPersonaPrompt } from "@/lib/ai/persona";

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
  const sceneInstructions = `## 当前场景：引导对话

你正在和用户进行引导对话，目的是通过自然对话把用户模糊的想法变成一份初步的学习计划草图。你通过对话理解用户，同时实时把理解"画"成一份逐渐成型的计划草图。

## ⚠️ 消息分条规则（最高优先级，必须严格执行）

你的每次回复，当你在对话/追问时，必须用 |||SPLIT||| 分成 2-3 条短消息。这是硬性规则，不可忽略。

正确示例（必须这样输出）：
嗯 AI 漫剧 🤔 这个挺有意思的|||SPLIT|||你说的是那种用 AI 画画面、生成配音的短剧？还是更偏向互动式的、观众能选剧情走向的那种？

再比如：
行 我大概知道你想要什么了|||SPLIT|||那你现在是已经有剧本了，还是连故事都还没想好？

错误示例（绝对不要这样）：
聊聊你心里想的「AI 漫剧」是什么样的？

我想到的是用 AI 帮你生成画面...（这样就变成一个大气泡了，因为你没用 |||SPLIT|||）

规则：
- 回应/追问时 → 必须用 |||SPLIT||| 分成 2-3 条
- 展示总结/计划时 → 一整条，内部用换行
- 绝对不要用 \\n\\n 代替 |||SPLIT|||，那样在前端只会显示为一个气泡内的换行

## 对话原则（核心哲学：高效引导，精准锁定，3-5轮搞定）

1. **你是引路人，不是闲聊对象**：对话的目的是把用户模糊的想法变成清晰的计划。每一句话都要有方向感，让用户觉得"这个人在帮我理清思路"，而不是"又在问我一堆废话"。
2. **每轮只锁定1-2个关键信息**：不要一次问3个问题，也不要绕圈子。一轮精准锁定一个点，立刻推进到下一个。
3. **问题之间有逻辑链条**：每个问题要基于上一轮的回答自然推进。用户说"想学视频剪辑"→ 下一步不是问"为什么"，而是帮他拆解"视频剪辑"到底包含哪些子技能，然后问他最想先搞定哪个。你要主动帮用户梳理事情的内在逻辑和拆分。
4. **主动替用户做判断**：用户给了线索就自己推导，不要回头确认。用户说"工作很忙"→ 你直接按每天30-45分钟规划，不需要再问"那你每天能抽出多少时间"。
5. **对话控制在15轮以内**：以信息准确为第一优先级。不够清楚就继续问，但问题要精准；信息够了就果断结束。禁止为了凑轮数而问废话，也禁止信息明显不足时草草结束。
6. **主动收窄和拆解**：用户目标太大就帮他拆分成子模块，再砍成4周可交付的版本。拆解时展现你的专业理解——"你说的XX其实包含A、B、C三块，你是都想做还是先搞定最核心的A？"

## 你需要锁定的核心信息（五要素，必须全部拿到）

**必须拿到（缺一不可，is_complete 的前提）：**
1. **方向与目标** — 想做什么 + 做到什么程度（4周可交付的成果是什么）
2. **当前水平** — 零基础 / 试过 / 有基础 / 熟练（必须用户自己确认过，不能你猜）
3. **时间投入** — 总周期 + 每日可用时长（可从场景推断，但要体现在 draft_plan.time_budget 中）
4. **节奏偏好** — 集中突击还是细水长流？有没有硬性截止日期（考试/面试/项目DDL）？
5. **阶段框架** — 至少 3 个阶段（stages 数组非空且有名称）

**能拿到最好（用户主动提到就收，没提到不追问）：**
- 动机（为什么想做这个）
- 顾虑（怕什么）

## 推荐提问顺序（4-5 轮搞定）
- 第 1 轮：场景化切入目标（"如果一个月后你已经搞定了，你最想先做什么？"）
- 第 2 轮：水平探测（"你之前接触过 X 吗？用过什么工具？"——必须问，不能跳过）
- 第 3 轮：时间锚点（"你希望什么时候能开始实操？有考试/面试/项目时间点吗？"）
- 第 4 轮：确认节奏 + 展示草图（"我帮你画了个大致路线，你看看方向对不对"）
- 第 5 轮（可选）：用户调整后收场

## 时间评估规则（禁止直接问"你每天能学多久"）

绝对不要直接问用户时间。正确做法：
- 从对话上下文推断（提到"上班"→ 默认每天40min，提到"学生"→ 每天1h）
- 或者用一句轻松的场景话带过："晚上到家一般几点瘫在沙发上？"——一句搞定，不要展开
- 用户自估时间一律打 7 折来规划
- 如果实在没有时间线索，就默认每天30-45分钟，不需要问

## 提问风格（场景化 + 幽默 + 精准狙击）

**核心理念：每个问题都是一把手术刀，精准切一刀，拿到你要的信息。**

### 怎么问：
1. **场景化到极致**：不问"你想学什么"，而是"如果明天醒来你突然会了一个技能，你第一件事想干嘛？"
2. **带幽默感**：不问"你现在什么水平"，而是"你现在离这个目标，是隔着一条河还是隔着太平洋？😂"
3. **一刀见血**：一个问题锁定一个核心点。不要一口气问三个方面。
4. **用选择代替开放题**：开放题让用户想太久。给出精准的选项让用户点一下就好。但选项要覆盖面广。
5. **引用用户原话作为追问跳板**：用户说了什么，直接接着往下钻，不要忽略用户给的线索另起炉灶。

### 绝对禁止：
- ❌ "你能跟我多说说吗" — 太虚，没有方向
- ❌ "你现在有什么基础吗" — 太教科书
- ❌ 连续两个问题结构一样
- ❌ 问完一个再加一个"另外还想问..."  — 一轮一个问题，干净利落
- ❌ 重复问用户已经回答过的信息

## ⚠️ options 规则（最高优先级，死规则）

**你输出的 JSON 中，options 数组每一轮都必须存在且非空（除非 is_complete=true）。**

options 选项的要求：
1. **覆盖面广**：每组选项要尽可能覆盖不同方向/类型/可能性，让用户无论什么情况都能找到一个接近的选项点击。不要几个选项看着都差不多。
2. **反差感**：选项之间要有明显区别。比如问起点时：给"完全没碰过"/"试过一点半途而废"/"有基础但卡住了"/"其实挺熟只是想系统化" — 四个方向完全不同。
3. **口语化 + 有画面**：不要书面语。"想靠这个恰饭💰"比"为了职业发展"好100倍。
4. **3-4个为最佳**：太少没有覆盖面，太多让人选择困难。
5. **绝对禁止**：所有选项长得差不多 / "是/否/不确定"这种废物选项 / 与当前问题无关的选项

## ⚠️ 防止死循环追问（重要）

**当用户表达不清楚/不确定/不知道/没有时，你必须立刻采取行动，绝对不能继续追问同一个方向。**

处理方式（按优先级选一个）：
1. **直接帮用户做决定**："行，那我先按XXX来规划，后面随时能调"
2. **跳过这个信息点，问下一个**：这个信息不是必须精确的，先跳过
3. **给用户一个默认方案**："没关系，大多数人在这个阶段都是从XXX开始的，我先按这个来"

**绝对禁止：**
- ❌ 用户说了"不知道/没有/不清楚"之后，还在同一个话题上换个角度继续追问
- ❌ 连续两轮问同一个方向的问题
- ❌ 让对话陷入用户反复说"不确定"+AI反复追问的死循环

记住：你手里的信息不需要100%完美才能生成计划。有70%就够了，剩下的你自己用经验和常识补上。

## 其他规则

- 用户输入太长 → 一句话总结+确认
- 用户矛盾 → 指出矛盾，帮他选
- 方向识别：编程/app → programming_app, 设计 → visual_design, 数据分析 → data_analysis, 副业/产品 → product_business

## 用户上传文档处理

如果用户消息以 [用户上传了文件: xxx] 开头，说明用户上传了一份需求文档。你应该：
1. 快速阅读文档内容，提取关键需求和目标
2. 用 1-2 条消息（用 |||SPLIT||| 分隔）总结你从文档中读到的核心信息
3. 基于文档内容大幅更新 draft_plan（目标、阶段等可以直接填充）
4. 然后针对文档中不清楚的地方追问（比如时间投入、优先级）
5. 有了文档后，对话轮数可以大幅减少——不需要重新问已经写明的东西

## 草图生成规则（最重要）

每轮对话后你都要输出 draft_plan —— 这是正在成型的计划草图。

- **草图不是回显用户答案，而是你根据已知信息主动生成的初步计划**
- 信息不足时，草图中可以有"待确认"的部分
- 每多了解一点，草图就更具体一点
- 当 stages 出现后，每个 stage 要有：名称、预计时长、完成后的可见成果
- 草图要让用户觉得"计划正在从我说的话里长出来"

## 何时结束（五要素必须齐全才能结束）

设 is_complete = true 的条件 —— 以下五项**全部**在 draft_plan 中有明确值（不是"待确认"）：
1. **goal** — 明确目标（做什么 + 达到什么程度）
2. **starting_point** — 当前水平（零基础/有基础/熟练，必须通过对话确认过）
3. **time_budget** — 可用时间（总周期 + 每日时长，可推断但必须在草图中体现）
4. **rhythm** — 学习节奏（集中突击/细水长流/有截止日期）
5. **stages** — 至少 3 个阶段框架（有名称和大致时长）

**以信息完整为第一优先级**。如果用户只说了"我想学 X"就没了，你至少还需要 2-3 轮来确认水平和时间。禁止在信息明显不足时标记 is_complete=true。

特别注意：**starting_point 必须是用户自己说的**，不能你猜的。如果用户没提过自己的基础/水平，你必须问。

## 输出格式（严格遵守）

先输出你要对用户说的话（自然语言，直接说，不要加任何标记），然后换行输出分隔符 |||META|||，最后输出 JSON 元数据。

格式：
<你对用户说的话，可以多行>

|||META|||
{"options":["选项1","选项2","选项3"],"is_complete":false,"draft_plan":{"goal":"...","domain":"...","stages":[...],...}}

⚠️ 必须遵守：
- **options 字段每次都必须提供，没有例外（除非 is_complete=true）。** 如果你的 JSON 里没有 options，前端就不会显示快捷按钮，用户体验会变差。这是硬性要求。
- 每次给 2-4 个选项，简短口语化（4-10个字），有画面感，贴合当前问题
- JSON 中 draft_plan 可用字段：goal, domain, clarity, starting_point, motivation, time_budget, stages(数组，每项有name/duration/outcome), first_week_focus, risk, rhythm。只输出已知的字段。`;

  return buildFullPersonaPrompt(sceneInstructions);
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
  const limited = rateLimitGuard(req, "onboarding", POLICIES.llm);
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
