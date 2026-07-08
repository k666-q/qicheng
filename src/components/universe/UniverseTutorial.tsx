"use client";

import { useCallback, useEffect, useState } from "react";

const TUTORIAL_KEY = "qicheng_universe_tutorial_done";

const STEPS = [
  {
    title: "欢迎来到知识宇宙",
    description: "这是你的知识星图——每一颗星都是一个知识领域，等待你去探索和点亮。",
    position: "center" as const,
  },
  {
    title: "学科导航",
    description: "左侧面板列出了所有学科。鼠标悬停可聚焦单个学科，点击可飞向该学科。",
    position: "left" as const,
  },
  {
    title: "旋转星环 = 学科",
    description: "3D空间中旋转的星环代表学科节点，点击它可以展开或收起该学科的所有知识点。",
    position: "center" as const,
  },
  {
    title: "搜索定位",
    description: "顶部搜索框可以快速找到任何知识点，选中后相机会自动飞向它。",
    position: "top" as const,
  },
  {
    title: "连线即关系",
    description: "知识点之间的连线代表关联关系。点击任意连线可以查看详细的关联原因和学术依据。",
    position: "center" as const,
  },
];

export function UniverseTutorial({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(TUTORIAL_KEY);
    if (!done) {
      setVisible(true);
    } else {
      onComplete();
    }
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (step >= STEPS.length - 1) {
      localStorage.setItem(TUTORIAL_KEY, "1");
      setVisible(false);
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, onComplete]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, "1");
    setVisible(false);
    onComplete();
  }, [onComplete]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Content card */}
      <div
        className={`relative z-10 mx-6 max-w-sm rounded-2xl border border-white/10 bg-[#12121a]/95 p-7 backdrop-blur-xl shadow-2xl ${
          current.position === "top" ? "self-start mt-20" :
          current.position === "left" ? "self-center mr-auto ml-20" : ""
        }`}
      >
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step ? "w-6 bg-indigo-400" : i < step ? "w-3 bg-white/30" : "w-3 bg-white/10"
              }`}
            />
          ))}
        </div>

        <h3 className="text-base font-semibold text-white/90 mb-2">{current.title}</h3>
        <p className="text-sm text-white/50 leading-relaxed mb-6">{current.description}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            跳过引导
          </button>
          <button
            onClick={handleNext}
            className="rounded-lg bg-indigo-500/80 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
          >
            {isLast ? "开始探索" : "下一步"}
          </button>
        </div>
      </div>
    </div>
  );
}
