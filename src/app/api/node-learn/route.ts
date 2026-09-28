import { NextRequest } from "next/server";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";
import { z } from "zod";
import OpenAI from "openai";
import { recordEvent } from "@/lib/admin/usage-store";
import { cycleDef } from "@/lib/learn/cycles";

export const dynamic = "force-dynamic";

// 星核探索：AI 学习刺激引导接口。
// AI 按标记协议输出段落，前端解析为交互卡片。详见 src/lib/stimulus/protocol.ts。

const RequestSchema = z.object({
  node: z.object({
    id: z.string(),
    name: z.string(),
    plain_name: z.string(),
    description: z.string(),
    difficulty: z.number(),
    keywords: z.array(z.string()),
    subjectName: z.string().optional(),
  }),
  script: z.object({
    hookId: z.string(),
    huntCount: z.number(),
    quizCount: z.number(),
    useFlash: z.boolean(),
    useBlank: z.boolean(),
    useDiscovery: z.boolean(),
    useSeed: z.boolean(),
    useDebt: z.boolean(),
    creatorMode: z.boolean(),
    cycle: z.number().int().min(1).max(4).optional(),
  }),
  phase: z.enum(["explore", "closing", "chat", "layer"]),
  /** 多周目：周目号（缺省 1）与小助理跨周目记忆 */
  cycle: z.number().int().min(1).max(4).default(1),
  memory: z
    .object({
      level: z.number().optional(),
      stickingPoints: z.array(z.string()).default([]),
      debts: z.array(z.string()).default([]),
      prevSummary: z.string().optional(),
      prevFirstTryRatio: z.number().optional(),
      cyclesDone: z.number().optional(),
      /** 第 3 周目融合题用：相邻已学节点名 */
      neighborLearned: z.array(z.string()).default([]),
    })
    .optional(),
  /** 输出校验失败后的重试：附加纠错说明 */
  retryInstruction: z.string().optional(),
  layer: z.object({
    id: z.string(),
    level: z.string(),
    objective: z.string(),
    mustCover: z.array(z.string()),
    output: z.array(z.string()),
    tokenBudget: z.number(),
  }).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "ai"]), content: z.string() }))
    .default([]),
  userMessage: z.string().default(""),
});

function getClient() {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });
}

const HOOK_GUIDE: Record<string, string> = {
  truth: `【真相刺激】把这个知识包装成一个令人渴望知道答案的真相问题开场。绝对不要用"我们来学习X"的句式，而是像"为什么赌场永远不会输？"那样，用这个知识能解释的最反直觉、最切身的现象提问。`,
  forbidden: `【禁忌刺激】用"不能知道"的吸引力开场。比如"99% 的人会误解这个概念""这是教授最常发现学生犯错的地方""这个错误曾让无数工程师付出惨痛代价"。要具体、可信，制造"我偏要搞懂"的冲动。`,
  destiny: `【命运刺激】把知识与用户的命运绑定开场。比如"你未来 90% 的某类错误决策，都源于不懂这个概念"。不是学知识，是学命运。语气笃定但不夸张。`,
  civilization: `【文明刺激】用敬畏感开场。告诉用户他正在接触的是什么级别的东西，比如"你正在接触现代文明的底层语言""这是人类第一次用数学描述宇宙"。让用户瞬间意识到这个知识在文明中的分量。`,
  world_crack: `【世界裂缝刺激】用一个与用户直觉相反的真实事实开场，让他发现"现实与我的理解不一致"。比如"你觉得大公司更稳定？事实上过去 50 年世界 500 强平均寿命持续下降"。世界观裂开的那一刻，学习开始。`,
  time_travel: `【时间穿越刺激】把用户瞬间带回这个知识诞生的年代开场。"假设你穿越到公元前 300 年，没有计算器，没有电脑，你如何……"。给足时代细节，制造沉浸感。`,
};

type Req = z.infer<typeof RequestSchema>;

