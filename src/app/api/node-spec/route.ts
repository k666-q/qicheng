import { NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { matchDiscipline, getTemplate } from "@/lib/learn/discipline-templates";
import { ALL_SKELETONS, skeletonToPromptText } from "@/lib/learn/domain-skeletons";
import type { LearningSpec, ContentLayer, BloomLevel } from "@/lib/learn/spec-types";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  nodeId: z.string(),
  nodeName: z.string(),
  nodeDescription: z.string(),
  subjectName: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  difficulty: z.number().default(5),
});

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

function buildSpecPrompt(
  nodeName: string,
  nodeDescription: string,
  subjectName: string | undefined,
  keywords: string[],
  difficulty: number
): string {
  const template = matchDiscipline(subjectName || nodeName);
  const skeletonText = ALL_SKELETONS
    .filter((s) => template.matchKeywords.some((kw) => s.domain.includes(kw) || kw.includes(s.domain)))
    .map(skeletonToPromptText)
    .join("\n\n");

  return `你是一位教学设计专家。请为知识节点生成一份结构化的 LearningSpec（学习规格书）。

## 知识节点信息
- 名称：${nodeName}
- 描述：${nodeDescription}
- 学科：${subjectName || "通用"}
- 关键词：${keywords.join(", ") || "无"}
- 难度：${difficulty}/10
- 匹配学科模板：${template.id}

## 学科特征活动
${template.signatureActivities.map((a) => `- ${a}`).join("\n")}

## 常见误区模式
${template.misconceptionPatterns.map((m) => `- ${m}`).join("\n")}

${skeletonText ? `## 权威知识骨架参照\n${skeletonText}` : ""}

## 输出要求

请输出一个 JSON 对象（不要 markdown 代码块包裹），包含以下字段：

{
  "prerequisites": ["先决知识1", "先决知识2"],
  "unlocks": ["解锁的后续知识1"],
  "misconceptions": ["该节点特有的常见误区1", "误区2", "误区3", "误区4"],
  "layers": [
    {
      "id": "l1-remember",
      "level": "remember",
      "objective": "可测量的学习目标（用行为动词：能说出/能列举/能写出）",
      "mustCover": ["必须覆盖的知识点1", "知识点2", "知识点3"],
      "tokenBudget": 900
    },
    {
      "id": "l2-understand",
      "level": "understand",
      "objective": "...",
      "mustCover": ["...", "..."],
      "tokenBudget": 1200
    },
    // ... 继续到 apply, analyze, evaluate, create（至少5层）
  ]
}

## 规则
1. 层级至少 5 层，顺序：remember → understand → apply → analyze → evaluate → create
2. 每层的 objective 必须用可测量的行为动词（禁止"了解/掌握/熟悉"）
3. 每层的 mustCover 至少 2 项
4. 如果是计算机/编程学科，apply 层必须包含代码相关内容
5. 如果是数学/物理学科，apply 和 analyze 层必须包含推导相关内容
6. misconceptions 至少 4 条，必须是该节点特有的真实误区
7. tokenBudget: remember=900, understand=1200, apply=1500-2000, analyze=1800-2000, evaluate=1000, create=800

只输出 JSON，不要其他文字。`;
}

const SpecOutputSchema = z.object({
  prerequisites: z.array(z.string()),
  unlocks: z.array(z.string()),
  misconceptions: z.array(z.string()).min(3),
  layers: z.array(z.object({
    id: z.string(),
    level: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]),
    objective: z.string(),
    mustCover: z.array(z.string()).min(2),
    tokenBudget: z.number(),
  })).min(5),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.parse(body);
    const client = getClient();
    const model = process.env.AI_MODEL || "deepseek-chat";
    const template = matchDiscipline(parsed.subjectName || parsed.nodeName);

    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content: buildSpecPrompt(
                parsed.nodeName,
                parsed.nodeDescription,
                parsed.subjectName,
                parsed.keywords,
                parsed.difficulty
              ),
            },
            {
              role: "user",
              content: attempt === 0
                ? "请生成该知识节点的 LearningSpec。"
                : `上次输出格式有误：${lastError}。请修正后重新输出纯 JSON。`,
            },
          ],
          max_tokens: 3000,
          temperature: 0.3,
          response_format: { type: "json_object" },
        });

        const text = completion.choices[0]?.message?.content || "";
        const json = JSON.parse(text);
        const validated = SpecOutputSchema.parse(json);

        const layers: ContentLayer[] = validated.layers.map((l) => {
          const defaultConfig = template.layerDefaults[l.level as BloomLevel];
          return {
            id: l.id,
            level: l.level as BloomLevel,
            objective: l.objective,
            mustCover: l.mustCover,
            output: defaultConfig?.output || [],
            passCriteria: defaultConfig?.pass || {
              minCorrect: 1,
              maxAttemptsBeforeReteach: 1,
              requireConfirm: false,
            },
            tokenBudget: l.tokenBudget,
          };
        });

        const spec: LearningSpec = {
          nodeId: parsed.nodeId,
          discipline: template.id,
          layers,
          prerequisites: validated.prerequisites,
          unlocks: validated.unlocks,
          misconceptions: validated.misconceptions,
        };

        return Response.json({ success: true, spec });
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Parse error";
      }
    }

    return Response.json(
      { success: false, error: `Failed after 3 attempts: ${lastError}` },
      { status: 500 }
    );
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
