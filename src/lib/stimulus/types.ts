// 学习刺激引擎（Learning Stimulus Engine）
// 30+ 种刺激的注册表。核心理念：不是教知识，而是操控注意力/记忆/好奇心/胜负欲/掌控感/成就感。
// 每个知识节点 = 知识单元 + 刺激单元。

export type StimulusId =
  | "missing" // 1 缺失刺激：概念显示20秒消失，做题后重现
  | "almost" // 2 差一点刺激：差一点成功比失败更难受
  | "predict" // 3 预测刺激：不要解释，先猜（预测失败=学习开始）
  | "half_answer" // 4 半答案刺激：永远不一次讲完，连续悬念
  | "time_bomb" // 5 时间炸弹刺激：这个知识3分钟后会再次出现（主动提取）
  | "self_discovery" // 6 自我发现刺激：不要告诉，让他发现（记忆暴涨）
  | "rivalry" // 7 对抗刺激：80%的人会在这里犯错（胜负欲）
  | "identity" // 8 身份刺激：数学家会这样思考（身份→行为）
  | "blank" // 9 空白刺激：推导留空，点击揭示
  | "growth" // 10 成长刺激：你刚获得"变化率思维"（我升级了）
  | "error_correction" // 11 错误纠正刺激：不给答案，引导"哪一步可能出错？"
  | "random_node" // 12 随机节点刺激：打乱顺序，只能靠真正理解
  | "progressive_challenge" // 13 阶梯挑战刺激：每完成一阶难度提高、知识点融合
  | "social_comparison" // 14 社交对比刺激：你与别人差距在哪（轻微竞争）
  | "memory_reconstruction" // 15 记忆重构刺激：概念消失后随机调用回忆
  | "simulation_decision" // 16 模拟决策刺激：知识嵌入决策场景，学习有"后果"
  | "self_summary" // 17 自我总结刺激：用自己的话总结（生成效应）
  | "reward_evolution" // 18 奖励进化刺激：徽章/能力点/成就解锁的成长轨迹
  | "truth" // 19 真相刺激：为什么赌场永远不会输？（知识=真相）
  | "forbidden" // 20 禁忌刺激：99%的人会误解这个概念（不能知道的吸引力）
  | "destiny" // 21 命运刺激：你未来90%的错误决策都源于逻辑漏洞
  | "future_self" // 22 未来自我刺激：三年后的你会感谢今天（身份连接）
  | "civilization" // 23 文明刺激：你正在接触现代文明的底层语言（敬畏）
  | "giants" // 24 巨人刺激：和发现知识的人见面（牛顿23岁发明微积分）
  | "hunter" // 25 猎人刺激：本节隐藏3个关键规律，目前发现1/3
  | "world_crack" // 26 世界裂缝刺激：现实与你的理解不一致（世界观裂开）
  | "dopamine_delay" // 27 多巴胺延迟刺激：今天埋种子，三天后收获（认知发酵）
  | "cognitive_debt" // 28 认知债务刺激：你会使用，但还欠原因（主动回来补）
  | "time_travel" // 29 时间穿越刺激：穿越到公元前300年，如何证明？（沉浸）
  | "creator" // 30 造物主刺激：不解题，设计一道能骗过80%人的题（学习者→创造者）
  | "existential"; // 31 存在刺激：你真正想解决的问题是什么？（增加方向）

export type StimulusCategory =
  | "hook" // 开场钩子（点燃好奇心）
  | "interact" // 探索中的交互机制
  | "closing" // 收尾（成就感与身份）
  | "system"; // 跨页面/跨时间的系统级刺激

export type StimulusImpl = "prompt" | "ui" | "system";

export type StimulusMeta = {
  id: StimulusId;
  name: string;
  category: StimulusCategory;
  impl: StimulusImpl;
  /** 培养的认知习惯（认知习惯工厂） */
  habit?: string;
};

export const STIMULI: Record<StimulusId, StimulusMeta> = {
  truth: { id: "truth", name: "真相刺激", category: "hook", impl: "prompt", habit: "把知识当真相追问" },
  forbidden: { id: "forbidden", name: "禁忌刺激", category: "hook", impl: "prompt" },
  destiny: { id: "destiny", name: "命运刺激", category: "hook", impl: "prompt" },
  civilization: { id: "civilization", name: "文明刺激", category: "hook", impl: "prompt", habit: "敬畏知识源头" },
  world_crack: { id: "world_crack", name: "世界裂缝刺激", category: "hook", impl: "prompt", habit: "质疑既有认知" },
  time_travel: { id: "time_travel", name: "时间穿越刺激", category: "hook", impl: "prompt" },

  predict: { id: "predict", name: "预测刺激", category: "interact", impl: "ui", habit: "先思考后接受" },
  missing: { id: "missing", name: "缺失刺激", category: "interact", impl: "ui", habit: "主动回忆" },
  half_answer: { id: "half_answer", name: "半答案刺激", category: "interact", impl: "ui" },
  blank: { id: "blank", name: "空白刺激", category: "interact", impl: "ui" },
  self_discovery: { id: "self_discovery", name: "自我发现刺激", category: "interact", impl: "prompt", habit: "主动发现规律" },
  rivalry: { id: "rivalry", name: "对抗刺激", category: "interact", impl: "prompt" },
  hunter: { id: "hunter", name: "猎人刺激", category: "interact", impl: "ui", habit: "主动搜寻规律" },
  error_correction: { id: "error_correction", name: "错误纠正刺激", category: "interact", impl: "prompt", habit: "从错误中学习" },
  progressive_challenge: { id: "progressive_challenge", name: "阶梯挑战刺激", category: "interact", impl: "prompt" },
  time_bomb: { id: "time_bomb", name: "时间炸弹刺激", category: "interact", impl: "ui", habit: "主动提取" },
  almost: { id: "almost", name: "差一点刺激", category: "interact", impl: "ui" },
  identity: { id: "identity", name: "身份刺激", category: "interact", impl: "prompt", habit: "以创造者身份思考" },
  simulation_decision: { id: "simulation_decision", name: "模拟决策刺激", category: "interact", impl: "prompt" },

  self_summary: { id: "self_summary", name: "自我总结刺激", category: "closing", impl: "ui", habit: "用自己的话重构" },
  growth: { id: "growth", name: "成长刺激", category: "closing", impl: "ui" },
  giants: { id: "giants", name: "巨人刺激", category: "closing", impl: "prompt", habit: "追溯知识源头" },
  creator: { id: "creator", name: "造物主刺激", category: "closing", impl: "prompt", habit: "从消费者变成创造者" },
  reward_evolution: { id: "reward_evolution", name: "奖励进化刺激", category: "closing", impl: "system" },

  memory_reconstruction: { id: "memory_reconstruction", name: "记忆重构刺激", category: "system", impl: "system", habit: "主动回忆" },
  dopamine_delay: { id: "dopamine_delay", name: "多巴胺延迟刺激", category: "system", impl: "system" },
  cognitive_debt: { id: "cognitive_debt", name: "认知债务刺激", category: "system", impl: "system", habit: "补全因果链" },
  future_self: { id: "future_self", name: "未来自我刺激", category: "system", impl: "system" },
  existential: { id: "existential", name: "存在刺激", category: "system", impl: "system", habit: "追问方向" },
  random_node: { id: "random_node", name: "随机节点刺激", category: "system", impl: "system" },
  social_comparison: { id: "social_comparison", name: "社交对比刺激", category: "system", impl: "system" },
};

