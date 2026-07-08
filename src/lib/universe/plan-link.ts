// 计划任务 ↔ 知识宇宙节点的锚定与链路计算。
// 核心思路：先推断整个计划所属的「学科域」，所有任务只在域内学科的节点中锚定，
// 避免出现"计算机组成原理匹配到设计学"这类跨域误匹配。
// 优先使用 AI 生成时输出的 node_ids，旧计划用关键词加权匹配兜底。

import type { GeneratedPlan, PlanStage, PlanTask } from "@/lib/plan/types";
import type { KnowledgeGraph, KnowledgeNode } from "./types";

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

/**
 * 学科域：限定任务锚定范围的学科 id 集合。
 * - null：不限定（无计划上下文时的全图匹配）
 * - 空 Set：推断不出可信学科 → 该计划领域未被宇宙收录，不做任何锚定
 */
export type PlanSubjectScope = Set<string> | null;

/** plan.domain → 学科 id 的强提示（exam_prep / general_learning 等内容不定的不映射） */
const DOMAIN_SUBJECT_HINTS: Record<string, string[]> = {
  programming_app: ["programming", "ai"],
  visual_design: ["design", "art"],
  data_analysis: ["data_science"],
  language: ["english", "linguistics"],
  product_business: ["management", "marketing", "finance"],
};

type NodeMatch = { id: string; score: number; subjectId: string };

/**
 * 用任务标题与节点 keywords/name 做加权匹配（收紧版）。
 * 接受条件：节点名整体命中，或至少 2 个不同关键词命中且总分 >= 6。
 * 单个短关键词的巧合命中不再产生锚定。
 */
