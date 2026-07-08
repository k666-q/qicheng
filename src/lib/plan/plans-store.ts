/**
 * 多计划仓库（星际档案馆数据层）。
 *
 * 设计：qc_plans 存所有计划的完整档案；qicheng_plan / qicheng_plan_intro /
 * qicheng_plan_versions 三个单槽 key 保留为「当前活跃计划」的镜像，
 * 全项目十几处直接读镜像的消费方（宇宙页、学习页、任务页、情绪曲线等）无需改动。
 *
 * 切换计划 = 把选中档案写入镜像，并清掉计划专属的单实例缓存
 * （情绪曲线、计划开始时间），换计划后由对应页面自动重新生成。
 */

import type { GeneratedPlan } from "./types";
import { saveSessionItem, loadSessionItem } from "./store";
import { loadSmallUniverses, saveSmallUniverses, getActiveUniverseId, setActiveUniverseId, ensureSmallUniverseForPlan, pruneOrphanUniverses } from "@/lib/universe/small-universe";
import { loadGraph } from "@/lib/universe/store";
import { getPlanRoute } from "@/lib/universe/plan-link";
import { buildPlanStarMap, syncStarCompletions } from "@/lib/universe/plan-star-map";
import { ensureDailyPlan } from "./daily-scheduler";

export type StoredPlanVersion = {
  plan: GeneratedPlan;
  description: string;
  time: string;
};

export type StoredPlan = {
  /** 与小宇宙/日级计划对齐的约定：plan_${title} */
  id: string;
  plan: GeneratedPlan;
  intro: string;
  versions: StoredPlanVersion[];
  createdAt: number;
  updatedAt: number;
};

const PLANS_KEY = "qc_plans";
const ACTIVE_PLAN_KEY = "qc_active_plan_id";

// 镜像 key（现有单计划代码的数据源）
const MIRROR_PLAN = "qicheng_plan";
const MIRROR_INTRO = "qicheng_plan_intro";
const MIRROR_VERSIONS = "qicheng_plan_versions";

export function planIdOf(plan: GeneratedPlan): string {
  return `plan_${plan.title}`;
}

export function loadPlans(): StoredPlan[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PLANS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function savePlans(plans: StoredPlan[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export function getActivePlanId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PLAN_KEY);
}

function setActivePlanId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_PLAN_KEY, id);
  else localStorage.removeItem(ACTIVE_PLAN_KEY);
}

function removeMirrorItem(key: string) {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem("qicheng_backup_" + key);
  } catch { /* ignore */ }
}

/**
 * 把当前镜像（qicheng_plan 等）收编/更新进仓库。
 * 计划详情页在生成、编辑、回退成功后调用，保证仓库始终与镜像同步。
 */
export function upsertPlanFromMirror(): StoredPlan | null {
  const raw = loadSessionItem(MIRROR_PLAN);
  if (!raw) return null;
  let plan: GeneratedPlan;
  try {
    plan = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!plan?.title) return null;

  const intro = loadSessionItem(MIRROR_INTRO) || "";
  let versions: StoredPlanVersion[] = [];
  try {
    versions = JSON.parse(loadSessionItem(MIRROR_VERSIONS) || "[]");
  } catch { /* ignore */ }

  const id = planIdOf(plan);
  const all = loadPlans();
  const idx = all.findIndex((p) => p.id === id);
  const now = Date.now();

  if (idx >= 0) {
    all[idx] = { ...all[idx], plan, intro, versions, updatedAt: now };
  } else {
    all.push({ id, plan, intro, versions, createdAt: now, updatedAt: now });
  }
  savePlans(all);
  setActivePlanId(id);
  return all[idx >= 0 ? idx : all.length - 1];
}

/**
 * 保证计划有对应的小宇宙并设为活跃（幂等）：
 * 已存在则直接激活，不存在则根据计划链路自动创建，并同步日级计划。
 */
