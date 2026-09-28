// 掌握度存储：把"学过 / 没学过"的布尔集合升级为多周目的 MasteryLevel。
// 兼容策略：旧的 qicheng_universe_learned 集合 + 任务推断 = 隐式 level 1；
// 显式记录（qc_mastery）优先。getLearnedNodeIds() 语义不变（level ≥ 1）。

import type { KnowledgeNode } from "./types";
import { getLearnedNodeIds, markLearned } from "./store";
import { nextCycleFor, nextReviewAt, type CycleNumber, type MasteryLevel } from "@/lib/learn/cycles";

export type CycleRecord = {
  cycle: CycleNumber;
  startedAt: number;
  completedAt: number;
  quizTotal: number;
  quizFirstTry: number;
  /** 用户选过的错误选项（"Q2:B" 形式），供误区挖掘 */
  wrongOptions: string[];
  summary?: string;
  passed: boolean;
};

export type NodeMastery = {
  nodeId: string;
  level: MasteryLevel;
  history: CycleRecord[];
  /** 小助理记下的一句话卡点，最多 5 条，最新在前 */
  stickingPoints: string[];
  /** 未还欠条（echo id 或文本） */
  debts: string[];
  lastTouched: number;
  nextReviewAt?: number;
  reviewCount?: number;
};

const KEY = "qc_mastery";
const MAX_STICK = 5;

type Store = Record<string, NodeMastery>;

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function save(store: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(store));
}

function blank(nodeId: string): NodeMastery {
  return { nodeId, level: 0, history: [], stickingPoints: [], debts: [], lastTouched: 0 };
}

/** 单节点掌握度（含隐式 level 1 兼容） */
export function getMastery(nodeId: string, learned?: Set<string>): NodeMastery {
  const store = load();
  const rec = store[nodeId];
  if (rec) return rec;
  const isLearned = learned ? learned.has(nodeId) : false;
  return { ...blank(nodeId), level: isLearned ? 1 : 0 };
}

export function getMasteryLevel(nodeId: string, learned?: Set<string>): MasteryLevel {
  return getMastery(nodeId, learned).level;
}

/** 全图掌握度表：显式记录 ∪ 隐式 level 1 */
export function getMasteryMap(nodes: KnowledgeNode[]): Map<string, MasteryLevel> {
  const map = new Map<string, MasteryLevel>();
  const learned = getLearnedNodeIds(nodes);
  for (const id of learned) map.set(id, 1);
  const store = load();
  for (const [id, rec] of Object.entries(store)) {
    if (rec.level > (map.get(id) || 0)) map.set(id, rec.level);
  }
  return map;
}

/** 该节点下一周目是几 */
export function nextCycleOf(nodeId: string, learned?: Set<string>): CycleNumber {
  return nextCycleFor(getMasteryLevel(nodeId, learned));
}

/** 记录一次周目完成；passed 时 level 升到该周目（只升不降） */
export function recordCycleComplete(nodeId: string, record: CycleRecord): NodeMastery {
  const store = load();
  const rec = store[nodeId] || { ...blank(nodeId), level: getMasteryLevel(nodeId) };
  // 幂等：同一次会话（同 cycle + startedAt）重复收尾时覆盖而不是追加
  const dupIdx = rec.history.findIndex((h) => h.cycle === record.cycle && h.startedAt === record.startedAt);
  const isDup = dupIdx >= 0;
  rec.history = isDup
    ? rec.history.map((h, i) => (i === dupIdx ? record : h))
    : [...rec.history, record].slice(-12);
  rec.lastTouched = record.completedAt;
  if (isDup) {
    // 重复触发不再叠加复习计数，只刷新 level/learned 状态
    if (record.passed) {
      if (record.cycle > rec.level) rec.level = record.cycle;
      markLearned(nodeId);
    }
    store[nodeId] = rec;
    save(store);
    return rec;
  }
  if (record.passed) {
    if (record.cycle > rec.level) rec.level = record.cycle;
    if (record.cycle >= 4) {
      rec.reviewCount = (rec.reviewCount || 0) + 1;
      rec.nextReviewAt = nextReviewAt(rec.reviewCount, record.completedAt);
    } else if (record.cycle === 3) {
      rec.reviewCount = 0;
      rec.nextReviewAt = nextReviewAt(0, record.completedAt);
    }
    // 兼容旧集合：level ≥ 1 即"已学"
    markLearned(nodeId);
  }
  store[nodeId] = rec;
  save(store);
  return rec;
}

/** 第 3 周目不达标 → 掉回第 2 */
export function demote(nodeId: string): NodeMastery {
  const store = load();
  const rec = store[nodeId] || { ...blank(nodeId), level: getMasteryLevel(nodeId) };
  if (rec.level > 1) rec.level = (rec.level - 1) as MasteryLevel;
  rec.lastTouched = Date.now();
  store[nodeId] = rec;
  save(store);
  return rec;
}

/** 小助理记下卡点（去重、最新在前、最多 5 条） */
export function addStickingPoint(nodeId: string, text: string) {
  const t = text.trim();
  if (!t) return;
  const store = load();
  const rec = store[nodeId] || { ...blank(nodeId), level: getMasteryLevel(nodeId) };
  rec.stickingPoints = [t, ...rec.stickingPoints.filter((s) => s !== t)].slice(0, MAX_STICK);
  rec.lastTouched = Date.now();
  store[nodeId] = rec;
  save(store);
}

export function addDebt(nodeId: string, debt: string) {
  const store = load();
  const rec = store[nodeId] || { ...blank(nodeId), level: getMasteryLevel(nodeId) };
  if (!rec.debts.includes(debt)) rec.debts = [...rec.debts, debt].slice(-8);
  rec.lastTouched = Date.now();
  store[nodeId] = rec;
  save(store);
}

export function repayDebt(nodeId: string, debt: string) {
  const store = load();
  const rec = store[nodeId];
  if (!rec) return;
  rec.debts = rec.debts.filter((d) => d !== debt);
  store[nodeId] = rec;
  save(store);
}

/** 到期需要"守护"复习的节点 */
export function getDueForReview(now = Date.now()): string[] {
  const store = load();
  return Object.values(store)
    .filter((r) => r.level >= 3 && r.nextReviewAt && r.nextReviewAt <= now)
    .sort((a, b) => (a.nextReviewAt || 0) - (b.nextReviewAt || 0))
    .map((r) => r.nodeId);
}

/** 有卡点或欠条的节点（供 NG+ 计划生成聚焦） */
export function getGapNodes(): { nodeId: string; stickingPoints: string[]; debts: string[]; level: MasteryLevel }[] {
  const store = load();
  return Object.values(store)
    .filter((r) => r.stickingPoints.length > 0 || r.debts.length > 0)
    .map((r) => ({ nodeId: r.nodeId, stickingPoints: r.stickingPoints, debts: r.debts, level: r.level }));
}

/** 供 prompt 使用的记忆摘要 */
export function memoryFor(nodeId: string, learned?: Set<string>) {
  const m = getMastery(nodeId, learned);
  const last = m.history[m.history.length - 1];
  return {
    level: m.level,
    stickingPoints: m.stickingPoints,
    debts: m.debts,
    prevSummary: last?.summary,
    prevFirstTryRatio: last && last.quizTotal > 0 ? last.quizFirstTry / last.quizTotal : undefined,
    cyclesDone: m.history.filter((h) => h.passed).length,
  };
}
