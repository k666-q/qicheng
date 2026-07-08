"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { COGNITION_DIMENSIONS, type CognitionResult } from "@/lib/universe/cognition";
import type { SubjectNode } from "@/lib/universe/types";

type Props = {
  cognition: CognitionResult;
  subjects: SubjectNode[];
  /** 最近一次点亮带来的增长提示 */
  lastGain?: string | null;
};

export function CognitionPanel({ cognition, subjects, lastGain }: Props) {
  const radarData = COGNITION_DIMENSIONS.map((d) => ({
    dim: d.name,
    value: cognition.dims[d.id],
  }));

  const topSubjects = subjects
    .map((s) => ({ subject: s, value: cognition.bySubject.get(s.id) || 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return (
    <div className="w-[240px] rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl shadow-lg">
      <p className="text-[10px] text-white/30 font-medium">认知星图</p>
      <p className="mt-0.5 text-xl font-semibold text-white/90">
        {cognition.total}
        <span className="ml-1.5 text-[10px] font-normal text-white/40">总认知值</span>
      </p>

      {/* 雷达图 */}
      <div className="h-[170px] -mx-3 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="68%">
            <PolarGrid stroke="rgba(255,255,255,0.12)" />
            <PolarAngleAxis dataKey="dim" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }} />
            <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.35} isAnimationActive={false} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 维度积分 */}
      <div className="mt-1 space-y-1">
        {COGNITION_DIMENSIONS.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: d.color, boxShadow: `0 0 5px ${d.color}` }}
            />
            <span className="text-[11px] text-white/60">{d.name}</span>
            <span className="ml-auto text-[11px] font-medium text-white/80">{cognition.dims[d.id]}</span>
          </div>
        ))}
      </div>

      {/* 学科认知贡献 Top3 */}
      {topSubjects.length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-2.5">
          <p className="text-[10px] text-white/30 mb-1.5">学科认知贡献</p>
          <div className="space-y-1">
            {topSubjects.map(({ subject, value }) => (
              <div key={subject.id} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: subject.color }} />
                <span className="text-[11px] text-white/60">{subject.name}</span>
                <span className="ml-auto text-[11px] text-white/50">+{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近增长提示 */}
      {lastGain && (
        <div className="mt-3 rounded-lg border border-violet-300/20 bg-violet-400/10 px-2.5 py-1.5">
          <p className="text-[10px] text-violet-300 leading-relaxed">✨ {lastGain}</p>
        </div>
      )}

      {cognition.total === 0 && (
        <p className="mt-2 text-[10px] text-white/30 leading-relaxed">
          还没有认知积分。完成任务或在学习层标记掌握知识点，认知星图就会亮起来。
        </p>
      )}
    </div>
  );
}
