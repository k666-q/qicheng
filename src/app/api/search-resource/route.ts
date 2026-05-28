import { NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { searchBilibili, formatSearchResults } from "@/lib/search/bilibili";
import { buildFullPersonaPrompt } from "@/lib/ai/persona";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  query: z.string(),
  taskContext: z.string().optional(),
});

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.parse(body);

    // Step 1: 搜索 B站真实视频
    const results = await searchBilibili(parsed.query, 8);

    if (results.length === 0) {
      return Response.json({
        success: true,
        recommendations: [],
        fallback: `在 B站搜索「${parsed.query}」可以找到相关视频`,
      });
    }

    // Step 2: 让 AI 从真实结果中挑选最适合的
    const client = getClient();
    const model = process.env.AI_MODEL || "deepseek-chat";

    const sceneInstructions = `## 当前场景：资源筛选

**不使用 |||SPLIT||| 规则。直接输出 JSON。**

用户需要学习资源。我已经帮你搜索了真实存在的视频，你要从中挑选最适合用户当前任务的 1-3 个。

## 规则
1. 只能从下面提供的搜索结果中选择，不能编造任何链接
2. 优先选择：播放量高 + 时长适中（10-30分钟最佳）+ 标题明确对应用户需求
3. 排除：标题党、过长（超60分钟）、明显不相关的
4. 每个推荐写一句话说明为什么选这个（简短）

## 输出格式（严格 JSON）
{
  "picks": [
    {"title": "视频标题", "url": "真实链接", "reason": "一句话推荐理由"}
  ]
}`;

    const systemPrompt = buildFullPersonaPrompt(sceneInstructions);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `用户搜索：${parsed.query}\n${parsed.taskContext ? `任务背景：${parsed.taskContext}\n` : ""}\n## 搜索结果\n\n${formatSearchResults(results)}`,
        },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Response.json({ success: true, recommendations: parsed.picks || [] });
    }

    // Fallback: 直接返回播放量最高的前3个
    const topResults = results
      .sort((a, b) => b.play - a.play)
      .slice(0, 3)
      .map((r) => ({ title: r.title, url: r.url, reason: `${r.play}播放 · ${r.duration}` }));

    return Response.json({ success: true, recommendations: topResults });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
