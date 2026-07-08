// 知识宇宙网络的数据模型
// 第一版聚焦「学习层」可视化；认知层/生活层字段已预留，本期不实现。

export type SubjectNode = {
  id: string;
  name: string;
  color: string;
  description: string;
  /** 侧边栏分组用：自然科学与工程 / 人文社科 / 商科与应用 / 艺术与生活 */
  category?: string;
};

export type KnowledgeNode = {
  id: string;
  subjectId: string;
  name: string;
  plain_name: string;
  description: string;
  difficulty: number; // 1-10
  keywords: string[]; // 用于与已完成任务的 title_professional 做匹配点亮

  /** 父节点 ID，顶层节点为 undefined */
  parentId?: string;
  /** 节点深度：0=学科直属一级节点，1=二级，2=三级... */
  depth?: number;
  /** 先修节点 ID 列表（软提示，不锁死） */
  prerequisites?: string[];
  /** 是否有更深层子节点可加载 */
  hasChildren?: boolean;

  // 预留：认知层 / 生活层（本期不实现）
  cognition_tags?: string[];
  life_links?: string[];
};

export type KnowledgeEdge = {
  source: string;
  target: string;
  type: "prerequisite" | "related" | "cross";
  reason?: string;
};

/** 学科与学科之间的关联（带专业依据说明） */
export type SubjectEdge = {
  source: string;
  target: string;
  reason: string;
};

export type KnowledgeGraph = {
  subjects: SubjectNode[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  /** 学科级关联边（总览中渲染为学科星之间的关联线） */
  subjectEdges?: SubjectEdge[];
};

// 单个学科 JSON 文件的形状（各学科一个文件，合并成完整 KnowledgeGraph）
export type SubjectGraphFile = {
  subject: SubjectNode;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

// 节点在图上的学习状态
export type NodeStatus = "learned" | "available" | "locked";
