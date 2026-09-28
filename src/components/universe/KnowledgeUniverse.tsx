"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  KnowledgeGraph,
  KnowledgeNode,
  NodeStatus,
  SubjectNode,
} from "@/lib/universe/types";
import { cycleDef, type MasteryLevel } from "@/lib/learn/cycles";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative flex flex-col items-center gap-3">
        <div className="h-16 w-16 rounded-full border-2 border-white/10 animate-[pulse-ring_2s_ease-out_infinite]" />
        <div className="absolute h-8 w-8 top-4 left-4 rounded-full bg-indigo-500/30 animate-[pulse-ring_2s_ease-out_0.5s_infinite]" />
        <p className="text-white/40 text-xs mt-2">正在编织知识星图…</p>
      </div>
    </div>
  ),
});

export type GraphNodeKind = "subject" | "knowledge";

export type UniverseNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  color: string;
  status?: NodeStatus;
  /** 多周目掌握度 0-4（learned 节点缺省 1） */
  mastery?: MasteryLevel;
  data?: KnowledgeNode;
  subjectData?: SubjectNode;
  x?: number;
  y?: number;
  z?: number;
  __threeObj?: unknown;
};

type UniverseLink = {
  /** route 链路专用：第几段（0 起） */
  routeIndex?: number;
  source: string;
  target: string;
  kind: "membership" | "prerequisite" | "related" | "cross" | "route" | "subject_rel";
  reason?: string;
};

export type ClickedLink = {
  sourceLabel: string;
  targetLabel: string;
  reason: string;
  kind: string;
};

export type MiniMapNode = {
  id: string;
  label: string;
  x?: number;
  y?: number;
  z?: number;
  color: string;
  kind: "subject" | "knowledge";
  status?: NodeStatus;
};

type Props = {
  graph: KnowledgeGraph;
  statuses: Map<string, NodeStatus>;
  /** 多周目掌握度：决定已学节点的亮度/光晕/脉冲（缺省：learned = 1） */
  masteryLevels?: Map<string, MasteryLevel>;
  expandedSubjects: Set<string>;
  /** 总览模式下额外保持可见的节点（计划路线/已点亮/当前任务），绕过 expandedSubjects 过滤 */
  alwaysVisibleIds?: Set<string>;
  selectedNodeId: string | null;
  highlightSubjectId: string | null;
  recommendedNodeIds?: Set<string>;
  celebrateNodeId?: string | null;
  onSubjectToggle: (subjectId: string) => void;
  onKnowledgeSelect: (node: KnowledgeNode) => void;
  onLinkClick?: (link: ClickedLink) => void;
  onNodeHover?: (node: KnowledgeNode | SubjectNode | null) => void;
  onBackgroundClick?: () => void;
  focusNodeId?: string | null;
  pathNodeIds?: string[];
  /** 当前学习计划覆盖的节点 id（按任务顺序），渲染为金色"计划星座" */
  planRouteIds?: string[];
  /** 当前任务锚定的节点，专属强脉冲标记 */
  currentTaskNodeId?: string | null;
  /** 认知层模式：已学节点按认知贡献渲染，学科带认知光环 */
  cognitionMode?: boolean;
  cognitionData?: {
    nodeValue: Map<string, number>;
    nodeDimColor: Map<string, string>;
    subjectValue: Map<string, number>;
  };
  onPositionsUpdate?: (nodes: MiniMapNode[], cameraPos: { x: number; y: number; z: number } | null) => void;
  flyToTarget?: { x: number; z: number; ts: number } | null;
};

