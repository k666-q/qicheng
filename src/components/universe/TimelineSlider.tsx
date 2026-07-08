"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { TimelineEvent } from "@/lib/universe/small-universe";

type Props = {
  events: TimelineEvent[];
  onTimeChange: (visibleNodeIds: Set<string>) => void;
  onClose: () => void;
};

export function TimelineSlider({ events, onClose, onTimeChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(1);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sorted = [...events]
    .filter((e) => e.action === "completed")
    .sort((a, b) => a.timestamp - b.timestamp);

  const totalSteps = sorted.length;

  const getVisibleAtStep = useCallback(
    (step: number): Set<string> => {
      const visible = new Set<string>();
      for (let i = 0; i < step && i < sorted.length; i++) {
        visible.add(sorted[i].nodeId);
      }
      return visible;
    },
    [sorted]
  );

  useEffect(() => {
    onTimeChange(getVisibleAtStep(position));
  }, [position, getVisibleAtStep, onTimeChange]);

  const handlePlay = () => {
    if (playing) {
      if (animRef.current) clearInterval(animRef.current);
      animRef.current = null;
      setPlaying(false);
      return;
    }

    setPlaying(true);
    let step = position >= totalSteps ? 0 : position;
    setPosition(step);

    animRef.current = setInterval(() => {
      step++;
      if (step > totalSteps) {
        if (animRef.current) clearInterval(animRef.current);
        animRef.current = null;
        setPlaying(false);
        return;
      }
      setPosition(step);
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, []);

  const currentDate = sorted[position - 1]
    ? new Date(sorted[position - 1].timestamp).toLocaleDateString("zh-CN")
    : "";

  if (totalSteps === 0) {
    return (
      <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center">
        <div className="rounded-2xl border border-white/10 bg-[#12121a]/90 backdrop-blur-xl px-6 py-4 shadow-2xl">
          <p className="text-sm text-white/50">还没有学习记录，开始学习后可在这里回放构建过程</p>
          <button onClick={onClose} className="mt-2 text-[11px] text-white/30 hover:text-white/50">关闭</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#12121a]/90 backdrop-blur-xl px-6 py-4 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-white/80">时间流回放</h3>
            <span className="text-[11px] text-white/40">
              {position}/{totalSteps} 节点 · {currentDate}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Slider */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlay}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
          >
            {playing ? (
              <svg className="h-3.5 w-3.5 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5 text-white/80 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min={0}
            max={totalSteps}
            value={position}
            onChange={(e) => {
              setPosition(Number(e.target.value));
              if (playing) {
                if (animRef.current) clearInterval(animRef.current);
                animRef.current = null;
                setPlaying(false);
              }
            }}
            className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-white/30">
          <span>拖动滑块或点击播放，观看小宇宙的构建历程</span>
        </div>
      </div>
    </div>
  );
}
