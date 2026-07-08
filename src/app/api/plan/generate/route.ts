import { NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { buildFullPersonaPrompt } from "@/lib/ai/persona";
import { recordEvent } from "@/lib/admin/usage-store";
import { loadGraph } from "@/lib/universe/store";

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

const DOMAIN_TO_SUBJECTS: Record<string, string[]> = {
  programming_app: ["programming", "ai", "data_science"],
  visual_design: ["design", "art", "film"],
  data_analysis: ["data_science", "mathematics", "programming"],
  language: ["english", "linguistics"],
  product_business: ["management", "marketing", "finance", "economics"],
  exam_prep: [],
  general_learning: [],
};

/**
 * 知识宇宙候选节点列表（注入 prompt，让 AI 给任务锚定 node_ids）。
 * 当 domain 已知时只注入相关学科的节点（控制 prompt 长度）；
 * 未知或通用时注入全部。
 */
function buildKnowledgeNodeCatalog(domain?: string): string {
  const graph = loadGraph();
  const subjectName = new Map(graph.subjects.map((s) => [s.id, s.name]));
  const relevantSubjects = domain ? DOMAIN_TO_SUBJECTS[domain] : undefined;
  const filteredNodes =
    relevantSubjects && relevantSubjects.length > 0
      ? graph.nodes.filter((n) => relevantSubjects.includes(n.subjectId))
      : graph.nodes;
  return filteredNodes
    .map((n) => `- ${n.id}（${subjectName.get(n.subjectId) || n.subjectId}·${n.name}）`)
    .join("\n");
}

function inferDomainFromDraft(draft: Record<string, unknown>): string | undefined {
  const text = JSON.stringify(draft).toLowerCase();
  if (/编程|代码|开发|前端|后端|app|web|软件|程序/.test(text)) return "programming_app";
  if (/设计|ui|ux|视觉|平面|logo/.test(text)) return "visual_design";
  if (/数据分析|数据科学|统计|机器学习/.test(text)) return "data_analysis";
  if (/英语|英文|雅思|托福|口语|词汇/.test(text)) return "language";
  if (/产品|创业|副业|商业|运营/.test(text)) return "product_business";
  if (/考试|考研|期末|备考|408|高考/.test(text)) return "exam_prep";
  return undefined;
}

function buildSystemPrompt(draft?: Record<string, unknown>): string {
  const domain = draft ? inferDomainFromDraft(draft) : undefined;
  const sceneInstructions = `## 当前场景：计划生成

**重要：本场景不使用 |||SPLIT||| 分条规则。** 你需要输出一段自然语言介绍 + |||PLAN||| + 完整JSON。不要把JSON拆成多条消息。

用户刚刚完成了引导对话，现在你要把草图变成一份正式的个人计划。

## 核心原则

1. **这是"这个人的计划"，不是课程大纲。** 每个安排都要和用户的具体情况挂钩。
2. **「为什么」是主角。** 先说为什么这么安排，任务是"为什么"的自然结果。
3. **双层语言。** 每个任务必须有"通俗语言"（用户看的，有画面感）和"专业备注"（锚定知识点）。
4. **成果可展示。** 每个阶段结束后用户能拿出一个东西给别人看，不能只是"学完了"。
5. **引用用户原话。** 在"为什么这样安排"中至少引用 1 句用户自己说过的话。
6. **按天分配。** 每个任务必须落到具体哪一天，让用户打开计划就知道今天该做什么。

## 按天分配的精力曲线原则（重要）

任务分配必须考虑一周内每天的精力状态：

- **周一**：一周开始，精力较好。适合有挑战性的新概念、需要深度思考的任务。
- **周二/周三**：状态稳定。适合核心学习任务、练习巩固。
- **周四**：精力开始下降。适合较轻松的任务，如复习、整理笔记、看视频。
- **周五**：一周疲惫累积。安排最轻的任务或休息日。可以做简单回顾。
- **周六**：有整块时间。适合做项目实践、综合运用知识的任务，能看到成果。
- **周末日**：灵活安排。可以是补课/休息/预习下周内容。不要排太满。

注意：
- 以上只是默认规律，如果用户在对话中透露了具体作息（比如周末要上班、周三有课等），以用户实际情况为准。
- 不是每天都必须有任务。让用户有喘息空间。
- 每天安排不超过 1-2 个任务，碎片时间的人每天只排 1 个。

## domain 映射

根据用户实际目标选择最贴切的 domain 值：
- programming_app → 编程/开发类
- visual_design → 设计类
- data_analysis → 数据分析类
- exam_prep → 考试/备考类
- language → 语言学习类
- product_business → 产品/创业/副业类
- general_learning → 其他学习

注意：如果用户是为了考试、备考、期末突击，domain 必须是 "exam_prep"，不要用错。

## 计划结构

生成计划，分 3-4 个阶段。每个阶段包含若干周，每周按天列出任务。

- **name**: 阶段名（简短有力）
- **why**: 为什么这样安排（引用用户原话 + 阶段目标）
- **duration**: 预计时长（如"第 1-2 周"）
- **weeks**: 周列表，每周有：
  - week_number: 第几周
  - theme: 本周主题（一句话）
  - days: 按天分配的任务列表
  - outcome: 本周结束能看到的成果
- **outcome**: 整个阶段的成果

每个 day 包含：
- day: "周一" / "周二" / ... / "周日"
- energy_note: 可选，简短说明为什么这天这样安排（如"精力充沛，啃硬骨头"）
- tasks: 当天的任务列表（通常 1-2 个）

每个 task 包含：
- title_plain: 通俗描述（有画面感）
- title_professional: 专业备注（锚定知识点）
- estimated_minutes: 预计时间（分钟）
- difficulty: 难度 1-10（整数，1=最简单 10=最难。注意要合理分布，不要全部都是5-6，要有真实的难度起伏。简单任务给2-3，适中给4-6，有挑战给7-8，高难度给9-10）
- day_label: 同 day 字段
- reason: 可选，为什么放在这天
- node_ids: 可选，知识宇宙节点 id 数组（0-2 个）。从下方「知识宇宙候选节点」中选择与该任务知识点**明确对应**的节点 id；没有明确对应就输出空数组 []，不要硬凑。
  - **学科一致性**：整份计划的所有 node_ids 必须来自同一个或紧密相关的少数学科（如编程+数学），绝不能因为字面相似就跨到无关学科（如计算机任务锚到设计学节点）。
  - 如果计划的主题领域在候选列表里没有对应学科，则**全部任务的 node_ids 都输出 []**，宁缺毋滥。

## 知识宇宙候选节点

每个任务的 node_ids 只能从以下列表中选（格式：id（学科·节点名））：

${buildKnowledgeNodeCatalog(domain)}

## 双层语言示例

| 通俗语言 | 专业备注 |
|---------|---------|
| 让你的页面从白板变成有模样的东西 | CSS 核心布局与样式系统 |
| 让页面有真实能点击的功能 | JavaScript 事件与状态管理 |
| 让它真实存在于这个世界 | Vercel 部署与线上访问 |
| 让数据不再消失，关掉再打开还在 | 数据库基础与 CRUD 操作 |

## 输出格式

先输出整个计划的自然语言介绍（2-3 句话，给用户看的），然后是分隔符和 JSON。

格式：
<对用户说的话：计划概览介绍，轻松自然，提到他的目标和节奏安排>

|||PLAN|||
{
  "title": "项目名称",
  "domain": "方向(exam_prep/programming_app/...)",
  "total_weeks": 3,
  "stages": [
    {
      "name": "阶段名",
      "why": "为什么这样安排...",
      "duration": "第 1 周",
      "weeks": [
        {
          "week_number": 1,
          "theme": "本周主题",
          "days": [
            {"day": "周一", "energy_note": "精力好，啃新概念", "tasks": [...]},
            {"day": "周三", "tasks": [...]},
            {"day": "周六", "energy_note": "整块时间做项目", "tasks": [...]}
          ],
          "outcome": "本周成果"
        }
      ],
      "outcome": "阶段成果"
    }
  ],
  "first_step": {"task_name": "第一个任务的通俗名称", "minutes": 预计分钟数}
}`;

  return buildFullPersonaPrompt(sceneInstructions);
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

    const userId = req.headers.get("x-user-id") || "anonymous";
    recordEvent(userId, "ai_call:plan-generate", {});

    const client = getClient();
    const model = process.env.AI_MODEL || "deepseek-chat";

    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(parsed.draft) },
        { role: "user", content: buildUserMessage(parsed.draft, parsed.conversationSummary) },
      ],
      max_tokens: 8000,
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
