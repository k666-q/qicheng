import type { StageCard } from "./types";

const STORAGE_KEY = "qicheng_stage_cards";

export function getStageCards(): StageCard[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveStageCard(card: StageCard) {
  const cards = getStageCards();
  const existing = cards.findIndex((c) => c.stage_index === card.stage_index);
  if (existing >= 0) {
    cards[existing] = card;
  } else {
    cards.push(card);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function getCardByStage(stageIndex: number): StageCard | null {
  const cards = getStageCards();
  return cards.find((c) => c.stage_index === stageIndex) || null;
}
