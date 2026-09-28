// 刺激引擎：为一次"星核探索"组合刺激剧本。
// 钩子按使用历史去重，保证多样性；难度决定交互密度；已掌握节点进入造物主模式。

import type { KnowledgeNode, NodeStatus } from "@/lib/universe/types";
import type { ExploreScript, StimulusId } from "./types";
import { cycleDef } from "@/lib/learn/cycles";

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

/**
 * 为节点生成一次探索剧本。
 * 多周目：剧本参数由周目定义决定（cycles.ts），难度只做微调。
 * 兼容旧签名：传 NodeStatus 时，learned → 第 3 周目（造物主），否则第 1 周目。
 */
export function composeScript(node: KnowledgeNode, cycleOrStatus: number | NodeStatus = 1): ExploreScript {
  const cycle =
    typeof cycleOrStatus === "number" ? cycleOrStatus : cycleOrStatus === "learned" ? 3 : 1;
  const def = cycleDef(cycle);
  const d = node.difficulty;
  const s = def.script;
  return {
    hookId: pickHook(),
    // 第 1 周目：难题多埋一个规律；其余周目按定义
    huntCount: def.cycle === 1 && d >= 6 ? s.huntCount + 1 : s.huntCount,
    quizCount: s.quizCount,
    useFlash: s.useFlash,
    // 第 1 周目只有高难度节点才留空白；第 2 周目固定留
    useBlank: def.cycle === 1 ? d >= 7 : s.useBlank,
    useDiscovery: s.useDiscovery && Math.random() < 0.7,
    useSeed: s.useSeed && (def.cycle >= 2 || d >= 5),
    useDebt: s.useDebt,
    creatorMode: s.requireCreate,
    cycle: def.cycle,
  };
}