let _THREE: typeof import("three") | null = null;
function getTHREE() {
  if (!_THREE) _THREE = require("three");
  return _THREE!;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function KnowledgeUniverse({
  graph,
  statuses,
  masteryLevels,
  expandedSubjects,
  alwaysVisibleIds,
  selectedNodeId,
  highlightSubjectId,
  recommendedNodeIds,
  celebrateNodeId,
  onSubjectToggle,
  onKnowledgeSelect,
  onLinkClick,
  onNodeHover,
  onBackgroundClick,
  focusNodeId,
  pathNodeIds,
  planRouteIds,
  currentTaskNodeId,
  cognitionMode,
  cognitionData,
  onPositionsUpdate,
  flyToTarget,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<{
    zoomToFit?: (ms?: number, px?: number) => void;
    cameraPosition?: (pos: { x: number; y: number; z: number }, lookAt?: { x: number; y: number; z: number }, ms?: number) => void;
    scene?: () => { traverse?: (cb: (obj: unknown) => void) => void; add?: (obj: unknown) => void; remove?: (obj: unknown) => void };
    camera?: () => { position?: { x: number; y: number; z: number } };
    d3Force?: (name: string, force?: unknown) => unknown;
  } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const textureCacheRef = useRef<Map<string, unknown>>(new Map());
  const celebrationRef = useRef<{ particles: unknown; ring: unknown; startTime: number } | null>(null);

  // Dynamic highlight state lives in refs so the engine tick can read it
  // without forcing a rebuild of any 3D object.
  const activeNodeIdRef = useRef<string | null>(null);
  const activeNeighborIdsRef = useRef<Set<string>>(new Set());
  const highlightSubjectIdRef = useRef<string | null>(null);
  const focusNodeIdRef = useRef<string | null>(null);
  const recommendedIdsRef = useRef<Set<string>>(new Set());
  const pathNodeIdsRef = useRef<Set<string>>(new Set());
  const planRouteIdsRef = useRef<Set<string>>(new Set());
  const currentTaskNodeIdRef = useRef<string | null>(null);
  const cognitionModeRef = useRef(false);
  const cognitionDataRef = useRef<Props["cognitionData"]>(undefined);

  // Idle tracking for ambient auto-orbit
  const lastInteractionRef = useRef(Date.now());

  // Registry of geometries/materials per node for proper disposal
  const nodeResourcesRef = useRef<Map<string, { geos: { dispose(): void }[]; mats: { dispose(): void }[] }>>(new Map());
  const disposeNodeResources = useCallback((nodeId: string) => {
    const res = nodeResourcesRef.current.get(nodeId);
    if (!res) return;
    for (const g of res.geos) g.dispose();
    for (const m of res.mats) m.dispose();
    nodeResourcesRef.current.delete(nodeId);
  }, []);

  // Dispose everything on unmount
  useEffect(() => {
    const resources = nodeResourcesRef.current;
    const textures = textureCacheRef.current;
    return () => {
      for (const res of resources.values()) {
        for (const g of res.geos) g.dispose();
        for (const m of res.mats) m.dispose();
      }
      resources.clear();
      for (const tex of textures.values()) {
        (tex as { dispose?: () => void })?.dispose?.();
      }
      textures.clear();
    };
  }, []);

  // Subject phase map for breath sync
  const subjectPhaseMap = useMemo(() => {
    const m = new Map<string, number>();
    graph.subjects.forEach((s, i) => m.set(s.id, (i * Math.PI * 2) / graph.subjects.length));
    return m;
  }, [graph.subjects]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const subjectById = useMemo(() => {
    const m = new Map<string, SubjectNode>();
    for (const s of graph.subjects) m.set(s.id, s);
    return m;
  }, [graph.subjects]);

  // Cumulative node instance cache: reusing the same object instances keeps
  // d3 positions and the cached three objects, so view switches don't explode.
  const nodeInstancesRef = useRef<Map<string, UniverseNode>>(new Map());

  const graphData = useMemo(() => {
    const instances = nodeInstancesRef.current;
    const materialize = (fresh: UniverseNode): UniverseNode => {
      const old = instances.get(fresh.id);
      if (old && old.kind === fresh.kind && old.status === fresh.status && old.label === fresh.label && old.color === fresh.color && (old.mastery ?? 0) === (fresh.mastery ?? 0)) {
        old.data = fresh.data;
        old.subjectData = fresh.subjectData;
        return old;
      }
      if (old) {
        // Visual identity changed: rebuild three object but keep position
        fresh.x = old.x;
        fresh.y = old.y;
        fresh.z = old.z;
      }
      instances.set(fresh.id, fresh);
      return fresh;
    };

    const nodes: UniverseNode[] = [];
    const links: UniverseLink[] = [];

    for (const subject of graph.subjects) {
      nodes.push(materialize({
        id: subject.id,
        kind: "subject",
        label: subject.name,
        color: subject.color,
        subjectData: subject,
      }));
    }

    const visibleKnowledge = new Set<string>();
    for (const node of graph.nodes) {
      if (!expandedSubjects.has(node.subjectId) && !alwaysVisibleIds?.has(node.id)) continue;
      const subject = subjectById.get(node.subjectId);
      const st = statuses.get(node.id) || "locked";
      nodes.push(materialize({
        id: node.id,
        kind: "knowledge",
        label: node.name,
        color: subject?.color || "#a8a29e",
        status: st,
        mastery: st === "learned" ? Math.max(1, masteryLevels?.get(node.id) || 0) as MasteryLevel : 0,
        data: node,
        subjectData: subject,
      }));
      visibleKnowledge.add(node.id);
      links.push({ source: node.subjectId, target: node.id, kind: "membership" });
    }

    for (const edge of graph.edges) {
      if (visibleKnowledge.has(edge.source) && visibleKnowledge.has(edge.target)) {
        const kind = edge.type === "cross" ? "cross" : edge.type === "prerequisite" ? "prerequisite" : "related";
        links.push({ source: edge.source, target: edge.target, kind, reason: edge.reason });
      }
    }

    // 学科级关联：学科星之间的关联线（带专业依据，可点击查看）
    const subjectIdSet = new Set(graph.subjects.map((s) => s.id));
    for (const se of graph.subjectEdges || []) {
      if (subjectIdSet.has(se.source) && subjectIdSet.has(se.target)) {
        links.push({ source: se.source, target: se.target, kind: "subject_rel", reason: se.reason });
      }
    }

    // 计划学习路线：按任务顺序合成有向 route 链路（不依赖图谱已有边，保证链路不断）
    if (planRouteIds && planRouteIds.length > 1) {
      const visibleRoute = planRouteIds.filter((id) => visibleKnowledge.has(id));
      const labelOf = (id: string) => nodes.find((n) => n.id === id)?.label || id;
      for (let i = 0; i < visibleRoute.length - 1; i++) {
        links.push({
          source: visibleRoute[i],
          target: visibleRoute[i + 1],
          kind: "route",
          routeIndex: i,
          reason: `当前计划的学习路线第 ${i + 1} 段：完成「${labelOf(visibleRoute[i])}」后，下一站是「${labelOf(visibleRoute[i + 1])}」。`,
        });
      }
    }

    return { nodes, links };
  }, [graph, expandedSubjects, alwaysVisibleIds, statuses, masteryLevels, subjectById, planRouteIds]);

  // Neighbor map for hover highlight
  const neighborMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const link of graphData.links) {
      const s = typeof link.source === "string" ? link.source : (link.source as unknown as { id: string }).id;
      const t = typeof link.target === "string" ? link.target : (link.target as unknown as { id: string }).id;
      if (!m.has(s)) m.set(s, new Set());
      if (!m.has(t)) m.set(t, new Set());
      m.get(s)!.add(t);
      m.get(t)!.add(s);
    }
    return m;
  }, [graphData.links]);

  // Active highlight: hover takes priority, otherwise the clicked (selected) node
  const activeNodeId = hoveredNodeId ?? selectedNodeId ?? null;
  const activeNeighborIds = useMemo<Set<string>>(
    () => (activeNodeId ? neighborMap.get(activeNodeId) || new Set() : new Set()),
    [activeNodeId, neighborMap]
  );

  // Learning path: consecutive node pairs form glowing edges
  const pathEdgeKeys = useMemo(() => {
    const keys = new Set<string>();
    if (pathNodeIds && pathNodeIds.length > 1) {
      for (let i = 0; i < pathNodeIds.length - 1; i++) {
        keys.add(`${pathNodeIds[i]}->${pathNodeIds[i + 1]}`);
        keys.add(`${pathNodeIds[i + 1]}->${pathNodeIds[i]}`);
      }
    }
    return keys;
  }, [pathNodeIds]);

  // Plan constellation: edges between plan-covered nodes glow gold
  const planEdgeKeys = useMemo(() => {
    const keys = new Set<string>();
    if (planRouteIds && planRouteIds.length > 1) {
      const inPlan = new Set(planRouteIds);
      for (const link of graphData.links) {
        const s = typeof link.source === "string" ? link.source : (link.source as unknown as { id: string }).id;
        const t = typeof link.target === "string" ? link.target : (link.target as unknown as { id: string }).id;
        if (link.kind !== "membership" && inPlan.has(s) && inPlan.has(t)) {
          keys.add(`${s}->${t}`);
          keys.add(`${t}->${s}`);
        }
      }
    }
    return keys;
  }, [planRouteIds, graphData.links]);

  // Sync dynamic state into refs for the engine tick
  useEffect(() => {
    activeNodeIdRef.current = activeNodeId;
    activeNeighborIdsRef.current = activeNeighborIds;
  }, [activeNodeId, activeNeighborIds]);
  useEffect(() => {
    highlightSubjectIdRef.current = highlightSubjectId;
  }, [highlightSubjectId]);
  useEffect(() => {
    focusNodeIdRef.current = focusNodeId ?? null;
  }, [focusNodeId]);
  useEffect(() => {
    recommendedIdsRef.current = recommendedNodeIds ?? new Set();
  }, [recommendedNodeIds]);
  useEffect(() => {
    pathNodeIdsRef.current = new Set(pathNodeIds ?? []);
  }, [pathNodeIds]);
  useEffect(() => {
    planRouteIdsRef.current = new Set(planRouteIds ?? []);
  }, [planRouteIds]);
  useEffect(() => {
    currentTaskNodeIdRef.current = currentTaskNodeId ?? null;
  }, [currentTaskNodeId]);
  useEffect(() => {
    cognitionModeRef.current = !!cognitionMode;
    cognitionDataRef.current = cognitionData;
  }, [cognitionMode, cognitionData]);

  // Add lights
  const lightsAddedRef = useRef(false);
  useEffect(() => {
    if (lightsAddedRef.current || !size.width) return;
    const fg = fgRef.current;
    if (!fg?.scene) return;
    const THREE = getTHREE();
    const scene = fg.scene();
    if (!scene?.add) return;
    scene.add(new THREE.AmbientLight(0xffffff, 0.7) as never);
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.5);
    dir1.position.set(100, 200, 150);
    scene.add(dir1 as never);
    const dir2 = new THREE.DirectionalLight(0x8888ff, 0.2);
    dir2.position.set(-100, -50, -100);
    scene.add(dir2 as never);
    lightsAddedRef.current = true;
  }, [size.width, graphData.nodes.length]);

  // Initial zoom
  useEffect(() => {
    const t = setTimeout(() => fgRef.current?.zoomToFit?.(800, 100), 1200);
    return () => clearTimeout(t);
  }, [graphData.nodes.length]);

  // 力学调参：
  // - route 链路是纯视觉叠加：strength 0，不把途经的星拉到一起
  // - subject_rel 学科关联：适度引力把相关学科星系拉近
  // - charge.distanceMax 限制长程斥力，星系之间不再被推得太远
  const origLinkStrengthRef = useRef<((l: UniverseLink, i: number, links: UniverseLink[]) => number) | null>(null);
  useEffect(() => {
    const fg = fgRef.current;
    const lf = fg?.d3Force?.("link") as
      | { strength: (fn?: unknown) => unknown; distance?: (fn?: unknown) => unknown }
      | undefined;
    if (!lf?.strength) return;
    if (!origLinkStrengthRef.current) {
      origLinkStrengthRef.current = lf.strength() as (l: UniverseLink, i: number, links: UniverseLink[]) => number;
    }
    const orig = origLinkStrengthRef.current;
    lf.strength((l: UniverseLink, i: number, links: UniverseLink[]) => {
      if (l.kind === "route") return 0;
      if (l.kind === "subject_rel") return 0.12;
      return orig(l, i, links);
    });
    lf.distance?.((l: UniverseLink) => {
      if (l.kind === "subject_rel") return 110;
      if (l.kind === "membership") return 26;
      if (l.kind === "cross") return 70;
      return 32;
    });
    const charge = fg?.d3Force?.("charge") as
      | { strength?: (fn?: unknown) => unknown; distanceMax?: (v?: number) => unknown }
      | undefined;
    if (charge) {
      charge.strength?.((n: UniverseNode) => (n.kind === "subject" ? -140 : -26));
      // 关键：限制斥力作用范围，星系间距离明显收紧
      charge.distanceMax?.(320);
    }
  }, [graphData]);

  // Ambient auto-orbit: after 30s without interaction, slowly circle the camera
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let rafId = 0;
    const markInteraction = () => {
      lastInteractionRef.current = Date.now();
    };
    el.addEventListener("pointerdown", markInteraction);
    el.addEventListener("wheel", markInteraction, { passive: true });
    const orbit = () => {
      rafId = requestAnimationFrame(orbit);
      if (Date.now() - lastInteractionRef.current < 30000) return;
      const fg = fgRef.current;
      const cam = fg?.camera?.();
      if (!fg?.cameraPosition || !cam?.position) return;
      const { x, y, z } = cam.position;
      const a = 0.0012;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      fg.cameraPosition({ x: x * cos - z * sin, y, z: x * sin + z * cos }, { x: 0, y: 0, z: 0 }, 0);
    };
    rafId = requestAnimationFrame(orbit);
    return () => {
      el.removeEventListener("pointerdown", markInteraction);
      el.removeEventListener("wheel", markInteraction);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Focus node
  useEffect(() => {
    if (!focusNodeId) return;
    lastInteractionRef.current = Date.now();
    if (focusNodeId === "__reset__") {
      fgRef.current?.zoomToFit?.(800, 100);
      return;
    }
    if (!fgRef.current?.cameraPosition) return;
    const node = graphData.nodes.find((n) => n.id === focusNodeId);
    if (!node || node.x == null || node.y == null || node.z == null) {
      fgRef.current?.zoomToFit?.(800, 100);
      return;
    }
    const isSubjectFocus = node.kind === "subject";
    const distance = isSubjectFocus ? 200 : 80;
    const pos = { x: node.x + distance, y: node.y + distance * 0.4, z: node.z + distance };
    fgRef.current.cameraPosition(pos, { x: node.x, y: node.y, z: node.z }, 1200);
  }, [focusNodeId, graphData.nodes]);

  // MiniMap navigation: fly camera to a world position
  useEffect(() => {
    if (!flyToTarget || !fgRef.current?.cameraPosition) return;
    lastInteractionRef.current = Date.now();
    const { x, z } = flyToTarget;
    fgRef.current.cameraPosition(
      { x: x + 60, y: 80, z: z + 60 },
      { x, y: 0, z },
      1000
    );
  }, [flyToTarget]);

  // Celebration effect
  useEffect(() => {
    if (!celebrateNodeId) return;
    const node = graphData.nodes.find((n) => n.id === celebrateNodeId);
    if (!node || node.x == null || node.y == null || node.z == null) return;
    const fg = fgRef.current;
    if (!fg?.scene) return;
    const THREE = getTHREE();
    const scene = fg.scene();
    if (!scene?.add || !scene?.remove) return;

    const count = 40;
    const positions = new Float32Array(count * 3);
    const velocities: number[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = node.x;
      positions[i * 3 + 1] = node.y;
      positions[i * 3 + 2] = node.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 0.5 + Math.random() * 1.5;
      velocities.push(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: node.color,
      size: 2,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    (points as unknown as { userData: Record<string, unknown> }).userData = { isCelebration: true, velocities, startTime: Date.now() };
    scene.add(points as never);

    // Ring
    const ringGeo = new THREE.RingGeometry(0.5, 1.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(node.x, node.y, node.z);
    (ring as unknown as { userData: Record<string, unknown> }).userData = { isCelebrationRing: true, startTime: Date.now() };
    scene.add(ring as never);

    celebrationRef.current = { particles: points, ring, startTime: Date.now() };
  }, [celebrateNodeId, graphData.nodes]);

  // Texture cache
  const getOrCreateTexture = useCallback((key: string, creator: () => unknown) => {
    const cache = textureCacheRef.current;
    if (cache.has(key)) return cache.get(key);
    const tex = creator();
    cache.set(key, tex);
    return tex;
  }, []);

  // Node objects are created ONCE per node (and only rebuilt when the node's
  // visual identity changes, e.g. status). All hover/selection/highlight
  // effects are applied in onEngineTick by mutating existing materials.
  const nodeThreeObject = useCallback(
    (node: UniverseNode) => {
      const THREE = getTHREE();
      const isSubject = node.kind === "subject";
      const status = node.status || "available";

      disposeNodeResources(node.id);
      const geos: { dispose(): void }[] = [];
      const mats: { dispose(): void }[] = [];

      const group = new THREE.Group();
      const subjectId = isSubject ? node.id : node.subjectData?.id || "";
      group.userData = {
        nodeId: node.id,
        kind: node.kind,
        status,
        subjectId,
        subjectPhase: subjectPhaseMap.get(subjectId) || 0,
      };

      const sz = isSubject ? 5.5 : 3.6;

      if (isSubject) {
        // 星系核：太阳质感的发光核心
        const coreGeo = new THREE.SphereGeometry(sz * 0.85, 24, 24);
        const coreMat = new THREE.MeshPhongMaterial({
          color: node.color,
          emissive: node.color,
          emissiveIntensity: 1.3,
          transparent: true,
          opacity: 1,
          shininess: 120,
        });
        geos.push(coreGeo); mats.push(coreMat);
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.userData.isCoreNode = true;
        group.add(core);

        // 日冕：径向渐变 Sprite（按颜色缓存纹理），加色混合呈恒星辉光
        const coronaTex = getOrCreateTexture(`corona_${node.color}`, () => {
          const canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext("2d")!;
          const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
          grad.addColorStop(0, "rgba(255,255,255,0.85)");
          grad.addColorStop(0.22, hexToRgba(node.color, 0.6));
          grad.addColorStop(0.55, hexToRgba(node.color, 0.18));
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 128, 128);
          return new THREE.CanvasTexture(canvas);
        });
        const coronaMat = new THREE.SpriteMaterial({
          map: coronaTex as InstanceType<typeof THREE.CanvasTexture>,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        mats.push(coronaMat);
        const corona = new THREE.Sprite(coronaMat);
        corona.scale.set(sz * 4.4, sz * 4.4, 1);
        corona.userData.isCorona = true;
        group.add(corona);

        // 环绕粒子环带：扁平圆环区内密外疏分布，确定性随机倾角
        const phase = subjectPhaseMap.get(node.id) || 0;
        let seed = Math.floor(phase * 1000) + 17;
        const rand = () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };
        const COUNT = 110;
        const positions = new Float32Array(COUNT * 3);
        for (let i = 0; i < COUNT; i++) {
          const radius = sz * 1.6 + sz * 1.2 * Math.pow(rand(), 1.6);
          const ang = rand() * Math.PI * 2;
          positions[i * 3] = Math.cos(ang) * radius;
          positions[i * 3 + 1] = (rand() - 0.5) * sz * 0.5;
          positions[i * 3 + 2] = Math.sin(ang) * radius;
        }
        const ringGeo = new THREE.BufferGeometry();
        ringGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const ringMat = new THREE.PointsMaterial({
          color: node.color,
          size: 1.15,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        });
        geos.push(ringGeo); mats.push(ringMat);
        const ring = new THREE.Points(ringGeo, ringMat);
        // 倾角：每颗学科星姿态各异（由 phase 派生，确定性）
        ring.rotation.x = 0.7 + Math.sin(phase) * 0.45;
        ring.rotation.z = Math.cos(phase * 1.7) * 0.35;
        ring.userData.isRing = true;
        // 粒子不参与射线检测，点击始终命中核心球
        ring.raycast = () => {};
        group.add(ring);

        const glowGeo = new THREE.SphereGeometry(sz * 3, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.1, side: THREE.BackSide });
        geos.push(glowGeo); mats.push(glowMat);
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.userData.isGlow = true;
        glow.userData.glowBase = 0.1;
        group.add(glow);
      } else {
        if (status === "locked") {
          const geo = new THREE.OctahedronGeometry(sz, 0);
          const mat = new THREE.MeshBasicMaterial({
            color: node.color,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
          });
          geos.push(geo); mats.push(mat);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.userData.isCoreNode = true;
          mesh.userData.baseColor = node.color;
          group.add(mesh);
        } else {
          const learned = status === "learned";
          // 多周目：已学节点按掌握度分级发光（1 初见微亮 → 2 精读明亮 → 3 贯通脉冲 → 4 守护金晕）
          const level = learned ? Math.max(1, node.mastery || 1) : 0;
          const vis = learned ? cycleDef(level).visual : null;
          const baseEmissive = vis ? vis.emissive : 0.6;
          const geo = new THREE.SphereGeometry(sz * (level >= 3 ? 1.12 : 1), learned ? 24 : 20, learned ? 24 : 20);
          const mat = new THREE.MeshPhongMaterial({
            color: node.color,
            emissive: node.color,
            emissiveIntensity: baseEmissive,
            transparent: true,
            opacity: 1,
            shininess: 100,
          });
          geos.push(geo); mats.push(mat);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.userData.isCoreNode = true;
          mesh.userData.baseEmissive = baseEmissive;
          mesh.userData.baseColor = node.color;
          mesh.userData.masteryLevel = level;
          group.add(mesh);

          if (learned && vis) {
            const glowGeo = new THREE.SphereGeometry(sz * (2.2 + level * 0.25), 16, 16);
            // 守护周目（4）带金色外晕，其余沿用学科色
            const glowColor = level >= 4 ? vis.tint : node.color;
            const glowMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: vis.glow, side: THREE.BackSide });
            geos.push(glowGeo); mats.push(glowMat);
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.userData.isGlow = true;
            glow.userData.glowBase = vis.glow;
            glow.userData.baseColor = glowColor;
            glow.userData.masteryPulse = vis.pulse;
            group.add(glow);

            // 第 3 周目起：细环，一眼区分"会用"与"贯通"
            if (level >= 3) {
              const ringGeo = new THREE.RingGeometry(sz * 1.6, sz * 1.75, 40);
              const ringMat = new THREE.MeshBasicMaterial({ color: vis.tint, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
              geos.push(ringGeo); mats.push(ringMat);
              const ring = new THREE.Mesh(ringGeo, ringMat);
              ring.userData.isMasteryRing = true;
              ring.rotation.x = Math.PI / 2.6;
              group.add(ring);
            }
          }
        }

        // Recommended glow: always created, visibility toggled in tick
        const recGlowGeo = new THREE.SphereGeometry(sz * 2.5, 16, 16);
        const recGlowMat = new THREE.MeshBasicMaterial({ color: "#60a5fa", transparent: true, opacity: 0.25, side: THREE.BackSide });
        geos.push(recGlowGeo); mats.push(recGlowMat);
        const recGlow = new THREE.Mesh(recGlowGeo, recGlowMat);
        recGlow.userData.isRecommendedGlow = true;
        recGlow.visible = false;
        group.add(recGlow);

        // Path glow: cyan halo for nodes on the highlighted learning path
        const pathGlowGeo = new THREE.SphereGeometry(sz * 2.2, 16, 16);
        const pathGlowMat = new THREE.MeshBasicMaterial({ color: "#2dd4bf", transparent: true, opacity: 0.3, side: THREE.BackSide });
        geos.push(pathGlowGeo); mats.push(pathGlowMat);
        const pathGlow = new THREE.Mesh(pathGlowGeo, pathGlowMat);
        pathGlow.userData.isPathGlow = true;
        pathGlow.visible = false;
        group.add(pathGlow);

        // Plan constellation glow: gold halo for nodes covered by the current plan
        const planGlowGeo = new THREE.SphereGeometry(sz * 2.0, 16, 16);
        const planGlowMat = new THREE.MeshBasicMaterial({ color: "#fbbf24", transparent: true, opacity: 0.18, side: THREE.BackSide });
        geos.push(planGlowGeo); mats.push(planGlowMat);
        const planGlow = new THREE.Mesh(planGlowGeo, planGlowMat);
        planGlow.userData.isPlanGlow = true;
        planGlow.visible = false;
        group.add(planGlow);
      }

      // Hitbox
      const hitGeo = new THREE.SphereGeometry(isSubject ? sz * 2 : sz * 2.5, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      geos.push(hitGeo); mats.push(hitMat);
      group.add(new THREE.Mesh(hitGeo, hitMat));

      // Text label: bake ONE full-bright texture; opacity/scale driven in tick
      // 画布宽度按文字实际宽度动态扩展（上限 1280），避免长任务名被两侧裁断
      const text = node.label;
      const cacheKey = `${node.id}_${status}_${isSubject}`;
      const texture = getOrCreateTexture(cacheKey, () => {
        const fontSize = isSubject ? 68 : 48;
        const font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
        const canvas = document.createElement("canvas");
        const measureCtx = canvas.getContext("2d")!;
        measureCtx.font = font;
        const textW = measureCtx.measureText(text).width;
        const pad = 40;
        canvas.width = Math.min(1280, Math.max(512, Math.ceil(textW + pad)));
        canvas.height = 128;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // 超出上限时缩小字号以完整放下
        const fs = textW + pad > 1280 ? Math.floor((fontSize * 1280) / (textW + pad)) : fontSize;
        ctx.font = `bold ${fs}px "Microsoft YaHei", "PingFang SC", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        if (isSubject) {
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 14;
        }
        ctx.fillText(text, canvas.width / 2, 64);
        ctx.fillText(text, canvas.width / 2, 64);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
      });
      const texImage = (texture as InstanceType<typeof THREE.CanvasTexture>).image as HTMLCanvasElement | undefined;
      const texW = texImage?.width || 512;
      const texH = texImage?.height || 128;
      const widthRatio = texW / 512;

      const spriteMat = new THREE.SpriteMaterial({
        map: texture as InstanceType<typeof THREE.CanvasTexture>,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: isSubject ? 1 : (status === "locked" ? 0.45 : 0.85),
      });
      mats.push(spriteMat);
      const sprite = new THREE.Sprite(spriteMat);
      sprite.renderOrder = 999;
      const baseScale = (isSubject ? 28 : 15) * widthRatio;
      const aspect = texH / texW;
      sprite.scale.set(baseScale, baseScale * aspect, 1);
      sprite.position.set(0, -(sz + (isSubject ? 8 : 4)), 0);
      sprite.userData.isLabel = true;
      sprite.userData.baseScale = baseScale;
      sprite.userData.hlScale = (isSubject ? 36 : 26) * widthRatio;
      sprite.userData.aspect = aspect;
      group.add(sprite);

      nodeResourcesRef.current.set(node.id, { geos, mats });
      return group;
    },
    [getOrCreateTexture, disposeNodeResources, subjectPhaseMap]
  );

  // Engine tick: rotation, breathing, LOD, celebration, recommended pulse
  const onEngineTick = useCallback(() => {
    const fg = fgRef.current;
    if (!fg?.scene) return;
    const scene = fg.scene();
    if (!scene?.traverse) return;
    const t = Date.now() * 0.001;

    let camDist = 200;
    if (fg.camera) {
      const cam = fg.camera();
      if (cam?.position) {
        const { x, y, z } = cam.position;
        camDist = Math.sqrt(x * x + y * y + z * z);
      }
    }

    const activeId = activeNodeIdRef.current;
    const neighbors = activeNeighborIdsRef.current;
    const subjHL = highlightSubjectIdRef.current;
    const focusId = focusNodeIdRef.current;
    const recIds = recommendedIdsRef.current;
    const pathIds = pathNodeIdsRef.current;
    const planIds = planRouteIdsRef.current;
    const currentTaskId = currentTaskNodeIdRef.current;
    const cogMode = cognitionModeRef.current;
    const cogData = cognitionDataRef.current;
    const pulse = Math.sin(t * 2.5) * 0.5 + 0.5;

    scene.traverse((obj: unknown) => {
      const o = obj as {
        userData?: Record<string, unknown>;
        children?: unknown[];
        scale?: { set: (x: number, y: number, z: number) => void; x: number };
      };
      if (!o?.userData?.nodeId) return;

      const nodeId = o.userData.nodeId as string;
      const kind = o.userData.kind as string;
      const status = (o.userData.status as string) || "available";
      const subjectId = o.userData.subjectId as string;
      const subjectPhase = (o.userData.subjectPhase as number) || 0;

      // Per-node highlight state
      const isActive = nodeId === activeId;
      const isNeighbor = neighbors.has(nodeId);
      const dimmed = !!activeId && !isActive && !isNeighbor;
      const subjDim = subjHL ? (kind === "subject" ? nodeId !== subjHL : subjectId !== subjHL) : false;
      const isRec = recIds.has(nodeId);
      const onPath = pathIds.has(nodeId);
      const onPlan = planIds.has(nodeId);
      const isCurrentTask = nodeId === currentTaskId;
      const emphasized = isActive || isNeighbor || nodeId === focusId;

      // Cognition layer per-node state
      const cogValue = cogMode && cogData ? cogData.nodeValue.get(nodeId) : undefined;
      const cogLit = cogValue != null;
      const cogDimColor = cogMode && cogData ? cogData.nodeDimColor.get(nodeId) : undefined;

      // Subject-node breath sync
      const breathVal = kind === "subject"
        ? Math.sin(t * 0.8 + subjectPhase)
        : Math.sin(t * 0.8 + subjectPhase + 0.3);

      // Unified group scale: emphasis * breath * recommended pulse
      if (o.scale) {
        let s = emphasized ? 1.3 : 1;
        if (kind === "knowledge") s *= 1 + breathVal * 0.02;
        if (isRec) s *= 1 + pulse * 0.08;
        if (cogMode && kind === "knowledge") {
          // Cognition layer: lit nodes grow with their contribution, others shrink
          s *= cogLit ? 1 + Math.min(0.8, (cogValue || 0) * 0.06) : 0.8;
        }
        o.scale.set(s, s, s);
      }

      const children = (o as { children?: unknown[] }).children || [];
      for (const child of children) {
        const c = child as {
          userData?: Record<string, unknown>;
          material?: {
            emissiveIntensity?: number;
            opacity?: number;
            color?: { set: (v: string) => void };
            emissive?: { set: (v: string) => void };
          };
          scale?: { set: (x: number, y: number, z: number) => void };
          rotation?: { x: number; y: number; z: number };
          rotateY?: (rad: number) => void;
          visible?: boolean;
        };

        // Galaxy particle ring: spin around its own axis (preserves tilt) + dim
        if (c?.userData?.isRing) {
          const boosted = nodeId === activeId || nodeId === subjHL || nodeId === focusId;
          c.rotateY?.(boosted ? 0.008 : 0.0025);
          if (c.material) {
            const base = dimmed ? 0.15 : subjDim ? 0.25 : 0.85;
            c.material.opacity = cogMode ? 0.08 : boosted ? Math.min(1, base + 0.15) : base;
          }
        }

        // Corona sprite dim
        if (c?.userData?.isCorona && c.material) {
          const boosted = nodeId === activeId || nodeId === subjHL || nodeId === focusId;
          const base = dimmed ? 0.2 : subjDim ? 0.3 : 0.9;
          c.material.opacity = cogMode ? 0.15 : boosted ? 1 : base;
        }

        // Core pulse with subject-synced breath + dim
        if (c?.userData?.isCoreNode && c.material) {
          if (kind === "subject") {
            c.material.emissiveIntensity = 0.9 + breathVal * 0.3;
            c.material.opacity = dimmed ? 0.3 : subjDim ? 0.5 : 1;
          } else if (status === "locked") {
            c.material.opacity = dimmed ? 0.15 : subjDim ? 0.18 : 0.5;
          } else {
            const base = (c.userData.baseEmissive as number) || 0.6;
            c.material.emissiveIntensity = Math.max(0.05, base + breathVal * 0.08);
            c.material.opacity = dimmed ? 0.2 : subjDim ? 0.25 : 1;
          }

          // Cognition layer overrides: lit nodes glow in their dimension color,
          // unlearned nodes fade to faint dots.
          if (kind === "knowledge") {
            if (cogMode) {
              if (cogLit) {
                c.material.opacity = dimmed ? 0.35 : 1;
                if (c.userData.baseEmissive != null) {
                  c.material.emissiveIntensity = 1.3 + breathVal * 0.1;
                }
              } else {
                c.material.opacity = 0.1;
              }
            }
            const baseColor = c.userData.baseColor as string | undefined;
            if (baseColor && c.material.color) {
              const target = cogMode && cogLit && cogDimColor ? cogDimColor : baseColor;
              if (c.userData.appliedColor !== target) {
                c.material.color.set(target);
                c.material.emissive?.set(target);
                c.userData.appliedColor = target;
              }
            }
          }
        }

        // 多周目细环：缓慢自转，随 dim 隐去
        if (c?.userData?.isMasteryRing && c.material) {
          if (c.rotation) c.rotation.z = t * 0.35;
          c.material.opacity = (dimmed || subjDim || cogMode) ? 0 : 0.45 + breathVal * 0.15;
        }

        // Glow pulse + dim
        if (c?.userData?.isGlow && c.material) {
          const glowBase = (c.userData.glowBase as number) || 0.12;
          const mp = c.userData.masteryPulse ? pulse * 0.12 : 0;
          c.material.opacity = (dimmed || subjDim) ? 0 : Math.max(0.03, glowBase + breathVal * 0.04 + mp);

          if (cogMode) {
            if (kind === "subject") {
              // Subject cognition halo: radius grows with accumulated contribution
              const sv = cogData?.subjectValue.get(nodeId) || 0;
              const s2 = 1 + Math.min(1.5, sv / 25);
              c.scale?.set(s2, s2, s2);
              c.material.opacity = 0.08 + Math.min(0.18, sv / 150) + breathVal * 0.02;
            } else {
              c.material.opacity = cogLit ? Math.max(0.05, glowBase + breathVal * 0.04) : 0;
              const baseColor = c.userData.baseColor as string | undefined;
              if (baseColor && c.material.color) {
                const target = cogLit && cogDimColor ? cogDimColor : baseColor;
                if (c.userData.appliedColor !== target) {
                  c.material.color.set(target);
                  c.userData.appliedColor = target;
                }
              }
            }
          } else if (kind === "subject") {
            c.scale?.set(1, 1, 1);
          } else {
            const baseColor = c.userData.baseColor as string | undefined;
            if (baseColor && c.material.color && c.userData.appliedColor !== baseColor) {
              c.material.color.set(baseColor);
              c.userData.appliedColor = baseColor;
            }
          }
        }

        // Recommended glow strong pulse
        if (c?.userData?.isRecommendedGlow) {
          c.visible = isRec && !dimmed && !cogMode;
          if (c.visible && c.material && c.scale) {
            c.material.opacity = 0.1 + pulse * 0.3;
            const s = 1 + pulse * 0.4;
            c.scale.set(s, s, s);
          }
        }

        // Learning path glow (cyan pulse)
        if (c?.userData?.isPathGlow) {
          c.visible = onPath && !cogMode;
          if (c.visible && c.material && c.scale) {
            c.material.opacity = 0.18 + pulse * 0.25;
            const s = 1 + pulse * 0.25;
            c.scale.set(s, s, s);
          }
        }

        // Plan constellation glow: gentle gold halo; current task pulses hard
        if (c?.userData?.isPlanGlow) {
          c.visible = onPlan && !dimmed && !onPath && !cogMode;
          if (c.visible && c.material && c.scale) {
            if (isCurrentTask) {
              c.material.opacity = 0.25 + pulse * 0.35;
              const s = 1 + pulse * 0.5;
              c.scale.set(s, s, s);
            } else {
              const slow = Math.sin(t * 1.2) * 0.5 + 0.5;
              c.material.opacity = 0.1 + slow * 0.12;
              const s = 1 + slow * 0.12;
              c.scale.set(s, s, s);
            }
          }
        }

        // Label: scale, opacity, LOD
        if (c?.userData?.isLabel) {
          const hl = isActive || isNeighbor;
          const baseScale = (c.userData.baseScale as number) || 15;
          const hlScale = (c.userData.hlScale as number) || 26;
          const aspect = (c.userData.aspect as number) || 128 / 512;
          const sc = hl ? hlScale : baseScale;
          if (c.scale) c.scale.set(sc, sc * aspect, 1);
          if (c.material) {
            if (kind === "subject") {
              c.material.opacity = dimmed ? 0.3 : subjDim ? 0.4 : 1;
            } else if (cogMode) {
              c.material.opacity = cogLit ? (hl ? 1 : 0.9) : 0.08;
            } else {
              c.material.opacity = dimmed
                ? 0.15
                : hl || onPath
                  ? 1
                  : subjDim
                    ? 0.15
                    : status === "locked"
                      ? 0.45
                      : 0.85;
            }
          }
          if (kind === "knowledge") {
            c.visible = camDist < 350 || hl || onPath;
          }
        }
      }
    });

    // Celebration animation
    const cel = celebrationRef.current;
    if (cel) {
      const elapsed = (Date.now() - cel.startTime) / 1000;
      if (elapsed > 2) {
        if (scene.remove) {
          scene.remove(cel.particles as never);
          scene.remove(cel.ring as never);
        }
        celebrationRef.current = null;
      } else {
        const pts = cel.particles as { geometry?: { attributes?: { position?: { array: Float32Array; needsUpdate: boolean } } }; material?: { opacity: number } };
        if (pts?.geometry?.attributes?.position) {
          const posArr = pts.geometry.attributes.position.array;
          const vels = ((cel.particles as { userData?: { velocities?: number[] } })?.userData?.velocities || []) as number[];
          for (let i = 0; i < posArr.length / 3; i++) {
            posArr[i * 3] += vels[i * 3] || 0;
            posArr[i * 3 + 1] += vels[i * 3 + 1] || 0;
            posArr[i * 3 + 2] += vels[i * 3 + 2] || 0;
          }
          pts.geometry.attributes.position.needsUpdate = true;
          if (pts.material) pts.material.opacity = Math.max(0, 1 - elapsed / 1.5);
        }
        const ring = cel.ring as { scale?: { set: (x: number, y: number, z: number) => void }; material?: { opacity: number } };
        if (ring?.scale && ring?.material) {
          const s = 1 + elapsed * 8;
          ring.scale.set(s, s, s);
          ring.material.opacity = Math.max(0, 0.8 - elapsed / 1.2);
        }
      }
    }
  }, []);

  // Periodically report positions to minimap
  useEffect(() => {
    if (!onPositionsUpdate) return;
    const interval = setInterval(() => {
      const fg = fgRef.current;
      const camPos = fg?.camera?.()?.position ?? null;
      const miniNodes: MiniMapNode[] = graphData.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        x: (n as { x?: number }).x,
        y: (n as { y?: number }).y,
        z: (n as { z?: number }).z,
        color: n.color,
        kind: n.kind,
        status: n.status,
      }));
      onPositionsUpdate(miniNodes, camPos ? { x: camPos.x, y: camPos.y, z: camPos.z } : null);
    }, 1000);
    return () => clearInterval(interval);
  }, [onPositionsUpdate, graphData.nodes]);

  const handleNodeClick = useCallback(
    (node: UniverseNode) => {
      if (node.kind === "subject") onSubjectToggle(node.id);
      else if (node.data) onKnowledgeSelect(node.data);
    },
    [onSubjectToggle, onKnowledgeSelect]
  );

  const handleNodeHover = useCallback(
    (node: UniverseNode | null) => {
      const id = node?.id || null;
      setHoveredNodeId(id);
      if (containerRef.current) {
        containerRef.current.style.cursor = node ? "pointer" : "grab";
      }
      if (node?.kind === "knowledge" && node.data) onNodeHover?.(node.data);
      else if (node?.kind === "subject" && node.subjectData) onNodeHover?.(node.subjectData);
      else onNodeHover?.(null);
    },
    [onNodeHover]
  );

  // Link callbacks with hover + learning path highlight
  const linkEnds = (link: UniverseLink): [string, string] => {
    const s = typeof link.source === "string" ? link.source : (link.source as unknown as { id: string }).id;
    const tgt = typeof link.target === "string" ? link.target : (link.target as unknown as { id: string }).id;
    return [s, tgt];
  };

  // route 段是否已完成：两端节点都已掌握
  const isRouteDone = useCallback((link: UniverseLink) => {
    const [s, tgt] = linkEnds(link);
    return statuses.get(s) === "learned" && statuses.get(tgt) === "learned";
  }, [statuses]);

  const linkColor = useCallback((link: UniverseLink) => {
    const [s, tgt] = linkEnds(link);
    if (link.kind === "route") {
      // 计划学习路线：青色有向链路，完成段变绿；其它高亮态下也保持可见
      if (cognitionMode) return "rgba(34,211,238,0.08)";
      const done = isRouteDone(link);
      if (activeNodeId && s !== activeNodeId && tgt !== activeNodeId) {
        return done ? "rgba(52,211,153,0.22)" : "rgba(34,211,238,0.22)";
      }
      return done ? "rgba(52,211,153,0.95)" : "rgba(34,211,238,0.95)";
    }
    if (cognitionMode) {
      // 认知层：连线整体弱化，突出节点本身
      if (link.kind === "membership") return "rgba(255,255,255,0.015)";
      return "rgba(255,255,255,0.05)";
    }
    if (pathEdgeKeys.has(`${s}->${tgt}`)) return "rgba(45,212,191,1)";
    const isAdjacentToActive = activeNodeId && (s === activeNodeId || tgt === activeNodeId);
    if (isAdjacentToActive) {
      if (link.kind === "subject_rel") return "rgba(196,181,253,0.9)";
      if (link.kind === "cross") return "rgba(255,210,70,1)";
      if (link.kind === "prerequisite") return "rgba(96,200,255,0.95)";
      if (link.kind === "membership") return "rgba(255,255,255,0.6)";
      return "rgba(180,220,255,0.8)";
    }
    if (activeNodeId) {
      return "rgba(255,255,255,0.02)";
    }
    if (planEdgeKeys.has(`${s}->${tgt}`)) return "rgba(251,191,36,0.4)";
    if (link.kind === "subject_rel") return "rgba(167,139,250,0.28)";
    if (link.kind === "cross") return "rgba(255,200,50,0.5)";
    if (link.kind === "prerequisite") return "rgba(255,255,255,0.25)";
    if (link.kind === "membership") return "rgba(255,255,255,0.03)";
    return "rgba(255,255,255,0.12)";
  }, [activeNodeId, pathEdgeKeys, planEdgeKeys, cognitionMode, isRouteDone]);

  const linkWidth = useCallback((link: UniverseLink) => {
    const [s, tgt] = linkEnds(link);
    if (link.kind === "route") return cognitionMode ? 0.5 : 2.4;
    if (cognitionMode) return 0.2;
    if (pathEdgeKeys.has(`${s}->${tgt}`)) return 3;
    const isAdjacentToActive = activeNodeId && (s === activeNodeId || tgt === activeNodeId);
    if (isAdjacentToActive) {
      if (link.kind === "subject_rel") return 2.2;
      if (link.kind === "cross") return 3.5;
      if (link.kind === "prerequisite") return 2.5;
      return 1.5;
    }
    if (planEdgeKeys.has(`${s}->${tgt}`)) return 1.0;
    if (link.kind === "subject_rel") return 0.8;
    if (link.kind === "cross") return 1.2;
    if (link.kind === "prerequisite") return 0.5;
    return 0.15;
  }, [activeNodeId, pathEdgeKeys, planEdgeKeys, cognitionMode]);

  const linkCurvature = useCallback((link: UniverseLink) => {
    if (link.kind === "route") return 0.25;
    if (link.kind === "subject_rel") return 0.12;
    if (link.kind === "cross") return 0.15;
    if (link.kind === "prerequisite") return 0.05;
    return 0;
  }, []);

  const linkParticles = useCallback((link: UniverseLink) => {
    if (cognitionMode) return 0;
    const [s, tgt] = linkEnds(link);
    if (link.kind === "subject_rel") return 0;
    if (link.kind === "route") return isRouteDone(link) ? 2 : 5;
    if (pathEdgeKeys.has(`${s}->${tgt}`)) return 5;
    if (planEdgeKeys.has(`${s}->${tgt}`)) return 1;
    if (link.kind === "cross") return 3;
    if (link.kind === "prerequisite") return 2;
    return 0;
  }, [pathEdgeKeys, planEdgeKeys, cognitionMode, isRouteDone]);

  const linkParticleSpeed = useCallback((link: UniverseLink) => {
    const [s, tgt] = linkEnds(link);
    if (link.kind === "route") return 0.006;
    if (pathEdgeKeys.has(`${s}->${tgt}`)) return 0.004;
    if (link.kind === "cross") return 0.002;
    return 0.0015;
  }, [pathEdgeKeys]);

  const linkParticleWidth = useCallback((link: UniverseLink) => {
    const [s, tgt] = linkEnds(link);
    if (link.kind === "route") return 2.4;
    if (pathEdgeKeys.has(`${s}->${tgt}`)) return 2.2;
    if (link.kind === "cross") return 1.8;
    return 0.8;
  }, [pathEdgeKeys]);

  const linkParticleColor = useCallback((link: UniverseLink) => {
    const [s, tgt] = linkEnds(link);
    if (link.kind === "route") return isRouteDone(link) ? "#34d399" : "#22d3ee";
    if (pathEdgeKeys.has(`${s}->${tgt}`)) return "#2dd4bf";
    if (planEdgeKeys.has(`${s}->${tgt}`)) return "#fbbf24";
    if (link.kind === "cross") return "#fbbf24";
    return "rgba(255,255,255,0.5)";
  }, [pathEdgeKeys, planEdgeKeys, isRouteDone]);

  const nodeByIdMap = useMemo(() => {
    const m = new Map<string, UniverseNode>();
    for (const n of graphData.nodes) m.set(n.id, n);
    return m;
  }, [graphData.nodes]);

  const handleLinkClick = useCallback(
    (link: UniverseLink) => {
      if (!onLinkClick) return;
      if (link.kind === "membership") return;
      const sourceId = typeof link.source === "string" ? link.source : (link.source as unknown as { id: string }).id;
      const targetId = typeof link.target === "string" ? link.target : (link.target as unknown as { id: string }).id;
      const sourceNode = nodeByIdMap.get(sourceId);
      const targetNode = nodeByIdMap.get(targetId);
      const kindLabels: Record<string, string> = { cross: "跨学科关联", prerequisite: "前置知识", related: "相关知识", membership: "归属", route: "计划学习路线", subject_rel: "学科关联" };
      onLinkClick({
        sourceLabel: sourceNode?.label || sourceId,
        targetLabel: targetNode?.label || targetId,
        reason: link.reason || `${sourceNode?.label || ""} 与 ${targetNode?.label || ""} 之间存在${kindLabels[link.kind] || "关联"}关系`,
        kind: kindLabels[link.kind] || link.kind,
      });
    },
    [onLinkClick, nodeByIdMap]
  );

  const nodeLabel = useCallback((node: UniverseNode) => {
    if (node.kind === "subject") return node.label;
    const statusText = node.status === "learned"
      ? ` ✓ 第 ${node.mastery || 1} 周目 · ${cycleDef(node.mastery || 1).name}`
      : node.status === "locked" ? " 🔒 未解锁" : " · 可以学";
    return `${node.label}${statusText}`;
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full cursor-grab">
      {size.width > 0 && (
        <ForceGraph3D
          ref={fgRef as never}
          width={size.width}
          height={size.height}
          graphData={graphData as never}
          backgroundColor="rgba(0,0,0,0)"
          nodeThreeObject={nodeThreeObject as never}
          nodeLabel={nodeLabel as never}
          onNodeClick={handleNodeClick as never}
          onNodeHover={handleNodeHover as never}
          onLinkClick={handleLinkClick as never}
          onBackgroundClick={(() => onBackgroundClick?.()) as never}
          onEngineTick={onEngineTick as never}
          linkColor={linkColor as never}
          linkWidth={linkWidth as never}
          linkCurvature={linkCurvature as never}
          linkDirectionalParticles={linkParticles as never}
          linkDirectionalParticleSpeed={linkParticleSpeed as never}
          linkDirectionalParticleWidth={linkParticleWidth as never}
          linkDirectionalParticleColor={linkParticleColor as never}
          linkDirectionalArrowLength={((link: UniverseLink) =>
            link.kind === "route" ? 6 : link.kind === "subject_rel" || link.kind === "membership" ? 0 : 3) as never}
          linkDirectionalArrowColor={((link: UniverseLink) =>
            link.kind === "route" ? (isRouteDone(link) ? "#34d399" : "#22d3ee") : undefined) as never}
          linkDirectionalArrowRelPos={0.9}
          linkOpacity={0.8}
          showNavInfo={false}
          cooldownTicks={150}
          d3VelocityDecay={0.2}
          d3AlphaDecay={0.015}
          enableNodeDrag={true}
        />
      )}
    </div>
  );
}
