// 多周目学习（Multi-Cycle Learning）：同一颗星走多遍，每一遍更深。
// 本文件是周目的"宪法"——服务端 prompt 与客户端 UI 共用同一份定义。
// 学术锚点：Bruner 螺旋式课程；Bjork 合意困难；Bloom 修订版分类。

import type { BloomLevel } from "./spec-types";

/** 0 未学 · 1 初见 · 2 精读 · 3 贯通 · 4 守护 */
export type MasteryLevel = 0 | 1 | 2 | 3 | 4;
/** 周目号 = 目标 MasteryLevel */
export type CycleNumber = 1 | 2 | 3 | 4;

export const MAX_CYCLE: CycleNumber = 4;

export type CyclePersona = {
  /** 角色名（导游 / 教练 / 对手 / 回声） */
  role: string;
  /** 一句话的行为准则，直接进 prompt */
  stance: string;
};

export type CycleDef = {
  cycle: CycleNumber;
  name: string;
  nameEn: string;
  /** 一句话目标（给用户看） */
  goal: string;
  bloom: BloomLevel[];
  persona: CyclePersona;
  /** GAIN 卡的命名口径 */
  gainKind: string;
  /** 认知向量权重（见 cognition.ts） */
  cognitionWeight: number;
  /** 视觉：星的亮度参数 */
  visual: { emissive: number; glow: number; pulse: boolean; tint: string };
  /** 剧本参数 */
  script: {
    quizCount: number;
    huntCount: number;
    useFlash: boolean;
    useBlank: boolean;
    useDiscovery: boolean;
    useSeed: boolean;
    useDebt: boolean;
    /** 第 2 周目：必须逐行 CODE/DERIVE */
    requireDeepDive: boolean;
    /** 第 3 周目：造物主出题 + 融合题 */
    requireCreate: boolean;
    /** 答错时是否给 HINT（脚手架撤除） */
    hintPolicy: "always" | "after_first_wrong" | "never";
    /** 干扰项来源 */
    distractorSource: "obvious" | "misconception" | "edge_case";
  };
  /** 通过条件（客观部分；主观部分由 AI 的 FEEDBACK 判） */
  pass: {
    /** 至少 firstTry 正确的 quiz 比例 */
    minFirstTryRatio: number;
    /** 总结最少字数 */
    minSummaryChars: number;
    /** 不达标时的后果 */
    onFail: "pass_with_note" | "reteach" | "demote";
  };
};

export const CYCLES: Record<CycleNumber, CycleDef> = {
  1: {
    cycle: 1,
    name: "初见",
    nameEn: "First Light",
    goal: "建立地图和直觉：知道它是什么、为什么存在、大概怎么用",
    bloom: ["remember", "understand"],
    persona: {
      role: "导游",
      stance: "热情、多用类比和画面、绝不批评、只在关键处停一下让他猜。目标是让他忘记自己在学习。",
    },
    gainKind: "直觉",
    cognitionWeight: 0.4,
    visual: { emissive: 0.9, glow: 0.15, pulse: false, tint: "#67e8f9" },
    script: {
      quizCount: 1,
      huntCount: 2,
      useFlash: true,
      useBlank: false,
      useDiscovery: true,
      useSeed: false,
      useDebt: false,
      requireDeepDive: false,
      requireCreate: false,
      hintPolicy: "always",
      distractorSource: "obvious",
    },
    pass: { minFirstTryRatio: 0, minSummaryChars: 20, onFail: "pass_with_note" },
  },
  2: {
    cycle: 2,
    name: "精读",
    nameEn: "Deep Dive",
    goal: "能做、能拆、知道为什么：逐行走代码 / 逐步推公式，做题不放水",
    bloom: ["apply", "analyze"],
    persona: {
      role: "教练",
      stance: "要求具体、直接指出错在哪一步、答错先用 HINT 引导再补讲、不夸奖敷衍的回答。语气尊重但不放水。",
    },
    gainKind: "技能",
    cognitionWeight: 1.0,
    visual: { emissive: 1.3, glow: 0.3, pulse: false, tint: "#a78bfa" },
    script: {
      quizCount: 3,
      huntCount: 3,
      useFlash: false,
      useBlank: true,
      useDiscovery: false,
      useSeed: true,
      useDebt: true,
      requireDeepDive: true,
      requireCreate: false,
      hintPolicy: "after_first_wrong",
      distractorSource: "misconception",
    },
    pass: { minFirstTryRatio: 0.66, minSummaryChars: 40, onFail: "reteach" },
  },
  3: {
    cycle: 3,
    name: "贯通",
    nameEn: "Synthesis",
    goal: "迁移、创造、能教别人：把它和别的星连起来，出一道好题，把它讲给我",
    bloom: ["evaluate", "create"],
    persona: {
      role: "对手",
      stance: "苏格拉底式：只问不答，用反例和边界情形逼他自己说清楚。不给提示。他讲对了就追问'为什么'，讲错了就给一个让他的说法崩塌的例子。",
    },
    gainKind: "视角",
    cognitionWeight: 1.8,
    visual: { emissive: 1.8, glow: 0.45, pulse: true, tint: "#f472b6" },
    script: {
      quizCount: 1,
      huntCount: 0,
      useFlash: false,
      useBlank: false,
      useDiscovery: false,
      useSeed: true,
      useDebt: false,
      requireDeepDive: false,
      requireCreate: true,
      hintPolicy: "never",
      distractorSource: "edge_case",
    },
    pass: { minFirstTryRatio: 1, minSummaryChars: 80, onFail: "demote" },
  },
  4: {
    cycle: 4,
    name: "守护",
    nameEn: "Maintain",
    goal: "维持记忆：快速提取，答对即走",
    bloom: ["remember", "apply"],
    persona: {
      role: "回声",
      stance: "极简。不讲解，只提问。答对一句话确认，答错一句话点破。",
    },
    gainKind: "稳固",
    cognitionWeight: 2.0,
    visual: { emissive: 1.6, glow: 0.35, pulse: false, tint: "#fbbf24" },
    script: {
      quizCount: 1,
      huntCount: 0,
      useFlash: false,
      useBlank: false,
      useDiscovery: false,
      useSeed: false,
      useDebt: false,
      requireDeepDive: false,
      requireCreate: false,
      hintPolicy: "never",
      distractorSource: "misconception",
    },
    pass: { minFirstTryRatio: 1, minSummaryChars: 0, onFail: "demote" },
  },
};

export function cycleDef(c: number): CycleDef {
  const n = Math.min(MAX_CYCLE, Math.max(1, Math.round(c))) as CycleNumber;
  return CYCLES[n];
}

/** 已达 level 的节点，下一周目是几 */
export function nextCycleFor(level: MasteryLevel): CycleNumber {
  return Math.min(MAX_CYCLE, level + 1) as CycleNumber;
}

/** 守护周目的间隔调度（天）：1 → 3 → 7 → 21 */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 21];

export function nextReviewAt(reviewCount: number, from = Date.now()): number {
  const days = REVIEW_INTERVALS_DAYS[Math.min(reviewCount, REVIEW_INTERVALS_DAYS.length - 1)];
  return from + days * 24 * 3600 * 1000;
}

/** 缺口诊断用：进入第 c 周目，前置节点至少要到什么 level */
export function requiredPrereqLevel(c: CycleNumber): MasteryLevel {
  return Math.max(1, c - 1) as MasteryLevel;
}
