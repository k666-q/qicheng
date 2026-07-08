import type { LearningSpec, SpecProgress } from "./spec-types";

const SPECS_KEY = "qc_learning_specs";
const PROGRESS_KEY = "qc_spec_progress";

/** 读取缓存的 LearningSpec */
export function getCachedSpec(nodeId: string): LearningSpec | null {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(SPECS_KEY) || "{}");
    return all[nodeId] || null;
  } catch {
    return null;
  }
}

/** 缓存 LearningSpec */
export function cacheSpec(spec: LearningSpec): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(SPECS_KEY) || "{}");
    all[spec.nodeId] = spec;
    localStorage.setItem(SPECS_KEY, JSON.stringify(all));
  } catch { /* ignore quota errors */ }
}

/** 读取节点的分层学习进度 */
export function getSpecProgress(nodeId: string): SpecProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    return all[nodeId] || null;
  } catch {
    return null;
  }
}

/** 保存节点的分层学习进度 */
export function saveSpecProgress(progress: SpecProgress): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    all[progress.nodeId] = progress;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch { /* ignore quota errors */ }
}

/** 初始化一个 spec 的进度记录 */
export function initSpecProgress(spec: LearningSpec): SpecProgress {
  return {
    nodeId: spec.nodeId,
    layers: spec.layers.map((l) => ({
      layerId: l.id,
      status: "pending",
      attempts: 0,
      correctCount: 0,
    })),
    currentLayerIndex: 0,
    startedAt: Date.now(),
  };
}

/** 标记某层完成 */
export function markLayerPassed(progress: SpecProgress, layerIndex: number): SpecProgress {
  const updated = { ...progress, layers: [...progress.layers] };
  updated.layers[layerIndex] = {
    ...updated.layers[layerIndex],
    status: "passed",
    completedAt: Date.now(),
  };
  if (layerIndex + 1 < updated.layers.length) {
    updated.currentLayerIndex = layerIndex + 1;
  } else {
    updated.completedAt = Date.now();
  }
  return updated;
}

/** 检查用户是否已通过 understand 层（用于 markLearned 门槛判定） */
export function hasPassedUnderstand(nodeId: string): boolean {
  const progress = getSpecProgress(nodeId);
  if (!progress) return false;
  return progress.layers.some(
    (l) => l.status === "passed" && l.layerId.includes("understand")
  );
}
