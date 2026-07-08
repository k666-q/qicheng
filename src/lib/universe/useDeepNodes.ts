"use client";

import { useState, useCallback } from "react";
import type { KnowledgeNode, KnowledgeEdge } from "./types";
import { loadDeepNodes, type DeepNodeFile } from "./deep-loader";

type DeepState = {
  loading: boolean;
  error: string | null;
  data: DeepNodeFile | null;
};

/**
 * Hook for loading and generating deep sub-nodes for a given parent node.
 * Tries local JSON first, falls back to AI generation if not found.
 */
export function useDeepNodes() {
  const [deepStates, setDeepStates] = useState<Map<string, DeepState>>(
    new Map()
  );

  const getState = useCallback(
    (parentId: string): DeepState => {
      return (
        deepStates.get(parentId) || { loading: false, error: null, data: null }
      );
    },
    [deepStates]
  );

  const loadChildren = useCallback(
    async (
      parentNode: KnowledgeNode
    ): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } | null> => {
      const parentId = parentNode.id;

      const existing = deepStates.get(parentId);
      if (existing?.data) return existing.data;

      setDeepStates((prev) => {
        const next = new Map(prev);
        next.set(parentId, { loading: true, error: null, data: null });
        return next;
      });

      // Try loading from static JSON first
      const local = await loadDeepNodes(parentId);
      if (local) {
        setDeepStates((prev) => {
          const next = new Map(prev);
          next.set(parentId, { loading: false, error: null, data: local });
          return next;
        });
        return local;
      }

      // Fall back to AI generation
      try {
        const res = await fetch("/api/generate-subtree", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: parentNode.id,
            nodeName: parentNode.name,
            description: parentNode.description,
            subjectId: parentNode.subjectId,
            subjectName: parentNode.subjectId,
            depth: parentNode.depth ?? 0,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "请求失败" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as DeepNodeFile;

        // Cache locally in localStorage for next time
        try {
          localStorage.setItem(
            `qc_deep_${parentId}`,
            JSON.stringify(data)
          );
        } catch {
          // Storage full, ignore
        }

        setDeepStates((prev) => {
          const next = new Map(prev);
          next.set(parentId, { loading: false, error: null, data });
          return next;
        });
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成失败";
        setDeepStates((prev) => {
          const next = new Map(prev);
          next.set(parentId, { loading: false, error: message, data: null });
          return next;
        });
        return null;
      }
    },
    [deepStates]
  );

  return { loadChildren, getState };
}
