"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { DemoExperience } from "./DemoExperience";
import { FeatureGrid } from "./FeatureGrid";
import { SubjectCloud } from "./SubjectCloud";
import { BrandStory, HeroWordmark } from "./BrandStory";
import { CyberCore } from "@/components/profile/CyberCore";

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? window.scrollY / h : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return progress;
}

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

/* ───── 顶部导航 ───── */
function LandingNav() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 transition-all duration-500 ${
        scrolled
          ? "bg-black/70 backdrop-blur-xl border-b border-cyan-400/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
          : "bg-transparent"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 text-cyan-300 text-sm font-bold bg-black/40 shadow-[0_0_12px_rgba(34,211,238,0.15)]">
          N
        </div>
        <span className="neon-title text-[15px] font-semibold tracking-wider">Nexiova</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/login")}
          className="px-5 py-2 text-xs font-medium tracking-wider text-cyan-200 border border-cyan-400/30 rounded-lg hover:bg-cyan-400/10 transition-all"
        >
          登录
        </button>
        <button
          onClick={() => router.push("/login?mode=register")}
          className="px-5 py-2 text-xs font-medium tracking-wider text-black bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg hover:opacity-90 transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)]"
        >
          免费注册
        </button>
      </div>
    </nav>
  );
}

/* ───── 数字统计区（滚动触发计数动画）───── */
function StatCounter({ end, suffix, label }: { end: number; suffix: string; label: string }) {
  const { ref, visible } = useInView();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = Math.max(1, Math.ceil(end / 60));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); return; }
      setCount(start);
    }, 20);
    return () => clearInterval(timer);
  }, [visible, end]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl md:text-4xl font-bold font-mono text-cyan-300">
        {count}{suffix}
      </div>
      <div className="mt-1 text-xs text-white/40 tracking-wider">{label}</div>
    </div>
  );
}

/* ───── 页脚 ───── */
function LandingFooter() {
  return (
    <footer className="relative border-t border-white/5 py-12 px-6 md:px-12">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/20 text-cyan-300 text-xs font-bold bg-black/40">N</div>
          <span className="text-sm text-white/50">Nexiova</span>
        </div>
        <div className="flex items-center gap-6 text-[11px] text-white/30 tracking-wider">
          <span className="cursor-pointer hover:text-white/60 transition">隐私政策</span>
          <span className="cursor-pointer hover:text-white/60 transition">用户协议</span>
          <span>ICP 备案号待填</span>
        </div>
      </div>
    </footer>
  );
}

