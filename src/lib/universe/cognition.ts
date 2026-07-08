// 认知层：从已点亮节点推导用户的认知维度积分。
// 纯函数计算，无额外存储 —— 已学节点集合就是唯一数据源。

import type { KnowledgeGraph, KnowledgeNode } from "./types";

export type CognitionDimId =
  | "abstract"
  | "logic"
  | "system"
  | "modeling"
  | "expression"
  | "aesthetic";

export type CognitionDimension = {
  id: CognitionDimId;
  name: string;
  color: string;
};

export const COGNITION_DIMENSIONS: CognitionDimension[] = [
  { id: "abstract", name: "抽象思维", color: "#a78bfa" },
  { id: "logic", name: "逻辑推理", color: "#60a5fa" },
  { id: "system", name: "系统思维", color: "#34d399" },
  { id: "modeling", name: "建模能力", color: "#fbbf24" },
  { id: "expression", name: "表达沟通", color: "#f472b6" },
  { id: "aesthetic", name: "审美感知", color: "#2dd4bf" },
];

export const DIM_BY_ID = new Map(COGNITION_DIMENSIONS.map((d) => [d.id, d]));

/** 单个节点的认知贡献值（难度越高贡献越大） */
export function nodeContribution(node: KnowledgeNode): number {
  return node.difficulty;
}

/** 节点的主认知维度（取 cognition_tags 第一个） */
export function primaryDimOfNode(node: KnowledgeNode): CognitionDimension | null {
  const tag = node.cognition_tags?.[0];
  if (!tag) return null;
  return DIM_BY_ID.get(tag as CognitionDimId) ?? null;
}

export type CognitionResult = {
  /** 各维度积分 */
  dims: Record<CognitionDimId, number>;
  /** 总认知值（各维度之和） */
  total: number;
  /** 各学科累积认知贡献 */
  bySubject: Map<string, number>;
  /** 各节点贡献值（仅已学节点） */
  byNode: Map<string, number>;
};

/** 从已学节点集合计算认知维度积分 */
export function computeCognition(learned: Set<string>, graph: KnowledgeGraph): CognitionResult {
  const dims: Record<CognitionDimId, number> = {
    abstract: 0,
    logic: 0,
    system: 0,
    modeling: 0,
    expression: 0,
    aesthetic: 0,
  };
  const bySubject = new Map<string, number>();
  const byNode = new Map<string, number>();

  for (const node of graph.nodes) {
    if (!learned.has(node.id)) continue;
    const value = nodeContribution(node);
    byNode.set(node.id, value);
    bySubject.set(node.subjectId, (bySubject.get(node.subjectId) || 0) + value);
    for (const tag of node.cognition_tags || []) {
      if (tag in dims) dims[tag as CognitionDimId] += value;
    }
  }

  const total = Object.values(dims).reduce((s, v) => s + v, 0);
  return { dims, total, bySubject, byNode };
}

/** 学完一个节点带来的各维度增量（用于庆祝 toast） */
export function nodeDimGains(node: KnowledgeNode): { dim: CognitionDimension; gain: number }[] {
  const value = nodeContribution(node);
  const gains: { dim: CognitionDimension; gain: number }[] = [];
  for (const tag of node.cognition_tags || []) {
    const dim = DIM_BY_ID.get(tag as CognitionDimId);
    if (dim) gains.push({ dim, gain: value });
  }
  return gains;
}
