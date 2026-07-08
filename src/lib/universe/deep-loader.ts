import type { KnowledgeNode, KnowledgeEdge } from "./types";

export type DeepNodeFile = {
  parentId: string;
  subjectId: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

const _deepCache = new Map<string, DeepNodeFile>();
const _pendingLoads = new Map<string, Promise<DeepNodeFile | null>>();

/**
 * Dynamically import a deep node file for a given parent node ID.
 * Returns cached data if already loaded.
 */
export async function loadDeepNodes(
  parentNodeId: string
): Promise<DeepNodeFile | null> {
  if (_deepCache.has(parentNodeId)) {
    return _deepCache.get(parentNodeId)!;
  }

  if (_pendingLoads.has(parentNodeId)) {
    return _pendingLoads.get(parentNodeId)!;
  }

  const promise = (async () => {
    try {
      const mod = await import(
        `@/data/knowledge-graph/deep/${parentNodeId}.json`
      );
      const data = (mod.default || mod) as DeepNodeFile;
      _deepCache.set(parentNodeId, data);
      return data;
    } catch {
      return null;
    }
  })();

  _pendingLoads.set(parentNodeId, promise);
  const result = await promise;
  _pendingLoads.delete(parentNodeId);
  return result;
}

/** Synchronous check: are deep nodes already loaded for this parent? */
export function getDeepNodesSync(parentNodeId: string): DeepNodeFile | null {
  return _deepCache.get(parentNodeId) ?? null;
}

/** Check if we have deep data available (cached) */
export function isDeepLoaded(parentNodeId: string): boolean {
  return _deepCache.has(parentNodeId);
}

/** Get all currently loaded deep nodes as flat arrays */
export function getAllLoadedDeepNodes(): {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
} {
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  for (const data of _deepCache.values()) {
    nodes.push(...data.nodes);
    edges.push(...data.edges);
  }
  return { nodes, edges };
}

/** Clear cache for testing or reload */
export function clearDeepCache() {
  _deepCache.clear();
}
