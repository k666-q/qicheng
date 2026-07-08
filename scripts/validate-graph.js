// 知识宇宙图谱校验脚本：node scripts/validate-graph.js
// 校验所有学科 JSON 的结构、id 唯一性、边引用、认知标签合法性，以及跨学科边。

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "src", "data", "knowledge-graph");
const VALID_TAGS = new Set(["abstract", "logic", "system", "modeling", "expression", "aesthetic"]);
const VALID_EDGE_TYPES = new Set(["prerequisite", "related"]);

const errors = [];
const warnings = [];
const allNodeIds = new Set();
const allSubjectIds = new Set();
let totalNodes = 0;
let totalEdges = 0;

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".json") && f !== "cross-discipline.json" && f !== "subject-links.json");

for (const file of files) {
  const raw = fs.readFileSync(path.join(DIR, file), "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    errors.push(`${file}: JSON 解析失败 - ${e.message}`);
    continue;
  }

  const { subject, nodes, edges } = data;
  if (!subject?.id || !subject?.name || !subject?.color) {
    errors.push(`${file}: subject 缺少 id/name/color`);
    continue;
  }
  if (!subject.category) warnings.push(`${file}: subject 缺少 category`);
  if (allSubjectIds.has(subject.id)) errors.push(`${file}: subject.id 重复 ${subject.id}`);
  allSubjectIds.add(subject.id);

  const localIds = new Set();
  for (const n of nodes || []) {
    if (!n.id || !n.name || !n.plain_name || !n.description) {
      errors.push(`${file}: 节点缺字段 ${n.id || "(无id)"}`);
    }
    if (n.subjectId !== subject.id) errors.push(`${file}: ${n.id} subjectId 不等于 ${subject.id}`);
    if (localIds.has(n.id)) errors.push(`${file}: 节点 id 重复 ${n.id}`);
    if (allNodeIds.has(n.id)) errors.push(`${file}: 节点 id 与其他学科冲突 ${n.id}`);
    localIds.add(n.id);
    allNodeIds.add(n.id);
    if (!Number.isInteger(n.difficulty) || n.difficulty < 1 || n.difficulty > 10) {
      errors.push(`${file}: ${n.id} difficulty 非法 ${n.difficulty}`);
    }
    if (!Array.isArray(n.keywords) || n.keywords.length < 2) {
      warnings.push(`${file}: ${n.id} keywords 过少`);
    }
    for (const t of n.cognition_tags || []) {
      if (!VALID_TAGS.has(t)) errors.push(`${file}: ${n.id} 非法 cognition_tag "${t}"`);
    }
  }
  totalNodes += (nodes || []).length;

  const connected = new Set();
  for (const e of edges || []) {
    if (!VALID_EDGE_TYPES.has(e.type)) errors.push(`${file}: 边类型非法 ${e.type}（${e.source}->${e.target}）`);
    if (!localIds.has(e.source)) errors.push(`${file}: 边 source 不存在 ${e.source}`);
    if (!localIds.has(e.target)) errors.push(`${file}: 边 target 不存在 ${e.target}`);
    connected.add(e.source);
    connected.add(e.target);
  }
  totalEdges += (edges || []).length;

  for (const id of localIds) {
    if (!connected.has(id)) warnings.push(`${file}: 孤立节点 ${id}`);
  }
}

// 跨学科边
const crossPath = path.join(DIR, "cross-discipline.json");
if (fs.existsSync(crossPath)) {
  try {
    const cross = JSON.parse(fs.readFileSync(crossPath, "utf8"));
    let crossCount = 0;
    for (const e of cross.edges || []) {
      if (!allNodeIds.has(e.source)) warnings.push(`cross-discipline: source 不存在 ${e.source}`);
      else if (!allNodeIds.has(e.target)) warnings.push(`cross-discipline: target 不存在 ${e.target}`);
      else crossCount++;
    }
    console.log(`跨学科边: ${(cross.edges || []).length} 条（有效 ${crossCount}）`);
  } catch (e) {
    errors.push(`cross-discipline.json: JSON 解析失败 - ${e.message}`);
  }
}

// 学科级关联边
const subjectLinksPath = path.join(DIR, "subject-links.json");
if (fs.existsSync(subjectLinksPath)) {
  try {
    const sl = JSON.parse(fs.readFileSync(subjectLinksPath, "utf8"));
    let ok = 0;
    for (const e of sl.edges || []) {
      if (!allSubjectIds.has(e.source)) errors.push(`subject-links: source 学科不存在 ${e.source}`);
      else if (!allSubjectIds.has(e.target)) errors.push(`subject-links: target 学科不存在 ${e.target}`);
      else if (!e.reason) warnings.push(`subject-links: ${e.source}->${e.target} 缺少 reason`);
      else ok++;
    }
    console.log(`学科级关联边: ${(sl.edges || []).length} 条（有效 ${ok}）`);
  } catch (e) {
    errors.push(`subject-links.json: JSON 解析失败 - ${e.message}`);
  }
}

console.log(`学科: ${allSubjectIds.size} | 节点: ${totalNodes} | 学科内边: ${totalEdges}`);
if (warnings.length) {
  console.log(`\n⚠ 警告 ${warnings.length} 条:`);
  for (const w of warnings.slice(0, 30)) console.log("  -", w);
  if (warnings.length > 30) console.log(`  …还有 ${warnings.length - 30} 条`);
}
if (errors.length) {
  console.log(`\n✗ 错误 ${errors.length} 条:`);
  for (const e of errors) console.log("  -", e);
  process.exit(1);
}
console.log("\n✓ 校验通过");
