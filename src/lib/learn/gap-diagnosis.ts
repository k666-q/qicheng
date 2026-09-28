// 认知闭环 MVP：缺口诊断。
// 答错 → 沿前置图谱回溯 → 找到掌握度不足的前置节点 → 生成"回炉"建议。
// 这是"答错 → 诊断 → 补课"的最小闭环；迁移识别、欠条感知规划都在这条路上加东西。

import type { KnowledgeGraph, KnowledgeNode } from "@/lib/universe/types";
import { requiredPrereqLevel, type CycleNumber, type MasteryLevel } from "./cycles";

export type GapCandidate = {
  node: KnowledgeNode;
  /** 距当前节点的前置距离（1 = 直接前置） */
  distance: number;
  currentLevel: MasteryLevel;
  requiredLevel: MasteryLevel;
  /** 建议去的周目 */
  suggestedCycle: CycleNumber;
};

export type GapDiagnosis =
  | { kind: "gap"; primary: GapCandidate; others: GapCandidate[] }
  | { kind: "none" };

/**
 * 诊断当前节点在第 cycle 周目答错时，最可能欠的前置节点。
 * 只看前置边（prerequisites 字段 + edges.type === "prerequisite"），BFS 深度 ≤ maxDepth。
 */
export function diagnoseGap(
  nodeId: string,
  cycle: CycleNumber,
  graph: KnowledgeGraph,
  masteryLevels: Map<string, MasteryLevel>,
  maxDepth = 2
): GapDiagnosis {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const required = requiredPrereqLevel(cycle);

  // 邻接：node → 它的前置
  const prereqOf = new Map<string, Set<string>>();
  const add = (from: string, to: string) => {
    if (!prereqOf.has(from)) prereqOf.set(from, new Set());
    prereqOf.get(from)!.add(to);
  };
  for (const n of graph.nodes) for (const p of n.prerequisites || []) add(n.id, p);
  for (const e of graph.edges) if (e.type === "prerequisite") add(e.target, e.source);

  const seen = new Set<string>([nodeId]);
  const queue: { id: string; depth: number }[] = [{ id: nodeId, depth: 0 }];
  const candidates: GapCandidate[] = [];

  while (queue.length) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const p of prereqOf.get(id) || []) {
      if (seen.has(p)) continue;
      seen.add(p);
      const node = byId.get(p);
      if (!node) continue;
      const level = masteryLevels.get(p) ?? 0;
      if (level < required) {
        candidates.push({
          node,
          distance: depth + 1,
          currentLevel: level,
          requiredLevel: required,
          suggestedCycle: Math.min(4, level + 1) as CycleNumber,
        });
      }
      queue.push({ id: p, depth: depth + 1 });
    }
  }

  if (candidates.length === 0) return { kind: "none" };

  // 近的优先；同距离下缺口大的优先；再按难度低的优先（先补容易补的）
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      (b.requiredLevel - b.currentLevel) - (a.requiredLevel - a.currentLevel) ||
      a.node.difficulty - b.node.difficulty
  );
  const [primary, ...others] = candidates;
  return { kind: "gap", primary, others: others.slice(0, 2) };
}
