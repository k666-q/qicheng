/**
 * Small Universe (小宇宙) system.
 * Each user can have multiple small universes corresponding to different plans.
 * A small universe is a subset of the big universe, highlighting the user's learning territory.
 */

export type SmallUniverse = {
  id: string;
  name: string;
  createdAt: number;
  /** Plan ID that generated this small universe (if plan-based) */
  planId?: string;
  /** Node IDs belonging to this small universe (references to the big universe) */
  nodeIds: string[];
  /** Custom nodes not in the big universe */
  customNodeIds?: string[];
  /** Completion timestamps: nodeId → timestamp */
  completions: Record<string, number>;
  /** Timeline events for time-flow replay */
  timeline: TimelineEvent[];
};

export type TimelineEvent = {
  nodeId: string;
  timestamp: number;
  action: "completed" | "added" | "started";
};

const STORAGE_KEY = "qc_small_universes";
const ACTIVE_KEY = "qc_active_universe";

/** Load all small universes from localStorage */
export function loadSmallUniverses(): SmallUniverse[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Save all small universes */
export function saveSmallUniverses(universes: SmallUniverse[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(universes));
}

/** Get the currently active small universe ID */
export function getActiveUniverseId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

/** Set the active small universe */
export function setActiveUniverseId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

/** Get the active small universe object */
export function getActiveUniverse(): SmallUniverse | null {
  const id = getActiveUniverseId();
  if (!id) return null;
  const all = loadSmallUniverses();
  return all.find((u) => u.id === id) || null;
}

/** Create a new small universe from a plan */
export function createSmallUniverse(
  name: string,
  nodeIds: string[],
  planId?: string
): SmallUniverse {
  const universe: SmallUniverse = {
    id: `su_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: Date.now(),
    planId,
    nodeIds,
    completions: {},
    timeline: nodeIds.map((nodeId) => ({
      nodeId,
      timestamp: Date.now(),
      action: "added" as const,
    })),
  };

  const all = loadSmallUniverses();
  all.push(universe);
  saveSmallUniverses(all);
  setActiveUniverseId(universe.id);
  return universe;
}

/**
 * Ensure a small universe exists for the given plan and is ALIGNED with it (idempotent).
 * 对齐式同步：以计划链路为准——
 * - 补上计划新增的节点；
 * - 移除已不属于计划的节点（完成记录与时间流同步清理）；
 * - 宇宙名称跟随计划标题。
 * Returns the universe, or null when nodeIds is empty and no universe exists.
 */
export function ensureSmallUniverseForPlan(
  planId: string,
  name: string,
  nodeIds: string[]
): SmallUniverse | null {
  const all = loadSmallUniverses();
  const idx = all.findIndex((u) => u.planId === planId);
  if (idx >= 0) {
    const u = all[idx];
    const target = new Set(nodeIds);
    const existing = new Set(u.nodeIds);
    const toAdd = nodeIds.filter((nid) => !existing.has(nid));
    const removed = u.nodeIds.filter((nid) => !target.has(nid));
    let changed = false;

    if (toAdd.length > 0) {
      u.nodeIds.push(...toAdd);
      for (const nid of toAdd) {
        u.timeline.push({ nodeId: nid, timestamp: Date.now(), action: "added" });
      }
      changed = true;
    }
    if (removed.length > 0) {
      u.nodeIds = u.nodeIds.filter((nid) => target.has(nid));
      for (const nid of removed) delete u.completions[nid];
      u.timeline = u.timeline.filter((e) => target.has(e.nodeId));
      changed = true;
    }
    if (name && u.name !== name) {
      u.name = name;
      changed = true;
    }
    if (changed) saveSmallUniverses(all);
    setActiveUniverseId(u.id);
    return u;
  }
  if (nodeIds.length === 0) return null;
  return createSmallUniverse(name, nodeIds, planId);
}

/**
 * 清理孤儿小宇宙：planId 已不在计划仓库中的一并删除（幂等）。
 * 若活跃 ID 指向被删除的宇宙则清空，交由调用方按活跃计划重新解析。
 */
export function pruneOrphanUniverses(validPlanIds: Set<string>) {
  const all = loadSmallUniverses();
  const kept = all.filter((u) => u.planId && validPlanIds.has(u.planId));
  if (kept.length === all.length) return;
  saveSmallUniverses(kept);
  const activeId = getActiveUniverseId();
  if (activeId && !kept.some((u) => u.id === activeId)) {
    setActiveUniverseId(null);
  }
}

/**
 * 以活跃计划为唯一真源解析当前小宇宙：
 * 返回该计划对应的小宇宙并同步活跃 ID；无计划时返回 null 并清空活跃 ID。
 */
export function resolveUniverseForPlan(planId: string | null): SmallUniverse | null {
  if (!planId) {
    setActiveUniverseId(null);
    return null;
  }
  const target = loadSmallUniverses().find((u) => u.planId === planId) || null;
  setActiveUniverseId(target ? target.id : null);
  return target;
}

/** Mark a node as completed in the active small universe */
export function completeNodeInUniverse(nodeId: string) {
  const id = getActiveUniverseId();
  if (!id) return;
  const all = loadSmallUniverses();
  const idx = all.findIndex((u) => u.id === id);
  if (idx < 0) return;
  // 只记录属于该宇宙的节点，防止外部 id 污染星图
  if (!all[idx].nodeIds.includes(nodeId)) return;

  all[idx].completions[nodeId] = Date.now();
  all[idx].timeline.push({
    nodeId,
    timestamp: Date.now(),
    action: "completed",
  });
  saveSmallUniverses(all);
}

/** Add nodes to the active small universe */
export function addNodesToUniverse(nodeIds: string[]) {
  const id = getActiveUniverseId();
  if (!id) return;
  const all = loadSmallUniverses();
  const idx = all.findIndex((u) => u.id === id);
  if (idx < 0) return;

  const existing = new Set(all[idx].nodeIds);
  const newIds = nodeIds.filter((nid) => !existing.has(nid));
  all[idx].nodeIds.push(...newIds);
  for (const nid of newIds) {
    all[idx].timeline.push({ nodeId: nid, timestamp: Date.now(), action: "added" });
  }
  saveSmallUniverses(all);
}

/** Delete a small universe */
export function deleteSmallUniverse(universeId: string) {
  let all = loadSmallUniverses();
  all = all.filter((u) => u.id !== universeId);
  saveSmallUniverses(all);
  if (getActiveUniverseId() === universeId) {
    setActiveUniverseId(all[0]?.id || null);
  }
}

/** Get completion ratio for a small universe */
export function getUniverseProgress(universe: SmallUniverse): {
  total: number;
  completed: number;
  ratio: number;
} {
  const total = universe.nodeIds.length;
  const completed = Object.keys(universe.completions).length;
  return { total, completed, ratio: total > 0 ? completed / total : 0 };
}
