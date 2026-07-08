const fs = require('fs');
const path = require('path');
const files = ['biology.json','medicine.json','astronomy.json','geography.json','environment.json','electrical.json','mechanical.json'];
const validTags = ['abstract','logic','system','modeling','expression','aesthetic'];
const validEdge = ['prerequisite','related'];
let allOk = true;
for (const f of files) {
  const errs = [];
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')); }
  catch (e) { console.log(`${f}: JSON 非法 -> ${e.message}`); allOk = false; continue; }
  const subjId = data.subject.id;
  const ids = new Set();
  const dupIds = [];
  for (const n of data.nodes) {
    if (ids.has(n.id)) dupIds.push(n.id);
    ids.add(n.id);
    if (n.subjectId !== subjId) errs.push(`节点 ${n.id} subjectId 不匹配`);
    for (const req of ['id','subjectId','name','plain_name','description','difficulty','keywords','cognition_tags']) {
      if (n[req] === undefined) errs.push(`节点 ${n.id} 缺字段 ${req}`);
    }
    if (!Number.isInteger(n.difficulty) || n.difficulty < 1 || n.difficulty > 10) errs.push(`节点 ${n.id} difficulty 不合法`);
    if (!Array.isArray(n.keywords) || n.keywords.length < 4 || n.keywords.length > 8) errs.push(`节点 ${n.id} keywords 数量 ${n.keywords.length}`);
    if (!Array.isArray(n.cognition_tags) || n.cognition_tags.length < 1 || n.cognition_tags.length > 3) errs.push(`节点 ${n.id} cognition_tags 数量异常`);
    for (const t of n.cognition_tags) if (!validTags.includes(t)) errs.push(`节点 ${n.id} 非法 tag ${t}`);
  }
  if (dupIds.length) errs.push(`重复 id: ${dupIds.join(',')}`);
  if (data.nodes.length < 11 || data.nodes.length > 14) errs.push(`节点数 ${data.nodes.length} 超出 11-14`);
  const referenced = new Set();
  for (const e of data.edges) {
    if (!validEdge.includes(e.type)) errs.push(`边 type 非法 ${e.type}`);
    if (!ids.has(e.source)) errs.push(`边 source 不存在 ${e.source}`);
    if (!ids.has(e.target)) errs.push(`边 target 不存在 ${e.target}`);
    if (!e.reason) errs.push(`边 ${e.source}->${e.target} 缺 reason`);
    referenced.add(e.source); referenced.add(e.target);
  }
  const isolated = [...ids].filter(id => !referenced.has(id));
  if (isolated.length) errs.push(`孤立节点: ${isolated.join(',')}`);
  console.log(`\n=== ${f} (${data.subject.name}) ===`);
  console.log(`节点数: ${data.nodes.length} | 边数: ${data.edges.length}`);
  console.log(`节点 id: ${[...ids].join(', ')}`);
  if (errs.length) { console.log('问题: ' + errs.join(' | ')); allOk = false; }
  else console.log('校验: 通过');
}
console.log('\n========================');
console.log(allOk ? '全部 7 个文件校验通过 ✅' : '存在问题 ❌');
