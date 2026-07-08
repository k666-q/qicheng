/**
 * 计划星图：直接由计划本身实时生成小宇宙。
 *
 * 任务 = 一颗星，阶段 = 一个星座（学科分组），星与星按学习顺序连成链路。
 * 不依赖预置知识图谱的覆盖范围——任何计划都必然有自己的小宇宙。
 *
 * 星的点亮状态来自任务完成记录（qicheng_tasks_completed），
 * 时间戳快照写入 SmallUniverse 存储，供时间流回放使用。
 */

import type { GeneratedPlan, PlanStage, PlanTask } from "@/lib/plan/types";
import type { KnowledgeGraph } from "./types";
import { loadSmallUniverses, saveSmallUniverses } from "./small-universe";

/** 星座配色：按阶段顺序循环取色 */
const STAGE_COLORS = [
  "#22d3ee", // cyan
  "#e879f9", // fuchsia
  "#818cf8", // indigo
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f472b6", // pink
];

export function stageTasks(stage: PlanStage): PlanTask[] {
  if (stage.weeks && stage.weeks.length > 0) {
    return stage.weeks.flatMap((w) => w.days.flatMap((d) => d.tasks));
  }
  return stage.tasks || [];
}

/** 星 id：确定性，由阶段序号 + 阶段内平铺任务序号构成 */
export function starIdOf(stageIndex: number, taskIndex: number): string {
  return `star_s${stageIndex}_t${taskIndex}`;
}

export type PlanStar = {
  id: string;
  stageIndex: number;
  taskIndex: number;
  task: PlanTask;
};

export type PlanStarMap = {
  /** KnowledgeGraph 兼容结构，可直接喂给现有 3D 渲染组件 */
  graph: KnowledgeGraph;
  stars: PlanStar[];
  starIds: string[];
};

/** 由计划实时生成星图（纯函数，无副作用） */
export function buildPlanStarMap(plan: GeneratedPlan): PlanStarMap {
  const stars: PlanStar[] = [];
  const graph: KnowledgeGraph = { subjects: [], nodes: [], edges: [] };

  plan.stages.forEach((stage, si) => {
    const color = STAGE_COLORS[si % STAGE_COLORS.length];
    const subjectId = `stage_${si}`;
    graph.subjects.push({
      id: subjectId,
      name: stage.name,
      color,
      description: stage.why || stage.outcome || "",
      category: "其他",
    });

    stageTasks(stage).forEach((task, ti) => {
      const id = starIdOf(si, ti);
      stars.push({ id, stageIndex: si, taskIndex: ti, task });
      graph.nodes.push({
        id,
        subjectId,
        name: task.title_plain,
        plain_name: task.title_professional,
        description: task.reason || "",
        difficulty: task.difficulty || 3,
        keywords: [],
        depth: 0,
      });
    });
  });

  // 学习顺序链路：跨阶段首尾相连
  for (let i = 0; i < stars.length - 1; i++) {
    const a = stars[i];
    const b = stars[i + 1];
    graph.edges.push({
      source: a.id,
      target: b.id,
      type: a.stageIndex === b.stageIndex ? "prerequisite" : "cross",
      reason: a.stageIndex === b.stageIndex ? "学习顺序" : "进入下一阶段",
    });
  }

  return { graph, stars, starIds: stars.map((s) => s.id) };
}

function loadCompletedTaskSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem("qicheng_tasks_completed") || "[]"));
  } catch {
    return new Set();
  }
}

/**
 * 判断任务是否已完成。
 * 完成记录的 key 格式为 `s{stageIndex}_t{index}_{title前10字}`，
 * 其中 index 在详情页按周分组时会重置，不可靠；
 * 故按「阶段前缀 + 标题后缀」匹配，对索引差异免疫。
 */
export function isTaskCompleted(
  completedSet: Set<string>,
  stageIndex: number,
  task: PlanTask
): boolean {
  const suffix = `_${task.title_plain.slice(0, 10)}`;
  const prefix = `s${stageIndex}_`;
  for (const key of completedSet) {
    if (key.startsWith(prefix) && key.endsWith(suffix)) return true;
  }
  return false;
}

/** 当前计划已点亮的星 id 集合 */
export function getCompletedStarIds(plan: GeneratedPlan): Set<string> {
  const completedSet = loadCompletedTaskSet();
  const done = new Set<string>();
  const { stars } = buildPlanStarMap(plan);
  for (const s of stars) {
    if (isTaskCompleted(completedSet, s.stageIndex, s.task)) done.add(s.id);
  }
  return done;
}

/**
 * 把任务完成状态快照同步进 SmallUniverse 存储（星 id 维度）：
 * - 新完成的星：写入完成时间戳 + 时间流事件；
 * - 被取消勾选的星：移除完成记录与对应事件。
 * 幂等；时间戳在首次观察到完成时记录，供时间流回放。
 */
export function syncStarCompletions(planId: string, plan: GeneratedPlan) {
  if (typeof window === "undefined") return;
  const all = loadSmallUniverses();
  const idx = all.findIndex((u) => u.planId === planId);
  if (idx < 0) return;
  const u = all[idx];

  const done = getCompletedStarIds(plan);
  const valid = new Set(u.nodeIds);
  let changed = false;

  for (const id of done) {
    if (valid.has(id) && !u.completions[id]) {
      u.completions[id] = Date.now();
      u.timeline.push({ nodeId: id, timestamp: Date.now(), action: "completed" });
      changed = true;
    }
  }
  for (const id of Object.keys(u.completions)) {
    if (id.startsWith("star_") && !done.has(id)) {
      delete u.completions[id];
      u.timeline = u.timeline.filter((e) => !(e.nodeId === id && e.action === "completed"));
      changed = true;
    }
  }
  if (changed) saveSmallUniverses(all);
}
