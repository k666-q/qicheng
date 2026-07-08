// 锚点卡库：所有学过内容的本质提取沉淀。
// key 约定：任务用 taskChatKey（标题组合），知识节点用 nodeId。

import type { AnchorCard } from "./depth-types";

const STORAGE_KEY = "qc_anchor_cards";

type AnchorStore = Record<string, AnchorCard>;

export function loadAnchorCards(): AnchorStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as AnchorStore;
  } catch {
    return {};
  }
}

export function getAnchorCard(key: string): AnchorCard | null {
  return loadAnchorCards()[key] || null;
}

export function saveAnchorCard(key: string, card: Omit<AnchorCard, "createdAt"> & { createdAt?: number }) {
  if (typeof window === "undefined") return;
  const store = loadAnchorCards();
  store[key] = { ...card, createdAt: card.createdAt ?? Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}
