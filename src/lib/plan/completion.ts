/**
 * 统一任务完成口径 — 所有任务完成路径的唯一入口。
 * 解决的问题：之前 plan/detail 勾选、plan/task 完成、first-day 各自独立写入，
 * 导致重复计数和跨页面不一致。
 */

import { trackEvent } from "@/lib/profile/events";
import { recordDailyCompletion } from "@/lib/habit/streak";
import { markLearned } from "@/lib/universe/store";

const TASKS_KEY = "qicheng_tasks_completed";

export type TaskCompletionMeta = {
  taskId: string;
  titlePlain: string;
  titleProfessional?: string;
  domain?: string;
  nodeIds?: string[];
  source: "plan_detail" | "plan_task" | "learn_page" | "first_day";
};

/** 读取已完成任务 ID 集合 */
export function getCompletedTasks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(TASKS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

/** 检查某任务是否已完成 */
export function isTaskCompleted(taskId: string): boolean {
  return getCompletedTasks().has(taskId);
}

/**
 * 统一任务完成函数。
 * - 去重：同一 taskId 只记录一次
 * - 记录到 localStorage Set
 * - 触发事件（用于 profile 统计）
 * - 更新 streak（每日第一次才 +1）
 * - 尝试点亮主宇宙知识节点
 *
 * @returns true 如果这是首次完成，false 如果已经完成过
 */
export function completeTask(meta: TaskCompletionMeta): boolean {
  if (typeof window === "undefined") return false;

  const set = getCompletedTasks();

  if (set.has(meta.taskId)) {
    return false;
  }

  set.add(meta.taskId);
  localStorage.setItem(TASKS_KEY, JSON.stringify([...set]));

  if (meta.source === "first_day") {
    trackEvent("first_day_completed", {
      title_plain: meta.titlePlain,
      domain: meta.domain,
    });
  } else {
    trackEvent("task_completed", {
      taskId: meta.taskId,
      title_plain: meta.titlePlain,
      title_professional: meta.titleProfessional,
      node_ids: meta.nodeIds || [],
      source: meta.source,
    });
  }

  recordDailyCompletion();

  if (meta.nodeIds && meta.nodeIds.length > 0) {
    for (const id of meta.nodeIds) {
      if (!id.startsWith("star_")) {
        // D6: 只有通过深化学习 understand 层后才点亮节点
        try {
          const progressStr = localStorage.getItem(`spec_progress_${id}`);
          if (progressStr) {
            const progress = JSON.parse(progressStr);
            if (progress.passedLayers && progress.passedLayers.length >= 2) {
              markLearned(id);
            }
          }
        } catch {
          // 如果无法读取进度，保守不点亮
        }
      }
    }
  }

  return true;
}

/**
 * 取消任务完成（plan/detail 的反勾选）
 */
export function uncompleteTask(taskId: string): void {
  if (typeof window === "undefined") return;
  const set = getCompletedTasks();
  set.delete(taskId);
  localStorage.setItem(TASKS_KEY, JSON.stringify([...set]));
}

/**
 * 获取实际完成的任务数量（去重后的真实数据）
 */
export function getCompletedCount(): number {
  return getCompletedTasks().size;
}

/**
 * 生成稳定的 taskId。
 * 格式：s{stageIndex}_t{taskIndex}_{titlePlain前10字}
 */
export function buildTaskId(stageIndex: number, taskIndex: number, titlePlain: string): string {
  const slug = titlePlain.slice(0, 10).replace(/\s+/g, "_");
  return `s${stageIndex}_t${taskIndex}_${slug}`;
}
