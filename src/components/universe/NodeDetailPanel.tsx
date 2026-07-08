"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { KnowledgeNode, NodeStatus, SubjectNode } from "@/lib/universe/types";
import { getNodeDebt } from "@/lib/stimulus/echo";

const STATUS_META: Record<NodeStatus, { label: string; className: string }> = {
  learned: { label: "已掌握", className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" },
  available: { label: "可以学", className: "bg-blue-500/20 text-blue-300 border border-blue-500/30" },
  locked: { label: "未解锁", className: "bg-white/5 text-white/40 border border-white/10" },
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "轻松",
  2: "轻松",
  3: "简单",
  4: "简单",
  5: "适中",
  6: "适中",
  7: "挑战",
  8: "挑战",
  9: "硬核",
  10: "硬核",
};

type Props = {
  node: KnowledgeNode;
  subject?: SubjectNode;
  status: NodeStatus;
  prerequisites: { node: KnowledgeNode; learned: boolean }[];
  learningPath?: { node: KnowledgeNode; learned: boolean }[];
  /** 当前学习计划中关联到此节点的任务 */
  planTasks?: { title: string; day?: string; completed: boolean }[];
  /** 是否正在加载子节点 */
  deepLoading?: boolean;
  /** 子节点数量（已加载时显示） */
  childCount?: number;
  onClose: () => void;
  onToggleLearned: (nodeId: string, learned: boolean) => void;
};

export function NodeDetailPanel({
  node,
  subject,
  status,
  prerequisites,
  learningPath,
  planTasks,
  deepLoading,
  childCount,
  onClose,
  onToggleLearned,
}: Props) {
  const router = useRouter();
  const statusMeta = STATUS_META[status];
  const isLearned = status === "learned";
  const debt = useMemo(() => getNodeDebt(node.id), [node.id]);

  function goExplore() {
    router.push(`/universe/learn?node=${encodeURIComponent(node.id)}`);
  }

  function goLearn() {
    const q = `我想学习「${node.name}」（${node.plain_name}）`;
    router.push(`/onboarding?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="absolute right-0 top-0 h-full w-full max-w-[380px] animate-slide-up">
      <div className="flex h-full flex-col border-l border-white/10 bg-[#12121a]/95 backdrop-blur-xl shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            {subject && (
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/50"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: subject.color, boxShadow: `0 0 6px ${subject.color}` }} />
                {subject.name}
              </span>
            )}
            <h2 className="mt-1.5 text-lg font-semibold text-white/90">{node.name}</h2>
            <p className="text-xs text-white/40">{node.plain_name}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 状态 + 难度 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] text-white/50">
              难度 · {DIFFICULTY_LABELS[node.difficulty] || "适中"}
            </span>
            {debt && (
              <span className="rounded-full bg-red-500/15 border border-red-400/30 px-2.5 py-1 text-[11px] text-red-300">
                🧾 欠一个"为什么"
              </span>
            )}
          </div>

          {/* 认知欠条详情 */}
          {debt && (
            <div className="rounded-xl border border-red-400/20 bg-red-500/5 px-3 py-2.5">
              <p className="text-[11px] font-medium text-red-300/80 mb-1">认知欠条</p>
              <p className="text-[12px] text-white/60 leading-relaxed line-clamp-3">{debt.prompt}</p>
            </div>
          )}

          {/* 描述 */}
          <div>
            <p className="text-[11px] font-medium text-white/40 mb-1.5">这是什么</p>
            <p className="text-sm text-white/70 leading-relaxed">{node.description}</p>
          </div>

          {/* 前置知识 */}
          {prerequisites.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-white/40 mb-2">建议先掌握</p>
              <div className="space-y-1.5">
                {prerequisites.map((p) => (
                  <div
                    key={p.node.id}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                        p.learned ? "bg-emerald-500 text-white" : "border border-white/30 text-transparent"
                      }`}
                    >
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className={`text-xs ${p.learned ? "text-white/30 line-through" : "text-white/70"}`}>
                      {p.node.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 子节点 / 深层知识点 */}
          {node.hasChildren && (
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/5 px-3 py-2.5">
              {deepLoading ? (
                <p className="text-[12px] text-indigo-300/80 animate-pulse">正在加载更深层的知识点...</p>
              ) : childCount && childCount > 0 ? (
                <p className="text-[12px] text-indigo-300/80">
                  已展开 <span className="font-semibold text-indigo-200">{childCount}</span> 个子知识点（星图中可见）
                </p>
              ) : (
                <p className="text-[12px] text-indigo-300/80">
                  此节点包含更深层的知识点，选中后自动加载到星图中
                </p>
              )}
            </div>
          )}

          {/* 关键词 */}
          {node.keywords.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-white/40 mb-2">涉及概念</p>
              <div className="flex flex-wrap gap-1.5">
                {node.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-white/60"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 本计划中的相关任务 */}
          {planTasks && planTasks.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-amber-300/70 mb-2">⭐ 本计划中的相关任务</p>
              <div className="space-y-1.5">
                {planTasks.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-amber-300/15 bg-amber-400/5 px-3 py-2"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                        t.completed ? "bg-emerald-500 text-white" : "border border-amber-300/40 text-transparent"
                      }`}
                    >
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className={`text-xs flex-1 min-w-0 truncate ${t.completed ? "text-white/30 line-through" : "text-white/70"}`}>
                      {t.title}
                    </span>
                    {t.day && <span className="text-[10px] text-white/30 shrink-0">{t.day}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 推荐学习路径 */}
          {learningPath && learningPath.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-white/40 mb-2">推荐学习路径</p>
              <div className="relative pl-3 space-y-1">
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />
                {learningPath.map((item, i) => (
                  <div key={item.node.id} className="flex items-center gap-2 relative">
                    <span className={`relative z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[7px] ${
                      item.learned
                        ? "bg-emerald-500 text-white"
                        : "border border-white/30 bg-[#12121a]"
                    }`}>
                      {item.learned && (
                        <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {!item.learned && <span className="text-white/40">{i + 1}</span>}
                    </span>
                    <span className={`text-[11px] ${item.learned ? "text-white/30 line-through" : "text-white/70"}`}>
                      {item.node.name}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-2 relative">
                  <span className="relative z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-indigo-400/50 bg-indigo-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  </span>
                  <span className="text-[11px] text-indigo-300 font-medium">{node.name}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-white/10 px-6 py-4 space-y-2">
          <button
            onClick={goExplore}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/20"
          >
            {isLearned ? "👑 重访这颗星（造物主模式）" : "✦ 开始探索这颗星"}
          </button>
          <button
            onClick={goLearn}
            className="w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 transition-all"
          >
            围绕它制定完整计划 →
          </button>
          <button
            onClick={() => onToggleLearned(node.id, !isLearned)}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
              isLearned
                ? "border-white/10 text-white/50 hover:bg-white/5"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            }`}
          >
            {isLearned ? "取消已掌握标记" : "✓ 标记为已掌握"}
          </button>
        </div>
      </div>
    </div>
  );
}
