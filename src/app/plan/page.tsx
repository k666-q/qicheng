"use client";

// 星际档案馆：多计划管理页。
// 每份计划是一份「远征任务档案卷宗」，可抽出查看（激活）、立新档、销毁。

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GeneratedPlan, PlanStage } from "@/lib/plan/types";
import {
  loadPlans,
  migrateLegacyPlan,
  activatePlan,
  deletePlan,
  getActivePlanId,
  reconcileUniverses,
  type StoredPlan,
} from "@/lib/plan/plans-store";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";

const DOMAIN_LABEL: Record<string, { zh: string; code: string }> = {
  programming_app: { zh: "编程", code: "DEV" },
  visual_design: { zh: "设计", code: "ART" },
  data_analysis: { zh: "数据", code: "DAT" },
  exam_prep: { zh: "备考", code: "EXM" },
  language: { zh: "语言", code: "LNG" },
  product_business: { zh: "产品", code: "BIZ" },
};

function domainMeta(domain: string) {
  return DOMAIN_LABEL[domain] || { zh: "学习", code: "GEN" };
}

function countTasks(plan: GeneratedPlan): number {
  let n = 0;
  for (const stage of plan.stages) {
    n += stageTasks(stage).length;
  }
  return n;
}

function stageTasks(stage: PlanStage) {
  if (stage.weeks && stage.weeks.length > 0) {
    return stage.weeks.flatMap((w) => w.days.flatMap((d) => d.tasks));
  }
  return stage.tasks || [];
}

