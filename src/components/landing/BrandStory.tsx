"use client";

import { useEffect, useRef, useState } from "react";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const SEGMENTS = [
  {
    letters: "NEX",
    origin: "Nexus",
    meaning: "连接",
    desc: "知识连接知识。思想连接思想。人与 AI 连接。认知连接未来。",
    color: "from-cyan-400 to-cyan-300",
    glowColor: "rgba(34,211,238,0.15)",
    borderColor: "border-cyan-400/20",
    bgColor: "from-cyan-950/40 to-cyan-900/10",
  },
  {
    letters: "IO",
    origin: "Input / Output",
    meaning: "智能交互",
    desc: "你的每一次输入，AI 给出精准的输出。交互本身就是学习。",
    color: "from-blue-400 to-blue-300",
    glowColor: "rgba(59,130,246,0.15)",
    borderColor: "border-blue-400/20",
    bgColor: "from-blue-950/40 to-blue-900/10",
  },
  {
    letters: "VA",
    origin: "Nova · Evolution",
    meaning: "新星诞生",
    desc: "每次连接，都会点亮一颗新的星。成长不是积累，而是演化。",
    color: "from-violet-400 to-purple-300",
    glowColor: "rgba(139,92,246,0.15)",
    borderColor: "border-violet-400/20",
    bgColor: "from-violet-950/40 to-violet-900/10",
  },
];

function ConnectLine({ lit }: { lit: boolean }) {
  return (
    <div className="hidden md:flex items-center self-center h-px w-12 lg:w-16 relative">
      <div className={`absolute inset-0 h-px transition-all duration-1000 ${
        lit ? "bg-gradient-to-r from-cyan-400/40 via-blue-400/40 to-violet-400/40 shadow-[0_0_8px_rgba(120,120,255,0.3)]" : "bg-white/5"
      }`} />
      {lit && (
        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.5)] animate-pulse" style={{ left: "50%" }} />
      )}
    </div>
  );
}

export function BrandStory() {
  const container = useInView(0.2);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!container.visible) return;
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 600);
    const t3 = setTimeout(() => setPhase(3), 1000);
    const t4 = setTimeout(() => setPhase(4), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [container.visible]);

  return (
    <section ref={container.ref} className="relative py-24 px-6">
      <div className={`max-w-5xl mx-auto transition-all duration-700 ${container.visible ? "opacity-100" : "opacity-0"}`}>
        {/* Section label */}
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 text-[10px] tracking-[0.3em] text-cyan-300/70 border border-cyan-400/20 rounded-full font-mono uppercase mb-4">
            The Name
          </span>
          <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent">
            为什么叫 Nexiova
          </h2>
        </div>

        {/* Three columns with connecting lines */}
        <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 md:gap-0">
          {SEGMENTS.map((seg, i) => (
            <div key={seg.letters} className="contents">
              {/* Card */}
              <div
                className={`flex-1 max-w-xs mx-auto md:mx-0 rounded-2xl border bg-gradient-to-br backdrop-blur-md p-6 transition-all duration-700 ${seg.borderColor} ${seg.bgColor} ${
                  phase > i
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-8 scale-95"
                }`}
                style={{ transitionDelay: `${i * 200}ms` }}
              >
                {/* Big letters */}
                <div className="relative mb-4">
                  <span className={`text-5xl lg:text-6xl font-black font-mono bg-gradient-to-br ${seg.color} bg-clip-text text-transparent tracking-wider`}>
                    {seg.letters}
                  </span>
                  {phase > i && (
                    <div
                      className="absolute -inset-3 rounded-xl blur-2xl pointer-events-none transition-opacity duration-1000"
                      style={{ background: seg.glowColor, opacity: phase > i ? 1 : 0 }}
                    />
                  )}
                </div>

                {/* Origin word */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-white/50 tracking-wider">{seg.origin}</span>
                </div>

                {/* Chinese meaning */}
                <h3 className={`text-lg font-bold bg-gradient-to-r ${seg.color} bg-clip-text text-transparent mb-3`}>
                  {seg.meaning}
                </h3>

                {/* Description */}
                <p className="text-xs text-white/40 leading-relaxed">{seg.desc}</p>
              </div>

              {/* Connecting line between cards */}
              {i < SEGMENTS.length - 1 && <ConnectLine lit={phase > i + 1} />}
            </div>
          ))}
        </div>

        {/* Brand sentence */}
        <div className={`mt-16 text-center transition-all duration-1000 ${phase >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <div className="relative inline-block">
            {/* Decorative quotes */}
            <span className="absolute -left-6 -top-4 text-3xl text-cyan-400/10 font-serif select-none">&ldquo;</span>
            <span className="absolute -right-6 -bottom-4 text-3xl text-cyan-400/10 font-serif select-none">&rdquo;</span>

            <p className="text-lg md:text-xl font-medium tracking-wide text-white/80 italic">
              Where Connections Become New Stars.
            </p>
            <p className="mt-3 text-sm text-white/40 tracking-wider">
              每一次连接，都会诞生一颗新的星。
            </p>
          </div>

          {/* Small accent star */}
          {phase >= 4 && (
            <div className="mt-6 flex justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-300/70 shadow-[0_0_12px_rgba(34,211,238,0.6)] animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───── Hero 字标解构（轻量版）───── */
const WORDMARK_PARTS = [
  { text: "Nex", hint: "Nexus · 连接", cls: "text-cyan-300", hoverCls: "text-cyan-200 drop-shadow-[0_0_14px_rgba(34,211,238,0.5)]" },
  { text: "io",  hint: "I/O · 智能交互", cls: "text-blue-300", hoverCls: "text-blue-200 drop-shadow-[0_0_14px_rgba(59,130,246,0.5)]" },
  { text: "va",  hint: "Nova · 新星", cls: "text-violet-300", hoverCls: "text-violet-200 drop-shadow-[0_0_14px_rgba(139,92,246,0.5)]" },
] as const;

export function HeroWordmark() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center gap-1 mb-2">
      <div className="relative select-none cursor-default font-mono text-3xl md:text-5xl font-black tracking-[0.06em]">
        {WORDMARK_PARTS.map((p, i) => (
          <span
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={`transition-all duration-300 ${hovered === i ? p.hoverCls : p.cls}`}
          >
            {p.text}
          </span>
        ))}
      </div>

      <div className="h-5 flex items-center justify-center">
        {hovered !== null ? (
          <span className="text-[11px] text-white/45 tracking-[0.2em] font-mono animate-fade-in">
            {WORDMARK_PARTS[hovered].hint}
          </span>
        ) : (
          <span className="text-[11px] text-white/20 tracking-[0.25em] font-mono hidden md:inline">
            NEX · IO · VA
          </span>
        )}
      </div>
    </div>
  );
}
