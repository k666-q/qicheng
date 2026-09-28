"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KnowledgeUniverse, type ClickedLink, type MiniMapNode } from "@/components/universe/KnowledgeUniverse";
import { NodeDetailPanel } from "@/components/universe/NodeDetailPanel";
import { UniverseTutorial } from "@/components/universe/UniverseTutorial";
import { MiniMap } from "@/components/universe/MiniMap";
import {
  loadGraph,
  getLearnedNodeIds,
  computeNodeStatuses,
  markLearned,
  unmarkLearned,
} from "@/lib/universe/store";
import { getPlanRoute, getTaskNodeIds } from "@/lib/universe/plan-link";
import { computeCognition, primaryDimOfNode, nodeDimGains } from "@/lib/universe/cognition";
import { getMasteryMap } from "@/lib/universe/mastery";
import { CognitionPanel } from "@/components/universe/CognitionPanel";
import { loadSessionItem } from "@/lib/plan/store";
import { getEventsByType } from "@/lib/profile/events";
import { EchoNotice } from "@/components/stimulus/EchoNotice";
import { FutureWhisper } from "@/components/stimulus/FutureWhisper";
import type { GeneratedPlan, PlanTask } from "@/lib/plan/types";
import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge, NodeStatus, SubjectNode } from "@/lib/universe/types";
import { loadDeepNodes, type DeepNodeFile } from "@/lib/universe/deep-loader";
import { reconcileUniverses, loadPlans, getActivePlanId, type StoredPlan } from "@/lib/plan/plans-store";
import { TodayPanel } from "@/components/plan/TodayPanel";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { getTodayRemaining } from "@/lib/plan/daily-scheduler";

/* ===== Immersive Starfield: parallax depth, milky way, nebulae & meteor showers ===== */
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; isComet: boolean };
type FloatingParticle = { x: number; y: number; vx: number; vy: number; r: number; opacity: number; phase: number };
type NovaFlash = { x: number; y: number; life: number; maxLife: number; maxR: number };
type Star = { x: number; y: number; r: number; speed: number; phase: number; brightness: number; color: string };
type RGB = [number, number, number];

const METEOR_COLORS = [
  "255,255,255",
  "180,210,255",
  "255,220,150",
  "200,180,255",
];

// Star color temperatures, weighted toward white / blue-white
const STAR_TINTS = [
  "205,217,255",
  "235,240,255",
  "255,255,255",
  "255,255,255",
  "255,233,196",
  "255,210,168",
];

// Nebula theme palettes: each theme has 3 hue-breathing color pairs.
// A random theme is picked per visit for background variety.
const NEBULA_THEMES: { nebs: [RGB, RGB][] }[] = [
  // 深紫夜空
  { nebs: [[[99, 102, 241], [150, 90, 240]], [[236, 72, 153], [244, 120, 110]], [[6, 182, 212], [45, 212, 191]]] },
  // 蓝绿极光
  { nebs: [[[16, 185, 129], [6, 182, 212]], [[59, 130, 246], [99, 102, 241]], [[45, 212, 191], [134, 239, 172]]] },
  // 暖橙星尘
  { nebs: [[[245, 158, 11], [239, 100, 80]], [[217, 70, 239], [236, 72, 153]], [[251, 146, 60], [250, 204, 21]]] },
  // 冷蓝深空
  { nebs: [[[37, 99, 235], [91, 33, 182]], [[14, 165, 233], [99, 102, 241]], [[30, 64, 175], [6, 182, 212]]] },
  // 紫红梦境
  { nebs: [[[192, 38, 211], [236, 72, 153]], [[139, 92, 246], [99, 102, 241]], [[244, 63, 94], [251, 113, 133]]] },
];

const PLANET_COLORS: RGB[] = [
  [185, 150, 120],
  [150, 170, 220],
  [210, 185, 140],
  [165, 200, 190],
];

function pickStarTint() {
  return STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)];
}