/** 一次"星核探索"会话的剧本：引擎选好刺激组合，注入 AI 系统提示词 */
export type ExploreScript = {
  /** 开场钩子（六选一，按节点与历史去重） */
  hookId: StimulusId;
  /** 猎人刺激：本次探索埋几个关键规律（0 = 不启用） */
  huntCount: number;
  /** 测验题数（阶梯递进） */
  quizCount: number;
  /** 是否包含缺失刺激闪存卡 */
  useFlash: boolean;
  /** 是否包含空白刺激（推导留空） */
  useBlank: boolean;
  /** 是否包含自我发现序列 */
  useDiscovery: boolean;
  /** 收尾是否埋"三天后的种子"（多巴胺延迟） */
  useSeed: boolean;
  /** 收尾是否记一笔认知债务 */
  useDebt: boolean;
  /** 已掌握节点 → 造物主模式（设计题目而非解题）；多周目下等价于 cycle === 3 */
  creatorMode: boolean;
  /** 周目号（1 初见 · 2 精读 · 3 贯通 · 4 守护）。旧存档缺省视为 1 */
  cycle?: number;
};

/** 探索流中的卡片段落类型（AI 标记协议 → 前端卡片） */
export type SegmentType =
  | "hook" // 开场钩子
  | "teach" // 讲解段（半答案：每段后停，点"继续探索"）
  | "predict" // 预测选择（先猜后讲）
  | "flash" // 缺失刺激：限时显示后隐藏
  | "blank" // 空白刺激：点击揭示
  | "quiz" // 对抗式测验
  | "hunt" // 猎人刺激：发现一个规律
  | "recall" // 时间炸弹引爆：回忆刚才消失的概念
  | "ask_summary" // 自我总结输入
  | "feedback" // AI 对总结的反馈
  | "gain" // 成长收尾：获得 X 思维
  | "giant" // 巨人/文明彩蛋
  | "seed" // 三天后的种子问题
  | "debt" // 认知欠条
  | "create" // 造物主：请用户设计题目
  | "code" // 代码逐行深潜
  | "derive" // 公式/推导逐步深潜
  | "layer_done" // 当前层完成标记
  | "stick" // 小助理记下的卡点（跨周目记忆）
  | "gap"; // 缺口诊断卡（前端合成，非 AI 输出）

export type ChoiceOption = { label: string; text: string };

export type Segment = {
  type: SegmentType;
  /** 正文内容（Markdown 文本） */
  content: string;
  /** predict/quiz 的题干 */
  question?: string;
  /** predict/quiz 的选项 */
  options?: ChoiceOption[];
  /** 正确选项 label（如 "B"） */
  answer?: string;
  /** 答错时的引导提示（错误纠正刺激：不给答案） */
  hint?: string;
  /** 答案解析 */
  why?: string;
  /** 对抗刺激文案（如 "80% 的人会在这里犯错"） */
  taunt?: string;
  /** flash 卡的显示秒数 */
  flashSeconds?: number;
  /** blank 卡的题干（含 ____） */
  stem?: string;
  /** blank 卡被隐藏的内容 */
  hidden?: string;
  /** hunt 序号，如 "1/3" */
  huntIndex?: string;
  /** gain 卡获得的思维名称 */
  gainName?: string;
  /** code 段的语言（python, javascript, math 等） */
  codeLang?: string;
  /** code 段的逐行数据：{ line, code, comment }[] */
  codeLines?: { line: number; code: string; comment: string }[];
  /** derive 段的步骤：{ step, formula, why }[] */
  deriveSteps?: { step: string; formula: string; why: string }[];
  /** gap 卡：诊断出的缺口前置节点 */
  gapNodeId?: string;
  gapNodeName?: string;
  /** gap 卡：建议去的周目 */
  gapCycle?: number;
  /** 流式过程中的临时段（尚未固化） */
  _tmp?: boolean;
};