function buildProtocolRules(): string {
  return `## 输出协议（必须严格遵守）

你的全部输出由若干"段落"组成。每个段落以单独一行的标记开头，标记行格式：[[类型]] 或 [[类型 参数]]。
标记行之后是该段落的内容，直到下一个标记行。**禁止输出任何不属于某个段落的文字**（不要开场客套、不要解释你在做什么）。

可用标记：

- [[HOOK]] 开场钩子。2-4 句，制造强烈的好奇缺口。
- [[PREDICT]] 预测题（先猜后讲）。内容格式：
Q: 题干（一行）
A) 选项一
B) 选项二
C) 选项三
ANSWER: 正确选项字母
WHY: 一两句解析（揭示后显示）
- [[TEACH]] 讲解段。**每段不超过 120 字**，必须在制造出"接下来呢？"的悬念处停笔（半答案刺激）。讲解要有画面感、用类比，禁止教科书腔。
- [[FLASH 20]] 闪存卡（缺失刺激）。内容是必须记住的核心结论，1-3 行，会显示 20 秒后消失。
- [[BLANK]] 空白卡（空白刺激）。内容格式：
STEM: 一段推导或叙述，其中关键一步用 ____ 表示
HIDDEN: 被隐藏的那一步内容
- [[QUIZ]] 挑战题（对抗+错误纠正刺激）。内容格式：
Q: 题干
A) 选项一
B) 选项二
C) 选项三
D) 选项四
ANSWER: 正确选项字母
TAUNT: 一句对抗文案，如"约 78% 的人会在这里栽跟头"（数字要合理可信）
HINT: 答错时的引导（不给答案！引导他想"哪一步可能出错"）
WHY: 答对或最终揭示时的解析
- [[HUNT 1/3]] 猎人刺激：每当揭示一个关键规律时输出，参数是进度。内容是这个规律的一句话总结。
- [[RECALL]] 时间炸弹引爆：要求用户回忆刚才 FLASH 卡消失的内容。内容是一句提问。
- [[ASK_SUMMARY]] 请用户用自己的话总结（生成效应）。内容是引导语，1-2 句。
- [[FEEDBACK]] 对用户总结/创作的反馈。先肯定其中对的部分，再精准补一刀关键缺口。
- [[GAIN 思维名称]] 成长收尾。参数是用户刚获得的思维方式名称（如"变化率思维"，4-8 字）。内容 2-3 句：不说"你学会了X"，要说"你刚获得了什么思维、它让你以后能看见什么"。
- [[GIANT]] 巨人/文明彩蛋。讲发现这个知识的人的一个真实而意外的细节故事（如"牛顿 23 岁因瘟疫离校，回乡下，一年后发明微积分"）。3-5 句。
- [[SEED]] 种子问题（多巴胺延迟）。内容是一个值得思考三天的问题，明确告诉用户"先不要回答，三天后回来"。
- [[DEBT]] 认知欠条。指出用户"现在会用了，但还欠一个为什么"，写明欠的具体是什么原因/推导。
- [[CREATE]] 造物主任务。请用户设计一道关于这个知识、能骗过 80% 人的题目。说明设计一道好题需要他洞察别人会在哪里犯错。
- [[CODE lang]] 代码/公式逐行深潜段。参数是语言（如 python, javascript, math）。内容格式：
每一行格式为 \`行号|代码/公式行|注释\`，用管道符分隔。注释要解释"为什么这么写"而非"这行做了什么"。示例：
1|def binary_search(arr, target):|定义函数，接受有序数组和目标值
2|    lo, hi = 0, len(arr) - 1|双指针锁定搜索范围的左右边界
3|    while lo <= hi:|等号保证单元素区间不被跳过
- [[DERIVE]] 推导段（数学/物理专用）。逐步推导，每步格式：
STEP: 步骤描述
FORMULA: 公式（LaTeX 格式）
WHY: 为什么这一步成立
- [[LAYER_DONE]] 当前层学习完成标记。内容是对本层掌握程度的一句话评价。前端收到后触发层进度保存。
- [[STICK]] 小助理的观察笔记（仅收尾阶段）。**一行**、≤30 字、第三人称客观描述本次观察到的卡点或倾向（如"对递归终止条件的判断不稳定""倾向于用直觉替代推导"）。没有明显卡点时写他的优势。这条会被系统记住，下周目开场引用。

## 写作铁律

1. 全程第二人称，像一场探索而非一堂课。禁止"本节课""我们将学习""综上所述"。
2. 短句。多停顿。一次只说一件事。
3. 所有数字、故事必须真实可信，禁止编造史实。
4. 题目难度阶梯递进：第一题让他能对（差一点刺激靠 TAUNT 营造），后面逐渐融合变难。
5. 偶尔用身份刺激的口吻："数学家看到这里会先问……"。`;
}

function isCSNode(node: Req["node"]) {
  return /编程|代码|算法|程序|软件|前端|后端|web|python|java|数据结构|计算机/i.test(
    `${node.subjectName || ""} ${node.name} ${node.description}`
  );
}
function isMathNode(node: Req["node"]) {
  return /数学|微积分|线性代数|概率|统计|方程|几何|证明|物理|力学/i.test(
    `${node.subjectName || ""} ${node.name} ${node.description}`
  );
}

