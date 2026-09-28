import { NextRequest } from "next/server";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";
import { z } from "zod";
import OpenAI from "openai";
import { buildFullPersonaPrompt } from "@/lib/ai/persona";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  planTitle: z.string(),
  domain: z.string(),
  totalWeeks: z.number(),
  stages: z.array(z.object({
    name: z.string(),
    duration: z.string(),
  })),
});

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

function buildSystemPrompt(): string {
  const sceneInstructions = `## 当前场景：情绪曲线预测

**重要：本场景不使用 |||SPLIT||| 分条规则。直接输出严格 JSON，不要加其他文字。**

你要根据用户的学习计划，预测他在整个学习旅程中的情绪变化曲线。

## 核心认知

所有学习者都会经历四个阶段：
1. **新手兴奋期**（通常第1-2周）：一切都是新鲜的，动力十足，情绪高涨
2. **黑暗期**（通常第3-4周）：新鲜感消退，难度上升，成果还看不见，最想放弃
3. **突破期**（通常第5-6周）：开始看到回报，和黑暗期形成对比，信心恢复
4. **成熟期**（第7周+）：形成节奏，不需要太多意志力，变成习惯

## 你的判断依据

- 计划总周数：决定每个阶段的相对长度
- 领域难度：编程/数据分析的黑暗期通常更长更深；语言/设计的黑暗期相对温和
- 阶段设计：如果计划前期都是基础知识，黑暗期可能来得晚一些

## 输出格式（严格 JSON）

{
  "phases": [
    {
      "name": "新手兴奋期",
      "week_start": 1,
      "week_end": 2,
      "emotion_level": 8,
      "system_behavior": "刻意简单，让用户先赢一次",
      "message": "享受这个感觉——一切都是新的，进步特别明显。"
    },
    {
      "name": "黑暗期",
      "week_start": 3,
      "week_end": 4,
      "emotion_level": 3,
      "system_behavior": "调轻难度、提前放成果节点、加强触达频率",
      "message": "几乎所有人都在这里想放弃。不是因为你不行，而是新鲜感消退了，成果还没出现。你只需要做一件事：继续出现，哪怕只做 15 分钟。"
    }
  ],
  "curve_points": [
    {"week": 1, "predicted": 8, "label": "一切新鲜"},
    {"week": 2, "predicted": 7},
    {"week": 3, "predicted": 4, "label": "新鲜感消退"},
    {"week": 4, "predicted": 3, "label": "最低谷"}
  ]
}

规则（严格遵守）：
- **curve_points 必须包含从第1周到第N周（N=计划总周数）的所有周，每周一个数据点，一个都不能少。** 如果计划是8周，就必须有8个数据点。
- phases 必须覆盖计划的所有周数，不能遗漏任何一周
- predicted 值 1-10
- 关键转折点加 label
- message 是当用户进入该阶段时可以展示的鼓励（遵守人格规则：不空洞，说事实）`;

  return buildFullPersonaPrompt(sceneInstructions);
}

export async function POST(req: NextRequest) {
  const limited = rateLimitGuard(req, "plan-emotion-curve", POLICIES.llm);
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
          content: `请为以下计划生成情绪预测曲线：\n\n计划：${parsed.planTitle}\n领域：${parsed.domain}\n⚠️ 总周数：${parsed.totalWeeks}（curve_points 必须有 ${parsed.totalWeeks} 个数据点，从第1周到第${parsed.totalWeeks}周）\n阶段：${parsed.stages.map(s => `${s.name}(${s.duration})`).join(" → ")}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ success: false, error: "AI 未返回有效 JSON" }, { status: 500 });
    }

    const curve = JSON.parse(jsonMatch[0]);
    return Response.json({ success: true, curve });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
