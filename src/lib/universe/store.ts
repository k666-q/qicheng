import type {
  KnowledgeGraph,
  KnowledgeNode,
  NodeStatus,
  SubjectGraphFile,
} from "./types";
import { getEventsByType } from "@/lib/profile/events";
import { matchTaskToNodes, getPlanScope } from "./plan-link";
import { loadSessionItem } from "@/lib/plan/store";
import type { GeneratedPlan } from "@/lib/plan/types";

import programming from "@/data/knowledge-graph/programming.json";
import dataScience from "@/data/knowledge-graph/data-science.json";
import design from "@/data/knowledge-graph/design.json";
import mathematics from "@/data/knowledge-graph/mathematics.json";
import physics from "@/data/knowledge-graph/physics.json";
import economics from "@/data/knowledge-graph/economics.json";
import psychology from "@/data/knowledge-graph/psychology.json";
import english from "@/data/knowledge-graph/english.json";
// 自然科学与工程
import chemistry from "@/data/knowledge-graph/chemistry.json";
import biology from "@/data/knowledge-graph/biology.json";
import medicine from "@/data/knowledge-graph/medicine.json";
import astronomy from "@/data/knowledge-graph/astronomy.json";
import geography from "@/data/knowledge-graph/geography.json";
import environment from "@/data/knowledge-graph/environment.json";
import electrical from "@/data/knowledge-graph/electrical.json";
import mechanical from "@/data/knowledge-graph/mechanical.json";
// 人文社科
import history from "@/data/knowledge-graph/history.json";
import philosophy from "@/data/knowledge-graph/philosophy.json";
import literature from "@/data/knowledge-graph/literature.json";
import linguistics from "@/data/knowledge-graph/linguistics.json";
import law from "@/data/knowledge-graph/law.json";
import politics from "@/data/knowledge-graph/politics.json";
import sociology from "@/data/knowledge-graph/sociology.json";
import education from "@/data/knowledge-graph/education.json";
import media from "@/data/knowledge-graph/media.json";
// 商科与应用
import management from "@/data/knowledge-graph/management.json";
import finance from "@/data/knowledge-graph/finance.json";
import marketing from "@/data/knowledge-graph/marketing.json";
import ai from "@/data/knowledge-graph/ai.json";
// 艺术与生活
import music from "@/data/knowledge-graph/music.json";
import art from "@/data/knowledge-graph/art.json";
import film from "@/data/knowledge-graph/film.json";
import architecture from "@/data/knowledge-graph/architecture.json";
import sports from "@/data/knowledge-graph/sports.json";
import crossDiscipline from "@/data/knowledge-graph/cross-discipline.json";
import subjectLinks from "@/data/knowledge-graph/subject-links.json";

const SUBJECT_FILES = [
  programming,
  dataScience, design,
  mathematics, physics, economics, psychology, english,
  chemistry, biology, medicine, astronomy, geography, environment, electrical, mechanical,
  history, philosophy, literature, linguistics, law, politics, sociology, education, media,
  management, finance, marketing, ai,
  music, art, film, architecture, sports,
] as unknown as SubjectGraphFile[];

const LEARNED_KEY = "qicheng_universe_learned";

// 图谱是静态数据，合并一次后缓存（扩到 30+ 学科后每次重新合并代价不小）
let _graphCache: KnowledgeGraph | null = null;

/** 合并所有学科 JSON 为一张完整图谱（含跨学科边） */
export function loadGraph(): KnowledgeGraph {
  if (_graphCache) return _graphCache;
  const subjects = SUBJECT_FILES.map((f) => f.subject);
  const nodes = SUBJECT_FILES.flatMap((f) => f.nodes);
  const intraEdges = SUBJECT_FILES.flatMap((f) => f.edges);
  const crossEdges = (crossDiscipline as { edges: { source: string; target: string; type: string; reason?: string }[] }).edges.map(e => ({
    source: e.source,
    target: e.target,
    type: "cross" as const,
    reason: e.reason,
  }));
  const nodeIds = new Set(nodes.map(n => n.id));
  const validCross = crossEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  const edges = [...intraEdges, ...validCross];
  // 学科级关联边（校验两端学科存在）
  const subjectIds = new Set(subjects.map(s => s.id));
  const subjectEdges = (subjectLinks as { edges: { source: string; target: string; reason: string }[] }).edges
    .filter(e => subjectIds.has(e.source) && subjectIds.has(e.target));
  _graphCache = { subjects, nodes, edges, subjectEdges };
  return _graphCache;
}