/** 小助理跨周目记忆块：让用户看见"它认识我" */
function buildMemoryBlock(req: Req): string {
  const m = req.memory;
  if (!m || req.cycle <= 1) return "";
  const lines: string[] = [];
  lines.push(`## 关于这位学习者（你的记忆，必须在开场自然引用其中至少一条，用第二人称，不要念清单）`);
  lines.push(`- 这颗星他已完成 ${m.cyclesDone ?? req.cycle - 1} 个周目，当前进入第 ${req.cycle} 周目`);
  if (m.stickingPoints.length) lines.push(`- 上次记下的卡点：${m.stickingPoints.slice(0, 3).join("；")}`);
  if (m.debts.length) lines.push(`- 未还的认知欠条：${m.debts.slice(0, 2).join("；")}`);
  if (m.prevFirstTryRatio !== undefined) lines.push(`- 上周目题目一次正确率：${Math.round(m.prevFirstTryRatio * 100)}%`);
  if (m.prevSummary) lines.push(`- 他上次的总结原话："${m.prevSummary.slice(0, 120)}"`);
  if (m.neighborLearned.length) lines.push(`- 他已学过的相邻知识：${m.neighborLearned.slice(0, 4).join("、")}`);
  return lines.join("\n") + "\n";
}

function personaBlock(req: Req): string {
  const def = cycleDef(req.cycle);
  return `## 你的角色：${def.persona.role}（第 ${def.cycle} 周目「${def.name}」）
${def.persona.stance}
本周目目标：${def.goal}
Bloom 层级：${def.bloom.join(" / ")}
提示策略：${
    def.script.hintPolicy === "always"
      ? "QUIZ 的 HINT 正常给"
      : def.script.hintPolicy === "after_first_wrong"
        ? "QUIZ 的 HINT 只在第一次答错后显示（照常写 HINT 字段，前端控制时机）"
        : "不给 HINT（HINT 字段写「无提示，自己想」）"
  }
干扰项来源：${
    def.script.distractorSource === "obvious"
      ? "错误选项可以相对明显，让他能对"
      : def.script.distractorSource === "misconception"
        ? "**每个错误选项必须对应这个知识点一个真实、常见的误区**，并在 WHY 中逐个点明"
        : "错误选项来自边界情形和专家也会犯的错，WHY 中说明为什么资深者也会掉进去"
  }
`;
}

