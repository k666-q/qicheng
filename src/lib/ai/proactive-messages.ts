/**
 * 六种情境主动消息
 * 根据用户状态触发，每种情境有独特的消息风格和目的
 */

import { getEvents, getEventsByType, getDaysSinceLastActive, getLastEvent } from "@/lib/profile/events";
import { getMilestones } from "@/lib/milestones/store";

export type ProactiveMessageType =
  | "streak_maintain"     // 连续活跃，保持节奏
  | "gentle_return"       // 短期离开（1-2天），轻触
  | "real_return"         // 较长离开（3-7天），正式回归
  | "long_absence"        // 长期离开（7天+），重建连接
  | "milestone_achieved"  // 达成里程碑，庆祝
  | "low_mood_detected";  // 检测到情绪低落

export type ProactiveMessage = {
  type: ProactiveMessageType;
  emoji: string;
  content: string;
  cta?: string;
  priority: number; // 1-10, 越高越优先
};

export function detectProactiveMessage(): ProactiveMessage | null {
  if (typeof window === "undefined") return null;

  const messages: ProactiveMessage[] = [];

  const daysAway = getDaysSinceLastActive();
  const lastMood = getLastEvent("emotion_checkin");
  const completedTasks = getEventsByType("task_completed");
  const allEvents = getEvents();
  const milestones = getMilestones();

  // 连续活跃检测
  if (daysAway === 0 && completedTasks.length > 0) {
    const streak = calculateStreak();
    if (streak >= 3) {
      messages.push({
        type: "streak_maintain",
        emoji: "🚀",
        content: streakMessage(streak, completedTasks[completedTasks.length - 1]?.event_data?.title_plain as string),
        priority: 3,
      });
    }
  }

  // 短期离开（1-2天）
  if (daysAway >= 1 && daysAway <= 2) {
    messages.push({
      type: "gentle_return",
      emoji: "🌙",
      content: gentleReturnMessage(daysAway, completedTasks),
      priority: 5,
    });
  }

  // 中期离开（3-7天）
  if (daysAway >= 3 && daysAway <= 7) {
    messages.push({
      type: "real_return",
      emoji: "👀",
      content: realReturnMessage(daysAway, completedTasks),
      cta: "今天就做 5 分钟",
      priority: 7,
    });
  }

  // 长期离开（7天以上）
  if (daysAway > 7) {
    messages.push({
      type: "long_absence",
      emoji: "•",
      content: longAbsenceMessage(daysAway, completedTasks, milestones.length),
      cta: "重新开始，零成本",
      priority: 9,
    });
  }

  // 情绪低落检测
  if (lastMood) {
    const moodValue = lastMood.event_data.mood as string;
    const moodTime = new Date(lastMood.created_at);
    const hoursSinceMood = (Date.now() - moodTime.getTime()) / (1000 * 60 * 60);

    if (moodValue === "😫" && hoursSinceMood < 24) {
      messages.push({
        type: "low_mood_detected",
        emoji: "☕",
        content: lowMoodMessage(completedTasks.length, allEvents.length),
        priority: 8,
      });
    }
  }

  // 里程碑达成检测（最近24小时内有新里程碑）
  if (milestones.length > 0) {
    const latest = milestones[milestones.length - 1];
    const hoursSince = (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      messages.push({
        type: "milestone_achieved",
        emoji: "⛰️",
        content: milestoneMessage(latest.title, milestones.length),
        priority: 6,
      });
    }
  }

  if (messages.length === 0) return null;
  messages.sort((a, b) => b.priority - a.priority);
  return messages[0];
}

function calculateStreak(): number {
  const events = getEvents();
  if (events.length === 0) return 0;

  const activeDays = new Set<string>();
  for (const e of events) {
    activeDays.add(new Date(e.created_at).toDateString());
  }

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (activeDays.has(d.toDateString())) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function streakMessage(days: number, lastTask?: string): string {
  const variants = [
    lastTask ? `第 ${days} 天，节奏很稳。` : `连续第 ${days} 天了。`,
    `保持就好，不用加速。`,
    `村上春树每天跑十公里，不多不少。你现在也是这种节奏。`,
  ];
  return variants[days % 3];
}

function gentleReturnMessage(_days: number, completed: ReturnType<typeof getEventsByType>): string {
  if (completed.length > 0) {
    return `回来了。最近还好吗？`;
  }
  return `嗨。最近怎么样？`;
}

function realReturnMessage(days: number, completed: ReturnType<typeof getEventsByType>): string {
  if (completed.length > 0) {
    return `${days} 天没见。是忙还是没心情？——不管哪种都行，只是问问。`;
  }
  return `有段时间了。生活那边还顺利吗？`;
}

function longAbsenceMessage(days: number, _completed: ReturnType<typeof getEventsByType>, _milestoneCount: number): string {
  const variants = [
    `好久不见。不问原因，只想说：门一直开着。`,
    `${days} 天了。想回来随时回来，不想回来也没关系。没有人在记你的考勤。`,
    `回来了就好。海明威说过，"一切破碎之处，愈合后会更坚固"。重新开始不丢人。`,
  ];
  return variants[days % 3];
}

function lowMoodMessage(completedCount: number, _totalEvents: number): string {
  if (completedCount > 5) {
    return `今天状态不好的话，就歇着。你之前做的那些事不会因为你今天休息就消失。`;
  }
  if (completedCount > 0) {
    return `累了就是累了，不需要理由。休息不是放弃，是为了走更远。`;
  }
  return `有时候什么都不想做，这很正常。苏格拉底说"认识你自己"——知道自己累了，本身就是一种清醒。`;
}

function milestoneMessage(title: string, total: number): string {
  if (total === 1) {
    return `新里程碑解锁：「${title}」🎉 这是你的第一步。`;
  }
  return `新里程碑解锁：「${title}」— 已累计 ${total} 个成就。`;
}
