/**
 * Daily Scheduler: splits a plan into per-day assignments,
 * tracks actual completion, and dynamically re-distributes remaining work.
 */

export type DailyAssignment = {
  date: string; // YYYY-MM-DD
  nodeIds: string[];
  completed: string[];
};

export type DailyPlan = {
  planId: string;
  startDate: string;
  assignments: DailyAssignment[];
  /** Minutes per day the user aims to study */
  dailyMinutes: number;
};

const STORAGE_KEY = "qc_daily_plan";

export function loadDailyPlan(): DailyPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDailyPlan(plan: DailyPlan) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

/**
 * Generate a daily plan from a list of node IDs.
 * Distributes nodes evenly across the given number of days,
 * respecting a max nodes-per-day cap (based on dailyMinutes).
 */
export function generateDailyPlan(
  planId: string,
  nodeIds: string[],
  totalDays: number,
  dailyMinutes: number = 60
): DailyPlan {
  const maxPerDay = Math.max(1, Math.ceil(dailyMinutes / 30));
  const adjustedDays = Math.max(totalDays, Math.ceil(nodeIds.length / maxPerDay));
  const nodesPerDay = Math.ceil(nodeIds.length / adjustedDays);

  const startDate = new Date();
  const assignments: DailyAssignment[] = [];

  for (let day = 0; day < adjustedDays; day++) {
    const start = day * nodesPerDay;
    const end = Math.min(start + nodesPerDay, nodeIds.length);
    if (start >= nodeIds.length) break;

    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split("T")[0];

    assignments.push({
      date: dateStr,
      nodeIds: nodeIds.slice(start, end),
      completed: [],
    });
  }

  const plan: DailyPlan = {
    planId,
    startDate: startDate.toISOString().split("T")[0],
    assignments,
    dailyMinutes,
  };

  saveDailyPlan(plan);
  return plan;
}

/**
 * Ensure a daily plan exists for the given plan (idempotent).
 * - Same planId with the same node set → keep existing progress untouched.
 * - Same planId but nodes changed (plan edited) → merge: keep completions,
 *   re-distribute the not-yet-completed nodes from today onwards.
 * - Different/absent plan → generate fresh.
 */
export function ensureDailyPlan(
  planId: string,
  nodeIds: string[],
  totalDays: number,
  dailyMinutes: number = 60
): DailyPlan {
  const existing = loadDailyPlan();
  if (existing && existing.planId === planId) {
    const existingIds = new Set(existing.assignments.flatMap((a) => a.nodeIds));
    const sameSet = nodeIds.length === existingIds.size && nodeIds.every((id) => existingIds.has(id));
    if (sameSet) return existing;

    // 计划被修改：保留已完成记录，未完成节点从今天起重新分配
    const completed = new Set(existing.assignments.flatMap((a) => a.completed));
    const remaining = nodeIds.filter((id) => !completed.has(id));
    const today = new Date().toISOString().split("T")[0];
    const startedDays = existing.assignments.filter((a) => a.date < today).length;
    const daysLeft = Math.max(1, totalDays - startedDays);
    const fresh = generateDailyPlan(planId, remaining, daysLeft, dailyMinutes);
    // 已完成的节点归档为昨天的记录，保持总进度统计正确且不占今日额度
    if (completed.size > 0) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      fresh.assignments.unshift({
        date: yesterday.toISOString().split("T")[0],
        nodeIds: [...completed],
        completed: [...completed],
      });
      saveDailyPlan(fresh);
    }
    return fresh;
  }
  return generateDailyPlan(planId, nodeIds, totalDays, dailyMinutes);
}

/** Get today's assignment */
export function getTodayAssignment(): DailyAssignment | null {
  const plan = loadDailyPlan();
  if (!plan) return null;
  const today = new Date().toISOString().split("T")[0];
  return plan.assignments.find((a) => a.date === today) || null;
}

/** Get remaining (not completed) node IDs for today */
export function getTodayRemaining(): string[] {
  const assignment = getTodayAssignment();
  if (!assignment) return [];
  const done = new Set(assignment.completed);
  return assignment.nodeIds.filter((id) => !done.has(id));
}

/** Mark a node as completed for today and trigger re-distribution if needed */
export function markDailyComplete(nodeId: string) {
  const plan = loadDailyPlan();
  if (!plan) return;
  const today = new Date().toISOString().split("T")[0];
  const todayIdx = plan.assignments.findIndex((a) => a.date === today);
  if (todayIdx < 0) return;

  if (!plan.assignments[todayIdx].completed.includes(nodeId)) {
    plan.assignments[todayIdx].completed.push(nodeId);
  }
  saveDailyPlan(plan);
}

/**
 * Re-distribute unfinished work from past days into future days.
 * Called at the start of each day or when opening the app.
 */
export function rebalancePlan() {
  const plan = loadDailyPlan();
  if (!plan) return;

  const today = new Date().toISOString().split("T")[0];
  const overdue: string[] = [];

  for (const assignment of plan.assignments) {
    if (assignment.date >= today) break;
    const done = new Set(assignment.completed);
    const remaining = assignment.nodeIds.filter((id) => !done.has(id));
    overdue.push(...remaining);
  }

  if (overdue.length === 0) return;

  // Find future assignments (today and after) and distribute overdue evenly
  const futureAssignments = plan.assignments.filter((a) => a.date >= today);
  if (futureAssignments.length === 0) {
    // Add extra days
    const lastDate = plan.assignments[plan.assignments.length - 1]?.date || today;
    const extraDays = Math.ceil(overdue.length / 2);
    for (let i = 1; i <= extraDays; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      plan.assignments.push({
        date: d.toISOString().split("T")[0],
        nodeIds: [],
        completed: [],
      });
    }
  }

  const activeFuture = plan.assignments.filter((a) => a.date >= today);
  const perDay = Math.ceil(overdue.length / activeFuture.length);
  let idx = 0;
  for (const assignment of activeFuture) {
    const chunk = overdue.slice(idx, idx + perDay);
    assignment.nodeIds = [...new Set([...assignment.nodeIds, ...chunk])];
    idx += perDay;
    if (idx >= overdue.length) break;
  }

  saveDailyPlan(plan);
}

/** Get overall daily plan progress */
export function getDailyPlanProgress(): {
  totalNodes: number;
  completedNodes: number;
  daysLeft: number;
  todayCount: number;
  todayDone: number;
} {
  const plan = loadDailyPlan();
  if (!plan) return { totalNodes: 0, completedNodes: 0, daysLeft: 0, todayCount: 0, todayDone: 0 };

  const today = new Date().toISOString().split("T")[0];
  const allNodes = new Set(plan.assignments.flatMap((a) => a.nodeIds));
  const allCompleted = new Set(plan.assignments.flatMap((a) => a.completed));
  const futureDays = plan.assignments.filter((a) => a.date >= today).length;
  const todayAssignment = plan.assignments.find((a) => a.date === today);

  return {
    totalNodes: allNodes.size,
    completedNodes: allCompleted.size,
    daysLeft: futureDays,
    todayCount: todayAssignment?.nodeIds.length || 0,
    todayDone: todayAssignment?.completed.length || 0,
  };
}
