/**
 * User-defined custom subjects - independent of the official knowledge graph.
 * Stored locally, with AI-assisted sub-tree generation support.
 */

import type { KnowledgeNode, KnowledgeEdge, SubjectNode } from "./types";

export type CustomSubject = {
  subject: SubjectNode;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "qc_custom_subjects";

export function loadCustomSubjects(): CustomSubject[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCustomSubjects(subjects: CustomSubject[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
}

export function createCustomSubject(name: string, color?: string): CustomSubject {
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const custom: CustomSubject = {
    subject: {
      id,
      name,
      color: color || generateColor(),
      description: `用户自定义学科：${name}`,
      category: "自定义",
    },
    nodes: [],
    edges: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const all = loadCustomSubjects();
  all.push(custom);
  saveCustomSubjects(all);
  return custom;
}

export function addNodeToCustomSubject(
  subjectId: string,
  node: Omit<KnowledgeNode, "subjectId">
): KnowledgeNode | null {
  const all = loadCustomSubjects();
  const idx = all.findIndex((s) => s.subject.id === subjectId);
  if (idx < 0) return null;

  const fullNode: KnowledgeNode = { ...node, subjectId };
  all[idx].nodes.push(fullNode);
  all[idx].updatedAt = Date.now();
  saveCustomSubjects(all);
  return fullNode;
}

export function addEdgeToCustomSubject(
  subjectId: string,
  edge: KnowledgeEdge
) {
  const all = loadCustomSubjects();
  const idx = all.findIndex((s) => s.subject.id === subjectId);
  if (idx < 0) return;

  all[idx].edges.push(edge);
  all[idx].updatedAt = Date.now();
  saveCustomSubjects(all);
}

export function deleteCustomSubject(subjectId: string) {
  let all = loadCustomSubjects();
  all = all.filter((s) => s.subject.id !== subjectId);
  saveCustomSubjects(all);
}

export function updateCustomNode(
  subjectId: string,
  nodeId: string,
  updates: Partial<KnowledgeNode>
) {
  const all = loadCustomSubjects();
  const idx = all.findIndex((s) => s.subject.id === subjectId);
  if (idx < 0) return;

  const nodeIdx = all[idx].nodes.findIndex((n) => n.id === nodeId);
  if (nodeIdx < 0) return;

  all[idx].nodes[nodeIdx] = { ...all[idx].nodes[nodeIdx], ...updates };
  all[idx].updatedAt = Date.now();
  saveCustomSubjects(all);
}

export function deleteCustomNode(subjectId: string, nodeId: string) {
  const all = loadCustomSubjects();
  const idx = all.findIndex((s) => s.subject.id === subjectId);
  if (idx < 0) return;

  all[idx].nodes = all[idx].nodes.filter((n) => n.id !== nodeId);
  all[idx].edges = all[idx].edges.filter(
    (e) => e.source !== nodeId && e.target !== nodeId
  );
  all[idx].updatedAt = Date.now();
  saveCustomSubjects(all);
}

function generateColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 55%)`;
}
