/**
 * 权威知识域骨架——确保图谱完整性的参照基准。
 * 生成图谱/规格时注入 prompt，要求节点对齐骨架、不遗漏核心知识点。
 * 来源：ACM CS2023, Stanford/MIT 课程大纲, AP Physics C, 标准本科教学大纲。
 */

export type SkeletonNode = {
  name: string;
  importance: "core" | "recommended" | "optional";
  children?: SkeletonNode[];
};

export type DomainSkeleton = {
  domain: string;
  source: string;
  tree: SkeletonNode[];
};

export const DSA_SKELETON: DomainSkeleton = {
  domain: "数据结构与算法",
  source: "ACM CS2023 · Algorithmic Foundations (AL)",
  tree: [
    {
      name: "基础数据结构",
      importance: "core",
      children: [
        { name: "数组与动态数组", importance: "core" },
        { name: "链表（单/双/循环）", importance: "core" },
        { name: "栈", importance: "core" },
        { name: "队列与双端队列", importance: "core" },
        { name: "散列表（哈希函数/冲突处理/负载因子）", importance: "core" },
      ],
    },
    {
      name: "树结构",
      importance: "core",
      children: [
        { name: "二叉树与遍历", importance: "core" },
        { name: "二叉搜索树 (BST)", importance: "core" },
        { name: "AVL 树（平衡因子/四种旋转）", importance: "core" },
        { name: "红黑树", importance: "recommended" },
        { name: "B 树与 B+ 树", importance: "recommended" },
        { name: "堆与优先队列", importance: "core" },
        { name: "Trie（前缀树）", importance: "recommended" },
      ],
    },
    {
      name: "图",
      importance: "core",
      children: [
        { name: "图的表示（邻接矩阵/表）", importance: "core" },
        { name: "BFS 广度优先搜索", importance: "core" },
        { name: "DFS 深度优先搜索", importance: "core" },
        { name: "最短路径（Dijkstra/Bellman-Ford/Floyd）", importance: "core" },
        { name: "最小生成树（Prim/Kruskal）", importance: "core" },
        { name: "拓扑排序", importance: "core" },
        { name: "强连通分量", importance: "recommended" },
      ],
    },
    {
      name: "排序",
      importance: "core",
      children: [
        { name: "比较排序（冒泡/插入/选择/归并/快排/堆排）", importance: "core" },
        { name: "非比较排序（计数/基数/桶）", importance: "recommended" },
        { name: "排序稳定性与适用场景", importance: "core" },
      ],
    },
    {
      name: "搜索",
      importance: "core",
      children: [
        { name: "线性搜索", importance: "core" },
        { name: "二分搜索及变体", importance: "core" },
      ],
    },
    {
      name: "算法策略",
      importance: "core",
      children: [
        { name: "递归与迭代", importance: "core" },
        { name: "分治", importance: "core" },
        { name: "贪心（及失效场景）", importance: "core" },
        { name: "动态规划（重叠子问题/最优子结构）", importance: "core" },
        { name: "回溯", importance: "core" },
        { name: "随机化算法", importance: "recommended" },
      ],
    },
    {
      name: "复杂度分析",
      importance: "core",
      children: [
        { name: "渐进符号（O/Ω/Θ）", importance: "core" },
        { name: "最好/最坏/平均情况", importance: "core" },
        { name: "递归方程与主定理", importance: "core" },
        { name: "摊还分析", importance: "recommended" },
        { name: "P 与 NP 概念", importance: "optional" },
      ],
    },
    {
      name: "集合类",
      importance: "recommended",
      children: [
        { name: "并查集（按秩合并/路径压缩）", importance: "recommended" },
      ],
    },
  ],
};

export const CALCULUS_SKELETON: DomainSkeleton = {
  domain: "一元微积分",
  source: "标准本科微积分序列 (Calculus I-II)",
  tree: [
    {
      name: "极限与连续",
      importance: "core",
      children: [
        { name: "极限的直观定义与计算", importance: "core" },
        { name: "ε-δ 严格定义", importance: "recommended" },
        { name: "极限运算法则", importance: "core" },
        { name: "连续性与介值定理", importance: "core" },
      ],
    },
    {
      name: "导数",
      importance: "core",
      children: [
        { name: "导数定义（变化率/切线斜率）", importance: "core" },
        { name: "基本求导法则", importance: "core" },
        { name: "链式法则", importance: "core" },
        { name: "隐函数求导", importance: "core" },
        { name: "高阶导数", importance: "recommended" },
      ],
    },
    {
      name: "导数应用",
      importance: "core",
      children: [
        { name: "单调性与极值", importance: "core" },
        { name: "凹凸性与拐点", importance: "core" },
        { name: "洛必达法则", importance: "core" },
        { name: "泰勒展开", importance: "core" },
        { name: "最优化问题", importance: "recommended" },
      ],
    },
    {
      name: "积分",
      importance: "core",
      children: [
        { name: "不定积分与基本公式", importance: "core" },
        { name: "定积分定义（黎曼和）", importance: "core" },
        { name: "微积分基本定理", importance: "core" },
        { name: "换元积分法", importance: "core" },
        { name: "分部积分法", importance: "core" },
      ],
    },
    {
      name: "积分应用",
      importance: "core",
      children: [
        { name: "面积与体积", importance: "core" },
        { name: "弧长", importance: "recommended" },
        { name: "物理应用（功/质心）", importance: "recommended" },
      ],
    },
    {
      name: "级数",
      importance: "recommended",
      children: [
        { name: "数项级数敛散性判定", importance: "recommended" },
        { name: "幂级数与收敛半径", importance: "recommended" },
        { name: "泰勒级数", importance: "core" },
      ],
    },
  ],
};

export const ALL_SKELETONS: DomainSkeleton[] = [
  DSA_SKELETON,
  CALCULUS_SKELETON,
];

/** 将骨架扁平化为文本列表（注入 AI prompt 用） */
export function skeletonToPromptText(skeleton: DomainSkeleton): string {
  const lines: string[] = [`## ${skeleton.domain}（参照：${skeleton.source}）`];
  function walk(nodes: SkeletonNode[], indent: number) {
    for (const n of nodes) {
      const tag = n.importance === "core" ? "[必须]" : n.importance === "recommended" ? "[推荐]" : "[选学]";
      lines.push(`${"  ".repeat(indent)}- ${tag} ${n.name}`);
      if (n.children) walk(n.children, indent + 1);
    }
  }
  walk(skeleton.tree, 0);
  return lines.join("\n");
}
