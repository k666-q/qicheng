import type { Milestone, MilestoneType } from "./types";

const STORAGE_KEY = "qicheng_milestones";

export function saveMilestone(
  type: MilestoneType,
  title: string,
  content: string,
  options?: { user_quote?: string; stage?: number; context?: Record<string, unknown> }
) {
  const milestone: Milestone = {
    id: crypto.randomUUID(),
    type,
    title,
    content,
    user_quote: options?.user_quote,
    created_at: new Date().toISOString(),
    stage: options?.stage,
    context: options?.context,
  };

  const existing = getMilestones();
  existing.push(milestone);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return milestone;
}

export function getMilestones(): Milestone[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getFirstMilestone(): Milestone | null {
  const all = getMilestones();
  return all.length > 0 ? all[0] : null;
}

export function getMilestonesByType(type: MilestoneType): Milestone[] {
  return getMilestones().filter((m) => m.type === type);
}

export function getGrowthContrast(): { then: Milestone | null; now: Milestone | null } {
  const all = getMilestones();
  if (all.length < 2) return { then: null, now: null };
  return { then: all[0], now: all[all.length - 1] };
}
