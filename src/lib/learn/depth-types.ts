// 学习深化系统 · 核心数据类型
// 锚点卡（知识本质提取）+ 逐行深潜（推导/代码逐行推进）+ 任务流程状态

/** 知识锚点卡：任何学习内容的普适本质提取（四字段） */
export type AnchorCard = {
  /** 本质：这个知识最关键的是什么（一句话点破） */
  essence: string;
  /** 何时用：什么信号出现时该想起它 */
  when: string;
  /** 用时核心：使用它时脑子里必须端着什么 */
  core: string;
  /** 不可脱离：底线/不变量，一旦违反必错 */
  invariant: string;
  createdAt: number;
};

/** 深潜行内检查的形式 */
export type DeriveCheckKind =
  | "predict" // 预测下一行
  | "blank" // 关键处留空补全
  | "counterfactual"; // 反事实：删掉这行/跳过这步会坏在哪

export type DeriveCheck = {
  kind: DeriveCheckKind;
  question: string;
  /** 2-4 个选项（统一用选择题形式，便于交互） */
  options: string[];
  /** 正确选项下标（0-based） */
  answer: number;
  /** 答错时的引导（不给答案） */
  hint: string;
  /** 揭示后的解析 */
  why: string;
};

/** 深潜的一行：内容 + 人话解释（+ 可选检查点） */
export type DeriveLine = {
  /** 这一行的内容：一步公式变换 / 一行（组）代码 / 一个逻辑环节 */
  content: string;
  /** 人话解释：这行为什么存在、做了什么 */
  explain: string;
  /** 这一步用的规则/依据（数学：变换规则；代码：语言机制），可选 */
  rule?: string;
  /** 行内检查点，可选（每 2-3 行一个） */
  check?: DeriveCheck;
};

/** 一次逐行深潜的完整序列 */
export type DeriveSequence = {
  /** 深潜对象标题（如「梯度下降更新公式」「快速排序核心循环」） */
  title: string;
  /** 开场：整体在干嘛、分几块（1-2 句） */
  intro: string;
  /** 深潜形态：数学推导 / 代码逐行 / 逻辑链 */
  kind: "derivation" | "code" | "logic";
  lines: DeriveLine[];
};

/** 单个步骤的深潜进度 */
export type StepDiveState = {
  /** 已解锁到第几行（0-based，= lines.length 表示完成） */
  current: number;
  total: number;
  /** 「没懂」的次数（复习队列数据源） */
  stuckCount: number;
  done: boolean;
};

/** 任务流程的固定骨架环节 */
export type TaskFlowPhase =
  | "anchor" // 锚点提取
  | "breakdown" // 步骤拆解
  | "deepdive" // 逐行深潜
  | "challenge" // 挑战验证
  | "artifact" // 产出成果
  | "done"; // 点亮星辰

/** 任务流程状态（持久化到任务会话） */
export type TaskFlowState = {
  phase: TaskFlowPhase;
  anchorDone: boolean;
  breakdownDone: boolean;
  /** 步骤 order → 深潜进度 */
  diveStates: Record<number, StepDiveState>;
  challengeDone: boolean;
  artifactDone: boolean;
};

export function initialFlowState(): TaskFlowState {
  return {
    phase: "anchor",
    anchorDone: false,
    breakdownDone: false,
    diveStates: {},
    challengeDone: false,
    artifactDone: false,
  };
}

/** 由状态推导当前应处的环节（用于恢复与流程图高亮） */
export function resolvePhase(s: TaskFlowState, completed: boolean): TaskFlowPhase {
  if (completed) return "done";
  if (!s.anchorDone) return "anchor";
  if (!s.breakdownDone) return "breakdown";
  const dives = Object.values(s.diveStates);
  const allDivesDone = dives.length > 0 && dives.every((d) => d.done);
  if (!allDivesDone) return "deepdive";
  if (!s.challengeDone) return "challenge";
  if (!s.artifactDone) return "artifact";
  return "done";
}