// 当前存储计划的学科域缓存（按计划 JSON 串失效）
let _storedScopeKey: string | null = null;
let _storedScopeVal: Set<string> | null = null;

/**
 * 读取当前会话中保存的计划并推断其学科域。
 * 没有计划返回 null（不限定），有计划但领域未收录返回空 Set。
 */
export function getStoredPlanScope(): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const str = loadSessionItem("qicheng_plan");
    if (!str) return null;
    if (_storedScopeKey === str && _storedScopeVal) return _storedScopeVal;
    const plan = JSON.parse(str) as GeneratedPlan;
    _storedScopeKey = str;
    _storedScopeVal = getPlanScope(plan, loadGraph());
    return _storedScopeVal;
  } catch {
    return null;
  }
}

/** 读取用户显式标记已掌握的节点 id 集合 */
export function getExplicitLearned(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const arr = JSON.parse(localStorage.getItem(LEARNED_KEY) || "[]");
    return new Set<string>(arr);
  } catch {
    return new Set();
  }
}

/**
 * 根据已完成任务推断哪些节点已经学过：
 * - 事件带 node_ids（计划生成时锚定）→ 直接点亮
 * - 否则用加权关键词匹配兜底（与 plan-link 共用同一逻辑）
 */
export function getInferredLearned(nodes: KnowledgeNode[]): Set<string> {
  const learned = new Set<string>();
  if (typeof window === "undefined") return learned;

  const completed = getEventsByType("task_completed");
  if (completed.length === 0) return learned;

  const validIds = new Set(nodes.map((n) => n.id));

  for (const e of completed) {
    const data = e.event_data || {};
    const ids = data.node_ids;
    if (Array.isArray(ids) && ids.length > 0) {
      for (const id of ids) {
        if (typeof id === "string" && validIds.has(id)) learned.add(id);
      }
      continue;
    }
    const matched = matchTaskToNodes(
      {
        title_plain: (data.title_plain as string) || (data.title as string) || "",
        title_professional: (data.title_professional as string) || "",
      },
      nodes
    );
    for (const id of matched) learned.add(id);
  }

  return learned;
}

/** 合并显式 + 推断的已掌握节点 */
export function getLearnedNodeIds(nodes: KnowledgeNode[]): Set<string> {
  const explicit = getExplicitLearned();
  const inferred = getInferredLearned(nodes);
  return new Set<string>([...explicit, ...inferred]);
}

export function markLearned(nodeId: string) {
  if (typeof window === "undefined") return;
  const set = getExplicitLearned();
  set.add(nodeId);
  localStorage.setItem(LEARNED_KEY, JSON.stringify([...set]));
}

export function unmarkLearned(nodeId: string) {
  if (typeof window === "undefined") return;
  const set = getExplicitLearned();
  set.delete(nodeId);
  localStorage.setItem(LEARNED_KEY, JSON.stringify([...set]));
}

/**
 * 计算每个知识点节点的状态：
 * - learned：已掌握
 * - available：所有 prerequisite 前置都已掌握（或无前置），可以学
 * - locked：仍有未掌握的前置
 */
export function computeNodeStatuses(
  graph: KnowledgeGraph,
  learned: Set<string>
): Map<string, NodeStatus> {
  const statuses = new Map<string, NodeStatus>();

  // 收集每个节点的前置（prerequisite 类型的入边）
  const prereqs = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.type !== "prerequisite") continue;
    const list = prereqs.get(edge.target) || [];
    list.push(edge.source);
    prereqs.set(edge.target, list);
  }

  for (const node of graph.nodes) {
    if (learned.has(node.id)) {
      statuses.set(node.id, "learned");
      continue;
    }
    const required = prereqs.get(node.id) || [];
    const allMet = required.every((id) => learned.has(id));
    statuses.set(node.id, allMet ? "available" : "locked");
  }

  return statuses;
}
