"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MiniMapNode } from "./KnowledgeUniverse";

type Props = {
  nodes: MiniMapNode[];
  cameraPos?: { x: number; y: number; z: number } | null;
  focusedSubjectId?: string | null;
  onNavigate?: (x: number, z: number) => void;
};

const SIZE = 160;
const PAD = 18;

type Projection = {
  mapX: (x: number) => number;
  mapZ: (z: number) => number;
  unmapX: (px: number) => number;
  unmapZ: (pz: number) => number;
};

function computeProjection(nodes: MiniMapNode[]): Projection | null {
  const valid = nodes.filter((n) => n.x != null && n.z != null);
  if (valid.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const n of valid) {
    if (n.x! < minX) minX = n.x!;
    if (n.x! > maxX) maxX = n.x!;
    if (n.z! < minZ) minZ = n.z!;
    if (n.z! > maxZ) maxZ = n.z!;
  }
  const rangeX = (maxX - minX) || 1;
  const rangeZ = (maxZ - minZ) || 1;
  const scale = (SIZE - PAD * 2) / Math.max(rangeX, rangeZ);
  // Center the smaller axis
  const offsetX = (SIZE - PAD * 2 - rangeX * scale) / 2;
  const offsetZ = (SIZE - PAD * 2 - rangeZ * scale) / 2;
  return {
    mapX: (x) => PAD + offsetX + (x - minX) * scale,
    mapZ: (z) => PAD + offsetZ + (z - minZ) * scale,
    unmapX: (px) => (px - PAD - offsetX) / scale + minX,
    unmapZ: (pz) => (pz - PAD - offsetZ) / scale + minZ,
  };
}

export function MiniMap({ nodes, cameraPos, focusedSubjectId, onNavigate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  const projection = useMemo(() => computeProjection(nodes), [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = SIZE * 2;
    canvas.height = SIZE * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background
    ctx.fillStyle = "rgba(5,5,15,0.65)";
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 10);
    ctx.fill();

    if (!projection) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("星图加载中…", SIZE / 2, SIZE / 2);
      return;
    }

    const { mapX, mapZ } = projection;

    // Knowledge dots first (under subjects)
    for (const n of nodes) {
      if (n.kind !== "knowledge" || n.x == null || n.z == null) continue;
      const px = mapX(n.x);
      const pz = mapZ(n.z);
      ctx.beginPath();
      ctx.arc(px, pz, n.status === "learned" ? 2 : 1.3, 0, Math.PI * 2);
      ctx.fillStyle = n.status === "learned" ? n.color : `${n.color}55`;
      ctx.fill();
    }

    // Subject dots with first character
    for (const n of nodes) {
      if (n.kind !== "subject" || n.x == null || n.z == null) continue;
      const px = mapX(n.x);
      const pz = mapZ(n.z);
      const isFocused = n.id === focusedSubjectId;

      if (isFocused) {
        ctx.beginPath();
        ctx.arc(px, pz, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(px, pz, 6, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 7px 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label.charAt(0), px, pz + 0.5);
    }

    // Camera indicator
    if (cameraPos) {
      const cx = mapX(cameraPos.x);
      const cz = mapZ(cameraPos.z);
      ctx.beginPath();
      ctx.arc(cx, cz, 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cz, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
    }
  }, [nodes, cameraPos, focusedSubjectId, projection]);

  const eventToMapXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      px: ((e.clientX - rect.left) / rect.width) * SIZE,
      pz: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNavigate || !projection) return;
    const pt = eventToMapXY(e);
    if (!pt) return;
    onNavigate(projection.unmapX(pt.px), projection.unmapZ(pt.pz));
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!projection) return;
    const pt = eventToMapXY(e);
    if (!pt) return;
    let found: string | null = null;
    for (const n of nodes) {
      if (n.kind !== "subject" || n.x == null || n.z == null) continue;
      const dx = projection.mapX(n.x) - pt.px;
      const dz = projection.mapZ(n.z) - pt.pz;
      if (dx * dx + dz * dz < 64) {
        found = n.label;
        break;
      }
    }
    setHoverLabel(found);
  };

  return (
    <div className="relative">
      <p className="absolute left-2.5 top-2 z-10 text-[9px] text-white/40 font-medium pointer-events-none">星图</p>
      {hoverLabel && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-10 rounded-md bg-black/80 px-2 py-0.5 text-[10px] text-white whitespace-nowrap pointer-events-none">
          {hoverLabel}
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={SIZE * 2}
        height={SIZE * 2}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverLabel(null)}
        className="w-[160px] h-[160px] rounded-[var(--radius-panel)] cursor-crosshair backdrop-blur-sm"
        style={{ imageRendering: "auto" }}
      />
    </div>
  );
}
