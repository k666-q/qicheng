/** 学科深度学习内容规格系统 — 核心类型定义 */

export type LearningSpec = {
  nodeId: string;
  discipline: DisciplineId;
  layers: ContentLayer[];
  prerequisites: string[];
  unlocks: string[];
  misconceptions: string[];
};

export type DisciplineId =
  | "cs"
  | "math"
  | "physics"
  | "language"
  | "humanities"
  | "general";

export type ContentLayer = {
  id: string;
  level: BloomLevel;
  objective: string;
  mustCover: string[];
  output: OutputRequirement[];
  passCriteria: PassCriteria;
  tokenBudget: number;
};

export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export type OutputRequirement =
  | { kind: "concept"; maxChars: number }
  | { kind: "code"; language: string; maxLines: number; mustInclude: string[]; lineByLine: boolean }
  | { kind: "derivation"; maxSteps: number; stepByStep: boolean }
  | { kind: "example"; count: number; contrasting?: boolean }
  | { kind: "exercise"; format: ExerciseFormat; count: number }
  | { kind: "comparison"; items: string[] }
  | { kind: "visual"; description: string };

export type ExerciseFormat =
  | "choice"
  | "fill"
  | "code_fill"
  | "trace"
  | "debug"
  | "free";

export type PassCriteria = {
  minCorrect: number;
  maxAttemptsBeforeReteach: number;
  requireConfirm: boolean;
};

/** 单层学习会话状态（持久化用） */
export type LayerProgress = {
  layerId: string;
  status: "pending" | "in_progress" | "passed" | "skipped";
  attempts: number;
  correctCount: number;
  startedAt?: number;
  completedAt?: number;
};

/** 整个 spec 的学习进度 */
export type SpecProgress = {
  nodeId: string;
  layers: LayerProgress[];
  currentLayerIndex: number;
  startedAt: number;
  completedAt?: number;
};
