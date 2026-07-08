#!/usr/bin/env node
// 离线生成某学科的知识图谱 JSON（一次性运行，人工校对后提交进仓库）。
//
// 用法：
//   node scripts/gen-knowledge-graph.mjs "学科名称" 学科id 颜色十六进制
// 示例：
//   node scripts/gen-knowledge-graph.mjs "投资理财" finance "#ec4899"
//
// 依赖环境变量（与项目一致）：AI_API_KEY、AI_BASE_URL(可选)、AI_MODEL(可选)
// 输出：src/data/knowledge-graph/<学科id>.json
//
// 注意：这是预建静态图谱的辅助工具。生成结果需人工校对（节点数量、
// 前置关系是否合理、keywords 是否覆盖常见术语）后再提交。

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));

const [, , subjectName, subjectId, color] = process.argv;

if (!subjectName || !subjectId) {
  console.error('用法: node scripts/gen-knowledge-graph.mjs "学科名称" 学科id [颜色]');
  process.exit(1);
}

const apiKey = process.env.AI_API_KEY;
if (!apiKey) {
  console.error("缺少环境变量 AI_API_KEY");
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
});
const model = process.env.AI_MODEL || "deepseek-chat";

const systemPrompt = `你是一个学科知识图谱构建专家。请为给定学科生成一张知识点网络。

要求：
1. 生成 7-12 个核心知识点节点，从入门到进阶覆盖该学科主干。
2. 每个节点包含：
   - id：英文小写下划线，以学科id为前缀，如 "${subjectId}_basics"
   - subjectId：固定为 "${subjectId}"
   - name：专业名称
   - plain_name：一句通俗易懂的别名
   - description：1-2 句说明这个知识点学什么
   - difficulty：1-10 的整数难度
   - keywords：5-8 个该知识点常见的术语/关键词（中文为主）
3. 生成节点之间的边 edges，体现学习顺序：
   - type "prerequisite"：必须先学 source 才能学 target
   - type "related"：相关但非强制前置
4. 入门节点不应有前置边指向它。

只输出严格 JSON，不要任何额外文字，格式：
{
  "nodes": [ { "id", "subjectId", "name", "plain_name", "description", "difficulty", "keywords" } ],
  "edges": [ { "source", "target", "type" } ]
}`;

const userPrompt = `学科名称：${subjectName}\n学科id：${subjectId}`;

console.log(`正在为「${subjectName}」生成知识图谱...`);

const res = await client.chat.completions.create({
  model,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
  response_format: { type: "json_object" },
  temperature: 0.5,
  max_tokens: 4000,
});

const raw = res.choices[0]?.message?.content || "{}";
let parsed;
try {
  parsed = JSON.parse(raw);
} catch {
  console.error("AI 返回的不是合法 JSON：\n", raw);
  process.exit(1);
}

const output = {
  subject: {
    id: subjectId,
    name: subjectName,
    color: color || "#8b5cf6",
    description: parsed.description || `${subjectName}的核心知识网络。`,
  },
  nodes: parsed.nodes || [],
  edges: parsed.edges || [],
};

const outDir = join(__dirname, "..", "src", "data", "knowledge-graph");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${subjectId}.json`);
writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf-8");

console.log(`已生成 ${output.nodes.length} 个节点、${output.edges.length} 条边`);
console.log(`输出：${outPath}`);
console.log("请人工校对后再提交，并在 src/lib/universe/store.ts 中注册该学科文件。");