/** 与详情页 TaskRow 相同的任务 id 规则，用于统计完成度 */
function planProgress(plan: GeneratedPlan, completedSet: Set<string>): number {
  let total = 0;
  let done = 0;
  plan.stages.forEach((stage, si) => {
    stageTasks(stage).forEach((task, ti) => {
      total++;
      if (completedSet.has(`s${si}_t${ti}_${task.title_plain.slice(0, 10)}`)) done++;
    });
  });
  return total > 0 ? done / total : 0;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/** 解密进度条：▓▓▓░░░░░ */
function declassBar(ratio: number): string {
  const filled = Math.round(ratio * 10);
  return "▓".repeat(filled) + "░".repeat(10 - filled);
}

export default function PlanArchivePage() {
  const router = useRouter();
  const [plans, setPlans] = useState<StoredPlan[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [confirmDestroy, setConfirmDestroy] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    migrateLegacyPlan();
    reconcileUniverses();
    setPlans(loadPlans().sort((a, b) => b.updatedAt - a.updatedAt));
    setActiveId(getActivePlanId());
    try {
      setCompletedSet(new Set(JSON.parse(localStorage.getItem("qicheng_tasks_completed") || "[]")));
    } catch { /* ignore */ }
    setMounted(true);
  }, []);

  const progressById = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of plans) map.set(p.id, planProgress(p.plan, completedSet));
    return map;
  }, [plans, completedSet]);

  function openDossier(id: string) {
    activatePlan(id);
    router.push("/plan/detail");
  }

  function destroyDossier(id: string) {
    deletePlan(id);
    setPlans(loadPlans().sort((a, b) => b.updatedAt - a.updatedAt));
    setActiveId(getActivePlanId());
    setConfirmDestroy(null);
  }

  return (
    <div className="min-h-screen bg-[#050510] md:pl-[var(--siderail-width)] transition-[padding] duration-200">
      <CosmicBackground />
      <CyberOverlay />

      {/* Header */}
      <header className="relative z-10 border-b border-cyan-400/[0.12] bg-[#0a0a14]/60 backdrop-blur-xl px-6 py-5">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-[10px] tracking-[0.35em] text-cyan-300/50 mb-1">MISSION ARCHIVE</p>
          <h1 className="cyber-glitch text-xl font-semibold text-white/90" data-text="星际档案馆">星际档案馆</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/40">plan_archive // dossier_index</p>
          <p className="text-sm text-white/40 mt-1">
            每一份远征档案，都是一段你决定出发的证明。共 <span className="cyber-neon text-cyan-300">{plans.length}</span> 份卷宗。
          </p>
        </div>
        <div className="cyber-dataline absolute inset-x-0 bottom-0 h-px" />
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 py-10 pb-6">
        {!mounted ? (
          <div className="cyber-cursor py-24 text-center font-mono text-sm text-cyan-300/40">正在开启档案柜...</div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2" style={{ perspective: "1200px" }}>
            {plans.map((sp, i) => {
              const meta = domainMeta(sp.plan.domain);
              const progress = progressById.get(sp.id) ?? 0;
              const isActive = sp.id === activeId;
              const isComplete = progress >= 1;
              const stamp = isComplete
                ? { text: "已完成 COMPLETE", cls: "border-emerald-400/60 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.25)]" }
                : isActive
                  ? { text: "执行中 ACTIVE", cls: "border-cyan-400/60 text-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.3)]" }
                  : { text: "已归档 ARCHIVED", cls: "border-white/25 text-white/35" };

              return (
                <div
                  key={sp.id}
                  className="group relative"
                  style={{ transform: `rotate(${i % 2 === 0 ? "-0.5deg" : "0.5deg"})` }}
                >
                  {/* 索引标签页 */}
                  <div className="relative z-10 ml-5 inline-flex items-center gap-2 border border-b-0 border-cyan-400/[0.15] bg-[#0c121f] px-3.5 py-1.5 font-mono text-[10px] tracking-wider text-white/50 transition-colors group-hover:text-cyan-300/90 group-hover:border-cyan-400/30">
                    <span className="text-cyan-200/80 font-semibold group-hover:text-cyan-200">EXP-{String(i + 1).padStart(3, "0")}</span>
                    <span className="text-fuchsia-300/40">/</span>
                    <span>{meta.code}</span>
                  </div>

                  {/* 卷宗主体 */}
                  <div
                    onClick={() => openDossier(sp.id)}
                    className="cyber-panel cyber-corner relative -mt-px cursor-pointer p-5 transition-all duration-300 group-hover:-translate-y-1.5"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {/* 回形针 + 便签（第一步） */}
                    <div className="absolute -top-2 right-14 rotate-[8deg]">
                      <div className="relative border border-cyan-300/20 bg-cyan-400/[0.06] px-2 py-1 backdrop-blur-sm">
                        <span className="absolute -top-2 left-1.5 h-3.5 w-2 rounded-t-full border-2 border-b-0 border-cyan-200/30" />
                        <p className="max-w-[120px] truncate font-mono text-[9px] text-cyan-100/60">
                          第一步：{sp.plan.first_step?.task_name || "出发"}
                        </p>
                      </div>
                    </div>

                    {/* 档案抬头 */}
                    <p className="font-mono text-[9px] tracking-[0.3em] text-cyan-300/40">
                      星际远征档案 / MISSION DOSSIER
                    </p>
                    <div className="cyber-dataline mt-1.5 mb-3 h-px" />

                    {/* 任务代号 */}
                    <h2 className="pr-20 text-base font-semibold leading-snug text-white/90 group-hover:text-white">
                      {sp.plan.title}
                    </h2>

                    {/* 元数据 */}
                    <p className="mt-2 font-mono text-[10px] tracking-wider text-cyan-200/40">
                      周期 {sp.plan.total_weeks} 周 · 阶段 x{sp.plan.stages.length} · 任务 x{countTasks(sp.plan)}
                      {(sp.cycle || 1) > 1 && (
                        <span className="ml-2 text-violet-300/70">· 第 {sp.cycle} 周目 NG+</span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] tracking-wider text-fuchsia-300/40">
                      建档 {formatDate(sp.createdAt)} · 领域 {meta.zh}
                    </p>

                    {/* 印章 */}
                    <div
                      className={`pointer-events-none absolute right-4 top-9 rotate-[-12deg] border-2 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest transition-all duration-300 group-hover:scale-105 ${stamp.cls}`}
                    >
                      {stamp.text}
                    </div>

                    {/* 解密进度 */}
                    <div className="mt-4 flex items-center gap-2 font-mono text-[10px]">
                      <span className={isComplete ? "text-emerald-300/90" : "text-cyan-300/80"}>
                        {declassBar(progress)}
                      </span>
                      <span className="text-white/45">
                        <span className={`cyber-neon ${isComplete ? "text-emerald-300" : "text-cyan-300"}`}>{Math.round(progress * 100)}%</span> DECLASSIFIED
                      </span>
                    </div>
                    <div className="mt-2 h-0.5 w-full bg-white/[0.05]">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>

                    {/* 底部操作行 */}
                    <div className="mt-4 flex items-center justify-between border-t border-cyan-400/[0.08] pt-3">
                      <span className="text-[11px] text-white/35 transition-colors group-hover:text-cyan-300/90">
                        抽出卷宗查看 →
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/plan/universe?planId=${encodeURIComponent(sp.id)}`);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] tracking-widest text-cyan-300/50 hover:bg-cyan-400/10 hover:text-cyan-200 transition-colors"
                        title="查看这份计划的专属小宇宙"
                      >
                        ✦ 小宇宙
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDestroy(sp.id);
                        }}
                        className="px-2 py-0.5 font-mono text-[9px] tracking-widest text-white/25 hover:bg-fuchsia-400/10 hover:text-fuchsia-300/90 transition-colors"
                        title="销毁档案"
                      >
                        销毁 ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 空白卷宗：立新档 */}
            <div
              className="group relative"
              style={{ transform: `rotate(${plans.length % 2 === 0 ? "-0.5deg" : "0.5deg"})` }}
            >
              <div className="relative z-10 ml-5 inline-flex items-center gap-2 border border-b-0 border-dashed border-cyan-400/30 bg-transparent px-3.5 py-1.5 font-mono text-[10px] tracking-wider text-cyan-300/40">
                <span>EXP-???</span>
              </div>
              <div
                onClick={() => router.push("/universe?welcome=1")}
                className="relative -mt-px flex min-h-[230px] cursor-pointer flex-col items-center justify-center border border-dashed border-cyan-400/30 bg-cyan-400/[0.02] p-5 transition-all duration-300 hover:border-cyan-400/60 hover:bg-cyan-400/[0.05] group-hover:-translate-y-1.5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-cyan-400/30 text-2xl text-cyan-300/50 transition-all group-hover:border-cyan-400/60 group-hover:text-cyan-300 group-hover:rotate-90 duration-300">
                  +
                </div>
                <p className="mt-4 text-sm font-medium text-white/60 group-hover:text-cyan-200 transition-colors">立新档</p>
                <p className="mt-1 font-mono text-[10px] tracking-widest text-cyan-300/30">开启一段新的远征</p>
                {/* 悬浮时出现的待立项印章 */}
                <div className="pointer-events-none absolute right-5 top-5 rotate-[-12deg] border-2 border-fuchsia-400/0 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-fuchsia-300/0 transition-all duration-300 group-hover:border-fuchsia-400/50 group-hover:text-fuchsia-300/90">
                  待立项 PENDING
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 空状态附言 */}
        {mounted && plans.length === 0 && (
          <p className="mt-10 text-center text-xs text-white/30">
            档案柜还是空的。点击空白卷宗，说出你想做的事，第一份远征档案就会在这里立起来。
          </p>
        )}
      </main>

      {/* 销毁确认 */}
      {confirmDestroy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setConfirmDestroy(null)}
        >
          <div
            className="cyber-panel cyber-corner w-full max-w-xs p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-[10px] tracking-[0.3em] text-fuchsia-300/70 mb-2">DESTROY DOSSIER</p>
            <p className="text-sm text-white/85 font-medium">粉碎此卷宗？</p>
            <p className="mt-1.5 text-xs text-white/45 leading-relaxed">
              「{plans.find((p) => p.id === confirmDestroy)?.plan.title}」的计划、版本历史与对应小宇宙都会被销毁，无法恢复。
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => destroyDossier(confirmDestroy)}
                className="flex-1 border border-fuchsia-400/40 bg-fuchsia-400/10 px-3 py-2 font-mono text-xs tracking-widest text-fuchsia-300 hover:bg-fuchsia-400/20 transition-colors"
              >
                确认粉碎
              </button>
              <button
                onClick={() => setConfirmDestroy(null)}
                className="flex-1 border border-white/10 px-3 py-2 font-mono text-xs text-white/40 hover:bg-white/[0.06] transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
