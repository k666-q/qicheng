// 刺激引擎：为一次"星核探索"组合刺激剧本。
// 钩子按使用历史去重，保证多样性；难度决定交互密度；已掌握节点进入造物主模式。

import type { KnowledgeNode, NodeStatus } from "@/lib/universe/types";
import type { ExploreScript, StimulusId } from "./types";

const HOOK_POOL: StimulusId[] = [
  "truth",
  "forbidden",
  "destiny",
  "civilization",
  "world_crack",
  "time_travel",
];

const HOOK_HISTORY_KEY = "qicheng_hook_history";
const HOOK_HISTORY_MAX = 3;

function getHookHistory(): StimulusId[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HOOK_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function recordHookUsed(hookId: StimulusId) {
  if (typeof window === "undefined") return;
  const history = getHookHistory().filter((h) => h !== hookId);
  history.push(hookId);
  while (history.length > HOOK_HISTORY_MAX) history.shift();
  localStorage.setItem(HOOK_HISTORY_KEY, JSON.stringify(history));
}

function pickHook(): StimulusId {
  const recent = new Set(getHookHistory());
  const fresh = HOOK_POOL.filter((h) => !recent.has(h));
  const pool = fresh.length > 0 ? fresh : HOOK_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 为节点生成一次探索剧本 */
export function composeScript(node: KnowledgeNode, status: NodeStatus): ExploreScript {
  const d = node.difficulty;
  return {
    hookId: pickHook(),
    huntCount: d >= 5 ? 3 : 2,
    quizCount: d >= 4 ? 2 : 1,
    useFlash: true,
    useBlank: d >= 4,
    useDiscovery: Math.random() < 0.5,
    useSeed: d >= 5 && Math.random() < 0.6,
    useDebt: d >= 6 && Math.random() < 0.5,
    creatorMode: status === "learned",
  };
}