export function syncSmallUniverseForPlan(stored: StoredPlan) {
  try {
    // 计划星图：任务=星，阶段=星座。任何计划都必然有小宇宙，不依赖预置图谱覆盖。
    const { starIds } = buildPlanStarMap(stored.plan);
    if (starIds.length === 0) {
      setActiveUniverseId(null);
      return;
    }
    // 对齐式同步：存在则增/删/改名对齐计划，不存在则创建，并设为活跃
    ensureSmallUniverseForPlan(stored.id, stored.plan.title, starIds);
    // 任务完成状态快照（时间流回放数据源）
    syncStarCompletions(stored.id, stored.plan);

    // 日级计划仍基于大宇宙锚定链路（学习页/今日面板用），锚不上则跳过
    const route = getPlanRoute(stored.plan, loadGraph());
    if (route.nodeIds.length > 0) {
      ensureDailyPlan(stored.id, route.nodeIds, Math.max(7, (stored.plan.total_weeks || 1) * 7));
    }
  } catch { /* ignore */ }
}

/**
 * 数据体检（幂等，应用主要入口挂载时调用）：
 * 清理孤儿小宇宙 + 保证活跃小宇宙与活跃计划一致。
 */
export function reconcileUniverses() {
  try {
    const plans = loadPlans();
    pruneOrphanUniverses(new Set(plans.map((p) => p.id)));
    const activeId = getActivePlanId();
    const active = plans.find((p) => p.id === activeId);
    if (active) {
      syncSmallUniverseForPlan(active);
    } else {
      setActiveUniverseId(null);
    }
  } catch { /* ignore */ }
}

/**
 * 激活一个计划：写镜像三件套 + 清掉上一个计划的单实例缓存 + 切换活跃小宇宙。
 */
export function activatePlan(id: string): StoredPlan | null {
  const all = loadPlans();
  const target = all.find((p) => p.id === id);
  if (!target) return null;

  const prevActive = getActivePlanId();

  saveSessionItem(MIRROR_PLAN, JSON.stringify(target.plan));
  saveSessionItem(MIRROR_INTRO, target.intro);
  saveSessionItem(MIRROR_VERSIONS, JSON.stringify(target.versions));
  setActivePlanId(id);

  if (prevActive !== id) {
    // 换了计划：清掉旧计划的单实例缓存，让页面按新计划重新生成
    try {
      localStorage.removeItem("qicheng_emotion_curve");
      localStorage.removeItem("qicheng_plan_start");
    } catch { /* ignore */ }
    // 当前打开的任务上下文属于旧计划，一并清除
    removeMirrorItem("qicheng_current_task");
    removeMirrorItem("qicheng_task_context");
  }
  // 切换到该计划对应的小宇宙；没有则根据计划链路自动创建（幂等）
  syncSmallUniverseForPlan(target);
  return target;
}

/**
 * 删除（销毁）一份计划档案，并清理其小宇宙。
 * 若删除的是活跃计划，则清空镜像与相关缓存。
 */
export function deletePlan(id: string) {
  const all = loadPlans().filter((p) => p.id !== id);
  savePlans(all);

  // 清理对应小宇宙
  try {
    const universes = loadSmallUniverses();
    const target = universes.find((u) => u.planId === id);
    if (target) {
      saveSmallUniverses(universes.filter((u) => u.id !== target.id));
      if (getActiveUniverseId() === target.id) setActiveUniverseId(null);
    }
  } catch { /* ignore */ }

  if (getActivePlanId() === id) {
    setActivePlanId(null);
    removeMirrorItem(MIRROR_PLAN);
    removeMirrorItem(MIRROR_INTRO);
    removeMirrorItem(MIRROR_VERSIONS);
    removeMirrorItem("qicheng_current_task");
    removeMirrorItem("qicheng_task_context");
    try {
      localStorage.removeItem("qicheng_emotion_curve");
      localStorage.removeItem("qicheng_plan_start");
    } catch { /* ignore */ }
  }
}

/**
 * 旧数据迁移：仓库为空但镜像里有计划时，自动收编为第一份档案。
 * 计划集页挂载时调用，幂等。
 */
export function migrateLegacyPlan() {
  if (typeof window === "undefined") return;
  if (loadPlans().length > 0) return;
  upsertPlanFromMirror();
}
