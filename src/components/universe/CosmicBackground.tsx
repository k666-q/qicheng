"use client";

// 共享深色星空背景：星云渐变 + 闪烁星点。
// 用于计划页、笔记本页等非 3D 页面，保证与宇宙页视觉语言一致。

import { useEffect, useRef } from "react";

export function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const stars: { x: number; y: number; r: number; phase: number; speed: number }[] = [];

    function resize() {
      const cv = canvasRef.current;
      if (!cv) return;
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 130; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.2 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.7,
      });
    }

    let t = 0;
    function draw() {
      const cv = canvasRef.current;
      if (!cv || !ctx) return;
      t += 0.016;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const s of stars) {
        const alpha = 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(s.phase + t * s.speed));
        ctx.beginPath();
        ctx.arc(s.x * cv.width, s.y * cv.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_25%_15%,rgba(76,29,149,0.16),transparent_55%),radial-gradient(ellipse_at_75%_85%,rgba(30,58,138,0.14),transparent_55%)]" />
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" />
    </>
  );
}