function scoreTaskAgainstNodes(
  task: Pick<PlanTask, "title_plain" | "title_professional">,
  nodes: KnowledgeNode[]
): NodeMatch[] {
  const text = normalize(`${task.title_professional} ${task.title_plain}`);
  if (!text) return [];

  const scored: NodeMatch[] = [];
  for (const node of nodes) {
    let score = 0;
    let kwHits = 0;
    const name = normalize(node.name);
    const plain = normalize(node.plain_name || "");
    const nameHit =
      (name.length >= 2 && text.includes(name)) ||
      (plain.length >= 2 && text.includes(plain));
    if (nameHit) score += Math.max(name.length, 4) * 3;
    for (const kw of node.keywords) {
      const n = normalize(kw);
      if (n.length < 2) continue;
      if (text.includes(n)) {
        score += n.length;
        kwHits += 1;
      }
    }
    const accepted = nameHit || (kwHits >= 2 && score >= 6);
    if (accepted && score > 0) {
      scored.push({ id: node.id, score, subjectId: node.subjectId });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export function matchTaskToNodes(
  task: Pick<PlanTask, "title_plain" | "title_professional">,
  nodes: KnowledgeNode[],
  maxResults = 2
): string[] {
  return scoreTaskAgainstNodes(task, nodes)
    .slice(0, maxResults)
    .map((s) => s.id);
}

function flattenStageTasks(stage: PlanStage): PlanTask[] {
  const tasks: PlanTask[] = [];
  if (stage.weeks && stage.weeks.length > 0) {
    for (const week of stage.weeks) {
      for (const day of week.days) {
        for (const task of day.tasks) tasks.push(task);
      }
    }
  } else if (stage.tasks) {
    for (const task of stage.tasks) tasks.push(task);
  }
  return tasks;
}

export function flattenPlanTasks(plan: GeneratedPlan): PlanTask[] {
  return plan.stages.flatMap(flattenStageTasks);
}

/**
 * 推断计划所属的学科域。
 * 证据来源（按可信度加权投票）：
 * 1. 任务自带的有效 node_ids → 所属学科 +5/个
 * 2. plan.domain 的强映射 → +6
 * 3. 全部任务标题对各学科节点的关键词匹配得分聚合
 *
 * 取得分 >= 10 且 >= 最高分 40% 的学科。没有任何学科达标 → 空 Set（领域未收录）。
 */
export function inferPlanSubjects(
  plan: GeneratedPlan,
  graph: KnowledgeGraph
): Set<string> {
  const votes = new Map<string, number>();
  const add = (subjectId: string, v: number) =>
    votes.set(subjectId, (votes.get(subjectId) || 0) + v);

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const tasks = flattenPlanTasks(plan);

  // 1. AI 锚定的 node_ids
  for (const task of tasks) {
    for (const id of task.node_ids || []) {
      const node = nodeById.get(id);
      if (node) add(node.subjectId, 5);
    }
  }

  // 2. domain 强提示
  for (const sid of DOMAIN_SUBJECT_HINTS[plan.domain] || []) {
    add(sid, 6);
  }

  // 3. 标题关键词聚合（计划标题也算一条"任务"参与投票）
  const pseudoTasks = [
    ...tasks,
    { title_plain: plan.title, title_professional: plan.title },
  ];
  for (const task of pseudoTasks) {
    const matches = scoreTaskAgainstNodes(task, graph.nodes);
    // 每个任务只取每个学科的最高分节点计票，防止单任务刷分
    const bySubject = new Map<string, number>();
    for (const m of matches) {
      bySubject.set(m.subjectId, Math.max(bySubject.get(m.subjectId) || 0, m.score));
    }
    for (const [sid, s] of bySubject) add(sid, Math.min(s, 12));
  }

  const max = Math.max(0, ...votes.values());
  const result = new Set<string>();
  if (max < 10) return result;
  for (const [sid, v] of votes) {
    if (v >= 10 && v >= max * 0.4) result.add(sid);
  }
  return result;
}

/**
 * 获取任务锚定的节点 id。
 * scope 为学科域：null 不限定；空 Set 表示领域未收录，直接返回空；
 * 非空 Set 则 AI node_ids 与关键词匹配都只在域内节点中生效。
 */
export function getTaskNodeIds(
  task: PlanTask,
  nodes: KnowledgeNode[],
  scope: PlanSubjectScope = null
): string[] {
  if (scope && scope.size === 0) return [];
  const candidates = scope ? nodes.filter((n) => scope.has(n.subjectId)) : nodes;
  if (candidates.length === 0) return [];

  if (task.node_ids && task.node_ids.length > 0) {
    const valid = new Set(candidates.map((n) => n.id));
    const ids = task.node_ids.filter((id) => valid.has(id));
    if (ids.length > 0) return ids;
  }
  return matchTaskToNodes(task, candidates);
}

// 学科域推断结果按计划对象缓存，避免 TaskRow 等高频调用方重复全图扫描
const scopeCache = new WeakMap<GeneratedPlan, Set<string>>();

/** 带缓存的学科域推断（同一个 plan 对象只算一次） */
export function getPlanScope(plan: GeneratedPlan, graph: KnowledgeGraph): Set<string> {
  const cached = scopeCache.get(plan);
  if (cached) return cached;
  const scope = inferPlanSubjects(plan, graph);
  scopeCache.set(plan, scope);
  return scope;
}

export type PlanRoute = {
  /** 计划覆盖的节点 id，按任务出现顺序去重（即有向学习链路的途经点） */
  nodeIds: string[];
  /** 节点 id → 关联到该节点的任务列表 */
  tasksByNode: Map<string, PlanTask[]>;
  /** 推断出的计划学科域；空 Set 表示该领域未被宇宙收录 */
  subjectIds: Set<string>;
};

/** 按 stage/任务顺序计算计划覆盖的知识节点链路（域内锚定） */
export function getPlanRoute(plan: GeneratedPlan, graph: KnowledgeGraph): PlanRoute {
  const subjectIds = getPlanScope(plan, graph);
  const nodeIds: string[] = [];
  const seen = new Set<string>();
  const tasksByNode = new Map<string, PlanTask[]>();

  if (subjectIds.size === 0) {
    return { nodeIds, tasksByNode, subjectIds };
  }

  for (const task of flattenPlanTasks(plan)) {
    for (const id of getTaskNodeIds(task, graph.nodes, subjectIds)) {
      if (!seen.has(id)) {
        seen.add(id);
        nodeIds.push(id);
      }
      const list = tasksByNode.get(id) || [];
      list.push(task);
      tasksByNode.set(id, list);
    }
  }

  return { nodeIds, tasksByNode, subjectIds };
}
