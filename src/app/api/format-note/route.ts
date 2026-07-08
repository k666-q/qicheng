import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

const SYSTEM_PROMPT = `你是一名学习笔记整理助手。用户会给你一段学习笔记（可能格式混乱、没有结构、中英混杂、口语化），你需要将其整理为结构清晰的 Markdown 格式笔记。

整理规则：
1. 保留用户原始内容的所有信息，不要删除或遗漏
2. 添加适当的标题层级（## / ### ）
3. 重要概念用 **加粗** 标注
4. 列表化零散知识点
5. 代码片段用代码块包裹
6. 公式用 LaTeX 格式（$...$）
7. 修正明显的错别字
8. 保持原文的语言（中文/英文不互相翻译）
9. 只输出整理后的 Markdown 内容，不要输出任何解释

即使用户的笔记完全没有 Markdown 格式，你也能将其整理为结构化的 Markdown。`;

export async function POST(req: NextRequest) {
  try {
    const { content, nodeName } = await req.json();

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "笔记内容为空" },
        { status: 400 }
      );
    }

    const client = getClient();
    const model = process.env.AI_MODEL || "deepseek-chat";

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `请整理以下关于「${nodeName || "学习"}」的笔记：\n\n${content}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }, { timeout: 30000 });

    const formatted = completion.choices[0]?.message?.content || "";

    if (!formatted.trim()) {
      return NextResponse.json(
        { error: "AI 返回空内容" },
        { status: 500 }
      );
    }

    return NextResponse.json({ formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