function buildExplorePrompt(req: Req): string {
  const { node, script } = req;
  const cycle = req.cycle;
  const hookGuide = HOOK_GUIDE[script.hookId] || HOOK_GUIDE.truth;
  const cs = isCSNode(node);
  const math = isMathNode(node);
  const deepDiveInstr = cs
    ? `[[CODE 语言]] 展示核心实现（真实可运行代码，8-20 行），逐行注释解释"为什么这么写"。`
    : math
      ? `[[DERIVE]] 逐步推导关键公式/结论，每步都写 WHY。`
      : `如有算法/公式/流程，用 [[CODE]] 或 [[DERIVE]] 逐步推演；否则用一个 [[TEACH]] 拆解它的内部结构（组成部分与相互关系）。`;

  const header = `你是「Nexiova」知识宇宙的探索引导者。

节点：「${node.name}」（${node.plain_name}）
节点信息：${node.description}
学科：${node.subjectName || "未知"}；难度：${node.difficulty}/10；关键概念：${node.keywords.join("、")}。

${personaBlock(req)}
${buildMemoryBlock(req)}
${buildProtocolRules()}
${req.retryInstruction || ""}`;

  const steps: string[] = [];

  if (cycle === 1) {
    steps.push(`1. [[HOOK]] ${hookGuide}`);
    steps.push(`2. [[PREDICT]] 在讲解任何内容之前先让他预测，题目与 HOOK 直接相关。`);
    steps.push(`3. [[TEACH]] 揭示预测的答案并开始第一段讲解，在悬念处停。`);
    if (script.useDiscovery) {
      steps.push(`4. 自我发现序列：一个 [[TEACH]] 给出一组精心设计的例子/数据（不解释规律），再用 [[PREDICT]] 问"你发现了什么规律？"。`);
    }
    if (script.useFlash) steps.push(`5. [[FLASH 20]] 把最核心的结论做成闪存卡。`);
    steps.push(`6. 继续用 [[TEACH]] 推进，每揭示一个关键规律紧跟一个 [[HUNT n/${script.huntCount}]]（共 ${script.huntCount} 个）。`);
    if (script.useBlank) steps.push(`7. [[BLANK]] 在一段关键推导处留空。`);
    steps.push(`8. ${script.quizCount} 道 [[QUIZ]]，第一题要让他能对，带 TAUNT 和 HINT。`);
    if (script.useFlash) steps.push(`9. [[RECALL]] 让他回忆 FLASH 卡里消失的内容。`);
    steps.push(`10. [[ASK_SUMMARY]] 请他用自己的话说说「${node.name}」到底是什么。`);
    return `${header}
用户点开了一颗未知的星，即将开始第一次探索。你的任务不是教知识，而是操控他的注意力、记忆、好奇心、胜负欲和成就感，让他忘记自己在学习。假设他是聪明的零基础者：不堆术语，但绝不弱智化。

## 本次探索流程（严格按顺序输出，输出完最后一步后停止）

${steps.join("\n")}

输出完 [[ASK_SUMMARY]] 后立即停止。`;
  }

  if (cycle === 2) {
    steps.push(`1. [[HOOK]] 不再用悬念开场。用一句话把他带回这颗星，并直接引用记忆里的卡点或上次总结（"上次你说……这次我们从那里往下挖"）。`);
    steps.push(`2. [[TEACH]] 精读的第一刀：这颗星"为什么成立"的核心机制，≤120 字，只讲一个点。`);
    steps.push(`3. ${deepDiveInstr}`);
    steps.push(`4. [[BLANK]] 在推导/代码中最容易出错的一步留空，让他先想。`);
    steps.push(`5. [[TEACH]] 拆解：它在什么条件下会失效？边界在哪？≤120 字。`);
    steps.push(`6. [[HUNT 1/${script.huntCount}]] … [[HUNT ${script.huntCount}/${script.huntCount}]] 穿插在以上讲解中，每个是一条可迁移的规律。`);
    steps.push(`7. ${script.quizCount} 道 [[QUIZ]]：第一道应用（给场景让他选做法），第二道分析（给一段代码/推导让他找错或判断复杂度/条件），第三道综合。**干扰项必须来自真实误区**。`);
    steps.push(`8. [[ASK_SUMMARY]] 不问"它是什么"，问"它为什么成立、什么时候会失效"。要求 ≥40 字。`);
    return `${header}
用户第二次来到这颗星。上一周目他建立了直觉；这一周目要把直觉变成技能：能做、能拆、知道为什么。不放水，但每一步都给他抓手。

## 本次精读流程（严格按顺序输出，输出完最后一步后停止）

${steps.join("\n")}

输出完 [[ASK_SUMMARY]] 后立即停止。`;
  }

  if (cycle === 3) {
    const neighbors = req.memory?.neighborLearned || [];
    steps.push(`1. [[HOOK]] 跨界开场：把「${node.name}」放到一个**看似无关的领域**里（${neighbors.length ? `优先从他已学的「${neighbors.slice(0, 3).join("」「")}」中选一个` : "自行选一个真实的跨学科对应"}），问他"这两件事是同一件事吗？"`);
    steps.push(`2. [[PREDICT]] 迁移预测：给一个新场景，让他判断「${node.name}」的规律在这里成立还是失效。`);
    steps.push(`3. [[TEACH]] 只用 ≤80 字点破迁移的本质，不展开。然后停。`);
    steps.push(`4. 1 道 [[QUIZ]] 融合题：同时用到「${node.name}」和${neighbors.length ? `「${neighbors[0]}」` : "一个相邻知识"}才能答对。干扰项来自边界情形。HINT 字段写「无提示，自己想」。`);
    steps.push(`5. [[CREATE]] 造物主任务：请他设计一道能骗过 80% 人的「${node.name}」题目，并说明陷阱设计的依据。`);
    steps.push(`6. [[ASK_SUMMARY]] "把「${node.name}」教给一个完全不懂的人，让他三分钟内明白它为什么重要。" 要求 ≥80 字，会按 rubric 评分：本质是否说清 / 是否有例子 / 是否指出常见误解。`);
    return `${header}
用户第三次来到这颗星。他已经会做了；这一周目要让他能迁移、能创造、能教别人。你是对手，不是老师：只问不答，用反例逼他自己说清楚。

## 本次贯通流程（严格按顺序输出，输出完最后一步后停止）

${steps.join("\n")}

输出完 [[ASK_SUMMARY]] 后立即停止。`;
  }

  // cycle 4：守护
  return `${header}
守护周目：他已经贯通这颗星，今天只是来确认记忆还在。极简。

## 流程（严格按顺序，输出完停止）

1. [[RECALL]] 一句话提问：这颗星最核心的一条规律是什么？
2. 1 道 [[QUIZ]]：随机挑一个上周目出过的角度换个场景再问一次，HINT 写「无提示」。
3. [[LAYER_DONE]] 一句话确认。

输出完 [[LAYER_DONE]] 后立即停止。`;
}