/* ───── 主落地页 ───── */
export function LandingPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const scrollProgress = useScrollProgress();

  const section1 = useInView(0.1);
  const section2 = useInView(0.1);
  const section3 = useInView(0.1);
  const section4 = useInView(0.1);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      router.push(`/onboarding?q=${encodeURIComponent(input.trim())}`);
    }
  }, [input, router]);

  // parallax offset for hero
  const heroOffset = scrollProgress * 300;
  const heroOpacity = Math.max(0, 1 - scrollProgress * 3);

  return (
    <div className="relative min-h-screen bg-[#050510] text-white overflow-x-hidden">
      <CosmicBackground />
      <CyberOverlay />
      <LandingNav />

      {/* ═══ Hero Section ═══ */}
      <section
        className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-20"
        style={{ transform: `translateY(${heroOffset}px)`, opacity: heroOpacity }}
      >
        {/* 字标解构 + 3D 赛博核心 */}
        <div className="relative flex flex-col items-center mb-2">
          <HeroWordmark />
          <CyberCore className="w-[320px] h-[320px] md:w-[420px] md:h-[420px] -mt-2" />
        </div>

        <h1 className="text-4xl md:text-6xl font-bold text-center max-w-3xl leading-tight tracking-tight">
          <span className="bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent">
            让每一颗知识星
          </span>
          <br />
          <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
            为你而亮
          </span>
        </h1>

        <p className="mt-5 text-sm md:text-base text-white/45 max-w-xl text-center leading-relaxed">
          AI 驱动的沉浸式学习宇宙——不是教知识，而是操控你的好奇心、记忆和成就感，让你忘记自己在学习。
        </p>

        {/* 输入框 */}
        <form onSubmit={handleSubmit} className="mt-10 w-full max-w-lg relative group">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative flex items-center rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden transition-all focus-within:border-cyan-400/40 focus-within:shadow-[0_0_30px_rgba(34,211,238,0.12)]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="你想学会什么？"
              className="flex-1 bg-transparent px-5 py-4 text-sm text-white/90 placeholder:text-white/25 outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-5 py-4 text-xs font-medium tracking-wider text-cyan-300 hover:text-white disabled:text-white/15 transition-colors"
            >
              开始探索 →
            </button>
          </div>
        </form>

        <button
          onClick={() => router.push("/universe")}
          className="mt-5 text-xs text-white/25 hover:text-white/50 transition-colors tracking-wider"
        >
          或者，先自由漫游宇宙
        </button>

        {/* 向下滚动提示 — 滚动后消失 */}
        <div className={`absolute bottom-10 flex flex-col items-center gap-2 animate-bounce transition-opacity duration-700 ${scrollProgress > 0.02 ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <div className="w-5 h-8 rounded-full border border-white/15 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-cyan-300/50" />
          </div>
          <span className="text-[10px] text-white/20 tracking-widest">SCROLL</span>
        </div>
      </section>

      {/* ═══ 品牌故事 ═══ */}
      <BrandStory />

      {/* ═══ 数据一瞥 ═══ */}
      <section className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8">
          <StatCounter end={33} suffix="+" label="学科领域" />
          <StatCounter end={400} suffix="+" label="知识节点" />
          <StatCounter end={6} suffix="" label="布鲁姆认知层级" />
        </div>
      </section>

      {/* ═══ 60 秒体验 ═══ */}
      <section ref={section1.ref} className="relative py-24 px-6">
        <div className={`max-w-3xl mx-auto transition-all duration-1000 ${section1.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}>
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 text-[10px] tracking-[0.3em] text-cyan-300/70 border border-cyan-400/20 rounded-full font-mono uppercase mb-4">
              Try it now
            </span>
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">
              不注册，先学 60 秒
            </h2>
            <p className="mt-3 text-sm text-white/35">感受一下「刺激式学习」是什么体验</p>
          </div>
          <DemoExperience />
        </div>
      </section>

      {/* ═══ 学科宇宙 ═══ */}
      <section ref={section2.ref} className="relative py-24 px-6">
        <div className={`max-w-5xl mx-auto transition-all duration-1000 delay-100 ${section2.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}>
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 text-[10px] tracking-[0.3em] text-cyan-300/70 border border-cyan-400/20 rounded-full font-mono uppercase mb-4">
              Universe
            </span>
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              33 个学科，一个宇宙
            </h2>
            <p className="mt-3 text-sm text-white/35">每一个知识点都是一颗等你点亮的星</p>
          </div>
          <SubjectCloud />
        </div>
      </section>

      {/* ═══ 核心特性 ═══ */}
      <section ref={section3.ref} className="relative py-24 px-6">
        <div className={`max-w-5xl mx-auto transition-all duration-1000 delay-200 ${section3.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}>
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 text-[10px] tracking-[0.3em] text-cyan-300/70 border border-cyan-400/20 rounded-full font-mono uppercase mb-4">
              Features
            </span>
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              不只是学习，是一场探索
            </h2>
          </div>
          <FeatureGrid />
        </div>
      </section>

      {/* ═══ CTA 收尾 ═══ */}
      <section ref={section4.ref} className="relative py-32 px-6">
        <div className={`max-w-2xl mx-auto text-center transition-all duration-1000 ${section4.visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
            准备好了吗？
          </h2>
          <p className="mt-4 text-sm text-white/40">
            从一颗星开始，点亮你的知识宇宙。
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push("/login?mode=register")}
              className="px-8 py-3 text-sm font-medium text-black bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl hover:opacity-90 transition-all shadow-[0_0_30px_rgba(34,211,238,0.3)]"
            >
              免费注册，开始探索
            </button>
            <button
              onClick={() => router.push("/universe")}
              className="px-8 py-3 text-sm font-medium text-white/60 border border-white/10 rounded-xl hover:bg-white/[0.03] transition-all"
            >
              先看看宇宙
            </button>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
