"use client";

import { useEffect, useRef, useState } from "react";

type ComboLevel = "spark" | "flame" | "comet" | "supernova";

function getComboLevel(combo: number): ComboLevel {
  if (combo >= 8) return "supernova";
  if (combo >= 5) return "comet";
  if (combo >= 3) return "flame";
  return "spark";
}

const LEVEL_CONFIG: Record<ComboLevel, { label: string; particles: number; duration: number }> = {
  spark: { label: "", particles: 12, duration: 600 },
  flame: { label: "🔥", particles: 20, duration: 800 },
  comet: { label: "☄️", particles: 30, duration: 1000 },
  supernova: { label: "💥", particles: 50, duration: 1200 },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hue: number;
}

function ParticleBurst({ level, onDone }: { level: ComboLevel; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const config = LEVEL_CONFIG[level];
    const cx = canvas.offsetWidth / 2;
    const cy = canvas.offsetHeight / 2;

    const particles: Particle[] = [];
    for (let i = 0; i < config.particles; i++) {
      const angle = (Math.PI * 2 * i) / config.particles + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2.5,
        alpha: 1,
        hue: level === "supernova" ? Math.random() * 360 : 220 + Math.random() * 80,
      });
    }

    let frame = 0;
    const totalFrames = Math.round(config.duration / 16);
    let raf = 0;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      frame++;
      const progress = frame / totalFrames;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.alpha = Math.max(0, 1 - progress * 1.2);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.alpha})`;
        ctx.fill();
      }

      if (frame < totalFrames) {
        raf = requestAnimationFrame(draw);
      } else {
        onDone();
      }
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [level, onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-50"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export function CorrectFeedback({ combo }: { combo: number }) {
  const [show, setShow] = useState(true);
  const level = getComboLevel(combo);

  if (!show || combo <= 0) return null;

  return (
    <>
      <ParticleBurst level={level} onDone={() => setShow(false)} />
      {/* Flash overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-40 animate-[flashFade_0.4s_ease-out_forwards]"
        style={{
          background: `radial-gradient(circle at 50% 50%, hsla(${level === "supernova" ? 280 : 230}, 70%, 60%, 0.25), transparent 70%)`,
        }}
      />
      {/* Combo counter */}
      {combo >= 2 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-[comboPopIn_0.3s_ease-out_forwards]">
          <div className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 px-3 py-1.5">
            {LEVEL_CONFIG[level].label && (
              <span className="text-sm">{LEVEL_CONFIG[level].label}</span>
            )}
            <span className="text-[12px] font-bold text-amber-300">
              x{combo} 连击
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export function ComboCounter({ combo }: { combo: number }) {
  if (combo < 2) return null;
  const level = getComboLevel(combo);
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1">
      {LEVEL_CONFIG[level].label && (
        <span className="text-[10px]">{LEVEL_CONFIG[level].label}</span>
      )}
      <span className="text-[11px] font-medium text-amber-300">x{combo}</span>
    </div>
  );
}
