// 学习会话持久化：
// - 星核探索会话（原始协议文本 + 推进进度），离开页面/刷新后可恢复
// - 任务页对话与拆解记录
// 全部存 localStorage，带条数与体积上限，超限丢弃最旧的记录。

import type { ExploreScript } from "@/lib/stimulus/types";

const EXPLORE_KEY = "qicheng_explore_sessions";
const TASK_CHAT_KEY = "qicheng_task_chats";
const MAX_ENTRIES = 24;
const MAX_BYTES = 1_500_000; // ~1.5MB，给 localStorage 留余量

export type ChatTurn = { role: "user" | "ai"; content: string };

export type ExploreSession = {
  nodeId: string;
  script: ExploreScript;
  /** explore 阶段累计的原始协议文本 */
  exploreText: string;
  /** closing 阶段累计的原始协议文本 */
  closingText: string;
  history: ChatTurn[];
  /** 自由提问线程：问题 + AI 回答原始文本（恢复时重新解析） */
  chatThreads: { q: string; text: string }[];
  visibleCount: number;
  completedIdx: number[];
  phase: "explore" | "closing" | "done";
  updatedAt: number;
};

export type TaskChatRecord = {
  taskKey: string;
  breakdown: unknown | null;
  messages: { role: "ai" | "user"; content: string }[];
  /** 任务流程状态（深化系统），旧记录可能没有 */
  flow?: unknown | null;
  /** 各步骤的深潜序列缓存：step order → DeriveSequence */
  dives?: Record<number, unknown>;
  updatedAt: number;
};

type Store<T> = Record<string, T>;

function loadStore<T extends { updatedAt: number }>(key: string): Store<T> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") as Store<T>;
  } catch {
    return {};
  }
}

function saveStore<T extends { updatedAt: number }>(key: string, store: Store<T>) {
  if (typeof window === "undefined") return;
  try {
    // 条数上限：按更新时间淘汰最旧
    let entries = Object.entries(store);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
      entries = entries.slice(0, MAX_ENTRIES);
    }
    let json = JSON.stringify(Object.fromEntries(entries));
    // 体积上限：继续淘汰最旧直到放得下
    while (json.length > MAX_BYTES && entries.length > 1) {
      entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
      entries = entries.slice(0, Math.max(1, Math.floor(entries.length / 2)));
      json = JSON.stringify(Object.fromEntries(entries));
    }
    localStorage.setItem(key, json);
  } catch {
    // 存储满：清掉该 key 重试一次，再失败就放弃
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

// ── 星核探索会话 ──────────────────────────────────────

export function loadExploreSession(nodeId: string): ExploreSession | null {
  const store = loadStore<ExploreSession>(EXPLORE_KEY);
  return store[nodeId] || null;
}

export function saveExploreSession(session: ExploreSession) {
  const store = loadStore<ExploreSession>(EXPLORE_KEY);
  store[session.nodeId] = { ...session, updatedAt: Date.now() };
  saveStore(EXPLORE_KEY, store);
}

export function clearExploreSession(nodeId: string) {
  const store = loadStore<ExploreSession>(EXPLORE_KEY);
  if (store[nodeId]) {
    delete store[nodeId];
    saveStore(EXPLORE_KEY, store);
  }
}

// ── 任务页对话与拆解 ──────────────────────────────────

/** 任务的稳定 key：标题组合（任务没有可靠的全局 id） */
export function taskChatKey(task: { title_plain: string; title_professional: string }): string {
  return `${task.title_plain}__${task.title_professional}`.slice(0, 120);
}

export function loadTaskChat(taskKey: string): TaskChatRecord | null {
  const store = loadStore<TaskChatRecord>(TASK_CHAT_KEY);
  return store[taskKey] || null;
}

export function saveTaskChat(record: Omit<TaskChatRecord, "updatedAt">) {
  const store = loadStore<TaskChatRecord>(TASK_CHAT_KEY);
  store[record.taskKey] = { ...record, updatedAt: Date.now() };
  saveStore(TASK_CHAT_KEY, store);
}
