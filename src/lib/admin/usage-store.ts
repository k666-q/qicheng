/**
 * 服务端用量统计。
 * 本地开发：JSON 文件存储。
 * Vercel serverless：内存降级（重启后丢失，但不崩溃）。
 * 生产可换成 Supabase 表。
 */

import { join } from "path";

export type UsageEvent = {
  userId: string;
  event: string;
  meta?: Record<string, unknown>;
  timestamp: string;
};

export type UsageData = {
  events: UsageEvent[];
};

const IS_SERVERLESS =
  process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined;

let memoryCache: UsageData = { events: [] };

function ensureFile(): UsageData {
  if (IS_SERVERLESS) return memoryCache;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const fs = require("fs") as typeof import("fs");
    const DATA_DIR = join(process.cwd(), "data");
    const USAGE_FILE = join(DATA_DIR, "usage.json");
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USAGE_FILE)) {
      const init: UsageData = { events: [] };
      fs.writeFileSync(USAGE_FILE, JSON.stringify(init, null, 2));
      return init;
    }
    return JSON.parse(fs.readFileSync(USAGE_FILE, "utf-8"));
  } catch {
    return memoryCache;
  }
}

function saveFile(data: UsageData) {
  if (IS_SERVERLESS) {
    memoryCache = data;
    return;
  }
  try {
    const fs = require("fs") as typeof import("fs");
    const USAGE_FILE = join(process.cwd(), "data", "usage.json");
    fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
  } catch {
    memoryCache = data;
  }
}

export function recordEvent(userId: string, event: string, meta?: Record<string, unknown>) {
  const data = ensureFile();
  data.events.push({
    userId,
    event,
    meta,
    timestamp: new Date().toISOString(),
  });
  if (data.events.length > 10000) {
    data.events = data.events.slice(-10000);
  }
  saveFile(data);
}

export function getStats() {
  const data = ensureFile();
  const events = data.events;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const uniqueUsers = new Set(events.map((e) => e.userId));
  const todayEvents = events.filter((e) => e.timestamp.startsWith(todayStr));
  const todayUsers = new Set(todayEvents.map((e) => e.userId));
  const weekEvents = events.filter((e) => new Date(e.timestamp) >= sevenDaysAgo);
  const weekUsers = new Set(weekEvents.map((e) => e.userId));

  const aiEvents = events.filter((e) => e.event.startsWith("ai_call:"));
  const aiByEndpoint: Record<string, { total: number; today: number }> = {};
  for (const e of aiEvents) {
    const endpoint = e.event.replace("ai_call:", "");
    if (!aiByEndpoint[endpoint]) aiByEndpoint[endpoint] = { total: 0, today: 0 };
    aiByEndpoint[endpoint].total++;
    if (e.timestamp.startsWith(todayStr)) aiByEndpoint[endpoint].today++;
  }

  const userMap: Record<string, { firstSeen: string; lastSeen: string; eventCount: number }> = {};
  for (const e of events) {
    if (!userMap[e.userId]) {
      userMap[e.userId] = { firstSeen: e.timestamp, lastSeen: e.timestamp, eventCount: 0 };
    }
    userMap[e.userId].lastSeen = e.timestamp;
    userMap[e.userId].eventCount++;
  }
  const activeUsers = Object.entries(userMap)
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => b.eventCount - a.eventCount);

  const aiUserMap: Record<string, number> = {};
  for (const e of aiEvents) {
    aiUserMap[e.userId] = (aiUserMap[e.userId] || 0) + 1;
  }
  const topAIUsers = Object.entries(aiUserMap)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    totalUsers: uniqueUsers.size,
    todayActive: todayUsers.size,
    weekActive: weekUsers.size,
    totalEvents: events.length,
    todayEvents: todayEvents.length,
    aiByEndpoint,
    topAIUsers,
    activeUsers: activeUsers.slice(0, 50),
    recentEvents: events.slice(-100).reverse(),
  };
}
