"use client";

// 任务流程图：每个任务固定的六环节骨架，全程可视化「我在哪里」。
// full 模式 = 进入任务的第一屏全景；compact 模式 = 学习中收起的顶部进度轨。

import type { TaskFlowPhase, TaskFlowState } from "@/lib/learn/depth-types";

export type FlowPhaseInfo = {
  id: TaskFlowPhase;
  name: string;
  desc: string;
  icon: string;
  /** 可跳过环节（虚线态） */
  optional?: boolean;
};

export const FLOW_PHASES: FlowPhaseInfo[] = [
  { id: "anchor", name: "锚点提取", desc: "先抓住这个知识最不能脱离的东西", icon: "◈" },
  { id: "breakdown", name: "步骤拆解", desc: "拆成坐下来就能做的粒度", icon: "▤" },
  { id: "deepdive", name: "逐行深潜", desc: "一行行推进，懂了才继续", icon: "⌄", optional: true },
  { id: "challenge", name: "挑战验证", desc: "证明你不是在假点头", icon: "⚔", optional: true },
  { id: "artifact", name: "产出成果", desc: "拿出一个能给别人看的东西", icon: "✦", optional: true },
  { id: "done", name: "点亮星辰", desc: "小宇宙里这颗星亮起", icon: "★" },
];

type PhaseStatus = "done" | "current" | "pending";

function phaseStatus(phase: TaskFlowPhase, flow: TaskFlowState, completed: boolean): PhaseStatus {
  const doneMap: Record<TaskFlowPhase, boolean> = {
    anchor: flow.anchorDone,
    breakdown: flow.breakdownDone,
    deepdive: Object.values(flow.diveStates).length > 0 && Object.values(flow.diveStates).every((d) => d.done),
    challenge: flow.challengeDone,
    artifact: flow.artifactDone,
    done: completed,
  };
  if (doneMap[phase]) return "done";
  if (flow.phase === phase) return "current";
  return "pending";
}

type Props = {
  flow: TaskFlowState;
  completed: boolean;
  /** 深潜进度摘要（如 "2/4 步 · 7/12 行"），可选 */
  diveSummary?: string;
  onPhaseClick?: (phase: TaskFlowPhase) => void;
  compact?: boolean;
};

export function TaskFlowMap({ flow, completed, diveSummary, onPhaseClick, compact }: Props) {
  if (compact) {
    return (
      <div className="flex items-center gap-0">
        {FLOW_PHASES.map((p, i) => {
          const st = phaseStatus(p.id, flow, completed);
          return (
            <div key={p.id} className="flex items-center">
              {i > 0 && (
                <span
                  className={`h-px w-4 ${st === "pending" ? "bg-white/10" : "bg-cyan-400/40"} ${p.optional ? "border-t border-dashed border-white/15 bg-transparent" : ""}`}
                />
              )}
              <button
                onClick={() => onPhaseClick?.(p.id)}
                title={`${p.name}：${p.desc}`}
                className={`flex h-6 w-6 items-center justify-center border font-mono text-[10px] transition-all ${
                  st === "done"
                    ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.3)]"
                    : st === "current"
                      ? "border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-200 animate-pulse"
                      : p.optional
                        ? "border-dashed border-white/20 text-white/30"
                        : "border-white/15 text-white/30"
                }`}
              >
                {st === "done" ? "✓" : p.icon}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {FLOW_PHASES.map((p, i) => {
        const st = phaseStatus(p.id, flow, completed);
        const isLast = i === FLOW_PHASES.length - 1;
        return (
          <div key={p.id} className="flex gap-3">
            {/* 轨道：节点 + 连接线 */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => onPhaseClick?.(p.id)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center border text-sm transition-all ${
                  st === "done"
                    ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
                    : st === "current"
                      ? "border-fuchsia-400/70 bg-fuchsia-400/10 text-fuchsia-200 shadow-[0_0_12px_rgba(232,121,249,0.3)] animate-pulse"
                      : p.optional
                        ? "border-dashed border-white/20 text-white/30"
                        : "border-white/15 bg-white/[0.02] text-white/30"
                }`}
              >
                {st === "done" ? "✓" : p.icon}
              </button>
              {!isLast && (
                <span
                  className={`w-px flex-1 min-h-[14px] ${
                    st === "done" ? "bg-cyan-400/40" : "bg-white/10"
                  }`}
                />
              )}
            </div>

            {/* 文案 */}
            <button
              onClick={() => onPhaseClick?.(p.id)}
              className={`mb-3 flex-1 text-left transition-colors ${st === "pending" ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    st === "current" ? "text-fuchsia-200" : st === "done" ? "text-cyan-100" : "text-white/70"
                  }`}
                >
                  {p.name}
                </span>
                {p.optional && (
                  <span className="border border-dashed border-white/20 px-1.5 py-px font-mono text-[9px] tracking-wider text-white/35">
                    可跳过
                  </span>
                )}
                {st === "current" && (
                  <span className="font-mono text-[9px] tracking-widest text-fuchsia-300/70">◂ 当前</span>
                )}
                {p.id === "deepdive" && diveSummary && (
                  <span className="font-mono text-[10px] text-cyan-300/60">{diveSummary}</span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">{p.desc}</p>
            </button>
          </div>
        );
      })}
    </div>
  );
}