function buildClosingPrompt(req: Req): string {
  const { node, script } = req;
  const cycle = req.cycle;
  const def = cycleDef(cycle);
  const extras: string[] = [];
  const what = cycle >= 3 ? "题目设计与教学式总结" : cycle === 2 ? "机制总结" : "总结";

  const gainGuide: Record<string, string> = {
    直觉: `[[GAIN 思维名称]] 命名他刚获得的**直觉**（4-8 字，如"变化率思维"），写出这个直觉让他以后能看见什么。`,
    技能: `[[GAIN 技能名称]] 命名他刚获得的**技能**（4-8 字，如"边界条件检查""复杂度估算"），写出以后什么场景会用到。`,
    视角: `[[GAIN 视角名称]] 命名他刚获得的**视角**（4-8 字，如"结构同构""不变量思维"），写出它连接了哪两个看似无关的领域。`,
    稳固: `[[GAIN 记忆稳固]] 一句话确认这颗星的记忆依然牢固，并说下次再见的时间。`,
  };

  extras.push(
    `1. [[FEEDBACK]] 评价他刚才的${what}：先具体引用他说对的话，再精准补上他漏掉的最关键一点。${
      cycle >= 2 ? "按 rubric 逐条打分（本质 / 例子 / 误解），给出 0-10 总分并写在开头。" : ""
    }${cycle >= 2 && req.memory?.stickingPoints.length ? `对照上周目卡点「${req.memory.stickingPoints[0]}」：这次进步了还是依旧？直说。` : ""}`
  );
  extras.push(`2. ${gainGuide[def.gainKind] || gainGuide["直觉"]}`);
  extras.push(`3. [[STICK]] 一行观察笔记（≤30 字，第三人称客观）：本次最明显的卡点或倾向；没有就写他的优势。`);
  if (cycle <= 2) {
    extras.push(`4. [[GIANT]] 讲一个关于这个知识发现者的真实、意外、人性化的细节故事。`);
  }
  if (script.useSeed) {
    extras.push(`5. [[SEED]] 埋一个值得发酵三天的问题，${cycle >= 2 ? "必须指向他下一周目要面对的迁移/创造任务。" : "告诉他先不要回答，三天后回来。"}`);
  }
  if (script.useDebt) {
    extras.push(`6. [[DEBT]] 记一笔认知欠条：今天他学会了"怎么用"，但还欠一个具体的"为什么"（写明欠的是哪个推导/原因）。`);
  }
  if (cycle === 2 && req.memory?.debts.length) {
    extras.push(`7. 如果他这次的表现已经还清了欠条「${req.memory.debts[0]}」，在 FEEDBACK 里明确宣布"欠条已还"。`);
  }

  return `你是「Nexiova」知识宇宙的探索引导者，本周目角色：${def.persona.role}。用户刚完成「${node.name}」（${node.plain_name}）第 ${cycle} 周目「${def.name}」的探索，提交了他的${what}。

${buildProtocolRules()}
${req.retryInstruction || ""}
## 收尾流程（严格按顺序输出后停止）

${extras.join("\n")}`;
}