function mix3(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function fmt3(c: RGB): string {
  return `${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])}`;
}

function hexToRGB(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function StarfieldCanvas({ tint }: { tint?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tintRef = useRef<string | null>(null);

  useEffect(() => {
    tintRef.current = tint ?? null;
  }, [tint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId = 0;
    let W = 0;
    let H = 0;

    let farStars: Star[] = [];
    let midStars: Star[] = [];
    let nearStars: Star[] = [];
    const meteors: Meteor[] = [];
    const novas: NovaFlash[] = [];
    let particles: FloatingParticle[] = [];
    let milky: HTMLCanvasElement | null = null;
    let vignette: HTMLCanvasElement | null = null;

    // Per-visit theme + randomized nebula placement (background variety)
    const theme = NEBULA_THEMES[Math.floor(Math.random() * NEBULA_THEMES.length)];
    const nebCfg = Array.from({ length: 3 }, (_, i) => ({
      bx: [0.3, 0.78, 0.7][i] + (Math.random() - 0.5) * 0.16,
      by: [0.38, 0.22, 0.8][i] + (Math.random() - 0.5) * 0.12,
      rad: [0.38, 0.3, 0.25][i] * (0.85 + Math.random() * 0.35),
      phase: Math.random() * Math.PI * 2,
      breatheBase: [0.045, 0.032, 0.022][i],
      breatheAmp: [0.015, 0.01, 0.008][i],
    }));

    // Subject-focus tint (smoothly blended into nebula colors)
    let tintMix = 0;
    let tintRGB: RGB = [255, 255, 255];

    // Mouse parallax (lerped toward target)
    let targetPX = 0;
    let targetPY = 0;
    let px = 0;
    let py = 0;

    // Meteor shower event
    let showerRemaining = 0;
    let showerOrigin = { x: 0, y: 0 };
    let showerAngle = 0;
    let showerColor = METEOR_COLORS[0];

    // Rare celestial events
    let aurora: { start: number; duration: number; hueA: RGB; hueB: RGB } | null = null;
    let planet: { x: number; y: number; vx: number; r: number; col: RGB; ring: boolean } | null = null;

    // Click ripples
    const ripples: { x: number; y: number; life: number; maxLife: number }[] = [];

    const cv = canvas;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
      initParticles();
      buildMilkyWay();
      buildVignette();
    }

    function initStars() {
      const area = W * H;
      // Far layer: many tiny dim stars, 3 shared twinkle groups (phase = group index)
      farStars = Array.from({ length: Math.floor(area / 1500) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.2 + Math.random() * 0.6,
        speed: 0,
        phase: Math.floor(Math.random() * 3),
        brightness: 0.25 + Math.random() * 0.3,
        color: pickStarTint(),
      }));
      // Mid layer: current-spec stars with individual twinkle
      midStars = Array.from({ length: Math.floor(area / 2800) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.6 + Math.random() * 0.9,
        speed: Math.random() * 0.5 + 0.1,
        phase: Math.random() * Math.PI * 2,
        brightness: 0.4 + Math.random() * 0.4,
        color: pickStarTint(),
      }));
      // Near layer: few large bright stars with glow + diffraction spikes
      nearStars = Array.from({ length: Math.max(8, Math.floor(area / 16000)) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1.5 + Math.random() * 1.1,
        speed: Math.random() * 0.4 + 0.15,
        phase: Math.random() * Math.PI * 2,
        brightness: 0.7 + Math.random() * 0.3,
        color: pickStarTint(),
      }));
    }

    function initParticles() {
      particles = Array.from({ length: 40 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.06,
        r: 2 + Math.random() * 3,
        opacity: 0.03 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2,
      }));
    }

    // Pre-rendered diagonal milky way band
    function buildMilkyWay() {
      milky = document.createElement("canvas");
      milky.width = Math.max(1, W);
      milky.height = Math.max(1, H);
      const m = milky.getContext("2d")!;
      const diag = Math.sqrt(W * W + H * H) * 1.2;
      const bandHalf = Math.min(W, H) * 0.16;
      m.save();
      m.translate(W / 2, H / 2);
      m.rotate(Math.atan2(-H, W) * 0.6);

      const haze = m.createLinearGradient(0, -bandHalf * 2.2, 0, bandHalf * 2.2);
      haze.addColorStop(0, "rgba(150,170,220,0)");
      haze.addColorStop(0.5, "rgba(165,185,235,0.055)");
      haze.addColorStop(1, "rgba(150,170,220,0)");
      m.fillStyle = haze;
      m.fillRect(-diag / 2, -bandHalf * 2.2, diag, bandHalf * 4.4);

      const core = m.createLinearGradient(0, -bandHalf * 0.9, 0, bandHalf * 0.9);
      core.addColorStop(0, "rgba(190,205,245,0)");
      core.addColorStop(0.5, "rgba(200,215,250,0.05)");
      core.addColorStop(1, "rgba(190,205,245,0)");
      m.fillStyle = core;
      m.fillRect(-diag / 2, -bandHalf * 0.9, diag, bandHalf * 1.8);

      // Dense micro-stars, gaussian-distributed across the band
      const starCount = Math.floor(diag * 0.9);
      for (let i = 0; i < starCount; i++) {
        const x = (Math.random() - 0.5) * diag;
        const g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
        const y = g * bandHalf;
        const r = 0.15 + Math.random() * 0.6;
        const a = (0.12 + Math.random() * 0.4) * (1 - Math.abs(g) * 0.7);
        m.beginPath();
        m.arc(x, y, r, 0, Math.PI * 2);
        m.fillStyle = `rgba(${pickStarTint()}, ${a})`;
        m.fill();
      }
      m.restore();
    }

    // Pre-rendered vignette overlay
    function buildVignette() {
      vignette = document.createElement("canvas");
      vignette.width = Math.max(1, W);
      vignette.height = Math.max(1, H);
      const v = vignette.getContext("2d")!;
      const g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.38)");
      v.fillStyle = g;
      v.fillRect(0, 0, W, H);
    }

    function spawnMeteor(isComet = false) {
      const angle = Math.random() * Math.PI * 0.5 + Math.PI * 0.1;
      const speed = isComet ? 2 + Math.random() * 2 : 4 + Math.random() * 5;
      const color = METEOR_COLORS[Math.floor(Math.random() * METEOR_COLORS.length)];
      meteors.push({
        x: Math.random() * W * 0.85,
        y: Math.random() * H * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: isComet ? 90 + Math.random() * 60 : 35 + Math.random() * 25,
        size: isComet ? 2 + Math.random() * 1.5 : 1 + Math.random() * 1.2,
        color,
        isComet,
      });
    }

    function spawnShowerMeteor() {
      const speed = 5 + Math.random() * 3;
      meteors.push({
        x: showerOrigin.x + (Math.random() - 0.5) * W * 0.3,
        y: showerOrigin.y + (Math.random() - 0.5) * H * 0.15,
        vx: Math.cos(showerAngle) * speed,
        vy: Math.sin(showerAngle) * speed,
        life: 0,
        maxLife: 40 + Math.random() * 20,
        size: 1 + Math.random(),
        color: showerColor,
        isComet: false,
      });
    }

    function spawnNova() {
      const pool = midStars.length ? midStars : farStars;
      const s = pool[Math.floor(Math.random() * pool.length)];
      novas.push({
        x: s?.x ?? Math.random() * W,
        y: s?.y ?? Math.random() * H,
        life: 0,
        maxLife: 30 + Math.random() * 20,
        maxR: 4 + Math.random() * 5,
      });
    }

    function handleMouse(e: MouseEvent) {
      targetPX = (e.clientX / Math.max(1, W) - 0.5) * 2;
      targetPY = (e.clientY / Math.max(1, H) - 0.5) * 2;
    }

    function handlePointerDown(e: PointerEvent) {
      ripples.push({ x: e.clientX, y: e.clientY, life: 0, maxLife: 45 });
      if (ripples.length > 6) ripples.shift();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() * 0.001;

      // Smooth parallax follow
      px += (targetPX - px) * 0.08;
      py += (targetPY - py) * 0.08;

      // --- Subject-focus tint blending
      const targetTint = tintRef.current ? hexToRGB(tintRef.current) : null;
      tintMix += ((targetTint ? 1 : 0) - tintMix) * 0.04;
      if (targetTint) tintRGB = mix3(tintRGB, targetTint, 0.06);

      // --- Nebulae: themed colors, drifting centers + hue breathing
      const hueK = Math.sin(t * 0.06) * 0.5 + 0.5;
      for (let i = 0; i < 3; i++) {
        const cfg = nebCfg[i];
        const pair = theme.nebs[i];
        let col = mix3(pair[0], pair[1], i === 1 ? 1 - hueK : hueK);
        if (tintMix > 0.02) col = mix3(col, tintRGB, tintMix * (i === 0 ? 0.6 : 0.35));
        const breathe = cfg.breatheBase + Math.sin(t * (0.2 + i * 0.05) + i) * cfg.breatheAmp;
        const nx = W * cfg.bx + Math.cos(t * 0.045 + cfg.phase) * W * 0.05 - px * 6;
        const ny = H * cfg.by + Math.sin(t * 0.04 + cfg.phase) * H * 0.045 - py * 6;
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, W * cfg.rad);
        g.addColorStop(0, `rgba(${fmt3(col)}, ${breathe})`);
        if (i === 0) g.addColorStop(0.55, `rgba(${fmt3(mix3(col, [139, 92, 246], 0.5))}, ${breathe * 0.45})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // --- Aurora band (rare event, ~every 2-3 min)
      if (!aurora && Math.random() < 0.00012) {
        aurora = {
          start: t,
          duration: 14 + Math.random() * 6,
          hueA: [80, 240, 180],
          hueB: [120, 140, 255],
        };
      }
      if (aurora) {
        const prog = (t - aurora.start) / aurora.duration;
        if (prog >= 1) {
          aurora = null;
        } else {
          const env = Math.sin(prog * Math.PI);
          const baseY = H * 0.16;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, baseY);
          for (let x = 0; x <= W; x += 24) {
            const y = baseY + Math.sin(x * 0.008 + t * 0.6) * H * 0.04 + Math.sin(x * 0.021 - t * 0.35) * H * 0.02;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W, 0);
          ctx.closePath();
          const ag = ctx.createLinearGradient(0, 0, 0, baseY + H * 0.06);
          ag.addColorStop(0, `rgba(${fmt3(aurora.hueB)}, ${0.02 * env})`);
          ag.addColorStop(0.7, `rgba(${fmt3(aurora.hueA)}, ${0.1 * env})`);
          ag.addColorStop(1, `rgba(${fmt3(aurora.hueA)}, ${0.16 * env})`);
          ctx.fillStyle = ag;
          ctx.fill();
        }
      }

      // --- Milky way band (pre-rendered, breathing opacity + slight parallax)
      if (milky) {
        ctx.globalAlpha = 0.55 + Math.sin(t * 0.1) * 0.15;
        ctx.drawImage(milky, -px * 6, -py * 6);
        ctx.globalAlpha = 1;
      }

      // --- Distant planet transit (rare event)
      if (!planet && Math.random() < 0.00008) {
        const fromLeft = Math.random() < 0.5;
        planet = {
          x: fromLeft ? -60 : W + 60,
          y: H * (0.15 + Math.random() * 0.5),
          vx: (fromLeft ? 1 : -1) * (0.12 + Math.random() * 0.08),
          r: 10 + Math.random() * 14,
          col: PLANET_COLORS[Math.floor(Math.random() * PLANET_COLORS.length)],
          ring: Math.random() < 0.6,
        };
      }
      if (planet) {
        planet.x += planet.vx;
        if (planet.x < -100 || planet.x > W + 100) {
          planet = null;
        } else {
          const { x, y, r, col } = planet;
          const pg = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
          pg.addColorStop(0, `rgba(${fmt3(col)}, 0.55)`);
          pg.addColorStop(1, `rgba(${fmt3(mix3(col, [0, 0, 0], 0.7))}, 0.45)`);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = pg;
          ctx.fill();
          if (planet.ring) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-0.35);
            ctx.scale(1, 0.32);
            ctx.beginPath();
            ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${fmt3(col)}, 0.3)`;
            ctx.lineWidth = r * 0.22;
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // --- Far stars: 3 shared twinkle phase groups (cheap)
      const farA = [
        0.55 + 0.45 * Math.sin(t * 0.5),
        0.55 + 0.45 * Math.sin(t * 0.5 + (Math.PI * 2) / 3),
        0.55 + 0.45 * Math.sin(t * 0.5 + (Math.PI * 4) / 3),
      ];
      const fox = -px * 4;
      const foy = -py * 4;
      for (const s of farStars) {
        const alpha = s.brightness * farA[s.phase as 0 | 1 | 2];
        ctx.beginPath();
        ctx.arc(s.x + fox, s.y + foy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
        ctx.fill();
      }

      // --- Floating particles (mid depth)
      const mox = -px * 10;
      const moy = -py * 10;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;
        const flicker = Math.sin(t * 0.8 + p.phase) * 0.02 + p.opacity;
        ctx.beginPath();
        ctx.arc(p.x + mox, p.y + moy, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 200, 255, ${flicker})`;
        ctx.fill();
      }

      // --- Mid stars: individual twinkle
      for (const s of midStars) {
        const twinkle = Math.sin(t * s.speed * 2 + s.phase) * 0.5 + 0.5;
        const alpha = s.brightness * (0.3 + twinkle * 0.7);
        ctx.beginPath();
        ctx.arc(s.x + mox, s.y + moy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
        ctx.fill();
      }

      // --- Near stars: glow + diffraction spikes
      const nox = -px * 18;
      const noy = -py * 18;
      for (const s of nearStars) {
        const twinkle = Math.sin(t * s.speed * 2 + s.phase) * 0.5 + 0.5;
        const alpha = s.brightness * (0.4 + twinkle * 0.6);
        const x = s.x + nox;
        const y = s.y + noy;

        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, s.r * 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color}, ${alpha * 0.08})`;
        ctx.fill();

        // Diffraction cross for the brightest
        if (s.r > 1.8) {
          const len = s.r * (4 + twinkle * 4);
          ctx.strokeStyle = `rgba(${s.color}, ${alpha * 0.35})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(x - len, y);
          ctx.lineTo(x + len, y);
          ctx.moveTo(x, y - len);
          ctx.lineTo(x, y + len);
          ctx.stroke();
        }
      }

      // --- Meteor shower event + regular meteors
      if (showerRemaining > 0) {
        if (Math.random() < 0.3) {
          spawnShowerMeteor();
          showerRemaining--;
        }
      } else if (Math.random() < 0.0004) {
        showerRemaining = 4 + Math.floor(Math.random() * 3);
        showerAngle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
        showerColor = METEOR_COLORS[Math.floor(Math.random() * METEOR_COLORS.length)];
        showerOrigin = { x: Math.random() * W * 0.5, y: Math.random() * H * 0.25 };
      }
      if (Math.random() < 0.012) spawnMeteor(false);
      if (Math.random() < 0.003) spawnMeteor(true);

      // Draw meteors & comets
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx;
        m.y += m.vy;
        m.life++;
        const progress = m.life / m.maxLife;
        const alpha = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;

        const tailLen = m.isComet ? 14 : 6;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * tailLen, m.y - m.vy * tailLen);
        ctx.strokeStyle = `rgba(${m.color}, ${alpha * 0.8})`;
        ctx.lineWidth = m.size;
        ctx.lineCap = "round";
        ctx.stroke();

        if (m.isComet) {
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * tailLen * 0.7, m.y - m.vy * tailLen * 0.7);
          ctx.strokeStyle = `rgba(${m.color}, ${alpha * 0.2})`;
          ctx.lineWidth = m.size * 4;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size * (m.isComet ? 2.5 : 1.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${m.color}, ${alpha * 0.6})`;
        ctx.fill();

        if (m.life >= m.maxLife) meteors.splice(i, 1);
      }

      // --- Nova flashes
      if (Math.random() < 0.005) spawnNova();
      for (let i = novas.length - 1; i >= 0; i--) {
        const n = novas[i];
        n.life++;
        const progress = n.life / n.maxLife;
        const r = n.maxR * (progress < 0.3 ? progress / 0.3 : 1);
        const alpha = progress < 0.3 ? 0.8 : 0.8 * (1 - (progress - 0.3) / 0.7);

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 230, 255, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 200, 255, ${alpha * 0.15})`;
        ctx.fill();

        if (n.life >= n.maxLife) novas.splice(i, 1);
      }

      // --- Click ripples (subtle expanding rings)
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.life++;
        const prog = rp.life / rp.maxLife;
        if (prog >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        const rr = 10 + prog * 90;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(160, 190, 255, ${0.25 * (1 - prog)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // --- Vignette (pre-rendered, topmost)
      if (vignette) ctx.drawImage(vignette, 0, 0);

      animId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("pointerdown", handlePointerDown);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

export default function UniversePage() {
  const router = useRouter();
  const [graph] = useState<KnowledgeGraph>(() => loadGraph());
  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [linkInfo, setLinkInfo] = useState<ClickedLink | null>(null);
  const [highlightSubjectId, setHighlightSubjectId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [miniMapNodes, setMiniMapNodes] = useState<MiniMapNode[]>([]);
  const [miniMapCamera, setMiniMapCamera] = useState<{ x: number; y: number; z: number } | null>(null);
  const [focusedSubjectId, setFocusedSubjectId] = useState<string | null>(null);
  // 逐层下钻：当前聚焦的父节点（null = 学科一级视图，只显示 depth 0 领域）
  const [drillNodeId, setDrillNodeId] = useState<string | null>(null);

  // Welcome overlay (shown when entering from root with no plan)
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeInput, setWelcomeInput] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome") === "1") {
      setShowWelcome(true);
      window.history.replaceState(null, "", "/universe");
    }
  }, []);

  // Deep nodes (lazy-loaded sub-trees)
  const [deepNodes, setDeepNodes] = useState<KnowledgeNode[]>([]);
  const [deepEdges, setDeepEdges] = useState<KnowledgeEdge[]>([]);
  const [deepLoadingId, setDeepLoadingId] = useState<string | null>(null);

  // Current learning plan (for the gold constellation route)
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [currentTask, setCurrentTask] = useState<PlanTask | null>(null);
  const [routeBarOpen, setRouteBarOpen] = useState(true);
  const [domainNoticeDismissed, setDomainNoticeDismissed] = useState(false);

  // View layer: learning layer (default) or cognition layer
  const [viewLayer, setViewLayer] = useState<"learn" | "cognition">("learn");

  // 计划小宇宙下拉：所有计划档案
  const [allPlans, setAllPlans] = useState<StoredPlan[]>([]);
  const [activePlanIdState, setActivePlanIdState] = useState<string | null>(null);
  const [planMenuOpen, setPlanMenuOpen] = useState(false);
  const [universeMenuOpen, setUniverseMenuOpen] = useState(false);
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [infoTab, setInfoTab] = useState<"info" | "alert">("info");

  // Draggable subject panel
  const [subjectPanelPos, setSubjectPanelPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const subjectPanelRef = useRef<HTMLDivElement>(null);
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const el = subjectPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: clientX, startY: clientY, origX: rect.left, origY: rect.top };
    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const cx = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const cy = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
      const nx = dragRef.current.origX + (cx - dragRef.current.startX);
      const ny = dragRef.current.origY + (cy - dragRef.current.startY);
      const clamped = {
        x: Math.max(0, Math.min(window.innerWidth - 210, nx)),
        y: Math.max(52, Math.min(window.innerHeight - 100, ny)),
      };
      setSubjectPanelPos(clamped);
    };
    const handleEnd = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleEnd);
  }, []);

  useEffect(() => {
    // 数据体检：清理孤儿小宇宙 + 活跃小宇宙与活跃计划对齐
    reconcileUniverses();
    setAllPlans(loadPlans().sort((a, b) => b.updatedAt - a.updatedAt));
    setActivePlanIdState(getActivePlanId());
  }, []);

  const [cogToast, setCogToast] = useState<string | null>(null);
  const [lastGainText, setLastGainText] = useState<string | null>(null);

  useEffect(() => {
    try {
      const planStr = loadSessionItem("qicheng_plan");
      if (planStr) setPlan(JSON.parse(planStr) as GeneratedPlan);
    } catch { /* ignore */ }
    try {
      const taskStr = loadSessionItem("qicheng_current_task");
      if (taskStr) setCurrentTask(JSON.parse(taskStr) as PlanTask);
    } catch { /* ignore */ }
  }, []);

  const planRoute = useMemo(() => (plan ? getPlanRoute(plan, graph) : null), [plan, graph]);

  const currentTaskNodeId = useMemo(() => {
    if (!currentTask) return null;
    // 有计划时限定在计划学科域内锚定，避免跨域误匹配
    const scope = planRoute ? planRoute.subjectIds : null;
    return getTaskNodeIds(currentTask, graph.nodes, scope)[0] ?? null;
  }, [currentTask, graph.nodes, planRoute]);

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  // 多周目掌握度（learned 变化时重算；显式记录 ∪ 隐式 level 1）
  const masteryLevels = useMemo(() => getMasteryMap(graph.nodes), [graph.nodes, learned]);

  // Cognition layer data（按掌握度加权：初见 0.4 · 精读 1.0 · 贯通 1.8 · 守护 2.0）
  const cognition = useMemo(() => computeCognition(learned, graph, masteryLevels), [learned, graph, masteryLevels]);
  const cognitionData = useMemo(() => {
    const nodeDimColor = new Map<string, string>();
    for (const node of graph.nodes) {
      if (!learned.has(node.id)) continue;
      const dim = primaryDimOfNode(node);
      if (dim) nodeDimColor.set(node.id, dim.color);
    }
    return {
      nodeValue: cognition.byNode,
      nodeDimColor,
      subjectValue: cognition.bySubject,
    };
  }, [cognition, graph.nodes, learned]);

  // Plan route nodes for the top constellation bar
  const routeNodes = useMemo(() => {
    if (!planRoute) return [];
    return planRoute.nodeIds
      .map((id) => nodeById.get(id))
      .filter((n): n is KnowledgeNode => Boolean(n));
  }, [planRoute, nodeById]);

  // Tasks of the current plan linked to the selected node
  const selectedPlanTasks = useMemo(() => {
    if (!selectedNode || !planRoute) return [];
    const tasks = planRoute.tasksByNode.get(selectedNode.id) || [];
    if (tasks.length === 0) return [];
    const completedTitles = new Set(
      getEventsByType("task_completed").map(
        (e) => (e.event_data?.title_plain as string) || (e.event_data?.title as string) || ""
      )
    );
    return tasks.map((t) => ({
      title: t.title_plain,
      day: t.day_label,
      completed: completedTitles.has(t.title_plain),
    }));
  }, [selectedNode, planRoute]);

  // Deep link: /universe?focus=<nodeId> flies to the node and opens its panel
  // &celebrate=1 时（探索完成归来）触发庆祝粒子与认知增益 toast
  const focusHandledRef = useRef(false);
  useEffect(() => {
    if (focusHandledRef.current) return;
    focusHandledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const target = params.get("focus");
    if (!target) return;
    const node = graph.nodes.find((n) => n.id === target);
    if (!node) return;
    const celebrate = params.get("celebrate") === "1";
    // 总览只渲染学科恒星，先进入该学科视图保证节点可见
    setFocusedSubjectId(node.subjectId);
    setDrillNodeId(node.parentId ?? null);
    const timer = setTimeout(() => {
      setSelectedNode(node);
      setFocusNodeId(target);
      setTimeout(() => setFocusNodeId(null), 3000);
      if (celebrate) {
        setCelebrateNodeId(target);
        setTimeout(() => setCelebrateNodeId(null), 2500);
        const gains = nodeDimGains(node);
        if (gains.length > 0) {
          const text = gains.map((g) => `${g.dim.name} +${g.gain}`).join(" · ");
          setCogToast(text);
          setLastGainText(`点亮「${node.name}」：${text}`);
          setTimeout(() => setCogToast(null), 3500);
        }
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, [graph.nodes]);

  // 双层视图：
  // - 总览·仅学科（推荐，流畅）：只渲染学科恒星 + 计划路线/已点亮/当前任务节点
  // - 总览·全部展开（壮观）：渲染全部节点，宏伟的全宇宙视觉
  // - 学科视图：只渲染该学科的节点与边
  const [overviewMode, setOverviewMode] = useState<"subjects" | "full">("subjects");
  useEffect(() => {
    try {
      if (localStorage.getItem("qicheng_universe_overview_mode") === "full") {
        setOverviewMode("full");
      }
    } catch { /* ignore */ }
  }, []);
  const handleOverviewModeChange = useCallback((mode: "subjects" | "full") => {
    setOverviewMode(mode);
    try {
      localStorage.setItem("qicheng_universe_overview_mode", mode);
    } catch { /* ignore */ }
  }, []);

  const expandedSubjects = useMemo(() => {
    if (focusedSubjectId) return new Set([focusedSubjectId]);
    if (overviewMode === "full") return new Set(graph.subjects.map((s) => s.id));
    return new Set<string>();
  }, [focusedSubjectId, overviewMode, graph.subjects]);

  // 今日待学节点（日级计划）：在星图上加推荐高亮标注
  const [todayNodeIds, setTodayNodeIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      setTodayNodeIds(new Set(getTodayRemaining()));
    } catch { /* ignore */ }
  }, []);

  // 总览·仅学科模式下额外保持可见的节点（计划路线/已点亮/当前任务/今日待学）
  const alwaysVisibleIds = useMemo(() => {
    const ids = new Set<string>();
    if (focusedSubjectId || overviewMode === "full") return ids; // 这两种模式不需要
    for (const id of planRoute?.nodeIds ?? []) ids.add(id);
    for (const id of learned) ids.add(id);
    if (currentTaskNodeId) ids.add(currentTaskNodeId);
    for (const id of todayNodeIds) ids.add(id);
    return ids;
  }, [focusedSubjectId, overviewMode, planRoute, learned, currentTaskNodeId, todayNodeIds]);

  // Subject focus view: only show the focused subject's nodes and intra-subject edges
  // Also merges any loaded deep sub-nodes.
  const displayGraph = useMemo(() => {
    const baseGraph = graph;

    if (!focusedSubjectId) return baseGraph;
    const subjects = baseGraph.subjects.filter((s) => s.id === focusedSubjectId);

    // 该学科全部节点（含已加载的深层）
    const subjectBase = baseGraph.nodes.filter((n) => n.subjectId === focusedSubjectId);
    const subjectDeep = deepNodes.filter((n) => n.subjectId === focusedSubjectId);
    const allSubjectNodes = [...subjectBase, ...subjectDeep];

    // 逐层下钻过滤：
    // - drillNodeId == null → 只显示 depth 0（学科一级领域）
    // - drillNodeId == X    → 显示 X 本身 + X 的直接子节点（parentId === X）
    let visibleNodes: typeof allSubjectNodes;
    if (!drillNodeId) {
      visibleNodes = allSubjectNodes.filter((n) => (n.depth ?? 0) === 0);
    } else {
      visibleNodes = allSubjectNodes.filter(
        (n) => n.id === drillNodeId || n.parentId === drillNodeId
      );
    }

    const ids = new Set(visibleNodes.map((n) => n.id));
    const baseEdges = baseGraph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    const validDeepEdges = deepEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { ...baseGraph, subjects, nodes: visibleNodes, edges: [...baseEdges, ...validDeepEdges] };
  }, [graph, focusedSubjectId, drillNodeId, deepNodes, deepEdges]);

  useEffect(() => {
    setLearned(getLearnedNodeIds(graph.nodes));
  }, [graph]);

  const statuses = useMemo(() => computeNodeStatuses(graph, learned), [graph, learned]);

  const learnedCount = useMemo(
    () => graph.nodes.filter((n) => learned.has(n.id)).length,
    [graph.nodes, learned]
  );

  const subjectById = useMemo(() => {
    const m = new Map(graph.subjects.map((s) => [s.id, s]));
    return m;
  }, [graph.subjects]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return graph.nodes
      .filter((n) => n.name.toLowerCase().includes(q) || n.plain_name.toLowerCase().includes(q) || n.keywords.some((k) => k.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [searchQuery, graph.nodes]);

  // Subject node counts
  const subjectNodeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of graph.nodes) {
      counts.set(n.subjectId, (counts.get(n.subjectId) || 0) + 1);
    }
    return counts;
  }, [graph.nodes]);

  // 侧边栏：按学科类别分组（固定顺序），未标注类别的归入"其他"
  const subjectGroups = useMemo(() => {
    const order = ["自然科学与工程", "人文社科", "商科与应用", "艺术与生活", "其他"];
    const byCat = new Map<string, SubjectNode[]>();
    for (const s of graph.subjects) {
      const cat = s.category && order.includes(s.category) ? s.category : "其他";
      const list = byCat.get(cat) || [];
      list.push(s);
      byCat.set(cat, list);
    }
    return order
      .filter((c) => (byCat.get(c) || []).length > 0)
      .map((c) => ({ name: c, subjects: byCat.get(c)! }));
  }, [graph.subjects]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Per-subject learned counts for the sidebar progress
  const subjectLearnedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of graph.nodes) {
      if (learned.has(n.id)) {
        counts.set(n.subjectId, (counts.get(n.subjectId) || 0) + 1);
      }
    }
    return counts;
  }, [graph.nodes, learned]);

  // Recommended next nodes: available + lowest difficulty（只在当前可见范围内推荐）
  // 今日计划节点优先并入高亮
  const recommendedNodeIds = useMemo(() => {
    const available = graph.nodes
      .filter(
        (n) =>
          statuses.get(n.id) === "available" &&
          (expandedSubjects.has(n.subjectId) || alwaysVisibleIds.has(n.id))
      )
      .sort((a, b) => a.difficulty - b.difficulty)
      .slice(0, 3);
    const ids = new Set(available.map((n) => n.id));
    for (const id of todayNodeIds) {
      if (!learned.has(id)) ids.add(id);
    }
    return ids;
  }, [graph.nodes, statuses, expandedSubjects, alwaysVisibleIds, todayNodeIds, learned]);

  const [celebrateNodeId, setCelebrateNodeId] = useState<string | null>(null);

  // Load deep sub-nodes when selecting a node with hasChildren
  const handleLoadDeepNodes = useCallback(async (node: KnowledgeNode) => {
    if (!node.hasChildren) return;
    const alreadyLoaded = deepNodes.some((n) => n.parentId === node.id);
    if (alreadyLoaded) return;
    setDeepLoadingId(node.id);
    try {
      const data = await loadDeepNodes(node.id);
      if (data) {
        setDeepNodes((prev) => [...prev, ...data.nodes]);
        setDeepEdges((prev) => [...prev, ...data.edges]);
      }
    } catch { /* ignore */ }
    setDeepLoadingId(null);
  }, [deepNodes]);

  const handleSubjectToggle = useCallback((subjectId: string) => {
    setSelectedNode(null);
    setLinkInfo(null);
    setDeepNodes([]);
    setDeepEdges([]);
    setDrillNodeId(null);
    setFocusedSubjectId((prev) => (prev === subjectId ? null : subjectId));
  }, []);

  // 节点点击：有子节点则下钻（加载子层 + 以该节点为核心，不弹面板），叶子则打开详情/学习
  const handleKnowledgeSelect = useCallback(
    (node: KnowledgeNode) => {
      if (node.hasChildren) {
        setSelectedNode(null);
        setLinkInfo(null);
        handleLoadDeepNodes(node);
        setDrillNodeId(node.id);
        // 平滑聚焦到下钻核心节点
        setFocusNodeId(node.id);
        setTimeout(() => setFocusNodeId(null), 2500);
      } else {
        setSelectedNode(node);
      }
    },
    [handleLoadDeepNodes]
  );

  // 面包屑：构建从学科到当前下钻节点的路径
  const drillBreadcrumb = useMemo(() => {
    if (!focusedSubjectId) return [];
    const subject = graph.subjects.find((s) => s.id === focusedSubjectId);
    const crumbs: { id: string | null; name: string }[] = [
      { id: null, name: subject?.name ?? "学科" },
    ];
    if (drillNodeId) {
      // 从 drillNodeId 向上回溯 parentId 链
      const allNodes = [...graph.nodes, ...deepNodes];
      const byId = new Map(allNodes.map((n) => [n.id, n]));
      const chain: KnowledgeNode[] = [];
      let cur = byId.get(drillNodeId);
      while (cur) {
        chain.unshift(cur);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      for (const n of chain) crumbs.push({ id: n.id, name: n.name });
    }
    return crumbs;
  }, [focusedSubjectId, drillNodeId, graph.subjects, graph.nodes, deepNodes]);

  // 面包屑点击：回退到某一层级
  const handleDrillTo = useCallback((nodeId: string | null) => {
    setDrillNodeId(nodeId);
    setSelectedNode(null);
    if (nodeId) {
      setFocusNodeId(nodeId);
      setTimeout(() => setFocusNodeId(null), 2500);
    }
  }, []);

  const handleToggleLearned = useCallback(
    (nodeId: string, makeLearned: boolean) => {
      if (makeLearned) {
        markLearned(nodeId);
        setCelebrateNodeId(nodeId);
        setTimeout(() => setCelebrateNodeId(null), 2500);
        // 认知维度增长 toast
        const node = graph.nodes.find((n) => n.id === nodeId);
        if (node) {
          const gains = nodeDimGains(node);
          if (gains.length > 0) {
            const text = gains.map((g) => `${g.dim.name} +${g.gain}`).join(" · ");
            setCogToast(text);
            setLastGainText(`点亮「${node.name}」：${text}`);
            setTimeout(() => setCogToast(null), 3500);
          }
        }
      } else {
        unmarkLearned(nodeId);
      }
      setLearned(getLearnedNodeIds(graph.nodes));
    },
    [graph.nodes]
  );

  const handleSearchSelect = useCallback((node: KnowledgeNode) => {
    setSearchQuery("");
    setSearchOpen(false);
    // 全部展开模式下节点本就可见，直接飞过去；仅学科模式先进入学科视图
    if (!focusedSubjectId && overviewMode === "full") {
      setFocusNodeId(node.id);
      setTimeout(() => setFocusNodeId(null), 3000);
      return;
    }
    setSelectedNode(null);
    setLinkInfo(null);
    setFocusedSubjectId(node.subjectId);
    // 下钻到该节点的父层级，保证目标节点在视图中可见
    setDrillNodeId(node.parentId ?? null);
    setTimeout(() => {
      setFocusNodeId(node.id);
      setTimeout(() => setFocusNodeId(null), 3000);
    }, 600);
  }, [focusedSubjectId, overviewMode]);

  const handleSidebarSubjectClick = useCallback((subjectId: string) => {
    setSelectedNode(null);
    setLinkInfo(null);
    setFocusedSubjectId(subjectId);
  }, []);

  const handleResetCamera = useCallback(() => {
    setFocusNodeId("__reset__");
    setTimeout(() => setFocusNodeId(null), 100);
  }, []);

  const handlePositionsUpdate = useCallback((nodes: MiniMapNode[], cam: { x: number; y: number; z: number } | null) => {
    setMiniMapNodes(nodes);
    setMiniMapCamera(cam);
  }, []);

  const prerequisites = useMemo(() => {
    if (!selectedNode) return [];
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    return graph.edges
      .filter((e) => e.type === "prerequisite" && e.target === selectedNode.id)
      .map((e) => nodeById.get(e.source))
      .filter((n): n is KnowledgeNode => Boolean(n))
      .map((n) => ({ node: n, learned: learned.has(n.id) }));
  }, [selectedNode, graph, learned]);

  // Topological path: unlearned prerequisites chain leading to selected node
  const learningPath = useMemo(() => {
    if (!selectedNode) return [];
    if (learned.has(selectedNode.id)) return [];
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const prereqMap = new Map<string, string[]>();
    for (const e of graph.edges) {
      if (e.type !== "prerequisite") continue;
      const list = prereqMap.get(e.target) || [];
      list.push(e.source);
      prereqMap.set(e.target, list);
    }
    const visited = new Set<string>();
    const ordered: KnowledgeNode[] = [];
    function dfs(id: string) {
      if (visited.has(id)) return;
      visited.add(id);
      for (const pre of prereqMap.get(id) || []) dfs(pre);
      const n = nodeById.get(id);
      if (n && n.id !== selectedNode!.id) ordered.push(n);
    }
    dfs(selectedNode.id);
    return ordered.map((n) => ({ node: n, learned: learned.has(n.id) }));
  }, [selectedNode, graph, learned]);

  const selectedStatus: NodeStatus = selectedNode
    ? statuses.get(selectedNode.id) || "locked"
    : "locked";

  // Ordered node ids for the 3D learning path highlight (path + target)
  const pathNodeIds = useMemo(() => {
    if (!selectedNode || learningPath.length === 0) return [];
    return [...learningPath.map((p) => p.node.id), selectedNode.id];
  }, [learningPath, selectedNode]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setLinkInfo(null);
  }, []);

  const [flyToTarget, setFlyToTarget] = useState<{ x: number; z: number; ts: number } | null>(null);
  const handleMiniMapNavigate = useCallback((x: number, z: number) => {
    setFlyToTarget({ x, z, ts: Date.now() });
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#050510]">
      {/* Dynamic starfield background */}
      <div className="absolute inset-0 z-0">
        <StarfieldCanvas tint={focusedSubjectId ? subjectById.get(focusedSubjectId)?.color ?? null : null} />
      </div>
      <CyberOverlay />

      {/* Graph canvas */}
      <div className="absolute inset-0 z-[1]">
        <KnowledgeUniverse
          graph={displayGraph}
          statuses={statuses}
          masteryLevels={masteryLevels}
          expandedSubjects={expandedSubjects}
          alwaysVisibleIds={alwaysVisibleIds}
          selectedNodeId={selectedNode?.id ?? null}
          highlightSubjectId={highlightSubjectId}
          recommendedNodeIds={recommendedNodeIds}
          celebrateNodeId={celebrateNodeId}
          onSubjectToggle={handleSubjectToggle}
          onKnowledgeSelect={handleKnowledgeSelect}
          onLinkClick={setLinkInfo}
          onBackgroundClick={handleBackgroundClick}
          focusNodeId={focusNodeId}
          pathNodeIds={pathNodeIds}
          planRouteIds={planRoute?.nodeIds}
          currentTaskNodeId={currentTaskNodeId}
          cognitionMode={viewLayer === "cognition"}
          cognitionData={cognitionData}
          onPositionsUpdate={handlePositionsUpdate}
          flyToTarget={flyToTarget}
        />
      </div>

      {/* Tutorial overlay */}
      <UniverseTutorial onComplete={() => {}} />

      {/* 回响通知 + 未来自我低语 */}
      <EchoNotice variant="dark" />
      <FutureWhisper variant="dark" />

      {/* Plan constellation route bar */}
      {plan && routeNodes.length > 0 && (
        <RouteBar
          plan={plan}
          routeNodes={routeNodes}
          learned={learned}
          currentTaskNodeId={currentTaskNodeId}
          routeBarOpen={routeBarOpen}
          setRouteBarOpen={setRouteBarOpen}
          focusedSubjectId={focusedSubjectId}
          setFocusedSubjectId={setFocusedSubjectId}
          setDrillNodeId={setDrillNodeId}
          setFocusNodeId={setFocusNodeId}
          router={router}
        />
      )}

      {/* 计划领域未被宇宙收录的提示 — 顶栏下方 toast */}
      {plan && planRoute && planRoute.subjectIds.size === 0 && !domainNoticeDismissed && (
        <div className="pointer-events-none absolute top-[60px] left-3 md:left-[calc(var(--siderail-width)+16px)] z-30 transition-[left] duration-[var(--dur-base)] ease-[var(--ease)]">
          <div className="pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius-panel)] border border-[var(--border-2)] bg-[var(--bg-2)]/95 px-3.5 py-2.5 backdrop-blur-xl shadow-[var(--shadow-float)] max-w-[340px] animate-in slide-in-from-right-full fade-in-0 duration-300">
            <p className="text-[var(--font-xs)] text-[var(--text-2)] leading-relaxed">
              「{plan.title}」所属领域暂未收录，先不为它画学习路线。
            </p>
            <button
              onClick={() => setDomainNoticeDismissed(true)}
              className="rounded-[var(--radius-control)] p-0.5 text-[var(--text-3)] hover:bg-[var(--bg-3)] hover:text-[var(--text-1)] transition-colors shrink-0 mt-0.5"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Right sidebar - Cognition panel (cognition layer) */}
      {viewLayer === "cognition" && (
        <div className="pointer-events-none absolute right-4 top-[60px] z-10">
          <div className="pointer-events-auto">
            <CognitionPanel cognition={cognition} subjects={graph.subjects} lastGain={lastGainText} />
          </div>
        </div>
      )}

      {/* Subject legend — 可拖拽面板，默认右侧中部 */}
      <div
        ref={subjectPanelRef}
        className={`pointer-events-none fixed z-10 ${viewLayer === "cognition" ? "hidden" : ""}`}
        style={subjectPanelPos
          ? { left: subjectPanelPos.x, top: subjectPanelPos.y }
          : { right: 16, top: "50%", transform: "translateY(-50%)" }
        }
      >
        <div className="pointer-events-auto flex flex-col gap-0.5 cyber-panel border-cyan-400/15 bg-black/70 backdrop-blur-xl p-2.5 max-h-[60vh] w-[200px] overflow-y-auto overscroll-contain">
          {/* 拖拽手柄 */}
          <div
            className="flex items-center justify-between cursor-grab active:cursor-grabbing select-none px-1.5 pb-1.5 pt-0.5"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <p className="text-[var(--font-xs)] text-cyan-300/50 tracking-wide">学科 · {graph.subjects.length}</p>
            <svg className="h-3 w-3 text-cyan-300/30" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h2v2H8zm6 0h2v2h-2zM8 11h2v2H8zm6 0h2v2h-2zM8 16h2v2H8zm6 0h2v2h-2z"/></svg>
          </div>
          {subjectGroups.map((group) => {
            const collapsed = collapsedGroups.has(group.name);
            return (
              <div key={group.name}>
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="flex w-full items-center gap-1.5 rounded-[var(--radius-control)] px-1.5 py-1.5 text-[var(--font-xs)] font-medium text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
                >
                  <svg
                    className={`h-3 w-3 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  {group.name}
                </button>
                {!collapsed && group.subjects.map((subject) => {
                  const count = subjectNodeCounts.get(subject.id) || 0;
                  const lc = subjectLearnedCounts.get(subject.id) || 0;
                  const progress = count > 0 ? lc / count : 0;
                  const isFocused = focusedSubjectId === subject.id;
                  return (
                    <button
                      key={subject.id}
                      onClick={() => handleSidebarSubjectClick(subject.id)}
                      onMouseEnter={() => setHighlightSubjectId(subject.id)}
                      onMouseLeave={() => setHighlightSubjectId(null)}
                      className={`flex w-full flex-col gap-1 rounded-[var(--radius-control)] px-2.5 py-2 text-left transition-colors ${
                        isFocused
                          ? "bg-white/[0.08] text-[var(--text-1)]"
                          : highlightSubjectId === subject.id
                            ? "bg-white/[0.05] text-[var(--text-1)]"
                            : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: subject.color }}
                        />
                        <span className="text-[var(--font-sm)] font-medium truncate">{subject.name}</span>
                        <span className="text-[var(--font-xs)] text-[var(--text-3)] ml-auto shrink-0 tabular-nums">{lc}/{count}</span>
                      </span>
                      <span className="block h-[3px] rounded-full bg-white/[0.06] overflow-hidden ml-4" style={{ width: "calc(100% - 16px)" }}>
                        <span
                          className="block h-full rounded-full transition-all duration-500"
                          style={{ width: `${progress * 100}%`, background: subject.color, opacity: 0.7 }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top header — 赛博朋克顶栏：左标题 · 中搜索 · 右操作 */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 md:pl-[var(--siderail-width)] transition-[padding] duration-[var(--dur-base)] ease-[var(--ease)]">
        <div className="pointer-events-auto flex h-[52px] items-center border-b border-cyan-400/20 bg-black/70 backdrop-blur-xl pl-14 pr-5 md:pl-5">
          {/* Left: 霓虹标题 + 信息/提醒 */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            {!focusedSubjectId ? (
              <h1 className="neon-title text-[var(--font-xl)] font-bold shrink-0">知识宇宙</h1>
            ) : (
              <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
                <button
                  onClick={() => { setDrillNodeId(null); setFocusedSubjectId(null); }}
                  className="text-[var(--font-lg)] text-cyan-300/60 hover:text-[var(--cyber-cyan)] transition-colors shrink-0"
                >
                  知识宇宙
                </button>
                {drillBreadcrumb.map((crumb, i) => {
                  const isLast = i === drillBreadcrumb.length - 1;
                  return (
                    <div key={crumb.id ?? "root"} className="flex items-center gap-2 shrink-0">
                      <span className="text-cyan-400/30 text-[var(--font-lg)] select-none">›</span>
                      <button
                        disabled={isLast}
                        onClick={() => handleDrillTo(crumb.id)}
                        className={`text-[var(--font-lg)] transition-colors ${
                          isLast
                            ? "neon-title font-bold cursor-default"
                            : "text-cyan-300/50 hover:text-[var(--cyber-cyan)]"
                        }`}
                      >
                        {i === 0 && (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full mr-2 align-middle"
                            style={{ backgroundColor: graph.subjects.find((s) => s.id === focusedSubjectId)?.color }}
                          />
                        )}
                        {crumb.name}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 信息/提醒按钮 */}
            <div className="relative">
              <button
                onClick={() => setInfoMenuOpen((v) => !v)}
                className="flex items-center justify-center h-8 w-8 rounded-[var(--radius-control)] text-cyan-300/50 hover:text-[var(--cyber-cyan)] hover:bg-[var(--cyber-cyan-dim)] transition-colors"
                title="信息与提醒"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </button>
              {infoMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setInfoMenuOpen(false)} />
                  <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-lg border border-cyan-400/20 bg-black/90 backdrop-blur-xl shadow-[0_0_24px_rgba(0,0,0,0.6)]">
                    <div className="flex border-b border-cyan-400/10">
                      <button
                        onClick={() => setInfoTab("info")}
                        className={`flex-1 py-2 text-[var(--font-sm)] font-medium transition-colors ${
                          infoTab === "info" ? "text-[var(--cyber-cyan)] border-b-2 border-[var(--cyber-cyan)]" : "text-cyan-300/40 hover:text-cyan-200/70"
                        }`}
                      >信息</button>
                      <button
                        onClick={() => setInfoTab("alert")}
                        className={`flex-1 py-2 text-[var(--font-sm)] font-medium transition-colors ${
                          infoTab === "alert" ? "text-[var(--cyber-cyan)] border-b-2 border-[var(--cyber-cyan)]" : "text-cyan-300/40 hover:text-cyan-200/70"
                        }`}
                      >提醒</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      {infoTab === "info" ? (
                        <div className="space-y-1.5">
                          <p className="text-[var(--font-sm)] text-cyan-300/60 px-2 py-1.5">已掌握 <span className="text-[var(--cyber-cyan)] font-bold">{learnedCount}</span> / {graph.nodes.length} 个知识点</p>
                          <p className="text-[var(--font-sm)] text-cyan-300/60 px-2 py-1.5">学科数 <span className="text-[var(--cyber-cyan)] font-bold">{graph.subjects.length}</span></p>
                          {plan && <p className="text-[var(--font-sm)] text-cyan-300/60 px-2 py-1.5">当前计划 <span className="text-[var(--cyber-cyan)]">{plan.title}</span></p>}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {plan && planRoute && planRoute.subjectIds.size === 0 && (
                            <p className="text-[var(--font-sm)] text-amber-400/80 px-2 py-1.5">「{plan.title}」所属领域暂未收录</p>
                          )}
                          {todayNodeIds.size > 0 && (
                            <p className="text-[var(--font-sm)] text-cyan-300/60 px-2 py-1.5">今日还有 <span className="text-[var(--cyber-cyan)] font-bold">{todayNodeIds.size}</span> 个待学节点</p>
                          )}
                          {todayNodeIds.size === 0 && planRoute && planRoute.subjectIds.size > 0 && (
                            <p className="text-[var(--font-sm)] text-emerald-400/70 px-2 py-1.5">今日任务已全部完成</p>
                          )}
                          {!plan && <p className="text-[var(--font-sm)] text-cyan-300/40 px-2 py-1.5">暂无提醒</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Center: 搜索框 — 霓虹渐变边框 */}
          <div className="flex-1 flex justify-center px-4">
            <div className="relative w-full max-w-md">
              <div className="neon-search-border flex items-center h-9 rounded-lg px-3">
                <svg className="h-4 w-4 text-cyan-300/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="搜索知识点…"
                  className="ml-2 w-full bg-transparent text-[var(--font-sm)] text-[var(--text-1)] placeholder:text-cyan-300/30 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }} className="text-cyan-300/50 hover:text-[var(--cyber-cyan)] transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchOpen && searchQuery && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} />
                  <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-lg border border-cyan-400/20 bg-black/90 backdrop-blur-xl shadow-[0_0_24px_rgba(0,0,0,0.6)] overflow-hidden">
                    {searchResults.length > 0 ? (
                      <div className="max-h-72 overflow-y-auto p-1">
                        {searchResults.map((node) => {
                          const subject = subjectById.get(node.subjectId);
                          return (
                            <button
                              key={node.id}
                              onClick={() => handleSearchSelect(node)}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-cyan-400/10 transition-colors rounded-[var(--radius-control)]"
                            >
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: subject?.color || "#888" }} />
                              <div className="min-w-0">
                                <p className="text-[var(--font-sm)] text-[var(--text-1)] truncate">{node.name}</p>
                                <p className="text-[var(--font-xs)] text-cyan-300/40 truncate">{subject?.name} · {node.plain_name}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="px-3 py-4 text-center text-[var(--font-sm)] text-cyan-300/40">无匹配结果</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: 项目选择 + 视图切换 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 计划下拉 — 展示所有计划 */}
            <div className="relative">
              <button
                onClick={() => { setPlanMenuOpen((v) => !v); setUniverseMenuOpen(false); }}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-control)] text-cyan-300/50 hover:text-[var(--cyber-cyan)] hover:bg-[var(--cyber-cyan-dim)] transition-colors"
                title="计划"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <svg className={`h-3 w-3 transition-transform ${planMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {planMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setPlanMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-cyan-400/20 bg-black/90 backdrop-blur-xl shadow-[0_0_24px_rgba(0,0,0,0.6)]">
                    <p className="px-3 pt-2.5 pb-1.5 text-[var(--font-xs)] text-cyan-300/50 font-medium">所有计划</p>
                    <div className="max-h-72 overflow-y-auto p-1">
                      {allPlans.length > 0 ? allPlans.map((sp) => {
                        const isActive = sp.id === activePlanIdState;
                        return (
                          <button
                            key={sp.id}
                            onClick={() => {
                              setPlanMenuOpen(false);
                              router.push(`/plan/detail`);
                            }}
                            className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-cyan-400/10 rounded-[var(--radius-control)]"
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? "bg-[var(--cyber-cyan)] shadow-[0_0_6px_var(--cyber-cyan)]" : "bg-white/20"}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[var(--font-sm)] text-[var(--text-1)]">{sp.plan.title}</span>
                              <span className="block text-[var(--font-xs)] text-cyan-300/40">
                                {sp.plan.total_weeks}w · {sp.plan.stages.length} 阶段{isActive ? " · 执行中" : ""}
                              </span>
                            </span>
                          </button>
                        );
                      }) : (
                        <p className="px-3 py-3 text-[var(--font-sm)] text-cyan-300/40">暂无计划</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 小宇宙下拉 — 展示所有小宇宙 */}
            <div className="relative">
              <button
                onClick={() => { setUniverseMenuOpen((v) => !v); setPlanMenuOpen(false); }}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-control)] text-cyan-300/50 hover:text-[var(--cyber-cyan)] hover:bg-[var(--cyber-cyan-dim)] transition-colors"
                title="小宇宙"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
                <svg className={`h-3 w-3 transition-transform ${universeMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {universeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setUniverseMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-cyan-400/20 bg-black/90 backdrop-blur-xl shadow-[0_0_24px_rgba(0,0,0,0.6)]">
                    <p className="px-3 pt-2.5 pb-1.5 text-[var(--font-xs)] text-cyan-300/50 font-medium">所有小宇宙</p>
                    <div className="max-h-72 overflow-y-auto p-1">
                      {allPlans.length > 0 ? allPlans.map((sp) => {
                        const isActive = sp.id === activePlanIdState;
                        return (
                          <button
                            key={sp.id}
                            onClick={() => {
                              setUniverseMenuOpen(false);
                              router.push(`/plan/universe?planId=${encodeURIComponent(sp.id)}`);
                            }}
                            className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-cyan-400/10 rounded-[var(--radius-control)]"
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? "bg-[var(--cyber-cyan)] shadow-[0_0_6px_var(--cyber-cyan)]" : "bg-white/20"}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[var(--font-sm)] text-[var(--text-1)]">{sp.plan.title}</span>
                              <span className="block text-[var(--font-xs)] text-cyan-300/40">
                                {sp.plan.total_weeks}w · {sp.plan.stages.length} 阶段{isActive ? " · 执行中" : ""}
                              </span>
                            </span>
                          </button>
                        );
                      }) : (
                        <p className="px-3 py-3 text-[var(--font-sm)] text-cyan-300/40">暂无小宇宙</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <span className="h-4 w-px bg-cyan-400/15 mx-1" />

            {/* 视图层切换 */}
            <div className="flex items-center h-8 rounded-[var(--radius-control)] bg-cyan-400/10 p-0.5 shrink-0">
              <button
                onClick={() => setViewLayer("learn")}
                className={`h-full px-3 rounded-[5px] text-[var(--font-sm)] font-medium transition-colors ${
                  viewLayer === "learn" ? "bg-[var(--cyber-cyan-dim)] text-[var(--cyber-cyan)] shadow-[inset_0_0_8px_var(--cyber-cyan-dim)]" : "text-cyan-300/40 hover:text-cyan-200/70"
                }`}
              >
                学习
              </button>
              <button
                onClick={() => setViewLayer("cognition")}
                className={`h-full px-3 rounded-[5px] text-[var(--font-sm)] font-medium transition-colors ${
                  viewLayer === "cognition" ? "bg-[var(--cyber-cyan-dim)] text-[var(--cyber-cyan)] shadow-[inset_0_0_8px_var(--cyber-cyan-dim)]" : "text-cyan-300/40 hover:text-cyan-200/70"
                }`}
              >
                认知
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Bottom left: 视图控制工具条 */}
      <div className="pointer-events-none absolute left-3 md:left-[calc(var(--siderail-width)+16px)] bottom-4 z-10 transition-[left] duration-[var(--dur-base)] ease-[var(--ease)]">
        <div className="pointer-events-auto flex items-center h-9 cyber-panel border-cyan-400/20 bg-black/70 backdrop-blur-xl p-1">
          {!focusedSubjectId && (
            <>
              <button
                onClick={() => handleOverviewModeChange("subjects")}
                title="只显示学科恒星"
                className={`h-full px-2.5 rounded-[var(--radius-control)] text-[var(--font-xs)] transition-colors ${
                  overviewMode === "subjects" ? "bg-[var(--cyber-cyan-dim)] text-[var(--cyber-cyan)]" : "text-cyan-300/40 hover:text-[var(--cyber-cyan)]"
                }`}
              >
                仅学科
              </button>
              <button
                onClick={() => handleOverviewModeChange("full")}
                title="展开全部知识节点"
                className={`h-full px-2.5 rounded-[var(--radius-control)] text-[var(--font-xs)] transition-colors ${
                  overviewMode === "full" ? "bg-[var(--cyber-cyan-dim)] text-[var(--cyber-cyan)]" : "text-cyan-300/40 hover:text-[var(--cyber-cyan)]"
                }`}
              >
                全部展开
              </button>
              <span className="h-3 w-px bg-cyan-400/15 mx-1" />
            </>
          )}
          <button
            onClick={handleResetCamera}
            className="flex items-center gap-1.5 h-full px-2.5 rounded-[var(--radius-control)] text-[var(--font-xs)] text-cyan-300/40 hover:text-[var(--cyber-cyan)] transition-colors"
            title="重置视角"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            重置视角
          </button>
        </div>
      </div>

      {/* Bottom-right: MiniMap */}
      <div className="pointer-events-none absolute right-4 bottom-4 z-10">
        <div className="pointer-events-auto">
          <MiniMap
            nodes={miniMapNodes}
            cameraPos={miniMapCamera}
            focusedSubjectId={focusedSubjectId}
            onNavigate={handleMiniMapNavigate}
          />
        </div>
      </div>

      {/* Bottom-left: Today's tasks panel */}
      <TodayPanel
        nodeById={nodeById}
        onNodeClick={(id) => {
          const n = nodeById.get(id);
          if (n) {
            if (!focusedSubjectId) setFocusedSubjectId(n.subjectId);
            setFocusNodeId(id);
            setTimeout(() => setFocusNodeId(null), 3000);
          }
        }}
      />

      {/* SideRail 已由根 layout 统一提供 */}

      {/* Cognition dimension growth toast */}
      {cogToast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-30 flex justify-center">
          <div className="rounded-[var(--radius-panel)] border border-[var(--border-1)] bg-[var(--bg-2)] px-5 py-3 shadow-[var(--shadow-float)] animate-slide-up">
            <p className="text-[var(--font-sm)] font-medium text-[var(--text-1)]">认知提升</p>
            <p className="text-[var(--font-xs)] text-[var(--qc-accent)] mt-0.5">{cogToast}</p>
          </div>
        </div>
      )}

      {/* Link reason popup */}
      {linkInfo && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setLinkInfo(null)} />
          <div className="relative z-10 mx-4 max-w-md rounded-[var(--radius-panel)] border border-[var(--border-1)] bg-[var(--bg-1)] p-6 shadow-[var(--shadow-modal)] animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <span className="rounded-full bg-yellow-500/20 border border-yellow-500/30 px-2.5 py-0.5 text-[11px] font-medium text-yellow-300">
                {linkInfo.kind}
              </span>
              <button onClick={() => setLinkInfo(null)} className="rounded-[var(--radius-control)] p-1.5 text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)] transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="rounded-[var(--radius-control)] bg-[var(--bg-3)] border border-[var(--border-1)] px-2.5 py-1 text-[var(--font-sm)] text-[var(--text-1)] font-medium">
                {linkInfo.sourceLabel}
              </span>
              <svg className="h-4 w-4 text-[var(--text-3)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <span className="rounded-[var(--radius-control)] bg-[var(--bg-3)] border border-[var(--border-1)] px-2.5 py-1 text-[var(--font-sm)] text-[var(--text-1)] font-medium">
                {linkInfo.targetLabel}
              </span>
            </div>
            <p className="text-[var(--font-sm)] text-[var(--text-2)] leading-relaxed">{linkInfo.reason}</p>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedNode && (
        <div className="absolute inset-0 z-20">
          <div className="absolute inset-0" onClick={() => setSelectedNode(null)} />
          <NodeDetailPanel
            node={selectedNode}
            subject={subjectById.get(selectedNode.subjectId)}
            status={selectedStatus}
            prerequisites={prerequisites}
            learningPath={learningPath}
            planTasks={selectedPlanTasks}
            deepLoading={deepLoadingId === selectedNode.id}
            childCount={deepNodes.filter((n) => n.parentId === selectedNode.id).length}
            onClose={() => setSelectedNode(null)}
            onToggleLearned={handleToggleLearned}
          />
        </div>
      )}

      {/* Welcome overlay: first entry without a plan */}
      {showWelcome && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowWelcome(false)} />
          <div className="relative w-full max-w-lg mx-4 rounded-[var(--radius-panel)] border border-[var(--border-1)] bg-[var(--bg-1)] p-8 shadow-[var(--shadow-modal)]">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-[var(--radius-panel)] border border-[var(--qc-accent)]/30 bg-[var(--qc-accent-muted)] text-[var(--qc-accent)] text-lg font-bold mb-4">
                ✦
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-1)]">欢迎来到知识宇宙</h2>
              <p className="mt-2 text-[var(--font-sm)] text-[var(--text-3)]">告诉我你想学什么，我帮你创建专属学习路线</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!welcomeInput.trim()) return;
                router.push(`/onboarding?q=${encodeURIComponent(welcomeInput.trim())}`);
              }}
              className="space-y-4"
            >
              <input
                type="text"
                value={welcomeInput}
                onChange={(e) => setWelcomeInput(e.target.value)}
                placeholder="比如：我想系统学习机器学习…"
                className="w-full rounded-[var(--radius-control)] border border-[var(--border-1)] bg-[var(--bg-3)] px-5 py-4 text-[var(--font-sm)] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--qc-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--qc-accent-muted)] transition-all"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowWelcome(false)}
                  className="flex-1 rounded-[var(--radius-control)] border border-[var(--border-1)] px-5 py-3 text-[var(--font-sm)] text-[var(--text-3)] hover:bg-[var(--bg-2)] transition-colors"
                >
                  先自由探索
                </button>
                <button
                  type="submit"
                  disabled={!welcomeInput.trim()}
                  className="flex-1 rounded-[var(--radius-control)] bg-[var(--qc-accent)] px-5 py-3 text-[var(--font-sm)] font-medium text-white hover:bg-[var(--qc-accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  开始规划
                </button>
              </div>
            </form>

            {plan && (
              <button
                onClick={() => { setShowWelcome(false); setRouteBarOpen(true); }}
                className="mt-4 w-full rounded-[var(--radius-control)] border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-left hover:bg-amber-500/10 transition-colors"
              >
                <p className="text-[var(--font-xs)] text-amber-300/70">继续已有计划</p>
                <p className="text-[var(--font-sm)] text-[var(--text-1)] font-medium truncate">{plan.title}</p>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ RouteBar: plan constellation with deep-node expansion ═══
function RouteBar({
  plan, routeNodes, learned, currentTaskNodeId, routeBarOpen, setRouteBarOpen,
  focusedSubjectId, setFocusedSubjectId, setDrillNodeId, setFocusNodeId, router,
}: {
  plan: GeneratedPlan;
  routeNodes: KnowledgeNode[];
  learned: Set<string>;
  currentTaskNodeId: string | null;
  routeBarOpen: boolean;
  setRouteBarOpen: (v: boolean) => void;
  focusedSubjectId: string | null;
  setFocusedSubjectId: (id: string | null) => void;
  setDrillNodeId: (id: string | null) => void;
  setFocusNodeId: (id: string | null) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [deepChildren, setDeepChildren] = useState<KnowledgeNode[]>([]);
  const [deepLoading, setDeepLoading] = useState(false);

  const handleNodeClick = useCallback(async (n: KnowledgeNode) => {
    if (expandedNodeId === n.id) {
      setExpandedNodeId(null);
      setDeepChildren([]);
      return;
    }

    // Focus on map
    if (focusedSubjectId && focusedSubjectId !== n.subjectId) {
      setFocusedSubjectId(n.subjectId);
      setDrillNodeId(n.parentId ?? null);
      setTimeout(() => { setFocusNodeId(n.id); setTimeout(() => setFocusNodeId(null), 3000); }, 600);
    } else {
      setDrillNodeId(n.parentId ?? null);
      setFocusNodeId(n.id);
      setTimeout(() => setFocusNodeId(null), 3000);
    }

    // Load deep children if available
    if (n.hasChildren) {
      setExpandedNodeId(n.id);
      setDeepLoading(true);
      try {
        const data = await loadDeepNodes(n.id);
        if (data) setDeepChildren(data.nodes);
        else setDeepChildren([]);
      } catch { setDeepChildren([]); }
      setDeepLoading(false);
    } else {
      setExpandedNodeId(null);
      setDeepChildren([]);
    }
  }, [expandedNodeId, focusedSubjectId, setFocusedSubjectId, setDrillNodeId, setFocusNodeId]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[60px] z-10 flex justify-center px-6 md:pl-[calc(var(--siderail-width)+24px)] transition-[padding] duration-[var(--dur-base)] ease-[var(--ease)]">
      <div className="pointer-events-auto max-w-2xl rounded-[var(--radius-panel)] bg-[var(--bg-1)]/70 backdrop-blur-xl overflow-hidden">
        <button
          onClick={() => setRouteBarOpen(!routeBarOpen)}
          className="flex w-full items-center gap-2 px-3.5 py-2 hover:bg-white/[0.04] transition-colors"
        >
          <span className="h-[5px] w-[5px] rounded-full bg-amber-400/80" />
          <span className="text-[var(--font-sm)] text-[var(--text-2)] font-medium truncate max-w-[220px]">{plan.title}</span>
          <span className="text-[var(--font-xs)] text-[var(--text-3)] tabular-nums shrink-0">
            {routeNodes.filter((n) => learned.has(n.id)).length}/{routeNodes.length}
          </span>
          <svg
            className={`h-2.5 w-2.5 text-[var(--text-3)] shrink-0 transition-transform ${routeBarOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {routeBarOpen && (
          <div className="px-3.5 pb-3">
            <div className="flex flex-wrap gap-1.5">
              {routeNodes.map((n, i) => {
                const lit = learned.has(n.id);
                const isCurrent = n.id === currentTaskNodeId;
                const isExpanded = expandedNodeId === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNodeClick(n)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                      isExpanded
                        ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/30"
                        : isCurrent
                          ? "bg-amber-400/15 text-amber-200"
                          : lit
                            ? "bg-[var(--qc-success)]/10 text-[var(--qc-success)] hover:bg-[var(--qc-success)]/20"
                            : "bg-white/[0.05] text-[var(--text-3)] hover:bg-white/[0.09] hover:text-[var(--text-1)]"
                    }`}
                    title={n.hasChildren ? "点击展开子节点" : isCurrent ? "当前任务节点" : lit ? "已点亮" : "待点亮"}
                  >
                    <span className="text-[9px] opacity-60 tabular-nums">{i + 1}</span>
                    {n.name}
                    {lit && <span>✓</span>}
                    {n.hasChildren && <span className="text-[8px] opacity-40">▸</span>}
                  </button>
                );
              })}
            </div>

            {/* Deep children expansion */}
            {expandedNodeId && (
              <div className="mt-2 pt-2 border-t border-white/[0.06]">
                {deepLoading ? (
                  <div className="flex items-center gap-2 px-1 py-1">
                    <div className="h-3 w-3 animate-spin rounded-full border border-cyan-400/20 border-t-cyan-400/80" />
                    <span className="text-[10px] text-[var(--text-3)]">加载子节点...</span>
                  </div>
                ) : deepChildren.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {deepChildren.map((child) => {
                      const childLit = learned.has(child.id);
                      return (
                        <button
                          key={child.id}
                          onClick={() => router.push(`/universe/learn?node=${encodeURIComponent(child.id)}&from=${encodeURIComponent("/universe")}`)}
                          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                            childLit
                              ? "bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                              : "bg-white/[0.03] text-[var(--text-3)] hover:bg-white/[0.07] hover:text-[var(--text-2)]"
                          }`}
                        >
                          <span className="text-[8px] opacity-40">└</span>
                          {child.name}
                          {childLit && <span className="text-[8px]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-[var(--text-3)] px-1 py-1">暂无子节点</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
