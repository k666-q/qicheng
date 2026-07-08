// 回响系统：跨时间的刺激队列（时间炸弹 / 记忆重构 / 多巴胺延迟 / 认知债务）。
// localStorage 持久化，到期后在宇宙页与计划页浮现"回响"通知。

export type EchoKind =
  | "memory" // 记忆重构：学完 1 天后回忆
  | "seed" // 多巴胺延迟：3 天后回来回答的种子问题
  | "debt"; // 认知债务：你会用了，但还欠原因

export type Echo = {
  id: string;
  nodeId: string;
  nodeName: string;
  kind: EchoKind;
  /** 到期时间戳（ms） */
  dueAt: number;
  /** 提问内容（seed/debt 为 AI 生成的问题；memory 为默认回忆引导） */
  prompt: string;
  createdAt: number;
};

const ECHO_KEY = "qicheng_echoes";

const DAY = 24 * 60 * 60 * 1000;
export const ECHO_DELAY: Record<EchoKind, number> = {
  memory: 1 * DAY,
  seed: 3 * DAY,
  debt: 2 * DAY,
};

export function loadEchoes(): Echo[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ECHO_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEchoes(echoes: Echo[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ECHO_KEY, JSON.stringify(echoes));
}

export function addEcho(input: Omit<Echo, "id" | "createdAt" | "dueAt"> & { dueAt?: number }) {
  const echoes = loadEchoes();
  // 同节点同类型只保留一条（避免重复学叠加）
  const filtered = echoes.filter((e) => !(e.nodeId === input.nodeId && e.kind === input.kind));
  filtered.push({
    ...input,
    id: `${input.nodeId}_${input.kind}_${Date.now()}`,
    dueAt: input.dueAt ?? Date.now() + ECHO_DELAY[input.kind],
    createdAt: Date.now(),
  });
  saveEchoes(filtered);
}

/** 到期待回响的列表（按到期时间升序） */
export function getDueEchoes(now = Date.now()): Echo[] {
  return loadEchoes()
    .filter((e) => e.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function resolveEcho(id: string) {
  saveEchoes(loadEchoes().filter((e) => e.id !== id));
}

/** 节点是否还欠认知债务（详情面板显示欠条徽标） */
export function getNodeDebt(nodeId: string): Echo | null {
  return loadEchoes().find((e) => e.nodeId === nodeId && e.kind === "debt") ?? null;
}