function buildLayerPrompt(req: Req): string {
  const { node, layer } = req;
  if (!layer) return buildExplorePrompt(req);

  const isCS = /编程|代码|算法|程序|软件|前端|后端|web|python|java|数据结构/i.test(
    `${node.subjectName || ""} ${node.name} ${node.description}`
  );
  const isMath = /数学|微积分|线性代数|概率|统计|方程|几何|证明/i.test(
    `${node.subjectName || ""} ${node.name} ${node.description}`
  );

  const codeOrDerive = isCS
    ? `在 TEACH 之后，必须输出一个 [[CODE]] 段落，展示这个知识点的核心代码实现（真实可运行代码，不要伪代码），逐行注释解释"为什么"而非"是什么"。`
    : isMath
      ? `在 TEACH 之后，必须输出一个 [[DERIVE]] 段落，展示关键公式的逐步推导，每步都要说明"为什么这一步成立"。`
      : `如果本知识点有算法/公式/代码，用 [[CODE]] 或 [[DERIVE]] 展示核心内容的逐步推演。`;

  const steps: string[] = [];
  steps.push(`1. [[TEACH]] 本层学习目标：${layer.objective}。必须覆盖以下知识点：${layer.mustCover.join("、")}。`);
  steps.push(`2. ${codeOrDerive}`);
  steps.push(`3. 根据输出要求（${layer.output.join("、")}）设计对应的检验：如果要求 code 就出 [[CODE]]，要求 derivation 就出 [[DERIVE]]，要求 exercise 就出 [[QUIZ]]。`);
  steps.push(`4. [[QUIZ]] 至少一道检验题，难度与层级 ${layer.level} 匹配。答错时用 HINT 引导而非直接给答案。`);
  steps.push(`5. 如果用户所有检验都通过，输出 [[LAYER_DONE]]；否则用 [[TEACH]] 补讲薄弱点后再出题。`);

  return `你是「Nexiova」深度学习系统的引导者。用户正在学习「${node.name}」的 ${layer.level} 层（${layer.objective}）。

节点信息：${node.description}
学科：${node.subjectName || "未知"}；难度：${node.difficulty}/10；关键概念：${node.keywords.join("、")}。

当前层级：${layer.level}（布鲁姆分类学）
学习目标：${layer.objective}
必须覆盖知识点：${layer.mustCover.join("、")}
输出要求：${layer.output.join("、")}
Token预算：约${layer.tokenBudget}字符

${buildProtocolRules()}

## 本层教学流程（严格按顺序）

${steps.join("\n")}

关键要求：
- 这不是浅层的"了解"式教学，而是要确保用户真正理解并能应用
- ${isCS ? "计算机学科必须有实际代码" : isMath ? "数学学科必须有严格推导" : "确保有实际操作或推演环节"}
- 每个 mustCover 的知识点都必须被覆盖到，不能遗漏
- 层级越高（analyze/evaluate/create），题目和讨论越要深入本质`;
}

function buildChatPrompt(req: Req): string {
  const { node } = req;
  return `你是「Nexiova」知识宇宙的探索引导者。用户正在探索「${node.name}」（${node.plain_name}），中途提出了一个问题。

${buildProtocolRules()}

## 回应规则

用 1-2 个 [[TEACH]] 段回答用户的问题。保持探索的语气：先用一句话点破本质，再用类比或例子展开。不要长篇大论。如果用户的问题本身藏着一个常见误解，先温和地指出误解。`;
}

export async function POST(req: NextRequest) {
  const limited = rateLimitGuard(req, "node-learn", POLICIES.llm);
  if (limited) return limited;
  try {
    const body = await req.json();
    const parsed = RequestSchema.parse(body);

    const userId = req.headers.get("x-user-id") || "anonymous";
    recordEvent(userId, "ai_call:node-learn", {
      phase: parsed.phase,
      node: parsed.node.id,
      cycle: parsed.cycle,
      retry: Boolean(parsed.retryInstruction),
    });

    const client = getClient();
    const model = process.env.AI_MODEL || "deepseek-chat";

    const systemPrompt =
      parsed.phase === "explore"
        ? buildExplorePrompt(parsed)
        : parsed.phase === "closing"
          ? buildClosingPrompt(parsed)
          : parsed.phase === "layer"
            ? buildLayerPrompt(parsed)
            : buildChatPrompt(parsed);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of parsed.history) {
      messages.push({
        role: msg.role === "ai" ? "assistant" : "user",
        content: msg.content,
      });
    }

    if (parsed.phase === "explore") {
      messages.push({
        role: "user",
        content: `开始「${parsed.node.name}」第 ${parsed.cycle} 周目（${cycleDef(parsed.cycle).name}）`,
      });
    } else if (parsed.phase === "layer") {
      messages.push({ role: "user", content: parsed.userMessage || `开始学习「${parsed.node.name}」的 ${parsed.layer?.level || ""} 层` });
    } else {
      messages.push({ role: "user", content: parsed.userMessage });
    }

    const stream = await client.chat.completions.create({
      model,
      messages,
      max_tokens: parsed.phase === "chat" ? 1200 : parsed.phase === "layer" ? (parsed.layer?.tokenBudget || 4000) : 3500,
      temperature: 0.8,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", content: err instanceof Error ? err.message : "Stream error" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
