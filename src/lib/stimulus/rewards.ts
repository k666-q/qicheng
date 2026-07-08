// 奖励进化刺激：思维徽章与能力点的成长轨迹。
// 概念掌握 → 思维徽章；节点完成 → 能力点（=节点难度）。

export type ThinkingBadge = {
  /** 获得的思维名称，如"变化率思维" */
  name: string;
  nodeId: string;
  nodeName: string;
  earnedAt: number;
};

const BADGES_KEY = "qicheng_badges";

export function loadBadges(): ThinkingBadge[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(BADGES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function awardBadge(badge: Omit<ThinkingBadge, "earnedAt">): ThinkingBadge[] {
  const badges = loadBadges().filter((b) => b.nodeId !== badge.nodeId);
  badges.push({ ...badge, earnedAt: Date.now() });
  if (typeof window !== "undefined") {
    localStorage.setItem(BADGES_KEY, JSON.stringify(badges));
  }
  return badges;
}

/**
 * 能力点 = 基于时间递减曲线的加权分数
 * 近7天获得的badge: 10分/个
 * 7-30天: 8分/个
 * 30-90天: 5分/个
 * 90天+: 3分/个
 * 确保"活跃学习"比"僵尸积累"权重更高
 */
export function getAbilityPoints(): number {
  const badges = loadBadges();
  if (badges.length === 0) return 0;
  const now = Date.now();
  const DAY = 86400000;
  let total = 0;
  for (const b of badges) {
    const age = now - b.earnedAt;
    if (age < 7 * DAY) total += 10;
    else if (age < 30 * DAY) total += 8;
    else if (age < 90 * DAY) total += 5;
    else total += 3;
  }
  return total;
}

/**
 * 判断节点是否达到"已学会"标准:
 * 需要在 spec-store 中通过 understand 层
 */
export function hasReachedLearnedThreshold(nodeId: string): boolean {
  try {
    const progressStr = localStorage.getItem(`spec_progress_${nodeId}`);
    if (!progressStr) return false;
    const progress = JSON.parse(progressStr);
    return progress.passedLayers && progress.passedLayers.length >= 2;
  } catch {
    return false;
  }
}
