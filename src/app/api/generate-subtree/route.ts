import { NextRequest, NextResponse } from "next/server";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

const SYSTEM_PROMPT = `你是一位教育课程架构师，精通学科知识体系的拆解和组织。
你的任务是为一个知识节点生成其子节点（更细粒度的知识点）。

输出要求（严格 JSON 格式）：
{
  "nodes": [
    {
      "id": "parent_id_child_short_name",
      "name": "子节点中文名",
      "plain_name": "一句话通俗描述",
      "description": "2-3句专业但易懂的描述",
      "difficulty": 5,
      "keywords": ["关键词1", "关键词2", "关键词3"],
      "prerequisites": ["前置节点id（仅限本次生成的兄弟节点）"],
      "hasChildren": true或false,
      "cognition_tags": ["abstract"或"intuition"或"procedural"或"application"等]
    }
  ],
  "edges": [
    { "source": "node_id", "target": "node_id", "type": "prerequisite"或"related" }
  ]
}

规则：
1. 生成 3-7 个子节点，覆盖该知识点的核心子主题
2. id 格式：父节点id去掉学科前缀后 + 子节点英文缩写，用下划线连接
3. difficulty 范围 1-10，要反映该子知识点相对于学科整体的难度
4. prerequisites 只填同层兄弟节点的 id
5. hasChildren：如果该子节点还可以继续拆分则为 true
6. edges 描述节点间的学习顺序关系
7. 保证从易到难的学习路径连通
8. 只输出 JSON，不要任何其他文字`;

export async function POST(req: NextRequest) {
  const limited = rateLimitGuard(req, "generate-subtree", POLICIES.heavy);
  if (limited) return limited;
  try {
    const body = await req.json();
    const { nodeId, nodeName, description, subjectName, subjectId, depth } =
      body;

    if (!nodeId || !nodeName) {
      return NextResponse.json(
        { error: "缺少必要参数 nodeId / nodeName" },
        { status: 400 }
      );
    }

    const client = getClient();

    const userPrompt = `请为以下知识节点生成子知识点：

学科：${subjectName || "未知"}
节点名称：${nodeName}
节点描述：${description || nodeName}
当前深度：${depth ?? 0}（0=学科直属一级节点）
父节点ID：${nodeId}
学科ID：${subjectId || "unknown"}

请生成该节点的子知识点，确保：
- 覆盖该概念的所有核心子主题
- 粒度要足够细，每个子节点对应一个可以在30-60分钟内学习的知识单元
- 子节点 id 前缀使用父节点 id（去掉学科前缀"${subjectId}_"后的部分）`;

    const response = await client.chat.completions.create({
      model: process.env.AI_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("未找到 JSON");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "AI 返回格式解析失败", raw: content.slice(0, 500) },
        { status: 500 }
      );
    }

    const nodes = (parsed.nodes || []).map(
      (n: Record<string, unknown>, i: number) => ({
        id: n.id || `${nodeId}_child_${i}`,
        subjectId: subjectId || "unknown",
        parentId: nodeId,
        name: n.name || `子节点${i + 1}`,
        plain_name: n.plain_name || n.name || "",
        description: n.description || "",
        difficulty: n.difficulty || 5,
        depth: (depth ?? 0) + 1,
        hasChildren: n.hasChildren ?? false,
        keywords: n.keywords || [],
        prerequisites: n.prerequisites || [],
        cognition_tags: n.cognition_tags || [],
      })
    );

    const edges = parsed.edges || [];

    return NextResponse.json({
      parentId: nodeId,
      subjectId: subjectId || "unknown",
      nodes,
      edges,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    console.error("[generate-subtree] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
