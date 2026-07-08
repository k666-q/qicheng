"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_STEPS = [
  {
    type: "predict" as const,
    tag: "先猜后讲",
    question: "为什么赌场永远不会输钱？",
    options: [
      { label: "A", text: "庄家运气更好" },
      { label: "B", text: "每局都有微小的概率优势" },
      { label: "C", text: "赌客没有自控力" },
      { label: "D", text: "赌场可以作弊" },
    ],
    answer: "B",
    why: "大数定律：当试验次数足够多时，每局仅 1-5% 的概率优势就足以保证稳赚。不需要作弊，数学本身就是庄家。",
  },
  {
    type: "teach" as const,
    tag: "讲解",
    content: "这就是**大数定律**的力量。\n\n当你抛一枚硬币 10 次，正面可能出现 7 次——这很正常。但当你抛 10,000 次，正面的比例会无限趋近 50%。\n\n赌场不需要每局都赢。它只需要每局有 **微小的数学优势**，然后等时间和次数替它完成收割。\n\n这不只是赌博的秘密——这是整个保险业、金融业、甚至 AI 训练的底层逻辑。",
  },
  {
    type: "quiz" as const,
    tag: "挑战题",
    question: "保险公司的商业模式本质上利用了哪个数学原理？",
    options: [
      { label: "A", text: "中心极限定理" },
      { label: "B", text: "大数定律" },
      { label: "C", text: "贝叶斯定理" },
      { label: "D", text: "期望值计算" },
    ],
    answer: "B",
    taunt: "约 65% 的人会被 D 选项诱惑。",
    why: "保险公司和赌场一样——在大量投保人中，个体事故是随机的，但总体赔付率会趋于稳定（大数定律），于是保费定价可以保证利润。",
  },
];

type Step = (typeof DEMO_STEPS)[number];

function PredictDemo({ step, onDone }: { step: Step; onDone: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const revealed = picked !== null;
  const correct = picked === step.answer;

  return (
    <div className="rounded-2xl border border-indigo-400/20 bg-[#13131d]/90 backdrop-blur-xl p-5 shadow-xl">
      <span className="inline-block px-2.5 py-1 text-[10px] font-medium tracking-wider rounded-full bg-indigo-500/20 text-indigo-300 mb-3">
        {step.tag}
      </span>
      <p className="text-[15px] text-white/90 font-medium mb-4">{step.question}</p>
      <div className="grid grid-cols-1 gap-2">
        {step.options?.map((o) => {
          const isAnswer = o.label === step.answer;
          const isPicked = o.label === picked;
          return (
            <button
              key={o.label}
              disabled={revealed}
              onClick={() => setPicked(o.label)}
              className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                revealed
                  ? isAnswer
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                    : isPicked
                      ? "border-red-400/40 bg-red-400/10 text-red-200/70"
                      : "border-white/5 bg-white/[0.02] text-white/30"
                  : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:border-white/20"
              }`}
            >
              <span className="font-mono text-xs text-white/30 mr-2">{o.label}</span>
              {o.text}
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="mt-4 space-y-2">
          <p className={`text-sm font-medium ${correct ? "text-emerald-300" : "text-amber-300"}`}>
            {correct ? "没错！" : "差一点！"}
          </p>
          <p className="text-xs text-white/50 leading-relaxed">{step.why}</p>
          <button
            onClick={onDone}
            className="mt-2 px-4 py-2 text-xs text-cyan-300 border border-cyan-400/30 rounded-lg hover:bg-cyan-400/10 transition-all"
          >
            继续 →
          </button>
        </div>
      )}
    </div>
  );
}

function TeachDemo({ step, onDone }: { step: Step; onDone: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#13131d]/90 backdrop-blur-xl p-5 shadow-xl">
      <div className="text-[14px] leading-relaxed text-white/80 [&_strong]:text-white [&_p]:mb-3">
        {step.content?.split("\n\n").map((p, i) => (
          <p key={i} dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
        ))}
      </div>
      <button
        onClick={onDone}
        className="mt-3 px-4 py-2 text-xs text-cyan-300 border border-cyan-400/30 rounded-lg hover:bg-cyan-400/10 transition-all"
      >
        继续 →
      </button>
    </div>
  );
}

function QuizDemo({ step, onDone }: { step: Step; onDone: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const revealed = picked !== null;
  const correct = picked === step.answer;

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-[#13131d]/90 backdrop-blur-xl p-5 shadow-xl">
      <span className="inline-block px-2.5 py-1 text-[10px] font-medium tracking-wider rounded-full bg-amber-500/20 text-amber-300 mb-3">
        {step.tag}
      </span>
      {step.taunt && (
        <p className="text-[11px] text-amber-300/60 italic mb-2">{step.taunt}</p>
      )}
      <p className="text-[15px] text-white/90 font-medium mb-4">{step.question}</p>
      <div className="grid grid-cols-1 gap-2">
        {step.options?.map((o) => {
          const isAnswer = o.label === step.answer;
          const isPicked = o.label === picked;
          return (
            <button
              key={o.label}
              disabled={revealed}
              onClick={() => setPicked(o.label)}
              className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                revealed
                  ? isAnswer
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                    : isPicked
                      ? "border-red-400/40 bg-red-400/10 text-red-200/70"
                      : "border-white/5 bg-white/[0.02] text-white/30"
                  : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:border-white/20"
              }`}
            >
              <span className="font-mono text-xs text-white/30 mr-2">{o.label}</span>
              {o.text}
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="mt-4 space-y-2">
          <p className={`text-sm font-medium ${correct ? "text-emerald-300" : "text-amber-300"}`}>
            {correct ? "厉害！你已经在用大数定律思维了。" : "被诱惑了？这正是出题的艺术。"}
          </p>
          <p className="text-xs text-white/50 leading-relaxed">{step.why}</p>
          <button
            onClick={onDone}
            className="mt-2 px-4 py-2 text-xs text-cyan-300 border border-cyan-400/30 rounded-lg hover:bg-cyan-400/10 transition-all"
          >
            体验结束 →
          </button>
        </div>
      )}
    </div>
  );
}

export function DemoExperience() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const current = DEMO_STEPS[step];
  if (!current || done) {
    return (
      <div className="text-center py-8 rounded-2xl border border-cyan-400/15 bg-[#13131d]/60 backdrop-blur-xl">
        <div className="text-5xl mb-4">&#10024;</div>
        <h3 className="text-lg font-bold text-cyan-200 mb-2">这就是 Nexiova 的学习方式</h3>
        <p className="text-xs text-white/40 mb-6 max-w-sm mx-auto">
          预测 → 讲解 → 挑战 → 获得思维——每一步都在操控你的注意力和记忆。
        </p>
        <button
          onClick={() => router.push("/login?mode=register")}
          className="px-6 py-2.5 text-sm font-medium text-black bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)]"
        >
          注册，开始你的宇宙
        </button>
      </div>
    );
  }

  const advance = () => {
    if (step < DEMO_STEPS.length - 1) setStep(step + 1);
    else setDone(true);
  };

  return (
    <div className="transition-all duration-500">
      {/* 进度指示 */}
      <div className="flex items-center gap-2 mb-5 justify-center">
        {DEMO_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-500 ${
              i <= step ? "w-10 bg-cyan-400/60" : "w-6 bg-white/10"
            }`}
          />
        ))}
      </div>

      {current.type === "predict" && <PredictDemo step={current} onDone={advance} />}
      {current.type === "teach" && <TeachDemo step={current} onDone={advance} />}
      {current.type === "quiz" && <QuizDemo step={current} onDone={advance} />}
    </div>
  );
}
