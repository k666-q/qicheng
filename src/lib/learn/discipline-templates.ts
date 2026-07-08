import type {
  DisciplineId,
  BloomLevel,
  OutputRequirement,
  PassCriteria,
} from "./spec-types";

export type DisciplineTemplate = {
  id: DisciplineId;
  matchKeywords: string[];
  signatureActivities: string[];
  layerDefaults: Partial<
    Record<BloomLevel, { output: OutputRequirement[]; pass: PassCriteria; tokenBudget: number }>
  >;
  misconceptionPatterns: string[];
  deepDiveUnit: "code_line" | "derivation_step" | "sentence_part" | "causal_link";
};

export const CS_TEMPLATE: DisciplineTemplate = {
  id: "cs",
  matchKeywords: [
    "编程", "代码", "算法", "数据结构", "计算机", "程序", "开发",
    "前端", "后端", "数据库", "操作系统", "网络", "软件工程",
    "programming", "algorithm", "computer", "software",
  ],
  signatureActivities: [
    "读代码并理解每一行的作用",
    "写代码实现功能",
    "追踪执行过程（trace）",
    "调试找出错误（debug）",
    "分析时间/空间复杂度",
  ],
  layerDefaults: {
    remember: {
      output: [
        { kind: "concept", maxChars: 300 },
        { kind: "example", count: 1 },
      ],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 900,
    },
    understand: {
      output: [
        { kind: "concept", maxChars: 400 },
        { kind: "visual", description: "核心概念可视化" },
        { kind: "exercise", format: "choice", count: 2 },
      ],
      pass: { minCorrect: 2, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1200,
    },
    apply: {
      output: [
        { kind: "code", language: "python", maxLines: 30, mustInclude: [], lineByLine: true },
        { kind: "exercise", format: "code_fill", count: 2 },
      ],
      pass: { minCorrect: 2, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 2000,
    },
    analyze: {
      output: [
        { kind: "code", language: "python", maxLines: 15, mustInclude: [], lineByLine: false },
        { kind: "exercise", format: "debug", count: 1 },
        { kind: "exercise", format: "choice", count: 1 },
      ],
      pass: { minCorrect: 2, maxAttemptsBeforeReteach: 2, requireConfirm: false },
      tokenBudget: 1800,
    },
    evaluate: {
      output: [
        { kind: "comparison", items: [] },
        { kind: "exercise", format: "choice", count: 1 },
      ],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1000,
    },
    create: {
      output: [],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 2, requireConfirm: true },
      tokenBudget: 800,
    },
  },
  misconceptionPatterns: [
    "边界条件遗忘（空/单元素/满）",
    "递归基例错误",
    "复杂度混淆（最好/最坏/均摊）",
    "指针/引用更新顺序错误",
    "循环不变量破坏",
    "off-by-one 错误",
  ],
  deepDiveUnit: "code_line",
};

export const MATH_TEMPLATE: DisciplineTemplate = {
  id: "math",
  matchKeywords: [
    "数学", "微积分", "线性代数", "概率", "统计", "代数", "几何",
    "方程", "证明", "定理", "公式", "矩阵", "向量",
    "math", "calculus", "algebra", "geometry",
  ],
  signatureActivities: [
    "逐行推导公式/证明",
    "识别定理适用条件",
    "执行标准计算流程",
    "构造反例验证边界",
    "选择合适解法并说明原因",
  ],
  layerDefaults: {
    remember: {
      output: [
        { kind: "concept", maxChars: 300 },
        { kind: "exercise", format: "fill", count: 1 },
      ],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 900,
    },
    understand: {
      output: [
        { kind: "concept", maxChars: 400 },
        { kind: "example", count: 2, contrasting: true },
        { kind: "exercise", format: "choice", count: 2 },
      ],
      pass: { minCorrect: 2, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1200,
    },
    apply: {
      output: [
        { kind: "derivation", maxSteps: 8, stepByStep: true },
        { kind: "exercise", format: "fill", count: 2 },
      ],
      pass: { minCorrect: 2, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1500,
    },
    analyze: {
      output: [
        { kind: "derivation", maxSteps: 12, stepByStep: true },
        { kind: "exercise", format: "fill", count: 2 },
        { kind: "exercise", format: "choice", count: 1 },
      ],
      pass: { minCorrect: 3, maxAttemptsBeforeReteach: 2, requireConfirm: false },
      tokenBudget: 2000,
    },
    evaluate: {
      output: [
        { kind: "comparison", items: [] },
        { kind: "exercise", format: "choice", count: 1 },
      ],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1000,
    },
    create: {
      output: [],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 2, requireConfirm: true },
      tokenBudget: 800,
    },
  },
  misconceptionPatterns: [
    "符号滥用（对非独立变量求导）",
    "条件遗忘（分母为零/收敛性/定义域）",
    "逆命题误用（把充分当必要）",
    "极限与取值混淆",
    "交换求和/积分顺序的条件遗忘",
  ],
  deepDiveUnit: "derivation_step",
};

export const PHYSICS_TEMPLATE: DisciplineTemplate = {
  id: "physics",
  matchKeywords: [
    "物理", "力学", "电磁", "热力学", "光学", "量子", "相对论",
    "运动", "能量", "动量", "电场", "磁场",
    "physics", "mechanics", "thermodynamics",
  ],
  signatureActivities: [
    "预测现象结果（POE）",
    "建立物理模型",
    "公式推导",
    "量纲检验与极限检验",
    "判断选用哪个定律",
  ],
  layerDefaults: {
    remember: {
      output: [
        { kind: "concept", maxChars: 300 },
        { kind: "exercise", format: "fill", count: 1 },
      ],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 900,
    },
    understand: {
      output: [
        { kind: "concept", maxChars: 400 },
        { kind: "visual", description: "物理现象动画" },
        { kind: "exercise", format: "choice", count: 2 },
      ],
      pass: { minCorrect: 2, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1200,
    },
    apply: {
      output: [
        { kind: "derivation", maxSteps: 6, stepByStep: true },
        { kind: "exercise", format: "fill", count: 2 },
      ],
      pass: { minCorrect: 2, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1500,
    },
    analyze: {
      output: [
        { kind: "derivation", maxSteps: 10, stepByStep: true },
        { kind: "exercise", format: "fill", count: 2 },
        { kind: "exercise", format: "choice", count: 1 },
      ],
      pass: { minCorrect: 3, maxAttemptsBeforeReteach: 2, requireConfirm: false },
      tokenBudget: 2000,
    },
    evaluate: {
      output: [
        { kind: "comparison", items: [] },
        { kind: "exercise", format: "choice", count: 1 },
      ],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1000,
    },
    create: {
      output: [],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 2, requireConfirm: true },
      tokenBudget: 800,
    },
  },
  misconceptionPatterns: [
    "力与运动混淆（有力才有运动）",
    "矢量标量混淆",
    "平均值与瞬时值混淆",
    "忽略参考系",
    "能量守恒条件遗忘（非保守力做功）",
  ],
  deepDiveUnit: "derivation_step",
};

export const GENERAL_TEMPLATE: DisciplineTemplate = {
  id: "general",
  matchKeywords: [],
  signatureActivities: [
    "用自己的话解释概念",
    "举出正反例",
    "对比不同方案",
    "识别因果关系",
  ],
  layerDefaults: {
    remember: {
      output: [
        { kind: "concept", maxChars: 300 },
        { kind: "example", count: 1 },
      ],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 900,
    },
    understand: {
      output: [
        { kind: "concept", maxChars: 400 },
        { kind: "example", count: 2 },
        { kind: "exercise", format: "choice", count: 2 },
      ],
      pass: { minCorrect: 2, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1200,
    },
    apply: {
      output: [
        { kind: "example", count: 2 },
        { kind: "exercise", format: "fill", count: 2 },
      ],
      pass: { minCorrect: 2, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1200,
    },
    analyze: {
      output: [
        { kind: "comparison", items: [] },
        { kind: "exercise", format: "choice", count: 2 },
      ],
      pass: { minCorrect: 2, maxAttemptsBeforeReteach: 2, requireConfirm: false },
      tokenBudget: 1500,
    },
    evaluate: {
      output: [
        { kind: "comparison", items: [] },
        { kind: "exercise", format: "choice", count: 1 },
      ],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 1, requireConfirm: false },
      tokenBudget: 1000,
    },
    create: {
      output: [],
      pass: { minCorrect: 1, maxAttemptsBeforeReteach: 2, requireConfirm: true },
      tokenBudget: 800,
    },
  },
  misconceptionPatterns: [],
  deepDiveUnit: "causal_link",
};

const ALL_TEMPLATES: DisciplineTemplate[] = [
  CS_TEMPLATE,
  MATH_TEMPLATE,
  PHYSICS_TEMPLATE,
  GENERAL_TEMPLATE,
];

/** 根据学科名自动匹配 discipline 模板 */
export function matchDiscipline(subjectName: string): DisciplineTemplate {
  const text = subjectName.toLowerCase();
  for (const t of ALL_TEMPLATES) {
    if (t.id === "general") continue;
    if (t.matchKeywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return t;
    }
  }
  return GENERAL_TEMPLATE;
}

/** 按 disciplineId 直接获取模板 */
export function getTemplate(id: DisciplineId): DisciplineTemplate {
  return ALL_TEMPLATES.find((t) => t.id === id) || GENERAL_TEMPLATE;
}
